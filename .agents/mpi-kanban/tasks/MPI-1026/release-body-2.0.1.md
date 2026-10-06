# Cubric Studio 2.0.1

A fix for local generation on graphics cards short of GPU memory.

---

## ⚠️ Updating? Check your version first

**You are on 2.0.0 or 1.5.0:** update as normal, in the app or with the update zip below. Coming from 1.5.0, this update brings you everything in [2.0](https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.0.0) too.

**You are on anything older than 1.5.0:** download the full zip below. Your projects carry over. The update zip does not work on those versions: it stops with an "unknown error" and leaves your install working as it was.

- **Use rented GPUs? Update before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs.
- **Coming from 1.5.0, your first Connect sets up a fresh Pod.** The models on your network volume stay; only that first Connect takes longer.

---

## Fixes

- **Local generation recovers from a GPU memory fault.** On some cards (seen on a 12 GB RTX 3060) the engine could stop mid-generation with a "CUDA error". It now restarts in a safer memory mode for the rest of the session: press Generate again.

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

- **Windows** - Tested on this version: a 1.5.0 install updated in place with the update zip kept its projects and settings, renamed the projects folder to Cubric Studio, installed the new engine parts, and generated an image. Older than 1.5.0: take the full zip (see the top).
- **Linux** - Not tested on this version.
- **macOS** - Not tested on this version.
