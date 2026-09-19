# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **The next bump is intended as 2.0 — a major release, and Flows are what makes it
> one** (Fabio, 2026-08-26). That is why `## What's new` opens with the Flows section
> and every flow gets a LINE of its own: no shipped release note has ever mentioned Flows
> (checked across every version in `releaseNotes.js`), so this is the first time a user
> sees any of them. Keep that order when folding. (A LINE, not a section — each flow had a
> multi-paragraph entry until 2026-09-19, when the whole file was cut to the Length rule.) It also means **a "fix" to a flow is
> not a fix to anything a user ever had** — see the § Fixes note below.
>
> **Cleared 2026-08-15 after 1.4.2 shipped.** All nine items (4 new + 5 fixes) were
> folded into `RELEASE_NOTES['1.4.2']` and `docs/releases/2026-08-15-v1.4.2.md`.
>
> **Cleared 2026-08-11 after 1.4.1 shipped.** All nine bullets (1 new + 8 fixes)
> were folded into `RELEASE_NOTES['1.4.1']` and
> `docs/releases/2026-08-11-v1.4.1.md`, including the first-run entry an earlier
> commit (`e2b0ddbf`) had filed for 1.5.0 — Fabio retargeted the whole scratchpad
> at the patch, because nothing pending was a feature.
>
> **The reset is part of the bump and it got missed in 1.4.0** — the fold ran, the
> clear did not, which would have re-folded all of 1.4.0 into the next version and
> shipped every bullet twice. If you are folding a release and this file still holds
> the last one's items, that is the bug, not a backlog.
>
> **KEEP EVERY BULLET SHORT.** One or two lines: what it is, and why the user would care.
> The rule and what it looks like are in `docs/releases/README.md` § Content → "Length".
>
> **Before writing a "used to / previously / no longer" claim, check it against the
> last released tag** (`git show v<prev>:<path>`), per bullet. Code that changed two
> or three times inside one unreleased version reads like user-visible history but
> never shipped, and the entry is then simply false. Full gate:
> `.claude/skills/mpi-release/references/copy-review.md` § Gate 0.

## Important changes

- **Mac users need macOS 14 (Sonoma) or later.** Some of the components the engine installs
  no longer build for older versions. Every M-series Mac can run it.

- **FLUX.2 Klein is now FLUX.2 Klein 4B**, since Klein 9B arrived beside it.

- **Adding or removing a model folder now needs an engine restart.** There is a **Restart
  engine** button at the end of Settings → External Connections, and it waits for anything
  you are generating to finish.

- **Inpainting no longer erases on an empty prompt.** Name what you want gone — "remove the
  tattoo" — instead of clearing the prompt and painting over it. Both Klein cards.

- **FLUX.2 Klein 4B is one weight lighter.** The 72 MB outpaint LoRA is gone, and Vision
  clears it off your disk if you had it.

- **Krea 2 Inpaint is a lot better, and takes longer.** It now reads your picture as
  reference, so what comes back sits in the scene properly. Krea 2 and Krea 2 NSFW.

- **The engine moves to ComfyUI 0.34.0.** It updates itself the first time you open this
  version — a handful of small packages, not a reinstall, and no model is touched.

- **NVIDIA PiD is staying.** Its Model Library tile no longer says it is marked for
  deprecation.

## What's new

- **Flows are here, and they are the headline of this release.** A flow is a whole job in one
  place: it asks for what it needs a step at a time, brings its own models, and hands you a
  finished result. Open the Flow Library from the Flows button at the top of the gallery, from
  the landing page, or with TAB. Fourteen to start with:

  - **Head Swap** — put one picture's head on another
  - **Draw It In** — draw something into a photo you already have
  - **Scribble** — draw on a blank canvas and have it rendered
  - **Object Stamp** — take an object out of one photo and put it in another
  - **Character Sheet** — turn a description into a character reference sheet
  - **Outpaint** — extend a picture past its edges
  - **Extend Video** — carry on past the last frame, sound and all
  - **Add Foley** — give a silent clip its soundtrack
  - **Upscale Video** — double a clip's resolution
  - **Voice Changer** — say a line and have it come back in someone else's voice
  - **DramaBox** — describe a speaker and a performance, and hear your line delivered
  - **Text to Speech** — read your text aloud in a voice you pick, in 23 languages
  - **Stems** — split a song into bass, drums, vocals and everything else
  - **Sound & Music** — sound effects, one-shots, instruments and instrumental music

  Each flow says which models it needs and installs them for you. Most run on a model the
  Library already offers, so once you own it the flow costs you nothing extra.

