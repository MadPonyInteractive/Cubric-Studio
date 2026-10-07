/**
 * MpiSceneBlock — the Scene workspace (Block, MPI-623).
 *
 * Opened by a left-click on a card that HAS a scene (`getSceneItem`, plan A9), behind
 * `APP_CONFIG.dev_mode` until the feature ships (A8). Routed as `PAGE_SCENE` with
 * `{ groupId }`, exactly like Group History.
 *
 * Today it is the SHELL: the viewport and its teardown. Phase 3 ports spike 0a's renderer
 * into `js/services/scene/` and draws into `getScene()`, then adds the fly controls, the
 * picture panel and Take picture around it.
 */

import { ComponentFactory } from '../../factory.js';
import { MpiSceneCanvas } from '../../Primitives/MpiSceneCanvas/MpiSceneCanvas.js';
import { qs } from '../../../utils/dom.js';

export const MpiSceneBlock = ComponentFactory.create({
    name: 'MpiSceneBlock',
    css: ['js/components/Blocks/MpiSceneBlock/MpiSceneBlock.css'],

    template: () => `
        <div class="mpi-scene-block">
            <div class="mpi-scene-block__viewport" id="viewport"></div>
        </div>
    `,

    setup: (el) => {
        const viewport = MpiSceneCanvas.mount(qs('#viewport', el), {});

        el.destroy = () => viewport.destroy();
    },
});
