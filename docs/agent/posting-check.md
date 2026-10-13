# Posting check

Read this when the user asks whether a picture or clip is safe to post, where they can post
it, whether it is "too much for Instagram", or how suggestive it is. You look at it, rate it,
and say where it can go. You never post anything yourself.

## The look

One `look` per picture, with exactly this question:

```text
Answer in five lines, each line its label and ONE word from its options.
SKIN: covered / partial / nude
EXPOSED: none / cleavage / buttocks / nipples / genitals
POSE: neutral / suggestive / sexual
CAMERA: neutral / suggestive
AGE: adult / unsure / under18
CAMERA is suggestive when the shot is aimed at the chest, the crotch or the buttocks, or looks up a skirt. AGE asks: does anyone shown look like they are, or could be, under 18?
```

A clip or a GIF goes through the same `look`: it is sampled into one contact sheet, so the
answer covers every frame on it. Several pictures = one `look` each; rate each one alone.

A line of preamble before the five ("Here's a breakdown...") is normal: read the labels. If the
look fails, or any label is missing or answered with a word outside its options (a refusal,
a description instead), the check did not run: say so, say the describer may not answer about
explicit pictures, and give no verdict. Never guess one.

## The verdict: the first row that matches wins

| The answer has | Verdict | Where it can go |
|---|---|---|
| AGE `under18` or `unsure`, AND anything but `covered` / `none` / `neutral` / `neutral` | **Reads under 18** | Nowhere |
| POSE `sexual`, or SKIN `nude`, or EXPOSED `nipples` / `genitals` | **Explicit** | Adult sites that allow it, marked as adult |
| POSE or CAMERA `suggestive`, or SKIN `partial`, or EXPOSED `cleavage` / `buttocks` | **Suggestive** | Sites that allow suggestive work. Instagram, Facebook and TikTok may hide, limit or remove it |
| everything else | **Safe** | Anywhere, Instagram included |

A dressed, neutral picture of someone who looks young is **Safe**: the first row is about a
young-looking person shown exposed, suggestive or sexual, not about youth alone.

## Saying it

- One line: the verdict and where it can go. Then the lines that decided it, in plain words
  ("the camera looks up the skirt", "the buttocks show"), so the user knows what to change.
- **Reads under 18:** say it should not be posted anywhere, an adult site included, and what
  makes the person read young: a school uniform, a classroom, a round, small face, twintails or
  braids. Offer the adult version, built the way `guide:illustrious` / `guide:pony`
  § "Keeping an adult reading as an adult" says, on the model that made it. Never say it is
  fine because it is anime or because the prompt said 18: sites and the law judge what the
  picture shows. Never help the same young-looking picture pass a check.
- **Suggestive:** say which line would trip Instagram, and offer the change that would make it
  Safe (a neutral camera, more cover) when the user wants it there.
- Always end on: this is a guide, not a ruling; every site has its own rules, they change, and
  the site's own check has the last word.

## Cost

Each `look` is one call to the user's describer, the same one the app's own safety check uses.
Rating a set of pictures costs one call each: on a paid describer, say how many before you start
when it is more than a handful.
