# Cubric Studio 2.1.0

The engine moves to ComfyUI 0.42.1, Qwen-Image 2.1 arrives, six new Flows (Video Edit, two Character Sheet Flows, Transcribe, 360 Panorama, Make seamless), Reference to Video on LTX 2.3, 3D Scenes ship, every prompt passes a child-safety check, and a long list of fixes.

---

## ⚠️ Updating? Check your version first

**You are on 2.0.1, 2.0.0 or 1.5.0:** update as normal, in the app or with the update zip below. Coming from 1.5.0, this update brings you everything in [2.0](https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.0.0) too.

**You are on anything older than 1.5.0:** download the full zip below. Your projects carry over. The update zip does not work on those versions: it stops with an "unknown error" and leaves your install working as it was.

- **Use rented GPUs? Update before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs.

---

## Important

- **The old CubricVision.exe is gone (Windows).** The update removes it. If a shortcut or a taskbar pin still points at it, pin CubricStudio.exe in the same folder instead.

---

## What's new

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

---

## Fixes

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

---

## Engine

- **ComfyUI 0.42.1 (was 0.34.0).** The engine updates itself on first launch in about a minute, with no full re-download, and custom nodes you added yourself stay. Without Krea 2 or the Image Describer plugin, that launch also fetches the 4.88 GB text encoder Enhance and Describe now use (see Fixes).

---

## First launch

The builds are **not code-signed**. There is no certificate and no installer. Signing would start SmartScreen's reputation clock rather than skip it, so the warnings below are expected.

**Windows.** Extract the zip anywhere and run **`CubricStudio.exe`**. Windows may show "Windows protected your PC". Click **More info**, then **Run anyway**. The app is unsigned, and this warning appears until the build earns reputation.

If double-clicking `CubricStudio.exe` does nothing, with no message at all, Windows' Smart App Control may have blocked it. It cannot make an exception for one app, and the builds are not code-signed yet, so there is nothing to click. Signing is the fix, and it is not in place yet.

**macOS.** Any downloaded build is quarantined. Clear it, then launch:

```
xattr -dr com.apple.quarantine "<extracted folder>"
```

then double-click `start.command`.

Setting up the local engine on a Mac needs Apple's Command Line Tools. If setup stops and asks for them, open Terminal, run `xcode-select --install`, let Apple's download finish, then press **Retry**.

---

## Platform support, please read

- **Windows** - Tested on this build: a 1.5.0 install updated in place with the update zip kept its projects and settings, moved the engine to ComfyUI 0.42.1 without a re-download, and generated an image. Older than 1.5.0: take the full zip (see the top).
- **Linux** - Not tested on this version.
- **macOS** - Not tested on this version.
