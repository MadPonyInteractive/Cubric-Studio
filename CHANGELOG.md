# Changelog

Every Cubric Studio release, newest first.

## Cubric Studio v2.1.3 (2026-10-27)

### Changelog

Two new models, MOSS-Image and Singularity H3. Boxes made from a picture, a redone Use Tiles, Custom size in Control, stacks you can reorder and lay out as a sheet, and a long list of fixes.

#### Important

- **LTX 2.3 now comes in one version, the faster Balanced one.** High is retired: it looked no better in our tests. If you only had High, install LTX 2.3 again in Models. (MPI-1095)
- **LTX quality steps moved up one size.** Medium is now 1216x704 (the old High), Low and Very Low are the old Medium and Low, and a new High of 1536x896 sits on top. The same setting now comes out sharper and takes longer. (MPI-1095)
- **The NVIDIA PiD Upscaler is for non-commercial use only.** NVIDIA licenses it for research or evaluation. Installing it now shows the licence first. For work you sell, use the SDXL models' upscale. (MPI-1250)
- **Video Edit above 768p should no longer run out of graphics memory.** At 960p and up it draws the movement at 768p, enlarges it, then refines it in short windows at your size. 960p ran on a 16 GB card. (MPI-1284)
- **Cosmo's default model is DeepSeek-V4-Flash-0731 again,** marked (recommended) in the agent list. MiMo-V2.6-Flash was slow and often overloaded. DeepSeek reads a written description of your pictures. To have Cosmo look at a picture itself, pick an agent model that can see pictures in Settings. (MPI-1286)

#### What's new

- **MOSS-Image.** A new text-to-image model that writes exact lettering on signs and posters, with a fast Turbo mode, Boxes, and a style picker with previews that Enhance writes for. It also edits, inpaints, details and upscales your pictures. (MPI-1243, MPI-1249)
- **Singularity H3.** A fine-tune of MiniMax H3 Reference by WarmBloodAban that tears less and handles fast action better. Same references and prompts, its own 19.5 GB download. Video Edit can run on either. (MPI-1284)
- **MiniMax H3: Fast Motion, more detail, more speed.** H3 Reference has a Fast Motion button for launches, chases and fights. Enhance now writes down what each attached person or object wears and carries, so the clip keeps it. Both H3 models run faster. (MPI-1283, MPI-1285)
- **Boxes from a picture.** Right-click a card and pick Create boxes: each thing in the picture gets its own named box, and the prompt becomes a caption of the scene, so the new picture keeps the layout. Works on MOSS-Image and FLUX.3 Klein. (MPI-1253)
- **Use Tiles is redone.** Pick a tile size (smaller tiles, more detail), and Describe each tile names what fills it, so grass is redrawn as grass. Faces get their own gentle passes. Use Grid is gone; an old Use Grid setting opens as Use Tiles. (MPI-1232)
- **Custom size in Control.** On every model that has Control, turn on Custom size, pick a ratio and size, and the picture comes out at exactly that size. (MPI-1271)
- **Control on Qwen-Image 2.1 takes your subject from a picture,** as it already does on FLUX.2 Klein, Krea 2 and Qwen Edit: picture 1 gives the pose, depth, scribble or edges, and a second (and third) picture is who or what is drawn into it. (MPI-1269)
- **Type @ to name a picture on every edit model.** With two or more pictures added on Qwen-Image 2.1, FLUX.3 Klein, FLUX.2 Klein, Krea 2, Qwen Edit or a cloud editor, @ lists them and writes each one the way that model reads it ("image 2", "the second image"). (MPI-1312)
- **Stacks you can arrange.** Drag a picture in the Stack workspace to reorder it. Right-click a stack and pick Create Sheet for one numbered sheet of it. The gallery Filter has a Stacks switch. (MPI-1268, MPI-1282)
- **Card info on hover.** With card info on (I), hover a gallery card and its info card opens at once: model, time, prompt and notes, plus the ratio, Turbo, LoRAs and the graphics card it ran on. It closes the moment you leave the card. (MPI-1261, MPI-1308)
- **Cosmo joins clips.** Ask for a scene before, after or between two clips, and Cosmo starts from the last frame of one and ends on the first frame of the next. It stays in the clips' own model family and makes up the moment that links them. "What happens next" runs Extend Video, so the clip carries on with its sound. Afterwards Cosmo offers to combine the clips into one video, and every clip stays its own card. (MPI-1286)
- **Cosmo knows more of your card.** "Do it again" redoes the entry it worked on, with the same mask. Before a Use Tiles upscale it shows each tile size to click, and when its language model stalls it offers the other tested one. (MPI-1262, MPI-1260, MPI-1277)
- **A mascot in every Flow while it works:** Lingo writing, Cosmo planning, Prism for pictures, Reel and Vinyl for video, Vinyl for sound. They slide in and out instead of popping. (MPI-1292, MPI-1294)
- **The Model picker has a Source filter and a search box,** like the Models and Flows pages, and remembers your choice. (MPI-1303)
- **Easier-to-read descriptions** for every Flow and model: short paragraphs with the key points in bold. (MPI-1298)
- **Small helpers.** A Restart engine button after installing a model with new engine parts. An "Update to v…" button in the bell when an update is ready. The minimised Latents window shows each run's progress. (MPI-1247, MPI-1242, MPI-1296)

#### Fixes

- **AMD and Intel Arc cards are recognised again on current Windows 11.** These computers were given the NVIDIA engine instead of their own, which ran everything on the processor. If that happened to you, the app now replaces that engine with the right one when it starts. Your models stay. (MPI-1304, MPI-1318)
- **Installing a model no longer restarts the engine before your next generation.** It restarts when you first use a model that needs the new parts. (MPI-1272)
- **Repair engine fixes an engine that will not start** because a crash left one of its add-on files empty. (MPI-1274)
- **One press of Stop in a Flow stops everything it started,** including jobs still waiting in the queue. (MPI-1293)
- **Video Edit's Swap the person** no longer turns the new person's back to the camera at the end of a clip. (MPI-1284)
- **The child-safety check** reads more wording, says why when it could not look at a picture, and no longer refuses adult nudity on Control from a photo of an adult. (MPI-1239, MPI-1241, MPI-1273, MPI-1297)
- **Cosmo picks better.** FLUX.3 Klein pictures on Turbo unless you ask for more quality, edits on the best editor you have installed, says what it is making the moment it starts, and counts Use Tiles tiles right. (MPI-1278, MPI-1279, MPI-1280, MPI-1237)
- **Cosmo's tiled upscale opens the picture's history,** so you see the latents as it works. (MPI-1256)
- **Cosmo reads a message you type while it works,** so "stop" or "save that for later" lands before its next step, not after it. (MPI-1286)
- **A job Cosmo runs that fails no longer opens a failure window.** Cosmo tells you in the chat, tries once more, and stops if it fails again. (MPI-1286)
- **The child-safety check asks again once when the image describer's server has a hiccup,** instead of refusing the run. (MPI-1286)
- **Combined videos show their sound waveform** on the card. (MPI-1286)
- **Extend Video's row in the queue no longer reads "1:1 · 1024x1024"** on a wide clip. (MPI-1286)
- **Picking a different style drops an enhanced prompt written for the old one,** so a reused card no longer runs its old style's wording over the new style. (MPI-1316)
- **The Model picker lists featured models first,** in the Model Library's order. Krea 2 NSFW is no longer featured. (MPI-1245, MPI-1270)
- **Flow steps with a drawing area open at full width at once,** instead of widening a pixel at a time. (MPI-1255)
- **Files with % in the name** (100%.png) can be cropped, trimmed, reversed, combined and made into GIFs. They used to fail or read as missing. (AUDIT B1)
- **A click plays a maximised video again;** only Space did. (MPI-1251)
- **Character Sheet from Images draws robots and mascots as themselves,** not as people: no human clothes or ears, their own build, a head-and-chest close-up, and a face box that can cover a square picture. (MPI-1306)
- **Small fixes.** Renaming a card in Show info mode shows what you type. Compare labels each side with the card's name. The picture chip tags read clearly over any picture. The prompt box's mascot slides instead of fading and stays off the video controls. A tool setting changed just before you switch away is kept. A GIF preview marks itself out of date when you change a setting. An audio card never reads "0:60". Less noise in the log. (MPI-1289, MPI-1290, MPI-1252, MPI-1295, MPI-1255, AUDIT)

#### ComfyUI Engine

Unchanged.
## Cubric Studio v2.1.2 (2026-10-21)

### Changelog

The first signed Windows build. FLUX.3 Klein with Boxes, Custom size on edit, a cheaper Cosmo that can see pictures, Ollama Cloud models from Settings, and ten fixes.

#### Important

- **The Windows app is now signed.** Every program in the Windows download carries a Mad Pony Interactive signature, so Smart App Control should no longer block Cubric Studio. Windows SmartScreen may still ask once, until the new signature builds up its reputation. (MPI-616)

#### What's new

- **FLUX.3 Klein.** Black Forest Labs' new model makes pictures and edits them with up to ten reference pictures, up to 4K. A Turbo button switches between the fast model and the more natural base model. Free for non-commercial use, and for commercial use if you earn under US$5 million a year. (MPI-1181, MPI-1216)
- **Boxes on FLUX.3 Klein: draw where things go.** The Boxes button slides up a panel behind the prompt box. Draw a box, name it (cat, dog, woman), type `@` to put it in your prompt, and Enhance plans the picture around your boxes. Reuse brings them back. (MPI-1181)
- **Custom size on edit.** Edits keep your picture's size. Turn on Custom size to pick a different shape and resolution. Works on FLUX.3 Klein, Klein 4B and 9B, Krea 2, Qwen-Image 2.1, Boogu, Qwen Edit, and cloud Seedream 4 / 4.5, FLUX-2 Dev and Klein 9B. (MPI-1207)
- **Cosmo can see pictures, and costs less.** Cosmo's default model is now MiMo-V2.6-Flash. It does as well as the old default on our tests for about 25% less per chat, and can look at a picture itself when words are not enough (is this the same face?). Scores for every model we tested are at bench.cubric.studio. (MPI-1208)
- **Longer chats with Cosmo.** On the default model, Cosmo now sums up its chat at about 210k tokens instead of 128k, and the "this chat is getting long" card shows at about 105k instead of 64k. (MPI-1233)
- **Ollama Cloud models, no terminal.** Under the agent model in Settings, Add a cloud model lists Ollama's cloud models that can use tools. Add one, sign in to Ollama if asked, and Cosmo runs on it. (MPI-1236)

#### Fixes

- **Gated models ask for your Hugging Face token only once.** The first token that works is saved, encrypted like your API keys, and the next licence uses it. Settings > External Connections can clear it. (MPI-1215)
- **Escape, A and Tab work in the 3D Scene and the 360 player.** Escape goes back to the gallery, and Tab opens the radial menu there too. (MPI-1238)
- **Brush hotkeys no longer type into the chat box.** Clicking the paint canvas now takes the focus off any text box, so B, E and the other brush keys reach the brush. (MPI-1220)
- **Ultimate SD Upscale works on a fresh Windows PC.** The engine no longer reports "Part of the engine did not install" when Windows blocks the upscaler's download. An engine already showing it repairs itself on its next start. (MPI-1213, MPI-1214)
- **Starting an engine update twice no longer deletes the engine.** A second update, repair or install now waits for the one already running. (MPI-1204)
- **A cloud model that refuses a picture says why, in a small message.** It used to open the "Cloud generation failed" box. When Seedance refuses a photoreal face, the message now says that is the reason. (MPI-1221, MPI-1223)
- **Cosmo and cloud models without a key.** Cosmo now tells you to add your API key in Settings. It used to offer a 0 GB install, or say the model's files were missing. (MPI-1229, MPI-1234)
- **Cosmo is less chatty about results.** If you reply while a picture is still being made, Cosmo no longer describes it or reports it again when it lands. It also no longer offers to install a model you just installed. (MPI-1226, MPI-1228)
- **Cosmo's clips and spend cards.** A clip Cosmo makes from a picture lands as its own card, not inside the picture's card. A spend card never asks you to pay for a run that would then be refused. (MPI-1224, MPI-1225)
- **On a local model, the "this chat is getting long" card waits.** It used to show after the first question. It now shows near the point where the chat sums itself up, and it no longer warns about cost, since a local model is free. (MPI-1235)

#### New Operations

None

#### Breaking Changes

None

#### ComfyUI Engine

ComfyUI version unchanged (0.42.1)
## Cubric Studio v2.1.1 (2026-10-19)

### Changelog

Six fixes: a project-delete data-loss fix, a first-launch engine fix, two for RunPod users, two for Cosmo.

#### Fixes

- **Deleting a project sends it to the Recycle Bin, and never takes another project with it.** A project made inside another project's folder used to be erased with it for good. The app now refuses to create one there, and if the Recycle Bin cannot take a project, Delete removes nothing and says so. (MPI-1205)
- **The first picture after an update is no longer refused as a broken engine.** When the app updated its engine at launch, it could start the engine twice at once; the two installs collided and the engine reported itself broken until the app was restarted. It now starts once. (MPI-1206)
- **Creating a RunPod network volume no longer says "Volume not created" when it was made.** RunPod sometimes answers with an error after making the volume. The app now finds that volume and selects it, so trying again no longer pays for a second one. (MPI-1199)
- **Jobs no longer stall in the queue while a download-only RunPod is connected.** The first job ran, then every job behind it waited forever. (MPI-1203)
- **Cosmo edits with Qwen-Image 2.1 first.** It used to try it last and could start an edit on Krea 2, the weakest editor, which is now its last pick. (MPI-1202)
- **Cosmo uses a reference picture of several people or things whole.** It used to stop and ask which one you meant. It now sends the whole picture with each one named, and asks only when your words mean one and the picture cannot show which. (MPI-1201)

#### New Operations

None

#### Breaking Changes

None

#### ComfyUI Engine

ComfyUI version unchanged (0.42.1)
## Cubric Studio v2.1.0 (2026-10-19)

### Changelog

A big step for 2.0: the engine moves to ComfyUI 0.42.1, Qwen-Image 2.1 arrives, six new Flows (Video Edit, two Character Sheet Flows, Transcribe, 360 Panorama, Make seamless), Reference to Video on LTX 2.3, 3D Scenes ship, every prompt passes a child-safety check, and a long list of fixes.

#### Important

- **The old CubricVision.exe is gone (Windows).** The update removes it. If a shortcut or a taskbar pin still points at it, pin CubricStudio.exe in the same folder instead.

#### What's new

