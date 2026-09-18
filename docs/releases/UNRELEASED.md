# Unreleased — pending notes for the next version bump

> Scratchpad for changelog items accumulated between releases. When running
> `/mpi-version-bump`, fold every item below into the new
> `RELEASE_NOTES['<newVersion>']` entry in `js/data/releaseNotes.js` and the
> archival `docs/releases/YYYY-MM-DD-v<newVersion>.md`, then clear this file
> back to the header.
>
> **The next bump is intended as 2.0 — a major release, and Flows are what makes it
> one** (Fabio, 2026-08-26). That is why `## What's new` opens with the Flows section
> and every flow gets its own entry: no shipped release note has ever mentioned Flows
> (checked across every version in `releaseNotes.js`), so this is the first time a user
> sees any of them. Keep that order when folding. It also means **a "fix" to a flow is
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
> **Before writing a "used to / previously / no longer" claim, check it against the
> last released tag** (`git show v<prev>:<path>`), per bullet. Code that changed two
> or three times inside one unreleased version reads like user-visible history but
> never shipped, and the entry is then simply false. Full gate:
> `.claude/skills/mpi-release/references/copy-review.md` § Gate 0.

## Important changes

- Mac users need macOS 14 (Sonoma) or later. Vision has always been Apple Silicon only, and
  every M-series Mac can run macOS 14 or newer, so this asks for an update rather than newer
  hardware. Some of the components the engine installs no longer publish a build for older
  macOS versions, and setup cannot finish without them.

- FLUX.2 Klein is now called FLUX.2 Klein 4B, since Klein 9B arrived beside it — the two are
  told apart by name instead of by a small size letter.

- Adding or removing a model folder now needs an engine restart, and there is a button for it.
  The engine reads its folder list once, at startup, so a folder you add while it is running
  was never going to be seen until it came back — it just used to happen silently and leave you
  wondering why your models were missing. Settings now says so when you add one, and a
  **Restart engine** button sits at the end of External Connections. Press it while something is
  generating and the restart waits for your work to finish rather than killing it. Dropping a
  file into a folder Vision already knows about still needs nothing.

- Inpainting no longer erases on an empty prompt — you have to say what you want removed.
  Clearing the prompt and painting over something used to delete it, and that was the whole
  erase gesture. Klein now samples with the mask as a real constraint, and an empty prompt is a
  no-op — the same gesture hands the picture back unchanged. Name the thing instead: "remove
  the tattoo", "remove the head". The bare word "remove" on its own does nothing either, and
  that is exactly what Vision used to fill in for you behind the scenes. Both the 4B and 9B
  cards.

- FLUX.2 Klein 4B is one weight lighter. The 72 MB outpaint LoRA was part of the old erase
  trick and nothing uses it any more, so Klein no longer downloads it and Vision clears it off
  your disk if you already had it.

- Krea 2 Inpaint is a lot better, and it takes longer. It now goes through the same machinery
  as Edit: the picture itself is handed to the model as reference and your words are read as
  an instruction about it, rather than as a description on their own. What comes back sits in
  the scene it was painted into far more reliably. Reading the source that way costs time, so
  an inpaint runs slower than it used to — a deliberate trade, and the reason the result is
  worth the wait. Krea 2 and Krea 2 NSFW both.

- The generation engine moves up three versions, and the update is a small one. Vision now
  runs ComfyUI 0.34.0 instead of 0.31.0. Your engine updates itself in place the first time
  you open this version — a handful of small packages, not the multi-gigabyte reinstall an
  engine change used to mean, and none of your models are touched.

- NVIDIA PiD is staying. Its Model Library tile no longer says it is marked for deprecation.
  PiD stays a model you pick in the prompt box, and works exactly as it does today.

## What's new

- **Flows are here, and they are the headline of this release.** A flow is a whole job in one
  place: it asks for what it needs a step at a time, brings its own models, and hands you a
  finished result — no workspace to assemble, no settings to know. Open the Flow Library from
  the Flows button at the top of the gallery, from the landing page, or with Tab, which cycles
  the gallery, your last card and the flow you have open, so you can step out to check a
  picture and land back where you left off. The Library filters flows by Image, Video or Audio and
  by what they do (create, edit or enhance), searches their names and descriptions, and counts
  the ones you have installed. Fourteen to start with:

  - **Head Swap** — put one picture's head on another
  - **Extend Video** — carry on past the last frame
  - **Add Foley** — give a silent clip its sound
  - **Upscale Video** — double a clip's resolution
  - **Draw It In** — draw something into a photo you already have
  - **Scribble** — draw on nothing and have it rendered
  - **Character Sheet** — turn a description into a reference sheet
  - **Outpaint** — extend a picture past its edges
  - **Voice Changer** — say a line and have it come back in someone else's voice
  - **Object Stamp** — take an object out of one photo and put it into another
  - **DramaBox** — describe a speaker and a performance, and hear your line delivered
  - **Text to Speech** — read your text aloud in a voice you pick, in any of 23 languages
  - **Stems** — pull a song apart into bass, drums, vocals and everything else
  - **Sound & Music** — sound effects, one-shots, instruments and instrumental music

  Each flow tells you which models it needs and installs them for you, and most of them run on a
  model the Library already offers — so once you own the model, the flow costs you nothing extra.
  The three video flows all run on LTX 2.3 Balanced, so installing it for one gives you the other
  two. Six flows are the exception and say so on their card: Head Swap adds a head-swap LoRA on
  top of FLUX.2 Klein 9B, and Voice Changer, DramaBox, Text to Speech, Stems and Sound & Music all
  bring their own weights and need no model from the Library at all. The three voice flows share
  weights where they can, so owning one makes the next one smaller.

