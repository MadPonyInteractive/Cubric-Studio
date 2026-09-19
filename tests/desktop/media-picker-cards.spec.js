// MPI-693 — the media picker lists CARDS, not files.
//
// The picker used to push every entry of every group's `history`, so a card with
// 14 takes was 14 tiles captioned with raw filenames, sitting beside a gallery
// that showed one card under the name the user gave it. What these tests pin:
//
//  - one tile per ItemGroup, never one per take;
//  - the caption is the GALLERY's label — asserted against the text
//    `MpiGalleryGrid` renders for the same groups, not against a hard-coded
//    string, so the two cannot quietly drift apart later;
//  - the filter is the GALLERY's (MPI-785): the shared FILTER panel on a local
//    sort, kinding a card by its SELECTED item like the gallery does — the
//    fixture's video group holding a still is filed under Images in both — and
//    opening with every kind that cannot fill the slot hidden;
//  - a tile shows its card's mark, and the mark rows filter by it;
//  - an audio tile plays on hover and stops on leave;
//  - the mic and voice cards render only when the slot passes in the recorder and
//    voice picker (MPI-751: a Compound may not import another Compound).
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

// Electron boot (splash -> local server -> shell) runs past the 30s default.
test.setTimeout(90000);

const REPO = path.resolve(__dirname, '..', '..').replace(/\\/g, '/');
// Real shipped media, addressed the way a project item is: an absolute path that
// `resolveMediaUrl` wraps into `/project-file?path=…`. A src that 404s leaves the
// <audio> unplayable and a working fix reads as broken.
const STILL = `${REPO}/comfy_workflows/display/flow-head-swap.webp`;
// A shipped voice sample (11.1s), NOT `assets/sounds/notify.wav` — that one is
// 319ms, so it had already ENDED inside the settle after mouseenter and read as
// "hover did not play", while the leave assertion (`currentTime === 0`) passed on
// the `ended` reset whether or not mouseleave did anything. A clip long enough to
// still be playing is what makes both halves mean something; the duration is
// asserted below so a future swap cannot quietly reintroduce that.
const SOUND = `${REPO}/voices/child_1.opus`;

function item(id, type, filePath, over = {}) {
  return {
    id, type, filePath,
    thumbPath: type === 'image' ? filePath : undefined,
    pixelDimensions: { w: 1920, h: 1080 },
    name: null,
    ...over,
  };
}

/**
 * Six cards covering every branch of `_collect` and `_cardLabel`.
 *
 * `pick-named` carries three takes — the whole point of the card is that it is
 * ONE tile. `pick-mixed` is a video group whose selected take is an image, which
 * is the case that separates a `group.type` filter from an item-type one.
 */
function fixtureGroups() {
  return [
    {
      id: 'pick-named', type: 'image', name: 'named_file_stem', customName: 'Hero shot',
      createdAt: '2026-09-01T10:00:00Z', selectedIndex: 1, archived: false, favourite: 'square',
      history: [
        item('pick-named-0', 'image', STILL),
        item('pick-named-1', 'image', STILL),
        item('pick-named-2', 'image', STILL),
      ],
    },
    {
      // Two takes with the SELECTED one second, so a regression that reads
      // `history[0]` instead of `history[selectedIndex]` surfaces as the caption
      // 'wrong_take' rather than passing silently on identical entries.
      id: 'pick-derived', type: 'image', name: 'derived_file_stem', customName: null,
      createdAt: '2026-09-01T09:00:00Z', selectedIndex: 1, archived: false,
      history: [
        item('pick-derived-0', 'image', STILL, { name: 'wrong_take' }),
        item('pick-derived-1', 'image', STILL),
      ],
    },
    {
      // 'Untitled Group' is createItemGroup's default and names nothing; the file
      // does, so the caption falls through to the basename.
      id: 'pick-untitled', type: 'image', name: 'Untitled Group', customName: null,
      createdAt: '2026-09-01T08:00:00Z', selectedIndex: 0, archived: false,
      history: [item('pick-untitled-0', 'image', `${REPO}/comfy_workflows/display/flow-head-swap.webp`)],
    },
    {
      id: 'pick-archived', type: 'image', name: 'archived_stem', customName: null,
      createdAt: '2026-09-01T07:00:00Z', selectedIndex: 0, archived: true,
      history: [item('pick-archived-0', 'image', STILL)],
    },
    {
      // A pending/failed generation: a card with no file. Handing it to a Flow slot
      // would resolve to a broken URL, so it must not render.
      id: 'pick-nofile', type: 'image', name: 'nofile_stem', customName: null,
      createdAt: '2026-09-01T06:00:00Z', selectedIndex: 0, archived: false,
      history: [{ id: 'pick-nofile-0', type: 'image', filePath: null }],
    },
    {
      id: 'pick-mixed', type: 'video', name: 'mixed_stem', customName: 'Clip with a still selected',
      createdAt: '2026-09-01T05:00:00Z', selectedIndex: 0, archived: false,
      history: [item('pick-mixed-0', 'image', STILL)],
    },
  ];
}

