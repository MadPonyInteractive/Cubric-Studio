/**
 * MPI-949 Phase 3b — MpiThumbStrip unit spec.
 *
 * Mounts MpiThumbStrip alone through ComponentFactory in the running app page
 * and asserts its core contracts:
 *   1. click → thumb-select event
 *   2. drag → scrub events + scrub-end on pointer up
 *   3. Ctrl-click toggle + Shift range → selection-change (with the anchor subtlety)
 *   4. right-click → ui:context-menu emitted with caller-supplied items
 *   5. destroy() removes the element and stops events
 */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

test.setTimeout(90000);

test('MpiThumbStrip: click select, scrub+end, Ctrl/Shift selection, right-click menu, destroy',
    async ({}, testInfo) => {
        const { app, window } = await launchApp(testInfo);
        try {
            const result = await window.evaluate(async () => {
                const sleep = (ms) => new Promise(r => setTimeout(r, ms));

                const [{ Events }, { MpiThumbStrip }] = await Promise.all([
                    import('/js/events.js'),
                    import('/js/components/Compounds/MpiThumbStrip/MpiThumbStrip.js'),
                ]);

                Events.emit('engine:install-skipped');
                await sleep(300);

                // ── Mount ────────────────────────────────────────────────────

                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;top:0;left:0;width:640px;height:72px;z-index:9999';
                document.body.appendChild(host);

                const menuCallItems = [
                    { key: 'remove', icon: 'trash', label: 'Remove' },
                    { key: 'info',   icon: 'info',  label: 'Info'   },
                ];

                const events = {
                    select: [], scrub: [], scrubEnd: [], sel: [], menuSel: [],
                };

                const strip = MpiThumbStrip.mount(host, {
                    menuItems: (_index, _selection) => menuCallItems,
                });

                strip.on('thumb-select',     e => events.select.push(e));
                strip.on('scrub',            e => events.scrub.push(e));
                strip.on('scrub-end',        e => events.scrubEnd.push(e));
                strip.on('selection-change', e => events.sel.push(e));
                strip.on('menu-select',      e => events.menuSel.push(e));

                const items = Array.from({ length: 5 }, (_, i) => ({
                    key: `k${i}`, thumbUrl: '', info: `Thumb ${i}`,
                }));
                strip.el.setItems(items, { currentIndex: 0 });
                await sleep(50);

                // ── 1. Click → thumb-select ───────────────────────────────────
                // setItems emits one selection-change (cleared); record the baseline count.

                const selBefore = events.sel.length;

                const t0 = document.querySelector('.mpi-thumb-strip__thumb[data-index="0"]');
                if (!t0) return { error: 'thumb 0 not found' };
                const r0 = t0.getBoundingClientRect();
                const cx0 = Math.round(r0.left + r0.width / 2);
                const cy0 = Math.round(r0.top  + r0.height / 2);

                t0.dispatchEvent(new PointerEvent('pointerdown',
                    { bubbles: true, clientX: cx0, clientY: cy0, button: 0 }));
                t0.dispatchEvent(new PointerEvent('pointerup',
                    { bubbles: true, clientX: cx0, clientY: cy0, button: 0 }));
                await sleep(20);

                const clickOk = events.select.length === 1 && events.select[0].index === 0;

                // ── 2. Drag on track → scrub events + scrub-end ──────────────
                // Dispatch pointerdown on the root element itself (target = .mpi-thumb-strip,
                // not a .mpi-thumb-strip__thumb child) so closest() returns null → mode 'scrub'.

                const trackEl = document.querySelector('.mpi-thumb-strip');
                const tr = trackEl.getBoundingClientRect();
                const startX = Math.round(tr.left + tr.width / 2);
                const startY = Math.round(tr.top  + tr.height / 2);

                trackEl.dispatchEvent(new PointerEvent('pointerdown',
                    { bubbles: true, clientX: startX, clientY: startY, button: 0 }));
                // Move > DRAG_THRESHOLD (4px) to trigger scrub.
                window.dispatchEvent(new PointerEvent('pointermove',
                    { bubbles: true, clientX: startX + 10, clientY: startY }));
                window.dispatchEvent(new PointerEvent('pointermove',
                    { bubbles: true, clientX: startX + 20, clientY: startY }));
                window.dispatchEvent(new PointerEvent('pointerup',
                    { bubbles: true, clientX: startX + 20, clientY: startY }));
                await sleep(20);

                const scrubOk    = events.scrub.length > 0;
                const scrubEndOk = events.scrubEnd.length === 1;

                // ── 3. Ctrl toggle + Shift range ─────────────────────────────

                const selBefore2 = events.sel.length;

                // Ctrl-click thumb 1 → adds to selection.
                const t1 = document.querySelector('.mpi-thumb-strip__thumb[data-index="1"]');
                const r1 = t1.getBoundingClientRect();
                const cx1 = Math.round(r1.left + r1.width / 2);
                const cy1 = Math.round(r1.top  + r1.height / 2);

                t1.dispatchEvent(new PointerEvent('pointerdown',
                    { bubbles: true, clientX: cx1, clientY: cy1, button: 0, ctrlKey: true }));
                t1.dispatchEvent(new PointerEvent('pointerup',
                    { bubbles: true, clientX: cx1, clientY: cy1, button: 0, ctrlKey: true }));
                await sleep(20);

                // Shift-click thumb 3 → ranges 1..3 from anchor at 1.
                const t3 = document.querySelector('.mpi-thumb-strip__thumb[data-index="3"]');
                const r3 = t3.getBoundingClientRect();
                const cx3 = Math.round(r3.left + r3.width / 2);
                const cy3 = Math.round(r3.top  + r3.height / 2);

                t3.dispatchEvent(new PointerEvent('pointerdown',
                    { bubbles: true, clientX: cx3, clientY: cy3, button: 0, shiftKey: true }));
                t3.dispatchEvent(new PointerEvent('pointerup',
                    { bubbles: true, clientX: cx3, clientY: cy3, button: 0, shiftKey: true }));
                await sleep(20);

                const newSelEvents = events.sel.slice(selBefore2);
                const ctrlSelOk   = newSelEvents.length >= 1 &&
                    newSelEvents[0].indices.includes(1);
                const shiftRangeOk = newSelEvents.length >= 2 &&
                    newSelEvents[newSelEvents.length - 1].indices.length >= 3 &&
                    newSelEvents[newSelEvents.length - 1].indices.includes(1) &&
                    newSelEvents[newSelEvents.length - 1].indices.includes(3);

                // ── 4. Right-click → ui:context-menu with caller's items ──────

                let menuEmitArgs = null;
                const unsubMenu = Events.on('ui:context-menu', (args) => {
                    menuEmitArgs = args;
                });

                const t2 = document.querySelector('.mpi-thumb-strip__thumb[data-index="2"]');
                const r2 = t2.getBoundingClientRect();
                t2.dispatchEvent(new MouseEvent('contextmenu', {
                    bubbles: true,
                    clientX: Math.round(r2.left + r2.width / 2),
                    clientY: Math.round(r2.top  + r2.height / 2),
                }));
                await sleep(20);
                unsubMenu();

                const menuOk = !!menuEmitArgs &&
                    Array.isArray(menuEmitArgs.items) &&
                    menuEmitArgs.items.length === menuCallItems.length &&
                    menuEmitArgs.items[0].key === 'remove' &&
                    typeof menuEmitArgs.onSelect === 'function';

                // Verify calling the menu's onSelect fires a menu-select event.
                if (menuEmitArgs?.onSelect) menuEmitArgs.onSelect('remove');
                await sleep(10);

                const menuSelectOk = events.menuSel.length === 1 &&
                    events.menuSel[0].key === 'remove' &&
                    events.menuSel[0].index === 2;

                // ── 5. Destroy ────────────────────────────────────────────────

                const beforeDestroy = !!document.querySelector('.mpi-thumb-strip__thumb');
                strip.destroy();
                host.remove();
                await sleep(20);

                // After destroy, pointermove on window must not fire any more scrub events.
                const scrubCountBefore = events.scrub.length;
                window.dispatchEvent(new PointerEvent('pointermove',
                    { bubbles: true, clientX: 300, clientY: 36 }));
                await sleep(20);

                const destroyOk = beforeDestroy &&
                    !document.querySelector('.mpi-thumb-strip__thumb') &&
                    events.scrub.length === scrubCountBefore;

                return {
                    clickOk, scrubOk, scrubEndOk,
                    ctrlSelOk, shiftRangeOk,
                    menuOk, menuSelectOk, destroyOk,
                    // debug fields
                    selectLen: events.select.length,
                    scrubLen: events.scrub.length,
                    scrubEndLen: events.scrubEnd.length,
                    newSelEventsLen: newSelEvents.length,
                    newSelLast: newSelEvents[newSelEvents.length - 1]?.indices,
                };
            });

            expect(result?.error, 'no setup error').toBeFalsy();
            expect(result.clickOk,      'click → thumb-select').toBe(true);
            expect(result.scrubOk,      'drag → scrub events').toBe(true);
            expect(result.scrubEndOk,   'drag end → scrub-end event').toBe(true);
            expect(result.ctrlSelOk,    'Ctrl-click → selection-change with index 1').toBe(true);
            expect(result.shiftRangeOk, 'Shift-click → range selection [1..3]').toBe(true);
            expect(result.menuOk,       'right-click → ui:context-menu with caller items').toBe(true);
            expect(result.menuSelectOk, 'onSelect callback → menu-select event').toBe(true);
            expect(result.destroyOk,    'destroy removes element and stops events').toBe(true);
        } finally {
            await closeApp(app);
        }
    });
