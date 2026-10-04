"""Generate RELEASE_NOTES['2.0.0'] + docs/releases/2026-10-04-v2.0.0.md from ONE list.

Re-runnable: replaces an existing '2.0.0' block and rewrites the archival note, so a
Gate 1 edit is made HERE and regenerated (parity is then exact by construction). Also
writes the Gate 2 release-body draft beside this file. Run: python <this file>.
Round 2 (2026-10-04): Fabio's Gate 1 edits applied. After ANY regeneration that changes
releaseNotes.js, Fabio must re-run `npm run release:approve -- --yes` (the token hashes it).
"""
import re, sys

ROOT = 'C:/AI/Mpi/Cubric-Vision/'
VERSION = '2.0.0'
DATE = '2026-10-04'

important = [
    "**Cubric Vision is now Cubric Studio.** Your projects folder is renamed for you. On Windows, re-pin your shortcut to CubricStudio.exe: the old CubricVision.exe goes in 2.1.",
    "**Mac users need macOS 14 (Sonoma) or later.** Every M-series Mac can run it.",
    "**Adding or removing a model folder now needs an engine restart.** Restart engine, at the end of Settings → External Connections, waits for anything you are generating to finish.",
    "**Inpainting no longer erases on an empty prompt.** Name what you want gone (\"remove the tattoo\") instead. Both Klein cards.",
    "**Krea 2 Inpaint is a lot better, and takes longer.** It reads your picture as reference, so what comes back sits in the scene. Krea 2 and Krea 2 NSFW.",
    "**NVIDIA PiD is staying.** Its Model Library tile no longer says it is marked for deprecation.",
    "**Deleting a card always asks first now.** Right-click → Delete opens the same box as the Delete key, and that box offers Archive beside Delete.",
    "**Reuse Prompt needs the source card to still be there.** The app no longer keeps hidden copies of your inputs, so archive a card instead of deleting it and Reuse works as before.",
    "**Extend and New shot are gone from video History.** Make the next shot, then select both clips and Combine them, or use the new Extend Video Flow.",
    "**\"Cleanup assets…\" slims a project down.** Right-click a project on the landing page to clear the thumbnails and previews the app rebuilds by itself. Handy before a backup.",
]

