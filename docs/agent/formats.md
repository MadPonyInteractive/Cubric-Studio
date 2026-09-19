# Shapes, styles and quality

What a request implies about the SETTINGS, when the user named an outcome rather than a number.
Read this when someone asks for a picture "for Instagram", "for a thumbnail", "in anime style",
or anything else that implies a shape or a look without naming the setting.

Every value below still has to exist in the op's own `params` — call `describe_model` and use
what it lists. Where a platform's real shape is not one we offer, the nearest one we do is named
here and there is no closer option to hunt for.

## Shapes

| The user says | Ratio | Note |
|---|---|---|
| Instagram post, Instagram feed | `4:5` | The tallest the feed shows. NOT `3:4`. |
| Instagram square | `1:1` | |
| Instagram story, reel, TikTok, Shorts | `9:16` | |
| YouTube thumbnail, YouTube video | `16:9` | |
| X / Twitter post | `16:9` | |
| Facebook feed, LinkedIn post | `4:5` | `1:1` is also correct; ask only if it matters. |
| Pinterest | `5:8` | Pinterest is 2:3; `5:8` is the nearest we offer. |
| Phone wallpaper | `9:16` | |
| Desktop wallpaper | `16:9` | |
| Print, poster | `4:5` | |

Landscape and portrait are the same list flipped: `16:9` is the landscape of `9:16`.

When the user names no shape and no platform, **send no ratio at all** — the project keeps the
one the user set in the box, and that is the one they want.

## Styles

A model with a style rack lists it as `params.styles`, and `styleSelect` takes either the index
or the label itself (`"Retro Anime"`). Reach for one when the user names a LOOK the rack already
has — anime, sketch, watercolour, cartoon, vintage. Krea 2 carries `Retro Anime`, `Soft Water
Color`, `Kids Drawing`, `Vintage Tarot` and `MidJourney` among others; Chroma carries `Anime`,
`B&W Sketch` and `Brushwork`.

Do not reach for a style to "improve" an ordinary request. A photo-real prompt wants no style,
and index `0` is `None` on every rack. If the user asks for a look the rack does not have, write
it into the prompt instead and leave `styleSelect` alone.

## Quality

Send no `qualityTier` unless the user asked for more detail. The project's own setting applies,
which is `1k` on a fresh Krea 2 — the right starting point, the same way video starts at medium.
`2k` costs noticeably more time and VRAM for a difference that does not show on a cartoon, an
anime frame or a social post. When the user looks at a result and wants it sharper or larger,
that is when `2k` is worth sending.

The same goes for `turbo` and `stylization`: they are the user's settings, not yours. Leave them
out and they keep whatever the user chose in the box.
