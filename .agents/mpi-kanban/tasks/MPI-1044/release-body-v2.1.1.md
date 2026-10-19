# Cubric Studio 2.1.1

One fix for RunPod users.

---

## ⚠️ Updating? Check your version first

**You are on 2.1.0, 2.0.1, 2.0.0 or 1.5.0:** update as normal, in the app or with the update zip below. Coming from 2.0.x or 1.5.0, this update brings you everything in [2.1](https://github.com/MadPonyInteractive/Cubric-Studio/releases/tag/v2.1.0) too, including the engine move to ComfyUI 0.42.1.

**You are on anything older than 1.5.0:** download the full zip below. Your projects carry over. The update zip does not work on those versions: it stops with an "unknown error" and leaves your install working as it was.

- **Use rented GPUs? Update before 15 November 2026.** That day RunPod switches off the connection every version before 2.0 uses to rent GPUs.

---

## Fixes

- **Creating a RunPod network volume no longer says "Volume not created" when it was made.** RunPod sometimes answers with an error after making the volume. The app now finds that volume and selects it, so trying again no longer pays for a second one.

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

- **Windows** - Tested on this build: a 1.5.0 install updated in place with the update zip kept its projects and settings and generated an image. Older than 1.5.0: take the full zip (see the top).
- **Linux** - Not tested on this version.
- **macOS** - Not tested on this version.