whats_new = [
    # Headline 1: Flows
    "**Flows, the first headline of this release.** A flow is a whole job in one place: it asks for what it needs a step at a time, installs its own models, and hands you a finished result. Open the Flow Library with the Flows button or TAB. Eleven to start with:",
    "**Draw It In**: draw something into a photo you already have",
    "**Scribble**: draw on a blank canvas and have it rendered",
    "**Object Stamp**: take an object out of one photo and put it in another",
    "**Character Sheet**: turn a description into a character reference sheet, with the front view's head removed for video models or kept",
    "**Outpaint**: extend a picture past its edges",
    "**Extend Video**: carry on past the last frame, sound and all",
    "**Add Foley**: give a silent clip its soundtrack",
    "**Upscale Video**: double a clip's resolution",
    "**Voice Changer**: say a line and have it come back in someone else's voice",
    "**Song**: write a song from a style, a mood and your own lyrics",
    "**Stems**: split a song into bass, drums, vocals and everything else",
    "**Head Swap and DramaBox** are sold separately as Flow packages. The Flow Library shows where to get them; drop a package on the library to install it.",
    # Headline 2: the agent
    "**An agent inside the app, the other headline.** Press Agent (or A) and ask in plain words: it picks and installs models, runs generations and Flows, and looks at what it made. It asks before anything costs money. Runs on your own DeepInfra, OpenRouter or OpenAI key, or free on Ollama.",
    "**Routines: save a chain of steps once, run it on any cards.** Ask the agent to save one (\"square it, upscale it, white background\"), then pick it from Routines on the selection bar. Your cards are never changed.",
    "**See which model drives the agent best.** The agent's model list shows each model's score and cost per chat. Benchmark yours and compare everyone's results at bench.cubric.studio.",
    "**Claude, Codex and Google Antigravity can drive Cubric Studio.** Ask for an image, a video or a GIF and it lands in your project; they can run your routines too. Settings → Connect an agent sets it up in one click.",
    # Sound
    "**Sound and speech in the prompt box.** Stable Audio 3 makes sound effects, instruments and instrumental music at the length you ask for. Chatterbox reads your text aloud in a voice you record or pick, in 23 languages.",
    "**Audio gets its own cards**: wide tiles that draw the waveform and fill as they play. Click the wave to jump there.",
    "**Dictate instead of typing.** Click the mic on the prompt box or the Agent panel, or hold Ctrl+Space. Uses your DeepInfra key, about $0.0002 a minute.",
    # Cloud
    "**Paid cloud models, on your own DeepInfra key.** No download and no GPU: Seedream 4, 4.5 and 5.0 Pro, FLUX 2 Dev, Pro and Max, FLUX.2 Klein 9B, Nano Banana 2 Lite, 2 and Pro, Seedance 1.5 Pro and 2.0, Wan 3.0, Veo 3.1 Fast and Veo 3.1.",
    "**Remote only skips the local engine entirely.** Choose it at first launch: projects open, cloud models generate, and the tools that need the engine say so instead of failing.",
    "**The prompt box shows what a paid run costs before you press Cue.**",
    "**Nano Banana edits take up to four reference images.**",
    "**Scribble and Draw It In can render on a cloud model.** Pick FLUX.2 Klein 9B (Cloud), or Nano Banana 2 Lite on Scribble, and the Flow runs on your DeepInfra key.",
    # Image models and tools
    "**Klein 9B now asks you to accept its licence before it downloads, like MiniMax H3.** Request access, paste a Hugging Face token, and the download unlocks. Free to use, and what you make is yours to sell.",
    "**Klein inpaints properly now.** What comes back sits in the light, style and perspective around your mask. Both the 4B and 9B cards.",
    "**The FLUX.2 Klein models have better quality and fewer errors**, like extra limbs.",
    "**A new + button on the Gallery and History prompt boxes** brings in a reference picture from your project or your disk. On a video in History, reference models (MiniMax H3 Reference, Seedance 2.0, Wan 3.0) work from the open clip.",
    "**Mask a picture and give it a reference at the same time.** Mask what should change, add a reference with the +, and run an Edit.",
    "**Place puts one picture inside another.** Drag a picture onto an image in History, or pick Place in the Composite tools, then move and scale it and Apply. Remove background cuts the object out first.",
    "**Videos can be upscaled with LTX, sound and all.** The Upscale tool in History doubles a clip's resolution. Short clips first: a long one can still run out of graphics memory.",
    "**GIFs have their own workspace.** Make GIF from selected cards or GIF Maker from a clip, then retime, trim and crop it, or cut the subject out of every frame.",
    "**Big photos just work.** 16K images import, thumbnail and edit, and a masked edit or Detail works on just the masked area. SVGs import too.",
    "**Shrink big pictures by megapixels.** A very large import offers to shrink to the megapixels you pick, Resize shrinks by megapixels or by a fixed factor, and the agent can do it for you.",
    "**Sharper masks on large images.** Masks work at up to 4096 pixels instead of 1536, so Grow and Shrink draw a smooth edge.",
    "**Pick a colour straight off the picture.** An eyedropper sits beside the Remove Background, Paint and Paint Adjust colours, and in Scribble and Draw It In's drawing step.",
    # Gallery
    "**Stack: collect several cards into one.** Drop a stack on the prompt box to run the current operation on every card in it, or open it to upscale, resize or crop them all together.",
    "**Selecting cards brings up a selection bar** where the prompt box was: Stack, Compare, Combine, Make GIF, marks, Download, Archive and Delete.",
    "**Mark cards with a dot, a square or a triangle.** The heart is now a mark: click for a dot, hold to pick a shape.",
    "**FILTER shows only images, videos or audio, or only the cards you marked.** The picker behind the + button has the same filters.",
    "**The card right-click menu is reorganised, and every entry explains itself** in the status bar, including why a greyed-out one is unavailable.",
    "**The landing page has a new crew.** Each of the five mascots owns a colour, and images, video, audio and prompts wear their mascot's colour across the app. The selected model's mascot peeks over the prompt box.",
    "**The radial menu is back.** Hold TAB and pick Gallery, Models, Flows or your latest workspace.",
    # Video and sound playback
    "**The video player's controls sit below the prompt box**, always in reach, and volume opens from the speaker button.",
    "**The video trim bar shows the clip's sound**, so you can cut on a word or a beat instead of guessing.",
    "**Choose which speakers or headphones Cubric Studio plays through**, in Settings → Audio.",
    # Settings, models, remote
    "**Choose where prompts are enhanced and images described**: ComfyUI (the default), Remote with your own key (DeepInfra, OpenRouter, OpenAI or any compatible address), or Ollama.",
    "**The cogwheel by the prompt shows the LoRAs your model is running**: name, strength, and a switch to mute one for the next run.",
    "**The Model Library can show only the models your GPU can run**, or the RunPod GPU you rented.",
    "**Choosing a RunPod GPU is a proper picker now**: one tile per card with its price, VRAM, stock and a Gen speed bar, fastest first.",
    "**Get an update when you want it.** Settings shows a new version at the top with a button to install it, and the startup prompt has a Don't ask again checkbox.",
]

