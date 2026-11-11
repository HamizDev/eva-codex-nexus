import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EXACT_MAIN_URL,
  SKIN_VERSION,
  buildActiveDriverExpression,
  buildBootSource,
  buildEarlySource,
  buildInstallSource,
  buildPayloadFromStrings,
  buildRemoveSource,
  buildVerifyExpression,
  classifyTarget,
  isDriver,
  loadDshBootPack,
  loadPayload,
  parseArgs,
  validateDebuggerUrl,
} from "../injector.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("只接受官方 Codex 主 renderer", () => {
  assert.equal(classifyTarget({ type: "page", url: EXACT_MAIN_URL }), "main");
  assert.equal(classifyTarget({ type: "page", url: "app://-/index.html?initialRoute=/avatar-overlay" }), "overlay");
  assert.equal(classifyTarget({ type: "page", url: "app://-/index.html?initialRoute=/settings" }), "unknown");
  assert.equal(classifyTarget({ type: "page", url: "https://example.com/" }), "unknown");
  assert.equal(classifyTarget({ type: "iframe", url: EXACT_MAIN_URL }), "unknown");
  assert.equal(classifyTarget({ type: "page", url: "file:///C:/evil.html" }), "unknown");
});

test("CDP WebSocket 必须位于预期回环端口", () => {
  const target = {
    webSocketDebuggerUrl: "ws://127.0.0.1:9345/devtools/page/ABC-123",
  };
  assert.equal(
    validateDebuggerUrl(target, 9345),
    "ws://127.0.0.1:9345/devtools/page/ABC-123",
  );
  for (const url of [
    "ws://example.com:9345/devtools/page/ABC-123",
    "wss://127.0.0.1:9345/devtools/page/ABC-123",
    "ws://127.0.0.1:9346/devtools/page/ABC-123",
    "ws://user@127.0.0.1:9345/devtools/page/ABC-123",
    "ws://127.0.0.1:9345/devtools/browser/ABC-123",
    "ws://127.0.0.1:9345/devtools/page/ABC-123?x=1",
  ]) {
    assert.throws(
      () => validateDebuggerUrl({ webSocketDebuggerUrl: url }, 9345),
      /Rejected/,
      url,
    );
  }
});

test("主题与 payload 版本稳定且可切换", () => {
  assert.equal(isDriver("asuka"), true);
  assert.equal(isDriver("rei"), true);
  assert.equal(isDriver("system"), false);
  assert.equal(SKIN_VERSION, "0.4.1");
  const asuka = loadPayload("asuka");
  const rei = loadPayload("rei");
  assert.equal(asuka.driver, "asuka");
  assert.equal(rei.driver, "rei");
  assert.notEqual(asuka.revision, rei.revision);
  assert.match(asuka.source, /EVA-02 \/\/ NEXUS LINK/);
  assert.match(rei.source, /EVA-00 \/\/ NEXUS LINK/);
  assert.match(asuka.source, /pointer-events/);
  assert.match(asuka.source, /eva-codex-skin-driver-v1/);
  assert.match(asuka.source, /dataset\.evaUiDriver = driver\.id/);
  assert.match(asuka.source, /id: "asuka"/);
  assert.match(asuka.source, /id: "rei"/);
  assert.match(asuka.source, /asuka-mark|data:image\/svg\+xml;base64/);
  assert.match(asuka.source, /eva-skin-driver-change/);
  assert.match(asuka.source, /installEvaSkinUi/);
  assert.match(asuka.source, /eva-codex-skin-options-v1/);
  assert.match(asuka.source, /eva-config-panel/);
  assert.match(asuka.source, /eva-portrait/);
  assert.match(asuka.source, /approvalVoice: false/);
  assert.match(asuka.source, /completeVoice: false/);
  assert.match(asuka.source, /data-codex-approval-surface/);
  assert.match(asuka.source, /data-local-conversation-final-assistant/);
  assert.match(asuka.source, /isTaskRunning/);
  assert.match(asuka.source, /scheduleCompletionCheck/);
  assert.match(asuka.source, /createCompletionGate/);
  assert.match(asuka.source, /data-sidebar-indicator="working"/);
  assert.match(asuka.source, /data-loading-indicator/);
  assert.match(asuka.source, /seenApprovals/);
  assert.match(asuka.source, /pending|排队消息操作/);
  const activeDriver = buildActiveDriverExpression();
  assert.match(activeDriver, /dataset\?\.evaSkin/);
  assert.match(activeDriver, /"asuka"/);
  assert.match(activeDriver, /"rei"/);
});

