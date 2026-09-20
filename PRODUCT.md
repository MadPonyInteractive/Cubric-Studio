# Cubric Studio — Product

## Identity

Cubric Studio is a desktop AI workstation for image and video work that runs entirely on the user's hardware. Generate, mask, inpaint, upscale, batch — without uploads, accounts, or quotas. Models the user installs, files the user keeps.

## Register

**Brand-led product.** The app surfaces (gallery, editor) serve creative work and are register=product. The landing surface is register=brand — first impression, identity moment.

## Users

A creator who:

- Has a capable GPU (≥12 GB VRAM) and runs models locally for control, privacy, or cost.
- Spends multi-hour sessions iterating on imagery — generating, masking faces, inpainting, cropping for social posts, occasionally video.
- Knows enough about diffusion models (SDXL, Flux, samplers, CFG, LoRA) to want real controls, but expects the surface to stay calm under load.
- Is comfortable in tools like Photoshop, Lightroom, DaVinci Resolve, but is tired of cloud lock-in and quota anxiety.

The persona is not a casual prompt-tweaker on a phone, and not an ML engineer with a notebook. It's a maker who treats imagery as craft.

## Product purpose

1. Make local AI image / video pipelines first-class. Generation, refinement, masking, upscaling, batching, video crop / vid2vid all in one app.
2. Keep the user's library on disk under their control. Project-based file structure on the user's machine.
3. Show machine state honestly. VRAM, RAM, queue depth, ETA visible at a glance — never hidden behind a spinner.
4. Stay out of the way during long sessions. The chrome must be inhabitable for hours, not glow-and-flash.

## Tone

- **Confident, not loud.** "Generate. Refine. Own it." Direct sentences. No hype copy.
- **Maker-to-maker.** The user is a peer. No tutorials inside the UI; the tool assumes competence.
- **Honest about state.** "Generating · 38% · 0:42 left" beats "Working on it ✨".

## Anti-references

The UI must not feel like:

- A generic dark "AI app on black with neon gradients."
- A consumer prompt toy — Midjourney web, Civitai, Leonardo.
- A heavyweight cloud creative suite — Adobe, Figma desktop.
- An IDE — VS Code, JetBrains.
- A Discord / Linear dark theme.

It should feel like a creator's instrument: warm enough to inhabit, deliberate, uncluttered.

## Strategic principles

1. **Mid-tone always.** Neither dark mode nor light mode. Warm dusk mauve / taupe at every surface. The screen reads inhabitable, not glowing.
2. **Mono everywhere; one display face for the wordmark only.** Single monospaced family (JetBrains Mono) carries every UI surface, label, and body text. `Russo One` is reserved for the `Cubric Studio` wordmark and nothing else.
3. **Imagery is the page in galleries; chrome retreats.** When the user is browsing assets, layouts use bold asymmetric strips that treat images as the layout, not as cards in a grid.
4. **Accent used theatrically, and it states a SUBJECT.** Cubric ships as a family of apps and each owns a hue — Studio cream, Vision rose, Prompt yellow, Audio green, Video orange. A surface takes the hue of the media type it is about: image-related is Vision, audio Audio, video Video, text-about-text Prompt, everywhere in the app and not just generations. A surface about no media type, or about several at once, takes Studio cream — that is cream's meaning, not a fallback. Components read one action token, `--accent-heat`, and a subtree rebinds it; never a hue at the call site. Even so, it stays an accent: primary actions, active states, "now-happening" moments. Never as background, never as gradient text. Values and the rebind mechanics live in `DESIGN.md` § The accent family.
5. **Honest state in the footer, never the title bar.** VRAM, RAM, queue, ETA live in the global status bar so the title bar can carry identity, not telemetry.
6. **The mascots have personality, but a quiet one.** Five characters, one per app, each wearing its family hue. Used in idle / thinking / empty / "all done" moments. Not on every screen.

## Mascots & logo

- **Logo:** the Studio robot's head — boxy face, cyan eyes, C-emblem — shipped already on-palette as `assets/mascot/studio/logo.png` and used as-is.
- **Mascots (full-body): five, one per app.** Studio runs the crew, Vision makes the images, Prompt shapes the words, Video puts them in motion, Audio gives them sound. Each wears its family hue, so the cast and the colour code say the same thing. Used sparingly:
  - The landing hero — all five on a lit stage, Studio centre. This is the only place the crew appears together.
  - Hovering in the corner of the editor canvas while a job is running ("Cubric is thinking…") — Studio alone.
  - Empty states — first-run landing, empty gallery, no-results filter.
  - Completion / success moments.

Away from the landing it is **always Studio**: a workspace does not swap in its own character, because the accent already states the subject. Never used as decorative wallpaper. Never animated more than gentle 4s float.

## Out of scope

- Multi-user / cloud sync. App stays single-user, on-device.
- Mobile or web mirror. Desktop only.
- Replacing professional editors — Cubric Studio is the AI workstation, not a color-grade suite or a typesetting tool.