fixes = [
    "**Pod runs no longer hang on \"Still connecting to the remote engine\"** after new nodes install. The app reconnects on its own.",
    "**A generation the engine loses now fails instead of waiting forever.**",
    "**Photos turned by the camera crop, edit and import upright.**",
    "**History and the landing page open quickly on big photos.**",
    "**Mask Adjust keeps working when you switch versions** in History.",
    "**Web pages in your browser can no longer reach Cubric Studio or its engine.** A site you visited could have started generations or read your pictures.",
    "**A generation that finishes after you switch projects lands where you started it.**",
    "**Masking a large picture no longer lags or draws jagged strokes**, and neither do the Paint and Composite brushes.",
    "**Big photos no longer shimmer when zoomed out**, in History and in Compare.",
    "**Copying cards into another project keeps their names.**",
    "**The Crop tool keeps the width and height you typed** in RESOLUTION mode, and the Divisible-by rounding in Ratio and Free.",
    "**Cropping past the edge of a JPEG no longer softens the photo**, and it is much faster on very large pictures.",
    "**The Upscale tool finds its upscalers when you picked your own models folder**, and a Pod's built-in upscalers appear too.",
    "**Installing a model on a Pod no longer says the volume is full when most of it is already there.**",
    "**A renamed or moved project folder keeps its gallery.**",
    "**Stop cancels only its own job**, and a stopped cloud run keeps the result it already paid for.",
    "**The engine refuses to start on a graphics driver too old for it, and says so** instead of crashing.",
    "**A model whose install was cut short can be installed again on a nearly full disk.**",
    "**Model downloads work with antivirus HTTPS scanning on**, such as Kaspersky, ESET, Avast and Bitdefender.",
    "**Krea 2 Image to Image works on your whole picture** instead of a square from the middle.",
    "**An import tells you it is happening**: a card with a spinner appears the moment you drop a file.",
    "**A big download survives a shaky connection.**",
    "**Cancelling an install no longer leaves the Model Library showing the wrong thing.**",
    "**Clicking away closes a panel now, wherever you are**, Settings, Hotkeys and About included.",
    "**The colour picker no longer opens off the bottom of the screen.**",
    "**The 8:5 shape really is 8:5**: 1280×800 at 1K, not 1280×768.",
    "**Cut-out images look right in the gallery.** Thumbnails keep their transparency.",
    "**Scrolling a gallery full of videos is smooth again.**",
    "**The first engine start no longer looks frozen.** The long step names itself.",
    "**The app no longer keeps running outdated engine components after an update.**",
    "**\"Run locally\" is honoured everywhere**, not just on the Cue button.",
    "**Live latent previews play everywhere they appear**, video runs in History included.",
    "**The gallery gives your graphics memory back** when you are not looking at it, and when a generation starts.",
    "**Big gallery cards are sharp.**",
    "**Generated files are named after the button you pressed**, like edit_004 or upscale_002. Files you already have keep their names.",
    "**Hovering a video card costs a fraction of what it did.**",
    "**Download-only Pods no longer fail when one CPU size sells out.**",
    "**Connect waits for your GPU by default** on new installs, trying in the background until one frees up. Turn it off in Remote.",
    "**Waiting for a GPU keeps your minimum system RAM.**",
    "**A sold-out GPU is no longer reported as \"no host with enough RAM\".**",
    "**The History workspace shows how many versions a card holds, and their size, again.**",
    "**Disk sizes use the same gigabytes as RunPod and Hugging Face**, so a model looks about 7% smaller in Windows File Explorer.",
    "**Cancelling a model download right as it starts now stops it.**",
    "**Opening a project no longer makes saves and generations wait.**",
]

