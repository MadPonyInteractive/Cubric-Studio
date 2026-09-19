const js = require('@eslint/js');
const globals = require('globals');
const noRawDomQuery = require('./.eslint-rules/no-raw-dom-query');
const noRawEventListener = require('./.eslint-rules/no-raw-event-listener');
const noWindowHotkey = require('./.eslint-rules/no-window-hotkey');
const noNestedStateMutation = require('./.eslint-rules/no-nested-state-mutation');
const noRawConsole = require('./.eslint-rules/no-raw-console');
const requireDestroyOnEvents = require('./.eslint-rules/require-destroy-on-events');
const noSameTierComponentImport = require('./.eslint-rules/no-same-tier-component-import');
const noHardcodedHexColor = require('./.eslint-rules/no-hardcoded-hex-color');
const noBareFormControl = require('./.eslint-rules/no-bare-form-control');

const mpiPlugin = {
  rules: {
    'no-raw-dom-query': noRawDomQuery,
    'no-raw-event-listener': noRawEventListener,
    'no-window-hotkey': noWindowHotkey,
    'no-nested-state-mutation': noNestedStateMutation,
    'no-raw-console': noRawConsole,
    'require-destroy-on-events': requireDestroyOnEvents,
    'no-same-tier-component-import': noSameTierComponentImport,
    'no-hardcoded-hex-color': noHardcodedHexColor,
    'no-bare-form-control': noBareFormControl,
  },
};

module.exports = [
  {
    ignores: [
      'js/components/factory.js',
      'js/vendor/**',
      'node_modules/**',
      'logs/**',
    ],
  },
  {
    // A typo in a renderer file is invisible to the rest of the gate: the suite's
    // source-contract tests are regexes, so they never execute the line. MPI-822
    // shipped `ReferenceError: isRunning is not defined` to the user's app through a
    // green lint and a green 1445-test run (MPI-832).
    // Both global sets, everywhere: the renderer window runs `nodeIntegration: true`
    // + `contextIsolation: false` (main.js), `js/migrations/` is plain CommonJS, and
    // `routes/` + `main.js` are Node — so `require`/`process`/`module` really are
    // defined in all of them.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    files: ['js/**/*.js'],
    plugins: {
      mpi: mpiPlugin,
    },
    rules: {
      'mpi/no-raw-dom-query': 'warn',
      'mpi/no-raw-event-listener': 'warn',
      'mpi/no-window-hotkey': 'warn',
      'mpi/no-nested-state-mutation': 'warn',
      'mpi/no-raw-console': 'warn',
      'mpi/require-destroy-on-events': 'warn',
      'mpi/no-same-tier-component-import': 'warn',
      'mpi/no-hardcoded-hex-color': 'warn',
      'mpi/no-bare-form-control': 'warn',
    },
  },
];