- **Head Swap** takes a head from one picture and puts it on another. Load the picture you want
  to keep, add the picture with the head you want, draw a square around each head, and run. It
  runs on FLUX.2 Klein 9B with a head-swap LoRA, and when it finishes the flow shows both your
  pictures beside the result while the gallery keeps just the swap. An optional field on the last step
  lets you describe the expression the new head should end with; leave it empty and the swap follows
  the original picture's expression. The square may sit past the edge of the
  picture and stretch up to the picture's longest side, so a head near a border — or tall hair,
  or a neck tattoo — can be taken in without the box swallowing whoever is standing next to
  them. The reference head is padded back to square before the model sees it, and what you get
  back is your own picture with no border strip added.

- **Extend Video** continues a clip past its last frame. Drop a video, describe what happens
  next, and LTX 2.3 generates the new seconds — with matching audio — onto the end of it.

- **Add Foley** gives a silent clip a soundtrack. Drop a video, describe what it should sound
  like, and LTX 2.3 generates matching foley across the whole clip. The picture comes back
  untouched — only sound is added.

- **Upscale Video** doubles a clip's resolution and rebuilds its detail. Drop a video and LTX
  2.3 re-renders it at 2x, with the audio coming through untouched. Short clips first: the cost
  grows with length, and a long one can still exhaust graphics memory. The same upscaler is
  also in the History workspace as a tool, further down these notes — the flow is the version
  you can run without assembling anything.

- **Draw It In** puts something new into a photo you already have — a person, an animal, an
  object. Load the picture, draw roughly where the thing goes, how big it is and what pose it
  holds, say what you drew, and box the area to blend. FLUX.2 Klein 9B renders it straight into
  the scene, matching the light, casting a shadow on the ground and letting whatever is already
  in front of it overlap its edges — so it can stand behind things in the photo, not only on
  top of them. The drawing carries the placement and the words carry the subject, so the better
  you draw it the more detail survives and the less you have to fight the prompt: an outline
  with a pose and a tail gives the model far more to work with than a filled blob. The words
  carry style too — ask for a cartoon man and only he comes back a cartoon, the photo around
  him is untouched. Only the area you box is ever re-rendered; the rest of your picture comes
  back exactly as it was.

- **Scribble** turns a drawing into a finished picture, starting from nothing at all. Pick the
  shape you want, draw on the blank canvas — or bring in a sketch you made elsewhere — and say
  what it is. The drawing gives the composition and the words give the subject and the look, so
  it does not have to be a good drawing: rough placement and a readable silhouette are enough
  for FLUX.2 Klein to build a finished image around. Nothing you draw survives into the result
  — the lines are a guide, not part of the picture. Ask for an anime illustration and you get
  one; load a style LoRA and it drives the whole look without you typing a word about style. 9B
  is the recommended model and 4B runs the same flow on a smaller card.

- **Object Stamp** takes an object out of one photo and puts it into another — a mug on your
  desk, a lamp in the corner of your living room, a bag on a chair. Bring the scene and a
  picture of the object, tidy the object up with a background remove and an eraser, then drag
  it to where it should sit. FLUX.2 Klein re-renders just that patch: the object keeps its own
  shape and markings, and it comes back lit by the scene it landed in, resting on the surface
  it touches with a shadow that matches the ones already there. Only the box you drew is
  touched, so the rest of the photo is untouched pixel for pixel.

  Two ways to run it, and the difference is worth knowing. **Auto** keeps the object's own
  pixels, so it comes back as itself — use it whenever the angle it was photographed at already
  suits the scene, which is most of the time. **Manual** lets the model draw the object afresh
  from an angle its source photo never had, which is the only way to change the viewpoint; the
  trade is that a redraw is a redraw, so fine detail can shift. Say the pose you want in your
  own words and it will follow.