- **FLUX.2 Klein now comes in two sizes.** The 9B card does the same seven things as 4B with
  more detail and closer prompt following, traded against speed. It wants about 15GB of video
  memory, so 4B stays the one to reach for on a 16GB card.

- **Klein 9B brings seven styles of its own** — Storybook, Comic, Anime, Chibi, Doodle,
  Vintage and Watercolour — on everything the card does. They are a different set from 4B's
  eight, not the same styles carried across.

- **Some models now ask you to accept their licence before they download.** Klein 9B is the
  first: request access from the people who made it, paste a Hugging Face token, and Vision
  unlocks the download. Free to use, and the pictures you make are yours to sell.

- **Klein inpaints properly now.** It samples with your mask as a real constraint and can see
  the picture underneath it, so what comes back sits in the light, style and perspective of
  everything around it. Both the 4B and 9B cards.

- **The FLUX.2 Klein models have better quality and fewer errors**, like extra limbs.

- **Place puts one picture inside another.** Pick Place from the Composite tools, drop in a
  second image, drag and scale it where you want, and Apply stamps it down as a new entry.
  Remove background cuts the object out first, so what lands is the object and not its box.

- **Videos can be upscaled with LTX, sound and all.** The Upscale tool in the History
  workspace doubles a clip's resolution and leaves the audio untouched. Short clips first — a
  long one can still exhaust graphics memory.

- **You can now mask a picture and give it a reference at the same time.** Her hair like this
  photo's hair, that jacket in this fabric. Mask what should change, add a reference with the
  **+** beside the prompt, and run an Edit. Drag the chips to reorder them when order matters.

- **You can go and get an update instead of waiting to be asked.** Settings shows a new
  version at the top with a button to install it, and the startup prompt now has a **Don't ask
  again** checkbox.

- **MiniMax H3's Turbo mode is faster and cleaner**, and its speed weight is 1.4 GB smaller to
  download. The full-quality 25-step mode is untouched.

- **MiniMax H3 Reference has its own Turbo weight now**, tuned for references — more
  cinematic shots, and sound that follows what you asked for more closely.

- **Audio looks like audio.** An audio card is now a wide tile drawn with its own waveform,
  filling as it plays. Click anywhere on the wave to jump there.

- **Choose which speakers or headphones Vision plays through.** Settings has an Audio section
  with an Output picker and a Test button. Left empty, Windows keeps deciding.

- **The cogwheel by the prompt shows the LoRAs your model is running** — name, strength, and a
  switch to mute one for the next run, without leaving the prompt you are working on.

- **Cue all: run one operation over many pictures.** Select several gallery cards, right-click,
  and each becomes its own job on your current prompt and settings.

- **Choose where your prompts are enhanced and your images described.** Prompt enhancement can
  run on ComfyUI, on Remote (DeepInfra, OpenRouter, OpenAI or any compatible address, with your
  own key) or on Ollama. ComfyUI stays the default and needs nothing new.

- **The video player's controls sit below the prompt box now**, so they are always in reach,
  and volume opens from the speaker button.

- **The landing page has a new crew.** The five Cubric mascots stand on a lit stage with a
  rotating quote. Hover one and it greets you; click it for a happy pose.

- **Resize can shrink a picture by megapixels or by a fixed amount.** MP resizes to the
  megapixels you type, SCALE divides width and height by 1.5, 2, 3 or 4.

- **Mark cards with a dot, a square or a triangle.** The heart is now a mark — click for a
  dot, hold to pick a shape — and FILTER can show only the shapes you choose.

- **The radial menu is back.** Hold TAB and pick Gallery, Models, Flows or your latest
  workspace — a quick way to move between them.

