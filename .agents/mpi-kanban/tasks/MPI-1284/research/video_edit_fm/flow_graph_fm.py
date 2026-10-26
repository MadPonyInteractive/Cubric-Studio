# MPI-1284: Video Edit with H3 Reference's Fast Motion route ALWAYS ON (Fabio 2026-10-26). NOT wired into the app:
# a separate API prompt for Fabio's bench. Built on the shipped builder (MPI-1036 flow_graph.py) and patched:
#   - the transformer is the builder's (original ref2va, Input_Base_Model): the Flow's modelParams swap Singularity in
#   - sol-attn (core BlockSparseAttention, r2va node 891's settings) on the stage-1 model, after the turbo LoRA
#   - stage 1 drawn at the BASE: the 768p area (1032192 px, H3's own size) at the render's shape. A render up to it is
#     one pass, as today. Bigger (960p, 1080p, 2K, 4K, and a masked crop over 1016 square) draws the base, then the
#     3D latent upscaler takes it to the render (two hops past 2x the base, as r2va's mode 2), then a 3-step refine in
#     MpiWindowedSampler (r2va 712: euler, 0.9035/0.6316/0.3158/0, windows off the refine canvas, r2va 739)
#   - the refine model is the NON-turbo chain + EasyCache + shift 12/0.5, as r2va does with turbo on (586/587)
#   - <Video 1> for stage 1 is ~0.75 of the BASE (whole frame) or the crop resized to the base (masked); the refine
#     reads its own references at the render size, ref_image_size "max" (r2va Refine_Refs 688)
#   python flow_graph_fm.py  -> writes flow_video_edit_fm_api.json beside this file
import json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', '..', 'MPI-1036', 'research', 'bench'))
import flow_graph as fg  # noqa: E402

node = fg.node
BASE_AREA = 1032192  # the Resolution field's 768p
UPSCALER = 'minimax_h3_latent_upscaler_3d_bf16.safetensors'