engine = [
    "**The ComfyUI engine is unchanged from 1.5.0.** Three more custom-node packs come with it, for speech, voices and stems, and the Cubric pack moves to a newer version. The first launch after updating installs them, so expect that download.",
]

known_issues = [
    "**Updating? section:** **Use rented GPUs? Update to 2.0 before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs. 2.0 uses the new one.",
    "**Updating? section:** **Your first Connect after updating sets up a fresh Pod.** A Pod keeps the version it was made with, so 2.0 replaces the one an older version made instead of reusing it. The models on your network volume stay; only that first Connect takes longer.",
    "**First launch, Windows:** If double-clicking `CubricStudio.exe` does nothing, with no message at all, Windows' Smart App Control may have blocked it. It cannot make an exception for one app, and the builds are not code-signed yet, so there is nothing to click. Signing is the fix, and it is not in place yet.",
    "**First launch, macOS:** Setting up the local engine on a Mac needs Apple's Command Line Tools. If setup stops and asks for them, open Terminal, run `xcode-select --install`, let Apple's download finish, then press **Retry**.",
    "**Platform support, macOS:** Not tested on this version, including updating from 1.5.0.",
]

for group in (important, whats_new, fixes, engine):
    for s in group:
        assert '—' not in s and '–' not in s, ('dash', s[:60])
        assert '\n' not in s