- **Character Sheet** turns a description into a reference sheet for a character. Describe who
  they are — wardrobe, age, hair, scars — and you get back one picture holding a large
  three-quarter portrait plus full-body front and back views on a plain grey studio backdrop,
  in the layout a video model reads best. The front body comes back headless on purpose: a face
  taken from a small, soft full-body figure is what makes a character drift, so removing that
  head leaves the portrait as the only place a face can come from. It is a toggle if you want
  the head. Enhance rewrites your description into the full phrase the sheet is generated from
  and shows it to you — edit it freely, whatever is in that box is what runs. Four styles
  (Photoreal, 3D animation, Anime, Cartoon), 1K or 2K, and a Turbo speed toggle.

  Your own LoRAs ride along: a cogwheel beside the model dropdown opens that model's LoRA rack,
  and the same cogwheel sits on the last step beside the result, so you can try a different LoRA
  and run again without leaving the picture you are judging. Someone who has already trained a
  character can load it and describe only the wardrobe on top. It runs on Krea 2 or Krea 2 NSFW —
  either one is enough, and the flow downloads no weights of its own. Krea 2 is the stronger
  choice for stylised work; the NSFW model is trained mostly on photographic source and is weaker
  at Anime and Cartoon.

- **Outpaint** extends a picture past its edges. Drop an image, pick the shape you want — or
  drag the frame freely — and pull it out over the sides you want filled; the new area shows as
  black, and Krea 2 paints it in. It works best in small steps: a narrow strip on one or two
  sides comes back seamless, while a big extension leaves the model inventing most of the
  picture and it shows. To go a long way, run it again on the result rather than asking for it
  all at once. Like Character Sheet, it runs on either Krea 2 or Krea 2 NSFW, and downloads no
  weights of its own.

- **Voice Changer** says your line in someone else's voice. Record yourself performing it — right
  in the flow, or drop in a file you already have — pick the voice you want it in, and run.
  What comes back is your delivery exactly as you gave it: the timing, the pauses, the breath, a
  laugh or a cough if you put one there. Only the voice is different. It is the first flow with
  no picture in it anywhere, so the result arrives as a card you play rather than one you look
  at.

  For the target voice you can bring your own clip or take one from a library of 56 that ships
  with Vision, grouped by the kind of part they suit — standard and young and elderly voices,
  narrator and trailer reads, villains, children, cartoon critters. Press play on any of them
  to hear the voice itself before you choose.

  Three things decide how well it lands, and they are worth knowing before your first take.
  Pick a target that sounds nothing like you — the further apart the two voices are, the more
  obviously the conversion works, and a target close to your own voice is what "it did nothing"
  usually means. Pitch your read near the target's and hold it steady, because drifting inside a
  take drifts the result. And perform it, but do not push: an over-pressed read converts worse
  than a committed one. It runs on Chatterbox, which the flow brings itself — about a gigabyte,
  and no model from the Library is needed.

- **DramaBox** is text to speech you direct in words. Both audio flows read your writing aloud;
  the difference is that Text to Speech needs a voice to copy, and this one lets you describe the
  speaker instead — an exhausted old man, a British woman, someone barely holding it together —
  and builds a voice to fit, from nothing. That is also how you ask for a performance: the
  emotion goes in the line, not in a slider.

  Give it a voice sample and it works the other way round, holding onto that voice line after
  line, which is the hard part of putting one character in more than one scene. Accents work the
  same way — write one in and it will often land, though only the ones the model already knows,
  so treat it as something to try rather than a guarantee.

  Set the seconds deliberately: it is the control that matters most here. Left to guess, the
  model tends to pad the take out or read your instructions back at you, and telling it how long
  the line should be is what stops both. It speaks English, brings its own weights — about
  fifteen gigabytes, the largest of any flow — and needs no model from the Library.

- **Text to Speech** reads your writing aloud. Type the line, give it a sample of the voice you
  want it in, pick a language, and run. Twenty-three are on offer — Chinese, Japanese, French,
  Italian, German, Spanish, Arabic, Hindi and more — all from one model, so no language costs
  you an extra download, and choosing one is the whole of it: there is no switch to remember.

  A note on Portuguese: it comes out Brazilian. That is the model, not a setting, and it is
  flagged on the option itself so it is not a surprise halfway through a project.

- **Stems** pulls a song apart. Drop in a track — one you made in Vision or one you brought from
  anywhere — and get the bass, the drums, the vocals and everything else back as separate files,
  ready to open in a DAW and mix properly. Pick which parts you want before you run; you can also
  ask for them combined into one track instead of one card each, which is how you get an
  instrumental (everything except the vocal) or just the rhythm section. It brings its own
  separator, needs no model from the Library, and saves everything as FLAC, so nothing is thrown
  away on the way to your mix.

  The separation is good, not surgical: expect a little vocal to bleed into the "other" track,
  and reverb tails to follow the voice rather than stay behind. That is normal for stem
  splitting, and it is the kind of thing a mix hides.

