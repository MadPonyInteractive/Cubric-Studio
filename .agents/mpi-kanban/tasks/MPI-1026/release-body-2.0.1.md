# Cubric Studio 2.0.1

MiniMax H3 Reference runs again on Windows, local generation recovers from a GPU memory fault, and six smaller fixes.

---

## ⚠️ Updating? Check your version first

**You are on 2.0.0 or 1.5.0:** update as normal, in the app or with the update zip below. Coming from 1.5.0, this update brings you everything in [2.0](https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.0.0) too.

**You are on anything older than 1.5.0:** download the full zip below. Your projects carry over. The update zip does not work on those versions: it stops with an "unknown error" and leaves your install working as it was.

- **Use rented GPUs? Update before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs.
- **Coming from 1.5.0, your first Connect sets up a fresh Pod.** The models on your network volume stay; only that first Connect takes longer.

---

## Fixes

- **MiniMax H3 Reference generates again.** On Windows the run could stop with a "HostBuffer.read_file_slice failed" error while the engine re-read its text encoder from disk between its two passes. The encoder now stays loaded, so the run completes.
- **Local generation recovers from a GPU memory fault.** On some cards (seen on a 12 GB RTX 3060) the engine could stop mid-generation with a "CUDA error". It now restarts in a safer memory mode for the rest of the session: press Generate again.
- **The help for MiniMax H3 Reference now says it edits clips.** Give it a clip and ask for the same motion and sound with one change, and it comes back changed with its own soundtrack, speech included. The help and the agent used to say the opposite.
- **A card that is still generating stays on screen with a filter on.** Any Only filter hid the card you were waiting for until it landed, and an image-to-video run wore the Image chip meanwhile.
- **A mark set on a card while it is generating stays on the finished card.** It used to be lost when the result landed.
- **The microphone you pick in Settings is now the one dictation and the recorder listen to.** The system default used to open whatever you picked.
- **The agent remembers what it has looked at.** Looking at the input behind a card used to describe that picture afresh every time; the description is now kept on the input card itself.
- **A message typed while the agent is still answering is read as sent before that answer.** The agent no longer takes it as a reaction to a reply you had not seen yet.

---

## Engine

- **Unchanged from 2.0.0.** Coming from 1.5.0, the first launch installs 2.0's new engine parts, so expect that download.

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

- **Windows** - Tested on this build: a 1.5.0 install updated in place with the update zip kept its projects and settings, renamed the projects folder to Cubric Studio, installed the new engine parts, and generated an image. Older than 1.5.0: take the full zip (see the top).
- **Linux** - Not tested on this version.
- **macOS** - Not tested on this version.
