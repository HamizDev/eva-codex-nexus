'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {chooseApprovalDecision} = require('../approval-decision.cjs');

test('approval uses accept when the current CLI offers it', () => {
  assert.equal(chooseApprovalDecision(['accept', 'acceptForSession', 'cancel'], true), 'accept');
});

test('approval falls back to cancel when decline is not offered', () => {
  assert.equal(chooseApprovalDecision(['accept', 'cancel'], false), 'cancel');
});

test('approval keeps decline for older CLI decision lists', () => {
  assert.equal(chooseApprovalDecision(['accept', 'decline'], false), 'decline');
  assert.equal(chooseApprovalDecision(undefined, false), 'decline');
});