- **Sound & Music** makes the sound, rather than taking one apart. Describe what you want and
  pick which of the four it is: a sound effect, a one-shot, a single instrument, or a piece of
  instrumental music. Set the length in seconds and that is the length you get — a two-second
  one-shot comes back two seconds long, not two seconds inside a padded ten. It brings its own
  weights and needs no model from the Library: the effects and one-shots run on a small 2.11GB
  model, music and instruments on an 8.59GB one, and the two share a 1.11GB encoder, so the
  second half costs less than it looks.

  Nothing in it sings. It writes no words and no vocal of any kind, which is what keeps a
  one-shot clean and a bed of music out of the way of whatever you lay over it.

- FLUX.2 Klein now comes in two sizes. The 9B card sits beside the 4B one and does the same
  seven things — generate, reshape, follow a depth reference, edit with up to three reference
  images, inpaint, detail and upscale — with more detail and closer prompt following, traded
  against speed. It wants about 15GB of video memory at its peak, so on a 16GB card the margin
  is thin and 4B stays the one to reach for if you run out. Each size brings its own styles.

- Klein 9B brings seven styles of its own. Storybook, Comic, Anime, Chibi, Doodle, Vintage and
  Watercolour, available on everything the card does — generating, editing, inpainting, all of
  it. They are a different set from the 4B card's eight, not the same styles carried across:
  only Anime, Chibi and Doodle are the same artists' 9B versions of ones you already have. The
  others are different artists' work, which is why the names changed rather than the pictures —
  Storybook is mid-century storybook illustration, Comic is pulp comic rather than manga, and
  9B's Vintage is 1960s-80s where the 4B one is 1920s. Muppets and Jojo simply have no 9B
  version in existence yet, from anyone, which is why the count is seven. Chibi is trained
  hard and looks best with Stylization pulled back a little.

- Some models now ask you to accept their licence before they download. Klein 9B is the first:
  it is free to use and the pictures you make with it are yours to sell, but the model itself
  is licensed for non-commercial use, so you request access at the people who made it and paste
  a Hugging Face token to prove it. Vision checks the token against your grant and unlocks the
  download only once it passes.

- Klein inpaints properly now. Painting over part of a picture used to regenerate the whole
  patch and hope it blended; it now samples with the mask as a real constraint, on both the 4B
  and 9B cards, and it can see the picture underneath the mask — so what comes back sits in the
  light, style and perspective of everything around it. Removing something now has to be asked
  for by name; see Important changes.

- The FLUX.2 Klein models have slightly better quality and fewer errors, like extra limbs on
  characters.

- Place puts one picture inside another. Open an image, pick Place from the Composite tools,
  and drop in a second image — a logo, a product, a person cut out of another shot. Drag it
  where you want it, scale and rotate it with the handles, and Apply stamps it down as a new
  entry with both originals untouched. Remove background cuts the object out first, so what
  lands is the object and not its rectangle. The button beside Apply puts the picture back to
  its own size if you have scaled it somewhere you did not mean to, without moving it.

- Videos can be upscaled with LTX, sound and all. The Upscale tool in the History workspace
  has a new option on video — "LTX Video upscaler" — which doubles a clip's resolution using
  the LTX 2.3 Balanced model, and the audio track comes through untouched. Two controls come
  with it: Denoise, how freely it may repaint detail, and Prompt strength, how hard an
  optional prompt steers it. The prompt starts empty on purpose, and for most clips that is
  the right setting — describing skin or texture tends to make the model add what you named
  rather than sharpen what is there. It appears in the Library as its own row and installs
  LTX 2.3 Balanced for you if you do not have it; it downloads no weights of its own, so if
  you already run LTX there is nothing to install. Video only, and a long or large clip can
  still exhaust graphics memory — a short clip is the safe first try.

- **You can now mask a picture and give it a reference at the same time.** Changing one thing
  to match another — her hair like this photo's hair, that jacket in this fabric — needed two
  things the app never offered together: a mask, and a second picture to copy from. The
  History workspace had the masking, the gallery had the reference pictures, and neither had
  both. It does now. Open an image, mask what should change, then use the **+** beside the
  prompt to add a reference from your project or your computer, and run an Edit. The picture
  you are working on shows up in the strip as chip 1, numbered like the rest, so you can see
  exactly what the model is being given. Drag the chips to reorder them when the order
  matters — on Control, the first one is the pose or depth guide and your subject comes
  after. The references are for this edit only: leave the workspace and the strip is back to
  your picture alone.

- **You can now go and get an update instead of waiting to be asked.** When a new version is
  out, Settings shows it at the very top with a button to install it — and that row is only
  there when there is actually something to install. The prompt you get on startup is no
  longer the only way in: it now says so, and it carries a **Don't ask again** checkbox, so it
  keeps offering until you tell it to stop rather than quietly giving up on its own. Tick the
  box and the startup prompt goes quiet for that version; Settings still has the update
  whenever you want it.

