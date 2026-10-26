/**
 * js/phone/init.js — the phone companion's entry point (MPI-1300).
 *
 * Its own entry, not js/init.js: the desktop boot (shell, engine install gate, hotkeys,
 * window controls) has no place on a phone. Everything imported from here must load in a
 * plain browser tab — no `window.require('electron')` at module level.
 */
import { qs } from '../utils/dom.js';
import { installErrorBridge } from '../services/clientLogger.js';
import { MpiPhoneShell } from '../components/Blocks/MpiPhoneShell/MpiPhoneShell.js';

// Top level, like js/init.js: an uncaught error reaches app.log with its stack.
installErrorBridge();

MpiPhoneShell.mount(qs('#phone-root'), {});