def js_str(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

def js_list(name, items):
    if not items:
        return f'    {name}: [],\n'
    body = ''.join(f'      {js_str(s)},\n' for s in items)
    return f'    {name}: [\n{body}    ],\n'

block = (f"  '{VERSION}': {{\n"
         f"    version: '{VERSION}',\n"
         + js_list('whatIsNew', whats_new)
         + js_list('breakingChanges', [])
         + js_list('importantChanges', important)
         + js_list('fixes', fixes)
         + js_list('engineNotes', engine)
         + "  },\n")

p = ROOT + 'js/data/releaseNotes.js'
src = open(p, 'rb').read().decode('utf-8')
assert '\r\n' not in src
anchor = 'export const RELEASE_NOTES = {\n'
i = src.index(anchor) + len(anchor)
existing = re.match(r"  '" + re.escape(VERSION) + r"': \{\n.*?\n  \},\n", src[i:], flags=re.S)
if existing:
    src = src[:i] + block + src[i + existing.end():]
else:
    src = src[:i] + block + src[i:]
open(p, 'wb').write(src.encode('utf-8'))

md = [f'# Cubric Studio v{VERSION} ({DATE})', '', '## Changelog', '',
      'Cubric Vision becomes Cubric Studio, with two headlines: Flows, and an agent inside the app. Also sound and speech in the prompt box, cloud models on your own key, and big photos.', '']
for title, items in (('Important changes', important), ("What's new", whats_new), ('Fixes', fixes)):
    md += [f'### {title}', ''] + [f'- {s}' for s in items] + ['']
md += ['### New Operations', '',
       'The eleven Flows; the audio model ops `t2a` (Stable Audio 3) and `tts` (Chatterbox); cloud reference-to-video `ref2v`; `ltxVideoUpscale`; GIF cut-outs (`gifCutoutSam3`, `gifCutoutBirefnet`); `promptEnhance`. Retired with the Flows they belonged to: `flowHeadSwap` and `flowDramaBox` (now paid packages), `flowChatterBox` and `flowSoundAndMusic` (now the `tts` and `t2a` model ops); each key stays so older history still loads.', '',
       '### Breaking Changes', '', 'None. Project schema unchanged (4).', '',
       '### ComfyUI Engine', '', ] + [f'- {s}' for s in engine] + ['', 'Core unchanged (`v0.34.0`).', '',
       '### Known issues (GitHub release page only)', '',
       'Not in the in-app notes: the 1.5.0 update prompt shows no notes, so these reach users through the release body, in the section named on each line.', ''] + [f'- {s}' for s in known_issues] + ['']
open(ROOT + f'docs/releases/{DATE}-v{VERSION}.md', 'wb').write('\n'.join(md).encode('utf-8'))

# --- Gate 2 draft: the GitHub release body (docs/releases/github-release-checklist.md).
# Same bullets as the in-app notes; the Known issues lines go to the sections they name.
ki = {k: [s.split(':** ', 1)[1] for s in known_issues if s.startswith(f'**{k}:**')]
      for k in ('Updating? section', 'First launch, Windows', 'First launch, macOS', 'Platform support, macOS')}
body = ['# Cubric Studio 2.0', '',
        'Cubric Vision becomes Cubric Studio, with two headlines: Flows, and an agent inside the app.', '',
        '---', '', '## ⚠️ Updating? Check your version first', '',
        '**You are on 1.5.0:** update as normal, in the app or with the update zip below.', '',
        '**You are on anything older than 1.5.0:** download the full zip below. Your projects carry over. The update zip does not work on those versions: it stops with an "unknown error" and leaves your install working as it was.', '']
body += [f'- {s}' for s in ki['Updating? section']] + ['', '---', '']
for title, items in (('Important', important), ("What's new", whats_new), ('Fixes', fixes), ('Engine', engine)):
    body += [f'## {title}', ''] + [f'- {s}' for s in items] + ['']
body += ['---', '', '## First launch', '',
         'The builds are **not code-signed**. There is no certificate and no installer. Signing would start SmartScreen\'s reputation clock rather than skip it, so the warnings below are expected.', '',
         '**Windows.** Extract the zip anywhere and run **`CubricStudio.exe`**. Windows may show "Windows protected your PC". Click **More info**, then **Run anyway**. The app is unsigned, and this warning appears until the build earns reputation.', '']
body += ki['First launch, Windows'] + ['',
         '**macOS.** Any downloaded build is quarantined. Clear it, then launch:', '', '```',
         'xattr -dr com.apple.quarantine "<extracted folder>"', '```', '', 'then double-click `start.command`.', '']
body += ki['First launch, macOS'] + ['', '---', '', '## Platform support, please read', '',
         '- **Windows** - Tested on this version: a 1.5.0 install updated in place with the update zip kept its projects and settings, installed the new engine parts, and generated an image. Older than 1.5.0: take the full zip (see the top).',
         '- **Linux** - Tested on this version (Ubuntu 22.04): a 1.5.0 install updated in place with its own update script, renamed the projects folder to Cubric Studio and kept every project, and generated a cloud image. The local engine was not tested on Linux.',
         '- **macOS** - ' + ki['Platform support, macOS'][0], '']
open(ROOT + '.agents/mpi-kanban/tasks/MPI-595/release-body-2.0.0.md', 'wb').write('\n'.join(body).encode('utf-8'))
print('important', len(important), 'new', len(whats_new), 'fixes', len(fixes), 'engine', len(engine))