- **Qwen-Image 2.1.** Makes and edits images, up to eight references in one edit, and can return a transparent background: turn on No Background in the prompt box settings, or ask the agent for a picture with no background. Eight styles work on every operation, and an edit with an empty prompt and a style restyles a photo like a filter. Research licence: the images are not for commercial use.
- **Character Sheet from Images, a new Flow.** Box the face in a picture of a character you already have, add a full-body picture if you like, and get the same three-view sheet as Character Sheet. Runs on Qwen-Image 2.1, whose pictures are not for commercial use.
- **Character Sheet Editor, a new Flow.** Change one thing on a character sheet you already have: the clothes, glasses or a hat, makeup, tattoos, the hairstyle, a beard, a beaten-up or muddy look, the body shape or the age. All three views change together, the result is a new card, and your sheet stays as it was. Body shape, a hairstyle, a beard, accessories, makeup, tattoos, taking the clothes off (adults only) and ages of 12 and under run on Qwen-Image 2.1 (not for commercial use) and need it installed; the rest runs on FLUX.2 Klein 9B. It has the LoRA cog wheel too. Add a picture of an outfit, even a cut-out, and it dresses the character in it; a picture of a hairstyle, makeup or a beard is copied the same way. With a hairstyle, makeup, beard or face-tattoo picture, the card's History also keeps the mannequin it builds (a plain head wearing just that look): use it as the reference next time and the Flow skips that step.
- **Video Edit, a new Flow.** Swap the person, head or outfit in a clip, change its background, or make any edit you describe, from a picture or in words. Name a part under "Only change" and just that part is redrawn, the rest kept as filmed. Pick its resolution, from 576p up to 4K (2K and 4K need a very large GPU). Runs on MiniMax H3 Reference, and Cosmo can run it too. Keep clips short: 5 seconds can take 20 minutes.
- **Reference to Video on LTX 2.3.** Add a few pictures (a person, a place, a thing), describe each one on its own line, then say what happens, and the clip keeps how they look. Click a picture's tag to make it the start frame instead. Runs on both LTX 2.3 models, and adds a 1.3 GB download the first time.
- **Mask and Extract in the video workspace.** Name what to keep (a person, a dog, a car), Detect follows it through the clip, and Extract keeps only that, on transparency or a colour you choose or Pick off the screen. Export for editing saves a clip as ProRes 4444 with its transparency, ready for DaVinci Resolve and other editors.
- **Your own LoRAs in more Flows.** Upscale Video, Video Edit, Extend Video and Character Sheet from Images now have the cog wheel beside the model, which opens the same LoRA panel as that model's own generations.
- **Use Tiles, beside Use Grid in every model's Upscale.** It redraws the picture in 1024 px tiles, so very large pictures work, and at 1x it adds detail without enlarging. Cosmo and the MCP tools can use it too.
- **A child-safety check on every prompt.** Cubric Studio is for adults, and adult content is untouched. A prompt that puts someone under 18 in a nude, sexual or suggestive picture is refused before it runs, whether you typed it, the Enhancer wrote it, or Cosmo or another AI app sent it. Under 16, swimwear is only for children playing together at a pool or beach, in a picture, never a video. Asking to undress someone in a picture or clip first checks that no one in it could be under 18. A picture or clip used only to copy a pose, a shape or a motion onto someone else is judged by what the model gets: a Pose reference never refuses because of who is in the photo, and Video Edit's Swap the person never looks at the clip.
- **What your Pod is costing, in the status bar.** While RunPod is connected, the bar at the bottom shows the spend so far next to REMOTE, and next to the timer while a job runs, so you can see it without going back to the home page.
- **Video speed in the GPU picker.** Every RunPod card now shows two speed bars: pink for pictures and orange for video, from RunPod's own LTX-2.3 timings. Turn on the Video switch and the cards line up fastest-for-video first.
- **Upload models to your RunPod volume.** Upload models, in the Remote panel, shows your LoRAs and upscale models on your computer and on the Pod. Upload or delete any of them, at any size. Use the cheap No GPU Pod for big files: your volume keeps them.
- **Speech to text runs where you choose.** The microphone types through DeepInfra (now Qwen3-ASR, more accurate than Whisper), on your own GPU through ComfyUI, or through Ollama. Pick it under Speech to text in the Remote panel. On ComfyUI or Ollama, add Words to expect so names come out spelled right.
- **Transcribe, a new Flow.** Drop in a recording or a video and get back everything said, as text to copy and as an .srt subtitle file. Runs on your own GPU, and Cosmo can run it too.
- **Combine works on pictures too.** Select two or more in the gallery and Combine packs them into one sheet, with a choice of shape and size. Cosmo can make one too.
- **360 Panorama, a new Flow.** Describe a place, or give it a picture and it paints in the world around it, and get a 360 panorama you can look all the way round.
- **Make seamless, a new Flow.** Give it a panorama whose ends do not quite meet, a background or a busy texture, and it repaints a band along each edge so the picture repeats left-right, top-bottom or both, up to 16K. Drag a handle in from each edge to choose how much changes. Runs on FLUX.2 Klein 9B, and Cosmo can run it too.
- **3D Scenes.** Right-click a 360 panorama and choose Convert to 360 pano to fly around inside it. Press P to drop points along a path, then Render path makes a 360 video along it. Both come as plugins in the Model Library.
- **Look around any 360 video and take pictures of it.** A rendered path opens in the 360 player, and so does your own 360 video: right-click it and choose Convert to 360 video. Drag to look, pick a frame and Take picture: that exact view is cleaned up and lands as a new picture. It needs FLUX.2 Klein 9B installed.
- **LoRA & Upscale from the cog wheel.** The settings popup by the prompt now has a LoRA & Upscale button, so you no longer go through the model picker to add or change a LoRA.
- **Dropped LoRAs go in the model's own folder.** Drop a LoRA in a model's LoRA & Upscale settings and it lands in that model's folder under `loras` (for Krea 2, `loras/krea-2`), which is made for you if it is not there yet, instead of loose at the top.
- **Auto-start ComfyUI on the engine popup.** The "Starting ComfyUI Engine" popup has the same switch as Settings, so you can turn auto-start on or off right there.
- **Cosmo tells you when a chat gets long.** Past a certain length it offers three buttons: Start fresh (it saves the important parts to its notes first), Compact (it sums the chat up and carries on), or Keep going. Each message also costs less now, and a long chat sums itself up sooner, so it never gets expensive.
- **Cosmo can install a Flow for you.** Ask for one you do not have and Cosmo shows its Yes / No card with the download size, and a note when a licence screen comes first. It installs nothing until you press Yes.
- **Cosmo can send cards to another project.** Say "take these to project X", "send the last two to a new project", "all the videos" or "every card with a dot", and Cosmo copies them there with their prompts and names, like Add to project does. Sending to a project you have stays put; a new project opens so you carry on there. AI apps connected over MCP can do it too.
- **Cosmo hears the clips it looks at.** Show Cosmo a video with sound and it reads what is said, with the time each line is spoken, through the Speech to text you picked in the Remote panel. On DeepInfra that costs about $0.0002 to $0.00045 a minute of sound; on ComfyUI or Ollama it is free. AI apps connected over MCP also see a clip better: one frame from every shot, and only the part of the clip you ask for.
- **Dev updates on the home screen.** The bell beside About shows the latest posts from the Cubric Studio Discord, pictures included: flick through them, click one to see it big, and press X when you have read it. Join the Discord is one click away.
- **See how a History entry was made.** Rest the pointer on a row in History and a panel shows the model, the operation, how long it took, when it was made, the prompt and any notes. Move into the panel to copy the prompt.
- **Star a project to keep it at the top.** On the home screen, rest the pointer on a project and click the star beside its name. Starred projects sit above the rest; unstar one and it goes back to its usual place by when you last opened it.
- **Scribble and Draw It In keep your drawing.** The card's History now starts with what you drew, then the result, so you can go back to the sketch any time.
- **One Headless front body button on Character Sheet.** Every sheet now comes with both versions, with the head and without, and the Headless front body button beside the settings switches between them. The second button drawn on the result is gone.
- **See a Flow's result on its own.** Draw It In and Object Stamp opened their result only in compare, with no way out but dragging the bar. A Compare / Result button now switches.

#### Fixes

- **Choose media shows each picture whole.** The picker cropped every card to a square, so a character sheet showed as one figure and two sheets looked alike. Pictures now sit in rows like the Gallery, at their own shape, with the name under each.
- **Every background job shows in the queue.** Making or editing a GIF, GIF to video, Combine, preparing a clip to mask and Project Cleanup now get a row under Transfers, with a moving bar while they work, and a strip flashes on the right edge when a job joins a closed queue. Click it, or press Q on the home page, to open the queue.
- **GIF cut-out shows in the queue, with a Stop.** Remove background and By name now wait their turn behind a generation instead of running beside it, and the queue panel can stop them.
- **Project cards on the home page show their picture again.** Older projects were blank.
- **Copy address in Settings copies again.** The button for the MCP server address did nothing, so you had to type the address into your agent by hand.
- **Scribble draws people with the right number of legs.** A stick figure in your drawing could come back with tangled or extra legs. Scribble now reads a stick figure as a real person in that pose, with natural anatomy. For a pose a stick figure cannot show clearly, like a leg hanging off the bed, say it in the prompt too.
- **Nano Banana edits keep your picture's shape.** With no ratio picked, an edit could come back a different shape: a square drawing came back wide. It now keeps the shape of the picture you gave it.
- **A download-only Pod no longer locks you out of your projects.** Connecting the No GPU Pod to install models used to block every project. Projects now open, and generations run on DeepInfra or your own GPU while the Pod installs.
- **Resize is a lot faster and no longer needs ComfyUI.** It runs inside the app now, so it works with no engine installed and beside your generations instead of waiting behind them, and a long 4K clip no longer runs out of memory (a 14-second 4K phone clip used to). It always resizes with Lanczos, so the Method setting is gone.
- **The Resize preview no longer goes blank after you resize a clip.** It showed an empty checkerboard until you picked another History entry and came back.
- **A picture in a Flow's inputs shows as a thumbnail.** It loaded at full size, again every time you went back to that step, so a big photo visibly loaded each time.
- **Character Sheet's headless front body no longer cuts bits of clothing away.** It searched the whole body for the head and its hat, so a bow or a strap could vanish with the head. It now searches only round the face.
- **RunPod stages a model as soon as it installs.** With "Stage all models on connect" on, a model you installed while connected waited for the next connect, so its first generation was slow.
- **Switching to a new RunPod volume mid-session gets the shared engine files too.** Klein previews looked like coloured noise there, and SAM3 masking and Describe had nothing to load until the app was restarted.
- **Compare labels each side with its History name.** An imported image showed its full file path instead.
- **Focus mode (F) shows your image again.** On an image it turned the whole screen black, with Compare on too.
- **Enhance and Describe work on ComfyUI without installing anything first.** Without the Image Describer plugin or a Krea 2 model, Enhance failed with an error and Describe asked for the plugin. Their 4.88 GB text encoder now installs with the engine, and the plugin is gone.
- **RunPod connect tells the truth.** No more "Local, offline" or 0 models while a Pod boots. Cancel shows it's still waiting on RunPod.
- **A RunPod Pod that never starts stops billing within a minute.** When a data center never starts your Pod, the app now notices within a minute, deletes it and tells you the data center looks troubled. A Pod that starts but then hangs is deleted at 8 minutes.
- **LoRAs over 2 GB upload to a Pod.** Uploads now show under Transfers, with Cancel.
- **The pictures above the prompt box show whole, and move smoothly.** Each keeps its own shape instead of a square crop, its tag (Picture 1, Start frame) sits above it instead of covering it, the X appears when you hover, and dragging one to a new place no longer makes the row jump about.
- **A model download that stalls switches to our backup host.** Before, only a blocked connection did; a download that froze or timed out tried the same host three times and then failed. It now tries the backup once those retries are spent, and keeps what it had already downloaded.
- **Enhance on a reference-to-video model with nothing attached no longer invents a reference.** With no picture staged, Wan 3.0 could write an `<Image 1>` into the prompt; Enhance now writes a plain text-to-video prompt until a reference is added.
- **Voice recordings sound like your microphone.** The recorder used video-call processing, so a take dropped in volume after the first words and sounded phasey. It now records your mic as it is, ready for voice cloning.
- **Pictures and the crew no longer take half a minute to appear.** After the app crashed or was force-closed, the home screen, project cards and Cosmo could load around 30 seconds late on every visit, even after a restart. The app now starts with a fresh browser cache each time.
- **Crop keeps your box when you pick another ratio.** It used to jump back to a fresh centred box, so you had to place it again, and after a zoom it could vanish off screen until you left for the gallery. Now edges you snapped to the picture stay snapped, and the box always stays in view.
- **Pictures and videos no longer stall while a model installs on RunPod.** Thumbnails, project pages and previews could take up to a minute to appear while the Pod was busy downloading.
- **Uninstalling a model while installing another no longer breaks the new one.** On RunPod, files the two models share could be deleted after the new install had already counted them, so it finished missing files.
- **Models show as installed after the app replaces a RunPod Pod.** If the app started while your last Pod was still running and had to make a fresh one (after an update, say), every model read as not installed although it was on your volume.

#### New Operations

- `speechTranscribe`
- `flowVideoEdit`
- `flowCharacterSheetImages`
- `flowCharacterSheetEdit`
- `flowCharacterSheetEditQwen`
- `flowMakeSeamless`
- `flowTranscribe`
- `sceneConvert`
- `scenePathVideo`
- `flowPano360`

#### Breaking Changes

None. Project schema unchanged (4).

#### ComfyUI Engine

- **ComfyUI 0.42.1 (was 0.34.0).** The engine updates itself on first launch in about a minute, with no full re-download, and custom nodes you added yourself stay. Without Krea 2 or the Image Describer plugin, that launch also fetches the 4.88 GB text encoder Enhance and Describe now use (see Fixes).
## Cubric Studio v2.0.1 (2026-10-06)

### Changelog

A patch for 2.0: MiniMax H3 Reference runs again on Windows, local generation recovers from a GPU memory fault, and six smaller fixes.

#### Fixes

- **MiniMax H3 Reference generates again.** On Windows the run could stop with a "HostBuffer.read_file_slice failed" error while the engine re-read its text encoder from disk between its two passes. The encoder now stays loaded, so the run completes.
- **Local generation recovers from a GPU memory fault.** On some cards (seen on a 12 GB RTX 3060) the engine could stop mid-generation with a "CUDA error". It now restarts in a safer memory mode for the rest of the session: press Generate again.
- **The help for MiniMax H3 Reference now says it edits clips.** Give it a clip and ask for the same motion and sound with one change, and it comes back changed with its own soundtrack, speech included. The help and the agent used to say the opposite.
- **A card that is still generating stays on screen with a filter on.** Any Only filter hid the card you were waiting for until it landed, and an image-to-video run wore the Image chip meanwhile.
- **A mark set on a card while it is generating stays on the finished card.** It used to be lost when the result landed.
- **The microphone you pick in Settings is now the one dictation and the recorder listen to.** The system default used to open whatever you picked.
- **The agent remembers what it has looked at.** Looking at the input behind a card used to describe that picture afresh every time; the description is now kept on the input card itself.
- **A message typed while the agent is still answering is read as sent before that answer.** The agent no longer takes it as a reaction to a reply you had not seen yet.

#### New Operations

None.

#### Breaking Changes

None. Project schema unchanged (4).

#### ComfyUI Engine

Unchanged from 2.0.0 (core `v0.34.0`).
## Cubric Studio v2.0.0 (2026-10-04)

### Changelog

Cubric Vision becomes Cubric Studio, with two headlines: Flows, and an agent inside the app. Also sound and speech in the prompt box, cloud models on your own key, and big photos.

#### Important changes

- **Cubric Vision is now Cubric Studio.** Your projects folder is renamed for you. On Windows, re-pin your shortcut to CubricStudio.exe: the old CubricVision.exe goes in 2.1.
- **Mac users need macOS 14 (Sonoma) or later.** Every M-series Mac can run it.
- **Adding or removing a model folder now needs an engine restart.** Restart engine, at the end of Settings → External Connections, waits for anything you are generating to finish.
- **Inpainting no longer erases on an empty prompt.** Name what you want gone ("remove the tattoo") instead. Both Klein cards.
- **Krea 2 Inpaint is a lot better, and takes longer.** It reads your picture as reference, so what comes back sits in the scene. Krea 2 and Krea 2 NSFW.
- **NVIDIA PiD is staying.** Its Model Library tile no longer says it is marked for deprecation.
- **Deleting a card always asks first now.** Right-click → Delete opens the same box as the Delete key, and that box offers Archive beside Delete.
- **Reuse Prompt needs the source card to still be there.** The app no longer keeps hidden copies of your inputs, so archive a card instead of deleting it and Reuse works as before.
- **Extend and New shot are gone from video History.** Make the next shot, then select both clips and Combine them, or use the new Extend Video Flow.
- **"Cleanup assets…" slims a project down.** Right-click a project on the landing page to clear the thumbnails and previews the app rebuilds by itself. Handy before a backup.

#### What's new

- **Flows, the first headline of this release.** A flow is a whole job in one place: it asks for what it needs a step at a time, installs its own models, and hands you a finished result. Open the Flow Library with the Flows button or TAB. Eleven to start with:
- **Draw It In**: draw something into a photo you already have
- **Scribble**: draw on a blank canvas and have it rendered
- **Object Stamp**: take an object out of one photo and put it in another
- **Character Sheet**: turn a description into a character reference sheet, with the front view's head removed for video models or kept
- **Outpaint**: extend a picture past its edges
- **Extend Video**: carry on past the last frame, sound and all
- **Add Foley**: give a silent clip its soundtrack
- **Upscale Video**: double a clip's resolution
- **Voice Changer**: say a line and have it come back in someone else's voice
- **Song**: write a song from a style, a mood and your own lyrics
- **Stems**: split a song into bass, drums, vocals and everything else
- **Head Swap and DramaBox** are sold separately as Flow packages. The Flow Library shows where to get them; drop a package on the library to install it.
- **An agent inside the app, the other headline.** Press Agent (or A) and ask in plain words: it picks and installs models, runs generations and Flows, and looks at what it made. It asks before anything costs money. Runs on your own DeepInfra, OpenRouter or OpenAI key, or free on Ollama.
- **Routines: save a chain of steps once, run it on any cards.** Ask the agent to save one ("square it, upscale it, white background"), then pick it from Routines on the selection bar. Your cards are never changed.
- **See which model drives the agent best.** The agent's model list shows each model's score and cost per chat. Benchmark yours and compare everyone's results at bench.cubric.studio.
- **Claude, Codex and Google Antigravity can drive Cubric Studio.** Ask for an image, a video or a GIF and it lands in your project; they can run your routines too. Settings → Connect an agent sets it up in one click.
- **Sound and speech in the prompt box.** Stable Audio 3 makes sound effects, instruments and instrumental music at the length you ask for. Chatterbox reads your text aloud in a voice you record or pick, in 23 languages.
- **Audio gets its own cards**: wide tiles that draw the waveform and fill as they play. Click the wave to jump there.
- **Dictate instead of typing.** Click the mic on the prompt box or the Agent panel, or hold Ctrl+Space. Uses your DeepInfra key, about $0.0002 a minute.
- **Paid cloud models, on your own DeepInfra key.** No download and no GPU: Seedream 4, 4.5 and 5.0 Pro, FLUX 2 Dev, Pro and Max, FLUX.2 Klein 9B, Nano Banana 2 Lite, 2 and Pro, Seedance 1.5 Pro and 2.0, Wan 3.0, Veo 3.1 Fast and Veo 3.1.
- **Remote only skips the local engine entirely.** Choose it at first launch: projects open, cloud models generate, and the tools that need the engine say so instead of failing.
- **The prompt box shows what a paid run costs before you press Cue.**
- **Nano Banana edits take up to four reference images.**
- **Scribble and Draw It In can render on a cloud model.** Pick FLUX.2 Klein 9B (Cloud), or Nano Banana 2 Lite on Scribble, and the Flow runs on your DeepInfra key.
- **Klein 9B now asks you to accept its licence before it downloads, like MiniMax H3.** Request access, paste a Hugging Face token, and the download unlocks. Free to use, and what you make is yours to sell.
- **Klein inpaints properly now.** What comes back sits in the light, style and perspective around your mask. Both the 4B and 9B cards.
- **The FLUX.2 Klein models have better quality and fewer errors**, like extra limbs.
- **A new + button on the Gallery and History prompt boxes** brings in a reference picture from your project or your disk. On a video in History, reference models (MiniMax H3 Reference, Seedance 2.0, Wan 3.0) work from the open clip.
- **Mask a picture and give it a reference at the same time.** Mask what should change, add a reference with the +, and run an Edit.
- **Place puts one picture inside another.** Drag a picture onto an image in History, or pick Place in the Composite tools, then move and scale it and Apply. Remove background cuts the object out first.
- **Videos can be upscaled with LTX, sound and all.** The Upscale tool in History doubles a clip's resolution. Short clips first: a long one can still run out of graphics memory.
- **GIFs have their own workspace.** Make GIF from selected cards or GIF Maker from a clip, then retime, trim and crop it, or cut the subject out of every frame.
- **Big photos just work.** 16K images import, thumbnail and edit, and a masked edit or Detail works on just the masked area. SVGs import too.
- **Shrink big pictures by megapixels.** A very large import offers to shrink to the megapixels you pick, Resize shrinks by megapixels or by a fixed factor, and the agent can do it for you.
- **Sharper masks on large images.** Masks work at up to 4096 pixels instead of 1536, so Grow and Shrink draw a smooth edge.
- **Pick a colour straight off the picture.** An eyedropper sits beside the Remove Background, Paint and Paint Adjust colours, and in Scribble and Draw It In's drawing step.
- **Stack: collect several cards into one.** Drop a stack on the prompt box to run the current operation on every card in it, or open it to upscale, resize or crop them all together.
- **Selecting cards brings up a selection bar** where the prompt box was: Stack, Compare, Combine, Make GIF, marks, Download, Archive and Delete.
- **Mark cards with a dot, a square or a triangle.** The heart is now a mark: click for a dot, hold to pick a shape.
- **FILTER shows only images, videos or audio, or only the cards you marked.** The picker behind the + button has the same filters.
- **The card right-click menu is reorganised, and every entry explains itself** in the status bar, including why a greyed-out one is unavailable.
- **The landing page has a new crew.** Each of the five mascots owns a colour, and images, video, audio and prompts wear their mascot's colour across the app. The selected model's mascot peeks over the prompt box.
- **The radial menu is back.** Hold TAB and pick Gallery, Models, Flows or your latest workspace.
- **The video player's controls sit below the prompt box**, always in reach, and volume opens from the speaker button.
- **The video trim bar shows the clip's sound**, so you can cut on a word or a beat instead of guessing.
- **Choose which speakers or headphones Cubric Studio plays through**, in Settings → Audio.
- **Choose where prompts are enhanced and images described**: ComfyUI (the default), Remote with your own key (DeepInfra, OpenRouter, OpenAI or any compatible address), or Ollama.
- **The cogwheel by the prompt shows the LoRAs your model is running**: name, strength, and a switch to mute one for the next run.
- **The Model Library can show only the models your GPU can run**, or the RunPod GPU you rented.
- **Choosing a RunPod GPU is a proper picker now**: one tile per card with its price, VRAM, stock and a Gen speed bar, fastest first.
- **Get an update when you want it.** Settings shows a new version at the top with a button to install it, and the startup prompt has a Don't ask again checkbox.

