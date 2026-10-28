# Cubric Studio 2.1.3

Two new models, MOSS-Image and Singularity H3. Boxes made from a picture, a redone Use Tiles, Custom size in Control, stacks you can reorder and lay out as a sheet, and a long list of fixes.

---

## Important

- **LTX 2.3 now comes in one version, the faster Balanced one.** High is retired: it looked no better in our tests. If you only had High, install LTX 2.3 again in Models.
- **LTX quality steps moved up one size.** Medium is now 1216x704 (the old High), Low and Very Low are the old Medium and Low, and a new High of 1536x896 sits on top. The same setting now comes out sharper and takes longer.
- **The NVIDIA PiD Upscaler is for non-commercial use only.** NVIDIA licenses it for research or evaluation. Installing it now shows the licence first. For work you sell, use the SDXL models' upscale.
- **Video Edit above 768p should no longer run out of graphics memory.** At 960p and up it draws the movement at 768p, enlarges it, then refines it in short windows at your size. 960p ran on a 16 GB card.
- **Cosmo's default model is DeepSeek-V4-Flash-0731 again,** marked (recommended) in the agent list. MiMo-V2.6-Flash was slow and often overloaded. DeepSeek reads a written description of your pictures. To have Cosmo look at a picture itself, pick an agent model that can see pictures in Settings.

## What's new

- **MOSS-Image.** A new text-to-image model that writes exact lettering on signs and posters, with a fast Turbo mode, Boxes, and a style picker with previews that Enhance writes for. It also edits, inpaints, details and upscales your pictures.
- **Singularity H3.** A fine-tune of MiniMax H3 Reference by WarmBloodAban that tears less and handles fast action better. Same references and prompts, its own 19.5 GB download. Video Edit can run on either.
- **MiniMax H3: Fast Motion, more detail, more speed.** H3 Reference has a Fast Motion button for launches, chases and fights. Enhance now writes down what each attached person or object wears and carries, so the clip keeps it. Both H3 models run faster.
- **Boxes from a picture.** Right-click a card and pick Create boxes: each thing in the picture gets its own named box, and the prompt becomes a caption of the scene, so the new picture keeps the layout. Works on MOSS-Image and FLUX.3 Klein.
- **Use Tiles is redone.** Pick a tile size (smaller tiles, more detail), and Describe each tile names what fills it, so grass is redrawn as grass. Faces get their own gentle passes. Use Grid is gone; an old Use Grid setting opens as Use Tiles.
- **Custom size in Control.** On every model that has Control, turn on Custom size, pick a ratio and size, and the picture comes out at exactly that size.
- **Control on Qwen-Image 2.1 takes your subject from a picture,** as it already does on FLUX.2 Klein, Krea 2 and Qwen Edit: picture 1 gives the pose, depth, scribble or edges, and a second (and third) picture is who or what is drawn into it.
- **Type @ to name a picture on every edit model.** With two or more pictures added on Qwen-Image 2.1, FLUX.3 Klein, FLUX.2 Klein, Krea 2, Qwen Edit or a cloud editor, @ lists them and writes each one the way that model reads it ("image 2", "the second image").
- **Stacks you can arrange.** Drag a picture in the Stack workspace to reorder it. Right-click a stack and pick Create Sheet for one numbered sheet of it. The gallery Filter has a Stacks switch.
- **Card info on hover.** With card info on (I), hover a gallery card and its info card opens at once: model, time, prompt and notes, plus the ratio, Turbo, LoRAs and the graphics card it ran on. It closes the moment you leave the card.
- **Cosmo joins clips.** Ask for a scene before, after or between two clips, and Cosmo starts from the last frame of one and ends on the first frame of the next. It stays in the clips' own model family and makes up the moment that links them. After a joining scene, Cosmo offers to combine the clips into one video, and every clip stays its own card. "What happens next" runs Extend Video instead, so the clip carries on in one piece, with its sound.
- **Cosmo knows more of your card.** "Do it again" redoes the entry it worked on, with the same mask. Before a Use Tiles upscale it shows each tile size to click, and when its language model stalls it offers the other tested one.
- **A mascot in every Flow while it works:** Lingo writing, Cosmo planning, Prism for pictures, Reel and Vinyl for video, Vinyl for sound. They slide in and out instead of popping.
- **The Model picker has a Source filter and a search box,** like the Models and Flows pages, and remembers your choice.
- **Easier-to-read descriptions** for every Flow and model: short paragraphs with the key points in bold.
- **Small helpers.** A Restart engine button after installing a model with new engine parts. An "Update to v…" button in the bell when an update is ready. The minimised Latents window shows each run's progress.