def graph(**kw):
    g = fg.graph(**kw)

    # ---- sizes: target = the render (61/62: crop or whole frame), base = the 768p area at its shape
    g['200'] = node('MpiMath', 'Base width (768p area, render shape)', a=['61', 0], b=['62', 0],
                    math_expression=f'floor(sqrt({BASE_AREA} * a / b) / 32 + 0.5) * 32')
    g['201'] = node('MpiMath', 'Base height (768p area, render shape)', a=['62', 0], b=['61', 0],
                    math_expression=f'floor(sqrt({BASE_AREA} * a / b) / 32 + 0.5) * 32')
    # 0 = one pass (render <= base), 1 = one upscale, 2 = two hops (render > 2x base), r2va 883 with the switch on
    g['202'] = node('MpiMath', 'Fast Motion Mode', a=['61', 0], b=['200', 0],
                    math_expression='0 if a <= b else (1 if a <= 2 * b else 2)')
    g['203'] = node('MpiMath', 'Stage 1 width', a=['61', 0], b=['200', 0], c=['202', 0], math_expression='a if c == 0 else b')
    g['204'] = node('MpiMath', 'Stage 1 height', a=['62', 0], b=['201', 0], c=['202', 0], math_expression='a if c == 0 else b')
    g['205'] = node('MpiMath', 'One Pass', a=['202', 0], math_expression='a == 0')

    # ---- stage-1 <Video 1>: the shipped 0.75 shape-keeping pick, off the STAGE-1 size (43/44 stay for the refine)
    def width_at(h):
        return f'floor({h} * a / b / 32 + 0.5) * 32'
    pick = 'b'
    for j in (2, 1, 0):
        h = f'(floor(0.75 * b / 32 + 0.5) + {j}) * 32'
        pick = f'{h} if fabs({width_at(h)} * b - {h} * a) <= 0.01 * {h} * a else ({pick})'
    g['206'] = node('MpiMath', "Stage 1 clip height (~0.75 of stage 1)", a=['203', 0], b=['204', 0], math_expression=pick)
    g['207'] = node('MpiMath', 'Stage 1 clip width', a=['203', 0], b=['204', 0], c=['206', 0], math_expression=width_at('c'))
    g['208'] = node('ImageResizeKJv2', 'Whole frame at 0.75 of stage 1', image=['46', 0], width=['207', 0],
                    height=['206', 0], upscale_method='lanczos', keep_proportion='crop', pad_color='0, 0, 0',
                    crop_position='center', divisible_by=32, device='cpu')
    g['209'] = node('ImageResizeKJv2', 'Crop at stage 1', image=['54', 1], width=['203', 0], height=['204', 0],
                    upscale_method='lanczos', keep_proportion='crop', pad_color='0, 0, 0', crop_position='center',
                    divisible_by=32, device='cpu')
    g['210'] = node('MpiIfElse', 'masked ? crop : whole frame (stage 1)', boolean=['24', 0], true=['209', 0],
                    false=['208', 0])

    # ---- stage 1: sol-attn after the turbo LoRA, drawn at the stage-1 size
    g['211'] = node('BlockSparseAttention', 'sol-attn', model=['106', 0], selection='sol-attn',
                    **{'selection.tau': 1.3}, start_percent=0.2, end_percent=1.0, dense_blocks='', min_tokens=12288,
                    extra_tokens=256, sink_conditioning='exact_kv_and_rows', verbose=False)
    g['108']['inputs']['model'] = ['211', 0]
    g['113']['inputs']['model'] = ['211', 0]
    g['110']['inputs'].update(width=['203', 0], height=['204', 0], ref_video_1=['210', 0])
    g['212'] = node('MpiClearVram', 'Free stage 1', passthrough=['115', 0])

    # ---- upscale: video latent to the render (or 2x base, then the render), audio latent carried through
    g['213'] = node('LTXVSeparateAVLatent', 'Separate AV Latent', av_latent=['212', 0])
    g['214'] = node('MpiMath', 'Hop 1 width', a=['61', 0], b=['203', 0], c=['202', 0], math_expression='a if c < 2 else 2 * b')
    g['215'] = node('MpiMath', 'Hop 1 height', a=['62', 0], b=['204', 0], c=['202', 0], math_expression='a if c < 2 else 2 * b')
    up = dict(model_name=UPSCALER, mode='target dimensions', align=32, enable_temporal_chunking=True,
              force_unload=True, device='cuda', precision='bf16')
    g['216'] = node('MinimaxH3LatentUpscaler3D', 'Minimax H3 Latent Upscaler (3D)', latent=['213', 0],
                    **{'mode.width': ['214', 0], 'mode.height': ['215', 0]}, **up)
    g['217'] = node('MinimaxH3LatentUpscaler3D', 'Hop 2 Upscaler', latent=['216', 0],
                    **{'mode.width': ['61', 0], 'mode.height': ['62', 0]}, **up)
    g['218'] = node('MpiMath', 'Needs Hop 2', a=['202', 0], math_expression='a == 2')
    g['219'] = node('MpiIfElse', 'hop 2 ? : hop 1', boolean=['218', 0], true=['217', 0], false=['216', 0])
    g['220'] = node('LTXVConcatAVLatent', 'Concat AV Latent', video_latent=['219', 0], audio_latent=['213', 1])

    # ---- refine at the render size, windowed: non-turbo chain (r2va with turbo on), its own references
    g['221'] = node('EasyCache', 'EasyCache', model=['148', 0], reuse_threshold=0.2, start_percent=0.15,
                    end_percent=0.95, verbose=True)
    g['222'] = node('MiniMaxH3SigmaShift', 'ModelSamplingMiniMaxH3 (refine)', model=['221', 0], shift_video=12,
                    shift_audio=0.5)
    g['223'] = node('MpiH3References', 'Refine_Refs', clip=g['110']['inputs']['clip'], vae=['102', 0],
                    audio_vae=['103', 0], prompt=g['110']['inputs']['prompt'], width=['61', 0], height=['62', 0],
                    length=['47', 0], ref_image_size='max', ref_image_1=['29', 0], ref_video_1=['60', 0])
    g['224'] = node('BasicGuider', 'Basic Guider (refine)', model=['222', 0], conditioning=['223', 0])
    g['225'] = node('ManualSigmas', '3 step Sigmas', sigmas='0.9035, 0.6316, 0.3158, 0.0000')
    g['226'] = node('KSamplerSelect', 'KSamplerSelect (refine)', sampler_name='euler')
    g['227'] = node('MpiMath', 'Window Frames', a=['61', 0], b=['62', 0],
                    math_expression='100000 if a * b < 850000 else (243 if a * b < 1100000 else (90 if a * b < 6000000 else 39))')
    g['228'] = node('MpiWindowedSampler', 'Mpi Windowed Sampler', noise=['111', 0], guider=['224', 0],
                    sampler=['226', 0], sigmas=['225', 0], latent_image=['220', 0], window_frames=['227', 0],
                    overlap_frames=17, frame_grid=5)
    g['229'] = node('MpiIfElse', 'one pass ? stage 1 : refined', boolean=['205', 0], true=['212', 0], false=['228', 0])
    g['116']['inputs']['samples'] = ['229', 0]
    return g


if __name__ == '__main__':
    out = os.path.join(HERE, 'flow_video_edit_fm_api.json')
    with open(out, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(graph(), f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', out, len(graph()), 'nodes')