#### Fixes

- **Pod runs no longer hang on "Still connecting to the remote engine"** after new nodes install. The app reconnects on its own.
- **A generation the engine loses now fails instead of waiting forever.**
- **Photos turned by the camera crop, edit and import upright.**
- **History and the landing page open quickly on big photos.**
- **Mask Adjust keeps working when you switch versions** in History.
- **Web pages in your browser can no longer reach Cubric Studio or its engine.** A site you visited could have started generations or read your pictures.
- **A generation that finishes after you switch projects lands where you started it.**
- **Masking a large picture no longer lags or draws jagged strokes**, and neither do the Paint and Composite brushes.
- **Big photos no longer shimmer when zoomed out**, in History and in Compare.
- **Copying cards into another project keeps their names.**
- **The Crop tool keeps the width and height you typed** in RESOLUTION mode, and the Divisible-by rounding in Ratio and Free.
- **Cropping past the edge of a JPEG no longer softens the photo**, and it is much faster on very large pictures.
- **The Upscale tool finds its upscalers when you picked your own models folder**, and a Pod's built-in upscalers appear too.
- **Installing a model on a Pod no longer says the volume is full when most of it is already there.**
- **A renamed or moved project folder keeps its gallery.**
- **Stop cancels only its own job**, and a stopped cloud run keeps the result it already paid for.
- **The engine refuses to start on a graphics driver too old for it, and says so** instead of crashing.
- **A model whose install was cut short can be installed again on a nearly full disk.**
- **Model downloads work with antivirus HTTPS scanning on**, such as Kaspersky, ESET, Avast and Bitdefender.
- **Krea 2 Image to Image works on your whole picture** instead of a square from the middle.
- **An import tells you it is happening**: a card with a spinner appears the moment you drop a file.
- **A big download survives a shaky connection.**
- **Cancelling an install no longer leaves the Model Library showing the wrong thing.**
- **Clicking away closes a panel now, wherever you are**, Settings, Hotkeys and About included.
- **The colour picker no longer opens off the bottom of the screen.**
- **The 8:5 shape really is 8:5**: 1280×800 at 1K, not 1280×768.
- **Cut-out images look right in the gallery.** Thumbnails keep their transparency.
- **Scrolling a gallery full of videos is smooth again.**
- **The first engine start no longer looks frozen.** The long step names itself.
- **The app no longer keeps running outdated engine components after an update.**
- **"Run locally" is honoured everywhere**, not just on the Cue button.
- **Live latent previews play everywhere they appear**, video runs in History included.
- **The gallery gives your graphics memory back** when you are not looking at it, and when a generation starts.
- **Big gallery cards are sharp.**
- **Generated files are named after the button you pressed**, like edit_004 or upscale_002. Files you already have keep their names.
- **Hovering a video card costs a fraction of what it did.**
- **Download-only Pods no longer fail when one CPU size sells out.**
- **Connect waits for your GPU by default** on new installs, trying in the background until one frees up. Turn it off in Remote.
- **Waiting for a GPU keeps your minimum system RAM.**
- **A sold-out GPU is no longer reported as "no host with enough RAM".**
- **The History workspace shows how many versions a card holds, and their size, again.**
- **Disk sizes use the same gigabytes as RunPod and Hugging Face**, so a model looks about 7% smaller in Windows File Explorer.
- **Cancelling a model download right as it starts now stops it.**
- **Opening a project no longer makes saves and generations wait.**

#### New Operations

The eleven Flows; the audio model ops `t2a` (Stable Audio 3) and `tts` (Chatterbox); cloud reference-to-video `ref2v`; `ltxVideoUpscale`; GIF cut-outs (`gifCutoutSam3`, `gifCutoutBirefnet`); `promptEnhance`. Retired with the Flows they belonged to: `flowHeadSwap` and `flowDramaBox` (now paid packages), `flowChatterBox` and `flowSoundAndMusic` (now the `tts` and `t2a` model ops); each key stays so older history still loads.

#### Breaking Changes

None. Project schema unchanged (4).

#### ComfyUI Engine

- **The ComfyUI engine is unchanged from 1.5.0.** Three more custom-node packs come with it, for speech, voices and stems, and the Cubric pack moves to a newer version. The first launch after updating installs them, so expect that download.

Core unchanged (`v0.34.0`).

#### Known issues (GitHub release page only)

Not in the in-app notes: the 1.5.0 update prompt shows no notes, so these reach users through the release body, in the section named on each line.

- **Updating? section:** **Use rented GPUs? Update to 2.0 before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs. 2.0 uses the new one.
- **Updating? section:** **Your first Connect after updating sets up a fresh Pod.** A Pod keeps the version it was made with, so 2.0 replaces the one an older version made instead of reusing it. The models on your network volume stay; only that first Connect takes longer.
- **First launch, Windows:** If double-clicking `CubricStudio.exe` does nothing, with no message at all, Windows' Smart App Control may have blocked it. It cannot make an exception for one app, and the builds are not code-signed yet, so there is nothing to click. Signing is the fix, and it is not in place yet.
- **First launch, macOS:** Setting up the local engine on a Mac needs Apple's Command Line Tools. If setup stops and asks for them, open Terminal, run `xcode-select --install`, let Apple's download finish, then press **Retry**.
- **Platform support, macOS:** Not tested on this version, including updating from 1.5.0.
## Cubric Vision v1.4.2 — 2026-08-15

### Changelog

A patch release: the 21:9 cinematic ratio for video, markdown in notes, Fill on the paint layer, and five fixes.

#### What's new

- Notes read as notes now — Project notes and Card notes render your markdown instead of showing the raw text. Headings, tables, lists, quotes and code all come out formatted, with each heading level in its own colour so a long document is easy to scan. A pencil/eye pair at the top right switches between editing the source and reading it, and the preview shows what you have typed before you save it. Long notes scroll — before, anything past the height of the window was simply cut off with no way to reach it. The window is wider and the text larger, so a table has room to breathe. Release notes take markdown too, so this "What's new" can be formatted from here on.
- A card with notes says so. An annotated gallery card now carries a small notes icon in its top-right corner, between the heart and the reuse button, and it stays visible without hovering — so a project you have been given can be scanned for the cards someone wrote about instead of opening each one to check. Clicking it opens those notes straight away.
- Fill works on paint now. The Fill button in Adjust only ever appeared on the mask, so a closed shape drawn with the paint brush — the one thing an outline tool exists for — could not be filled in. Pressing Fill on paint now floods every enclosed area in your current colour, and every brushstroke you already made keeps its own colour on top of it.
- Video has a 21:9 cinematic ratio. It sits beside 1:1, 9:16 and 16:9 on every video model and at every quality level, so the wide anamorphic shape is a choice up front rather than a crop afterwards.

#### Fixes

- MiniMax H3 video looks better with Turbo off. The slower setting was coming out worse than the fast one, which is backwards — it now gives the quality it asks the extra time for.
- Reference images and audio no longer linger in the prompt box after you move to a model or operation that cannot use them. Reusing a text-to-image card while references were staged left them sitting in the tray, and the next generation quietly ran carrying inputs it should never have had.
- Removed gallery cards no longer leave their video preview running in the background.
- Losing a cloud engine mid-generation now says the engine dropped, instead of blaming the size of your inputs.
- MiniMax H3 at 2K and 4K no longer shows LTX 2.3's motion caveat. It now reads Experimental — High VRAM.

#### New Operations

None user-facing. Two dev-gated Flow operations (`flowLtxExtend`, `flowLtxFoley`) are registered but sit behind the Flow Library dev gate.

#### Breaking Changes

None.

#### ComfyUI Engine

Unchanged (core `v0.31.0`).
## Cubric Vision v1.4.1 — 2026-08-11

### Changelog

A patch release. Everything here is a fix or a small improvement on top of 1.4.0,
so it ships as one block on the third digit.

Most of it comes out of one field incident: a "No GPU — download only" Pod
connected while a local generation was running. The app treated that Pod as its
generation engine, tried to stage weights onto a machine with a few gigabytes of
RAM, read the resulting failure as a dead engine, and dropped remote mode —
taking four in-flight installs down with it and leaving the Model Library painting
a frozen Pod snapshot over models the local disk already had. Six separate
failures came out of that one thread, and each is fixed here.

The rest is notification behaviour: notifications that arrived long after the fact,
and notifications that were gone before they could be read.

#### New

- First run asks how you want to work before it asks for a folder. Setup opened
  on a models-folder picker, with "run on a cloud GPU instead" as a small link at the
  bottom — so the only obvious path was a multi-gigabyte install, even on a machine
  that will never use it. It now opens on the actual question: Local + Remote
  installs ComfyUI here and generates on your own card, with a cloud GPU there for the
  jobs it cannot take; Remote only skips the install entirely and takes you
  straight into the app to connect a RunPod account. Each side says plainly what it
  costs you — a one-time install and a capable GPU, or an account billed while a Pod
  runs — and you can change your mind later in Settings. The folder picker is still
  there, one step further in, and it now reads as one screen rather than three
  different left edges.

#### Fixes

- Video previews play at the video's speed again. On some runs the live preview
  flashed the whole clip in an instant each time the sampler advanced, then froze until
  the next step. It now plays continuously at the clip's own frame rate, and no longer
  trims the start of the clip.

- A cloud Pod used for downloads is no longer treated as a generation engine.
  Connecting a "No GPU — download only" Pod while you were working locally could take
  your generation with it: the app tried to stage model weights onto a machine with no
  GPU and a few gigabytes of RAM, the Pod was killed, and the app read that as a dead
  engine and dropped remote mode — taking every in-flight install down with it. A
  download Pod is now only ever a download target.

- A cloud install that dies now says so, instead of freezing. When the Pod went
  away mid-install, the model card kept showing the Pod's last progress — a live-looking
  bar and a Cancel button for a download that could never finish, sometimes painted over
  a model your own disk already had. Those installs now end properly, say why, and offer
  a working Retry, and the Model Library goes back to showing what is really on your
  machine.

- Losing the Pod mid-install is a notice, not an error report. Stopping your own Pod
  raised the "Download Failed" dialog with a Report on GitHub button. It is now a normal
  heads-up message.

- A queued install can no longer land on the wrong machine. Installs run one at a
  time, and the engine was only decided when each one's turn actually came — so a model
  queued for your cloud Pod could start downloading to your local disk after the Pod
  disconnected, tens of gigabytes you never asked for. A queued install now remembers
  where it was meant to go and is cancelled, with a message, if that engine is gone.

- "Generation complete" notifications no longer arrive long after the fact. A batch
  that did not finish cleanly could leave its finished-count behind, and the next time
  anything drained the queue that stale count fired — announcing generations that had
  ended ten or twenty minutes earlier, sometimes over an hour. Counts that outlive their
  batch are now discarded.

- Notifications stay up long enough to read. Every notification got the same three
  seconds, whether it said "Copied" or quoted three figures and a drive letter — so the
  longer and more useful ones were gone before the first line landed. A notification now
  stays for as long as its message takes to read. And when two are on screen at once,
  only the first counts down: the second waits its turn instead of expiring while you
  are still reading the one above it.

- "Not enough disk space" now names the disk, and asks for the right amount. A local
  install could refuse with "29.3 GB needed, 29.4 GB free" — more free space than it said
  it wanted — because the check quietly reserves a small working margin the message never
  mentioned. And when the full disk was your cloud Pod's volume, the app replaced the
  server's exact figures with "free up space and try again", pointing you at your own
  machine, where clearing space would not have helped. Both messages now name the drive
  or the Pod volume and quote the amount actually required.

#### New Operations

None.

#### Breaking Changes

None. Project schema stays at version 4.

#### ComfyUI Engine

Unchanged (0.31.0).

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] Landing Page: version badge
- [ ] Documentation Website: changelog page
- [ ] GitHub Releases: tag v1.4.1, full builds + update bundles, release notes
- [ ] Discord: post in #updates
## Cubric Vision v1.4.0 — 2026-08-10

### Changelog

A feature release built around three things: a mask toolkit rather than a
brush, MiniMax H3 bringing video that carries its own sound, and a Control operation that
copies the structure of an image. It also carries the engine bump to ComfyUI 0.31.0, an
in-place engine updater that finishes in seconds instead of re-downloading, Composite and
Paint as first-class canvas tools, and a long round of fixes to masking, download state and
generation progress.

#### Important changes

- Krea 2 and Chroma keep your source dimensions. On Krea 2, every operation except Text to Image and Image to Image now follows the input image's shape instead of the ratio picker. On Chroma it applies to Control, Detail and Upscale.

- LTX 2.3's Balanced tier moved to a better, smaller model file. The two GPU-specific options (RTX 50 Series / RTX 40 & Older) are gone — one file now runs on every card, at 20GB instead of 22–23.5GB, with better detail and sound. If you already have LTX Balanced installed, the new file downloads once and the old one is cleaned up. Text to Video and Image to Video also share one workflow now, so which one you get follows from whether you supply a first or last frame.

- Wan 2.2 is image-to-video only now. Its Text to Video operation has been retired: LTX 2.3 does that job better, and Wan's text-to-video weights were a 27GB download that served nothing else. Image to Video is untouched — same model, same speed, same results. If you already downloaded the text-to-video weights, they are no longer counted as part of Wan 2.2, so the next time you uninstall a model they get cleared out with it rather than sitting on your drive owned by nothing. Text to video lives on LTX 2.3, MiniMax H3 and Wan 2.2 5B.

- Some models now ask you to accept their licence before they download. A few model licences require us to show you the restrictions and record that you accepted them before you receive the weights — MiniMax H3 is the first one we ship. You will see the terms, and where a model is not licensed in your region, a link to request your own authorization from the licensor. Every other model installs exactly as before, with no extra step. The licence and a way to report misuse stay reachable from the model's panel afterwards.

- Your mask reaches the model the way you drew it. A masked edit used to close every hole in your mask and grow it slightly before generating, so a mask drawn as a ring around a subject arrived at the model as a solid blob — the shape you wanted was impossible to ask for. That no longer happens on any model. If you do want a hole closed, the new Fill button does it where you can see it.

- Mask composite follows the mask you drew. Compositing through a ring or an edge-band mask filled in the middle before blending, so the whole enclosed area came through instead of just the band you selected — the same thing that used to happen inside the generator and was fixed there in this version. It now uses the mask as drawn. Use Fill if you want a hole closed.

- The Add / Subtract composite dialog is gone. Blending two images used to mean selecting both, having one of them already carry a mask, and answering Add or Subtract in a dialog — with nothing on screen to judge it by. The Composite tools replace it entirely: the selected image is always the one on top, and you see the blend while you make it. Two images of different sizes are now cropped to fill rather than stretched, and the preview on the canvas matches the file that gets written.

- A detection you don't add is a preview. Detect, Points and Text show their result in green as a preview, and it stays a preview: leaving the tool discards it, and generating without pressing Add no longer sends it. Previously an un-added detection was silently used in the next generation. Because of this, the operations that need a mask stay unavailable until you press Add or Subtract — a green preview on its own is not a mask yet.

- Krea 2 and Chroma styles now reach Detail and Upscale. Every operation on these models runs one workflow, so the style you picked stays applied through the finishing passes instead of being dropped by them.

