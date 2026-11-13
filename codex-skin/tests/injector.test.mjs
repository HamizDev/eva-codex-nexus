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
  buildBootBootstrapSource,
  buildBootSource,
  buildEarlySource,
  buildInstallSource,
  buildPayloadFromStrings,
  buildRemoveSource,
  buildVerifyExpression,
  classifyTarget,
  isDriver,
  loadEvaThemePack,
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
  assert.equal(SKIN_VERSION, "0.4.4");
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
  const bootstrap = buildBootBootstrapSource(boot);
  assert.ok(bootstrap.includes('location.href !== "app://-/index.html"'));
  assert.ok(bootstrap.includes("eva-codex-skin-boot-launch"));
  assert.match(bootstrap, /reason: "not-main-document"/);
  const stableBootstrap = buildBootBootstrapSource(boot, 1234.5);
  assert.match(stableBootstrap, /performance\.timeOrigin !== 1234\.5/);
  assert.match(stableBootstrap, /reason: "document-changed"/);
  assert.match(buildRemoveSource(), /eva-codex-skin-boot-style/);
});

test("EVA 主题素材包按清单校验并生成本地启动序列", () => {
  const packRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eva-theme-pack-"));
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
    logo: {
      file: "assets/nerv-logo.svg",
      type: "image/svg+xml",
      data: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"><path id=\"mark\"/></svg>"),
    },
    bootBgm: { file: "assets/nerv-boot-music.mp3", type: "audio/mpeg", data: Buffer.from("ID3bgm") },
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
    package: "eva-theme-pack",
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceVersion: "9.9.9",
    assets,
  }));
  try {
    const pack = loadEvaThemePack(packRoot);
    assert.equal(pack.assets.boot.startsWith("data:image/gif;base64,"), true);
    assert.equal(Object.keys(pack.assets).length, 20);
    assert.equal(pack.assets.logo.startsWith("data:image/svg+xml;base64,"), true);
    assert.equal(pack.assets.bootBgm.startsWith("data:audio/mpeg;base64,"), true);
    assert.equal(pack.assets.asukaPortrait.startsWith("data:image/png;base64,"), true);
    assert.equal(pack.assets.asukaPickVoice.startsWith("data:audio/mpeg;base64,"), true);
    assert.equal(pack.revision.length, 24);
    const payload = buildPayloadFromStrings({
      driver: "asuka",
      css: "html{background:#000}",
      linework: "data:image/svg+xml;base64,AA==",
      mark: "data:image/svg+xml;base64,AA==",
      bootCss: "#eva-codex-skin-boot{opacity:0}",
      bootId: "launch-eva-theme-123",
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
      "审批提示语音",
      "完成提示语音",
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
      "eva-boot-layer",
      "dataset.phase",
      "NERV",
      "eva-boot-alert-layer",
      "eva-boot-alert-art",
      "eva-boot-alert-clock",
      "eva-boot-select-layer",
      "eva-boot-intro-layer",
      "eva-boot-intro-typed",
      "data-eva-clock",
      "eva-boot-bgm",
      "data-eva-pilot",
      "data-eva-dropzone",
      'data-eva-boot-text=\\"loaded\\"',
      'data-eva-boot-aria=\\"bay\\"',
      'data-eva-boot-aria=\\"pilots\\"',
      'data-eva-boot-aria=\\"progress\\"',
      "data-eva-sync-name",
      "eva-boot-select-glow",
      "eva-boot-bay-meta",
      "eva-boot-pilot-ghost",
      "chooseDriver",
      "setPointerCapture",
      "onPilotPointerMove",
      "onPilotPointerUp",
      "paintPointerDrag",
      "insideBay",
      "readBayRect",
      "createPointerGhost",
      "ghost.classList.add(\"is-warm\")",
      "translate3d(8px,8px,0)",
      "active.ghost.classList.remove(\"is-warm\")",
      "bayRect: pointerBayRect || readBayRect()",
      "pointerDrag.dragging = true",
      "paintPointerDrag();",
      "if (dx === 0 && dy === 0) return;",
      "active.width * active.grabX",
      "active.height * active.grabY",
      "const grabX = cardRect.width > 0",
      "const grabY = cardRect.height > 0",
      "pointerGhosts = new Map()",
      "pointerGhosts.set(card.dataset.evaPilot, ghost)",
      "ghost: pointerGhosts.get(card.dataset.evaPilot)",
      "active.ghost.classList.add(\"is-warm\")",
      "refreshDragGeometry",
      "pointerCardRects.set(card.dataset.evaPilot",
      "pointerBayRect = readBayRect()",
      "pointerBayRect || readBayRect()",
      "requestAnimationFrame(paintPointerDrag)",
      "translate3d(",
      "width: 190",
      "height: 130",
      "suppressCardClick",
      "pickVoices",
      ".eva-boot-console-layer .eva-boot-head strong",
      ".eva-boot-sync-copy h2",
      "setPhase(\"select\")",
      "syncMsByDriver",
      "EVA BOOT 9.9.9",
      "GOD'S IN HIS HEAVEN",
      "syncVoiceStarted",
      'NERV 駕駛員啟動序列',
      '駕駛員已裝載 · PILOT LOADED',
      "pagehide",
      "app-ready",
      "prefers-reduced-motion",
      "eva-codex-skin-options-v1",
      "bootOptions.boot === false",
      "bootOptions.bootVoice !== false",
      "eva-skin-boot-finished",
      "tickPhaseClock",
      "document.hidden",
      "\"focus\"",
      "\"blur\"",
      "transitionIntroToSelect",
      "introTransitioning",
      "is-leaving",
      "is-arriving",
      "data-boot-unit",
    ]) {
      assert.ok(payload.bootSource.includes(fragment), `missing EVA boot contract: ${fragment}`);
    }
    assert.doesNotMatch(payload.bootSource, /draggable="true"/);
    assert.doesNotMatch(payload.bootSource, /dataTransfer/);
    assert.doesNotMatch(payload.bootSource, /document\.hasFocus/);
    assert.doesNotMatch(payload.bootSource, /later\(\(\) => setPhase\("emergency"\)/);
    assert.doesNotMatch(payload.bootSource, /phaseTimer/);
    const leaveIndex = payload.bootSource.indexOf("const leave = () =>");
    const maybeFinishIndex = payload.bootSource.indexOf("const maybeFinish = () =>");
    const chooseIndex = payload.bootSource.indexOf("const chooseDriver = (pilot) =>");
    const tickSyncIndex = payload.bootSource.indexOf("const tickSync = (now) =>");
    const installIndex = payload.bootSource.indexOf("const install = () =>");
    const runtimeIndex = payload.bootSource.indexOf("const runtime = { bootId, driver, finish, cleanup, mounted: false }");
    assert.ok(leaveIndex >= 0 && maybeFinishIndex > leaveIndex);
    assert.ok(chooseIndex >= 0 && tickSyncIndex > chooseIndex);
    assert.ok(installIndex >= 0 && runtimeIndex > installIndex);
    assert.match(
      payload.bootSource.slice(leaveIndex, maybeFinishIndex),
      /localStorage\.setItem\(storageKey, bootId\)/,
    );
    assert.doesNotMatch(
      payload.bootSource.slice(chooseIndex, tickSyncIndex),
      /localStorage\.setItem\(storageKey, bootId\)/,
    );
    assert.doesNotMatch(
      payload.bootSource.slice(installIndex, runtimeIndex),
      /localStorage\.setItem\(storageKey, bootId\)/,
    );
    assert.doesNotMatch(payload.bootSource, /onBackdropClick/);
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
  const evaBootCss = fs.readFileSync(path.join(root, "assets", "eva-boot.css"), "utf8");
  for (const fragment of [
    "html[data-eva-skin=\"asuka\"]",
    "html[data-eva-skin=\"rei\"]",
    "aside.app-shell-left-panel",
    "[class*=\"_ComposerLayoutRoot_\"]",
    "[class*=\"bg-surface-elevated-secondary\"]",
    "[class*=\"bg-background-neutral-soft-alpha\"]",
    "[data-eva-queue-rail]",
    "[data-eva-queue-card]",
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
    "html[data-eva-skin][data-eva-browser-active]",
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
  assert.ok(!css.includes(":has("), "runtime CSS must not use :has()");
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
    ".eva-boot-gif",
    ".eva-boot-alert-layer",
    ".eva-boot-alert-clock",
    ".eva-boot-alert-art > svg",
    ".eva-boot-select-layer",
    ".eva-boot-intro-layer",
    ".eva-boot-title",
    ".eva-boot-hint",
    "@keyframes eva-boot-intro-scan",
    "@keyframes eva-boot-intro-out",
    ".eva-boot-select-bay",
    ".eva-boot-select-glow",
    ".eva-boot-pilot-card",
    '.eva-boot-pilot-card[data-eva-pilot="asuka"]',
    "--eva-card-surface: #0d0f13",
    ".eva-boot-select-bay.is-over",
    ".eva-boot-pilot-ghost",
    ".eva-boot-bay-meta",
    ".eva-boot-exit",
    "@keyframes eva-boot-plug-roll",
    "transform: rotate(14deg)",
    ".eva-boot-pilot-face",
    ".eva-boot-ring-meter",
    "@media (max-width: 700px)",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(evaBootCss.includes(fragment), `missing EVA boot CSS contract: ${fragment}`);
  }
  assert.match(
    evaBootCss,
    /\.eva-boot-select-layer\s*\{[\s\S]*?pointer-events:\s*auto;/i,
  );
  assert.match(
    evaBootCss,
    /\.eva-boot-select-bay\s*\{[\s\S]*?pointer-events:\s*auto;/i,
  );
  assert.match(
    evaBootCss,
    /\.eva-boot-pilot-ghost\s*\{[\s\S]*?transition:\s*none\s*!important;[\s\S]*?contain:\s*strict;/i,
  );
  assert.match(
    evaBootCss,
    /\.eva-boot-pilot-ghost\s*\{[\s\S]*?width:\s*190px;[\s\S]*?height:\s*130px;/i,
  );
  assert.match(
    evaBootCss,
    /\.eva-boot-pilot-ghost\.is-warm\s*\{[\s\S]*?opacity:\s*0\.001;[\s\S]*?pointer-events:\s*none;/i,
  );
  const pilotHoverRule = evaBootCss.match(
    /\.eva-boot-pilot-card:hover,\s*[\s\S]*?\{([\s\S]*?)\}/i,
  )?.[1] || "";
  assert.doesNotMatch(pilotHoverRule, /background:|transform:|box-shadow:/i);
  assert.match(
    evaBootCss,
    /\.eva-boot-select-bay\.is-over \.eva-boot-select-glow[\s\S]*?opacity:\s*1;/i,
  );
  assert.doesNotMatch(evaBootCss, /is-pilot-dragging/i);
  assert.match(
    evaBootCss,
    /:is\(\[data-phase="select"\], \[data-phase="sync"\]\) \.eva-boot-contour-map\s*\{[\s\S]*?filter:\s*none;[\s\S]*?animation:\s*none;/i,
  );
  assert.match(
    evaBootCss,
    /:is\(\[data-phase="select"\], \[data-phase="sync"\]\) \.eva-boot-contour-ring\s*\{[\s\S]*?animation:\s*none\s*!important;/i,
  );
  assert.doesNotMatch(
    evaBootCss,
    /\.is-pilot-dragging \.eva-boot-contour-map\s*\{/i,
  );
  assert.doesNotMatch(
    evaBootCss,
    /#eva-codex-skin-boot\.is-pilot-dragging\s+\*\s*\{/i,
  );
  assert.doesNotMatch(
    evaBootCss,
    /\.eva-boot-select-bay\.is-over\s*\{[^}]*animation:\s*eva-boot-bay-ready/i,
  );
  const selectPlugRule = evaBootCss.match(
    /\.eva-boot-select-bay \.eva-boot-plug\s*\{([\s\S]*?)\}/i,
  )?.[1] || "";
  assert.match(selectPlugRule, /contain:\s*layout style;/i);
  assert.match(selectPlugRule, /filter:\s*none;/i);
  assert.doesNotMatch(selectPlugRule, /drop-shadow|saturate|contrast/i);
  assert.match(evaBootCss, /transform:\s*rotate\(14deg\)\s+translateZ\(0\);/i);
  const plugRollFrames = evaBootCss.match(
    /@keyframes eva-boot-plug-roll\s*\{([\s\S]*?)\n\}/i,
  )?.[1] || "";
  assert.match(plugRollFrames, /scaleX\(0\.62\)/i);
  assert.doesNotMatch(plugRollFrames, /scaleX\(0(?:\.006)?\)/i);
  assert.match(
    evaBootCss,
    /\.eva-boot-exit\s*\{[\s\S]*?min-width:\s*120px;[\s\S]*?border-left:\s*3px solid var\(--eva-boot-accent\);[\s\S]*?background:/i,
  );
  assert.match(
    evaBootCss,
    /\.eva-boot-exit:hover[\s\S]*?background:\s*var\(--eva-boot-accent\);/i,
  );
  assert.ok(!evaBootCss.includes("@import"));
  assert.ok(!/url\(\s*https?:/i.test(evaBootCss));
});

test("性能热路径保持合成友好且不强制布局", () => {
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  const evaBootCss = fs.readFileSync(path.join(root, "assets", "eva-boot.css"), "utf8");
  const ui = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
  const injector = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  assert.ok(!css.includes("backdrop-filter"));
  assert.doesNotMatch(css, /mix-blend-mode:\s*(?:soft-light|multiply|screen|overlay)/i);
  assert.ok(!css.includes(":has("), "style invalidation hot path must not use :has()");
  assert.match(css, /@keyframes eva-skin-scan\s*\{[\s\S]*?translate3d\(0,\s*130vh,\s*0\)/i);
  const isVisibleStart = ui.indexOf("function isVisible(node)");
  const isVisibleEnd = ui.indexOf("function bootOverlayActive()", isVisibleStart);
  const isVisibleSource = ui.slice(isVisibleStart, isVisibleEnd);
  assert.ok(isVisibleStart >= 0 && isVisibleEnd > isVisibleStart);
  assert.doesNotMatch(isVisibleSource, /checkVisibility|getBoundingClientRect/);
  assert.match(ui, /function bootOverlayActive\(\)/);
  assert.match(ui, /document\.getElementById\("eva-codex-skin-boot"\)/);
  assert.match(ui, /function refreshSkinMarkers\(\)/);
  assert.match(ui, /data-eva-queue-rail/);
  assert.match(ui, /data-eva-browser-rail/);
  assert.match(ui, /function syncActivityMonitoring\(\)/);
  assert.match(ui, /options\.approvalVoice \|\| options\.completeVoice/);
  assert.match(injector, /const paintClock = \(node, time\) =>/);
  assert.match(injector, /getContext\("2d"\)/);
  assert.doesNotMatch(injector, /eva-boot-pilot-card[^;]{0,120}\.focus\?\./);
  assert.match(evaBootCss, /\.eva-boot-clock\s*\{/);
});

test("应用内切换驾驶员不会启动开机动画", () => {
  const source = buildInstallSource({
    driver: "asuka",
    css: "html{background:#000}",
    linework: "data:image/svg+xml;base64,AA==",
    mark: "data:image/svg+xml;base64,AA==",
  });
  assert.match(source, /setDriver/);
  assert.doesNotMatch(source, /eva-boot-select-layer/);
  assert.doesNotMatch(source, /data-eva-dropzone/);
  assert.doesNotMatch(source, /eva-codex-skin-boot-launch/);
});

test("启动层在主文档稳定后、Codex 主界面探测前挂载", () => {
  const source = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  const applyStart = source.indexOf("async function applyOnce");
  const applyEnd = source.indexOf("async function runWatch", applyStart);
  const applySource = source.slice(applyStart, applyEnd);
  const probeIndex = source.indexOf("const probe = await waitForCodexProbe", applyStart);
  const stableIndex = source.indexOf("await mountBootOnStableDocument(", applyStart);
  const bootIndex = source.indexOf("current.bootSource", stableIndex);
  assert.ok(applyStart >= 0);
  assert.ok(probeIndex > applyStart);
  assert.ok(stableIndex > applyStart);
  assert.ok(bootIndex > applyStart);
  assert.ok(stableIndex < bootIndex);
  assert.ok(bootIndex < probeIndex);
  assert.match(applySource, /bootPending/);
  assert.doesNotMatch(applySource, /await session\.evaluate\(current\.bootSource\)/);
  assert.match(source, /const stableForMs = 650;/);
  assert.match(
    source.slice(source.indexOf("async function mountBootOnStableDocument"), source.indexOf("async function waitForVerifiedSession")),
    /buildBootBootstrapSource\(/,
  );
});

test("应用未完成重载后重新挂载启动层，完成标记只在离开时写入", () => {
  const source = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  const loadStart = source.indexOf('result.session.on("Page.loadEventFired"');
  const loadEnd = source.indexOf("sessions.set(target.id, record)", loadStart);
  assert.ok(loadStart >= 0 && loadEnd > loadStart);
  const loadSource = source.slice(loadStart, loadEnd);
  assert.match(loadSource, /eva-codex-skin-boot-launch/);
  assert.match(loadSource, /buildBootBootstrapSource\(current\.bootSource\)/);
  assert.match(
    source.slice(source.indexOf("async function mountBootOnStableDocument"), source.indexOf("async function waitForVerifiedSession")),
    /document-changed/,
  );
});

test("内置浏览器打开时重新定位设置入口且不隐藏设置面板", () => {
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  assert.match(
    css,
    /html\[data-eva-skin\]\[data-eva-browser-active\][\s\S]*?\.eva-settings-button\s*\{[\s\S]*?bottom:\s*64px;/i,
  );
  assert.ok(!css.includes(".eva-driver-switch"));
  assert.doesNotMatch(css, /\.eva-config-panel\s*\{[^}]*display:\s*none/i);
  assert.match(
    css,
    /#eva-codex-skin-overlay \.eva-config-panel\s*\{[\s\S]*?max-height:\s*min\(560px,\s*calc\(100vh - 32px\)\);/i,
  );
});

test("设置面板支持折叠浮层、自由拖动和四语言切换", () => {
  const js = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  for (const fragment of [
    'locale: "zh-Hant"',
    '"zh-Hant", "zh-Hans", "ja", "en"',
    "eva-config-group-toggle",
    "eva-config-language",
    "evaUiLocale",
    "panel.classList.add(\"is-open\")",
    "setPanelPosition",
    "pointermove",
    "onDragStart",
    "onDragEnd",
    "startX",
    "startLeft",
    "clampPanelLeft",
    "clampPanelTop",
  ]) {
    assert.ok(js.includes(fragment) || css.includes(fragment), `missing panel contract: ${fragment}`);
  }
  assert.match(css, /--eva-panel-left/);
  assert.match(css, /--eva-panel-right/);
  assert.match(css, /--eva-panel-translate-x/);
  assert.match(css, /--eva-panel-translate-y/);
  assert.match(css, /\.eva-config-panel\.is-open\s*\{/);
  assert.match(css, /\.eva-config-group-toggle\s*\{/);
  assert.match(css, /\.eva-config-language\s*\{/);
  assert.match(css, /\.eva-config-panel\.is-dragging\s*\{/);
});

test("输出速度 HUD 使用真实流式正文并标明估算", () => {
  const js = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "assets", "eva-skin.css"), "utf8");
  for (const fragment of [
    "eva-tps-hud",
    "estimateTokens",
    "assistantTokenCache",
    "nodeTokenCount",
    "TPS_TOKEN_WEIGHTS",
    "TPS_WINDOW_MS = 2400",
    "TPS_SAMPLE_MS = 320",
    "sampleWindowRate",
    "[data-turn-key]",
    'data-markdown-text-style="assistant-message"',
    "setInterval(sampleTps, TPS_SAMPLE_MS)",
    "tok/s",
    "EST",
    "PEAK",
    "AVG",
    "tps: true",
  ]) {
    assert.ok(js.includes(fragment), `missing tps contract: ${fragment}`);
  }
  assert.ok(!js.includes("setInterval(sampleTps, 400)"));
  assert.ok(!js.includes("cjkCount +"));
  assert.doesNotMatch(js, /\.map\(\(node\) => node\.textContent \|\| ""\)/);
  assert.match(css, /#eva-codex-skin-overlay \.eva-tps-hud\s*\{/);
  assert.match(css, /@keyframes eva-tps-in/);
});

test("默认音频音量提高且语音播放时继续压低 BGM", () => {
  const js = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
  const source = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  assert.match(
    js,
    /audioLevels = Object\.freeze\(\{[\s\S]*?preview: 1,[\s\S]*?voice: 1,[\s\S]*?task: 1,[\s\S]*?typing: 0\.4,/,
  );
  assert.ok(!js.includes("playMedia(id, null, 0.78)"));
  assert.match(js, /playMedia\(id, null, audioLevels\.task\)/);
  for (const fragment of [
    "bgm: 0.68",
    "bgmPick: 0.18",
    "bgmSync: 0.1",
    "voice: 1",
    "pick: 1",
    "bgm.volume = audioLevels.bgm",
    "fadeBgm(audioLevels.bgmPick, 320)",
    "fadeBgm(audioLevels.bgmSync, 500)",
    "pick.volume = audioLevels.pick",
    "voice.volume = audioLevels.voice",
  ]) {
    assert.ok(source.includes(fragment), `missing audio level contract: ${fragment}`);
  }
});

test("启动层四语言文案完成校对并同步更新同步页", () => {
  const js = fs.readFileSync(path.join(root, "assets", "skin-ui.js"), "utf8");
  const source = fs.readFileSync(path.join(root, "injector.mjs"), "utf8");
  for (const fragment of [
    "下次啟動時播放駕駛員選擇與 NERV 序列",
    "下次启动时播放驾驶员选择与 NERV 序列",
    "次回起動時にパイロット選択と NERV シーケンスを再生",
    "Play the pilot selection and NERV sequence on next launch",
    "審核提示語音",
    "审批提示语音",
    "承認待ちボイス",
    "完了通知ボイス",
    'on: "オン"',
    'off: "オフ"',
    "スライディングウィンドウ",
  ]) {
    assert.ok(js.includes(fragment), `missing localized settings copy: ${fragment}`);
  }
  for (const fragment of [
    'data-eva-boot-text="loaded"',
    "data-eva-sync-name",
    'data-eva-boot-aria="bay"',
    'data-eva-boot-aria="pilots"',
    'data-eva-boot-aria="progress"',
    "駕駛員已裝載 · PILOT LOADED",
    "パイロット搭乗完了 · PILOT LOADED",
    "パイロットを挿入 · DROP PILOT HERE",
    "Drag to entry plug",
    "將頭像拖入左側插入栓，或點擊頭像裝載",
    "将头像拖入左侧插入栓，或点击头像装载",
    "ポートレートを左のエントリープラグへドラッグ、またはクリック",
    "Entry plug, pilot drop zone",
    "NERV pilot startup sequence",
    "boot.setAttribute(\"aria-label\", text(\"bootLabel\"))",
    "name.textContent = text(pilot === \"rei\" ? \"rei\" : \"asuka\")",
  ]) {
    assert.ok(source.includes(fragment), `missing localized boot copy: ${fragment}`);
  }
  for (const stale of [
    "審核自動語音",
    "完成自動語音",
    "审核自动语音",
    "完成自动语音",
    "drop: \"パイロットを挿入 · DROP PILOT\",",
  ]) {
    assert.ok(!source.includes(stale) && !js.includes(stale), `stale copy remains: ${stale}`);
  }
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
    "--boot-pack", "C:\\Temp\\eva-theme",
  ]);
  assert.equal(options.mode, "verify");
  assert.equal(options.port, 9456);
  assert.equal(options.driver, "rei");
  assert.equal(options.bootId, "launch-9456");
  assert.equal(options.forceDriverToken, "override-9456");
  assert.equal(options.bootPack, "C:\\Temp\\eva-theme");
  assert.throws(() => parseArgs(["--port", "80"]), /between/);
  assert.throws(() => parseArgs(["--driver", "system"]), /asuka or rei/);
  assert.throws(() => parseArgs(["--boot-id", "bad id"]), /Boot id/);
  assert.throws(() => parseArgs(["--force-token", "bad token"]), /Force token/);
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
});
