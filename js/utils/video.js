// @ts-check
/**
 * videoUtils.js — Video Processing Utilities
 */

/**
 * Captures a specific region of a video frame.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} cropRect - { x, y, width, height } in 0–1 range
 * @returns {Promise<string>} Data URL (PNG)
 */
async function captureFrame(video, cropRect = { x: 0, y: 0, width: 1, height: 1 }) {
    if (!video || video.readyState < 2) throw new Error('Video is not ready for capture.');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const sx = cropRect.x * vW;
    const sy = cropRect.y * vH;
    const sw = cropRect.width * vW;
    const sh = cropRect.height * vH;
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL('image/png', 1.0);
}

/**
 * A clip's first frame as a PNG data URL, from its URL alone, with no player on screen: the
 * describe step of a Flow run reads it (flowEnhance.js, MPI-1036). `at` (0-1) takes a later
 * frame instead: the child-safety gate looks at the middle and the end too (MPI-1156).
 *
 * @param {string} url
 * @param {number} [at=0] where in the clip, as a share of its length
 * @returns {Promise<string>} Data URL (PNG)
 */
export async function firstFrameDataUrl(url, at = 0) {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'auto';
    try {
        // `loadeddata` = the frame at the current position (0) is decoded and drawable.
        await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(new Error('The clip could not be read.'));
            video.src = url;
        });
        if (at > 0 && Number.isFinite(video.duration)) {
            await new Promise((resolve, reject) => {
                video.onseeked = resolve;
                video.onerror = () => reject(new Error('The clip could not be read.'));
                video.currentTime = Math.max(0, Math.min(video.duration * at, video.duration - 0.05));
            });
        }
        return await captureFrame(video);
    } finally {
        video.removeAttribute('src');
        video.load();
    }
}

/**
 * Captures a frame and returns both a Blob and a Data URL.
 *
 * @param {HTMLVideoElement} video
 * @param {Object} cropRect - { x, y, width, height } in 0–1 range
 * @returns {Promise<{blob: Blob, dataUrl: string}>}
 */
export async function captureFrameBlob(video, cropRect = { x: 0, y: 0, width: 1, height: 1 }) {
    if (!video || video.readyState < 2) throw new Error('Video is not ready for capture.');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const vW = video.videoWidth;
    const vH = video.videoHeight;
    const sx = cropRect.x * vW;
    const sy = cropRect.y * vH;
    const sw = cropRect.width * vW;
    const sh = cropRect.height * vH;
    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 1.0));
    return { blob, dataUrl };
}
