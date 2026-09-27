// MPI-948 (MPI-941 Phase 2) — a dragged gallery SELECTION reaches the agent as ONE set.
//
// Fabio watched the photographer tester select several cards and drag them onto the agent
// box: the drag carried only the card under the pointer, so he thought the agent got 10 and
// it got 1. Two halves, one launch:
//   1. the grid's plain dragstart on a SELECTED card adds the selection as `cards`, in click
//      order, and leaves the dragged card's own fields alone for every other drop target;
//   2. the real agent panel turns that payload into ONE chip, "3 cards", and sends ONE set.
// The halves are fed separately: the grid's fixture stills are shipped files, not
// `/project-file` paths, and a card with no project file is exactly what `cardReference`
// refuses to hand over.
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

const STILL = '/comfy_workflows/display/boogu-edit-balanced.webp';
const IDS = ['set-1', 'set-2', 'set-3', 'set-4'];

/** Ctrl-click every id (a toggle), in order. */
async function ctrlClick(window, ids) {
  await window.evaluate(async (groupIds) => {
    for (const id of groupIds) {
      document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${id}"] .mpi-group-card`)
        .dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    }
    await new Promise(r => setTimeout(r, 150));
  }, ids);
}

/** Start a plain drag on one card and return what it wrote to `application/mpi-media`. */
function dragPayload(window, id) {
  return window.evaluate((groupId) => {
    const dt = new DataTransfer();
    document.querySelector(`.mpi-gallery-grid__row-wrap[data-group-id="${groupId}"] img.mpi-group-card__thumb`)
      .dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true, cancelable: true }));
    return JSON.parse(dt.getData('application/mpi-media'));
  }, id);
}

test('a drag from a selection carries every selected card, and the agent panel makes it ONE set', async ({}, testInfo) => {
  const { app, window, pageErrors } = await launchApp(testInfo);
  try {
    await window.evaluate(async () => {
      localStorage.setItem('mpi_maturity_acknowledged', 'true');
      const { Events } = await import('/js/events.js');
      Events.emit('engine:install-skipped');
      await new Promise(r => setTimeout(r, 300));
    });

    const folderPath = testInfo.outputPath('project').replace(/\\/g, '/');
    fs.mkdirSync(folderPath, { recursive: true });
    const itemGroups = IDS.map((id) => ({
      id, type: 'image', name: id, selectedIndex: 0,
      history: [{ id: `${id}-item`, type: 'image', filePath: STILL, thumbPath: STILL, pixelDimensions: { w: 1024, h: 1024 } }],
    }));
    const project = { id: 'e2e-drag-set', name: 'E2E drag set', modelSettings: {}, itemGroups };
    fs.writeFileSync(path.join(folderPath, 'project.json'), JSON.stringify(project, null, 2));

    await window.evaluate(async (p) => {
      const [{ state }, { navigate, PAGE_GALLERY }] = await Promise.all([import('/js/state.js'), import('/js/router.js')]);
      state.currentProject = p;
      navigate(PAGE_GALLERY);
      await new Promise(r => setTimeout(r, 1000));
    }, { ...project, folderPath });
    await expect(window.locator('.mpi-gallery-grid__row-wrap')).toHaveCount(4, { timeout: 10000 });

    // ── 1. The grid ────────────────────────────────────────────────────────
    const lone = await dragPayload(window, 'set-2');
    expect(lone.groupId).toBe('set-2');
    expect(lone.cards).toBeUndefined(); // nothing selected: one card, exactly as before

    await ctrlClick(window, ['set-3', 'set-1', 'set-4']);
    const fromSelection = await dragPayload(window, 'set-1');
    expect(fromSelection.groupId).toBe('set-1'); // the dragged card's own fields are unchanged
    expect(fromSelection.cards.map(c => c.groupId)).toEqual(['set-3', 'set-1', 'set-4']); // click order
    expect(fromSelection.cards[0]).toMatchObject({ itemId: 'set-3-item', filePath: STILL, type: 'image' });

    const outside = await dragPayload(window, 'set-2');
    expect(outside.cards).toBeUndefined(); // a card OUTSIDE the selection drags alone

    // ── 2. The agent panel ─────────────────────────────────────────────────
    await window.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.agentMode = true;
      window.__sent = [];
      const real = window.fetch;
      window.fetch = async (url, opts) => {
        if (url !== '/agent/message') return real(url, opts);
        const body = JSON.parse(opts.body);
        window.__sent.push(body);
        return { ok: true, json: async () => ({ ok: true, turnId: 't1', session: body.project?.folderPath || '', attachments: [] }) };
      };
    });
    await window.waitForTimeout(600); // the panel's width transition

    await window.evaluate((folder) => {
      const card = (n) => ({ groupId: `set-${n}`, itemId: `set-${n}-item`, type: 'image', name: `set-${n}`,
        filePath: `/project-file?path=${encodeURIComponent(`${folder}/Media/set_${n}.png`)}` });
      const dt = new DataTransfer();
      dt.setData('application/mpi-media', JSON.stringify({ ...card(1), cards: [card(3), card(1), card(4)] }));
      document.querySelector('#agent-panel-mount .mpi-agent-chat')
        .dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    }, folderPath);

    const pending = window.locator('#agent-panel-mount .mpi-agent-chat__input-row .mpi-agent-chat__attachment');
    await expect(pending).toHaveCount(1);
    await expect(pending).toHaveClass(/mpi-agent-chat__attachment--set/);
    await expect(pending.locator('.mpi-agent-chat__attachment-count')).toHaveText('3 cards');
    await expect(pending.locator('.mpi-agent-chat__attachment-num')).toHaveText('1');
    // One chip must not scroll: from a content-sized basis the field shared the overflow with
    // the strip, which lost 2px of a 102px chip and grew a scrollbar under it.
    const strip = await window.evaluate(() => {
      const s = document.querySelector('#agent-panel-mount .mpi-agent-chat__input-row .mpi-agent-chat__attachments');
      return { scrollWidth: s.scrollWidth, clientWidth: s.clientWidth };
    });
    expect(strip.scrollWidth).toBeLessThanOrEqual(strip.clientWidth);

    const field = window.locator('#agent-panel-mount textarea');
    await field.click();
    await window.keyboard.type('upscale these');
    await window.keyboard.press('Enter');
    await expect.poll(() => window.evaluate(() => window.__sent.length)).toBe(1);

    const [body] = await window.evaluate(() => window.__sent);
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0].count).toBe(3);
    expect(body.attachments[0].set.map(c => c.groupId)).toEqual(['set-3', 'set-1', 'set-4']);
    expect(body.attachments[0].set.every(c => c.url.startsWith('/project-file?path='))).toBe(true);

    // The sent bubble keeps the same one chip.
    const inBubble = window.locator('#agent-panel-mount .mpi-agent-chat__attachments--in-bubble .mpi-agent-chat__attachment--set');
    await expect(inBubble).toHaveCount(1);
    await expect(inBubble.locator('.mpi-agent-chat__attachment-count')).toHaveText('3 cards');

    expect(pageErrors, `page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
  } finally {
    await closeApp(app);
  }
});
