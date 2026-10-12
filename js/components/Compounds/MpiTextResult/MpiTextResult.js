import { ComponentFactory } from '../../factory.js';
import { MpiInput } from '../../Primitives/MpiInput/MpiInput.js';
import { MpiButton } from '../../Primitives/MpiButton/MpiButton.js';
import { Events } from '../../../events.js';
import { clientLogger } from '../../../services/clientLogger.js';
import { qs, ce } from '../../../utils/dom.js';
import { srtToText } from '../../../utils/srt.js';

/**
 * MpiTextResult — a Flow's TEXT result (Compound, MPI-1071)
 *
 * The Transcribe Flow makes no gallery card: its result is the transcript, read here,
 * with Copy and "Download .srt". The box shows the SRT with its cue numbers and times
 * taken out (`srtToText`); Download saves the SRT itself.
 *
 * Download is an `<a download>` on a Blob. The app sets no `will-download` handler, so
 * Electron's own routine opens a Save As window (Fabio, 2026-10-11) — no route, no IPC.
 *
 * Props:
 * @param {string} srt               - The SRT the graph returned
 * @param {string} [fileName='transcript.srt'] - Suggested name in the Save As window
 */
export const MpiTextResult = ComponentFactory.create({
    name: 'MpiTextResult',
    css: ['js/components/Compounds/MpiTextResult/MpiTextResult.css'],

    template: () => `
        <div class="mpi-text-result">
            <div class="mpi-text-result__text" id="text-slot"></div>
            <div class="mpi-text-result__actions">
                <div id="copy-slot"></div>
                <div id="download-slot"></div>
            </div>
        </div>
    `,

    setup: (el, props) => {
        const srt = String(props.srt ?? '');
        const text = srtToText(srt);

        MpiInput.mount(qs('#text-slot', el), { type: 'textarea', readonly: true, value: text });

        const copy = MpiButton.mount(qs('#copy-slot', el), {
            icon: 'copy', label: 'Copy', variant: 'secondary', size: 'sm', info: 'Copy the transcript',
        });
        copy.on('click', () => navigator.clipboard.writeText(text)
            .then(() => Events.emit('ui:success', { message: 'Transcript copied.' }))
            .catch((err) => clientLogger.warn('MpiTextResult', `copy failed: ${err?.message || err}`)));

        const download = MpiButton.mount(qs('#download-slot', el), {
            icon: 'download', label: 'Download .srt', variant: 'secondary', size: 'sm',
            info: 'Save the subtitles as an .srt file',
        });
        download.on('click', () => {
            const url = URL.createObjectURL(new Blob([srt], { type: 'application/x-subrip' }));
            ce('a', { href: url, download: props.fileName || 'transcript.srt' }).click();
            // Revoked a tick later: the download reads the URL after the click returns.
            setTimeout(() => URL.revokeObjectURL(url), 0);
        });
    },
});