## Fixes

> **A fix to a FLOW does not belong here for this release** — flows debut in this version, so
> no released build ever had the bug and no user can have met it. The fix is part of the feature.

- **Masking a large picture no longer lags or draws jagged strokes.** The brush redraws only
  the area it touched. The Paint and Composite brushes get the same fix.

- **The Crop tool's RESOLUTION mode keeps the width and height you typed**, and Ratio and Free
  crops keep the Divisible-by rounding the panel shows.

- **The Upscale tool finds its upscalers when you picked your own models folder.** It now
  looks in both folders, and a Pod's built-in upscalers appear in the list too.

- **Installing a model on a Pod no longer says the volume is full when most of it is already
  there.** The panel now shows how much of a model is on disk and how much is left.

- **A model whose install was cut short can be installed again on a nearly full disk.** The
  leftover part-files now count as space the retry takes back, on a Pod and on your machine.

- **Krea 2 Image to Image works on your whole picture** instead of a square cut out of the
  middle. Krea 2 and Krea 2 NSFW.

- **Large videos and photos import properly.** Imports used to cap silently around 75 MB; a
  474 MB 4K clip now lands in seconds, and anything that does fail says so.

- **Phone videos no longer arrive on their side.** Portrait footage stays portrait.

- **An import tells you it is happening.** A card with a spinner appears the moment you drop a
  file and turns into the finished item when it lands.

- **MiniMax H3 installs far faster and takes 10 GB less disk.** Its largest file now comes
  from our own servers at tens of megabytes a second instead of under one. Quality is unchanged.

- **A half-installed model can give its disk space back.** **Remove files** now sits next to
  Install whenever a model is holding files, and still keeps anything another model needs.

- **A big download survives a shaky connection.** Retries are spent on attempts that make no
  progress, so a large model no longer runs out of them halfway through.

- **Cancelling an install no longer leaves the Model Library showing the wrong thing.**

- **Clicking away closes a panel now, wherever you are** — Settings, Hotkeys and About
  included. The Cue queue stays open on purpose, so you can keep prompting.

- **No more terminal windows flashing open when Vision starts** on Windows.

- **The colour picker no longer opens off the bottom of the screen.** It opens upward when
  there is no room below it.

- **The 8:5 shape really is 8:5.** At 1K it is 1280×800 now, not 1280×768. Pictures you
  already made are unaffected.

- **Cut-out images look right in the gallery.** Thumbnails hold transparency now, so a cut-out
  sits on the gallery background instead of showing its old backdrop. Existing projects rebuild
  their thumbnails the first time you open them.

- **Scrolling a gallery full of videos is smooth again.**

- **The first engine start no longer looks frozen.** The long step now names itself —
  "Installing Python packages… First engine start only".

- **The app no longer keeps running outdated engine components after an update.** "Skip the
  local engine install" clears itself once an engine is present.

- **"Run locally" is honoured everywhere**, not just on the Cue button.

- **Connecting to a cloud Pod no longer claims to have installed models it did not.**

- **Live latent previews play everywhere they appear.** The History workspace showed nothing
  at all on a video run, and the minimised preview window sat on a single frame.

- **The gallery gives your graphics memory back** when you are not looking at it, and again
  the moment a generation starts.

- **Big gallery cards are sharp.** A card now picks a thumbnail that matches the size it is
  drawn at.

- **Generated files are named after the button you pressed** — `edit_004` whichever model made
  it, `upscale_002`, `i2v_007`. Files you already have keep their names.

- **Hovering a video card costs a fraction of what it did.** The gallery keeps a 720p copy for
  hover; everything you export still uses the original.

- **Download-only Pods no longer fail when one CPU size sells out** — the app tries the others.

- **The History workspace shows how many versions a card holds, and their size, again.**

- **Disk sizes use the same gigabytes as RunPod and Hugging Face.** Windows File Explorer still
  uses the larger one, so a model looks about 7% smaller there than in the app.

- **Cancelling a model download right as it starts now stops it.**

- **Opening a project no longer makes saves and generations wait.** The project list stops
  loading its video previews when you leave it.