test("注入和恢复都只使用 EVA 自有节点", () => {
  const payload = buildPayloadFromStrings({
    driver: "asuka",
    css: "html{background:#000}",
    linework: "data:image/svg+xml;base64,AA==",
    mark: "data:image/svg+xml;base64,AA==",
  });
  const early = buildEarlySource(payload.source, payload.revision);
  assert.match(early, new RegExp(payload.revision));
  assert.match(early, /MutationObserver/);
  assert.match(early, /EVA_CODEX_SKIN_EARLY_APPLIED/);
  const remove = buildRemoveSource();
  assert.match(remove, /eva-codex-skin-style/);
  assert.match(remove, /eva-codex-skin-overlay/);
  assert.match(remove, /delete root\.dataset\.evaSkin/);
});

test("首次启动动画只播放一次并可跳过", () => {
  const boot = buildBootSource({
    driver: "asuka",
    css: "#eva-codex-skin-boot{opacity:0}@keyframes boot-in{to{opacity:1}}",
    bootId: "launch-abc-123",
  });
  for (const fragment of [
    "eva-codex-skin-boot",
    "eva-codex-skin-boot-launch",
    "already-played",
    "prefers-reduced-motion",
    "ASUKA LANGLEY",
    "EVANGELION UNIT-02",
    "Escape",
    "localStorage",
    "pagehide",
    "eva-codex-skin-options-v1",
    "bootOptions.boot === false",
    "requestAnimationFrame",
  ]) {
    assert.ok(boot.includes(fragment), `missing boot contract: ${fragment}`);
  }
  assert.ok(!/https?:/i.test(boot));
  assert.ok(!/<audio|<video|<image/i.test(boot));

  const rei = buildBootSource({
    driver: "rei",
    css: "#eva-codex-skin-boot{opacity:0}",
    bootId: "launch-rei-456",
  });
  assert.match(rei, /REI AYANAMI/);
  assert.match(rei, /EVANGELION UNIT-00/);

  const early = buildEarlySource("void 0", "rev-1", boot);
  assert.ok(early.includes("eva-codex-skin-boot-launch"));
  assert.ok(early.includes('if (location.href === "app://-/index.html")'));
  assert.ok(
    early.indexOf("eva-codex-skin-boot-launch") <
      early.indexOf("__EVA_CODEX_SKIN_EARLY_GENERATION__"),
  );
  assert.match(buildRemoveSource(), /eva-codex-skin-boot-style/);
});