## Fixes

- **AMD and Intel Arc cards are recognised again on current Windows 11.** These computers were given the NVIDIA engine instead of their own, which ran everything on the processor. If that happened to you, the app now replaces that engine with the right one when it starts. Your models stay.
- **Installing a model no longer restarts the engine before your next generation.** It restarts when you first use a model that needs the new parts.
- **Repair engine fixes an engine that will not start** because a crash left one of its add-on files empty.
- **One press of Stop in a Flow stops everything it started,** including jobs still waiting in the queue.
- **Video Edit's Swap the person** no longer turns the new person's back to the camera at the end of a clip.
- **The child-safety check** reads more wording, says why when it could not look at a picture, and no longer refuses adult nudity on Control from a photo of an adult.
- **Cosmo picks better.** FLUX.3 Klein pictures on Turbo unless you ask for more quality, edits on the best editor you have installed, says what it is making the moment it starts, and counts Use Tiles tiles right.
- **Cosmo's tiled upscale opens the picture's history,** so you see the latents as it works.
- **Cosmo reads a message you type while it works,** so "stop" or "save that for later" lands before its next step, not after it.
- **A job Cosmo runs that fails no longer opens a failure window.** Cosmo tells you in the chat, may try once more, and stops after a second failure.
- **The child-safety check asks again once when the image describer's server has a hiccup,** instead of refusing the run.
- **Combined videos show their sound waveform** on the card.
- **Extend Video's row in the queue no longer reads "1:1 · 1024x1024"** on a wide clip.
- **Picking a different style drops an enhanced prompt written for the old one,** so a reused card no longer runs its old style's wording over the new style.
- **The Model picker lists featured models first,** in the Model Library's order. Krea 2 NSFW is no longer featured.
- **Flow steps with a drawing area open at full width at once,** instead of widening a pixel at a time.
- **Files with % in the name** (100%.png) can be cropped, trimmed, reversed, combined and made into GIFs. They used to fail or read as missing.
- **A click plays a maximised video again;** only Space did.
- **Character Sheet from Images draws robots and mascots as themselves,** not as people: no human clothes or ears, their own build, a head-and-chest close-up, and a face box that can cover a square picture.
- **Small fixes.** Renaming a card in Show info mode shows what you type. Compare labels each side with the card's name. The picture chip tags read clearly over any picture. The prompt box's mascot slides instead of fading and stays off the video controls. A tool setting changed just before you switch away is kept. A GIF preview marks itself out of date when you change a setting. An audio card never reads "0:60". Less noise in the log.

---

## Updating

The update zip is made for installs from 1.5.0 on, and updates them in place (tested from a 1.5.0 install, see Platform support below). If your install is older than 1.5.0, download the full zip below instead.

## First launch

**Windows.** Extract the zip anywhere and run **`CubricStudio.exe`**. Every program in the download is signed by Mad Pony Interactive. Because the signature is new, Windows may still show "Windows protected your PC" for a while. If it does, click **More info**, then **Run anyway**.

**macOS.** Any downloaded build is quarantined. Clear it, then launch:

```
xattr -dr com.apple.quarantine "<extracted folder>"
```

then double-click `start.command`.

Setting up the local engine on a Mac needs Apple's Command Line Tools. If setup stops and asks for them, open Terminal, run `xcode-select --install`, let Apple's download finish, then press **Retry**.

---

## Platform support, please read

- **Windows** - Tested on an earlier build of this version: a 1.5.0 install updated in place with the update zip kept its projects and settings and generated an image. The final build adds the last Cosmo and queue fixes and was not install-tested again.
- **Linux** - Not tested on this version.
- **macOS** - Not tested on this version.
