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
  buildBootSource,
  buildEarlySource,
  buildInstallSource,
  buildPayloadFromStrings,
  buildRemoveSource,
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
  assert.equal(SKIN_VERSION, "0.2.2");
  const asuka = loadPayload("asuka");
  const rei = loadPayload("rei");
  assert.equal(asuka.driver, "asuka");
  assert.equal(rei.driver, "rei");
  assert.notEqual(asuka.revision, rei.revision);
  assert.match(asuka.source, /EVA-02 \/\/ NEXUS LINK/);
  assert.match(rei.source, /EVA-00 \/\/ NEXUS LINK/);
  assert.match(asuka.source, /pointer-events/);
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
      "eva-dsh-layer",
      "dataset.phase",
      "NERV",
      "eva-dsh-alert-layer",
      "DSH BOOT 9.9.9",
      "app-ready",
      "prefers-reduced-motion",
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
    "[role=\"tooltip\"]",
    ".bg-user-message",
    ".bg-composer-primary",
    "#eva-codex-skin-overlay",
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
    ".eva-dsh-pilot-face",
    ".eva-dsh-ring-meter",
    "@media (prefers-reduced-motion: reduce)",
  ]) {
    assert.ok(dshBootCss.includes(fragment), `missing DSH boot CSS contract: ${fragment}`);
  }
  assert.ok(!dshBootCss.includes("@import"));
  assert.ok(!/url\(\s*https?:/i.test(dshBootCss));
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
  assert.equal(selectors.selectors.composerPrimary, ".bg-composer-primary");
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
    "--boot-pack", "C:\\Temp\\dsh-boot",
  ]);
  assert.equal(options.mode, "verify");
  assert.equal(options.port, 9456);
  assert.equal(options.driver, "rei");
  assert.equal(options.bootId, "launch-9456");
  assert.equal(options.bootPack, "C:\\Temp\\dsh-boot");
  assert.throws(() => parseArgs(["--port", "80"]), /between/);
  assert.throws(() => parseArgs(["--driver", "system"]), /asuka or rei/);
  assert.throws(() => parseArgs(["--boot-id", "bad id"]), /Boot id/);
  assert.throws(() => parseArgs(["--wat"]), /Unknown argument/);
});
