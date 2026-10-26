// @ts-check
/**
 * Folder tree from path-shaped values (`Folder\Sub\file.ext` or POSIX `/`).
 * Shared by MpiTreePicker and MpiFileTree: two Primitives may not import each other.
 *
 * Root-level items (value with no separator) live at the top level. Returns
 * `{ folders: Map<name, node>, files }`, the same shape recursively; each file is the
 * item it came from plus `label` (its basename) and `value`.
 *
 * @param {Array<string|{value:string}>} items
 */
export const buildTree = (items) => {
    const root = { folders: new Map(), files: [] };
    for (const item of items) {
        const val = typeof item === 'string' ? item : item.value;
        const parts = String(val).split(/[\\/]/);
        const file = parts.pop();
        let node = root;
        for (const seg of parts) {
            if (!node.folders.has(seg)) node.folders.set(seg, { folders: new Map(), files: [] });
            node = node.folders.get(seg);
        }
        node.files.push({ ...(typeof item === 'string' ? {} : item), label: file, value: val });
    }
    return root;
};

export const sortedFolderNames = (node) => [...node.folders.keys()].sort((a, b) => a.localeCompare(b));
export const sortedFiles = (node) => [...node.files].sort((a, b) => a.label.localeCompare(b.label));
