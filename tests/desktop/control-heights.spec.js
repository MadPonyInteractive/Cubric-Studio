const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('./launch');

/**
 * MPI-822 — one height per control size, whatever the control holds.
 *
 * A control's height used to fall out of its content. A text `md` MpiButton came to
 * 47px (a 13px line box) and the same size holding an icon came to 50px (a 20px
 * glyph box), so any row pairing the two was 3-4px out: sm 31 vs 34, md 47 vs 50,
 * lg 58 vs 62. Fabio, after meeting it twice in one flow: "it happens too often".
 *
 * `--control-h-sm|md|lg` (styles/01_base.css) is now the single answer, applied as a
 * `min-height` per size. This spec is the guard on it: it fails if a new variant
 * arrives at its own height, and it fails if the tokens and MpiButton drift apart.
 */
const SIZES = [
    ['sm', '--control-h-sm'],
    ['md', '--control-h-md'],
    ['lg', '--control-h-lg'],
];

test('every MpiButton variant is exactly its size token, and the flow model row is flush',
    async ({}, testInfo) => {
        const { app, window } = await launchApp(testInfo);

        try {
            const out = await window.evaluate(async (sizes) => {
                const { MpiButton } = await import('/js/components/Primitives/MpiButton/MpiButton.js');
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;top:0;left:0;width:300px';
                document.body.appendChild(host);

                const h = (node) => +node.getBoundingClientRect().height.toFixed(1);
                const token = (name) => parseFloat(
                    getComputedStyle(document.documentElement).getPropertyValue(name));

                const bySize = {};
                for (const [size, varName] of sizes) {
                    const mk = (props) => {
                        const inst = MpiButton.mount(document.createElement('div'), { ...props, size });
                        host.appendChild(inst.el);
                        return h(inst.el);
                    };
                    bySize[size] = {
                        token: token(varName),
                        text: mk({ text: 'Text' }),
                        icon: mk({ icon: 'stop' }),
                        iconText: mk({ icon: 'stop', label: 'Both' }),
                    };
                }

                // The real model row MpiBaseFlow builds: a boxed model name (39px, its own
                // padding scale — NOT a button size) and the cogwheel that annotates it.
                const pick = document.createElement('div');
                pick.className = 'mpi-base-flow__model-pick';
                const name = document.createElement('span');
                name.className = 'mpi-base-flow__model-name';
                name.textContent = 'Krea 2';
                const cogHost = document.createElement('div');
                cogHost.className = 'mpi-base-flow__model-cog-host';
                pick.appendChild(name);
                pick.appendChild(cogHost);
                host.appendChild(pick);
                const cog = MpiButton.mount(cogHost, {
                    icon: 'settings', size: 'sm', extraClasses: 'mpi-base-flow__model-cog',
                });
                await new Promise(r => setTimeout(r, 300));

                const nameBox = name.getBoundingClientRect();
                const cogBox = cog.el.getBoundingClientRect();

                // The cog stretches to the field, so the field must keep its ellipsis —
                // making its box a flex container would silently kill it.
                name.textContent = 'A model name far too long for a 236px column';
                const ellipsis = {
                    textOverflow: getComputedStyle(name).textOverflow,
                    clipped: name.scrollWidth > name.clientWidth,
                };

                host.remove();
                return {
                    bySize,
                    row: {
                        nameH: +nameBox.height.toFixed(1), cogH: +cogBox.height.toFixed(1),
                        nameTop: +nameBox.top.toFixed(1), cogTop: +cogBox.top.toFixed(1),
                    },
                    ellipsis,
                };
            }, SIZES);

            for (const [size] of SIZES) {
                const s = out.bySize[size];
                expect(s.token, `--control-h-${size} must be defined`).toBeGreaterThan(0);
                expect(s.text, `a text ${size} button must be its size token`).toBe(s.token);
                expect(s.icon, `an icon ${size} button must be its size token`).toBe(s.token);
                expect(s.iconText, `an icon+text ${size} button must be its size token`).toBe(s.token);
            }

            // The cog matches the FIELD it annotates, which is not a button height.
            expect(out.row.cogH, 'the model cog must match the model name box').toBe(out.row.nameH);
            expect(out.row.cogTop, 'and share its top edge').toBe(out.row.nameTop);

            expect(out.ellipsis.textOverflow, 'the model name keeps text-overflow').toBe('ellipsis');
            expect(out.ellipsis.clipped, 'and still actually clips a long name').toBe(true);
        } finally {
            await closeApp(app);
        }
    });