- **MiniMax H3's Turbo mode got faster and cleaner at the same time.** Turbo now runs on a
  newer speed weight and a faster attention path, and the picture it produces is less noisy
  than before — so the fast option is no longer only about saving time. The weight behind it
  is also much smaller: 0.41 GB in place of 1.82 GB, which is 1.4 GB less to download when
  you install H3 from here on. The full-quality 25-step mode is untouched and still the
  default.

- **Turbo on MiniMax H3 Reference now has its own speed weight, tuned for references.** Both
  H3 models used to share one, built for the other model. Reference now gets one trained for
  the job: shots come out more cinematic, and the sound follows what you asked for more
  closely. It adds a 0.29 GB download to that model, and only to that model.

- **Audio now looks like audio.** Every song, voice line and sound effect in the gallery used
  to be the same blank grey tile with a play icon — three minutes of music and a two-second
  bleep looked identical. An audio card is now a wide tile drawn with its own waveform, and it
  fills as it plays so you can see where you are in the track. Click anywhere on the wave to
  jump there and keep listening, instead of waiting for the chorus to come round. Hovering
  still plays from the start, and moving away still stops it.

- **Choose which speakers or headphones Vision plays through.** Settings has an Audio section
  with an Output picker and a Test button. Vision used to follow whatever Windows had set as
  the default device, which is fine until that default is a channel you cannot actually hear —
  a virtual mixer's, say, that accepts the sound and quietly drops it, leaving you to wonder
  whether the app made any audio at all. Pick a device and everything follows it: previews,
  the gallery, the video player, the chime. Press Test to hear the chime on the device you
  picked before you commit to it. Left empty, nothing changes and Windows keeps deciding —
  and a device you do pick here overrides any per-app routing you have set up outside Vision.

- **The cogwheel by the prompt now shows the LoRAs your model is running.** Each one gets a
  row of its own: its name, its strength, and a switch that mutes it for the next run without
  forgetting anything you set. So trying a LoRA a little weaker, or taking one out of the mix
  for a single take, no longer means leaving the prompt you are working on. Change a strength
  here and the model's LoRA panel shows the same number, and the other way round — it is one
  setting seen from two places. Wan lists its high-noise and low-noise LoRAs as separate
  groups, the way its panel does. A model with no LoRAs loaded shows nothing at all. Adding,
  removing and swapping LoRAs is unchanged, and still lives in LoRA & Upscale on the model
  card.

- **Cue all: run one operation over many pictures.** Select several gallery cards, right-click
  and pick Cue all. Each picture becomes its own job on your current prompt and settings, so
  five photos give you five upscales or five clips. Cards the operation can't use are skipped
  and counted.

- **Choose where your prompts are enhanced and your images described.** The Remote panel has a
  new Language Models section. Prompt enhancement can run on ComfyUI (the engine you already
  generate with), on Remote, or on Ollama, a free app that runs these models on your own card.
  Image descriptions can run on ComfyUI or on Remote. Remote is one connection you set up once:
  DeepInfra, OpenRouter, OpenAI or any compatible address, with your own API key, which is saved
  on this computer and never shown again. Each job then picks its own model from that provider's
  list, with the ones we test on marked recommended. Remote uses none of your VRAM, and a
  description sent there never waits behind a generation. A hosted model may refuse adult
  material. ComfyUI stays the default and needs nothing new. Pick Ollama and Vision starts it for
  you; if it isn't installed yet, or the model you picked isn't downloaded, the panel gives you a
  button for it and shows the progress, and closing the panel doesn't stop a download. Enhance in
  the prompt box and Enhance inside a flow both follow your pick.

- **The video player's controls now sit below the prompt box, and volume opens from the
  speaker.** In the History workspace the play, frame and trim bar used to hide behind the
  prompt box when it opened upward. It now sits underneath, so it is always in reach. Volume
  is a slider that opens upward when you hover the speaker button, and the mouse wheel over
  either one turns it up or down. Drag it to zero and the speaker shows muted; click the
  speaker and your volume comes back to where it was.

- **The landing page has a new crew.** The dragon backdrop is gone. The five Cubric mascots,
  Prompt, Vision, Studio, Video and Audio, now stand on a lit stage with Studio in the centre
  and a rotating quote under the headline. Hover one and it greets you; click it for a happy
  pose. The crew shrinks to fit your window and waits for any startup dialog to close before
  it walks on. New project and Open folder now sit at the foot of your project list.

- **Resize can shrink a picture by megapixels or by a fixed amount.** The Resize tool has two
  new resolution types. MP resizes to the number of megapixels you type (1 MP is 1024 × 1024),
  and SCALE divides the width and height by 1.5, 2, 3 or 4. Both keep the picture's proportions
  and show the size you will get before you press Apply.