/** Put the fixture where `_collect` reads it, and open a picker over it. */
async function openPicker(window, groups, mediaType) {
  await window.evaluate(async ({ gs, type }) => {
    const [{ MpiMediaPicker }, { state }] = await Promise.all([
      import('/js/components/Compounds/MpiMediaPicker/MpiMediaPicker.js'),
      import('/js/state.js'),
    ]);
    // hide() first: MpiModal.destroy() drops listeners but leaves a SHOWN modal in the
    // DOM, and its tiles would be counted with the next picker's.
    window.__pick?.el?.hide?.();
    window.__pick?.el?.destroy?.();
    state.currentProject = { id: 'e2e-pick', name: 'E2E Pick', itemGroups: gs, modelSettings: {} };
    const picker = MpiMediaPicker.mount(document.createElement('div'), { mediaType: type });
    picker.el.show();
    window.__pick = picker;
    await new Promise(r => setTimeout(r, 250));
  }, { gs: groups, type: mediaType });
}

/** Tile captions currently rendered, in render order. */
function captions(window) {
  return window.evaluate(() =>
    [...document.querySelectorAll('.mpi-media-picker__name')].map(el => el.textContent));
}

/**
 * Open the picker's FILTER panel (if closed) and click one row or bulk button by its
 * label. Driven in-page, not by locator. Never Escape to close it: Escape closes the
 * picker's modal too.
 */
async function panelClick(window, label) {
  return window.evaluate(async (want) => {
    if (!document.querySelector('.mpi-popup--gallery-filter')) {
      document.querySelector('.mpi-media-picker .mpi-gallery-filter__button').click();
      await new Promise(r => setTimeout(r, 150));
    }
    const target = [...document.querySelectorAll(
      '.mpi-popup--gallery-filter .mpi-gallery-filter__toggle, .mpi-popup--gallery-filter .mpi-gallery-filter__panel-bulk .mpi-btn')]
      .find(b => b.textContent.trim() === want);
    target.click();
    await new Promise(r => setTimeout(r, 200));
  }, label);
}

