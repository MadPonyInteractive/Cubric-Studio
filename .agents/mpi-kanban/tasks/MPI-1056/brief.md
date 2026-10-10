# MPI-1056 - Child-safety gate

## Why

Fabio 2026-10-10: "The last thing I want is for people to use this app for child pornography."
Found in MPI-1041: a plain Klein 9B edit ("a younger version of herself as a 5-year-old") turned a
swimwear body sheet into a child with an adult body. The app ships NSFW models (Lustify SDXL,
Krea 2 NSFW, Klein 9B's NSFW LoRA - it switches on from a word list in `klein_9b_t2i.json` node 43)
and free-form edit, and nothing checks for this today.

## Scope (Fabio's call, 2026-10-10)

**No check on every generation** (no image classifier on each result). The gate lives where the
app or an agent WRITES a prompt for the user:

1. **MCP** - outside agents (Claude Desktop, Codex...) driving the app over `/mcp`: refuse a
   generate / Flow call whose prompt sexualises a minor, or puts a child in nude / underwear /
   swimwear content, or sends a child prompt to an NSFW model or LoRA path.
2. **Cosmo** (the in-app agent): the same refusal in its tools and its system prompt.
3. **Prompt enhancement** (the Enhancer): never writes that content, and refuses to expand a
   request that asks for it.
4. **Character Sheet Editor Flow (MPI-1041)** - its prompt goes through the Enhancer, so gate 3
   covers it (Fabio 2026-10-10). Child ages are for films (one character at several ages), always
   dressed. An age slider (Off, 1-100 years) is optional; if built, below 18 it forces fully
   clothed wording.

## The rule (AGREED with Fabio 2026-10-10 - his 16 / 18 split + the agent's framing limits)

Fabio: films are full of teenagers at pool parties, swim class and beach parties - a blanket
under-18 swimwear ban cuts ordinary scenes. Agreed rule for what MCP / Cosmo / the Enhancer write:

| asked age | rule |
|---|---|
| any age under 18 | never nudity, underwear or lingerie; never sexual or suggestive wording; never an NSFW model or NSFW LoRA |
| 16-17 | ~~swimwear incl. bikinis ONLY in a scene, never on a character sheet~~ ordinary swimwear, a bikini included, anywhere (a character sheet too); never revealing (monokini, micro / thong bikini) |
| under 16 | fully dressed only ("no bikinis below 16") |

**Corrected by Fabio later the same day:** "A 17-year-old in a bikini is fine. We talked about this.
It just can't be suggestive, like a monokini." The scene / sheet limits were the agent's framing,
never his; they are gone from the code (MPI-1056 validation.md).

## Research

- One shared rule (a term list + an age-under-18 parse) that MCP, Cosmo and the Enhancer all call,
  rather than three copies.
- Where each refusal sits in the code path, and what the user / agent sees when it fires.
- False positives to avoid: an adult described as "young", "girl" for an adult woman, a child
  character in an ordinary dressed scene.

## Out of scope (by decision)

- The prompt the user types into the prompt box themselves, and the images that come back, are
  not checked.

## Noticed