- **Mark cards with a dot, a square or a triangle.** The heart on a gallery card is now a mark.
  Click it for a dot, or hold it to pick a square or a triangle. FILTER can show only the shapes
  you choose, and cards you hearted before now show a dot. The media picker you open from a
  prompt slot has the same FILTER, and its tiles show their marks.

## Fixes

> **A fix to a FLOW does not belong in this section for this release.** Flows debut here, so
> no released build ever had the bug and no user can have met it — the fix is part of the
> feature. One entry below is affected and was left alone rather than edited silently: "Live
> latent previews now play everywhere they appear" names the **Flow result pane** alongside the
> History workspace and the minimised preview window. The last two are real released bugs and
> the entry is worth keeping; the Flow clause is the part to drop when folding.

- Masking a large picture no longer lags or draws jagged strokes. On a computer where the app
  draws its canvas without the graphics card, every movement of the brush redrew the whole
  picture, so a 3000-pixel image held the brush to around 20 frames a second, and a curved
  stroke came out as straight lines joined at the corners. The brush now redraws only the
  area it touched, which keeps it smooth at any image size. The Paint brush and the
  Composite brush get the same fix.

- The Crop tool's RESOLUTION mode saves the width and height you typed. If you left one of
  them at the value the panel showed, or pressed Apply straight after typing, the crop came
  out at the size of the box you drew instead. Ratio and Free crops had a smaller version of
  the same problem: once you had changed any other crop setting, they skipped the Divisible by
  rounding the panel showed, unless you had changed that one too.

- The Upscale tool shows its upscalers when you picked your own models folder while
  installing the engine. The two upscalers that come with the app, and the other helper
  models installed with the engine, were saved to the app's standard models folder instead
  of the one you picked. The app could still use them, but the Upscale Model list only
  looked in your folder, so it offered nothing but None. The list now looks in both
  folders, and a new install saves everything to the folder you picked. On RunPod, the two
  upscalers built into the Pod now appear in the list too, and using one no longer tries to
  upload a copy from your computer first, which failed when you had no copy.

- Installing a model on a Pod no longer says the volume is full when most of that model is
  already there. If the app could not read which files the Pod already had, it counted every
  file as a new download, so MiniMax H3 Reference asked for its full 50 GB on a volume that
  already held the 29 GB it shares with MiniMax H3, and needed only about 21 GB more. The
  model panel now also shows how much of a model is already on disk and how much is left to
  download.

- A model whose install was cut short can be installed again on a nearly full disk. Stopping
  a Pod mid-download, or a crash, leaves the half-downloaded files behind, and the space check
  counted them as used space on top of the full download, so the retry was refused for room it
  would have taken back: 13.3 GB needed and 12.0 GB free, for the very file whose 13.3 GB
  partial download had filled the volume. The check now counts those leftovers as space the
  retry reclaims, on the Pod and on your own machine.

- Krea 2 Image to Image works on your whole picture instead of a patch of it. Your input was
  cut down to the size you picked rather than scaled into it, so a 4000-pixel photo asked for
  a 1024 square handed the model a 1024-pixel square cut out of the middle and threw the rest
  away. It is now scaled to the size you asked for first, so the whole frame goes in. A ratio
  that does not match your picture still trims the long edge to fit, as it has to. Krea 2 and
  Krea 2 NSFW both.

- Large videos and photos import properly. Dropping a file into a project used to send the
  whole thing through the browser as text, which quietly capped an import at about 75 MB —
  past that the app refused it, and past roughly 380 MB it gave up without so much as an
  error, leaving nothing in the gallery and no clue why. Files are now handed to the app by
  their location on disk, so size is no longer a limit: a 474 MB 4K clip imports in seconds.
  Anything that does still fail now says so instead of failing silently.

- Phone videos no longer arrive on their side. A clip filmed in portrait is stored by the
  camera as a landscape frame plus a "turn this a quarter" note, and the app was reading only
  the frame — so a tall video was recorded as a wide one and its card was the wrong shape.
  The note is now read, and portrait footage stays portrait.

- An import tells you it is happening. A big video takes a while to copy and prepare, and
  until now the gallery showed nothing at all during it — long enough that an import in
  progress was indistinguishable from a frozen app. A card with a spinner appears the moment
  you drop a file and turns into the finished item when it lands.

