'use strict';

// MPI-751 — mpi/no-same-tier-component-import matched the raw import string for
// '/Compounds/', so a sibling-relative import ('../MpiX/MpiX.js') inside a Compound never
// matched and a Compound -> Compound import linted clean. The rule now resolves every
// specifier against the importing file and classifies the resolved directory.

const test = require('node:test');
const path = require('node:path');
const { RuleTester } = require('eslint');
const rule = require('../.eslint-rules/no-same-tier-component-import.js');

RuleTester.describe = (_name, fn) => fn();
RuleTester.it = RuleTester.itOnly = (name, fn) => test(name, fn);

const file = (...p) => path.join(process.cwd(), 'js', 'components', ...p);
const grid = file('Compounds', 'MpiGalleryGrid', 'MpiGalleryGrid.js');
const bad = (code, filename) => ({ code, filename, errors: 1 });

new RuleTester({ languageOptions: { sourceType: 'module', ecmaVersion: 'latest' } }).run('no-same-tier-component-import', rule, {
  valid: [
    { code: "import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';", filename: grid },
    { code: "import { x } from './helpers.js';", filename: grid },
    { code: "import { ViewManager } from './managers/ViewManager.js';", filename: file('Primitives', 'MpiCanvas', 'MpiCanvas.js') },
    { code: "import { ComponentFactory } from '../../factory.js';", filename: file('Primitives', 'MpiButton', 'MpiButton.js') },
    { code: "import { MpiCompareView } from '../../Compounds/MpiCompareView/MpiCompareView.js';", filename: file('Organisms', 'MpiBaseFlow', 'MpiBaseFlow.js') },
    { code: "import { MpiBaseFlow } from '../../Organisms/MpiBaseFlow/MpiBaseFlow.js';", filename: file('Blocks', 'MpiX', 'MpiX.js') },
    { code: "import { a } from '../MpiRunpodSettings/MpiRunpodSettings.js';", filename: file('Compounds', 'LandingPages', 'MpiRunpodSettings', 'part.js') },
    { code: "import { qs } from '/js/utils/dom.js';", filename: grid },
  ],
  invalid: [
    bad("import { MpiContextMenu } from '../MpiContextMenu/MpiContextMenu.js';", grid),
    bad("import { MpiWaveform } from '/js/components/Compounds/MpiWaveform/MpiWaveform.js';", grid),
    bad("import { MpiOkCancel } from '../../MpiOkCancel/MpiOkCancel.js';", file('Compounds', 'LandingPages', 'MpiModelManager', 'MpiModelManager.js')),
    bad("import { MpiOllamaSetup } from '../MpiOllamaSetup/MpiOllamaSetup.js';", file('Compounds', 'LandingPages', 'MpiLlmSettings', 'MpiLlmSettings.js')),
    bad("export { MpiStepBox } from '../MpiStepBox/MpiStepBox.js';", file('Organisms', 'MpiBaseFlow', 'stepKinds.js')),
    bad("const m = import('../MpiStepCutout/MpiStepCutout.js');", file('Organisms', 'MpiStepPlace', 'MpiStepPlace.js')),
    bad("import { ViewManager } from '../MpiCanvas/managers/ViewManager.js';", file('Primitives', 'MpiMaskedImagePreview', 'MpiMaskedImagePreview.js')),
    bad("import { MpiPromptBox } from '../../Organisms/MpiPromptBox/MpiPromptBox.js';", grid),
  ],
});