- Krea 2 Control takes a second image. Image 1 supplies the pose and composition, image 2 supplies who is posed into it.

- On a Mac, install Apple's Command Line Tools before your first setup. Setting up the local engine needs git, which on macOS only arrives with the Xcode Command Line Tools — and a clean Mac does not have them. The first Install press stops with a message naming exactly that. Open Terminal, run xcode-select --install, let Apple's download finish, then press Retry. This is a known issue, not a fault in your download: Windows ships a prebuilt engine and never needs git, while macOS and Linux build theirs. Removing the requirement is being worked on separately.

#### What's new

- Animate towards an image, not just away from one. Drop a single image into the prompt box on a video model and it has always become the first frame. Now the label along the bottom of the thumbnail is a button: click it and it reads Last frame, so the clip ends on that image instead of starting from it — the model invents everything leading up to it. Drop two images and you get both ends, first and last, in strip order. Useful for closing a loop, landing on a specific pose, or joining two shots you already have. Both LTX 2.3 and Wan 2.2 take it, including the end-frame-only case where the single image you give is the one the clip finishes on.

- The mask tools, rebuilt as a toolkit. Everything that makes a mask now sits in one group and works the same way. Paint one by hand with ten brushes — hard and soft rounds, feather, airbrush, chisel, calligraphy, spray, charcoal, stipple and a dry brush — instead of the single hard circle. Drop a rectangle, triangle or ellipse on the canvas and Add or Subtract it: drag the shape or its handles to size it, hold Shift to resize without squashing it, Alt over a handle to spin it, and it stays where you put it so stamping the same ellipse three times is three drags. Adjust the result — grow the whole mask, shrink it, or reduce it to a band around its edge — with a live preview and Apply, so you can fix the edge of a subject without regenerating the middle of it. Fill closes enclosed holes in one press, where you can see what is being filled before you commit to it. And a finished mask can be turned into paint from the right-click menu, or paint turned back into a mask, as a copy that leaves the original alone. No model runs and nothing downloads for any of it: all instant, all undoable.

- Detection: one button, one pass, and a way to stop it. The three detection methods — Points, Text and Auto — now open in a small strip beside a single Detect button instead of taking three toolbar slots. One detection finds every match in a single pass, so picking a result, or changing your mind and picking another, no longer re-runs it — trying all of them costs what one used to. While it works, the status bar reports it with a timer and Detect turns into Stop: a slow pass over a busy image used to look like the app had frozen, with no way to call it off.

- Localised edit — edit part of an image at full size. Mask an area before an edit and only that area is regenerated. A whole-image edit has to shrink your picture to the size the model works at; a masked edit crops to the mask instead, so the picture keeps its original resolution and everything outside the mask is untouched. It rewards a precise mask — for broad changes like a new pose, leave the mask off and let the model rework the whole image. On Krea 2, FLUX.2 Klein, Qwen Image Edit and Boogu Image Edit.

- Control — copy the structure of an image. One operation that takes a picture, reads the structure out of it and paints your prompt into that shape. A Control Type picker chooses WHICH structure: Depth keeps volume and framing, Pose keeps only the body skeleton, Scribble and Canny keep outlines. SDXL Realistic, SDXL NSFW, ILL Anime Beauty, ILL Anime and PONY Mix offer all four; Qwen Image Edit offers Depth and Pose. It replaces the old Depth operation everywhere: Krea 2 and FLUX.2 Klein still do depth, they just do it under the new name and show no picker, having only the one.

- Control on Chroma. Both Chroma models can now follow the depth and composition of an input image and paint your prompt into that shape.

- Four styles on Chroma. Chroma gains a style rack — B&W Sketch, Lenovo, Brushwork and Anime — available on every operation, Detail and Upscale included.

- Control Strength. Krea 2, FLUX.2 Klein, Chroma and the SDXL family gained a slider on Control for how hard the control map pulls. At full strength the composition is locked to the source; easing it off lets the model reinterpret the framing while keeping the pose. Klein bites softer than Krea 2, so it wants a lower setting.

- Composite — blend two of your images and watch it happen. Two new tools in a Composite group. Right-click the image you want underneath and choose Send to Composite, then open Paint Comp on another image and erase — the picture underneath shows through live where you erase, and the brush paints the top one back. Mask Comp does the same cut in one step using the mask already on the image, so everything the mask tools can select — brush, detect, points, text, shapes, adjust — can drive a blend. Press Apply to keep it as a new entry at full resolution; your originals are untouched. The old blend asked you to decide before you could see anything, which meant running it three or four times to get one result.

- Paint — draw on your image and let the model take it from there. A new Paint group with a brush, an eraser and a colour picker. A rough scribble tells the model where, how big and what colour — something a prompt alone cannot say. Paint a shape, then mask it and run Detail over it, and the model works from your sketch instead of guessing. It gets the same ten brushes as the mask — feather, airbrush, chisel, calligraphy, spray, charcoal, stipple, dry brush and the two rounds — and the same rectangle, triangle and ellipse, committed here as Fill or Erase in the colour you picked. Adjust works on paint too, and it is how you outline something: grow a scribble and the new edge is filled in your colour while what you already painted is left alone, shrink it and the edge is eaten inward with every surviving brushstroke keeping its own colour, or reduce it to a band and the scribble becomes its own outline. The paint stays on your image while you switch to the mask tools, and it keeps itself per image until you close the app, so nothing is lost while you work. Undo works on it like anything else on the canvas. Press Apply to bake it in as a new entry — your original is untouched, so deleting the new entry undoes it.

- Resize — one click back to the original size. An Original Size button under the width and height boxes puts both back to the picture's own dimensions, so you can try a size, change your mind and start again without looking the numbers up.

- Hover sound now has a volume, not just an on/off. A volume slider sits next to the gallery size slider, so you set how loud a hovered video or audio card plays without leaving the gallery. Sliding it to zero is the mute — which is why the "Play audio on hover" switch is gone from Settings; it was the same control, two rooms away. At zero an audio card stays silent instead of pretending to play, and a video still previews without sound.

- MiniMax H3 — video that comes with its own sound. A new video model that generates the picture and synchronized stereo audio in a single pass, instead of handing you a silent clip to score afterwards. The sound belongs to the scene because it was made with it, not added over the top. It does Text to Video and Image to Video, and like LTX 2.3 it takes a first frame, a last frame, or both. Resolutions run up to 4K, though the sizes above its native canvas are final-render territory rather than something to iterate at: twice the pixels costs a little over three times the time, so the top of that ladder is for a card that can carry it, not somewhere to work. It is a big model — 50GB of weights, a slow generator, and a 12GB graphics card at the minimum — and it asks you to accept its licence before it downloads, which is covered further down. If what you want is the same character, place or voice across several clips, reach for its sibling below instead.

- MiniMax H3 Reference — the same character, place or voice in every clip, with no training. A new video model that works from references instead of a first frame. Give it a face, a character sheet, a location, a clip whose camera move you want, or a voice, and it generates a new video that keeps them — up to nine images, three videos and three audio clips at once. Nothing you give it appears in the output as-is: these are references, not frames, so the model is free to put your character somewhere new rather than animating away from a picture. Point at a specific one in the prompt by typing @, which lists what you have staged and drops in its tag — "the woman from <Picture 1> walking through <Picture 2>". Each thumbnail wears the tag it became, so there is nothing to memorise. Reference detail decides how much of each reference it reads: Match is the fast default, Max keeps more and is the one to use for a character sheet, where it costs time on every step. It outputs video with synchronized audio like the rest of H3, and it installs alongside the existing MiniMax H3 sharing its text encoder and both VAEs, so it is one extra model file rather than a second full model.

- Video previews are much better. While MiniMax H3 or LTX 2.3 works, the card now shows the actual clip in real colour, playing from the first frame as it refines, instead of the coloured blocks video models used to give you.

- Engine updates now apply in place — seconds, not a fresh download. Updating the generation engine used to delete the whole thing and download it again from scratch: around eleven gigabytes of engine, every add-on and every Python package, even when the actual change was tiny. It now updates just the parts that moved, so a typical update finishes in seconds and costs you almost no bandwidth. The full reinstall is still there and still runs by itself whenever the update genuinely needs one — an add-on that was retired, a change to the engine's own Python, or anything that does not go cleanly — so you never end up on a half-updated engine.

#### Fixes

- The LoRA and upscale pickers in Model Settings open again. Clicking a LoRA slot or the upscale model did nothing — the arrow flipped as if the list were opening, but no list ever appeared, so neither a LoRA nor a different upscale model could be picked. Affected Model Settings since 1.3.0.

- Installing a model no longer fails after an app update changes a Python package. Once an update moved one of the engine's Python packages, the next model install died with Download Failed right after the files had downloaded — and every install after that failed the same way, so retrying could never work. The engine was running, and Windows will not let anything overwrite a file a running program is using. The update is now applied while the engine is stopped, on its next start.

- Most model downloads now have a second route when your network blocks the first. Every model file was served from one address, so an ISP filter, a school or office network, or antivirus web protection sitting on that one address stopped the whole catalogue — nothing would install, and the app looked broken when the network was the problem. If the connection to the usual host fails, the download now retries the same file from Hugging Face automatically, and anything already downloaded is kept rather than started over. It also no longer loses the explanation: if both routes fail you still get the "your network blocked this, try a VPN" message instead of a bare error code. This helps when a network blocks the address; a network that interferes with the transfer itself can still break a download. A handful of files still have a single route: the three small preview decoders, which exist nowhere else in the form the app needs, and a few of the largest model files, which we serve straight from the host that publishes them.

- Ctrl+scroll no longer changes the size of the interface. macOS sends a two-finger trackpad pinch as a Ctrl+scroll, and the app was treating that as the shortcut for changing UI size — so on a Mac, trying to zoom into an image blew up the entire interface instead. That shortcut is gone on every platform; use Ctrl (or Cmd) with + / -, which always did the same job. And the size you pick now survives a restart — it used to be forgotten on every launch, which meant anyone who needs a larger interface set it again every single time they opened the app.

- The NVIDIA PiD upscaler now upscales, and no longer crops. A required setting had gone missing from its recipe, so the engine skipped the step that does the work and handed your picture back at its original size. The setting is back, the same gap has been swept for across every model, and PiD no longer crops the edges off an image it had to scale.

- Updating from inside the app reopens it again. Pressing Update closed the app and left it closed, even when the update had applied perfectly — which read as a crash. The updater now reopens the app when it finishes, writes a log next to the app (update/update.log), and if an update fails it tells you why on the next launch instead of vanishing silently. Because the updater that runs is the one already installed, this takes effect when updating FROM this version — updating TO it still needs you to reopen the app yourself.

- The startup splash now covers the whole wait, instead of vanishing on the slow starts it exists for. It was being closed the moment the window had something to paint — including the browser's own "cannot connect" page, which is what shows while the app's engine is still starting on a cold or slow first run. So the splash disappeared early, or on Linux failed to appear at all, and you watched an error page until the app arrived. It now stays up until the app itself is loaded.

- A clear message when another program is using Cubric Vision's port. The app serves itself over a local port, and if something else already held it, Vision either opened onto whatever that other program was serving or sat on a black window with nothing to click — no menu, no refresh, no way out. It now stops and tells you which port is taken.

- Running your own ComfyUI no longer breaks the app's. If you already had ComfyUI open, the app quietly used your install instead of its own, because both were on the same port. Yours does not have the app's custom nodes, so every generation stopped with "Node 'Input_Seed' not found. The custom node may not be installed." — which read as a broken install, when nothing was wrong with it. The app's engine now runs on its own port and stays out of the way of yours, so you no longer need to close ComfyUI before opening Cubric Vision. If something else is using that port, the app now tells you instead of silently generating on it.

- Text detect finds things again. Naming an object found nothing at all whenever the result count was 1 — the default, and the setting most runs use. The count was written into the prompt in a form the detector read as part of the object's name, so it went looking for something that was never there. Raising the count to 2 or naming two objects had been dodging it by accident. Affected Text detect since 1.3.0.

- Masked edits no longer fail on large images. The mask was being sent at a smaller size than the picture it belonged to, and any source over roughly 1500 pixels on its long edge stopped with a dimensions error. Affected FLUX.2 Klein's masked edit since 1.3.0.

- Notifications no longer sit on top of what you're working on. They now appear at the top centre of the window, the one strip the interface keeps clear. Every corner they lived in before — bottom right, bottom left, top right — covered controls or your image.

- The progress bar no longer keeps moving after you press Stop. Stopping a job that reports no percentage — an upscale, a detection — left the bar sweeping away under an IDLE label until the next job happened to reset it.

- Typing a size in Resize no longer throws an error. Entering a width or height ran the preview again on every single keypress, against the half-finished number you were still typing — so the "1" of "1024" was treated as a one-pixel-wide image and stopped with a failure dialog. The preview now waits until you finish and click away.

- The mask brush no longer skips on a fast stroke. The brush placed a dab at each position the mouse reported and nothing joined them up, so a quick drag left a dotted trail of gaps instead of a solid stroke — worst on a large image zoomed out, where the same hand movement covers far more of the picture between readings. Strokes are now continuous at any speed.

- The live preview now looks like your picture, not a colour blob. While a generation runs, the thumbnail is decoded by a tiny preview model, one per model family — and the ones for FLUX.2 Klein were never installed, so it fell back to a rough colour projection that told you almost nothing about what you were getting. On macOS and Linux none of them were installed, so every model had the blob. They now install with the engine. A few models still show the rough preview on purpose: Krea 2, Qwen and Wan 2.2 share a preview decoder with a known bug that corrupts the real generation, so the mediocre preview is the safe choice until that is fixed upstream.

- The batch count no longer appears where it did nothing. On SDXL's Image to Image and Control, asking for several images only ever returned one — the setting reached a part of the workflow those operations do not use. The control is now hidden there rather than lying about it. Text to Image is unaffected.

- The home screen no longer claims you have no models when it cannot tell. On a cloud-only setup — the local engine install skipped, no Pod connected yet — the models count on the home screen read 0 / 18 on a machine whose drive was full of weights. Models live in a folder the local engine owns, so with no engine there is nowhere to look and nothing to count: the app was showing a zero it had never measured. It now shows a dash until an engine, local or cloud, can actually answer.

- RunPod's "Stage all models on connect" is locked until you save an API key. The panel said the RunPod controls were locked until a key was saved, then let you flip that one switch anyway — a setting about connecting to a Pod you had no way to connect to yet.

- The install screen no longer flickers during the dependency step. Two things report progress at once — the phase the installer is on, and the files it is fetching — and they were taking turns overwriting the same line, several times a second. Each now has its own place to speak.

- Reuse Prompt now brings back settings you never touched. Reusing an older generation restored the controls you had changed, but silently skipped any control you had left alone — so a setting you had since nudged upwards stayed where it was instead of dropping back to what that run actually used. The app was only recording the settings you edited, and read a missing one as "leave it as it is". Every control a generation used is now recorded, whether you touched it or not. Older generations cannot be repaired — those values were never written down — but everything from this version on reuses exactly.

- Models you never installed no longer show a half-finished download bar. Six model tiles were showing progress bars — 17%, 22%, 33%, 35%, 36%, 49% — for downloads nobody ever started, for two different reasons. Two of them were counting files that belong to a model you do have installed and billing them to its sibling; the other four were counting leftovers from models you had removed earlier, which nothing was clearing up. Both are fixed, and a bar now counts only the files that model would actually have to fetch.

- A model that is part-way onto your disk no longer looks like it is downloading right now. A model whose files are partly present showed the same filling progress bar as a live download, so a library with a few of those read as several models installing at once — which never happens, since installs run one at a time. It now reads plainly as 98% ON DISK, beside the Install and Installed labels. A moving bar in the Model Library means one thing only: something is downloading this second.

- Uninstalling now tells you the truth about what it removed. On a cloud Pod, the confirmation counted every file it asked about as deleted — including files that were never on the volume in the first place. One uninstall reported eight files removed when exactly one existed. And in the opposite case, a model whose files had already gone said "model files kept on disk; still installed" when nothing was kept and nothing was left. Both are gone: a file is only reported as removed when it was actually there and actually deleted.

- A generation that fails before it starts now tells you why. Some failures happened before anything reached the engine, and said nothing at all: no message, no error, and the card simply sat on QUEUED while the queue counter climbed. Worse, that failed generation kept its slot, so every generation after it queued behind one that had already given up — the app looked frozen, and only restarting it cleared the queue. Those failures now release the slot and say what went wrong.

- A failed model install now tells you why. When an install failed after the files had downloaded, the error box came up completely empty — no reason, nothing to act on, and no hint whether it was worth retrying. The reason was there in the logs the whole time; it just never reached the dialog. It does now.

- A hiccup mid-download no longer throws away the download. A 25GB model that stalled for a minute — a router blip, a bad moment on the line — was declared failed outright, even though the gigabytes already on disk were perfectly good. It now retries on its own and picks up exactly where it left off. It still stops promptly and tells you what to do when your network is genuinely blocking the connection, rather than sitting there retrying something that will never work.

- Uninstalling now clears up after itself properly. Uninstalling a model has always kept files that another installed model still needs, which is right. But once that other model went away too, its files were left behind for good — owned by nothing, deleted by nothing, and invisible in the app because a model you don't have installed offers no Uninstall button. On this machine that had quietly accumulated ~16GB. Uninstall now also clears out weights that no installed model needs any more. Files shared with something still installed are kept, exactly as before. This works on a cloud Pod's storage volume too — where it matters more, because that volume outlives the Pod and you pay for its size every month, so anything stranded on it was costing you until you noticed it.

