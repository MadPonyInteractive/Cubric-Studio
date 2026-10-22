"""MPI-1243: does MOSS-Image decode with the SHIPPED flux2-vae (dep `vae-flux2`) as well as the bench's flux2-vae_small?

Reuses MPI-1180's mossbench (same API graph, same prompts); only node 15's vae_name and the output folder change.
    gpu_lease.py run --poll 2 -- python -I .agents/mpi-kanban/tasks/MPI-1243/research/vaebench.py
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'MPI-1180', 'research'))
import mossbench as mb

mb.OUT = os.path.join(HERE, 'vae')
for vae in ('small', 'full'):
    name = 'flux2-vae_small.safetensors' if vae == 'small' else 'flux2-vae.safetensors'
    mb.VARIANTS[f'turbo_{vae}'] = {'690': ('boolean', True), '738': ('sampler_name', 'euler'), '15': ('vae_name', name)}
    mb.VARIANTS[f'sft_{vae}'] = {'690': ('boolean', False), '15': ('vae_name', name)}
mb.run(['turbo_small', 'turbo_full', 'sft_small', 'sft_full'], [1], ['text', 'photo'])
