'use strict';

/**
 * deepinfra-credit-gate.test.cjs — MPI-869, refusing a cloud run the account cannot pay for
 * BEFORE it is sent, so the user gets a toast naming the cost instead of a provider error.
 *
 * The account shape below is the real `/payment/checklist` answer from 2026-09-24, numbers
 * as probed and every string replaced: that body carries the billing address and card last4,
 * which is why `_accountRoom` may only ever hand back numbers. The dashboard read PREPAID
 * CREDITS $1.54 and MONTHLY USAGE $2.90 / $5.00 LIMIT at the same moment.
 */

const assert = require('node:assert/strict');
const test = require('node:test');

const { _accountRoom, _creditRefusal } = require('../routes/deepinfra.js');

const PROBED = {
    billing_type: 'balance', stripe_balance: -4.44, recent: 2.9, limit: 5, topup: false,
    billing_address_info: { name: 'X', line1: 'X' }, payment_method_info: { card: { last4: '0000' } },
};

test('the room matches the dashboard: $1.54 of credit, $2.10 of the monthly limit', () => {
    const room = _accountRoom(PROBED);
    assert.deepEqual(Object.keys(room).sort(), ['balanceUsd', 'limitRoomUsd']);
    assert.ok(Math.abs(room.balanceUsd - 1.54) < 1e-9);
    assert.ok(Math.abs(room.limitRoomUsd - 2.10) < 1e-9);
});

test('no balance stop on auto top-up or a non-prepaid account; no limit stop when none is set', () => {
    assert.equal(_accountRoom({ ...PROBED, topup: true }).balanceUsd, null);
    assert.equal(_accountRoom({ ...PROBED, billing_type: 'invoice' }).balanceUsd, null);
    assert.equal(_accountRoom({ ...PROBED, limit: null }).limitRoomUsd, null);
    assert.equal(_accountRoom({ ...PROBED, limit: 0 }).limitRoomUsd, null);
    assert.deepEqual(_accountRoom(null), { balanceUsd: null, limitRoomUsd: null });
});

test('Seedance at $1.90 against $1.54 left is refused for balance, with both figures in the copy', () => {
    const r = _creditRefusal(1.9, _accountRoom(PROBED));
    assert.equal(r.code, 'LOW_BALANCE');
    assert.match(r.message, /\$1\.90/);
    assert.match(r.message, /\$1\.54/);
});

test('a run the balance covers but the monthly limit does not is refused for the LIMIT', () => {
    // A $10 balance pays for $2.50; the $5 limit with $2.90 used has only $2.10 left.
    const r = _creditRefusal(2.5, _accountRoom({ ...PROBED, stripe_balance: -12.9 }));
    assert.equal(r.code, 'OVER_LIMIT');
    assert.match(r.message, /\$2\.10/);
});

test('a run that fits, an unknown price, or an unreadable account all go through', () => {
    const room = _accountRoom(PROBED);
    assert.equal(_creditRefusal(0.0005, room), null);
    assert.equal(_creditRefusal(0, room), null);
    assert.equal(_creditRefusal(1.9, null), null);
    assert.equal(_creditRefusal(1.9, { balanceUsd: null, limitRoomUsd: null }), null);
});
