# MPI-1194 - Reinforcement of child safety

**Parked (deferred).** Pick this up only when a bad output gets past the current gate, or a
user reports one. Brainstormed with Fabio 2026-10-19; no code written.

## Why

The current gate (`docs/child-safety.md`, MPI-1056 onwards) reads the WORDS on every run and
looks at an INPUT picture only when the words ask to undress. Its known holes:

- A run that never says anything suspicious but still makes something it should not.
- A LoRA the app did not ship: it can be trained on anything, and its trigger words carry
  no age, so the word gate is blind to it.

The fix is to look at what was actually MADE, but only on runs that warrant it. Checking every
output is what websites do; a local app cannot afford it (seconds on a local describer, money on
a remote one).

## The rule

The word gate stays exactly as it is, and its hard tier (child words + sexual words) stays an
instant block with no model call. On top of it, run the describer on the **output** when ANY of:

| Trigger | Why |
|---|---|
| The words are adult (sex, nude, undress, lingerie...), any model | the existing borderline signal |
| The model id holds `nsfw` (current rule: Chroma / Pony do not count) | these make nudity unprompted |
| The run loads a LoRA the app did not ship, and the lookup below does not clear it | unknown weights |

Every other run: no describer at all. On runs that get the output check, **drop the input
picture check** - it is what refuses anime start frames and doodles today.

During the check the card stays hidden; a flagged result is removed and the refusal is shown
(the "every action shows itself" rule applies: a visible check, a visible end).

## The LoRA lookup (probed 2026-10-19)

Identify a user's LoRA from the file itself, through CivArchive (loads from the UK, no VPN):

1. SHA256 the file once; cache the answer on disk by path + size + mtime (one lookup per LoRA,
   ever - CivArchive rate-limits with 429).
2. `GET https://civitaiarchive.com/api/sha256/<sha256>` -> `files[]` with `source`, `model_id`,
   `model_version_id` (CivitAI + Hugging Face mirrors).
3. `GET https://civitaiarchive.com/api/models/<model_id>?modelVersionId=<vid>` -> `is_nsfw`,
   `nsfw_level`, `name`, `description` (HTML), `tags`, `deletedAt`.

| Lookup result | Output check |
|---|---|
| Not found / lookup failed / offline | **yes** - unknown, so look |
| Found, child words in name, tags or description (through the word gate) | **block** |
| Found, deleted (`deletedAt` set) | **yes** |
| Found, `is_nsfw: true` | **yes** |
| Found, `is_nsfw: false`, clean words | skip |

**Trap:** `is_nsfw` over-flags. Our own `flux2_klein_9b_refcontrol_depth` LoRA (a depth control,
nothing NSFW) reads `is_nsfw: true, nsfw_level: 3` - CivitAI flags by preview images. So `true`
proves nothing; only `false` is a usable skip signal. Use Node `fetch`; Git Bash `curl` printed
HTTP 000 against this API.

## Open before planning

- Can a user load their own LoRA files into the app today, or only the shipped ones? If only
  shipped, the LoRA trigger waits for the LoRA browser (see memory, no card yet).
- Videos: check the first frame, a few frames, or all? (Clips are first-frame today, MPI-1062.)
- Measure first: how often the input picture check fires today, and how many runs would carry
  each trigger. That number decides whether this is cheaper than the current gate.

## Do not

- Add an on/off switch for the gate, or encrypt local media and check at download - both talked
  down 2026-10-19.
- Use "the model can make NSFW" as the model trigger: almost every model can (Klein 9B made the
  original case), so it would check nearly every run.
