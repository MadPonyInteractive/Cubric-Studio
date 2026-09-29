# MPI-973 - page structure and copy, draft 1 (2026-09-29)

For Fabio's review before anything is built. Copy is written to be signed: no em dashes, UK
spelling, nothing that 2.0 does not ship (sources: `docs/releases/UNRELEASED.md`,
`js/data/modelConstants/models.js`, `cubric-studio-agents/README.md`).
`[media]` = a picture or clip slot, `[button]` = a button, `(note)` = not copy.

## Pages

| Address | What happens |
|---|---|
| `/` | The whole site: sections 0 to 12 below |
| `/privacy/` | Same address, same page. One sentence changes: "The Cubric Vision page asks GitHub..." becomes "The download section asks GitHub...", because the Vision page goes |
| `/vision/`, `/prompt/`, `/audio/`, `/video/` | One-line redirects to `/`, hidden from search, so old links in videos and posts still land |
| `/l/*` | Untouched (the app's feature-request redirects) |
| `sitemap.xml`, `llms.txt`, page metadata | Rewritten for Cubric Studio 2.0; sitemap keeps `/` and `/privacy/` |

## 0. Top bar

Cubric Studio (logo) | What it does · Agent · Cloud models · Connect your agent · Download · Docs · GitHub

## 1. Hero

CUBRIC STUDIO 2.0

# Make images, video and sound on your own computer.

Cubric Studio is a free desktop app for creative AI. Describe what you want, then shape it
with edits, masks and Flows. Run open models on your own graphics card, reach for the big
cloud models on your own key, or just ask the agent built into the app.

[button] Download for Windows (note: the label follows the visitor's system)
[button] See what it does

Free and open source · Windows, macOS and Linux · No account

[media] (look-and-feel call, see Decisions)

## 2. Proof strip

| Makes | Runs | Account | Price |
|---|---|---|---|
| Images, video and sound | On your GPU, offline | None, and no analytics | Free and open source |

## 3. The crew

ONE APP

## Five apps became one. The crew came too.

We planned a family of apps. It turned out to be one app, so it took the family name. Each
of the crew now looks after one part of it.

- **Lingo shapes the words.** Prompt enhancement, picture descriptions and dictation.
- **Prism makes the images.** Generate, edit by describing, mask, place and upscale.
- **Reel puts them in motion.** Text and pictures to video, extend, upscale and trim.
- **Vinyl gives them sound.** Speech, songs, sound effects, stems and foley.
- **Cosmo runs the crew.** Cosmo is the agent you talk to.

(note: names and roles are the app's own, `js/shell/heroCrew.js`)

## 4. What it does

WHAT IT DOES

## A whole studio in one window.

**Pictures. Describe it, then fix just the part you want.**
Generate from a prompt, then edit by saying what should change: the rest of the picture stays
as it was. Mask a face, a hand or a background and work only there, give it a reference
picture, place one image inside another, and upscale the result. Big photos too: 16K images
import and edit.
[media] photoreal, stylised and edit carousels (existing media plus new)

**Video. Direct the motion, not just the prompt.**
Generate from a prompt or a still and guide it with a first and last frame. Then carry a clip
on past its last frame, sound and all, double its resolution, and trim it on its waveform.
[media] text-to-video and image-to-video clips

**Sound. It makes sound now too.**
Read text aloud in 23 languages, change a voice, write a song from your own lyrics, make sound
effects and music, split a song into stems, or give a silent clip its soundtrack.
[media] an audio card with its waveform

**Flows. A whole job, one step at a time.**
A Flow asks for what it needs a step at a time, installs its own models and hands you the
finished result. Thirteen come with 2.0: Draw It In, Scribble, Object Stamp, Character Sheet,
Outpaint, Extend Video, Add Foley, Upscale Video, Voice Changer, Text to Speech, Song, Stems,
and Sound & Music.
[media] the Flow Library

**And the rest**
- GIFs with their own workspace: retime, trim, crop, and cut the subject out of every frame.
- Stacks: put cards together and run one job on all of them.
- Projects with their full history, in folders on your own disk.
- Masks you can export to Photoshop or anything else.
- Your own LoRAs and upscalers.

## 5. The agent (brief section 2)

NEW IN 2.0 · THE AGENT

## Just ask.

Press Agent, or A, and say what you want in plain words. The agent picks the right model and
installs it, runs the generation or the Flow, looks at what it made and tells you. It can work
from a mask you painted, outpaint a picture, and make GIFs.

- It asks before anything costs money.
- Talk instead of typing: click the mic, or hold Ctrl+Space.
- Runs on your own DeepInfra, OpenRouter or OpenAI key, or free on Ollama.

[media] the agent panel at work, Cosmo answering

## 6. Cloud models (brief section 3)

NEW IN 2.0 · CLOUD MODELS

## The big models, on your own key.

No graphics card, no download, no waiting for a model to install. Pick a cloud model and it
runs on DeepInfra, billed to your own DeepInfra account. You pay DeepInfra directly for what
you use: no Cubric credits, no subscription, nothing added on top. The prompt box shows what a
run costs before you press Cue.

**Pictures:** Seedream 4 · Seedream 4.5 · Seedream 5.0 Pro · FLUX 2 Dev · FLUX 2 Pro ·
FLUX 2 Max · Nano Banana 2 Lite · Nano Banana 2 · Nano Banana Pro

**Video:** Seedance 1.5 Pro · Seedance 2.0 · Wan 3.0 · Veo 3.1 Fast · Veo 3.1

Rather run the open models on a bigger graphics card? Rent one on RunPod from inside the app,
on your own RunPod account.

Model names belong to their makers.

(note: the 14 names are every `provider: 'deepinfra'` entry that is not `devOnly`; FLUX
Schnell is dev-only and left out. No prices anywhere.)

## 7. Connect your agent (brief section 1)

NEW IN 2.0 · MCP

## Let Claude, Codex or Antigravity drive it.

Cubric Studio speaks MCP, so the AI agent you already use can work in it. Ask for "an image of
a red bicycle in a new project" and it lands in your gallery as a real card, with its prompt
and settings saved.

The easy way: in the app, open **Settings > Connect an agent** and press **Connect** next to
yours.

- **Claude Desktop** [button] Download the Claude Desktop extension
  Then open Settings > Extensions in Claude Desktop and drag the file onto that page.
  Windows and macOS.
- **Claude Code** (two commands, from the agents README)
- **Codex** (two commands, from the agents README)
- **Antigravity** Steps on GitHub (link)

Use ChatGPT? Codex comes with your plan. Use Gemini? Antigravity is Google's agent app for your
computer.

Paid cloud models ask first. Nothing your agent can do deletes a project, a card or a file.
It reaches the app on your own computer only.
[link] Full setup on GitHub · [link] What your agent's provider sees (privacy page)

(note: the download button points at the latest `cubric-studio-agents` release asset, never a
copy on this site)

## 8. How it is built

HOW IT IS BUILT

## Your machine. Your files.

- **01 Local and private.** Prompts, pictures, video and projects stay on your computer. The
  app goes online only when you choose something that needs it, and our privacy page lists
  every case.
- **02 Models handled for you.** Pick a model and the app installs it with everything it
  needs. The engine is tested and version-locked, so an update does not break last month's
  work.
- **03 Honest about your machine.** Graphics memory, system memory, the queue and progress are
  always on screen, and the Model Library can show only the models your graphics card can run.
- **04 Independent.** Open source, funded by the people who use it, built on open models.

## 9. Download

DOWNLOAD

## Get Cubric Studio 2.0.

A portable build from GitHub. Unzip it and run it: no installer, no account.

[button] Download for Windows · [button] Download for macOS · [button] Download for Linux
(note: each fills in its file size from the GitHub release)

macOS 14 (Sonoma) or later on an M-series Mac. Linux on x64.
[link] All releases on GitHub · [link] Read the docs

## 10. Support

(The current `/vision/` block, kept: three Patreon tiers at £1, £5 and £20 that all do the
same thing, and pay-what-you-want on Gumroad. Only these lines change.)

SUPPORT THE PROJECT

## Keep Cubric independent.

Patreon support keeps Cubric Studio free and independent. The Patreon and Discord community
are run by Mad Pony Interactive, the studio behind Cubric.

Every tier does exactly the same thing. You just choose how much to give. Nothing is
paywalled, gated or delayed: every version ships to everyone on GitHub at the same time.

Not into monthly? Give once instead. Cubric Studio is pay-what-you-want on Gumroad, including
free.

## 11. FAQ

**Is it really free?**
Yes. The app is free and open source. Two things can cost money, and only if you choose them:
cloud models and rented graphics cards bill your own DeepInfra or RunPod account, and the Head
Swap and DramaBox Flow packages are sold on Gumroad.

**Do I need a powerful graphics card?**
Not for cloud models. For models on your own machine: the lighter picture models run on about
8GB of video memory with 16 to 32GB of system memory, the larger ones are happier around 12GB
with 32GB, and video usually wants 12 to 16GB with 32 to 64GB.

**Does it upload my work?**
Not unless you pick something that needs it. A cloud model receives your prompt and any
reference pictures, and a rented graphics card receives the job. Every case is on our privacy
page.

**Do I need the internet after installing?**
Not for models on your own machine.

**Can I sell what I make?**
The app puts no limit on it. Each model comes with its own licence from the people who made
it: a gated model shows you its licence before it downloads, and a few are for non-commercial
use only.

**Which systems does it run on?**
Windows (64-bit), macOS 14 or later on Apple silicon, and Linux on x64.

**I use Cubric Vision. What changes?**
Cubric Vision is now Cubric Studio. Your projects folder is renamed for you, so there is
nothing to do. On Windows, re-pin your shortcut to `CubricStudio.exe`.

**Can I use my own models?**
Cubric Studio runs a curated lineup, tuned to give good results without fiddling. You can add
your own LoRAs and upscalers.

**Where are my projects stored?**
In your Documents folder, unless you choose another place. Each project keeps its pictures,
videos and settings together.

**Can I move a project to another computer?**
Yes. Drag the project folder onto the Projects page. To repeat the same generations there,
install the same models.

**Can I roll back if an update breaks something?**
Yes. Install a previous release. Your models can live in their own folder, so you do not
download them again.

**How do I report a bug or ask for a model?**
When something goes wrong, the app usually offers to send a report to GitHub; please use it.
For models and workflows, ask on Discord.

**Can I build my own commercial app from the code?**
No. Code from the Cubric repositories must stay in open-source apps, under the project licence.

(note: dropped from the old FAQ: "Is it cross-compatible?" (the early-testing caveat, replaced
by "Which systems"), the "future optional RunPod path is planned" wording (it shipped), and
"Are there any hidden costs? No" (false now that cloud models and paid Flows exist).)

## 12. Footer

GitHub · Docs · Discord · Patreon · Privacy · contact@madponyinteractive.com ·
(c) 2026 Mad Pony Interactive

## Claims to re-check at build time

- "Can I sell what I make": which shipped models are non-commercial (Qwen-Image 2.1, MPI-936)
  and whether the gate shows the licence text.
- "Where are my projects stored": the Documents default still holds in 2.0.
- Hero "No account": true for the app; DeepInfra/RunPod accounts are the user's own and optional.
