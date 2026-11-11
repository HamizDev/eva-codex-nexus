'use strict';

function chooseApprovalDecision(availableDecisions, accept) {
  const preferred = accept ? ['accept', 'acceptForSession'] : ['decline', 'cancel'];
  if (!Array.isArray(availableDecisions)) return preferred[0];
  return preferred.find(decision => availableDecisions.includes(decision)) || null;
}

module.exports = {chooseApprovalDecision};
