import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context, { filename: "skin-ui.js" });

const createCompletionGate = context.createCompletionGate;

function snapshot(key, { signature = `sig:${key}`, conversation = "conversation-a" } = {}) {
  return { key, signature, conversation };
}

function observe(gate, now, {
  running = false,
  approvalVisible = false,
  final = null,
} = {}) {
  return gate.observe({
    now,
    running,
    approvalVisible,
    snapshot: final,
  });
}

test("历史最终回复不会在皮肤初始化时补播", () => {
  const gate = createCompletionGate();
  assert.equal(observe(gate, 0, { final: snapshot("old") }), false);
  assert.equal(observe(gate, 10000, { final: snapshot("old") }), false);
});

test("稳定结束三秒后只播放一次", () => {
  const gate = createCompletionGate();
  observe(gate, 0, { final: snapshot("old") });
  observe(gate, 1000, { running: true, final: snapshot("old") });
  assert.equal(observe(gate, 5000, { final: snapshot("new") }), false);
  assert.equal(gate.pendingDelay(6500), 1500);
  assert.equal(observe(gate, 7999, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 8000, { final: snapshot("new") }), true);
  assert.equal(gate.pendingDelay(8000), null);
  assert.equal(observe(gate, 8001, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 11002, { final: snapshot("new") }), false);
});

test("停止按钮短暂消失后恢复时不会误播", () => {
  const gate = createCompletionGate();
  observe(gate, 0, { final: snapshot("old") });
  observe(gate, 1000, { running: true, final: snapshot("old") });
  assert.equal(observe(gate, 2000, { final: snapshot("new") }), false);
  observe(gate, 2500, { running: true, final: snapshot("new") });
  assert.equal(observe(gate, 3000, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 5999, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 6000, { final: snapshot("new") }), true);
});

test("审批等待期间不播放，审批消失后重新计算稳定时间", () => {
  const gate = createCompletionGate();
  observe(gate, 0, { final: snapshot("old") });
  observe(gate, 1000, { running: true, final: snapshot("old") });
  assert.equal(observe(gate, 2000, {
    approvalVisible: true,
    final: snapshot("new"),
  }), false);
  assert.equal(observe(gate, 10000, {
    approvalVisible: true,
    final: snapshot("new"),
  }), false);
  assert.equal(gate.pendingDelay(10000), null);
  assert.equal(observe(gate, 11000, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 13999, { final: snapshot("new") }), false);
  assert.equal(observe(gate, 14000, { final: snapshot("new") }), true);
});

test("最终文本仍在变化时重新计时", () => {
  const gate = createCompletionGate();
  observe(gate, 0, { final: snapshot("old") });
  observe(gate, 1000, { running: true, final: snapshot("old") });
  assert.equal(observe(gate, 2000, {
    final: snapshot("new", { signature: "stream-1" }),
  }), false);
  assert.equal(observe(gate, 4000, {
    final: snapshot("new", { signature: "stream-2" }),
  }), false);
  assert.equal(observe(gate, 6999, {
    final: snapshot("new", { signature: "stream-2" }),
  }), false);
  assert.equal(observe(gate, 7000, {
    final: snapshot("new", { signature: "stream-2" }),
  }), true);
});

test("复用相同消息节点但正文变化时仍算一次新完成", () => {
  const gate = createCompletionGate();
  observe(gate, 0, {
    final: snapshot("same-node", { signature: "before-run" }),
  });
  observe(gate, 1000, {
    running: true,
    final: snapshot("same-node", { signature: "before-run" }),
  });
  assert.equal(observe(gate, 2000, {
    final: snapshot("same-node", { signature: "after-run" }),
  }), false);
  assert.equal(observe(gate, 4999, {
    final: snapshot("same-node", { signature: "after-run" }),
  }), false);
  assert.equal(observe(gate, 5000, {
    final: snapshot("same-node", { signature: "after-run" }),
  }), true);
});

test("没有新最终回复或切换到其他会话时不播放", () => {
  const unchanged = createCompletionGate();
  observe(unchanged, 0, { final: snapshot("same") });
  observe(unchanged, 1000, { running: true, final: snapshot("same") });
  assert.equal(observe(unchanged, 2000, { final: snapshot("same") }), false);
  assert.equal(observe(unchanged, 5000, { final: snapshot("same") }), false);

  const switched = createCompletionGate();
  observe(switched, 0, { final: snapshot("old", { conversation: "conversation-a" }) });
  observe(switched, 1000, {
    running: true,
    final: snapshot("old", { conversation: "conversation-a" }),
  });
  assert.equal(observe(switched, 2000, {
    final: snapshot("new", { conversation: "conversation-b" }),
  }), false);
  assert.equal(observe(switched, 5000, {
    final: snapshot("new", { conversation: "conversation-b" }),
  }), false);
});

test("运行中切到空会话后，新会话完成仍可播放", () => {
  const gate = createCompletionGate();
  observe(gate, 0, { final: snapshot("old", { conversation: "conversation-a" }) });
  observe(gate, 1000, {
    running: true,
    final: snapshot("old", { conversation: "conversation-a" }),
  });
  assert.equal(observe(gate, 2000, {
    final: { key: null, signature: "", conversation: "conversation-b" },
  }), false);
  observe(gate, 3000, {
    running: true,
    final: { key: null, signature: "", conversation: "conversation-b" },
  });
  assert.equal(observe(gate, 4000, {
    final: snapshot("new", { conversation: "conversation-b" }),
  }), false);
  assert.equal(observe(gate, 6999, {
    final: snapshot("new", { conversation: "conversation-b" }),
  }), false);
  assert.equal(observe(gate, 7000, {
    final: snapshot("new", { conversation: "conversation-b" }),
  }), true);
});

test("完成判定同时使用停止按钮、工作指示器和审批面板信号", () => {
  assert.match(source, /data-app-action-sidebar-thread-active="true"/);
  assert.match(source, /data-app-action-sidebar-thread-id/);
  assert.match(source, /data-sidebar-indicator="working"/);
  assert.match(source, /data-loading-indicator/);
  assert.match(source, /hasVisibleApproval\(\)/);
  assert.match(source, /completionStableMs = 3000/);
  assert.match(source, /welcomeFreshMs = 30000/);
  assert.match(source, /sessionStorage\.getItem\(sessionKey\)/);
});