- MiniMax H3 installs far faster, and takes 10 GB less disk. Both H3 models share one very
  large file - the text encoder - and it was the slowest thing in the app by a wide margin,
  arriving at well under 1 MB/s. On a normal connection that alone ran for hours, and
  installs could give up before it finished. It now comes from our own servers and
  downloads at tens of megabytes a second. It is also a smaller build than before - 15.7 GB
  where it used to be 24.6 GB - which frees up the disk space and, more importantly, leaves
  H3 far more room to work in memory. Quality is unchanged: the two were compared
  side by side, including on prompts the old one was specifically chosen to handle, and the
  results were identical. If our copy is ever unreachable the app falls back to the original
  source on its own, so nothing breaks. The rest of H3's files are unchanged and still come
  from HuggingFace: those are MiniMax's own model weights, and their licence does not let us
  host copies.

- A half-installed model can give its disk space back. If a model lost one of its files —
  you tidied the models folder by hand, or an install stopped near the end — the library
  showed it as not installed and offered only Install, while the rest of its weights, often
  tens of gigabytes, stayed on disk with no way to reclaim them. The model's detail panel
  now offers **Remove files** next to Install whenever it is holding files, and removing
  them still keeps anything another installed model needs.

- A big download survives a shaky connection. Vision retries a download that drops, but the
  three attempts were counted once per file for the life of the install — so a large model on
  a connection that hiccups every few minutes ran out of attempts and failed, however much of
  it had arrived in between. One install lost a 25 GB model with over 3 GB already on disk.
  The attempts are now spent on failures that make no progress: a download that gets a
  meaningful amount further before dropping again gets its retries back, and picks up from
  where it stopped rather than starting over. A connection that delivers nothing at all still
  gives up as quickly as it did before.

- Cancelling an install no longer leaves the Model Library showing the wrong thing. Cancelling
  deletes the part-downloaded file and its marker, and a library refresh that happened to be
  reading the models folder at that moment failed outright — so the library kept showing
  whatever it showed before the cancel until something else refreshed it. Reading that folder
  now expects files to come and go while an install is running.

- Clicking away closes a panel now, wherever you are. Settings, Hotkeys and About stayed
  open until you found the X or pressed Escape, while other panels in the app closed the
  moment you clicked outside them — the same gesture did two different things depending on
  where you were. Clicking anywhere behind a panel now closes it. The Cue queue panel is the
  one deliberate exception: it sits above the prompt bar so you can keep prompting with the
  queue open, and closing it on every prompt-bar click would defeat the point. Escape and
  the X are unchanged, and opening a dropdown or a dialog from inside a panel still leaves
  the panel where it is.

- No more terminal windows flashing open when Vision starts. On Windows, launching the app
  popped up to ten black console windows for a moment each - one for every background check
  Vision runs at boot to find your graphics card and start the Cubric services. They did
  nothing and closed themselves, but they looked alarming, and enough of them landed at once
  to read as something malicious. They are now hidden, as they were always meant to be.

- The colour picker no longer opens off the bottom of the screen. Clicking the colour swatch
  in the Paint, Crop, Resize, Remove Background or Adjust tool options while the panel sat low
  in the window put the picker's HEX field below the edge of the app, so you could see the
  saturation square and the hue bar but not read or type the hex value. It now opens upward
  when there is no room below it.

- The 8:5 shape now really is 8:5. Picking 8:5 (or 5:8 in portrait) on FLUX, Chroma,
  FLUX.2 Klein or Krea 2 at 1K produced 1280×768 — which is 5:3, about 4% wider than the
  shape the button named. It is now 1280×800, and 800×1280 in portrait, so the picture
  matches the label. Krea 2's 2K band was already exact and has not moved. Images you
  generated before this are unaffected and still read as 8:5 on their History card; only
  new generations at that setting change size, by 32 pixels of height.

- Cut-out images look right in the gallery. After Remove Background, the gallery card showed
  the ORIGINAL picture — its backdrop, and the shadow under it — while opening the item showed
  the correct cut-out, so it read as the gallery picking the wrong version. The card reads the
  small thumbnail the gallery builds for speed, and that thumbnail was a JPEG, which cannot
  hold transparency: saving it threw the cut-out away and left the untouched picture
  underneath. Image thumbnails are WebP now, so a transparent PNG sits on the gallery
  background as it should — whether it came from Remove Background or was imported from
  elsewhere. Existing projects rebuild their thumbnails the first time you open them after
  updating.

- Scrolling a gallery full of videos is smooth again. Dragging the scroll bar through a project
  with many video cards stuttered, and the more videos were on screen the worse it got. Every
  scroll movement was rewinding every video in the gallery back to its first frame — including
  the ones already parked on it — and the wasted work piled up faster than scrolling could
  produce it. A video already sitting on its first frame is now left alone. Hovering, playback
  and the silence-while-scrolling behaviour are unchanged.

- The first engine start no longer looks frozen. Setting up a new engine installs a large set
  of Python packages before ComfyUI can start, and for the minutes that took, the window only
  said "Starting ComfyUI Engine…" — no progress, no explanation, so it read as a hang. That
  step now names itself, "Installing Python packages… First engine start only", and hands over
  to "Starting ComfyUI Engine…" the moment it finishes. Later starts skip the step entirely, as
  they always did.