- The negative prompt now does something on LTX. Anything you typed into the negative box on an LTX video was being ignored. The usual mechanism for it only applies at a guidance strength LTX does not run at, and the one part that can carry a negative at LTX's settings had been pointed at your positive prompt by mistake — so it was nudging the video towards what you asked for instead of away from what you didn't want. It is wired correctly now, and leaving the box empty switches it off cleanly instead of leaving it half-applied.

- Resize Video works on a cloud GPU whatever you have installed. It stopped with a missing-node error unless that cloud volume happened to have Wan 2.2 on it — the video node it needs only ever arrived as a side effect of installing that model, so a volume built up from any other model never got it. The nodes every tool relies on are now put in place when you connect, the way they already were on your own machine.

- The Qwen Image Edit tier stays put. Quality/Turbo/Hyper was being remembered per operation, so switching between Edit and Control silently changed the tier underneath you. It is now one setting for the model.

- Setting up the engine downloads less, and stops hiding a step that always failed. The generation engine is built from a set of add-ons, and each one used to install its own list of supporting libraries — over a dozen separate passes that re-checked the same libraries again and again, sometimes installed a package only to replace it moments later, and on some machines pulled in graphics-card libraries a computer without that card can never use. The app now installs one list, decided and tested in advance, in a single pass: less to download, less to unpack, and the same libraries on every machine instead of whichever add-on happened to go last. One of those add-ons also had a piece that failed to install on every computer, on every platform, on every fresh setup — and reported success anyway. It was never used by anything in the app, so it is gone.

- The same extra model folder can no longer be added twice. On Windows, one folder can have two spellings — a long one and a short PROGRA~1-style one — and the app treated them as two different folders, so the same LoRA or upscale folder could end up in your list twice. Both spellings now resolve to the same folder.

- Updating the engine no longer leaves tools quietly missing. After an engine update, five add-on packs could come back without the Python packages they need — the masking detectors, the pose and depth guides, several samplers and part of LTX. Nothing warned you. The tools simply were not there, and the first sign was a generation failing on a feature that had worked the day before. The engine now reinstalls those packages whenever it replaces itself, and a check was added so a future update cannot skip them the same way.

- Installing to a cloud Pod that is still waking up no longer looks like a crash. Start a model install in the first seconds after a cloud engine comes up and every file could fail at once, behind a Download Failed box asking you to report it on GitHub — for something that fixes itself. The engine's storage service takes a few seconds longer to answer than the engine does, and the app was reading that gap as a real error. It now tells you the engine is not ready yet and to try the install again in a moment. Genuine failures — a bad file, for instance — still report exactly as before.

- A cloud generation no longer disappears when a model adds new tools. Some models bring their own add-on packs, and the cloud engine has to restart to pick them up. It did that immediately — including while something else of yours was still generating. Whatever was running was killed mid-render and simply vanished: no error, no message, nothing in the queue, and the picture you were waiting for never arrived. Queue a batch, start one of those models, and the work already in flight was gone. The engine now waits for the work in progress to finish before it restarts, and if it cannot, it says so and leaves your generation alone instead of throwing it away.

- A cloud install that was interrupted can be started again. If your cloud engine went away in the middle of a model install — stopped, deleted, or restarted — pressing Install again did nothing at all: no error, no progress, just a bar sitting where it stopped, and the only way out was restarting the app. The app was still treating that abandoned download as if it were running. It now checks with the engine first and restarts anything the engine is no longer working on.

- Your cloud drive is no longer reported as full when it is not. If you had a download that was interrupted part-way, the app counted that half-finished file at its full final size — so a 21GB model that had only fetched 2GB was counted as all 21. The more unfinished downloads you had, the further out the number drifted, and the space bar in Settings read high for the same reason. Then the next install was refused for lack of room that was actually there: in one measured case the app said 39GB free and stopped an install while about 91GB was genuinely free. The message you got made it worse, because it told you to free up space — which was not the problem and would not have fixed it. The app now measures what the files really occupy on the drive rather than what they will occupy once finished.

#### New Operations

- **`control`** (v1.0) — copy the structure of a reference image. On Krea 2 and Chroma.
- **`ref2v_ms`** (v1.0) — MiniMax H3 Reference: the same character, place or voice across clips, with no training.

#### Breaking Changes

None.

#### ComfyUI Engine

- COMFYUI ENGINE UPDATED TO 0.31.0 - from 0.29.2, two upstream releases in one step. It is a small update to install: the engine itself moves, but nothing in the heavy machine-learning runtime does, so there is no multi-gigabyte re-download.

- MiniMax H3 generates faster on the new engine, and so do LTX 2.3 and Wan 2.2 - the work upstream did on H3 sped up the other two as well. Everything else runs as it did.

- Every shipped model was re-swept after the update by executing a real generation for each of its operations on a GPU, 35 in total, and all of them passed.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: version badge + feature list (mask toolkit, MiniMax H3, Control)
- [ ] **Documentation Website**: 1.4 coverage
- [ ] **GitHub Releases**: full builds + update bundles, all three platforms
- [ ] **Patreon**: public announcement
- [ ] **Discord**: post to `#announcements`, publish to followers
- [ ] **Facebook / Instagram**: 4:5 card + copy
- [ ] **YouTube Posts**: 1:1 card + copy (manual in Studio, no API)
- [ ] **Fanvue**: post
- [ ] **madponyinteractive.com**: `announcements.json` entry
## Cubric Vision v1.3.1 — 2026-08-02

### Changelog

A bug-fix release built almost entirely from one user's report. A Windows 11 user on a
portable install could not download a single model: every attempt to reach the model
server failed instantly while everything from GitHub downloaded fine. The app reported it
as a wall of raw TLS driver text and offered to file a bug report, so it read as the app
being broken — it was his internet provider interfering with the connection. The log he
sent surfaced four separate defects. A follow-up — with the errors now readable, he still
could not generate — surfaced two more, and those two are the ones that actually unblock
him without any infrastructure change.

#### Changes

- **Custom nodes survive a blocked model host.** The universal-workflow dep set spans two
  hosts — every `type: 'custom_nodes'` dep is a github.com zip, every `engineAsset` weight
  is on the model server — but `startUniversalWorkflowInstall` rejected as soon as any dep
  failed, and the reject sat *above* the custom-node extract/pip/marker step. One blocked
  host therefore discarded a full set of perfectly-downloaded nodes, and since the drift
  check reads "no folder" as missing, boot re-ran the same repair and discarded them again
  on every launch — an engine that could never install a single node, so generation failed
  on unknown `class_type` regardless of which weights were present. The wait now resolves
  with the failure, the nodes that landed are installed, and only then does it throw. The
  error carries the `modelJob` so the two engine-provision callers (Windows archive and
  Linux/macOS uv-bootstrap — both swept) can still run `finishCustomNodeInstall`.
- **A failed dependency repair cannot lock the user out.** `/engine/repair-deps` runs
  behind the boot gate, which releases on `engine:ready`/`engine:gate-release` and *not* on
  `engine:error` — and the error phase offered only Retry, which failed identically every
  time on a blocked network. Repair now distinguishes an outstanding node from an
  outstanding weight: nodes all present → `engine:complete` (ComfyUI can run, let them in);
  nodes genuinely missing → the error, now carrying a "Continue without them" escape that
  emits the new `engine:gate-release`. Deliberately *not* `engine:install-skipped` — that
  event means "I will use RunPod instead" and the Settings switch follows it.
- **The floating rejection that made a network fault read as a crash is gone.**
  `FileDownloader.download()` fired `this._downloader.start()` without attaching a
  `.catch`, while the sibling `resumeFromFile(...)` two lines above it had one — so every
  **non-resume** failure produced a duplicate unhandled rejection that escaped to
  `server.js:93` and printed `[ERROR] [system] Unhandled promise rejection` with a raw
  driver string. The error itself was always handled by the `'error'` handler; this only
  silences the duplicate. The test stub that hid it (a `start()` returning the `push()`
  index instead of a promise, unlike the real NDH API) now models the real contract.
- **The blocked-host remedy is the one that was measured.** The draft message led with "set
  your DNS to 1.1.1.1" — corrected in the same unreleased version, so **no build ever shipped
  that advice** (it entered in `6b27ab4b` and left before release; 1.3.0 has no transport
  message at all). Do not write it up as a user-visible change. The reporting user tested a
  DNS switch on its own and the download still
  died at ~20%, with one dep hitting the 30s stall timeout. The interference is on the
  sustained stream, not name resolution. It now leads with a VPN for the whole download and
  says plainly that changing DNS alone is often not enough.
- **Network-blocked downloads explain themselves.** A transport-level failure (blocked or
  hijacked DNS, a network or parental filter, a VPN, antivirus web protection, a refused
  or reset connection) is now classified, named by host, and shown as a friendly warning
  with a remedy — not as raw BoringSSL/OpenSSL text, and no longer routed to the
  Report-on-GitHub dialog. Genuine failures (SHA256 mismatch, out of disk, permissions,
  404) are untouched and still report as themselves.
- **Retrying a download keeps credit for what is already on disk.** The requeue paths
  zeroed a dep's byte counter while `removeOnFail:false` kept the partial and the next
  attempt resumed it, so the progress bar visibly ran backwards on every retry. Local
  requeues now credit the resumable partial via `getPartialBytes()`. Remote (Pod-side)
  requeues still zero, correctly — there is no local partial there.
- **Engine-setup failures carry their reason.** The universal-workflow wait rejected with
  only the failed dep IDs (`UW deps install failed: rife47`), discarding the cause.
- **Startup no longer dies when the Documents folder cannot be resolved.**
  `app.getPath('documents')` throwing took the whole process down through the fatal
  handler before any window appeared. `routes/shared.js` already falls back when
  `APP_DOCUMENTS` is absent, so main now catches and continues.
- **Download mirror failover (infrastructure, inert by default).** A transport failure can
  now retry the identical object path against alternate origins before the dep is failed,
  and a mirrored URL counts as the same object so MPI-317 resumes the partial instead of
  scrapping it. `_MODEL_MIRRORS` ships **empty** — failing over to a host that does not
  exist would turn one clean error into two slow ones. Set `CUBRIC_MODEL_MIRRORS`
  (comma-separated origins) to test, or add the origin to the constant once a second host
  is live. Object layout must match: `<origin>/vision/models/<comfy-type>/<file>`.
#### Not in this release

Cut directly off 1.3.0 and deliberately scoped to the fixes above. Masking-system work and
the workflow changes still under verification remain in `docs/releases/UNRELEASED.md` and
ship in a later version — do not fold that scratchpad into a patch release.

#### New Operations

None.

#### Breaking Changes

None. `SCHEMA_VERSION` unchanged at 4.

#### ComfyUI Engine

ComfyUI version unchanged (0.29.2).

---

### Known limitation

The mirror failover is shipped but **not enabled** — there is no second origin yet, and
adding one is an approval-gated Cloudflare change. For the user whose report drove this
release, the interference was deep-packet, killing the stream mid-transfer at ~20% rather
than blocking the hostname outright; a plain DNS switch was tested by him and was **not**
sufficient, and a tunnel was. A same-provider mirror defeats hostname-keyed blocking but
is unproven against DPI. See `.agents/mpi-kanban/tasks/MPI-427/brief.md`.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: version badge
- [ ] **Documentation Website**: changelog page
- [ ] **GitHub Releases**: create release with tag v1.3.1, attach portable artifacts + update bundles
- [ ] **Discord**: post in updates channel
## Cubric Vision v1.3.0 — 2026-07-30

### Changelog

A feature release: masking rebuilt around point-and-name detection (SAM3), the
FLUX.2 Klein model family, a rebuilt Krea 2 edit path and quality pass, the
operation strip + per-operation prompting guides, a no-GPU cloud-only setup
path, and the Windows Smart-App-Control launcher change — plus a large round of
cloud-Pod responsiveness and install-state fixes.

#### Important changes

- **Windows: the app now starts from `CubricVision.exe`.** `start.vbs` and
  `start-with-terminal.bat` are gone — double-click `CubricVision.exe` in the
  folder instead. This is not a tidy-up. On a clean Windows 11 install, Smart App
  Control blocks `.vbs` and `.bat` files outright, with no "run anyway" and no way
  to allow them, so for anyone on a fresh machine every way we shipped to start
  the app was blocked and double-clicking did nothing at all. An executable does
  not get that treatment. Windows may still warn you the first time with a blue
  "Windows protected your PC" box, because the app is not code-signed yet — click
  **More info**, then **Run anyway**. You only do that once.

  Three things to know if you already have Cubric Vision on Windows:

  - **If the app currently does not start for you at all, updating cannot fix
    it** — the updater is a `.bat` and is blocked by the same rule. Download the
    full build from the release page and unpack it fresh. Your projects live in
    Documents and are untouched; point the new folder at your existing engine and
    models, or set them up again.
  - **If you update in place**, an old `app` folder is left behind in your Cubric
    Vision folder. Nothing uses it any more and it is safe to delete — about a
    gigabyte back.
  - **Updating from inside the app becomes the recommended way on Windows from
    this version onward**, and works regardless of Smart App Control — it runs
    `update/win-update.cjs` through the app's own binary instead of a `.bat`.
    `update.bat` and `update-from-zip.bat` are still there for machines where it
    is switched off.
  - **Getting TO 1.3.0 is a full download on Windows.** The in-app updater in
    1.2.0 and earlier fetches the patch and then silently applies nothing (see
    `tasks/MPI-387/validation.md` § the 1.2.0-era in-app updater), so the
    Windows update bundle was pulled from the release on 2026-08-01. macOS and
    Linux keep theirs. Windows deltas resume at 1.4.0.

#### What's new

- **No GPU? Skip the install and run in the cloud.** Setting up Cubric used to
  mean installing the ComfyUI engine first, even on a machine that could never
  use it — and the RunPod settings that would have let you skip it were behind
  the install screen. That screen now offers a way straight past it, with a link
  to the setup video. Cubric then runs entirely on a cloud GPU. Turn it back off
  in **Settings → RunPod** whenever you want the local engine after all.

- **New model: FLUX.2 Klein.** The fastest image model in Cubric Vision, and the
  only one that can take things *out* of a picture — mask an object, run
  **Inpaint** with the prompt left empty, and it's gone in about four seconds. It
  covers the full set in one model: generate from text, reshape an existing
  image, follow a depth reference, edit with up to three reference images,
  clean up detail and upscale,
  with eight style looks available on every one of those. Quality is modest next
  to Krea 2 — this one is built for speed and for tidying images up, so reach for
  it when you want an answer now or something removed, and for Krea 2 when you
  want the finished piece.

  > Tip: **Depth** on this model takes *two* images if you give it two. The first
  > supplies the pose, the second supplies who is in it — so you can put your own
  > character into a pose you found, without describing either of them.

- **Krea 2 edits follow your instructions much more closely.** The edit path has
  been rebuilt around the newer Krea 2 edit engine. Your reference image is now
  fitted to the shape of the picture you're making, so asking for a new setting
  actually gives you a new setting instead of quietly keeping pieces of the
  original background. Restaging someone into a new pose, outfit or scene lands
  closer to what you asked for, likeness is better, and references whose shape
  doesn't match your output no longer come out stretched or soft.

  > Tip: the more of your reference frame the character fills, the better the
  > likeness. Crop your reference to the person before using it.

- **Krea 2's quality setting produces far more natural images.** This affects
  everything made at the quality speed, not just edits — the sampler was pushing
  the model too hard, which flattened lighting, over-saturated colour and gave
  skin and surfaces a waxy, plastic look. It is now dialled back, and a second
  detail pass finishes the image. Lighting reads like a real photograph, skin and
  fabric hold real texture, and backgrounds resolve properly instead of going
  soft. It also sticks to your prompt more literally: where it used to quietly
  add flattering or on-theme details you never asked for, it now gives you what
  you actually described. The fast setting is unchanged.

- **Blend two versions of an image together with a mask.** When a re-run fixes
  one part of a picture and ruins another, you no longer have to choose. Paint a
  mask over the area you care about, select that entry and the one you want to
  borrow from, right-click and pick **Mask composite**. **Add** drops the other
  entry's pixels into the masked area; **Subtract** does the reverse, keeping the
  other entry and taking only the masked area from the one you painted. The blend
  lands as a new entry in the strip, so nothing is overwritten and deleting it
  undoes the whole thing. The edge is softened automatically, and a mask drawn as
  an outline fills in, exactly like everywhere else masks are used.

- **Hold Alt to drag a gallery card straight into another app.** Dragging a card
  out to a folder has always worked, but dropping it into Discord, Photoshop or a
  browser upload box did nothing — a plain drag only hands over a *promise* of a
  file, which the file manager understands and other apps ignore. Hold **Alt**
  while you drag and the card leaves as a real file, so any app that accepts a
  dropped file now takes it. You can let go of Alt once the drag is moving. If
  several cards are selected, Alt-dragging one of them drags all of them at once.
  A plain drag is unchanged: onto the prompt to reuse a card, into a folder to
  save it.

- **Image descriptions are sharper and get straight to the point.** Describe an
  image and it no longer starts with "The image shows…" — the description opens
  on the subject itself, so you can paste it straight into a prompt. It is also
  considerably more thorough, covering the subject, clothing, materials,
  lighting, composition and background in enough detail to recreate the shot.

- **Pick what you're making from a strip, not a dropdown.** Every operation your
  model can do now sits above the prompt box as a row of chips, with the current
  one lit. An operation you can't run right now stays visible but dimmed, and
  hovering it says exactly what's missing — *needs 1 image*, *paint a mask
  first*, *takes at most 2 images* — instead of quietly disappearing from a list.
  The same strip appears inside the parameters popup, so you can change operation
  without closing it. Clearing the last image now drops you back to
  text-to-image on its own, and the operation you actually chose comes back the
  moment you add an image again.