test("DSH 启动包按清单校验并生成本地启动序列", () => {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eva-dsh-pack-"));
  const contents = {
    boot: { file: "assets/boot.gif", type: "image/gif", data: Buffer.from("GIF89a") },
    emergency: {
      file: "assets/emergency.svg",
      type: "image/svg+xml",
      data: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
    },
    entryPlug: {
      file: "assets/plug.svg",
      type: "image/svg+xml",
      data: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><path/></svg>"),
    },
    asukaHead: { file: "assets/asuka.png", type: "image/png", data: Buffer.from("89504e470d0a1a0a", "hex") },
    reiHead: { file: "assets/rei.png", type: "image/png", data: Buffer.from("89504e470d0a1a0a", "hex") },
    asukaVoice: { file: "assets/asuka-boot.mp3", type: "audio/mpeg", data: Buffer.from("ID3asuka") },
    reiVoice: { file: "assets/rei-boot.mp3", type: "audio/mpeg", data: Buffer.from("ID3rei") },
    asukaPortrait: { file: "assets/asuka-portrait.png", type: "image/png", data: Buffer.from("89504e470d0a1a0a", "hex") },
    reiPortrait: { file: "assets/rei-portrait.png", type: "image/png", data: Buffer.from("89504e470d0a1a0a", "hex") },
    asukaPickVoice: { file: "assets/asuka-pick.mp3", type: "audio/mpeg", data: Buffer.from("ID3pick-asuka") },
    reiPickVoice: { file: "assets/rei-pick.mp3", type: "audio/mpeg", data: Buffer.from("ID3pick-rei") },
    asukaWelcome: { file: "assets/asuka-welcome.mp3", type: "audio/mpeg", data: Buffer.from("ID3welcome-asuka") },
    reiWelcome: { file: "assets/rei-welcome.mp3", type: "audio/mpeg", data: Buffer.from("ID3welcome-rei") },
    asukaApproval: { file: "assets/asuka-approval.mp3", type: "audio/mpeg", data: Buffer.from("ID3approval-asuka") },
    reiApproval: { file: "assets/rei-approval.mp3", type: "audio/mpeg", data: Buffer.from("ID3approval-rei") },
    asukaComplete: { file: "assets/asuka-complete.mp3", type: "audio/mpeg", data: Buffer.from("ID3complete-asuka") },
    reiComplete: { file: "assets/rei-complete.mp3", type: "audio/mpeg", data: Buffer.from("ID3complete-rei") },
    typing: { file: "assets/typing.mp3", type: "audio/mpeg", data: Buffer.from("ID3typing") },
  };
  const assets = [];
  for (const [id, value] of Object.entries(contents)) {
    const target = path.join(packRoot, value.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, value.data);
    assets.push({
      id,
      file: value.file,
      type: value.type,
      bytes: value.data.length,
      sha256: crypto.createHash("sha256").update(value.data).digest("hex"),
    });
  }
  fs.writeFileSync(path.join(packRoot, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    package: "dsh-eva-theme-boot-pack",
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceVersion: "9.9.9",
    assets,
  }));
  try {
    const pack = loadDshBootPack(packRoot);
    assert.equal(pack.assets.boot.startsWith("data:image/gif;base64,"), true);
    assert.equal(Object.keys(pack.assets).length, 18);
    assert.equal(pack.assets.asukaPortrait.startsWith("data:image/png;base64,"), true);
    assert.equal(pack.assets.asukaPickVoice.startsWith("data:audio/mpeg;base64,"), true);
    assert.equal(pack.revision.length, 24);
    const payload = buildPayloadFromStrings({
      driver: "asuka",
      css: "html{background:#000}",
      linework: "data:image/svg+xml;base64,AA==",
      mark: "data:image/svg+xml;base64,AA==",
      bootCss: "#eva-codex-skin-boot{opacity:0}",
      bootId: "launch-dsh-123",
      bootPack: pack,
    });
    assert.equal(payload.bootPack.sourceVersion, "9.9.9");
    for (const fragment of [
      "eva-settings-button",
      "eva-config-panel",
      "eva-config-preview",
      "eva-portrait",
      "dataset.evaPortrait",
      "eva-skin-boot-finished",
      "eva-codex-skin-options-v1",
      "onTypingInput",
      "portraitStrength",
      "approvalVoice",
      "completeVoice",
      "审核自动语音",
      "完成自动语音",
      "data-codex-approval-surface",
      "data-local-conversation-final-assistant",
      "isTaskRunning",
      "scheduleCompletionCheck",
      "0.03",
      "0.28",
      "asukaPickVoice",
      "reiWelcome",
    ]) {
      assert.ok(payload.source.includes(fragment), `missing settings UI contract: ${fragment}`);
    }
    assert.match(payload.source, /data:image\/png;base64,/);
    assert.match(payload.source, /data:audio\/mpeg;base64,/);
    for (const fragment of [
      "eva-dsh-layer",
      "dataset.phase",
      "NERV",
      "eva-dsh-alert-layer",
      "eva-dsh-select-layer",
      "data-dsh-pilot",
      "data-dsh-dropzone",
      "chooseDriver",
      "pickVoices",
      ".eva-dsh-console-layer .eva-dsh-head strong",
      ".eva-dsh-sync-copy h2",
      "setPhase(\"select\")",
      "syncMsByDriver",
      "DSH BOOT 9.9.9",
      "GOD'S IN HIS HEAVEN",
      "syncVoiceStarted",
      "pagehide",
      "app-ready",
      "prefers-reduced-motion",
      "eva-codex-skin-options-v1",
      "bootOptions.boot === false",
      "bootOptions.bootVoice !== false",
      "eva-skin-boot-finished",
    ]) {
      assert.ok(payload.bootSource.includes(fragment), `missing DSH boot contract: ${fragment}`);
    }
    assert.ok(!/(?:src|href)\s*=\s*["']https?:|url\(\s*["']?https?:|@import/i.test(payload.bootSource));
  } finally {
    fs.rmSync(packRoot, { recursive: true, force: true });
  }
});

test("安装脚本不会接管鼠标事件", () => {
  const source = buildInstallSource({
    driver: "rei",
    css: "html{background:#fff}",
    linework: "data:image/svg+xml;base64,AA==",
    mark: "data:image/svg+xml;base64,AA==",
  });
  assert.match(source, /aria-hidden/);
  assert.match(source, /class="eva-scan"/);
  assert.match(source, /MutationObserver/);
  assert.match(source, /settingsButton\.className = "eva-settings-button"/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /setDriver/);
  const verify = buildVerifyExpression();
  assert.match(verify, /eva-settings-button/);
  assert.match(verify, /eva-config-panel/);
  assert.match(verify, /settingsUi/);
  assert.match(verify, /pilotButtonCount/);
  assert.match(verify, /previewButtonCount/);
});

test("启动器显式主题只覆盖一次，应用内选择继续持久化", () => {
  const token = "launch-override-abc-123";
  const payload = buildPayloadFromStrings({
    driver: "rei",
    css: "html{background:#fff}",
    linework: "data:image/svg+xml;base64,AA==",
    mark: "data:image/svg+xml;base64,AA==",
    forceDriverToken: token,
  });
  assert.equal(payload.forceDriverToken, token);
  assert.ok(payload.source.includes(token));
  assert.match(payload.source, /eva-codex-skin-force-driver-token-v1/);
  assert.match(payload.source, /localStorage\.getItem\(forceDriverTokenKey\)/);
  assert.match(payload.source, /localStorage\.setItem\(driverStorageKey, requestedDriver\)/);
  assert.throws(
    () => buildInstallSource({
      driver: "rei",
      css: "",
      linework: "",
      mark: "",
      forceDriverToken: "bad token",
    }),
    /Force driver token/,
  );
});

test("皮肤 CSS 使用稳定选择器并禁用远程资源", () => {
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  const bootCss = fs.readFileSync(path.join(root, "assets", "boot.css"), "utf8");
  const dshBootCss = fs.readFileSync(path.join(root, "assets", "dsh-boot.css"), "utf8");
  for (const fragment of [
    "html[data-eva-skin=\"asuka\"]",
    "html[data-eva-skin=\"rei\"]",
    "aside.app-shell-left-panel",
    "[class*=\"_ComposerLayoutRoot_\"]",
    "[class*=\"bg-surface-elevated-secondary\"]",
    "[class*=\"bg-background-neutral-soft-alpha\"]",
    "[class*=\"rail-\"]:has([aria-label=\"排队消息操作\"])",
    "[aria-label=\"删除排队的消息\"]",
    "[role=\"tooltip\"]",
    ".bg-user-message",
    ".rich-text-user-turn",
    "--color-text-user-message: var(--eva-text-strong)",
    "[data-browser-sidebar-address-input]",
    "[data-testid=\"browser-profile-import-nux-banner\"]",
    ".bg-neutral-soft-alpha",
    "[role=\"tab\"][aria-selected=\"true\"]",
    "[class~=\"group/summary-panel\"]",
    "[data-slot=\"thread-summary-panel-item-button\"]",
    "[data-slot=\"thread-summary-panel-item-leading\"]",
    "[data-slot=\"thread-summary-panel-icon-button\"]",
    "section[role=\"presentation\"]::after",
    ".bg-composer-primary",
    "#eva-codex-skin-overlay",
    "#eva-codex-skin-overlay .eva-settings-button",
    "#eva-codex-skin-overlay .eva-config-panel",
    "#eva-codex-skin-overlay .eva-portrait",
    "html[data-eva-portrait=\"off\"]",
    "html[data-eva-portrait=\"on\"]",
    ".eva-config-pilot",
    ".eva-config-preview",
    ".eva-config-range",
    "-webkit-app-region: no-drag",
    "pointer-events: auto !important",
    "html[data-eva-skin]:has([data-browser-sidebar-address-input])",
    "@media (max-width: 900px)",
    "@media (max-width: 760px)",
    "pointer-events: none !important",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(css.includes(fragment), `missing CSS contract: ${fragment}`);
  }
  assert.ok(!css.includes("@import"));
  assert.ok(!/url\(\s*https?:/i.test(css));
  assert.ok(!/<script/i.test(css));
  for (const fragment of [
    "#eva-codex-skin-boot",
    "@keyframes eva-boot-scan",
    "@keyframes eva-boot-progress-in",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(bootCss.includes(fragment), `missing boot CSS contract: ${fragment}`);
  }
  assert.ok(!bootCss.includes("@import"));
  assert.ok(!/url\(\s*https?:/i.test(bootCss));
  for (const fragment of [
    "#eva-codex-skin-boot",
    ".eva-dsh-gif",
    ".eva-dsh-alert-layer",
    ".eva-dsh-select-layer",
    ".eva-dsh-select-bay",
    ".eva-dsh-pilot-card",
    ".eva-dsh-select-bay.is-over",
    ".eva-dsh-pilot-face",
    ".eva-dsh-ring-meter",
    "@media (max-width: 700px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(dshBootCss.includes(fragment), `missing DSH boot CSS contract: ${fragment}`);
  }
  assert.match(
    dshBootCss,
    /\.eva-dsh-select-layer\s*\{[\s\S]*?pointer-events:\s*auto;/i,
  );
  assert.match(
    dshBootCss,
    /\.eva-dsh-select-bay\s*\{[\s\S]*?pointer-events:\s*auto;/i,
  );
  assert.ok(!dshBootCss.includes("@import"));
  assert.ok(!/url\(\s*https?:/i.test(dshBootCss));
});

test("应用内切换驾驶员不会启动开机动画", () => {
  const source = buildInstallSource({
    driver: "asuka",
    css: "html{background:#000}",
    linework: "data:image/svg+xml;base64,AA==",
    mark: "data:image/svg+xml;base64,AA==",
  });
  assert.match(source, /setDriver/);
  assert.doesNotMatch(source, /eva-dsh-select-layer/);
  assert.doesNotMatch(source, /data-dsh-dropzone/);
  assert.doesNotMatch(source, /eva-codex-skin-boot-launch/);
});

test("启动层等待 Codex 主页面出现后再注入", () => {
  const source = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  const applyStart = source.indexOf("async function applyOnce");
  const probeIndex = source.indexOf("const probe = await waitForCodexProbe", applyStart);
  const bootIndex = source.indexOf("await session.evaluate(current.bootSource)", applyStart);
  assert.ok(applyStart >= 0);
  assert.ok(probeIndex > applyStart);
  assert.ok(bootIndex > probeIndex);
});

test("内置浏览器打开时重新定位设置入口且不隐藏设置面板", () => {
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  assert.match(
    css,
    /html\[data-eva-skin\]:has\(\[data-browser-sidebar-address-input\]\)[\s\S]*?\.eva-settings-button\s*\{[\s\S]*?bottom:\s*64px;/i,
  );
  assert.ok(!css.includes(".eva-driver-switch"));
  assert.doesNotMatch(css, /\.eva-config-panel\s*\{[^}]*display:\s*none/i);
  assert.match(
    css,
    /#eva-codex-skin-overlay \.eva-config-panel\s*\{[\s\S]*?max-height:\s*min\(810px,\s*calc\(100vh - 20px\)\);/i,
  );
});

test("主题资源不包含角色图片或远程引用", () => {
  for (const name of ["asuka-mark.svg", "rei-mark.svg", "linework.svg"]) {
    const svg = fs.readFileSync(path.join(root, "assets", name), "utf8");
    assert.ok(!/<image\b/i.test(svg), name);
    assert.ok(!/href\s*=\s*["']https?:/i.test(svg), name);
    assert.ok(!/<script/i.test(svg), name);
  }
});

test("选择器合同保留稳定锚点", () => {
  const selectors = JSON.parse(fs.readFileSync(path.join(root, "selectors.json"), "utf8"));
  assert.equal(selectors.schema, "eva-codex-skin-selectors/1");
  assert.equal(selectors.selectors.sidebar, "aside.app-shell-left-panel");
  assert.equal(selectors.selectors.homeIcon, "[data-testid=\"home-icon\"]");
  assert.equal(selectors.selectors.tooltip, "[role=\"tooltip\"]");
  assert.equal(selectors.selectors.elevatedSurface, "[class*=\"bg-surface-elevated-secondary\"]");
  assert.equal(selectors.selectors.neutralSoftAction, "[class*=\"bg-background-neutral-soft-alpha\"]");
  assert.equal(selectors.selectors.userMessage, ".bg-user-message");
  assert.match(selectors.selectors.userMessageRichText, /rich-text-user-turn/);
  assert.equal(
    selectors.selectors.finalAssistantMessage,
    "[data-local-conversation-final-assistant=\"true\"]",
  );
  assert.match(selectors.selectors.runStopButton, /aria-label="停止"/);
  assert.equal(
    selectors.selectors.runWorkingIndicator,
    "[data-app-action-sidebar-thread-active=\"true\"][data-sidebar-indicator=\"working\"]",
  );
  assert.equal(
    selectors.selectors.runLoadingIndicator,
    "[data-app-action-sidebar-thread-active=\"true\"] [data-loading-indicator]",
  );
  assert.equal(
    selectors.selectors.activeThread,
    "[data-app-action-sidebar-thread-active=\"true\"][data-app-action-sidebar-thread-id]",
  );
  assert.equal(
    selectors.selectors.approvalSurface,
    "[data-codex-approval-surface=\"true\"]",
  );
  assert.match(selectors.selectors.browserPanel, /right-panel/);
  assert.match(selectors.selectors.browserPanel, /data-browser-sidebar-address-input/);
  assert.equal(selectors.selectors.browserAddressInput, "[data-browser-sidebar-address-input]");
  assert.equal(selectors.selectors.browserImportBanner, "[data-testid=\"browser-profile-import-nux-banner\"]");
  assert.equal(selectors.selectors.browserToolCard, ".bg-neutral-soft-alpha");
  assert.equal(selectors.selectors.summaryPanel, "[class~=\"group/summary-panel\"]");
  assert.equal(selectors.selectors.summaryPanelItem, "[data-slot=\"thread-summary-panel-item-button\"]");
  assert.equal(selectors.selectors.summaryPanelLeading, "[data-slot=\"thread-summary-panel-item-leading\"]");
  assert.equal(selectors.selectors.summaryPanelIconButton, "[data-slot=\"thread-summary-panel-icon-button\"]");
  assert.equal(selectors.selectors.composerPrimary, ".bg-composer-primary");
  assert.match(selectors.selectors.changeSummaryPill, /rounded-3xl/);
  assert.match(selectors.selectors.queuedRail, /排队消息操作/);
  assert.match(selectors.selectors.queuedAction, /删除排队的消息/);
  assert.match(selectors.selectors.shellMain, /_MainContentSurface_/);
  assert.match(selectors.selectors.composer, /_ComposerLayoutRoot_/);
  assert.equal(
    selectors.excludedTargets.avatarOverlay,
    "app://-/index.html?initialRoute=/avatar-overlay",
  );
});

test("CLI 参数边界", () => {
  const options = parseArgs([
    "--verify",
    "--port", "9456",
    "--driver", "rei",
    "--boot-id", "launch-9456",
    "--force-token", "override-9456",
    "--boot-pack", "C:\\Temp\\dsh-boot",
  ]);
  assert.equal(options.mode, "verify");
  assert.equal(options.port, 9456);
  assert.equal(options.driver, "rei");
  assert.equal(options.bootId, "launch-9456");
  assert.equal(options.forceDriverToken, "override-9456");
  assert.equal(options.bootPack, "C:\\Temp\\dsh-boot");
  assert.throws(() => parseArgs(["--port", "80"]), /between/);
  assert.throws(() => parseArgs(["--driver", "system"]), /asuka or rei/);
  assert.throws(() => parseArgs(["--boot-id", "bad id"]), /Boot id/);
  assert.throws(() => parseArgs(["--force-token", "bad token"]), /Force token/);
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
});
