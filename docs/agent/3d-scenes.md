# 3D Scenes

A 360 panorama the user can step INTO: fly around inside it, lay a camera path through it, render
that path as a 360 video, then stop on any frame and take a clean picture from any angle and lens.
The point is exact camera control over a place: behind the house, up the tree, through the window.

You cannot run any of this yourself, and you never need to: no tool converts, lays a path, renders
it or takes a picture. When the user asks what it is or how to use it, EXPLAIN, step by step, in
these words. The panorama itself you CAN make: the 360 Panorama Flow (read app:flows).

## The pieces, in order

1. **A 360 panorama** - a flat picture exactly twice as wide as tall (2:1). The 360 Panorama
   Flow makes one from words or from a picture; the user's own 2:1 panorama works too.
2. **Convert to 360 pano** - right-click the panorama's card in the gallery. It turns it into a
   3D scene on a NEW card (the original stays an ordinary picture they can still edit and convert
   again). It runs in the queue and takes a minute or two. The new card wears a cube badge;
   left-clicking it opens the **3D Scene workspace** instead of the picture view.
3. **The 3D Scene workspace** - the scene fills the screen, with a panel at the side.
4. **A camera path** - points laid in the scene, rendered into a short **360 video**.
5. **The 360 player** - where that video plays, and where pictures are taken.

The menu item only appears on a still that is exactly 2:1: the app cannot tell a panorama from a
wide banner, so it offers and the user decides.

## Moving around the scene

- **W / A / S / D** move, **Q / E** go down / up, **Z / C** roll. Hold **Shift** to move faster.
- **Drag** to look around.
- **Up / Down** (or the Lens slider) change the lens, 12 to 85 mm: lower sees wider.
- **Reset view** goes back to where the panorama was taken, looking ahead.

The further the camera moves from where the panorama was taken, the more gaps and stretched
patches show: the scene only knows what that one spot could see. Rendering a path repaints those.

## Laying a path (the Path section)

- **P** or **Add point** drops a point where the camera is. The path always starts at the spot
  the panorama was taken from. Points show as balls joined by a tube, only on screen.
- The **minus** button beside it removes the last point; the **bin** clears the whole path.
- **Steer the video** is an optional line saying what the path walks into ("a market square
  opening up ahead"). Empty continues the scene as it is.
- **Render path** turns the path into a 5-second 360 video. It is a long GPU job (around half an
  hour on a mid-range card; the panel shows the estimate) and lands as a new video card. A long
  path gets a warning: the camera moves fast and the video may smear, so a shorter path renders
  cleaner. The warning never blocks it.

Render path needs the **3D Scene path video** add-on (about 20 GB) and Convert needs **3D
Scene**; both install from the Model Library, under Plugins. The app says so if one is missing.

## Taking pictures (the 360 player)

Left-click the path video's card: it opens in the 360 player.

- **Space** plays / pauses; **Left / Right** step one frame; the slider picks the frame.
- **Drag** to look anywhere around the camera, even behind it; the view follows the path's turns.
- **Frame** picks the picture's shape (16:9, 9:16, 1:1, 2.39:1); the frame on screen shows
  exactly what the picture will hold. **Lens** works as in the scene.
- **Take picture** cleans up that view and saves it as a NEW image card in the gallery. The
  result is a clean picture of about 1 megapixel; upscale it afterwards for a bigger one.

## A 360 video the user already has

Right-click a video card that is exactly 2:1 and choose **Convert to 360 video**. Nothing is
generated: the card simply opens in the 360 player from then on, so they can look around it and
take pictures exactly as above.

## What to tell the user when

- "What is this workspace?" - they are in a 3D scene: say what it is for (one line from the top),
  then the controls they need next. Do not unload every section at once.
- "What are these balls / this tube?" - the camera path: Add point, Render path, the video.
- "How do I get pictures out?" - render the path, open the video card, Take picture.
- A wish to make a new place - offer the 360 Panorama Flow, then Convert to 360 pano.