- **Every operation now explains how to prompt it.** Operations want completely
  different prompts and nothing in the app said so — Inpaint wants you to
  describe what *should be there* (and erases the masked area entirely if you
  leave the prompt empty), Upscale is usually best with no prompt at all, and
  Edit wants an instruction rather than a description. Open the parameters popup
  and there's now a **?** above the operation strip: it opens a short guide for
  whichever operation you're on — what the prompt is for, a couple of examples,
  and the mistake people usually make. It follows your model too, so the SDXL
  family is pointed at comma-separated tags while the newer models are pointed
  at plain sentences.

- **Choosing a model is a full-screen contact sheet.** The model dropdown is now
  a grid of preview tiles like the Model Library, so you pick by looking at the
  work rather than reading names — click the model button above the prompt and
  it opens, the same way every time, instead of a ring that rotated and changed
  size depending on which model you were on. LoRA & Upscale settings open from
  the model's own tile.

- **Tab jumps between the gallery and the card you were working on.** One key,
  both directions: from the gallery it opens the last card you had open in that
  project, and from inside a card it drops you back to the gallery. It remembers
  per project and remembers after you close the app, so you come back to where
  you left off. If a project has no cards yet, Tab does nothing at all — and if
  you delete the card it was holding on to, it forgets rather than sending you
  somewhere you didn't ask for. This replaces the old Tab ring, which had been
  down to a single entry ever since operations moved to the prompt box.

- **Crop outside the picture.** The crop box no longer stops at the edge of your
  image — drag it past any side and the new area fills with a colour you pick.
  That flat colour is what you hand to a model next: switch to an edit model (or
  any model with edit capabilities), don't mask anything, and just describe what
  should be there — it paints into the coloured area. Good for turning a portrait
  into a landscape, or giving a subject room to breathe. Two smaller things came
  with it: the box now snaps to your image edges when it gets close, so you can't
  accidentally leave a one-pixel sliver of border, and there's a third
  **Resolution** mode beside Ratio and Free where you type an exact width and
  height — the box locks to that shape and the result comes out at exactly those
  pixels. Images only; video crop is unchanged.

- **Masking is rebuilt: four tools, and it can now find anything you can point at
  or name.** Masking used to be one tool with the method buried inside it. It is
  now four icons in the rail, each doing one job.

  **Brush** is painting, plain and simple — paint, erase, opacity. **Points** is
  the new one: click anywhere on the image and the mask snaps to whatever you
  clicked, whether that's a face, a pair of headphones or the coffee cup on the
  table. Right-click to push the selection back off something it grabbed by
  mistake. **Name** lets you type what you want instead — *hair*, *cup, earring*,
  *bikini* — say how many of each to find, and every one comes back as its own
  thumbnail to pick from. **Detect** is the face / hand / person finder you
  already had, unchanged.

  Points and Name cover each other's weak spots. Clicking is precise, but thin
  strappy things — a strap, a handle, a chain — want more dots than you'd expect,
  especially right-clicks to push the selection back; naming the object handles
  those in one press. Everything adds on top of whatever you've already painted,
  so all four mix freely.

  > Tip: dots are cumulative, but they describe *one* region per run. Click, hit
  > **Add**, then start on the next part.

  A few smaller things came with the rebuild. Anything a detector found now draws
  **green**, so a found region is distinguishable from one you painted. A new
  **black-and-white view** in the strip shows the mask exactly as it is handed to
  the model — the quickest way to catch stray specks before you generate. The
  eraser's ring is visible against dark images instead of vanishing into them. And
  the prompt box now **stays open while you mask**: a mask and a prompt are one
  job, and leaving the tool every time you wanted to change a setting was the
  worst part of the old flow.

  Points and Name run on a new model that installs alongside the engine, so expect
  a one-off download of about 1.7GB after you update.

- **Ctrl+Z on the canvas.** Every mask edit can now be taken back — a brush
  stroke, a Clear, committing a detection — with **Ctrl+Shift+Z** to put it back
  again. The history follows you between mask tools, and starts fresh when you
  open a different image.

#### Fixes

- **The app is no longer slow while connected to a cloud Pod.** Opening your
  model library could leave the grid blank for ten to fifteen seconds, and
  Settings would sit there before showing how full your volume was or letting you
  press Disconnect. The cause was on the Pod, not in the app: two things it does
  routinely — measuring how much space your volume uses, and checking which
  models are installed on it — were being done in a way that made the Pod stop
  answering anything else until they finished. Measuring a 150GB volume takes a
  couple of seconds, and the app asked for it every ten seconds, so the Pod spent
  much of its time unable to reply. Worse, each new request started its own fresh
  measurement on top of the last, which fed on itself: one measurement was
  observed taking over two minutes and being cut off by the network, with the
  Pod's own health checks failing while it happened. Both jobs now run out of the
  way of everything else, the volume measurement is taken once and shared rather
  than repeated per request, and it refreshes immediately whenever you install or
  remove a model. The library and Settings now open straight away. Requires no
  action from you — it lands the next time your Pod starts.

- **If the app fails to start, it now says so instead of vanishing.** A crash
  during startup used to close the window with nothing left behind — no message
  on screen and nothing written to the log — so there was no way to tell whether
  the app had opened and shut, or never opened at all. Startup failures now show
  what went wrong and write the same detail to the log file, so a report has
  something in it. The update download also names itself honestly: unzipping it
  gives you a folder marked `update-only`, which is a patch to apply over your
  existing copy, not a second copy of the app.

- **Editing an image in the strip now always uses the image you're looking at.**
  If you ever dropped or reused an image into the prompt box while working
  inside a history strip, that picture quietly became the input for everything
  you ran afterwards — no matter which entry you had selected. It never showed
  up anywhere, because the prompt panel is tucked behind the prompt tool, so an
  upscale or an edit would come back looking like a completely different picture
  and a lower Denoise wouldn't help: the strength was fine, the image was wrong.
  The strip now always works from the entry you have open. Working with more
  than one input image — a second reference for an edit — is a gallery job, and
  choosing one of those operations inside the strip simply runs it on the
  selected image. Video is unchanged: start and end frames have their own place
  in the prompt panel and still work exactly as before.

- **Stopping a generation no longer says it finished.** Pressing Stop could still
  pop a "Generation finished" notification with the completion chime, because the
  engine often completes the step it was already working on and hands back a
  finished image. That result is still kept — it just no longer announces itself
  as a successful run you didn't ask for.

- **Krea 2 upscaling is sharp again.** Upscales came out noisy — bad enough to be
  unusable at full quality, and mediocre on the fast setting. The upscaler now
  finishes with a short refining pass, and full quality no longer borrows the
  fast setting's accelerator, so it actually renders at the quality you picked.
  Both speeds improved; full quality is the bigger jump.

- **Your images no longer carry hidden data.** ComfyUI stamps the entire
  generation graph — your prompt, negative prompt, seed, model names and the
  full node workflow — invisibly inside every PNG it produces. Cubric Vision now
  strips that out as each image is saved, so you can share or publish your work
  without leaking the prompts behind it. Pixels are untouched: the file is
  byte-for-byte the same image, just without the hidden payload. Applies to
  newly generated images; images already in your project keep their original
  metadata.

- **Mac: pictures come out as pictures again, not grey mush.** Engine setup on
  Apple Silicon was installing a development snapshot of PyTorch — an unreleased
  daily build — instead of a finished release, so the engine you ended up with
  depended on the day you happened to install it. One of those daily builds
  rendered every SDXL image as flat grey noise, and it did so silently: no error,
  a normal generation time, and a normal-looking result in your gallery until you
  opened it. Mac now installs the same tested, stable PyTorch that Windows and
  Linux have always used. If you set up the engine on a Mac and your images came
  out grey, reinstall the engine from Settings and they will be fine.
- **macOS: installing a model no longer fails partway through.** On Mac, setting up
  any model that uses depth stopped with "Installation Failed" and a Retry button
  that could never succeed — one of the components it downloads asked for a piece
  of software that is only published for Windows and Linux graphics cards, so the
  step failed every single time. Cubric Vision now skips that piece on Mac, where
  it was never usable in the first place. Nothing else about the install changes,
  and Windows and Linux are untouched.

- **Cloud Pods can no longer report a model as installed when nothing downloaded.** While a
  Pod was still starting up, it could answer the "what's on this volume?" question with only
  part of the picture — and anything missing from that answer was taken as *installed*. Models
  you never touched would tick over to installed one after another, with no download and
  nothing on the volume, so the next generation failed on files that were never there. An
  incomplete answer is now treated as "don't know yet" instead of "yes": those models keep
  whatever state they already had and settle on the next check a few seconds later.

- **Gallery cards now match the picture inside them.** A card was laid out using
  the size you *asked* for rather than the size that came back, so whenever a
  model produced something a different shape — some of them adjust dimensions to
  suit the picture — the card was cut to the wrong shape and the image sat inside
  it with padding around the edges. Opening the entry always showed it correctly;
  only the grid was wrong. Cards are now measured from the finished image, so the
  grid lays out cleanly and the small padding some models produced is gone.

- **Windows: setting up on a fresh machine now finishes.** On a clean Windows 11
  laptop the setup ran for an hour, then stopped with "Installation Failed" and a
  Retry button that re-downloaded everything and failed the same way. Three things
  were behind it. The download folder ended up with the app's long name written
  twice, which pushed some of the files it installs past the length Windows allows
  a file path to be, so writing them simply failed. One component asked for a
  developer tool most people do not have installed. And the error message blamed
  the wrong step, which is why Retry looked like it should help. All three are
  fixed: the Windows download unpacks into a single short folder, the unnecessary
  component is gone, and if anything does go wrong the message now names the exact
  part that failed. Setup also checks up front whether the folder you unpacked
  into is too deep for Windows and tells you to move it *before* downloading
  several gigabytes, instead of after.

- **The startup window no longer flashes white.** On slower machines the loading
  window appeared as a blank white box for a few seconds before the logo showed
  up. It now waits until it has something to show.

- **Connecting to a cloud Pod no longer downloads models you never asked for.** When
  Cubric reconnects and finds a Pod component sitting at an out-of-date version, it
  repairs it. That repair was far too eager: instead of updating the one small
  component, it re-ran the *entire* install for every model that component belonged
  to — quietly pulling down gigabytes of model files that were never on your Pod in
  the first place. On a fresh Pod, where most components read as out of date at once,
  that could fill a 150GB network volume in about a minute, and it took back any space
  you tried to free, so you couldn't even uninstall your way out of it. The repair now
  updates only the component that actually drifted, which is a few hundred kilobytes,
  and it says what it is doing in the log instead of running silently.

- **Installing a model after connecting to a cloud Pod no longer does nothing.** The
  first model you installed after connecting could sit on "Queued…" indefinitely — no
  progress, no error, no way to tell it had not started. Cubric installs one model at a
  time and queues the rest, and it was waiting on a job that had already finished before
  it started listening, so the queue stayed shut for half an hour and then quietly opened
  again on its own. It happened on the connect *after* your models were already on the
  volume, which is to say almost every time. Installs now start immediately, and if the
  queue is ever held up for any other reason it says so in the log instead of sitting
  there. Connecting is also quieter: it no longer pops an "engine:assets installed"
  message — an internal name that was never meant to be shown — every single time.

- **The Model Library no longer goes blank when an install or uninstall finishes.**
  For about twenty seconds after a model finished installing — and after every
  uninstall — every tile lost its preview at once, leaving a grid of empty boxes
  with names on them. Nothing was actually wrong: the library was rebuilding the
  whole grid from scratch, throwing away every preview it had already loaded and
  then asking for them all again while it was still busy working out what had
  changed. Previews are now kept and reused, so the grid updates in place and never
  blanks — the same when you filter, search, or change a model's options. Video
  previews show their first frame straight away instead of always arriving last. An
  uninstall also says "uninstalled" now, rather than "updated", which read as the
  opposite of what had just happened.

- **An uninstalled model no longer shows a full progress bar where its Install
  button belongs.** After uninstalling a model, its tile went back to the Available
  section as it should — but drew a completed progress bar instead of an Install
  button, so the model looked like it was still there, or still doing something.
  Restarting the app or reloading did not clear it. The app was still holding the
  finished install job for a model it had just deleted, and had no way to be told the
  model was gone: it only ever expected an install to end with the model *present*.
  It now lets go of the job the moment you uninstall, on both your own machine and a
  cloud Pod.

- **Settings no longer forgets where your models are.** If your models folder had
  "temp" or "tmp" anywhere in its path — `D:\AI\temp_models`, a folder called
  `tmp-models`, even a Windows account name that happens to contain those letters
  — then simply opening Settings quietly pointed Cubric back at its own default
  folder. Nothing was deleted, but the whole library read as if nothing was
  installed and models you already had started downloading all over again. The
  check that did that is gone. Cubric also writes every change of models folder to
  its log now, so if the folder ever does move unexpectedly, there is a trail.

#### New Operations

- **inpaint** (Inpaint): image, 1 input image + mask, prompt describes what
  should be there. Introduced with the operation strip (MPI-356).
- **kleinEdit** (Klein Edit): image, up to 3 reference images — the FLUX.2 Klein
  model's edit operation (MPI-354).
- Deprecated (never wired to a workflow, kept so legacy history items still
  validate): `change`, `remove`.

#### Breaking Changes

None. Project schema unchanged (SCHEMA_VERSION 4).

#### ComfyUI Engine

ComfyUI version unchanged (0.28.0, shipped in v1.2.0).

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge, feature list (masking rebuild, FLUX.2 Klein)
- [x] **Documentation Website**: Live and updated for 1.3 (Fabio confirmed 2026-08-01)
- [x] **GitHub Releases**: Published 2026-08-01 with **5** artifacts — 3 full + 2 update bundles (macOS, Linux). The Windows update bundle was built and verified but deliberately NOT shipped: the 1.2.0-era in-app updater cannot apply it, and at 451 MB against a 523 MB full build the layout move made it a delta in name only.
- [x] **Patreon**: Public announcement posted 2026-08-01 (MPI-67). Stability-led; engineering causes deliberately omitted as noise to readers.
- [x] **Discord**: Posted to `#announcements` 2026-08-01, published to followers (msg `1533184242387783823`). **There is no `#updates` channel** on the Mad Pony server and never has been — this line said `#updates` until 2026-08-01. Routing is owned by the Identity repo's cross-post matrix, not by this checklist.
- [x] **Facebook / Instagram**: Posted 2026-08-01 with the 4:5 card (FB `2082214622105466_1668970538564254`, IG media `18108009272015659`).
- [ ] **YouTube Posts**: 1:1 card + copy ready (MPI-67); manual in Studio, no API exists. *(Called "YouTube Community" elsewhere — that means the Posts tab, not the newer discussions space, which is deliberately off.)*
- [x] **Fanvue**: Posted 2026-08-01. Adult-permitting showcase surface; was not previously on this checklist.
- [x] **madponyinteractive.com**: `announcements.json` updated and pushed 2026-08-01 (`ae21942`). 1.1 and 1.2 were both missed here.

> **Copy correction, 2026-08-01 (MPI-423).** The Klein bullet above originally read
> *"paint over an object, hit **Remove**"*. There is no Remove operation — the real
> path is mask → **Inpaint** with the prompt left empty. The sentence was corrected
> here, in `js/data/releaseNotes.js` (the in-app changelog) and in
> `js/data/modelConstants/models.js` (the Model Library tile). Anything posted to
> Patreon or Discord must use the corrected wording; if a post already went out with
> the old sentence, correct it there too.
## Cubric Vision v1.2.0 — 2026-07-24

A focused minor release on top of 1.1.0: a much faster RunPod remote engine, the
ComfyUI engine bumped to 0.28.0 (local **and** remote Pods), Depth Control brought
to the SDXL models, and a handful of fixes.

### Changelog

#### What's new
- **Depth Control for SDXL.** The five SDXL generators (SDXL Realistic, SDXL NSFW,
  ILL Anime Beauty, ILL Anime, PONY Mix) can now follow the pose and composition of
  a reference image via a depth ControlNet. Pick the **Depth** operation, drop in an
  image, and the result keeps its structure while your prompt drives the content.
- **Stage all models on connect (RunPod).** We found that copying your installed models
  onto the Pod's fast local disk ahead of time makes the first generation start much
  sooner — so there's now a setting (off by default) that stages every installed model
  the moment the Pod connects. Off keeps the default, staging each model on first use.

#### Fixes
- **Cloud model switching is dramatically faster.** Switching between image models on
  a RunPod engine no longer re-reads the weights from the slow network volume every
  time — they're staged to the Pod's fast local disk, cutting a cold switch from ~2
  minutes to a few seconds. The Pod's disk now auto-sizes to your network volume so
  the whole model set fits. Video models (LTX) that stream by design are unaffected.
- **Cloud model installs verify almost instantly.** After a model downloads to a
  RunPod engine, the app no longer re-reads every weight back off the slow network
  volume to checksum it — a completed multi-connection download is trusted directly,
  so the "Verifying…" step that could run longer than the download itself (~3 min on
  a 2 GB file) is now near-instant.
- **Dragged-out gallery cards keep their real name.** Dragging a gallery card out into
  a folder now saves it with its real filename from the project's Media folder (e.g.
  `t2i_001.png`) instead of a generic `project-file.png` — which also collided into an
  "already exists" prompt when dragging out more than one. Dragging cards onto the
  prompt to reuse them is unchanged.
- **Copy mask keeps the auto-detected regions.** Copy mask only carried brushed/erased
  strokes, so the auto-detected selection was lost on paste — and a mask made purely
  from auto-detect copied as nothing. It now carries the auto-detected regions too,
  matching what Download mask already exported.
- **Completion toast fires reliably.** A single generation finishing while the app is
  focused now shows the "Generation finished." toast — previously only multi-generation
  batches did. Notifications are quieter overall: routine confirmations (importing a
  model, uninstalling, adding cards to a project, switching models to continue a
  preview) no longer play a sound, and returning to the app after a download finished
  no longer replays a duplicate toast.
