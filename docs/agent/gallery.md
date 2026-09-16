# Gallery

Where a project's media lives and what the user can do from there. The page with
screenshots is https://docs.cubric.studio/#/vision/gallery — link it, never paste it.

## Where it is

- The Gallery is the **default workspace once a project is open**. Every generated
  group and every imported file is a card on it.
- The Prompt Box sits at the bottom. A generation started there lands here as a new
  card.
- To find a file on disk, right-click its card → **Open in file system**. Do not guess
  a path.

## Finding things

- **Newest** / **Oldest** set the order. **All**, **Images**, **Videos**, **Audio**,
  **Previews** and **Favs** filter the grid.
- The size slider above the grid, or **+** / **-**, resizes the cards.
  **Ctrl/Cmd +** / **-** zooms the whole interface instead. Both are remembered.
- **I** toggles info mode: each card shows its model, operation, name, dimensions
  and duration. Hovering a card hides its labels so the frame is visible.
- **F** toggles focus mode, which hides the app chrome. **Esc** leaves it.
- Hovering a video or audio card plays it at the hover-volume slider's level. Zero
  is mute.

## Opening a card

A plain click opens the card's **history**. That is where image and video work
continues; the Gallery is for choosing.

## Selecting

- **Ctrl/Cmd-click** enters selection mode: the Prompt Box hides and selected cards
  get numbered badges in click order.
- A click toggles a card, **Shift-click** selects a range, **Esc** clears.
- While selecting, a plain click never opens history.

## The right-click menu

| Item | Works on |
|---|---|
| **Compare** | exactly two cards: image + image, image + video, or video + video |
| **Combine** | two or more videos, joined in selection order |
| **Add to project** | copies the selection into another project |
| **Rename**, **Card notes** | label or annotate a card; both persist |
| **Open in file system** | reveals the file |
| **Archive** / **Return to gallery** | moves cards out of the main gallery, or back |
| **Describe image** | one image only; the description lands in the Prompt Box, ready to edit |
| **Download** | saves the selected cards |
| **Delete** | removes the cards **and every history entry under them**. Only the user deletes: you have no tool for it, so point them here |

## Dragging

- Onto the Prompt Box: the card becomes an input. Into a folder: it is saved there.
- **Alt-drag** hands over a real file, for apps that ignore a plain drag (Discord,
  Photoshop, a browser upload box). Alt-dragging one of several selected cards drags
  them all. A card still generating has no file yet and cannot be dragged this way.
