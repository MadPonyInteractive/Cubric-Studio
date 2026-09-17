# RunPod setup

How to run Cubric Studio on a rented cloud GPU instead of the user's own card. The
controls are in the RunPod section at the bottom of **Settings**. The walkthrough with
screenshots is https://docs.cubric.studio/#/vision/settings#runpod — link it, never
paste it.

## Whose account, whose bill

- It runs on the **user's own RunPod account**. GPU time and storage bill there, not
  to Cubric.
- Nothing bills until the user presses **Connect**. Until then generation stays on the
  local engine.
- No account yet: the panel's **Create RunPod account** button opens sign-up through
  Cubric's referral link, which can include a first-time credit.

## Setup, in order

1. **RunPod API key** — save one with **read + write** access. Every other control
   stays locked until a key is saved.
2. **Data Center** — pick this before the volume. A network volume is locked to one
   data center; switching later means deleting the volume and downloading the models
   again.
3. **Network Volume** — stores ComfyUI and the user's models so they survive between
   Pods, one volume per data center. Connect refuses to start without one.
4. **GPU** — the Pod's card. Stock is a live hint that drifts; the RunPod console is
   the truth.
5. **Min System RAM** — optional, 0 means any host. Heavy video models run better with
   more, because ComfyUI offloads weights to system RAM.
6. **Connect** — starts the remote engine. Models install to, and generate on, the Pod.
   **Open in RunPod console** shows the Pod's real state, logs and spend.

## The settings that spend money

| Setting | Default | What it costs |
|---|---|---|
| **Automatically connect on app start** | off | On: a Pod connects, and bills, at every launch |
| **Auto-retry connection** | — | Waits for an out-of-stock GPU, then connects and bills when one frees up. The user can keep working locally meanwhile |
| **Delete Pod on quit** | — | On: quitting deletes the Pod, freeing GPU and container disk; the volume and models are kept. Off: the Pod stays warm |

A **stopped Pod still bills volume storage** until the volume is deleted. A volume
attached to a Pod cannot be deleted — delete the Pod first. Deleting a volume deletes
the models on it.

## A machine with no usable GPU

- On first launch the install screen offers **Remote only → Set up RunPod**: nothing
  downloads, and the app runs on any machine.
- It is reversible: turn off **Skip the local engine install** in the RunPod settings
  and the local engine install is offered on the next launch.

## For the agent

- Connecting, creating a volume, and deleting a Pod or a volume each spend money or
  destroy models. **Ask first, every time.**
- After any of them, **read the real state back** before saying it worked. A Pod that
  was asked to start has not started until its state says so.