- **Toasts moved to the bottom-right.** The toast stack now stacks up from the
  bottom-right corner instead of the bottom-left, so notifications no longer cover
  your prompt text.

#### New Operations
None. Depth Control reuses the existing `poseReference` operation (introduced in 1.1.0
for Krea 2), now extended to the five SDXL models.

#### Breaking Changes
None. Project schema unchanged (v4).

#### ComfyUI Engine
Updated to **0.28.0** (from 0.27.0), on both the local engine and released remote
Pods (Pod image `v0.17.0`). Brings a text-model sampling speedup and int8/int4
optimizations that mainly help local Turing / 16-series GPUs. No workflow or behaviour
changes — every shipped model was re-swept and passed.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **GitHub Releases**: Create release with tag v1.2.0, attach the 6 portable artifacts (3 full + 3 update bundles)
- [ ] **Landing Page**: Update version badge
- [ ] **Documentation Website**: Update changelog page
- [ ] **Discord / Patreon**: Post update announcement with the RunPod-speed + 0.28 highlights
## Cubric Vision v1.1.0 — 2026-07-09

First public minor release after 1.0.1. This is the aggregate of everything that
landed on the development line since 1.0.1: the RunPod remote engine, a full-page
Model Library, a wave of new image and video models (Krea 2 and Krea 2 NSFW, Qwen
Image Edit, Boogu Image Edit, Chroma Flash and Chroma Hyper, LTX 2.3, NVIDIA PiD
Upscaler, Wan 2.2 5B), new History tools (Remove Background, Export GIF), the
floating-latents window, frame-accurate video playback, a redesigned Settings
panel, the mascot, and a large batch of workflow quality-of-life and fixes.

> The public jump is 1.0.1 → 1.1.0. The earlier internal 1.1.0 and 1.1.1 builds
> never shipped publicly; their content is folded in here.

### Changelog

#### Important changes
- **Install individual model operations.** Multi-capability models (for example
  Wan 2.2 does both text-to-video and image-to-video) let you toggle which
  operations to download in the detail panel — shared parts (VAE, text encoder)
  download once. Only installed operations appear in the prompt box. Image models
  are unchanged.

#### What's new