test('one tile per card, captioned exactly as the gallery captions it', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000); // shell boot settles
    await openPicker(window, fixtureGroups(), 'image');

    const shown = await captions(window);

    // Four of the six render: the archived card and the file-less card are both out.
    expect(shown).toHaveLength(4);
    expect(shown).toContain('Hero shot');            // customName wins
    expect(shown).toContain('derived_file_stem');    // group.name === the file stem
    expect(shown).toContain('flow-head-swap');       // 'Untitled Group' -> basename, no ext
    expect(shown).not.toContain('archived_stem');
    expect(shown).not.toContain('nofile_stem');
    // The SELECTED take, not the first one.
    expect(shown).not.toContain('wrong_take');

    // Three takes, one tile. This is the whole card, so assert the count directly
    // rather than inferring it from the total above.
    expect(shown.filter(c => c === 'Hero shot')).toHaveLength(1);

    // The captions are the gallery's, not a second naming rule that happens to
    // agree today. Mount the real grid on the same groups and compare the sets.
    //
    // `pick-untitled` is held out of the comparison because it is the ONE place the
    // two deliberately differ: the gallery renders the literal 'Untitled Group',
    // and the picker falls through to the filename, because the ask was "the title
    // the user added, else the file name" and that default is not a title anyone
    // typed. Nothing in the app writes it — only a legacy or hand-edited
    // project.json can — so every card a user can actually make is still covered.
    const galleryNames = await window.evaluate(async (gs) => {
      const { MpiGalleryGrid } = await import('/js/components/Compounds/MpiGalleryGrid/MpiGalleryGrid.js');
      const { state } = await import('/js/state.js');
      state.gallerySort = { ...(await import('/js/utils/galleryFilter.js')).DEFAULT_GALLERY_SORT };
      const host = document.createElement('div');
      host.id = 'pick-grid-host';
      host.style.cssText = 'position:fixed;top:0;left:0;width:1600px;height:900px;z-index:0;';
      document.body.appendChild(host);
      const grid = MpiGalleryGrid.mount(host, { groups: gs });
      await new Promise(r => setTimeout(r, 400));
      const names = [...host.querySelectorAll('.mpi-group-card__name')].map(el => el.textContent);
      grid.el.destroy?.();
      host.remove();
      return names;
    }, fixtureGroups().filter(g =>
      !g.archived && g.history[0].filePath && g.id !== 'pick-untitled'));

    // Non-degenerate first: an empty grid would make the comparison vacuous.
    expect(galleryNames.length).toBe(3);
    expect(shown.filter(c => c !== 'flow-head-swap').sort()).toEqual([...galleryNames].sort());
  } finally {
    await closeApp(app);
  }
});

test('the gallery filter runs on the picker, kinded by the selected item, on its own sort', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    // `pick-mixed` is `type: 'video'` with an IMAGE selected. The gallery kinds a card
    // by its selected item (MPI-749), and so does the picker now: an image slot lists it.
    await openPicker(window, fixtureGroups(), 'image');
    const images = await captions(window);
    expect(images).toHaveLength(4);
    expect(images).toContain('Clip with a still selected');

    // The mark shows on its tile, and only there.
    const marks = await window.evaluate(() => [...document.querySelectorAll('.mpi-media-picker__tile')]
      .filter(t => t.querySelector('.mpi-media-picker__mark'))
      .map(t => t.querySelector('.mpi-media-picker__name').textContent));
    expect(marks).toEqual(['Hero shot']);

    // The panel sits ABOVE the picker's modal (MpiPopup's own z-index is under it).
    await panelClick(window, 'Squares');
    expect(await captions(window)).toEqual(['Hero shot']);
    const onTop = await window.evaluate(() => {
      const row = document.querySelector('.mpi-popup--gallery-filter .mpi-gallery-filter__row');
      const r = row.getBoundingClientRect();
      return row.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(onTop).toBe(true);
    await panelClick(window, 'Squares');
    expect(await captions(window)).toHaveLength(4);

    // A video slot opens with the image kind hidden: nothing to show, and it says so.
    await openPicker(window, fixtureGroups(), 'video');
    expect(await captions(window)).toEqual([]);
    const state0 = await window.evaluate(() => ({
      empty: document.querySelector('.mpi-media-picker__empty')?.textContent,
      dot: document.querySelector('.mpi-media-picker .mpi-gallery-filter__button')
        .classList.contains('mpi-gallery-filter__button--filtered'),
    }));
    expect(state0).toEqual({ empty: 'No media matches this filter.', dot: true });

    // Widening it is the user's call, and it never touches the gallery's own sort.
    await panelClick(window, 'All');
    expect(await captions(window)).toHaveLength(4);
    const gallerySort = await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.gallerySort;
    });
    expect(gallerySort.hiddenKinds).toEqual([]);
    expect(gallerySort.marks).toEqual([]);
  } finally {
    await closeApp(app);
  }
});

