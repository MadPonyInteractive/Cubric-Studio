/**
 * stackModel.js — the pure half of Gallery stacks (MPI-949).
 *
 * A stack is ONE gallery card holding N existing cards of one kind. It is an ordinary
 * ItemGroup with `type: 'stack'`, `kind: 'image'|'video'`, `members: [groupId, …]` in the
 * user's click order, and an EMPTY `history` — it owns no media. Each member keeps its own
 * history and sidecars untouched and carries `stackId`; the gallery scope hides any card
 * with one (`galleryFilter.js`).
 *
 * `stack.members` is the source of truth for membership and order. A member's `stackId` is
 * the fast back-pointer the gallery filter reads, and `sanitizeStacks` repairs it from
 * `members` whenever the two disagree.
 *
 * Every function here is pure and returns new objects; persistence is projectService's.
 * No import of projectModel on purpose — galleryFilter reads `isStack`, and a filter util
 * must not drag the model registry in with it.
 */

import { kindOfItem } from '../utils/assetKinds.js';

export const STACK_TYPE = 'stack';

/** Kinds a stack may hold. A GIF, audio clip or 3D Scene cannot be stacked. */
const STACKABLE_KINDS = ['image', 'video'];

/** @param {Object|null|undefined} group */
export function isStack(group) {
    return group?.type === STACK_TYPE;
}

/**
 * The stack kind a card would bring to a stack: its selected item's kind when that is an
 * image or a video, else null. Read from the ITEM, never `group.type` (assetKinds.js: a
 * video group can hold an image item).
 */
export function stackableKind(group) {
    if (!group || isStack(group)) return null;
    const item = group.history?.[group.selectedIndex ?? 0];
    if (!item) return null;
    const kind = kindOfItem(item).kind;
    return STACKABLE_KINDS.includes(kind) ? kind : null;
}

/** Status-bar text for each reason `stackCreateBlockReason` can return. */
export const STACK_BLOCK_INFO = Object.freeze({
    'too-few':          'Select at least two cards to stack',
    'contains-stack':   'A stack cannot go inside another stack',
    'unsupported-kind': 'Only images or videos can be stacked',
    'mixed-kinds':      'A stack holds images or videos, not both',
});

/**
 * Why these cards cannot become one stack, or null when they can.
 * @param {Array<Object>} groups - the selected cards, in click order
 * @returns {null|'too-few'|'contains-stack'|'unsupported-kind'|'mixed-kinds'}
 */
export function stackCreateBlockReason(groups = []) {
    const list = (groups || []).filter(Boolean);
    if (list.length < 2) return 'too-few';
    if (list.some(isStack)) return 'contains-stack';
    const kinds = list.map(stackableKind);
    if (kinds.includes(null)) return 'unsupported-kind';
    if (new Set(kinds).size > 1) return 'mixed-kinds';
    return null;
}

/**
 * The stack-specific fields of a new stack card, for `createItemGroup(STACK_TYPE, …)`.
 * It borrows the FIRST member's `createdAt`: the grid orders by `createdAt`, and the first
 * member is hidden once stacked, so the stack lands exactly in that card's slot. It also
 * takes the members' archive scope — a stack made in the archive stays there.
 * @param {Array<Object>} members - in click order; must pass `stackCreateBlockReason`
 * @param {{name?: string, customName?: string|null}} [opts]
 */
export function stackFields(members, { name = 'Stack', customName = null } = {}) {
    const first = members[0];
    return {
        kind:       stackableKind(first),
        members:    members.map(g => g.id),
        name,
        customName,
        createdAt:  first.createdAt,
        archived:   first.archived === true,
    };
}

/**
 * The fields of the EMPTY stack a Gallery run fills (MPI-949 Phase 3), for
 * `createItemGroup(STACK_TYPE, …)`. It is dated now, so it lands at the top of the grid,
 * and `expected` keeps it alive through a reload while it has no member yet.
 * @param {{kind: 'image'|'video', name: string, expected: number}} opts
 */
export function resultStackFields({ kind, name, expected }) {
    return { kind, members: [], name, customName: null, archived: false, expected };
}

/**
 * A Gallery run's result stack is done filling: `expected` goes, and a stack that got
 * no member at all goes with it. Unchanged when `stackId` is not a stack still filling.
 * @returns {Array<Object>} new groups array
 */
export function applySettleResultStack(groups, stackId) {
    const stack = groups.find(g => g.id === stackId);
    if (!isStack(stack) || !(stack.expected > 0)) return groups;
    if (!stack.members?.length) return groups.filter(g => g.id !== stackId);
    const { expected: _drop, ...settled } = stack;
    return groups.map(g => (g.id === stackId ? settled : g));
}

/**
 * The real cards behind a pick: each stack replaced by its members in stack order, every
 * other card kept. What Download, Reveal, Add to project, Delete all and a drag act on.
 * @param {Array<Object>} picked
 * @param {Array<Object>} groups - where member ids resolve (the project's cards)
 * @returns {Array<Object>}
 */