**New models**
- **Krea 2.** A new high-quality image model with a distinctive photographic look.
  Ships ten built-in styles picked from a strip of preview cards (plus a None card
  for the model's own look), an in-prompt enhancer, 1K/2K output, a depth-guided
  **Depth** operation that transfers a subject's pose and composition from a
  reference image, and an **Edit** operation that changes only what you ask while
  preserving the rest — drop a second reference image to pull from both. One
  install, two speeds via a **Turbo** toggle.
- **Krea 2 NSFW.** Lustify Krea, an uncensored Krea 2 variant by Coyotte (creator
  of the Lustify SDXL model). Same look, style LoRAs, Depth and Edit, same
  one-install Turbo toggle. int8 weights — fastest on NVIDIA RTX (20-series+).
- **Qwen Image Edit.** An instruction image editor that takes up to three
  reference images at once and excels at combining them (refer to them by number).
  Seven built-in styles and a per-run Quality/Turbo/Hyper speed dial.
- **Boogu Image Edit.** A unified 10B instruction image editor (Apache-2.0).
  Whole-image edit preserving the rest, in two separately-installed tiers (High /
  Balanced).
- **Chroma Flash.** An NSFW image model with exceptionally realistic skin (8-step
  Flux Schnell fine-tune), with standout matching upscale and detail passes.
- **Chroma Hyper.** A faster, lighter Chroma for lower-VRAM machines — the same
  Flux-family generator distilled to a smaller download (~9GB vs 17GB). Text-to-
  image, image-to-image, upscale and detail. Chroma Flash's Low-tier sibling.
- **LTX 2.3.** A video model that generates with sound — produce an audio
  track or drive it from your own clip. Text-to-video and image-to-video with
  first/last-frame guidance, up to 2K and 4K. Quality tier remembered per model.
- **NVIDIA PiD Upscaler.** A generative 4x image upscaler that adds real detail.
  Pick a look (Flux/SD3/Qwen/SDXL), output size (1K/2K/4K), and how much new
  detail to invent. Any aspect ratio.
- **Wan 2.2 5B.** A fast low-tier video model (text-to-video + image-to-video) in
  one compact 720p download, with a 4-step Turbo mode.

**New tools and operations**
- **Image to Image on every image model.** Feed an input image and a prompt to
  reshape the image; the Denoise slider controls how much it changes.
- **Remove Background.** A new History tool (Enhance) using BiRefNet — transparent
  PNG or a solid background color of your choice.
- **Export GIF.** A new History tool (Export, video only) — pick frame rate,
  output size, and loop count, preview the result and file size, then export.

**Engine and Model Library**
- **RunPod remote engine.** Run generation on a rented cloud GPU. Saving a RunPod
  API key reveals the remote-engine controls; the app then starts, installs models
  to, and generates on the Pod. Generation stays local until you Connect, and
  GPU/storage billing is on your own RunPod account. Optional minimum-system-RAM
  requirement and a live disk-usage bar.
- **Full-page Model Library.** A full-screen grid split into Installed/Available
  and Image/Video, with media/size/search filters, a per-model detail panel, a
  VRAM table, and fullscreen video previews.
- **Model download queue.** Installing several models queues them one at a time;
  each waiting model shows a cancellable Queued state and advances on its own.
- **Model memory guidance.** Each model shows a size tier (Low/Balanced/High) with
  a hover VRAM+RAM table, your GPU row highlighted.
- **Bring your own LoRA and upscale models.** Drag a LoRA or upscale file
  (`.safetensors` or `.pth`) onto its folder in Settings and Cubric copies it in.
  You can also point Cubric at more than one LoRA or upscale folder under External
  Connections (extras read-only; only your primary folder is managed for
  installs/removals).
- **Searchable LoRA picker.** A searchable, collapsible folder tree; long/nested
  names no longer clipped.
- **Bypass a LoRA without removing it** — a per-slot zero-strength toggle for A/B.

**Editing and workflow quality-of-life**
- **Reorder your prompt images.** Drag the image chips to change order; each shows
  its number. Models that refer to images by position follow the order you set.
- **Frame-accurate video playback.** Stepping, scrubbing, and trimming land on the
  exact frame; the player shows the true decoded frame when paused/stepping, with
  matching colors and clean sub-range loops.
- **Crop ratios and Divisible by.** A Ratio/Free choice with a full ratio set
  including cinema formats (2:1, 1.85:1, 21:9, 2.39:1), plus a Divisible by control
  (default 16). Resize also defaults to 16.
- **Mask tools.** Right-click the viewer to Clear mask without opening the Mask
  tool, or Copy/Paste a mask between History entries (paint and eraser strokes
  carried separately; warns on shape mismatch).
- **Reuse Prompt, refreshed.** A clean full-width toggle list (prompt, settings,
  model, images, video, audio) with an All/None shortcut; now carries video and
  audio too.
- **Rename and annotate gallery cards.** Right-click to rename or add notes; select
  multiple to copy into another project. Renames stick across reloads.
- **Open in file system.** Right-click any gallery card or History entry to reveal
  the media file in your file browser.
- **Drag a card anywhere.** Pull a gallery card to another app to export, or
  click-drag it into the prompt box.
- **Project right-click menu.** Add notes, rename, open folder, or clean up cached
  reuse frames (media and history kept).
- **Gallery view remembers your layout** (card-size slider + info-mode toggle
  persist across restarts).
- **History cards show aspect ratio** next to the pixel size (e.g. `768×1280 · 5:8`).
- **History tool rail tooltips** — hover a tool icon to see its name; rail icons
  slightly larger.
- **Reverse video or audio separately** — reverse both, just the video, or just
  the audio.
- **Prompt drafts survive navigation** (session-only, separate per surface).
- **Hover to hear your clips** (video/audio, one at a time; toggle in Settings).
- **Video player and Cue quality-of-life** — M to mute, Q for the Cue queue from a
  clip history, shortcuts on every player button hover.
- **Missing-model feedback** — a missing LoRA blocks generation; a missing upscale
  falls back to the default with a warning.

**Notifications, mascot, and Settings**
- **Smarter, configurable notifications** — fire whenever the app is unfocused
  (including when a download finishes), with independent generation/download
  toggles.
- **Notification sound** — plays once when something you were not watching
  finishes (generation, install, engine restart); a whole queue plays it once, and
  self-triggered actions stay silent. Toggle in Settings.
- **Pod connected notification** — a desktop notification when a RunPod GPU
  finishes connecting while you are away. Toggle in Settings.
- **Floating latents when minimized** — a small always-on-top window shows live
  latents; local and remote each get a tile; finished previews stay with a Done
  badge; remembers size/position.
- **Meet the mascot** — hovers center while a card generates, then tucks into the
  corner with a waiting pose once previews arrive; also greets a model pack queued
  to install in the Model Library.
- **Settings, redesigned** — every option is a clean row with its control on the
  right and a plain-language description on the left, grouped into titled sections,
  with proper toggle switches.

#### Fixes
- A generation using a LoRA missing from your folders now names the missing LoRA
  and how to add it, instead of a crash-report dialog and a stuck Stop button.
- Image to Image now actually uses your input image (was ignored on some models).
- Batch renders the requested number of images (was a single one).
- Reuse Prompt restores style, stylization, quality tier and batch, not just text.
- Auto-mask (Detect) no longer fails on Windows with a model-path error, and lets
  you select multiple detected segments again.
- First-time engine setup no longer leaves components uninstalled mid-install or
  behind duplicate download files.
- Your chosen operation no longer resets to Image to Image when you switch
  Gallery/History, change models, or reuse a prompt.
- After deleting History entries, the correct entry is selected and active and your
  open tool stays live.
- Reuse Prompt on an app result offers Prompt Box or App instead of always
  reopening the app.
- Connecting to a RunPod GPU is reliable when you look away mid-connect (no more
  flicker, stuck 0%, reset, or connected-but-stuck).
- Selecting multiple gallery cards survives a generation finishing.
- Re-running an operation that reuses a filename (Combine, Crop, Reverse, Export
  GIF, and others) no longer plays back a previous/deleted result.
- The Uninstall dialog drops the inert "also delete files" checkbox; uninstalling
  always removes weights while keeping files shared with other installed models.
- Uninstalling a model or plugin no longer deletes weights another installed model
  still needs; when nothing can be freed it tells you which models still use them.
- Combining two videos no longer produces a broken frame rate that could freeze
  the player; combined videos have a clean, constant frame rate.
- Running out of disk space shows a clear notice instead of the crash-report dialog.
- Video Continue no longer gets stuck on "Select"; Extend and New shot run as Image
  to Video, the frame slots sit under their own "Continue video" heading, and
  "Create new" is renamed "New shot".
- The project list on the start screen no longer stalls with several large projects
  (per-project thumbnail spinners, newest first).
- Scrolling a gallery with many (large 4K) images is smooth — lightweight
  thumbnails instead of decoding every full-resolution image; built in the
  background on first open.
- Scrolling the gallery no longer makes video/audio cards start playing; media
  plays only when you settle on a card and stops the moment you scroll.
- An interrupted model download (dropped connection, stalled transfer, or quitting
  mid-install) resumes from what it had instead of restarting; Cancel still clears
  the partial download.
- Generated videos no longer carry a duplicate opening frame, so frame counts are
  correct (a 2s 16fps clip is 32 frames, was 33; a 2s 24fps LTX clip is 48, was 49).
- The video player Home/End keys jump to the first/last frame.
- Finishing a queue shows a single "N generations finished" message instead of one
  per item, and minimized messages no longer pile up and replay.
- A generation or install finishing while you were in another app shows the
  completion message when you return, if the desktop notification was missed.
- Universal upscale honors each model's native scale (1x/2x/8x no longer wrong).
- A relocated model is no longer shown as missing when found unambiguously in
  another of your folders.
- Wan 2.2 LoRA settings drop the inert Clip slider (Model strength only).
- Cancelling a remote download clears leftover bytes immediately.
- The Cue queue panel no longer covers the prompt bar.
- The Downloads panel no longer flashes on every refresh (only changed cards redraw).
- Looping a trimmed clip whose out-point is at the very end no longer plays once
  and stops — it wraps back to the in-point.
- Wan 2.2 now uses all six Low Noise LoRA slots in image-to-video and text-to-video
  (previously only the first applied; High Noise slots were never affected).

#### New Operations
- Krea 2 identity **Edit** and depth-guided **Depth**.
- **Qwen Image Edit** and **Boogu Image Edit** instruction editors.
- **Remove Background** (BiRefNet) and **Export GIF** History tools.
- **Image to Image** extended to all image models.
- Generative image upscale (**NVIDIA PiD Upscaler**).
- Text-to-video / image-to-video for the new video models (LTX 2.3, Wan 2.2 5B).

#### Breaking Changes
None. Project `SCHEMA_VERSION` unchanged (4).

#### ComfyUI Engine
Updated to 0.27.0.
## Cubric Studio Vision v1.0.1 — 2026-06-14

### Hotfix: subfolder LoRA / upscale models on Windows

A point fix on top of 1.0.0. Delivered to Patreon Pro supporters via Cloudflare
(see [`patch-distribution.md`](patch-distribution.md)); not a public GitHub
release.

### Changelog

#### Fixes
- **Subfolder LoRA / upscale models now load on Windows.** Any LoRA or upscale
  model stored in a subfolder (e.g. `loras/SDXL/foo.safetensors`) could not be
  used on Windows in 1.0.0 — selecting it and generating failed with
  *"Generation failed — Prompt outputs failed validation"* (`Value not in list:
  lora_name`). The model list was sent to ComfyUI with forward-slash separators
  while ComfyUI's Windows model enum uses backslashes, so the names never matched.
  The app now emits the engine-native separator, and projects that already
  referenced a subfolder model heal automatically at generation time. Root-level
  models were unaffected and continue to work.

#### New Operations
None.

#### Breaking Changes
None. Project `SCHEMA_VERSION` is unchanged (2).

#### ComfyUI Engine
Unchanged from 1.0.0.

### Distribution

This is a Patreon Pro patch. Per-OS portable artifacts are built in the private
`mpi-ci` CI (Windows, Linux x64, macOS arm64), collected to
`D:\CubricStudio\Vision\Builds\v1.0.1\`, then uploaded to Cloudflare from the
MadPony-Identity project. No git tag is pushed and no GitHub Release is published
for this version; it will fold into the next public release's accumulated
changelog.
## Cubric Studio Vision v1.0.0 — 2026-06-10

### First public release 🎉

Cubric Vision 1.0.0 is the first official, public release — a local,
open-source (AGPL-3.0) image and video generator powered by ComfyUI that runs
entirely on your own machine.

### Changelog

This release is the culmination of the cross-platform portable-distribution work
(MPI-8). It ships verified portable builds for all three desktop platforms, a
zero-setup engine bootstrap, and a fully validated in-place updater.

#### Highlights
- **Three platforms.** Portable builds for Windows (x64), Linux (x64), and macOS
  (Apple Silicon / arm64). Each runs in place — no installer, no admin rights.
- **Zero-setup engine.** The ComfyUI engine bootstraps on first run (bundled uv;
  resumable downloads for models and dependencies). No manual Python/ComfyUI
  setup.
- **In-place updater.** Online (`update.command`/`.sh`/`.bat`) and offline
  (`update-from-zip`) updaters, both validated on hardware. Updates preserve your
  engine, models, projects, and settings. The online updater now reports a clear
  message if a shared network hits GitHub's hourly request limit.
- **No-terminal launch on Windows & Linux.** `start.vbs` (Windows) and a detached
  `start.sh` (Linux) launch with no console window; a `*-with-terminal` variant is
  included for watching the live log.

#### macOS first-launch note
macOS builds are not signed or notarized (notarization needs a paid Apple
Developer account — deferred). On first launch, clear the download quarantine
once in Terminal:

```bash
xattr -dr com.apple.quarantine "/path/to/CubricVision-macos-arm64-v1.0.0"
```

then double-click `start.command`. After an in-app update no re-quarantine
occurs. (See the macOS README in the build.)

#### New Operations
None for this release (operation set carried forward).

#### Breaking Changes
None. This is the first public version; project `SCHEMA_VERSION` is unchanged
(2).

#### ComfyUI Engine
ComfyUI version unchanged from the pre-release cycle.

---

### Known follow-ups (not blockers)
- A proper no-terminal macOS launcher (a signed/notarized `.app`) is deferred —
  it requires a paid Apple Developer account for notarization.
- Per-workflow VAE precision tuning for fp16 banding on Apple Silicon MPS
  (MPI-61) is backlog, fixed per-workflow when it surfaces.

---

### Platform Update Checklist

- [ ] **Landing Page**: version badge -> 1.0.0; "available now" / download links.
- [ ] **Documentation Website**: macOS first-launch quarantine step; updater docs.
- [ ] **GitHub Releases**: tag v1.0.0, attach the 3 FULL portable installs
      (`CubricVision-<plat>-<arch>-v1.0.0.zip`/`.tar.gz`). No update bundles for
      the first release.
- [ ] **Patreon**: launch announcement.
- [ ] **Discord**: #updates launch post + download links.
## Cubric Studio v0.0.12 — 2026-06-10

### Changelog

Patch release. Fixes the macOS launcher and is the build used to validate the
online updater (`update.command`) end-to-end on all three platforms.

#### Changes
- **macOS launcher fix (MPI-63)**: the `CubricVision.app` no-terminal launcher
  introduced in 0.0.11 did not start reliably on Apple Silicon — Finder launched
  it under Rosetta and it crashed with `EPERM: process.cwd failed (uv_cwd)`
  because a `.app` runs with the working directory set to `/`, so the bundled
  Electron could not resolve the portable root. It has been removed; the proven
  `start.command` (terminal launcher, validated since 0.0.8) is the macOS
  launcher again.
- **macOS one-time setup (`setup.command`)**: unsigned, un-notarized downloads
  are quarantined by Gatekeeper, which blocks the launcher before it can run.
  The new `setup.command` is run once (right-click → Open → Open); it strips the
  `com.apple.quarantine` attribute from the whole portable folder, after which
  `start.command` launches by double-click with no prompt. Documented in the
  macOS README and on the docs site. macOS only — Windows/Linux have no
  Gatekeeper equivalent.

#### New Operations
None.

#### Breaking Changes
None.

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

- [ ] **Landing Page**: version badge (no feature changes).
- [ ] **Documentation Website**: add the macOS one-time `setup.command` step.
- [ ] **GitHub Releases**: tag v0.0.12, attach portable artifacts. Used for the
      online-update test — repo briefly PUBLIC with 0.0.12 as the non-prerelease
      'latest', then reverted to private and the release removed.
- [ ] **Patreon**: optional — patch note.
- [ ] **Discord**: optional — patch note in #updates.
## Cubric Studio v0.0.11 — 2026-06-10

### Changelog

Patch release. New baseline build for all three platforms — the first build
where macOS has a no-terminal launcher, bringing it in line with Windows and
Linux. Intended as the fresh-install baseline that the next online-update test
diffs against.

#### Changes
- **macOS no-terminal launcher**: the portable bundle now ships a
  `CubricVision.app`. Double-clicking it launches the app with **no Terminal
  window** and gives Cubric Vision a proper Dock icon. The previous
  `start.command` is renamed to `start-with-terminal.command` — the debug variant
  that opens a Terminal so you can watch the live log. This mirrors the
  no-terminal default already shipped on Windows (`start.vbs`) and Linux
  (detached `start.sh`). (MPI-63)

  The `.app` is staged into both the full bundle and the offline-update bundle,
  so existing installs pick it up on their next update. The macOS CI build uses
  `ditto`, which preserves the bundle's executable bit and metadata through the
  zip and Safari auto-extract.

#### New Operations
None.

#### Breaking Changes
None.

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

- [ ] **Landing Page**: version badge (no feature changes).
- [ ] **Documentation Website**: no operation changes.
- [ ] **GitHub Releases**: tag v0.0.11, attach portable artifacts (gated per repo-distribution rules). This is the intended PUBLIC baseline for the online-update test.
- [ ] **Patreon**: optional — patch note.
- [ ] **Discord**: optional — patch note in #updates.
## Cubric Studio v0.0.10 — 2026-06-10

### Changelog

Bug-fix patch. Most items surfaced during the live macOS (Apple Silicon M4) +
Linux acceptance test. (0.0.9 was an internal test build and was never released;
its fixes are folded into this 0.0.10.)

#### Changes
- **Video zoom on macOS/Linux**: wheel-zoom, pan, and double-click-reset in the
  video viewer now work on macOS and Linux. The transform was previously applied
  to the player wrapper, which the hardware-video compositor on those platforms
  does not honour; it is now applied to the video element itself. (MPI-58)
- **History video thumbnails**: video entries no longer show a "missing video/image
  link" placeholder. Three layers: the update applier now restores +x on bundled
  ffmpeg/ffprobe (an EACCES on spawn left the thumbnail unextracted), and the
  history list no longer puts a video URL in an `<img>` when the thumbnail is
  missing (shows an empty slot instead of a broken-image icon). (MPI-59)
- **Apple Silicon memory monitor**: the VRAM gauge no longer reads "0.0 / 0 GB" on
  Apple Silicon. Unified-memory Macs have no discrete VRAM, so the monitor now
  shows only RAM there. `/system/stats` reports `gpu.vendor` + `memoryModel`. (MPI-60)
- **Status-bar progress + generation duration**: generation progress now flows
  through a `tool:progress` event the status bar listens to (no more missed
  progress when the model-init-complete signal is absent), and each finished
  generation reports whole-run seconds in the success toast / on the card. (MPI-60)
- **macOS offline update from a folder**: Safari/Archive Utility auto-extracts a
  downloaded update zip into a folder (and truncates a long name). `update-from-zip`
  + the applier now accept an already-extracted directory as the bundle, so the
  default-Safari path works without manually re-zipping. (MPI-62)

#### Reverted
- The brief `--fp32-vae` Apple-Silicon flag (0.0.9) is removed: it OOM'd a single
  image on a 16 GB M4, and a global VAE-precision flag overrides each workflow's
  own authored precision. Per-workflow VAE banding is tracked separately. (MPI-61)

#### New Operations
None.

#### Breaking Changes
None.

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

- [ ] **Landing Page**: version badge (no feature changes).
- [ ] **Documentation Website**: no operation changes.
- [ ] **GitHub Releases**: tag v0.0.10, attach portable artifacts (gated per repo-distribution rules).
- [ ] **Patreon**: optional — patch note.
- [ ] **Discord**: optional — patch note in #updates.
## Cubric Studio v0.0.8 - 2026-06-10

### Changelog

First macOS Apple Silicon build. Cubric Vision now has Windows, Linux, and
macOS portable coverage in the release stream.

#### Changes
- **First macOS Apple Silicon build:** Cubric Vision now runs on Windows,
  Linux, and Mac.
- **Apple Silicon GPU path:** macOS generation uses the Mac GPU through Metal
  instead of falling back to CPU.
- **macOS permissions:** bundled tools and launchers keep permissions required
  for startup.

#### Fixes
- Opening an image or video in the history view no longer fails on Linux.

#### New Operations
None.

#### Breaking Changes
None.

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

- [ ] **Landing Page**: update platform availability language.
- [ ] **Documentation Website**: add macOS Apple Silicon note.
- [ ] **GitHub Releases**: tag v0.0.8 and attach portable artifacts if publishing.
- [ ] **Patreon**: optional platform update note.
- [ ] **Discord**: optional platform update note.
## Cubric Studio v0.0.7 — 2026-06-10

### Changelog

**Throwaway test build.** Cut solely to exercise the no-curl online updater
(`update.sh`) end-to-end on Linux now that the v0.0.6 hardening is installed. No
functional changes. This release and tag are expected to be deleted after the
test. No new operations, no engine version change, no schema change.

#### Changes
- Changelog-only marker ("Online-update test build") so the in-app changelog
  overlay confirms the online update applied. Nothing else changed.

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Note

Delete after testing:
- `gh release delete v0.0.7 --repo MadPonyInteractive/Cubric-Vision --yes`
- `git push origin :refs/tags/v0.0.7`
## Cubric Studio v0.0.6 — 2026-06-10

### Changelog

Patch release. Hardens the portable online updater after on-host testing of the
v0.0.5 online update path. No new operations, no engine version change, no schema
change.

#### Changes
- **Online updater no longer assumes `curl` (MPI-49):** the Linux/macOS online
  updaters called `curl` directly; on a minimal Linux install `curl` was absent
  (`curl: not found`, exit 127) and `set -e` aborted, so the update silently
  failed (the terminal just flashed). We must not depend on host tools — least of
  all on macOS, which we cannot test. All network work moved into a new
  `update/fetch-release.cjs` (pure Node `https`, follows GitHub asset redirects,
  emits a clear message on a private-repo / no-release 404). It runs via
  electron-as-node — the bundled Electron binary is the ONLY runtime a portable
  install is guaranteed to have. `update.sh` / `update.command` now just locate
  that binary, run the helper, and apply. Zero `curl` / `wget` / system-`node`
  dependency. `update.bat` keeps using PowerShell (guaranteed on Windows and
  already working). `build-portable.mjs` ships `fetch-release.cjs` in `update/`.
- **Launchers stay executable after an update (MPI-49):** the v0.0.4 → v0.0.5
  online update stripped the exec bit again because an OLD applier (without the
  fix) applied the bundle. Beyond the per-file `restoreExecBit` (shipped in
  v0.0.5), two manifest-independent, applier-version-independent self-heal layers
  were added: `restoreLauncherBits()` runs at the end of every apply and force
  +x's every known launcher + the Electron binary; and the
  `update-from-zip.{sh,command}` wrappers re-assert +x after the applier returns
  (so even an old applier applying a new bundle leaves the launchers runnable).
- **Clearer updater errors + no vanishing window (MPI-49):** every updater
  failure now prints a readable message and pauses on Enter, so a file-manager
  "Run as program" / double-click launch does not close before the error is read.

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge if shown
- [ ] **Documentation Website**: Update changelog page
- [ ] **GitHub Releases**: Create release with tag v0.0.6, attach portable artifacts (gated per repo-distribution rules)
- [ ] **Patreon**: Post update announcement with changelog highlights
- [ ] **Discord**: Post in #updates channel with release highlights and download link
## Cubric Studio v0.0.5 — 2026-06-09

### Changelog

Patch release. Model-download cross-restart resume safety, refreshed model
preview media, the portable applier exec-bit fix, and contributor-onboarding
surfaces for open source. No new operations, no engine version change, no schema
change.

#### Changes
- **Model downloads resume across an app restart (MPI-54):** large model files
  (safetensors up to ~20 GB) now resume from disk after a full app close instead
  of restarting. A `.cubricdl` sidecar marks an in-progress download; a central
  `isCompleteOnDisk()` (exists && no sidecar) stops a killed partial from reading
  as installed (previously a bare `fs.pathExists` loaded a truncated model). On a
  fresh `ResumableDownloader` instance a partial+sidecar triggers a manual
  `resumeFromFile()` (continues the transfer and keeps in-session pause working).
  `pause()` defers its abort via `setImmediate` to avoid an
  `ERR_STREAM_WRITE_AFTER_END` mid-chunk crash.
- **Close-app warning while downloads are in flight (MPI-54):** the
  before-quit path queries `GET /comfy/downloads/active` and warns that models in
  flight will resume on next launch, and that the engine download restarts (the
  engine stays restart-from-scratch by design).
- **Refreshed model preview media (MPI-57):** the model-download slider cards use
  new WebP still images; video models play a short preview clip on hover.
- **Portable update no longer strips the executable bit (MPI-49):** the applier
  (`apply-update.cjs`) copied files with `fs.copyFileSync`, which does not
  preserve mode, so updated Linux/macOS launchers (`start.sh`, `*.command`, the
  Electron binary) landed non-executable — no "Run as program", double-click
  opened them as text. `restoreExecBit()` now reapplies the bundle file's mode and
  forces `+x` on `.sh`/`.command`/the Electron binary (Windows no-op). This fix
  takes effect from this release onward (it must be present in the bundle that
  applies the update).
- **Contributor-onboarding surfaces for open source (MPI-51):** added
  `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, GitHub
  issue/PR templates, and stale-branch cleanup so external contributors (and their
  AI tools) have the context that previously lived only in private agent memory.
  Repo/onboarding only — no runtime app change.

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge if shown
- [ ] **Documentation Website**: Update changelog page
- [ ] **GitHub Releases**: Create release with tag v0.0.5, attach portable artifacts (gated per repo-distribution rules)
- [ ] **Patreon**: Post update announcement with changelog highlights
- [ ] **Discord**: Post in #updates channel with release highlights and download link
## Cubric Studio v0.0.4 — 2026-06-09

### Changelog

Patch release. Fixes three bugs surfaced during the 0.0.3 on-host install/update
testing, plus a gallery UI overlap. No new operations, no engine version change,
no schema change.

#### Changes
- **Models folder ignored on first-run install (MPI-8):** the folder picked
  before pressing Install was written to `extra_model_paths.yaml` inside the
  engine dir, then wiped by the fresh-install extract scrub, after which the
  post-extract step rewrote the hardcoded default — silently discarding the
  user's choice. The chosen root now travels through the `/engine/download`
  request body to the authoritative post-extract write
  (`routes/engine.js` step 6), so it survives the scrub. Empty input still
  resolves to the default root.
- **Linux `start.sh` not launching via "Run as program" (MPI-8):** the
  no-terminal launcher worked from a terminal but not when run from the file
  manager's right-click "Run as program" — Nautilus tracked the backgrounded
  child and tore down the GUI process when the launcher exited. The detach now
  uses `setsid --fork` (double-fork, reparents the app to init, returns
  immediately, no trailing `&`), with backgrounded-`setsid` then `nohup`
  fallbacks for setsid builds lacking `--fork`.
- **Engine install Pause/Resume button vanished mid-download (MPI-8):** only the
  engine archive was ever pausable; once it finished (while the parallel model
  deps kept downloading) the control became a dead button and was hidden,
  reading as a glitch. Pause/Resume was removed from the engine install entirely
  — it lives with model downloads only (cross-restart model-download resume is
  tracked separately in MPI-54).
- **Gallery favourite/reuse buttons overlapping (MPI-48):** the two top-right
  buttons were separate absolutely-positioned wraps with hardcoded rem offsets
  smaller than the (label-bearing) button height, so the gap went negative in
  preview state and worsened with UI zoom. They now share a single
  `__top-actions` flex column with a gap, so they self-size and never overlap at
  any button height, label state, or zoom (verified by live measurement).

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge if shown
- [ ] **Documentation Website**: Update changelog page
- [ ] **GitHub Releases**: Create release with tag v0.0.4, attach portable artifacts (gated per repo-distribution rules)
- [ ] **Patreon**: Post update announcement with changelog highlights
- [ ] **Discord**: Post in #updates channel with release highlights and download link
## Cubric Studio v0.0.3 — 2026-06-09

### Changelog

Patch release. Fixes the portable update applier so large/full update bundles
install completely, plus two Linux launcher bugs found during on-host update
testing. No new operations, no engine version change, no schema change.

#### Changes
- **Update applier asar stall (MPI-8):** the portable applier runs via
  electron-as-node, whose asar-aware `fs` hook silently stalled `extract-zip`
  on the bundle's `default_app.asar` entry — leaving updates extracted only
  partway (~1553 of 5297 files) with no error. Fixed by setting
  `process.noAsar = true` in `scripts/portable/apply-update.cjs`. Small delta
  bundles were unaffected (they finish before that entry); large/full bundles
  now apply completely. Verified end-to-end on a full 5337-file bundle.
- **Linux `start.sh` silent no-launch:** the no-terminal launcher invoked
  `start-with-terminal.sh` by direct exec, which needs an exec bit that
  archiving strips, so it could exit 0 without launching. Now invoked via `sh`
  with a `chmod +x` fallback.
- **Linux `update-from-zip.sh` double-click UX:** double-clicking the script in
  a file manager flashed a terminal and closed (it requires the zip path as an
  argument). It now prints a clear terminal-only usage message pointing to
  `update.sh` for the automatic GitHub download flow.

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge if shown
- [ ] **Documentation Website**: Update changelog page
- [ ] **GitHub Releases**: Create release with tag v0.0.3, attach portable artifacts (gated per repo-distribution rules)
- [ ] **Patreon**: Post update announcement with changelog highlights
- [ ] **Discord**: Post in #updates channel with release highlights and download link
## Cubric Studio v0.0.2 — 2026-06-08

### Changelog

Patch release. Adds keyboard shortcuts for UI size and bundles the engine-install,
download, and models-path reliability fixes validated during portable update-flow
prep. No new operations, no engine version change, no schema change.

#### Changes
- **UI size hotkeys (MPI-47):** `Ctrl +` / `Ctrl -` change the global UI size, mirroring the existing `Ctrl + mouse-wheel` zoom. Enlarge keys cover numpad `+` and the shiftless `=`; works while typing. No conflict with the gallery's bare `+`/`-` grid-size keys.
- **Engine bootstrap reliability:** stale Windows engine artifacts are scrubbed and the Python runtime is verified after extraction; the Retry button now routes by `GET /engine/status` instead of blindly re-running pip.
- **Download Pause/Resume:** the engine-download Pause/Resume controls no longer vanish or fire prematurely while parallel dependency installs run.
- **Settings models path:** changing the models folder now re-syncs installed models, clearing a stale "no models installed" popup.

#### New Operations
None

#### Breaking Changes
None

#### ComfyUI Engine
ComfyUI version unchanged.

---

### Platform Update Checklist

After publishing this release, update all parallel platforms:

- [ ] **Landing Page**: Update version badge if shown
- [ ] **Documentation Website**: Update changelog page
- [ ] **GitHub Releases**: Create release with tag v0.0.2, attach portable artifacts (gated per repo-distribution rules)
- [ ] **Patreon**: Post update announcement with changelog highlights
- [ ] **Discord**: Post in #updates channel with release highlights and download link
## Cubric Studio v0.0.1 - 2026-06-08

### Changelog

First alpha build of Cubric Studio Vision for local image and video generation
in a desktop project workspace.

#### Changes
- **Project workspace:** organize generations, history, and gallery state per
  project.
- **Local ComfyUI engine:** model-aware image and video workflows run through
  the configured local ComfyUI engine.
- **Engine setup and model discovery:** first-run setup can install the local
  engine and discover local model files.

#### New Operations
Initial operation set.

#### Breaking Changes
None.

#### ComfyUI Engine
Generation uses the configured local ComfyUI engine and local model files for
this release.

#### Important Notes
- Alpha-quality software. Platform validation, portable updates, and
  project/settings compatibility may change before public release.
- Windows was the maintainer-tested path first. Linux and macOS release notes
  should be checked for the latest validation status before sharing artifacts.

---

### Platform Update Checklist

- [ ] **Landing Page**: initial version badge and alpha positioning.
- [ ] **Documentation Website**: initial changelog entry.
- [ ] **GitHub Releases**: tag v0.0.1 if publishing archival assets.
- [ ] **Patreon**: optional alpha announcement.
- [ ] **Discord**: optional alpha announcement.