test('an audio tile plays on hover and stops on leave', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    const audioGroups = [{
      id: 'pick-audio', type: 'audio', name: 'notify', customName: 'A sound',
      createdAt: '2026-09-01T10:00:00Z', selectedIndex: 0, archived: false,
      history: [item('pick-audio-0', 'audio', SOUND)],
    }];

    await window.evaluate(async () => {
      const { Storage } = await import('/js/core/storage.js');
      // 0 IS the mute and skips hover-play entirely, so the spec must not inherit a
      // muted profile from another run.
      Storage.setGalleryVolume(0.8);
    });
    await openPicker(window, audioGroups, 'audio');

    expect(await captions(window)).toEqual(['A sound']);

    const hover = async (event) => window.evaluate(async (type) => {
      const tile = document.querySelector('.mpi-media-picker__tile-media');
      tile.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      await new Promise(r => setTimeout(r, 400));
      const audio = tile.querySelector('audio');
      return audio
        ? { exists: true, paused: audio.paused, currentTime: audio.currentTime, duration: audio.duration }
        : { exists: false };
    }, event);

    // Built on the first hover, not with the tile — so its absence beforehand is
    // part of the contract, not an accident of timing.
    const before = await window.evaluate(() =>
      !!document.querySelector('.mpi-media-picker__tile-media audio'));
    expect(before).toBe(false);

    const playing = await hover('mouseenter');
    expect(playing.exists).toBe(true);
    // Non-degenerate first: a clip shorter than the settle above would end on its
    // own and make BOTH of the assertions around it pass against a broken hover.
    expect(playing.duration).toBeGreaterThan(2);
    expect(playing.paused).toBe(false);

    const stopped = await hover('mouseleave');
    expect(stopped.paused).toBe(true);
    expect(stopped.currentTime).toBe(0);
  } finally {
    await closeApp(app);
  }
});

test('the mic and voice cards render only when the slot hands their components in', async ({}, testInfo) => {
  const { app, window } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    // MpiMediaPicker is a Compound and may not import MpiAudioRecorder or
    // MpiVoicePicker (also Compounds), so MpiBaseFlow passes them as props.
    const open = (withProps) => window.evaluate(async (wp) => {
      const [{ MpiMediaPicker }, { MpiVoicePicker }, { recordAudioIntoProject }, { state }] = await Promise.all([
        import('/js/components/Compounds/MpiMediaPicker/MpiMediaPicker.js'),
        import('/js/components/Compounds/MpiVoicePicker/MpiVoicePicker.js'),
        import('/js/components/Blocks/MpiAudioRecorder/MpiAudioRecorder.js'),
        import('/js/state.js'),
      ]);
      window.__pick?.el?.destroy?.();
      state.currentProject = { id: 'e2e-pick', name: 'E2E Pick', itemGroups: [], modelSettings: {} };
      const picker = MpiMediaPicker.mount(document.createElement('div'), {
        mediaType: 'audio',
        voiceRoute: 'character',
        onImport: () => {},
        ...(wp ? { recordAudio: recordAudioIntoProject, voicePicker: MpiVoicePicker } : {}),
      });
      picker.el.show();
      window.__pick = picker;
      await new Promise(r => setTimeout(r, 250));
      return {
        mic: !!document.querySelector('.mpi-media-picker__tile--mic'),
        voice: !!document.querySelector('.mpi-media-picker__tile--voice'),
      };
    }, withProps);

    // Without the props a card would be a dead button, so neither renders.
    expect(await open(false)).toEqual({ mic: false, voice: false });
    expect(await open(true)).toEqual({ mic: true, voice: true });

    // The voice card mounts the component it was handed, not an import.
    const mounted = await window.evaluate(async () => {
      document.querySelector('.mpi-media-picker__tile--voice').click();
      for (let i = 0; i < 40 && !document.querySelector('.mpi-voice-picker'); i++) {
        await new Promise(r => setTimeout(r, 100));
      }
      return !!document.querySelector('.mpi-media-picker__voice .mpi-voice-picker');
    });
    expect(mounted).toBe(true);
  } finally {
    await closeApp(app);
  }
});
