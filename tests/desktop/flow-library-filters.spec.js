const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-754 — the Flow Library header: Media + Type tags and a search from the shared
 * `MpiFilterBar` Primitive, and an installed count over ALL flows.
 *
 * WHY THIS NEEDS A REAL RENDERER. The bar's `setup()` — click delegation, the input
 * listener, the silent setters and `destroy()` — had never run anywhere when this card
 * shipped it: the repo has no DOM harness (tests/model-library-preview-cache.test.cjs
 * says why). So this drives the bar's own DOM — a real `.click()` on a tag, a real
 * `input` event on the field — and reads its `mpifilterbar:change` payload as it bubbles,
 * rather than asserting on tile counts alone.
 *
 * The expected sets come from `js/data/flowsRegistry.js`'s `type` + `mediaType`
 * mapping (approved 2026-09-14). Adding a flow of one of these kinds changes a count
 * here on purpose — update the number, the mapping is the thing under test.
 *
 * It also pins the preview cache: a search keystroke rebuilds every sheet, and the
 * Upscale Video tile has to get back the SAME decoded <img>, or the grid blanks per
 * letter typed (the Model Library's MPI-394 bug, which the Flow Library had no cache for).
 */
test.setTimeout(90000);

test('Flow Library filters, search and count compose, persist, and tear down', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);

  try {
    await window.waitForTimeout(6000);

    const r = await window.evaluate(async () => {
      const { MpiFlowLibrary } = await import(
        '/js/components/Organisms/MpiFlowLibrary/MpiFlowLibrary.js');
      const { listFlows } = await import('/js/data/flowsRegistry.js');

      const lib = MpiFlowLibrary.mount(document.createElement('div'));
      window.__mpi754lib = lib;
      const root = lib.el;
      const bar = root.querySelector('.mpi-filter-bar');
      if (!bar) throw new Error('no .mpi-filter-bar in the Flow Library head');

      const payloads = [];
      const onChange = e => payloads.push(e.detail);
      bar.addEventListener('mpifilterbar:change', onChange);

      const tiles = () => [...root.querySelectorAll('.mpi-tile')].map(t => t.textContent);
      const has = (list, title) => list.some(t => t.includes(title));
      const tag = (group, value) =>
        root.querySelector(`.mpi-filter-bar__tag[data-group="${group}"][data-value="${value}"]`);
      const input = root.querySelector('.mpi-filter-bar__search-input');
      const search = (q) => {
        input.value = q;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const empty = () => root.querySelector('.mpi-flow-library__empty')?.textContent || null;
      const sub = () => root.querySelector('#flow-lib-sub').textContent;

      lib.el.open();
      const out = {};
      // The grid is two kinds of tile, not one (MPI-831 phase 4): every installable Flow,
      // plus an advert tile for each paid Flow the user has not bought. `listFlows()` is
      // the INSTALLABLE registry and never knew about the second kind, so counting it
      // alone made the unfiltered grid look two tiles too big the moment the paid tiles
      // shipped. The adverts are real grid members — they carry a media flag and they
      // answer the filters — so they belong in the total rather than out of the selector.
      out.paidAds = root.querySelectorAll('.mpi-tile__chip--purchase').length;
      out.total = listFlows().length + out.paidAds;
      out.unfiltered = tiles().length;
      out.subBefore = sub();
      out.countEl = root.querySelector('.mpi-flow-library__count')?.textContent || null;
      out.searchFocused = document.activeElement === input;

      // (1) Type = Enhance → exactly Upscale Video. Grab its <img> for the cache check.
      tag('type', 'enhance').click();
      out.enhance = tiles();
      out.enhanceSelected = tag('type', 'enhance').getAttribute('aria-selected');
      out.enhancePayload = {
        key: payloads.at(-1)?.key,
        typeIsSet: payloads.at(-1)?.active?.type instanceof Set,
        type: [...(payloads.at(-1)?.active?.type || [])],
      };
      // The payload's Set is a COPY: mutating it must not reach the bar's state.
      payloads.at(-1).active.type.add('create');
      const img = root.querySelector('.mpi-tile img');

      // (2) A keystroke that still matches rebuilds the grid — same <img> back.
      search('Upscale');
      out.sameImgAfterRebuild = !!img && root.querySelector('.mpi-tile img') === img;
      search('');
      tag('type', 'enhance').click();
      out.clearedAll = tiles().length;

      // (3) Media = Audio + Type = Create → the five audio creators. The earlier add()
      // on a payload copy must not have smuggled Create in (see step 1).
      tag('media', 'audio').click();
      out.audioOnly = tiles().length;
      tag('type', 'create').click();
      out.audioCreate = tiles();

      // (4) Close + reopen → selections still applied, tags still lit.
      lib.el.close();
      lib.el.open();
      out.reopened = tiles();
      out.reopenedSelected = [
        tag('media', 'audio').getAttribute('aria-selected'),
        tag('type', 'create').getAttribute('aria-selected'),
      ];
      out.subFiltered = sub();
      tag('media', 'audio').click();
      tag('type', 'create').click();

      // (5) Search with no tags — raw, padded, mixed case; payload is trimmed + lowercased.
      search('  VOICE ');
      out.voice = tiles();
      out.voicePayload = { key: payloads.at(-1)?.key, query: payloads.at(-1)?.query };

      // (6) Nonsense → the no-match message, and no tiles.
      search('zzqx-no-such-flow');
      out.noMatch = { tiles: tiles().length, empty: empty() };
      search('');
      out.restored = { tiles: tiles().length, empty: empty() };

      // (7) The setters are silent: DOM updates, no 'change' event.
      const before = payloads.length;
      bar.setActive('media', ['video']);
      bar.setQuery('  Hello ');
      out.setters = {
        emitted: payloads.length - before,
        videoSelected: tag('media', 'video').getAttribute('aria-selected'),
        inputValue: input.value,
      };
      bar.setActive('media', []);
      bar.setQuery('');

      // (8) destroy() unbinds: a click and an input after it emit nothing.
      lib.el.destroy();
      const afterDestroy = payloads.length;
      tag('type', 'edit')?.click();
      input.value = 'x';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      out.emittedAfterDestroy = payloads.length - afterDestroy;
      bar.removeEventListener('mpifilterbar:change', onChange);
      window.__mpi754lib = null;
      return out;
    });

    expect(r.unfiltered, 'no filter = every flow, plus an advert per unbought paid Flow').toBe(r.total);
    // The adverts are the point of MPI-831: if they ever stop rendering, the two Flows we
    // sell vanish from the library silently and this spec would still pass on 13 === 13.
    expect(r.paidAds, 'the paid Flow adverts must be on the unfiltered grid').toBeGreaterThan(0);
    expect(r.countEl, 'the count is the accented span').toMatch(/^\d+ installed$/);
    expect(r.subBefore).toMatch(/^\d+ installed · \d+ available — install a flow and its models fetch automatically\.$/);
    expect(r.searchFocused, 'search must never autofocus — it swallows Tab').toBe(false);

    expect(r.enhance, 'Type=Enhance').toHaveLength(1);
    expect(r.enhance[0]).toContain('Upscale Video');
    expect(r.enhanceSelected).toBe('true');
    expect(r.enhancePayload).toEqual({ key: 'type', typeIsSet: true, type: ['enhance'] });

    expect(r.sameImgAfterRebuild, 'a rebuild must hand back the cached <img>').toBe(true);
    expect(r.clearedAll, 'clearing every filter restores the grid').toBe(r.total);

    // MPI-781: DramaBox is a Flow package now, not a built-in; four ship in the app.
    // MPI-831 phase 4 then put DramaBox back on this grid as a PAID advert, so the filter
    // returns five: the four shipped audio Flows, plus the advert for the one you buy.
    // That it answers Media=Audio + Type=Create at all is the behaviour being pinned —
    // an advert that ignored the filters would sit in a grid it does not belong to.
    expect(r.audioCreate, 'Media=Audio + Type=Create').toHaveLength(5);
    for (const title of ['Text to Speech', 'Song', 'Sound & Music', 'Stems']) {
      expect(r.audioCreate.some(t => t.includes(title)), title).toBe(true);
    }
    expect(r.audioCreate.some(t => t.includes('DramaBox') && t.includes('Get it')),
      'the DramaBox advert answers the audio filters').toBe(true);
    expect(r.audioOnly, 'Create must not leak in from a mutated payload copy').toBeGreaterThan(r.audioCreate.length);

    expect(r.reopened, 'selections survive close + reopen').toEqual(r.audioCreate);
    expect(r.reopenedSelected).toEqual(['true', 'true']);
    expect(r.subFiltered, 'the count covers ALL flows, never the filtered view').toBe(r.subBefore);

    expect(r.voice.some(t => t.includes('Voice Changer'))).toBe(true);
    expect(r.voice.some(t => t.includes('Text to Speech'))).toBe(true);
    expect(r.voicePayload).toEqual({ key: 'search', query: 'voice' });

    expect(r.noMatch).toEqual({ tiles: 0, empty: 'No flows match — clear filters or search.' });
    expect(r.restored).toEqual({ tiles: r.total, empty: null });

    expect(r.setters).toEqual({ emitted: 0, videoSelected: 'true', inputValue: 'hello' });
    expect(r.emittedAfterDestroy, 'destroy() must unbind both listeners').toBe(0);

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await window.evaluate(() => { window.__mpi754lib?.el?.destroy?.(); }).catch(() => {});
    await closeApp(app);
  }
});
