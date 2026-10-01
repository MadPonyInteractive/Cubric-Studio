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

## Known issues (GitHub release page ONLY, draft for Fabio)

> **Do NOT fold these into `releaseNotes.js`.** 1.5.0's update prompt shows no notes, so the
> in-app changelog only reaches people already on 2.0. Each line goes into the release body
> section named in bold (1.5.0's body is the template). Rules for the Windows line:
> `docs/releases/github-release-checklist.md` § "The third outcome". MPI-595 Gate C.

- **Updating? section:** **Use rented GPUs? Update to 2.0 before 15 November 2026.** That day
  RunPod switches off the connection every version before 2.0 uses to rent GPUs. 2.0 uses the
  new one.

- **Updating? section:** **Your first Connect after updating sets up a fresh Pod.** A Pod keeps
  the version it was made with, so 2.0 replaces the one an older version made instead of
  reusing it. The models on your network volume stay; only that first Connect takes longer.

- **First launch, Windows:** If double-clicking `CubricStudio.exe` does nothing, with no
  message at all, Windows' Smart App Control may have blocked it. It cannot make an exception
  for one app, and the builds are not code-signed yet, so there is nothing to click. Signing is
  the fix, and it is not in place yet.

- **First launch, macOS:** Setting up the local engine on a Mac needs Apple's Command Line
  Tools. If setup stops and asks for them, open Terminal, run `xcode-select --install`, let
  Apple's download finish, then press **Retry**.

- **Platform support, macOS:** Not tested on this version, including updating from 1.5.0.

## Important changes

- **Cubric Vision is now Cubric Studio.** The separate apps we planned became one app, so it
  takes the family name. Your projects folder is renamed for you; nothing to do. On Windows,
  re-pin your shortcut to `CubricStudio.exe`: the old `CubricVision.exe` goes in 2.1.

- **Mac users need macOS 14 (Sonoma) or later.** Some of the components the engine installs
  no longer build for older versions. Every M-series Mac can run it.

- **Head Swap and DramaBox are now paid Flow packages.** The Flow Library shows where to get
  them; drop a package on the library to install it.

- **Adding or removing a model folder now needs an engine restart.** There is a **Restart
  engine** button at the end of Settings → External Connections, and it waits for anything
  you are generating to finish.

- **Inpainting no longer erases on an empty prompt.** Name what you want gone — "remove the
  tattoo" — instead of clearing the prompt and painting over it. Both Klein cards.

- **FLUX.2 Klein 4B is one weight lighter.** The 72 MB outpaint LoRA is gone, and Cubric Studio
  clears it off your disk if you had it.

- **Krea 2 Inpaint is a lot better, and takes longer.** It now reads your picture as
  reference, so what comes back sits in the scene properly. Krea 2 and Krea 2 NSFW.

- **NVIDIA PiD is staying.** Its Model Library tile no longer says it is marked for
  deprecation.

- **Deleting a card always asks first now.** Right-clicking a card and choosing Delete used to
  remove it and its files on the spot, with no confirmation. It opens the same box the Delete
  key does — and that box now offers **Archive** beside Delete, so you can put a card away
  instead of losing it.

- **Reuse Prompt needs the source card to still be there.** The app used to keep a hidden copy
  of every picture you fed into a generation, so Reuse could bring it back even after you had
  deleted the original. Those copies are gone. Archive a card instead of deleting it and Reuse
  works exactly as before; if the source really was deleted, Reuse tells you which inputs it
  could not bring back and leaves the rest.

- **"Cleanup assets…" is now the slim-a-project-down step.** Right-click a project on the
  landing page and it clears the thumbnails and video previews the app generates, which rebuild
  themselves next time you open the project, as well as the cached Reuse inputs it already
  cleared. Worth doing before you zip a project up or back it up.

## What's new

- **Flows are here, and they are the headline of this release.** A flow is a whole job in one
  place: it asks for what it needs a step at a time, brings its own models, and hands you a
  finished result. Open the Flow Library from the Flows button at the top of the gallery, from
  the landing page, or with TAB. Thirteen to start with:

  - **Draw It In** — draw something into a photo you already have
  - **Scribble** — draw on a blank canvas and have it rendered
  - **Object Stamp** — take an object out of one photo and put it in another
  - **Character Sheet** — turn a description into a character reference sheet, with the front
    view's head removed for video models or kept (one press on the result swaps them)
  - **Outpaint** — extend a picture past its edges
  - **Extend Video** — carry on past the last frame, sound and all
  - **Add Foley** — give a silent clip its soundtrack
  - **Upscale Video** — double a clip's resolution
  - **Voice Changer** — say a line and have it come back in someone else's voice
  - **Text to Speech** — read your text aloud in a voice you pick, in 23 languages
  - **Song** — write a song from a style, a mood and your own lyrics
  - **Stems** — split a song into bass, drums, vocals and everything else
  - **Sound & Music** — sound effects, one-shots, instruments and instrumental music

  Each flow says which models it needs and installs them for you. Most run on a model the
  Library already offers, so once you own it the flow costs you nothing extra. The Library has
  filters, search and a count.

- **Klein 9B now asks you to accept its licence before it downloads, like MiniMax H3.** Request
  access from the people who made it, paste a Hugging Face token, and Cubric Studio unlocks the
  download. Free to use, and the pictures you make are yours to sell.

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

- **The gallery prompt box has a + button too.** Browse your project or your disk for a
  reference picture instead of dragging one in.

- **You can go and get an update instead of waiting to be asked.** Settings shows a new
  version at the top with a button to install it, and the startup prompt now has a **Don't ask
  again** checkbox.

- **MiniMax H3's Turbo mode is faster and cleaner.** The full-quality 25-step mode is
  untouched.

- **MiniMax H3 Reference has its own Turbo weight now**, tuned for references — more
  cinematic shots, and sound that follows what you asked for more closely.

- **Audio looks like audio.** An audio card is now a wide tile drawn with its own waveform,
  filling as it plays. Click anywhere on the wave to jump there.

- **The gallery filters by kind: images, videos or audio.**

- **The video trim bar shows the clip's sound.** The waveform is drawn behind the trim
  handles, so you can cut an in or out point on a word or a beat instead of guessing. Clips
  with no sound look exactly as before.

- **Choose which speakers or headphones Cubric Studio plays through.** Settings has an Audio section
  with an Output picker and a Test button. Left empty, Windows keeps deciding.

- **The cogwheel by the prompt shows the LoRAs your model is running** — name, strength, and a
  switch to mute one for the next run, without leaving the prompt you are working on.

- **Stack: collect several cards into one.** Select cards and press Stack. Drop the stack on
  the prompt box to run the current operation on every card in it; the results arrive as a new
  stack, under one queue row you can cancel at once. Open a stack to upscale or resize every
  card together (crop and remove the background too, for pictures), or to step every card back
  a version.

- **Selecting cards brings up a selection bar where the prompt box was.** It shows how many
  cards are selected and holds everything that works on a selection: Stack, Compare,
  Combine and Make GIF; a dot, square or triangle mark for every selected card in one click
  (or clear them); then Download, Archive and Delete. Close it with X or Esc.

- **Choose where your prompts are enhanced and your images described.** Prompt enhancement can
  run on ComfyUI, on Remote (DeepInfra, OpenRouter, OpenAI or any compatible address, with your
  own key) or on Ollama. ComfyUI stays the default and needs nothing new.

- **Paid cloud models, on your own DeepInfra key.** No download and no GPU needed, billed to
  your DeepInfra account: Seedream 4, Seedream 4.5, Seedream 5.0 Pro, FLUX 2 Dev, FLUX 2 Pro,
  FLUX 2 Max, FLUX.2 Klein 9B, Nano Banana 2 Lite, Nano Banana 2, Nano Banana Pro, Seedance 1.5 Pro,
  Seedance 2.0, Wan 3.0, Veo 3.1 Fast and Veo 3.1. Choose Remote only at first launch and
  skip the engine entirely: projects open, cloud models generate, and the tools that need the
  local engine (Flows, Resize, Upscale, Remove Background) tell you so instead of failing.

- **Nano Banana edits take up to four reference images.**

- **Scribble, Draw It In and Outpaint can render on a cloud model.** Pick FLUX.2 Klein 9B
  (Cloud) as the edit model (Nano Banana 2 Lite too on Scribble), and the Flow
  renders on your DeepInfra key, with the price shown beside the model and the cost saved on
  the card. Without a local Klein installed, these Flows use the cloud model on their own,
  and the in-app agent asks you before each paid run.

- **The prompt box shows what a paid run costs before you press Cue.**

- **Dictate instead of typing.** A mic on the prompt box and the Agent panel: click it and speak,
  or hold Ctrl+Space. Uses your DeepInfra key, about $0.0002 a minute. Turn on Settings, Audio,
  Dictate in English to have any language you speak written in English (about $0.00045 a minute).

- **An agent inside the app.** Press Agent in the top bar (or A) and ask in plain words: it
  picks and installs models, runs generations and Flows, and looks at what it made. It asks
  before anything costs money. Runs on your own DeepInfra, OpenRouter or OpenAI key, or free
  on Ollama. Its panel is resizable. It can use a mask you painted, outpaint, make GIFs, upscale,
  crop or remove the background of many cards in one go, and look at your videos and GIFs.

- **Routines: save a chain of steps once, run it on any cards.** Ask the agent to save one
  ("square it, upscale it, white background"), then select cards and pick it from Routines on
  the selection bar. Your cards are never changed: each gets a new card with every step in its
  History. A routine is there in every project. Claude, Codex and Antigravity can save and run
  routines too.

- **See which model drives the agent best.** The agent's model list shows each tested model's
  score and cost per chat. Benchmark this model runs our tests on yours, and you can share the
  result anonymously: everyone's results are at bench.cubric.studio.

- **Claude, Codex and Google Antigravity can drive Cubric Studio.** Ask for an image, a video
  or a GIF and it lands in your project. Settings > Connect an agent sets it up in one click.

- **GIFs have their own workspace.** Make GIF from selected cards or GIF Maker from a clip, then
  retime, trim and crop it, duplicate a frame from the strip, or cut the subject out of every
  frame onto transparency.

- **Big photos just work.** 16K images import, thumbnail and edit, and anything over 4K offers
  to shrink to a size every tool handles quickly. SVGs import as pictures too.

- **Sharper masks on large images.** Masks now work at up to 4096 pixels instead of 1536, so on
  a 4K photo a mask edge lands on the exact pixel, and Grow and Shrink draw a smooth edge.

- **The video player's controls sit below the prompt box now**, so they are always in reach,
  and volume opens from the speaker button.

- **The landing page has a new crew.** The five Cubric mascots stand on a lit stage with a
  rotating quote. Hover one and it greets you; click it for a happy pose. The selected model's
  mascot peeks over the prompt box, and plays on a card while it generates.

- **Resize can shrink a picture by megapixels or by a fixed amount.** MP resizes to the
  megapixels you type, SCALE divides width and height by 1.5, 2, 3 or 4.

- **Mark cards with a dot, a square or a triangle.** The heart is now a mark — click for a
  dot, hold to pick a shape — and FILTER can show only the shapes you choose.

- **The radial menu is back.** Hold TAB and pick Gallery, Models, Flows or your latest
  workspace — a quick way to move between them. Models opens the model picker, so you can
  change the model you are generating with from anywhere.

- **The card right-click menu is reorganised, and every entry explains itself.** Two groups
  now: this card's own details (Rename, Card notes, Describe image), then anything that
  touches the files: Add to project, Open in file system, Download, and finally Archive and
  Delete together at the bottom. Compare, Combine and Make GIF moved to the selection bar.
  Hover any entry and the status bar says what it does, including why a greyed-out one is
  unavailable.

- **The Model Library can show only the models your GPU can run, or the RunPod GPU you rented.**

- **Choosing a RunPod GPU is a proper picker now.** Choose GPU opens one tile per card with its
  price, VRAM, how much stock is left, and a Gen speed bar from RunPod's own measured image
  times, so the fastest cards come first. Cards RunPod has not timed show no bar.

## Fixes

> **A fix to a FLOW does not belong here for this release** — flows debut in this version, so
> no released build ever had the bug and no user can have met it. The fix is part of the feature.

- **Pod runs no longer hang on "Still connecting to the remote engine".** After new nodes
  installed on a Pod, the next run could wait forever. The app now reconnects on its own.

- **Mask Adjust keeps working when you switch versions.** Grow, Shrink and Edge stopped
  responding after you picked another version of the image in History, until you left History
  and came back.

- **Web pages open in your browser can no longer reach Cubric Studio or its engine.** The
  app's local server and the image engine behind it used to answer any web page, so a site you
  visited could have started generations or read your pictures. Both now answer only Cubric
  Studio itself.

- **A generation that finishes after you switch projects lands where you started it.** It used
  to save into whichever project you had open when it finished, and the spinner followed you
  there too. The card now appears in the project you asked for it in, and is still there when
  you come back.

- **Masking a large picture no longer lags or draws jagged strokes.** The brush redraws only
  the area it touched. The Paint and Composite brushes get the same fix.

- **Big photos no longer shimmer when zoomed out.** Fine detail used to break into moiré
  patterns when a large image was fitted to the screen, in History and in Compare. It is now
  scaled down smoothly.

- **Copying cards into another project keeps their names.** A renamed card used to arrive
  under its generated name (like `t2i_004`); it now keeps the name you gave it.

- **The Crop tool's RESOLUTION mode keeps the width and height you typed**, and Ratio and Free
  crops keep the Divisible-by rounding the panel shows.

- **Cropping past the edge of a JPEG no longer softens the photo**, and it is much faster on very
  large pictures.

- **The Upscale tool finds its upscalers when you picked your own models folder.** It now
  looks in both folders, and a Pod's built-in upscalers appear in the list too.

- **Installing a model on a Pod no longer says the volume is full when most of it is already
  there.** The panel now shows how much of a model is on disk and how much is left.

- **A renamed or moved project folder keeps its gallery.**

- **Stop cancels only its own job, and a stopped cloud run keeps the result it already paid
  for.**

- **The engine refuses to start on a graphics driver too old for it, and says so** instead of
  crashing.

- **A model whose install was cut short can be installed again on a nearly full disk.** The
  leftover part-files now count as space the retry takes back, on a Pod and on your machine.

- **Model downloads work with antivirus HTTPS scanning on.** Kaspersky, ESET, Avast and
  Bitdefender made every download fail with a certificate error while your browser worked
  fine. Cubric Studio now trusts the same certificates your computer does.

- **Krea 2 Image to Image works on your whole picture** instead of a square cut out of the
  middle. Krea 2 and Krea 2 NSFW.

- **An import tells you it is happening.** A card with a spinner appears the moment you drop a
  file and turns into the finished item when it lands.

- **A big download survives a shaky connection.** Retries are spent on attempts that make no
  progress, so a large model no longer runs out of them halfway through.

- **Cancelling an install no longer leaves the Model Library showing the wrong thing.**

- **Clicking away closes a panel now, wherever you are** — Settings, Hotkeys and About
  included. The Cue queue stays open on purpose, so you can keep prompting.

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

- **Connect waits for your GPU by default.** RunPod stock moves minute to minute, so a card
  shown in stock is often gone by the time you press Connect. New installs now keep trying in
  the background until it frees up; you can still turn it off in Remote.

- **Waiting for a GPU keeps your minimum system RAM.** A Pod that connected after a wait, or on
  start-up, was placed on any host and ignored the floor you set.

- **A sold-out GPU is no longer reported as "no host with enough RAM".**

- **The History workspace shows how many versions a card holds, and their size, again.**

- **Disk sizes use the same gigabytes as RunPod and Hugging Face.** Windows File Explorer still
  uses the larger one, so a model looks about 7% smaller there than in the app.

- **Cancelling a model download right as it starts now stops it.**

- **Opening a project no longer makes saves and generations wait.** The project list stops
  loading its video previews when you leave it.