export function expandStacks(picked = [], groups = []) {
    const byId = new Map(groups.map(g => [g.id, g]));
    return picked.flatMap(g => (isStack(g)
        ? (g.members || []).map(id => byId.get(id)).filter(Boolean)
        : [g]));
}

function _withoutStackId(group) {
    const { stackId: _drop, ...rest } = group;
    return rest;
}

/**
 * Adds a built stack card to `groups` and points each of its members at it.
 * @returns {Array<Object>} new groups array
 */
export function applyStack(groups, stack) {
    const memberIds = new Set(stack.members);
    return [
        ...groups.map(g => (memberIds.has(g.id) ? { ...g, stackId: stack.id } : g)),
        stack,
    ];
}

/**
 * Dissolves a stack: the card goes, its members lose `stackId` and take the stack's
 * archive scope (an archived stack's members must not pop into the active gallery).
 * Members return to their OWN `createdAt` slots (MPI-949 D1).
 * @returns {Array<Object>} new groups array; unchanged when `stackId` is not a stack
 */
export function applyUnstack(groups, stackId) {
    const stack = groups.find(g => g.id === stackId);
    if (!isStack(stack)) return groups;
    const memberIds = new Set(stack.members);
    return groups
        .filter(g => g.id !== stackId)
        .map(g => (memberIds.has(g.id) ? { ..._withoutStackId(g), archived: stack.archived === true } : g));
}

/**
 * Takes cards out of a stack without deleting them. A stack left with no members is
 * removed; a stack of one stays a stack (MPI-949 D4).
 * @returns {Array<Object>} new groups array
 */
export function applyRemoveMembers(groups, stackId, memberIds = []) {
    const stack = groups.find(g => g.id === stackId);
    if (!isStack(stack)) return groups;
    const out = new Set(memberIds.filter(id => stack.members.includes(id)));
    if (!out.size) return groups;
    const members = stack.members.filter(id => !out.has(id));
    return groups
        .filter(g => !(g.id === stackId && members.length === 0))
        .map(g => {
            if (g.id === stackId) return { ...g, members };
            if (out.has(g.id)) return { ..._withoutStackId(g), archived: stack.archived === true };
            return g;
        });
}

/**
 * Appends cards to a stack's members (a Gallery run filling its result stack).
 * Cards already in a stack, stacks themselves and unknown ids are skipped.
 * @returns {Array<Object>} new groups array
 */
export function applyAddMembers(groups, stackId, memberIds = []) {
    const stack = groups.find(g => g.id === stackId);
    if (!isStack(stack)) return groups;
    const byId = new Map(groups.map(g => [g.id, g]));
    const adding = memberIds.filter(id => {
        const g = byId.get(id);
        return g && !isStack(g) && !g.stackId && !stack.members.includes(id);
    });
    if (!adding.length) return groups;
    const add = new Set(adding);
    return groups.map(g => {
        if (g.id === stackId) return { ...g, members: [...g.members, ...adding] };
        if (add.has(g.id)) return { ...g, stackId };
        return g;
    });
}

/**
 * Repairs stack membership after a load. `stack.members` wins:
 *   - member ids whose card is gone, is a stack, or is already listed by an earlier stack
 *     are pruned;
 *   - every listed member gets the right `stackId`;
 *   - a `stackId` pointing at a missing stack, or at one that does not list the card, is
 *     cleared;
 *   - a stack left with no members is dropped — unless `expected` says a Gallery run is
 *     still filling it.
 * @returns {{groups: Array<Object>, changed: boolean}}
 */
export function sanitizeStacks(groups = []) {
    const byId = new Map(groups.map(g => [g.id, g]));
    const owner = new Map(); // memberId → stackId
    let changed = false;

    const stacks = new Map();
    for (const g of groups) {
        if (!isStack(g)) continue;
        const listed = Array.isArray(g.members) ? g.members : [];
        const members = listed.filter(id => {
            const m = byId.get(id);
            if (!m || isStack(m) || owner.has(id)) return false;
            owner.set(id, g.id);
            return true;
        });
        if (members.length !== listed.length || !Array.isArray(g.members)) changed = true;
        const keep = members.length > 0 || g.expected > 0;
        if (!keep) changed = true;
        stacks.set(g.id, keep ? (members.length === listed.length && Array.isArray(g.members) ? g : { ...g, members }) : null);
    }

    const out = [];
    for (const g of groups) {
        if (isStack(g)) {
            const s = stacks.get(g.id);
            if (s) out.push(s);
            continue;
        }
        const want = owner.get(g.id);
        if (want && g.stackId !== want) {
            out.push({ ...g, stackId: want });
            changed = true;
        } else if (!want && g.stackId) {
            out.push(_withoutStackId(g));
            changed = true;
        } else {
            out.push(g);
        }
    }
    return { groups: changed ? out : groups, changed };
}
