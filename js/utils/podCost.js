// @ts-check
/**
 * podCost.js — what the connected Pod has cost so far (MPI-80, shared by MPI-1059).
 *
 * Billing-true uptime × the secure $/hr, both from the `remote:connection` feed tick.
 * null unless BOTH are known — the one gate the hero strip and the status bar share,
 * so the two surfaces never disagree on whether there is a number to show.
 *
 * @param {{ uptimeSeconds?: number, pricePerHr?: number }} [payload]
 * @returns {number|null} dollars, or null with no usable cost data
 */
export function podSessionCost({ uptimeSeconds, pricePerHr } = {}) {
    const hasUptime = Number.isFinite(uptimeSeconds) && uptimeSeconds > 0;
    const hasPrice = Number.isFinite(pricePerHr) && pricePerHr > 0;
    return hasUptime && hasPrice ? (uptimeSeconds / 3600) * pricePerHr : null;
}

/**
 * MPI-1155 — the spend as both surfaces print it: `$0.50 of $15.00` when the feed carries
 * the account credit this Pod started from (`creditUsd`), else `$0.50`.
 *
 * @param {number} cost dollars spent this session (from podSessionCost)
 * @param {number|null} [creditUsd]
 * @returns {string}
 */
export function podSpendText(cost, creditUsd) {
    return Number.isFinite(creditUsd) ? `$${cost.toFixed(2)} of $${creditUsd.toFixed(2)}` : `$${cost.toFixed(2)}`;
}