- The app no longer keeps running outdated engine components after an update. Anyone who had
  used "Skip the local engine install" kept that setting even after an engine was installed,
  and it quietly switched off the check that repairs out-of-date components — so a fixed or
  improved component could sit unused indefinitely, with nothing reported. The setting now
  clears itself once an engine is present, and is greyed out while one is installed.

- "Run locally" is now honoured everywhere, not just on the Cue button. With a cloud Pod
  connected and the toggle switched on, continuing a preview, finishing a preview, and the
  History workspace's own image, video and resize tools all still sent the job to the Pod —
  so a generation needing something only your own machine has could fail on the cloud engine
  while the app showed it was running locally. The queue chip disagreed too, reading REMOTE
  next to a local toggle. Every dispatch path now reads the one setting.

- Connecting to a cloud Pod no longer claims to have installed models it did not. Every
  connect announced one "<Model> installed." message per model already on the volume — six
  at a time, with nothing downloaded — plus a raw internal job name, "engine:node-drift
  installed.". A background repair that runs once per connect was being mistaken for a
  download, and when the window was in the background each one also became a desktop
  notification. Those repairs are now silent, as they were always meant to be; a real
  install still tells you, including one that completes as a side-effect of another.

- Live latent previews now play everywhere they appear. The Flow result pane replayed
  the whole clip at burst speed on every sampler step and then froze, the History
  workspace showed nothing at all on a video run, and the minimised preview window sat
  on a single still frame. All four surfaces now share one player and pace the clip at
  the rate it announces.

- The gallery gives your graphics memory back. Scrolling through a project of videos left
  the app holding well over a gigabyte of video memory for the rest of the session — on a
  161-clip project, a single pass took it from 410 MB to 1.86 GB, and nothing released it
  until you switched workspaces. That is memory your next generation needed. The gallery
  now hands it back whenever it is not the surface you are looking at, and again the moment
  a generation starts, taking it back when the queue is empty. Clips you have scrolled well
  past also let go on their own, so a long project costs what is on screen instead of
  everything you have looked at. Hovering a card still plays it, exactly as before.

- Big gallery cards are sharp. At the largest card size the gallery was still drawing the
  same small thumbnail it uses for the smallest one, so on a wide window a card painted at
  roughly twice the detail it actually had — soft enough that checking your own work meant
  opening the History workspace. Cards now pick a thumbnail that matches the size they are
  drawn at, and fall back to the original file when the picture is smaller than the card.
  The small sizes are unchanged, and nothing decodes a big version just because you scrolled
  past it.

- Generated files are named after the button you pressed. An edit is `edit_004` whichever
  model made it, an upscale is `upscale_002` rather than `pid_002`, and a video is `i2v_007`
  rather than `i2v_ms_007`. The names came from internal ids, so the same Edit button
  produced four different ones depending on the model, and some of them named a thing that
  appears nowhere in the app. Which model made a picture is still one click away on the
  card's Reuse. Files you already have keep the names they were saved under.

- Hovering a video card costs a fraction of what it did. A clip preview used to play the
  full-resolution master, so a 3000-pixel-wide video decoded every one of those pixels into
  a card a few hundred pixels across. The gallery now keeps a 720p copy for hover playback —
  about six times less graphics memory per card on a large clip — while the viewer, drag-out
  and everything you export still use the original untouched. Existing projects build their
  copies the first time you open them after updating.

- Download-only Pods no longer fail when one CPU size sells out — the app tries
  the others, and points you at a cheap GPU card if the whole region is full.

- The History workspace shows how many versions a card holds, and how much space they take,
  again. The top bar could read "0 entries · 0 KB" for a card with several versions, because
  the app missed each version's file when its saved link ended in a refresh marker. It now
  finds them, so a card with four versions reads 4 entries and its real size.

- Disk sizes use the same gigabytes as RunPod and Hugging Face. The warning when an install
  does not fit, and model sizes in the Library, counted a gigabyte as 1,073,741,824 bytes,
  while the Pod disk bar and your RunPod volume size count 1,000,000,000, so one 55 GB
  volume read 51.2 GB in the warning and 55 GB on the bar. Model, volume, download and project
  sizes now all use the 1,000,000,000 figure. Windows File Explorer still uses the larger one,
  so a model looks about 7% smaller there than in the app.

- Cancelling a model download right as it starts now stops it. A cancel in its first moments
  could let the download carry on anyway.

- Opening a project no longer makes saves and generations wait. The project list kept loading
  its video previews behind the open project, and those downloads could take up every
  connection the app has to its own server, so a save or a new generation could wait up to
  15 seconds before it even started. Leaving the project list now stops its previews.
