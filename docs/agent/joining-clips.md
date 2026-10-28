# Joining clips
Covers: a clip the user will join to others: a scene before, after or in between clips, one long video from several.

Read this whenever the new clip sits before, after or between clips the user already has, in
any words: "a pre-scene for this video", "the lead-up", "a scene before this one", "what happens
next", "something in between these two", "I'll make them one long video". The user does not have
to say join: a clip placed next to another one is cut to it, so it is a join, never a stand-alone
lead-in. Only real frames meet cleanly at a cut, so a join is always
image-to-video with frames, never a reference op: a reference op only tries to open or close on a
picture, and a miss shows at the cut.

## Which frames

| The new clip | `startFrame` | `endFrame` |
|---|---|---|
| Leads INTO clip B (a scene before it) | none (below) | clip B, sent as a picture |
| FOLLOWS clip A (what happens next) | clip A with `frame: "last"` | none, or the shot after the change |
| Goes BETWEEN clip A and clip B | clip A with `frame: "last"` | clip B, sent as a picture |

- A clip in a picture slot is its first frame (the picture it was made from when it has one), so
  clip B goes in `endFrame` as it is. `frame: "last"` on a media item sends a clip's last frame
  instead. You never need the user to snapshot either end.
- The ends come from the clips, never from the user's words: "these two videos" are A and B in
  the order the user gives them, or the order they were made when they give none.

## Upscale a frame taken from a clip

A frame decoded from a video is soft and carries its compression. Before it goes in a frame
slot, run the `imageUpscale` tool on the clip (with `frame: "last"` for its last frame):
`upscaler` `4x-NMKD-Siax` for a realistic picture, `4x-AnimeSharp` for anime, cartoon or flat
art, factor 2. Then send the upscaled card as the frame. Never repaint or edit the frame:
the cut only meets cleanly on the clip's own picture.

The one exception: clip B's FIRST frame when list_cards shows it was made from a picture. Send
clip B as it is: the app sends that original picture, already sharper than any decoded frame.

## A scene before a clip: the end frame alone

A clip leading into another runs on `i2v_ms` with clip B in `endFrame` and NO `startFrame`.
The model builds the shot up to B's first frame from the prompt; you never make a start
picture for it. Only when the user hands you a picture to open on does it go in `startFrame`.
Ask for 3 seconds or more: a shorter clip has no room to travel toward its last frame and
looks like it starts on it.

## Fill the gap

The user rarely says what has to happen between the two frames; working it out is your job.
Look at both ends and write the event that turns the first into the last, in screen time, so
the clip lands on the joined frame. Two girls chatting in a calm car park ending on a fireball
behind them: two cars collide behind them and burst into flames in the last seconds, and they
turn toward it. Then the user's own ask (a line of dialogue, a mood) on top. An event the user
names that the joined clip already shows ("then the car crash happens" before a clip of the
crash) is where the new clip ENDS: build up to it and land on clip B's FIRST frame, sent as it
is, never with `frame: "last"` (that is where B finishes, past the event), and never stage a
second one inside the new clip. Write the motion
between the frames, never a description of either picture: the frames already show them.

## Which model

- Stay in the family the joined clips were made with: their look, motion and sound match. The
  H3 family is H3 Reference, Singularity H3 and MiniMax H3; only MiniMax H3 has frame slots, so
  an H3 clip joins on `minimax-h3` `i2v_ms`. A model the user named for an earlier clip held for
  that clip, not for this one.
- That family has no op with an `endFrame` installed: take another installed op that has one
  (describe_model lists its media roles; LTX 2.3 and Wan 2.2 do) and say in one line the join
  may not match the other clips' look, or offer to install the family's frame model.
- Nothing installed has an `endFrame`: say so and offer install_model.
- Match the joined clips' ratio and quality tier, and their Fast Motion when the gap is fast.

## Keyframes

There is no keyframe tool yet. Until there is, a clip longer than one model run is several
joined clips made this way.
