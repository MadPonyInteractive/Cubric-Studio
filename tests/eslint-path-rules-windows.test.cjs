'use strict';

// mpi/no-raw-event-listener and mpi/no-raw-console matched context.filename against
// '/js/components/' and '/js/shell/'. On Windows the path uses backslashes, so neither
// rule ever fired there, and CI lints on windows-latest: 142 violations grew unseen
// until a Linux run. Both now normalise separators first, as no-bare-form-control does.

const test = require('node:test');
const { RuleTester } = require('eslint');
const listenerRule = require('../.eslint-rules/no-raw-event-listener.js');
const consoleRule = require('../.eslint-rules/no-raw-console.js');

RuleTester.describe = (_name, fn) => fn();
RuleTester.it = RuleTester.itOnly = (name, fn) => test(name, fn);

const win = (...p) => ['C:', 'AI', 'Mpi', 'Cubric-Studio', 'js', ...p].join('\\');
const posix = (...p) => ['', 'home', 'u', 'Cubric-Studio', 'js', ...p].join('/');
const tester = new RuleTester({ languageOptions: { sourceType: 'module', ecmaVersion: 'latest' } });

const LISTEN = "el.addEventListener('click', fn);";
tester.run('no-raw-event-listener', listenerRule, {
    valid: [
        { code: LISTEN, filename: win('services', 'x.js') },
        { code: "el.destroy = () => { el.removeEventListener('click', fn); };", filename: win('components', 'Primitives', 'MpiX', 'MpiX.js') },
    ],
    invalid: [
        { code: LISTEN, filename: win('components', 'Primitives', 'MpiX', 'MpiX.js'), errors: 1 },
        { code: LISTEN, filename: posix('components', 'Primitives', 'MpiX', 'MpiX.js'), errors: 1 },
    ],
});

const LOG = "console.warn('x');";
tester.run('no-raw-console', consoleRule, {
    valid: [
        { code: LOG, filename: win('services', 'x.js') },
        { code: "console.info('x');", filename: win('shell', 'x.js') },
    ],
    invalid: [
        { code: LOG, filename: win('components', 'Organisms', 'MpiX', 'MpiX.js'), errors: 1 },
        { code: LOG, filename: win('shell', 'navigation.js'), errors: 1 },
        { code: LOG, filename: posix('shell', 'navigation.js'), errors: 1 },
    ],
});
