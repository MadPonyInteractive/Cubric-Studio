/**
 * js/utils/file.js — File/media type utilities for Cubric Studio.
 */

'use strict';

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv']);
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']);

/**
 * Returns the lowercase file extension (without the dot).
 * @param {string} filename - The name of the file to extract the extension from.
 * @returns {string} The lowercase extension, or an empty string if none found.
 */
export const getExtension = (filename) =>
    (filename || '').split('.').pop().toLowerCase();

/**
 * The last segment of a path, split on `/` AND `\` (Windows paths and model
 * subfolders both reach the renderer). Empty input gives ''.
 * @param {string} p
 * @returns {string}
 */
export const basename = (p) => String(p || '').split(/[\\/]/).pop();

/**
 * Checks if the given filename has a supported image extension.
 * @param {string} filename - The name of the file to check.
 * @returns {boolean} True if it is an image file, false otherwise.
 */
export const isImageFile = (filename) => IMAGE_EXTS.has(getExtension(filename));

/**
 * Checks if the given filename has a supported video extension.
 * @param {string} filename - The name of the file to check.
 * @returns {boolean} True if it is a video file, false otherwise.
 */
export const isVideoFile = (filename) => VIDEO_EXTS.has(getExtension(filename));

/**
 * Checks if the given filename has a supported audio extension.
 * @param {string} filename - The name of the file to check.
 * @returns {boolean} True if it is an audio file, false otherwise.
 */
export const isAudioFile = (filename) => AUDIO_EXTS.has(getExtension(filename));

