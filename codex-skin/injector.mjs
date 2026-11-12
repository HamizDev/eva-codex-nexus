#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SKIN_VERSION = "0.4.3";
export const SKIN_ID = "eva-codex-skin";
export const DEFAULT_PORT = 9345;
export const EXACT_MAIN_URL = "app://-/index.html";
export const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
export const DRIVERS = new Set(["asuka", "rei"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, "assets");
const SELECTOR_FILE = path.join(__dirname, "selectors.json");
const SELECTORS = JSON.parse(fs.readFileSync(SELECTOR_FILE, "utf8"));
const SELECTOR_MAP = SELECTORS.selectors;
const SKIN_UI_RUNTIME = fs.readFileSync(path.join(ASSETS, "skin-ui.js"), "utf8");
const STYLE_ID = "eva-codex-skin-style";
const OVERLAY_ID = "eva-codex-skin-overlay";
const BOOT_ID = "eva-codex-skin-boot";
const BOOT_STYLE_ID = "eva-codex-skin-boot-style";
const RUNTIME_KEY = "__EVA_CODEX_SKIN__";
const EARLY_GENERATION_KEY = "__EVA_CODEX_SKIN_EARLY_GENERATION__";
const EARLY_APPLIED_KEY = "__EVA_CODEX_SKIN_EARLY_APPLIED__";
const BOOT_RUNTIME_KEY = "__EVA_CODEX_SKIN_BOOT__";
const BOOT_FINISH_KEY = "__EVA_CODEX_SKIN_BOOT_FINISH__";
const BOOT_RESULT_KEY = "__EVA_CODEX_SKIN_BOOT_RESULT__";
const WELCOME_CONSUMED_KEY = "__EVA_CODEX_SKIN_WELCOME_CONSUMED__";
const BOOT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const EVA_THEME_PACKAGE = "eva-theme-pack";
const EVA_THEME_REQUIRED_ASSETS = ["boot", "emergency", "entryPlug", "asukaHead", "reiHead"];
const EVA_THEME_OPTIONAL_ASSETS = [
  "logo",
  "asukaVoice",
  "reiVoice",
  "asukaPortrait",
  "reiPortrait",
  "asukaPickVoice",
  "reiPickVoice",
  "asukaWelcome",
  "reiWelcome",
  "asukaApproval",
  "reiApproval",
  "asukaComplete",
  "reiComplete",
  "typing",
  "bootBgm",
];
const EVA_THEME_MAX_BYTES = 16 * 1024 * 1024;
const DRIVER_STORAGE_KEY = "eva-codex-skin-driver-v1";
const OPTIONS_STORAGE_KEY = "eva-codex-skin-options-v1";
const FORCE_DRIVER_TOKEN_KEY = "eva-codex-skin-force-driver-token-v1";
const FORCE_DRIVER_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const UI_MEDIA_IDS = [
  "asukaPortrait",
  "reiPortrait",
  "asukaHead",
  "reiHead",
  "asukaVoice",
  "reiVoice",
  "asukaPickVoice",
  "reiPickVoice",
  "asukaWelcome",
  "reiWelcome",
  "asukaApproval",
  "reiApproval",
  "asukaComplete",
  "reiComplete",
  "typing",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isDriver(value) {
  return typeof value === "string" && DRIVERS.has(value);
}

export function classifyTarget(target) {
  let type;
  let value;
  try {
    type = target?.type;
    value = target?.url;
  } catch {
    return "unknown";
  }
  if (type !== "page" || typeof value !== "string") return "unknown";
  if (value === EXACT_MAIN_URL) return "main";

  let url;
  try {
    url = new URL(value);
  } catch {
    return "unknown";
  }
  if (
    url.protocol !== "app:" ||
    url.hostname !== "-" ||
    url.pathname !== "/index.html" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  ) {
    return "unknown";
  }
  if (
    url.searchParams.get("initialRoute") === "/avatar-overlay" ||
    url.searchParams.get("initialRoute")?.endsWith("/avatar-overlay")
  ) {
    return "overlay";
  }
  return "unknown";
}

export function validateDebuggerUrl(target, port) {
  if (!target?.webSocketDebuggerUrl) throw new Error("CDP target has no WebSocket URL");
  const url = new URL(target.webSocketDebuggerUrl);
  if (url.protocol !== "ws:") throw new Error("Rejected non-WebSocket CDP URL");
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`Rejected non-loopback CDP host: ${url.hostname}`);
  }
  if (Number(url.port) !== Number(port)) {
    throw new Error(`Rejected CDP URL on unexpected port: ${url.port}`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("Rejected CDP URL with credentials, query or fragment");
  }
  if (!/^\/devtools\/page\/[A-Za-z0-9._-]+$/.test(url.pathname)) {
    throw new Error(`Rejected unexpected CDP path: ${url.pathname}`);
  }
  return url.href;
}

export function buildProbeExpression() {
  return `(() => {
    const s = ${JSON.stringify(SELECTOR_MAP)};
    const q = (selector) => {
      try { return document.querySelector(selector); } catch { return null; }
    };
    const visible = (node) => {
      if (!(node instanceof Element) || !node.isConnected) return false;
      if (node.closest("[hidden], [inert], [aria-hidden='true']")) return false;
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 &&
        style.display !== "none" && style.visibility !== "hidden";
    };
    const modeButton = [...document.querySelectorAll("button")].find((button) => {
      const rect = button.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || rect.left > 360 || rect.top > 160) return false;
      const text = (button.textContent || "").trim();
      const label = button.getAttribute("aria-label") || "";
      return text === "Codex" || text === "ChatGPT" ||
        /(?:current mode|当前模式).*(?:Codex|ChatGPT)/i.test(label);
    }) || null;
    const markers = {
      shell: Boolean(q(s.shellMain)),
      sidebar: Boolean(q(s.sidebar)),
      header: Boolean(q(s.header)),
      home: Boolean(q(s.homeIcon)),
      composer: Boolean(q(s.composer)),
      input: Boolean(q(s.composerInput)),
      settings: Boolean(q(s.settingsPanel)),
      branded: Boolean(q(s.brandedSurface)),
    };
    const modeText = (modeButton?.textContent || "").trim();
    const modeLabel = modeButton?.getAttribute("aria-label") || "";
    const lowerText = modeText.toLowerCase();
    const lowerLabel = modeLabel.toLowerCase();
    const appMode = lowerText === "chatgpt" || lowerLabel.includes("chatgpt")
      ? "chatgpt"
      : (lowerText === "codex" || lowerLabel.includes("codex") ? "codex" : "unknown");
    const hasShell = markers.shell && markers.sidebar &&
      (markers.composer || markers.home || markers.input || markers.branded);
    return {
      title: document.title,
      href: location.href,
      visibility: document.visibilityState,
      appMode,
      markers,
      codex: Boolean(hasShell || markers.settings),
      viewport: { width: innerWidth, height: innerHeight },
      visible: {
        shell: visible(q(s.shellMain)),
        sidebar: visible(q(s.sidebar)),
        settings: visible(q(s.settingsPanel))
      }
    };
  })()`;
}

export function buildVerifyExpression() {
  return `(() => {
    const style = document.getElementById(${JSON.stringify(STYLE_ID)});
    const overlay = document.getElementById(${JSON.stringify(OVERLAY_ID)});
    const root = document.documentElement;
    const sidebar = document.querySelector(${JSON.stringify(SELECTOR_MAP.sidebar)});
    const main = document.querySelector(${JSON.stringify(SELECTOR_MAP.shellMain)});
    const settings = document.querySelector(${JSON.stringify(SELECTOR_MAP.settingsPanel)});
    const settingsButton = overlay?.querySelector(".eva-settings-button") || null;
    const configPanel = overlay?.querySelector(".eva-config-panel") || null;
    const box = (node) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      return {
        x: Math.round(rect.x), y: Math.round(rect.y),
        width: Math.round(rect.width), height: Math.round(rect.height),
        visible: rect.width > 0 && rect.height > 0 &&
          css.display !== "none" && css.visibility !== "hidden"
      };
    };
    const overlayBox = box(overlay);
    const settingsBox = box(settingsButton);
    const settingsPointerEvents = settingsButton
      ? getComputedStyle(settingsButton).pointerEvents
      : null;
    const settingsInsideViewport = Boolean(
      settingsBox &&
      settingsBox.x >= 0 &&
      settingsBox.y >= 0 &&
      settingsBox.x + settingsBox.width <= innerWidth + 1 &&
      settingsBox.y + settingsBox.height <= innerHeight + 1
    );
    const result = {
      installed: Boolean(root && root.dataset.evaSkin),
      driver: root?.dataset.evaSkin || null,
      version: root?.dataset.evaSkinVersion || null,
      stylePresent: Boolean(style),
      overlayPresent: Boolean(overlay),
      overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
      settingsUi: {
        buttonPresent: Boolean(settingsButton),
        buttonVisible: settingsBox?.visible === true,
        buttonPointerEvents: settingsPointerEvents,
        buttonInsideViewport: settingsInsideViewport,
        panelPresent: Boolean(configPanel),
        panelHidden: configPanel?.hidden === true,
        pilotButtonCount: configPanel?.querySelectorAll("[data-eva-ui-driver]").length || 0,
        previewButtonCount: configPanel?.querySelectorAll(".eva-config-preview").length || 0,
      },
      layout: {
        overlay: overlayBox,
        fillsViewport: Boolean(
          overlayBox &&
          Math.abs(overlayBox.x) <= 1 &&
          Math.abs(overlayBox.y) <= 1 &&
          Math.abs(overlayBox.width - innerWidth) <= 1 &&
          Math.abs(overlayBox.height - innerHeight) <= 1
        ),
      },
      sidebar: box(sidebar),
      main: box(main),
      settings: box(settings),
      visibility: document.visibilityState,
      viewport: { width: innerWidth, height: innerHeight },
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    };
    result.pass = Boolean(
      result.installed === true &&
      result.driver &&
      result.version === ${JSON.stringify(SKIN_VERSION)} &&
      result.stylePresent === true &&
      result.overlayPresent === true &&
      result.overlayPointerEvents === "none" &&
      result.settingsUi.buttonPresent === true &&
      result.settingsUi.buttonVisible === true &&
      result.settingsUi.buttonPointerEvents === "auto" &&
      result.settingsUi.buttonInsideViewport === true &&
      result.settingsUi.panelPresent === true &&
      result.settingsUi.pilotButtonCount === 2 &&
      result.settingsUi.previewButtonCount === 5 &&
      result.layout.fillsViewport === true &&
      (result.sidebar?.visible || result.main?.visible || result.settings?.visible) &&
      result.overflowX === false
    );
    return result;
  })()`;
}

export function buildActiveDriverExpression() {
  return `(() => {
    const value = document.documentElement?.dataset?.evaSkin;
    return value === "asuka" || value === "rei" ? value : null;
  })()`;
}

function svgDataUrl(filePath) {
  const bytes = fs.readFileSync(filePath);
  return `data:image/svg+xml;base64,${bytes.toString("base64")}`;
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function resolvePackFile(root, relative) {
  if (typeof relative !== "string" || !relative || path.isAbsolute(relative)) {
    throw new Error("EVA theme pack contains an invalid asset path");
  }
  const full = path.resolve(root, relative);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("EVA theme pack asset escapes its directory");
  }
  return full;
}

export function loadEvaThemePack(packRoot) {
  if (!packRoot) return null;
  const root = path.resolve(packRoot);
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  if (manifest?.schemaVersion !== 1 || manifest?.package !== EVA_THEME_PACKAGE) {
    throw new Error("EVA theme pack manifest has an unsupported schema");
  }
  if (!Array.isArray(manifest.assets)) throw new Error("EVA theme pack has no asset list");
  const entries = new Map();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== "string" || entries.has(asset.id)) {
      throw new Error("EVA theme pack contains a duplicate or invalid asset");
    }
    entries.set(asset.id, asset);
  }
  for (const id of EVA_THEME_REQUIRED_ASSETS) {
    if (!entries.has(id)) throw new Error(`EVA theme pack is missing required asset: ${id}`);
  }
  const allowed = new Set([...EVA_THEME_REQUIRED_ASSETS, ...EVA_THEME_OPTIONAL_ASSETS]);
  const assets = {};
  const inline = {};
  const hashes = [];
  let totalBytes = 0;
  for (const [id, entry] of entries) {
    if (!allowed.has(id)) continue;
    const filePath = resolvePackFile(root, entry.file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`EVA theme pack asset is missing: ${entry.file}`);
    }
    const bytes = fs.statSync(filePath).size;
    totalBytes += bytes;
    if (totalBytes > EVA_THEME_MAX_BYTES) {
      throw new Error("EVA theme pack exceeds the 16 MiB loading limit");
    }
    if (Number.isInteger(entry.bytes) && entry.bytes !== bytes) {
      throw new Error(`EVA theme pack size mismatch: ${entry.file}`);
    }
    const sha256 = fileSha256(filePath);
    if (typeof entry.sha256 === "string" && entry.sha256.toLowerCase() !== sha256) {
      throw new Error(`EVA theme pack SHA-256 mismatch: ${entry.file}`);
    }
    const type = typeof entry.type === "string" ? entry.type : "";
    if (!/^(?:image\/(?:gif|png|svg\+xml)|audio\/mpeg)$/.test(type)) {
      throw new Error(`EVA theme pack has an unsupported MIME type: ${type}`);
    }
    const data = fs.readFileSync(filePath);
    assets[id] = `data:${type};base64,${data.toString("base64")}`;
    if (type === "image/svg+xml") {
      const markup = data.toString("utf8").replace(/^\uFEFF/, "");
      if (/<\s*script\b|\son[a-z]+\s*=|@import|url\(\s*["']?\s*(?:https?:|\/\/)/i.test(markup)) {
        throw new Error(`EVA theme pack SVG contains active or remote content: ${entry.file}`);
      }
      inline[id] = markup;
    }
    hashes.push(`${id}:${sha256}`);
  }
  return {
    root,
    manifest,
    assets,
    inline,
    revision: crypto.createHash("sha256").update(hashes.sort().join("\n")).digest("hex").slice(0, 24),
  };
}

function bootProfile(driver) {
  return driver === "rei"
    ? {
        unit: "00",
        pilot: "REI AYANAMI",
        pilotCn: "绫波丽 / 零号机",
        unitLabel: "EVANGELION UNIT-00",
        code: "00.00 // FIRST CHILD",
        pattern: "PATTERN: BLUE",
        sync: "96.4",
      }
    : {
        unit: "02",
        pilot: "ASUKA LANGLEY",
        pilotCn: "明日香 / 二号机",
        unitLabel: "EVANGELION UNIT-02",
        code: "02.03 // TEST PILOT",
        pattern: "PATTERN: RED",
        sync: "98.7",
      };
}

function scopeSvgMarkup(markup, scope) {
  const ids = new Map();
  const scoped = String(markup || "").replace(/\bid="([^"]+)"/g, (_, id) => {
    const next = `${scope}-${id}`;
    ids.set(id, next);
    return `id="${next}"`;
  });
  return scoped
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${ids.get(id) || id})`)
    .replace(/\bhref="#([^"]+)"/g, (_, id) => `href="#${ids.get(id) || id}"`);
}

const BOOT_PACK_COPY = Object.freeze({
  "zh-Hant": Object.freeze({
    selectTitle: "選擇你的駕駛員",
    selectHint: "將頭像拖入左側插入栓，或點擊角色卡",
    enterSelect: "進入選擇",
    exit: "跳過並進入",
    drag: "拖入插入栓",
    drop: "拖入駕駛員 · DROP PILOT",
    awaiting: "等待駕駛員選擇 · AWAITING PILOT",
    syncTitle: "駕駛員同步中",
    syncHint: "啟動語音播放結束後進入會話",
    syncState: "駕駛員同步中",
    syncCaption: "AUDIO SYNCHRONIZATION",
    voiceHint: "啟動語音與同步進度",
    syncStatus: "駕駛艙同步中 · LINK ESTABLISHING",
    asuka: "明日香",
    rei: "綾波麗",
    dark: "暗色",
    light: "亮色",
    card: "選擇{pilot}，載入{mode}主題",
    language: "啟動介面語言",
    bgm: "啟動背景音樂",
    bgmOn: "背景音樂播放中 · 點擊靜音",
    bgmOff: "點擊播放啟動背景音樂",
    skip: "跳過 / ESC",
    alert: "NERV 警報啟動畫面",
    handoff: "同步完成，正在進入聊天",
  }),
  "zh-Hans": Object.freeze({
    selectTitle: "选择你的驾驶员",
    selectHint: "将头像拖入左侧插入栓，或点击角色卡",
    enterSelect: "进入选择",
    exit: "跳过并进入",
    drag: "拖入插入栓",
    drop: "拖入驾驶员 · DROP PILOT",
    awaiting: "等待驾驶员选择 · AWAITING PILOT",
    syncTitle: "驾驶员同步中",
    syncHint: "启动语音播放结束后进入会话",
    syncState: "驾驶员同步中",
    syncCaption: "AUDIO SYNCHRONIZATION",
    voiceHint: "启动语音与同步进度",
    syncStatus: "驾驶舱同步中 · LINK ESTABLISHING",
    asuka: "明日香",
    rei: "绫波丽",
    dark: "暗色",
    light: "亮色",
    card: "选择{pilot}，载入{mode}主题",
    language: "启动界面语言",
    bgm: "启动背景音乐",
    bgmOn: "背景音乐播放中 · 点击静音",
    bgmOff: "点击播放启动背景音乐",
    skip: "跳过 / ESC",
    alert: "NERV 警报启动画面",
    handoff: "同步完成，正在进入聊天",
  }),
  ja: Object.freeze({
    selectTitle: "パイロットを選択",
    selectHint: "ポートレートを左のエントリープラグへドラッグ、またはクリック",
    enterSelect: "選択画面へ",
    exit: "スキップして入る",
    drag: "エントリープラグへ",
    drop: "パイロットを挿入 · DROP PILOT",
    awaiting: "パイロット待機中 · AWAITING PILOT",
    syncTitle: "パイロット同期中",
    syncHint: "起動ボイス終了後にチャットへ移行します",
    syncState: "パイロット同期中",
    syncCaption: "AUDIO SYNCHRONIZATION",
    voiceHint: "起動ボイスと同期状況",
    syncStatus: "コックピット同期中 · LINK ESTABLISHING",
    asuka: "アスカ",
    rei: "綾波レイ",
    dark: "ダーク",
    light: "ライト",
    card: "{pilot}を選択、{mode}テーマを読み込む",
    language: "起動画面の言語",
    bgm: "起動 BGM",
    bgmOn: "BGM 再生中 · クリックでミュート",
    bgmOff: "クリックして BGM を再生",
    skip: "スキップ / ESC",
    alert: "NERV 警報起動画面",
    handoff: "同期完了、チャットへ移行中",
  }),
  en: Object.freeze({
    selectTitle: "Select your pilot",
    selectHint: "Drag a portrait into the entry plug, or click to select",
    enterSelect: "Continue",
    exit: "Skip and enter",
    drag: "Drag to plug",
    drop: "DROP PILOT HERE",
    awaiting: "AWAITING PILOT",
    syncTitle: "Synchronizing pilot",
    syncHint: "Enter chat when the startup voice finishes",
    syncState: "PILOT SYNCHRONIZATION",
    syncCaption: "AUDIO SYNCHRONIZATION",
    voiceHint: "Startup voice and synchronization",
    syncStatus: "PILOT SYNC · LINK ESTABLISHING",
    asuka: "Asuka",
    rei: "Rei",
    dark: "Dark",
    light: "Light",
    card: "Select {pilot}, load the {mode} theme",
    language: "Startup interface language",
    bgm: "Startup music",
    bgmOn: "Music playing · Click to mute",
    bgmOff: "Click to play startup music",
    skip: "Skip / ESC",
    alert: "NERV emergency startup",
    handoff: "Sync complete, entering chat",
  }),
});

function buildBootMarkup(driver) {
  const copy = bootProfile(driver);
  return [
    '<div class="eva-boot-grid"></div>',
    '<div class="eva-boot-vignette"></div>',
    '<div class="eva-boot-scan"></div>',
    '<header class="eva-boot-head">',
    '<span><b>NERV</b> // MAGI SYSTEM</span>',
    `<span>${copy.code}</span>`,
    "</header>",
    '<aside class="eva-boot-side eva-boot-side-left">',
    `<span>SYNC</span><b>${copy.sync}</b><span>${copy.pattern}</span>`,
    "</aside>",
    '<aside class="eva-boot-side eva-boot-side-right">',
    "<span>A10 NERVE CLIP</span><b>ACTIVE</b><span>LINK STABLE</span>",
    "</aside>",
    '<div class="eva-boot-center">',
    '<div class="eva-boot-crosshair"></div>',
    '<div class="eva-boot-ring eva-boot-ring-a"></div>',
    '<div class="eva-boot-ring eva-boot-ring-b"></div>',
    `<div class="eva-boot-number">${copy.unit}</div>`,
    `<div class="eva-boot-unit">${copy.unitLabel}</div>`,
    `<div class="eva-boot-pilot">${copy.pilot}<small>${copy.pilotCn}</small></div>`,
    "</div>",
    '<div class="eva-boot-progress">',
    '<div class="eva-boot-progress-head"><span>NEURAL LINK / SYNC RATIO</span>',
    `<b>${copy.sync}%</b></div>`,
    '<div class="eva-boot-progress-track"><i></i></div>',
    '<div class="eva-boot-progress-foot"><span>SYNCHRONIZATION</span><span>STABLE</span></div>',
    "</div>",
    '<footer class="eva-boot-foot">',
    "<span>点击或按 ESC 跳过</span>",
    '<span class="eva-boot-link">LINK START</span>',
    "</footer>",
  ].join("");
}

function buildBootPackMarkup(driver, pack, syncSecondsByDriver) {
  const copy = bootProfile(driver);
  const syncSeconds = syncSecondsByDriver[driver];
  const mode = driver === "rei" ? "LIGHT / UNIT 00" : "DARK / UNIT 02";
  const sourceVersion = String(pack.manifest.sourceVersion || "").trim();
  const sourceCommit = String(pack.manifest.sourceCommit || "").trim().slice(0, 8);
  const source = [
    sourceVersion ? `EVA BOOT ${sourceVersion}` : "EVA BOOT",
    sourceCommit,
  ].filter(Boolean).join(" / ");
  const logo = pack.assets.logo || "";
  const entryPlug = {
    select: scopeSvgMarkup(pack.inline.entryPlug || "", "select"),
    sync: scopeSvgMarkup(pack.inline.entryPlug || "", "sync"),
  };
  const pilotCards = ["asuka", "rei"].map((pilot) => {
    const profile = bootProfile(pilot);
    const label = pilot === "rei" ? "绫波丽" : "明日香";
    return [
      `<button type="button" class="eva-boot-pilot-card" data-eva-pilot="${pilot}"`,
      ` data-unit="${profile.unit}" aria-label="选择${label}（EVA-${profile.unit}）" aria-pressed="false" draggable="true">`,
      `<span class="eva-boot-pilot-card-top"><span>PILOT / ${pilot === "rei" ? "FIRST CHILD" : "SECOND CHILD"}</span><i>NEURAL ID · ${profile.unit}</i></span>`,
      '<span class="eva-boot-pilot-card-face"></span>',
      '<span class="eva-boot-pilot-card-copy">',
      `<b data-eva-boot-unit>${profile.unit}</b><strong data-eva-boot-pilot>${label}</strong><small>${profile.pilot}</small>`,
      `<em data-eva-boot-mode>${pilot === "rei" ? "亮色 / UNIT 00" : "暗色 / UNIT 02"}</em>`,
      '</span><span class="eva-boot-pilot-card-watermark" aria-hidden="true">' + profile.unit + '</span>',
      '<span class="eva-boot-pilot-card-drag" data-eva-boot-text="drag">拖入插入栓</span></button>',
    ].join("");
  }).join("");
  const contourRings = Array.from({ length: 16 }, (_, index) => (
    `<span class="eva-boot-contour-ring" style="--i:${index}"></span>`
  )).join("");
  const logoMarkup = logo ? '<span class="eva-boot-logo" aria-hidden="true"></span>' : "";
  const emergencyMarkup = pack.inline.emergency
    ? `<div class="eva-boot-alert-art" aria-hidden="true">${pack.inline.emergency}</div>`
    : `<img class="eva-boot-alert-art" src="${pack.assets.emergency}" alt="">`;
  return [
    '<div class="eva-boot-atmosphere" aria-hidden="true">',
    `<div class="eva-boot-contour-map">${contourRings}</div>`,
    '<span class="eva-boot-watermark">NERV</span>',
    '<i class="eva-boot-rail left"></i><i class="eva-boot-rail right"></i>',
    '<span class="eva-boot-atmosphere-code">TOKYO-III // CENTRAL DOGMA // 00:07</span>',
    "</div>",
    '<div class="eva-boot-layer eva-boot-intro-layer" data-eva-layer="intro">',
    '<div class="eva-boot-intro-pilot" data-eva-pilot-intro="asuka" aria-hidden="true">',
    '<span class="eva-boot-intro-face"></span>',
    "<b>02</b><small>ASUKA LANGLEY</small>",
    "</div>",
    '<div class="eva-boot-intro-copy">',
    '<p class="eva-boot-intro-kicker">NERV / PILOT AUTHENTICATION</p>',
    '<h1 class="eva-boot-intro-title" aria-label="選擇你的駕駛員">',
    '<span class="eva-boot-intro-measure" aria-hidden="true">選擇你的駕駛員</span>',
    '<span class="eva-boot-intro-typed" aria-hidden="true"></span>',
    "</h1>",
    '<p class="eva-boot-intro-sub">SPECIAL AGENCY · CENTRAL DOGMA · LEVEL 07</p>',
    '<i class="eva-boot-intro-rule" aria-hidden="true"></i>',
    "</div>",
    '<div class="eva-boot-intro-pilot" data-eva-pilot-intro="rei" aria-hidden="true">',
    '<span class="eva-boot-intro-face"></span>',
    "<b>00</b><small>REI AYANAMI</small>",
    "</div>",
    '<div class="eva-boot-intro-hud"><span>TOKYO-III / NERV</span><time data-eva-clock>--:--:--</time><small>PILOT AUTHENTICATION</small></div>',
    '<button type="button" class="eva-boot-intro-next" data-eva-boot-text="enterSelect">進入選擇</button>',
    "</div>",
    '<div class="eva-boot-layer eva-boot-gif-layer" data-eva-layer="gif">',
    `<img class="eva-boot-gif" src="${pack.assets.boot}" alt="" width="256" height="256">`,
    "</div>",
    '<div class="eva-boot-layer eva-boot-alert-layer" data-eva-layer="emergency">',
    emergencyMarkup,
    '<div class="eva-boot-alert-scan" aria-hidden="true"></div>',
    '<div class="eva-boot-alert-copy">',
    "<b>EMERGENCY</b>",
    "<span>GOD'S IN HIS HEAVEN.<br>ALL'S RIGHT WITH THE WORLD.</span>",
    '<div class="eva-boot-alert-clock"><time data-eva-clock>--:--:--</time><small>LOCAL TIME · TOKYO-III</small></div>',
    "<small>TOKYO-III // NERV CENTRAL DOGMA // LEVEL 07</small>",
    "</div>",
    "</div>",
    '<div class="eva-boot-layer eva-boot-select-layer" data-eva-layer="select">',
    '<header class="eva-boot-head">',
    '<div class="eva-boot-heading"><div class="eva-boot-brand">' + logoMarkup,
    '<span class="eva-boot-kicker"><b>NERV</b> // PILOT AUTHENTICATION<small>SPECIAL AGENCY · CENTRAL DOGMA</small></span></div>',
    '<h1 class="eva-boot-title" data-eva-boot-text="selectTitle">選擇你的駕駛員</h1>',
    '<p class="eva-boot-hint" data-eva-boot-text="selectHint">將頭像拖入左側插入栓，或點擊角色卡</p></div>',
    '<div class="eva-boot-head-code"><span class="eva-boot-security">TOKYO-III<b>NEURAL INTERFACE · LEVEL 07</b></span>',
    '<span class="eva-boot-live-clock"><b data-eva-clock>--:--:--</b><small>LOCAL</small></span>',
    '<div class="eva-boot-languages" role="group"><button type="button" data-eva-boot-lang="zh-Hant" lang="zh-Hant">繁</button><button type="button" data-eva-boot-lang="zh-Hans" lang="zh-Hans">简</button><button type="button" data-eva-boot-lang="ja" lang="ja">日本語</button><button type="button" data-eva-boot-lang="en" lang="en">EN</button></div>',
    '<button type="button" class="eva-boot-exit" data-eva-boot-text="exit">跳過並進入</button></div>',
    "</header>",
    '<main class="eva-boot-select-grid">',
    '<section class="eva-boot-bay eva-boot-select-bay" data-eva-dropzone="true">',
    '<span class="eva-boot-bay-label">NERV / ENTRY SYSTEM<b>INSERT PILOT / DRAG OR CLICK</b></span>',
    '<div class="eva-boot-plug eva-boot-select-plug" role="img" aria-label="Entry Plug">' + entryPlug.select + "</div>",
    '<span class="eva-boot-bay-lock">INTERLOCK / STANDBY</span>',
    '<span class="eva-boot-bay-target" data-eva-boot-text="drop">拖入駕駛員 · DROP PILOT</span>',
    "</section>",
    '<section class="eva-boot-pilot-select">',
    '<div class="eva-boot-pilot-cards">',
    pilotCards,
    "</div>",
    '<p class="eva-boot-select-hint"><b>NERV / OPERATION</b><span data-eva-boot-text="selectHint">將頭像拖入左側插入栓，或點擊角色卡</span></p>',
    "</section>",
    "</main>",
    '<footer class="eva-boot-foot"><span class="eva-boot-status"><i></i><span data-eva-boot-text="awaiting">等待駕駛員選擇 · AWAITING PILOT</span></span>',
    '<span class="eva-boot-magi">MELCHIOR·1 / BALTHASAR·2 / CASPER·3</span></footer>',
    "</div>",
    '<div class="eva-boot-layer eva-boot-console-layer" data-eva-layer="sync">',
    '<header class="eva-boot-head">',
    '<div class="eva-boot-heading"><div class="eva-boot-brand">' + logoMarkup,
    '<span class="eva-boot-kicker"><b>NERV</b> // MAGI SYSTEM<small>SPECIAL AGENCY · CENTRAL DOGMA</small></span></div>',
    `<h1 class="eva-boot-title" data-eva-boot-text="syncTitle">駕駛員同步中</h1><p class="eva-boot-hint" data-eva-boot-text="syncHint">啟動語音播放結束後進入會話</p><small class="eva-boot-source">${source}</small></div>`,
    '<span class="eva-boot-head-code"><span class="eva-boot-security">TOKYO-III<b>NEURAL INTERFACE · LEVEL 07</b></span><span class="eva-boot-live-clock"><b data-eva-clock>--:--:--</b><small>LOCAL</small></span></span>',
    "</header>",
    '<main class="eva-boot-grid">',
    '<section class="eva-boot-bay">',
    '<span class="eva-boot-bay-label">NERV / ENTRY SYSTEM<b>ENTRY PLUG / CONNECTED</b></span>',
    '<div class="eva-boot-plug" role="img" aria-label="Entry Plug">' + entryPlug.sync + "</div>",
    '<span class="eva-boot-bay-lock">INTERLOCK / ENGAGED</span>',
    '<span class="eva-boot-bay-target">驾驶员已装载 · PILOT LOADED</span>',
    "</section>",
    '<section class="eva-boot-panel">',
    '<div class="eva-boot-pilot">',
    '<span class="eva-boot-sync-portrait" data-eva-sync-portrait aria-hidden="true"></span>',
    '<span class="eva-boot-pilot-face" data-eva-sync-face></span>',
    '<div class="eva-boot-pilot-copy">',
    `<span class="eva-boot-unit">${copy.unit}</span>`,
    `<h1>${copy.pilotCn}</h1><p>${copy.pilot}</p>`,
    `<small>${copy.unitLabel}<br>${mode}</small>`,
    "</div>",
    "</div>",
    '<div class="eva-boot-sync-console">',
    '<div class="eva-boot-sync-ring" aria-hidden="true">',
    '<svg viewBox="0 0 180 180" fill="none" stroke="currentColor">',
    '<circle cx="90" cy="90" r="86" stroke-dasharray="1 7" opacity=".4"/>',
    '<circle cx="90" cy="90" r="70" stroke-width="3" opacity=".15"/>',
    '<circle class="eva-boot-ring-meter" cx="90" cy="90" r="70" stroke-width="3" pathLength="100"/>',
    '<path d="M90 0v9m90 81h-9M90 180v-9M0 90h9" opacity=".8"/>',
    "</svg>",
    '<span class="eva-boot-percent">00%</span><small>SYNC RATIO</small>',
    "</div>",
    '<div class="eva-boot-sync-copy"><span class="eva-boot-live"><i></i><span data-eva-boot-text="syncState">駕駛員同步中</span></span>',
    `<h2>${driver === "rei" ? "绫波丽" : "明日香"}</h2><p><span data-eva-boot-text="voiceHint">啟動語音與同步進度</span><br><span class="eva-boot-sync-caption" data-eva-boot-text="syncCaption">AUDIO SYNCHRONIZATION</span></p>`,
    '<div class="eva-boot-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>',
    `<div class="eva-boot-meter-copy"><span>00%</span><span>00:00 / 00:${String(syncSeconds).padStart(2, "0")}</span></div><div class="eva-boot-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>`,
    "</div>",
    '<div class="eva-boot-systems" aria-hidden="true">',
    "<span>A10 INTERFACE<b>CONNECTED</b></span><span>L.C.L. CHAMBER<b>SEALED</b></span><span>MAGI SYSTEM<b>STABLE</b></span>",
    "</div>",
    "</section>",
    "</main>",
    '<footer class="eva-boot-foot"><span class="eva-boot-status"><i></i><span data-eva-boot-text="syncStatus">駕駛艙同步中 · LINK ESTABLISHING</span></span>',
    '<span class="eva-boot-magi">MELCHIOR·1 / BALTHASAR·2 / CASPER·3</span></footer>',
    "</div>",
    '<button type="button" class="eva-boot-sound" aria-label="启动背景音乐" aria-pressed="false"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="m11 4-6 5H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/><path class="eva-sound-slash" d="m3 3 18 18"/></svg></button>',
    '<button type="button" class="eva-boot-skip" aria-label="跳过启动动画">跳過 / ESC</button>',
    '<audio class="eva-boot-pick-voice" preload="auto"></audio>',
    '<audio class="eva-boot-voice" preload="auto"></audio>',
    '<audio class="eva-boot-bgm" preload="auto" loop></audio>',
    '<audio class="eva-boot-typing" preload="auto"></audio>',
  ].join("");
}

export function buildBootSource({ driver, css, bootId }) {
  if (!isDriver(driver)) throw new Error(`Unknown EVA driver: ${String(driver)}`);
  if (typeof bootId !== "string" || !BOOT_ID_PATTERN.test(bootId)) {
    throw new Error("Boot id must contain only letters, digits, dot, dash or underscore");
  }
  const markup = buildBootMarkup(driver);
  return `(() => {
    const bootId = ${JSON.stringify(bootId)};
    const driver = ${JSON.stringify(driver)};
    const styleId = ${JSON.stringify(BOOT_STYLE_ID)};
    const elementId = ${JSON.stringify(BOOT_ID)};
    const storageKey = "eva-codex-skin-boot-launch";
    const runtimeKey = ${JSON.stringify(BOOT_RUNTIME_KEY)};
    const finishKey = ${JSON.stringify(BOOT_FINISH_KEY)};
    const optionsKey = ${JSON.stringify(OPTIONS_STORAGE_KEY)};
    let bootOptions = {};
    try {
      bootOptions = JSON.parse(localStorage.getItem(optionsKey) || "{}") || {};
    } catch {}
    if (bootOptions.boot === false) {
      return { played: false, reason: "disabled" };
    }
    if (window[runtimeKey]?.bootId === bootId) {
      return { played: false, reason: "already-installed" };
    }
    try {
      if (localStorage.getItem(storageKey) === bootId) {
        return { played: false, reason: "already-played" };
      }
    } catch {}
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return { played: false, reason: "reduced-motion" };
    }
    const root = document.documentElement;
    if (!root) return { played: false, reason: "missing-documentElement" };
    const boot = document.createElement("div");
    boot.id = elementId;
    boot.dataset.driver = driver;
    boot.setAttribute("aria-hidden", "true");
    boot.innerHTML = ${JSON.stringify(markup)};
    let shownAt = 0;
    let leaving = false;
    let finishedPlayback = false;
    let attemptTimer = null;
    let attemptDeadline = 0;
    let finishTimer = null;
    let cleanupTimer = null;
    let mounted = false;
    const removeListeners = () => {
      window.removeEventListener("keydown", onKey, true);
      boot.removeEventListener("click", onSkip);
      window.removeEventListener("pagehide", onPageHide);
    };
    const cleanup = () => {
      if (attemptTimer) clearInterval(attemptTimer);
      if (finishTimer) clearTimeout(finishTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      attemptTimer = null;
      finishTimer = null;
      cleanupTimer = null;
      removeListeners();
      if (!finishedPlayback) {
        try { localStorage.removeItem(storageKey); } catch {}
      }
      try { boot.remove(); } catch {}
      try { document.getElementById(styleId)?.remove(); } catch {}
      try { delete root.dataset.evaBoot; } catch {
        root.removeAttribute("data-eva-boot");
      }
      if (window[runtimeKey]?.bootId === bootId) {
        try { delete window[runtimeKey]; } catch {
          window[runtimeKey] = undefined;
        }
      }
      if (window[finishKey] === finish) {
        try { delete window[finishKey]; } catch {
          window[finishKey] = undefined;
        }
      }
    };
    const finish = () => {
      if (leaving || !mounted) return;
      leaving = true;
      finishedPlayback = true;
      try { localStorage.setItem(storageKey, bootId); } catch {}
      if (finishTimer) clearTimeout(finishTimer);
      const elapsed = performance.now() - shownAt;
      const delay = Math.max(0, 1900 - elapsed);
      finishTimer = setTimeout(() => {
        boot.classList.add("is-leaving");
        boot.style.pointerEvents = "none";
        cleanupTimer = setTimeout(cleanup, 420);
      }, delay);
    };
    const onSkip = (event) => {
      event.preventDefault();
      event.stopPropagation();
      finish();
    };
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        finish();
      }
    };
    const onPageHide = () => {
      if (finishedPlayback) return;
      try { localStorage.removeItem(storageKey); } catch {}
    };
    const install = () => {
      if (!document.body) return false;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = ${JSON.stringify(css)};
        (document.head || document.documentElement).appendChild(style);
      }
      if (!document.getElementById(elementId)) {
        document.body.appendChild(boot);
      }
      root.dataset.evaBoot = driver;
      mounted = true;
      shownAt = performance.now();
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("pagehide", onPageHide);
      boot.addEventListener("click", onSkip);
      requestAnimationFrame(() => {
        if (!leaving) boot.classList.add("is-active");
      });
      finishTimer = setTimeout(finish, 4800);
      return true;
    };
    const runtime = { bootId, driver, finish, cleanup, mounted: false };
    window[runtimeKey] = runtime;
    window[finishKey] = finish;
    if (install()) {
      runtime.mounted = true;
      return { played: true, driver };
    }
    attemptDeadline = performance.now() + 15000;
    attemptTimer = setInterval(() => {
      if (install()) {
        clearInterval(attemptTimer);
        attemptTimer = null;
        runtime.mounted = true;
        return;
      }
      if (performance.now() >= attemptDeadline) {
        clearInterval(attemptTimer);
        attemptTimer = null;
        cleanup();
      }
    }, 32);
    return { played: true, driver, waitingForBody: true };
  })()`;
}

export function buildBootPackSource({ driver, css, bootId, pack, forceDriverToken = null }) {
  if (!isDriver(driver)) throw new Error(`Unknown EVA driver: ${String(driver)}`);
  if (typeof bootId !== "string" || !BOOT_ID_PATTERN.test(bootId)) {
    throw new Error("Boot id must contain only letters, digits, dot, dash or underscore");
  }
  if (!pack?.assets?.boot || !pack?.assets?.emergency || !pack?.assets?.entryPlug) {
    throw new Error("EVA theme pack is incomplete");
  }
  const assetEntry = (id) => (
    Array.isArray(pack.manifest.assets)
      ? pack.manifest.assets.find((asset) => asset?.id === id)
      : null
  );
  const syncMsFor = (pilot) => {
    const entry = assetEntry(pilot === "rei" ? "reiVoice" : "asukaVoice");
    return Number.isFinite(entry?.durationSeconds)
      ? Math.max(3000, Math.min(12000, Math.round(entry.durationSeconds * 1000)))
      : 4600;
  };
  const syncMsByDriver = {
    asuka: syncMsFor("asuka"),
    rei: syncMsFor("rei"),
  };
  const syncSecondsByDriver = {
    asuka: Math.max(1, Math.round(syncMsByDriver.asuka / 1000)),
    rei: Math.max(1, Math.round(syncMsByDriver.rei / 1000)),
  };
  const markup = buildBootPackMarkup(driver, pack, syncSecondsByDriver);
  const sourceCommit = pack.manifest.sourceCommit
    ? String(pack.manifest.sourceCommit).slice(0, 8)
    : "local";
  return `(() => {
    const bootId = ${JSON.stringify(bootId)};
    const driver = ${JSON.stringify(driver)};
    const styleId = ${JSON.stringify(BOOT_STYLE_ID)};
    const elementId = ${JSON.stringify(BOOT_ID)};
    const storageKey = "eva-codex-skin-boot-launch";
    const driverStorageKey = ${JSON.stringify(DRIVER_STORAGE_KEY)};
    const runtimeKey = ${JSON.stringify(BOOT_RUNTIME_KEY)};
    const finishKey = ${JSON.stringify(BOOT_FINISH_KEY)};
    const resultKey = ${JSON.stringify(BOOT_RESULT_KEY)};
    const optionsKey = ${JSON.stringify(OPTIONS_STORAGE_KEY)};
    const sourceCommit = ${JSON.stringify(sourceCommit)};
    const brandLogo = ${JSON.stringify(pack.assets.logo || "")};
    const profiles = ${JSON.stringify({
      asuka: bootProfile("asuka"),
      rei: bootProfile("rei"),
    })};
    const forceDriverToken = ${JSON.stringify(forceDriverToken || "")};
    const forceDriverTokenKey = ${JSON.stringify(FORCE_DRIVER_TOKEN_KEY)};
    const heads = ${JSON.stringify({
      asuka: pack.assets.asukaHead || "",
      rei: pack.assets.reiHead || "",
    })};
    const bootVoices = ${JSON.stringify({
      asuka: pack.assets.asukaVoice || "",
      rei: pack.assets.reiVoice || "",
    })};
    const pickVoices = ${JSON.stringify({
      asuka: pack.assets.asukaPickVoice || "",
      rei: pack.assets.reiPickVoice || "",
    })};
    const portraits = ${JSON.stringify({
      asuka: pack.assets.asukaPortrait || "",
      rei: pack.assets.reiPortrait || "",
    })};
    const bootBgm = ${JSON.stringify(pack.assets.bootBgm || "")};
    const typingSound = ${JSON.stringify(pack.assets.typing || "")};
    const bootCopy = ${JSON.stringify(BOOT_PACK_COPY)};
    const bootLanguageKey = "eva-codex-skin-boot-language-v1";
    const syncMsByDriver = ${JSON.stringify(syncMsByDriver)};
    const syncSecondsByDriver = ${JSON.stringify(syncSecondsByDriver)};
    let bootOptions = {};
    try {
      bootOptions = JSON.parse(localStorage.getItem(optionsKey) || "{}") || {};
    } catch {}
    if (bootOptions.boot === false) {
      return { played: false, reason: "disabled" };
    }
    if (window[runtimeKey]?.bootId === bootId) {
      return { played: false, reason: "already-installed" };
    }
    try {
      if (localStorage.getItem(storageKey) === bootId) {
        return { played: false, reason: "already-played" };
      }
    } catch {}
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return { played: false, reason: "reduced-motion" };
    }
    const root = document.documentElement;
    if (!root) return { played: false, reason: "missing-documentElement" };
    const boot = document.createElement("div");
    boot.id = elementId;
    boot.dataset.driver = driver;
    boot.dataset.phase = "gif";
    boot.dataset.bootSource = sourceCommit;
    boot.setAttribute("role", "dialog");
    boot.setAttribute("aria-modal", "true");
    boot.setAttribute("aria-label", "NERV 驾驶员启动序列");
    boot.innerHTML = ${JSON.stringify(markup)};
    if (brandLogo) boot.style.setProperty("--eva-boot-logo", "url('" + brandLogo + "')");
    boot.style.setProperty("--eva-boot-asuka-head", "url('" + heads.asuka + "')");
    boot.style.setProperty("--eva-boot-rei-head", "url('" + heads.rei + "')");
    boot.style.setProperty("--eva-boot-asuka-portrait", "url('" + portraits.asuka + "')");
    boot.style.setProperty("--eva-boot-rei-portrait", "url('" + portraits.rei + "')");
    const bgm = boot.querySelector(".eva-boot-bgm");
    const soundButton = boot.querySelector(".eva-boot-sound");
    const typingAudio = boot.querySelector(".eva-boot-typing");
    const phases = { gif: 3840, emergency: 3000, intro: 4200 };
    let selectedDriver = driver;
    let syncMs = syncMsByDriver[selectedDriver];
    let syncSeconds = syncSecondsByDriver[selectedDriver];
    let language = "zh-Hant";
    try {
      const savedLanguage = localStorage.getItem(bootLanguageKey);
      if (Object.hasOwn(bootCopy, savedLanguage)) language = savedLanguage;
    } catch {}
    let selectionLocked = false;
    let shownAt = 0;
    let mounted = false;
    let leaving = false;
    let finishedPlayback = false;
    let appReady = false;
    let sequenceDone = false;
    let attemptTimer = null;
    let cleanupTimer = null;
    let progressFrame = null;
    let phaseClockFrame = null;
    let phaseClockLast = 0;
    let phaseRemaining = phases.gif;
    let phaseClockDone = false;
    let syncStarted = 0;
    let syncRatio = 0;
    let syncVoiceStarted = false;
    let resultAnnounced = false;
    let clockTimer = null;
    let introTypeTimer = null;
    let introTransitioning = false;
    let bgmFrame = null;
    let bgmStarting = false;
    let bgmWanted = Boolean(bootBgm);
    const timers = new Set();
    const later = (fn, ms) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!leaving) fn();
      }, ms);
      timers.add(timer);
      return timer;
    };
    const stopAudio = () => {
      for (const audio of boot.querySelectorAll("audio")) {
        try { audio.pause(); } catch {}
      }
    };
    const text = (key, pilot = selectedDriver) => {
      const dictionary = bootCopy[language] || bootCopy["zh-Hant"];
      const value = dictionary[key] ?? bootCopy["zh-Hant"][key] ?? key;
      return String(value)
        .replace("{pilot}", pilot === "rei" ? dictionary.rei : dictionary.asuka)
        .replace("{mode}", pilot === "rei" ? dictionary.light : dictionary.dark);
    };
    const paintSound = () => {
      if (!soundButton) return;
      const playing = Boolean(bgmWanted && bgm && !bgm.paused);
      soundButton.hidden = !bootBgm;
      soundButton.setAttribute("aria-pressed", String(playing));
      soundButton.setAttribute("aria-label", text("bgm"));
      soundButton.title = text(playing ? "bgmOn" : "bgmOff");
    };
    const fadeBgm = (target, duration = 380) => {
      if (bgmFrame !== null) cancelAnimationFrame(bgmFrame);
      bgmFrame = null;
      if (!bgm || leaving) return;
      if (bgm.paused) {
        bgm.volume = target;
        return;
      }
      const from = Number(bgm.volume);
      const started = performance.now();
      const step = (now) => {
        bgmFrame = null;
        if (!bgm || leaving) return;
        const ratio = Math.max(0, Math.min(1, (now - started) / duration));
        bgm.volume = Math.max(0, Math.min(1, from + (target - from) * ratio));
        if (ratio < 1) bgmFrame = requestAnimationFrame(step);
      };
      bgmFrame = requestAnimationFrame(step);
    };
    const playBgm = () => {
      if (!bgm || !bgmWanted || bgmStarting || leaving || document.hidden) return;
      if (bgm.dataset.ready !== "true") {
        bgm.dataset.ready = "true";
        bgm.src = bootBgm;
        bgm.volume = 0.24;
        try { bgm.load(); } catch {}
      }
      if (!bgm.paused) {
        paintSound();
        return;
      }
      bgmStarting = true;
      try {
        Promise.resolve(bgm.play()).then(() => {
          bgmStarting = false;
          if (!leaving) paintSound();
        }).catch(() => {
          bgmStarting = false;
          if (!leaving) paintSound();
        });
      } catch {
        bgmStarting = false;
        paintSound();
      }
    };
    const updateClock = () => {
      const now = new Date();
      const time = [
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0"),
      ].join(":");
      for (const node of boot.querySelectorAll("[data-eva-clock], [data-emergency-clock]")) {
        if (node.textContent !== time) node.textContent = time;
      }
    };
    const onBootPointer = (event) => {
      if (!event.target?.closest?.(".eva-boot-sound")) playBgm();
    };
    const onBootKey = (event) => {
      if (!event.target?.closest?.(".eva-boot-sound")) playBgm();
    };
    const removeListeners = () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("focus", onFocusChange);
      window.removeEventListener("blur", onFocusChange);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      boot.removeEventListener("pointerdown", onBootPointer, true);
      boot.removeEventListener("keydown", onBootKey, true);
    };
    const cleanup = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (attemptTimer) clearInterval(attemptTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (progressFrame !== null) cancelAnimationFrame(progressFrame);
      if (phaseClockFrame !== null) cancelAnimationFrame(phaseClockFrame);
      if (bgmFrame !== null) cancelAnimationFrame(bgmFrame);
      if (clockTimer !== null) clearInterval(clockTimer);
      if (introTypeTimer !== null) clearTimeout(introTypeTimer);
      attemptTimer = null;
      cleanupTimer = null;
      progressFrame = null;
      phaseClockFrame = null;
      bgmFrame = null;
      clockTimer = null;
      introTypeTimer = null;
      stopAudio();
      removeListeners();
      if (!finishedPlayback) {
        try { localStorage.removeItem(storageKey); } catch {}
      }
      try { boot.remove(); } catch {}
      try { document.getElementById(styleId)?.remove(); } catch {}
      try { delete root.dataset.evaBoot; } catch {
        root.removeAttribute("data-eva-boot");
      }
      if (window[runtimeKey]?.bootId === bootId) {
        try { delete window[runtimeKey]; } catch {
          window[runtimeKey] = undefined;
        }
      }
      if (window[finishKey] === finish) {
        try { delete window[finishKey]; } catch {
          window[finishKey] = undefined;
        }
      }
    };
    const leave = () => {
      if (leaving) return;
      leaving = true;
      finishedPlayback = true;
      try { localStorage.setItem(storageKey, bootId); } catch {}
      stopAudio();
      if (!resultAnnounced) {
        resultAnnounced = true;
        const detail = {
          bootId,
          driver: selectedDriver,
          completed: Boolean(sequenceDone),
          endedAt: Date.now(),
        };
        try { window[resultKey] = detail; } catch {}
        try {
          window.dispatchEvent(new CustomEvent("eva-skin-boot-finished", { detail }));
        } catch {}
      }
      boot.dataset.phase = "handoff";
      boot.classList.add("is-leaving");
      boot.style.pointerEvents = "none";
      cleanupTimer = setTimeout(cleanup, 760);
    };
    const maybeFinish = () => {
      if (leaving || !sequenceDone) return;
      const elapsed = performance.now() - shownAt;
      if (appReady || elapsed >= 15000) leave();
    };
    const finish = (reason) => {
      if (reason === "app-ready") {
        appReady = true;
        maybeFinish();
        return;
      }
      leave();
    };
    const setPhase = (phase) => {
      if (leaving) return;
      boot.dataset.phase = phase;
      if (phase === "intro") {
        typeIntroTitle();
        fadeBgm(0.24, 420);
      } else if (phase === "select") {
        requestAnimationFrame(() => {
          boot.querySelector(".eva-boot-pilot-card")?.focus?.({ preventScroll: true });
        });
      }
    };
    const typeIntroTitle = () => {
      const typed = boot.querySelector(".eva-boot-intro-typed");
      if (!typed) return;
      if (introTypeTimer !== null) clearTimeout(introTypeTimer);
      const full = text("selectTitle");
      const characters = Array.from(full);
      let count = 0;
      typed.textContent = "";
      if (typingAudio && typingSound && bootOptions.typing !== false) {
        try {
          typingAudio.src = typingSound;
          typingAudio.volume = 0.42;
          typingAudio.currentTime = 0;
          Promise.resolve(typingAudio.play()).catch(() => {});
        } catch {}
      }
      const step = () => {
        introTypeTimer = null;
        if (leaving || boot.dataset.phase !== "intro") return;
        typed.textContent = characters.slice(0, ++count).join("");
        if (count < characters.length) {
          introTypeTimer = setTimeout(step, Math.max(52, Math.min(112, 880 / Math.max(1, characters.length))));
        }
      };
      introTypeTimer = setTimeout(step, 180);
    };
    const transitionIntroToSelect = () => {
      if (leaving) return;
      if (boot.dataset.phase !== "intro") {
        if (boot.dataset.phase === "select") return;
        setPhase("select");
        return;
      }
      if (introTransitioning) return;
      introTransitioning = true;
      if (introTypeTimer !== null) {
        clearTimeout(introTypeTimer);
        introTypeTimer = null;
      }
      const intro = boot.querySelector(".eva-boot-intro-layer");
      const select = boot.querySelector(".eva-boot-select-layer");
      intro?.classList.add("is-leaving");
      select?.classList.add("is-arriving");
      later(() => {
        if (leaving) return;
        setPhase("select");
        intro?.classList.remove("is-leaving");
        select?.classList.remove("is-arriving");
      }, 420);
    };
    const updateSelectedDriver = (pilot) => {
      const profile = profiles[pilot];
      if (!profile) return;
      boot.dataset.driver = pilot;
      for (const card of boot.querySelectorAll("[data-eva-pilot]")) {
        card.setAttribute("aria-pressed", String(card.dataset.evaPilot === pilot));
      }
      const face = boot.querySelector("[data-eva-sync-face]");
      if (face && heads[pilot]) {
        face.style.setProperty("--eva-boot-avatar", "url('" + heads[pilot] + "')");
      }
      const portrait = boot.querySelector("[data-eva-sync-portrait]");
      if (portrait && portraits[pilot]) {
        portrait.style.setProperty("--eva-boot-portrait", "url('" + portraits[pilot] + "')");
        portrait.hidden = false;
      } else if (portrait) {
        portrait.hidden = true;
      }
      const unit = boot.querySelector(".eva-boot-console-layer .eva-boot-unit");
      const name = boot.querySelector(".eva-boot-console-layer .eva-boot-pilot-copy h1");
      const roman = boot.querySelector(".eva-boot-console-layer .eva-boot-pilot-copy p");
      const detail = boot.querySelector(".eva-boot-console-layer .eva-boot-pilot-copy small");
      const code = boot.querySelector(".eva-boot-console-layer .eva-boot-head strong");
      const syncTitle = boot.querySelector(".eva-boot-sync-copy h2");
      if (unit) unit.textContent = profile.unit;
      if (name) name.textContent = profile.pilotCn;
      if (roman) roman.textContent = profile.pilot;
      if (detail) {
        detail.innerHTML = profile.unitLabel + "<br>" +
          (pilot === "rei" ? "LIGHT / UNIT 00" : "DARK / UNIT 02");
      }
      if (code) code.textContent = profile.code;
      if (syncTitle) syncTitle.textContent = text(pilot === "rei" ? "rei" : "asuka");
      for (const node of boot.querySelectorAll("[data-boot-unit]")) {
        node.textContent = profile.unit;
      }
      syncMs = syncMsByDriver[pilot];
      syncSeconds = syncSecondsByDriver[pilot];
      const time = boot.querySelector(".eva-boot-meter-copy span:last-child");
      if (time) time.textContent = "00:00 / 00:" + String(syncSeconds).padStart(2, "0");
      runtime.driver = pilot;
      try {
        const skinRuntime = window[${JSON.stringify(RUNTIME_KEY)}];
        if (skinRuntime?.setDriver) {
          skinRuntime.setDriver(pilot);
        } else {
          localStorage.setItem(driverStorageKey, pilot);
          root.dataset.evaSkin = pilot;
        }
        if (forceDriverToken) {
          localStorage.setItem(forceDriverTokenKey, forceDriverToken);
        }
      } catch {}
    };
    const paintLanguage = () => {
      boot.lang = language;
      for (const node of boot.querySelectorAll("[data-eva-boot-text]")) {
        node.textContent = text(node.dataset.evaBootText);
      }
      for (const node of boot.querySelectorAll("[data-eva-boot-aria]")) {
        node.setAttribute("aria-label", text(node.dataset.evaBootAria));
      }
      for (const button of boot.querySelectorAll("[data-eva-boot-lang]")) {
        button.setAttribute("aria-pressed", String(button.dataset.evaBootLang === language));
      }
      for (const card of boot.querySelectorAll("[data-eva-pilot]")) {
        const pilot = card.dataset.evaPilot;
        if (!profiles[pilot]) continue;
        card.setAttribute("aria-label", text("card", pilot));
        const pilotName = card.querySelector("[data-eva-boot-pilot]");
        const mode = card.querySelector("[data-eva-boot-mode]");
        if (pilotName) pilotName.textContent = text(pilot === "rei" ? "rei" : "asuka");
        if (mode) mode.textContent = (pilot === "rei" ? text("light") : text("dark")) + " / UNIT " + profiles[pilot].unit;
      }
      const introTitle = boot.querySelector(".eva-boot-intro-title");
      const introMeasure = boot.querySelector(".eva-boot-intro-measure");
      if (introTitle) introTitle.setAttribute("aria-label", text("selectTitle"));
      if (introMeasure) introMeasure.textContent = text("selectTitle");
      const languageGroup = boot.querySelector(".eva-boot-languages");
      if (languageGroup) languageGroup.setAttribute("aria-label", text("language"));
      const skipButton = boot.querySelector(".eva-boot-skip");
      if (skipButton) {
        skipButton.textContent = text("skip");
        skipButton.setAttribute("aria-label", text("skip"));
      }
      if (boot.dataset.phase === "intro") typeIntroTitle();
      paintSound();
    };
    const chooseDriver = (pilot) => {
      if (leaving || selectionLocked || !profiles[pilot]) return;
      selectionLocked = true;
      selectedDriver = pilot;
      updateSelectedDriver(pilot);
      const bay = boot.querySelector("[data-eva-dropzone]");
      bay?.classList.remove("is-over");
      bay?.setAttribute("data-loaded", "true");
      fadeBgm(0.07, 320);

      const pick = boot.querySelector(".eva-boot-pick-voice");
      let delay = 520;
      if (pick && pickVoices[pilot] && bootOptions.pickVoice !== false) {
        pick.src = pickVoices[pilot];
        pick.volume = 0.78;
        delay = 1100;
        try {
          const playback = pick.play();
          if (playback && typeof playback.then === "function") {
            playback.then(() => {
              pick.addEventListener("ended", startSync, { once: true });
            }).catch(() => {});
          } else {
            pick.addEventListener("ended", startSync, { once: true });
          }
        } catch {
          pick.addEventListener("ended", startSync, { once: true });
        }
      }
      later(startSync, delay);
    };
    const tickSync = (now) => {
      progressFrame = null;
      if (leaving) return;
      const wallRatio = Math.min(1, Math.max(0, (now - syncStarted) / syncMs));
      const voice = boot.querySelector(".eva-boot-voice");
      let ratio = wallRatio;
      if (syncVoiceStarted && voice) {
        const duration = Number(voice.duration);
        if (Number.isFinite(duration) && duration > 0) {
          ratio = Math.min(1, Math.max(0, Number(voice.currentTime || 0) / duration));
          if (voice.ended) ratio = 1;
        }
      }
      ratio = Math.max(syncRatio, ratio);
      syncRatio = ratio;
      const percent = Math.round(ratio * 100);
      const ring = boot.querySelector(".eva-boot-ring-meter");
      const meter = boot.querySelector(".eva-boot-meter");
      const percentNode = boot.querySelector(".eva-boot-percent");
      const meterPercent = boot.querySelector(".eva-boot-meter-copy span");
      const meterTime = boot.querySelector(".eva-boot-meter-copy span:last-child");
      boot.style.setProperty("--eva-boot-progress", percent);
      if (ring) ring.style.strokeDasharray = percent + " 100";
      if (meter) meter.setAttribute("aria-valuenow", String(percent));
      const label = String(percent).padStart(2, "0") + "%";
      if (percentNode) percentNode.textContent = label;
      if (meterPercent) meterPercent.textContent = label;
      if (meterTime) meterTime.textContent = "00:" + String(Math.floor(ratio * syncSeconds)).padStart(2, "0") + " / 00:" + String(syncSeconds).padStart(2, "0");
      if (ratio < 1) {
        progressFrame = requestAnimationFrame(tickSync);
      } else {
        sequenceDone = true;
        maybeFinish();
      }
    };
    const startSync = () => {
      if (leaving || boot.dataset.phase === "sync") return;
      setPhase("sync");
      fadeBgm(0.045, 500);
      syncStarted = performance.now();
      const voice = boot.querySelector(".eva-boot-voice");
      if (voice && bootOptions.bootVoice !== false) {
        voice.src = bootVoices[selectedDriver] || "";
        voice.volume = 0.75;
        try {
          Promise.resolve(voice.play()).then(() => {
            if (!leaving) syncVoiceStarted = true;
          }).catch(() => {});
        } catch {}
      }
      progressFrame = requestAnimationFrame(tickSync);
      later(() => {
        if (!sequenceDone) {
          sequenceDone = true;
          maybeFinish();
        }
      }, 20000);
    };
    const tickPhaseClock = (now) => {
      phaseClockFrame = null;
      if (leaving || phaseClockDone) return;
      if (!phaseClockLast) phaseClockLast = now;
      const delta = Math.min(1000, Math.max(0, now - phaseClockLast));
      phaseClockLast = now;
      if (!["gif", "emergency", "intro"].includes(boot.dataset.phase)) {
        phaseClockDone = true;
        return;
      }
      if (!document.hidden) {
        phaseRemaining -= delta;
        if (phaseRemaining <= 0) {
          if (boot.dataset.phase === "gif") {
            setPhase("emergency");
            phaseRemaining = phases.emergency;
          } else if (boot.dataset.phase === "emergency") {
            setPhase("intro");
            phaseRemaining = phases.intro;
          } else if (boot.dataset.phase === "intro") {
            transitionIntroToSelect();
            phaseClockDone = true;
            return;
          }
        }
      }
      phaseClockFrame = requestAnimationFrame(tickPhaseClock);
    };
    const onSkip = (event) => {
      event.preventDefault();
      event.stopPropagation();
      leave();
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        leave();
        return;
      }
      if (
        event.key === "Enter" &&
        boot.dataset.phase === "intro" &&
        !event.target?.closest?.("button,a,input,textarea,select,[role='button']")
      ) {
        event.preventDefault();
        event.stopPropagation();
        transitionIntroToSelect();
        return;
      }
      if (
        (event.key === " " || event.key === "Enter") &&
        !event.target?.closest?.("button,a,input,textarea,select,[role='button']")
      ) {
        event.preventDefault();
        event.stopPropagation();
        leave();
      }
    };
    const onPageHide = () => {
      if (finishedPlayback) return;
      try { localStorage.removeItem(storageKey); } catch {}
    };
    const onVisibilityChange = () => {
      phaseClockLast = performance.now();
      if (document.hidden) {
        if (phaseClockFrame !== null) cancelAnimationFrame(phaseClockFrame);
        phaseClockFrame = null;
        if (bgm && !bgm.paused) bgm.pause();
      } else {
        playBgm();
        if (!phaseClockDone && phaseClockFrame === null) {
          phaseClockFrame = requestAnimationFrame(tickPhaseClock);
        }
      }
      paintSound();
    };
    const onFocusChange = () => {
      phaseClockLast = performance.now();
    };
    const install = () => {
      if (!document.body) return false;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = ${JSON.stringify(css)};
        (document.head || document.documentElement).appendChild(style);
      }
      if (!document.getElementById(elementId)) document.body.appendChild(boot);
      root.dataset.evaBoot = driver;
      mounted = true;
      shownAt = performance.now();
      window.addEventListener("keydown", onKey, true);
      window.addEventListener("pagehide", onPageHide);
      window.addEventListener("focus", onFocusChange);
      window.addEventListener("blur", onFocusChange);
      document.addEventListener("visibilitychange", onVisibilityChange);
      boot.addEventListener("pointerdown", onBootPointer, true);
      boot.addEventListener("keydown", onBootKey, true);
      boot.querySelector(".eva-boot-intro-next")?.addEventListener("click", transitionIntroToSelect);
      soundButton?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!bgm) return;
        if (!bgm.paused) {
          bgmWanted = false;
          bgm.pause();
          if (bgmFrame !== null) cancelAnimationFrame(bgmFrame);
          bgmFrame = null;
        } else {
          bgmWanted = true;
          playBgm();
        }
        paintSound();
      });
      bgm?.addEventListener("playing", () => {
        if (!leaving) paintSound();
      });
      bgm?.addEventListener("pause", () => {
        if (!leaving) paintSound();
      });
      bgm?.addEventListener("error", () => {
        bgmWanted = false;
        paintSound();
      });
      for (const button of boot.querySelectorAll("[data-eva-boot-lang]")) {
        button.addEventListener("click", () => {
          language = button.dataset.evaBootLang;
          try { localStorage.setItem(bootLanguageKey, language); } catch {}
          paintLanguage();
        });
      }
      boot.querySelector(".eva-boot-skip")?.addEventListener("click", onSkip);
      for (const card of boot.querySelectorAll("[data-eva-pilot]")) {
        card.addEventListener("click", () => chooseDriver(card.dataset.evaPilot));
        card.addEventListener("dragstart", (event) => {
          const pilot = card.dataset.evaPilot;
          card.classList.add("is-dragging");
          try {
            event.dataTransfer.effectAllowed = "copy";
            event.dataTransfer.setData("application/x-eva-pilot", pilot);
            event.dataTransfer.setData("text/plain", pilot);
          } catch {}
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("is-dragging");
          boot.querySelector("[data-eva-dropzone]")?.classList.remove("is-over");
        });
      }
      const bay = boot.querySelector("[data-eva-dropzone]");
      if (bay) {
        bay.addEventListener("dragover", (event) => {
          if (selectionLocked) return;
          event.preventDefault();
          event.stopPropagation();
          try { event.dataTransfer.dropEffect = "copy"; } catch {}
          bay.classList.add("is-over");
        });
        bay.addEventListener("dragleave", (event) => {
          if (event.relatedTarget && bay.contains(event.relatedTarget)) return;
          bay.classList.remove("is-over");
        });
        bay.addEventListener("drop", (event) => {
          if (selectionLocked) return;
          event.preventDefault();
          event.stopPropagation();
          bay.classList.remove("is-over");
          let pilot = "";
          try {
            pilot = event.dataTransfer.getData("application/x-eva-pilot") ||
              event.dataTransfer.getData("text/plain");
          } catch {}
          chooseDriver(pilot);
        });
      }
      requestAnimationFrame(() => {
        if (!leaving) {
          boot.classList.add("is-active");
          paintLanguage();
          playBgm();
        }
      });
      updateClock();
      clockTimer = setInterval(updateClock, 1000);
      phaseClockLast = 0;
      phaseRemaining = phases.gif;
      phaseClockDone = false;
      phaseClockFrame = requestAnimationFrame(tickPhaseClock);
      later(() => {
        appReady = true;
        maybeFinish();
      }, 15000);
      return true;
    };
    const runtime = { bootId, driver, finish, cleanup, mounted: false };
    window[runtimeKey] = runtime;
    window[finishKey] = finish;
    if (install()) {
      runtime.mounted = true;
      return { played: true, driver, source: sourceCommit };
    }
    attemptTimer = setInterval(() => {
      if (install()) {
        clearInterval(attemptTimer);
        attemptTimer = null;
        runtime.mounted = true;
      }
    }, 80);
    later(() => {
      if (attemptTimer) clearInterval(attemptTimer);
      attemptTimer = null;
      if (!mounted) cleanup();
    }, 15000);
    return { played: false, reason: "waiting-for-body" };
  })()`;
}

export function buildInstallSource({
  driver,
  css,
  linework,
  mark,
  marks = null,
  version = SKIN_VERSION,
  forceDriverToken = null,
  media = {},
  packVersion = null,
  packCommit = null,
}) {
  if (!isDriver(driver)) throw new Error(`Unknown EVA driver: ${String(driver)}`);
  if (
    forceDriverToken !== null &&
    (typeof forceDriverToken !== "string" ||
      !FORCE_DRIVER_TOKEN_PATTERN.test(forceDriverToken))
  ) {
    throw new Error(
      "Force driver token must contain only letters, digits, dot, dash or underscore",
    );
  }
  const markSet = marks && typeof marks.asuka === "string" && typeof marks.rei === "string"
    ? marks
    : { asuka: mark, rei: mark };
  return `(() => {
    ${SKIN_UI_RUNTIME}
    const previous = window[${JSON.stringify(RUNTIME_KEY)}];
    if (previous?.cleanup) {
      try { previous.cleanup(); } catch {}
    }
    const requestedDriver = ${JSON.stringify(driver)};
    const version = ${JSON.stringify(version)};
    const linework = ${JSON.stringify(linework)};
    const marks = ${JSON.stringify(markSet)};
    const forceDriverToken = ${JSON.stringify(forceDriverToken || "")};
    const driverStorageKey = ${JSON.stringify(DRIVER_STORAGE_KEY)};
    const forceDriverTokenKey = ${JSON.stringify(FORCE_DRIVER_TOKEN_KEY)};
    const isDriver = (value) => value === "asuka" || value === "rei";
    const readStoredDriver = () => {
      try {
        const value = localStorage.getItem(driverStorageKey);
        return isDriver(value) ? value : null;
      } catch {
        return null;
      }
    };
    const persistDriver = (value) => {
      try { localStorage.setItem(driverStorageKey, value); } catch {}
    };
    const root = document.documentElement;
    if (!root) return { installed: false, reason: "missing documentElement" };
    if (forceDriverToken) {
      try {
        if (localStorage.getItem(forceDriverTokenKey) !== forceDriverToken) {
          localStorage.setItem(driverStorageKey, requestedDriver);
          localStorage.setItem(forceDriverTokenKey, forceDriverToken);
        }
      } catch {}
    }
    const initialDriver = readStoredDriver() || requestedDriver;
    root.dataset.evaSkin = initialDriver;
    root.dataset.evaSkinVersion = version;
    root.style.setProperty("--eva-linework", 'url("' + linework + '")');
    root.style.setProperty("--eva-mark", 'url("' + marks[initialDriver] + '")');
    let style = document.getElementById(${JSON.stringify(STYLE_ID)});
    if (!style) {
      style = document.createElement("style");
      style.id = ${JSON.stringify(STYLE_ID)};
      (document.head || root).appendChild(style);
    }
    style.textContent = ${JSON.stringify(css)};
    let overlay = document.getElementById(${JSON.stringify(OVERLAY_ID)});
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = ${JSON.stringify(OVERLAY_ID)};
    overlay.dataset.evaSkinOverlay = "true";
    overlay.innerHTML = [
      '<div class="eva-frame" aria-hidden="true"></div>',
      '<div class="eva-scan" aria-hidden="true"></div>',
      '<div class="eva-art" aria-hidden="true"></div>',
      '<div class="eva-unit" aria-hidden="true">' + (initialDriver === "rei" ? "00" : "02") + '</div>',
      '<div class="eva-label" aria-hidden="true">' + (initialDriver === "rei" ? "EVA-00 // NEXUS LINK" : "EVA-02 // NEXUS LINK") + '</div>',
      '<div class="eva-mark" aria-hidden="true"></div>',
    ].join("");
    (document.body || root).appendChild(overlay);
    let runtime = null;
    let ui = null;
    const applyDriver = (next, persist) => {
      if (!isDriver(next)) return false;
      root.dataset.evaSkin = next;
      root.dataset.evaSkinVersion = version;
      root.style.setProperty("--eva-mark", 'url("' + marks[next] + '")');
      const unit = overlay.querySelector(".eva-unit");
      const label = overlay.querySelector(".eva-label");
      if (unit) unit.textContent = next === "rei" ? "00" : "02";
      if (label) {
        label.textContent = next === "rei"
          ? "EVA-00 // NEXUS LINK"
          : "EVA-02 // NEXUS LINK";
      }
      if (runtime) runtime.driver = next;
      if (persist) persistDriver(next);
      try {
        root.dispatchEvent(new CustomEvent("eva-skin-driver-change", {
          detail: { driver: next, version },
        }));
      } catch {}
      return true;
    };
    let observer = null;
    if (document.body && typeof MutationObserver === "function") {
      observer = new MutationObserver(() => {
        if (!document.getElementById(${JSON.stringify(STYLE_ID)})) {
          (document.head || root).appendChild(style);
        }
        if (!document.getElementById(${JSON.stringify(OVERLAY_ID)})) {
          (document.body || root).appendChild(overlay);
        }
      });
      observer.observe(document.body, { childList: true });
    }
    const cleanup = () => {
      try { ui?.cleanup?.(); } catch {}
      ui = null;
      try { observer?.disconnect(); } catch {}
      observer = null;
      document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();
      document.getElementById(${JSON.stringify(OVERLAY_ID)})?.remove();
      try {
        delete root.dataset.evaSkin;
        delete root.dataset.evaSkinVersion;
        root.style.removeProperty("--eva-linework");
        root.style.removeProperty("--eva-mark");
      } catch {}
      if (window[${JSON.stringify(RUNTIME_KEY)}]?.version === version) {
        try { delete window[${JSON.stringify(RUNTIME_KEY)}]; } catch {
          window[${JSON.stringify(RUNTIME_KEY)}] = undefined;
        }
      }
      return true;
    };
    runtime = {
      id: ${JSON.stringify(SKIN_ID)},
      version,
      driver: initialDriver,
      setDriver: (next) => applyDriver(next, true),
      cleanup,
    };
    window[${JSON.stringify(RUNTIME_KEY)}] = runtime;
    applyDriver(initialDriver, false);
    try {
      ui = installEvaSkinUi({
        root,
        overlay,
        media: ${JSON.stringify(media || {})},
        setDriver: (next) => applyDriver(next, true),
        optionsKey: ${JSON.stringify(OPTIONS_STORAGE_KEY)},
        welcomeConsumedKey: ${JSON.stringify(WELCOME_CONSUMED_KEY)},
        bootResultKey: ${JSON.stringify(BOOT_RESULT_KEY)},
        packVersion: ${JSON.stringify(packVersion)},
        packCommit: ${JSON.stringify(packCommit)},
      });
    } catch (error) {
      console.error("[eva-skin] settings UI failed", error);
    }
    return { installed: true, driver: initialDriver, version };
  })()`;
}

export function buildEarlySource(payloadSource, revision, bootSource = "") {
  const shellSelector = SELECTOR_MAP.shellMain;
  const sidebarSelector = SELECTOR_MAP.sidebar;
  const inputSelector = SELECTOR_MAP.composerInput;
  return `(() => {
    ${bootSource ? `if (location.href === ${JSON.stringify(EXACT_MAIN_URL)}) { try { ${bootSource}; } catch (error) { console.error("[eva-skin] boot install failed", error); } }` : ""}
    const generation = ${JSON.stringify(revision)};
    window[${JSON.stringify(EARLY_GENERATION_KEY)}] = generation;
    let observer = null;
    let timer = null;
    let timeout = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      if (timeout) clearTimeout(timeout);
      timer = null;
      timeout = null;
      try { observer?.disconnect(); } catch {}
      observer = null;
    };
    const install = () => {
      if (window[${JSON.stringify(EARLY_GENERATION_KEY)}] !== generation) {
        stop();
        return true;
      }
      if (!document.documentElement || !document.body) return false;
      const shell = document.querySelector(${JSON.stringify(shellSelector)});
      const sidebar = document.querySelector(${JSON.stringify(sidebarSelector)});
      const input = document.querySelector(${JSON.stringify(inputSelector)});
      const settings = document.querySelector(${JSON.stringify(SELECTOR_MAP.settingsPanel)});
      if (!((shell && sidebar && input) || settings)) return false;
      try {
        ${payloadSource};
        try { window[${JSON.stringify(BOOT_FINISH_KEY)}]?.("app-ready"); } catch {}
        window[${JSON.stringify(EARLY_APPLIED_KEY)}] = generation;
      } catch (error) {
        console.error("[eva-skin] early install failed", error);
        return false;
      }
      stop();
      return true;
    };
    if (install()) return;
    if (document.documentElement && typeof MutationObserver === "function") {
      observer = new MutationObserver(install);
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
    timer = setInterval(install, 300);
    timeout = setTimeout(stop, 60000);
  })()`;
}

export function buildBootBootstrapSource(bootSource, expectedTimeOrigin = null) {
  if (typeof bootSource !== "string" || !bootSource.trim()) {
    return `({ played: false, reason: "missing-boot-source" })`;
  }
  return `(() => {
    if (location.href !== ${JSON.stringify(EXACT_MAIN_URL)}) {
      return { played: false, reason: "not-main-document" };
    }
    if (${Number.isFinite(expectedTimeOrigin) ? `performance.timeOrigin !== ${Number(expectedTimeOrigin)}` : "false"}) {
      return { played: false, reason: "document-changed" };
    }
    try {
      return (${bootSource});
    } catch (error) {
      console.error("[eva-skin] early boot install failed", error);
      return { played: false, reason: "boot-error" };
    }
  })()`;
}

export function buildRemoveSource() {
  return `(() => {
    try { window[${JSON.stringify(RUNTIME_KEY)}]?.cleanup?.(); } catch {}
    try { window[${JSON.stringify(BOOT_RUNTIME_KEY)}]?.cleanup?.(); } catch {}
    document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();
    document.getElementById(${JSON.stringify(OVERLAY_ID)})?.remove();
    document.getElementById(${JSON.stringify(BOOT_STYLE_ID)})?.remove();
    document.getElementById(${JSON.stringify(BOOT_ID)})?.remove();
    const root = document.documentElement;
    try {
      delete root.dataset.evaSkin;
      delete root.dataset.evaSkinVersion;
      delete root.dataset.evaBoot;
      root.style.removeProperty("--eva-linework");
      root.style.removeProperty("--eva-mark");
    } catch {}
    try { delete window[${JSON.stringify(RUNTIME_KEY)}]; } catch {
      window[${JSON.stringify(RUNTIME_KEY)}] = undefined;
    }
    try { delete window[${JSON.stringify(EARLY_APPLIED_KEY)}]; } catch {
      window[${JSON.stringify(EARLY_APPLIED_KEY)}] = undefined;
    }
    try { delete window[${JSON.stringify(BOOT_RUNTIME_KEY)}]; } catch {
      window[${JSON.stringify(BOOT_RUNTIME_KEY)}] = undefined;
    }
    try { delete window[${JSON.stringify(BOOT_FINISH_KEY)}]; } catch {
      window[${JSON.stringify(BOOT_FINISH_KEY)}] = undefined;
    }
    return true;
  })()`;
}

export function buildPayloadFromStrings({
  driver,
  css,
  linework,
  mark,
  marks = null,
  version = SKIN_VERSION,
  bootCss = "",
  bootId = null,
  bootPack = null,
  forceDriverToken = null,
}) {
  const markSet = marks ?? { asuka: mark, rei: mark };
  const media = {};
  if (bootPack?.assets) {
    for (const id of UI_MEDIA_IDS) {
      if (typeof bootPack.assets[id] === "string") media[id] = bootPack.assets[id];
    }
  }
  const source = buildInstallSource({
    driver,
    css,
    linework,
    mark,
    marks: markSet,
    version,
    forceDriverToken,
    media,
    packVersion: bootPack?.manifest?.sourceVersion || null,
    packCommit: bootPack?.manifest?.sourceCommit || null,
  });
  const bootSource = bootId
    ? bootPack
      ? buildBootPackSource({
          driver,
          css: bootCss,
          bootId,
          pack: bootPack,
          forceDriverToken,
        })
      : buildBootSource({ driver, css: bootCss, bootId })
    : "";
  const revision = crypto
    .createHash("sha256")
    .update(version)
    .update("\0")
    .update(driver)
    .update("\0")
    .update(css)
    .update("\0")
    .update(SKIN_UI_RUNTIME)
    .update("\0")
    .update(linework)
    .update("\0")
    .update(JSON.stringify(markSet))
    .update("\0")
    .update(bootCss)
    .update("\0")
    .update(forceDriverToken || "")
    .update("\0")
    .update(bootId || "")
    .update("\0")
    .update(bootPack?.revision || "")
    .update("\0")
    .update(JSON.stringify(media))
    .digest("hex")
    .slice(0, 24);
  return {
    driver,
    version,
    source,
    revision,
    bootId,
    forceDriverToken,
    bootSource,
    bootPack: bootPack
      ? {
          sourceCommit: bootPack.manifest.sourceCommit || null,
          sourceVersion: bootPack.manifest.sourceVersion || null,
          revision: bootPack.revision,
        }
      : null,
  };
}

export function loadPayload(driver, options = {}) {
  if (!isDriver(driver)) throw new Error("主题只能是 asuka 或 rei");
  const css = fs.readFileSync(path.join(ASSETS, "eva-skin.css"), "utf8");
  const linework = svgDataUrl(path.join(ASSETS, "linework.svg"));
  const marks = {
    asuka: svgDataUrl(path.join(ASSETS, "asuka-mark.svg")),
    rei: svgDataUrl(path.join(ASSETS, "rei-mark.svg")),
  };
  const mark = marks[driver];
  const bootId = options.bootId ?? null;
  const bootPack = options.bootPack ?? null;
  const forceDriverToken = options.forceDriverToken ?? null;
  const bootCss = bootId
    ? fs.readFileSync(path.join(ASSETS, bootPack ? "eva-boot.css" : "boot.css"), "utf8")
    : "";
  return buildPayloadFromStrings({
    driver,
    css,
    linework,
    mark,
    marks,
    bootCss,
    bootId,
    bootPack,
    forceDriverToken,
  });
}

export class CdpSession {
  constructor(target, port) {
    if (typeof WebSocket !== "function") {
      throw new Error("Node.js 22+ is required for the built-in WebSocket client");
    }
    this.target = target;
    this.port = Number(port);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.ws = new WebSocket(validateDebuggerUrl(target, this.port));
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("CDP WebSocket open timed out")), 6000);
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("CDP WebSocket open failed"));
      }, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.#onMessage(event));
    this.ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  #onMessage(event) {
    let text;
    if (typeof event.data === "string") text = event.data;
    else if (event.data instanceof ArrayBuffer) text = Buffer.from(event.data).toString("utf8");
    else text = String(event.data);
    let message;
    try {
      message = JSON.parse(text);
    } catch {
      return;
    }
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) {
      try { listener(message.params ?? {}); } catch {}
    }
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 12000);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

export async function listTargets(port) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetch(`http://127.0.0.1:${Number(port)}/json/list`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
    const targets = await response.json();
    if (!Array.isArray(targets)) throw new Error("CDP returned an invalid target list");
    return targets.filter((target) => {
      if (target?.type !== "page" || typeof target.url !== "string") return false;
      if (!target.webSocketDebuggerUrl) return false;
      try {
        validateDebuggerUrl(target, port);
        return true;
      } catch {
        return false;
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function connectTarget(target, port) {
  return new CdpSession(target, port).open();
}

export async function probeSession(session) {
  return session.evaluate(buildProbeExpression());
}

export async function verifySession(session) {
  return session.evaluate(buildVerifyExpression());
}

async function waitForCodexProbe(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await probeSession(session);
    if (last?.codex && last.appMode !== "chatgpt") return last;
    if (last?.appMode === "chatgpt") {
      throw new Error("当前窗口处于 ChatGPT 模式，未注入；切回 Codex 后会自动重试");
    }
    await sleep(350);
  }
  throw new Error(`等待 Codex 界面超时（${timeoutMs}ms）`);
}

async function waitForBootDocument(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const stableForMs = 650;
  let stableKey = "";
  let stableSince = 0;
  while (Date.now() < deadline) {
    let state;
    try {
      state = await session.evaluate(`(() => ({
        href: location.href,
        readyState: document.readyState,
        visibility: document.visibilityState,
        hasBody: Boolean(document.body),
        timeOrigin: performance.timeOrigin,
      }))()`);
    } catch {
      stableKey = "";
      stableSince = 0;
      await sleep(120);
      continue;
    }
    const eligible = state?.href === EXACT_MAIN_URL &&
      state.readyState !== "loading" &&
      state.hasBody;
    const nextKey = eligible ? `${state.timeOrigin}|${state.href}` : "";
    const now = Date.now();
    if (!nextKey) {
      stableKey = "";
      stableSince = 0;
    } else if (nextKey === stableKey) {
      if (now - stableSince >= stableForMs) return state;
    } else {
      stableKey = nextKey;
      stableSince = now;
    }
    await sleep(120);
  }
  return null;
}

async function mountBootOnStableDocument(session, bootSource, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = null;
  while (Date.now() < deadline) {
    const bootDocument = await waitForBootDocument(
      session,
      Math.min(2500, Math.max(400, deadline - Date.now())),
    );
    if (!bootDocument) continue;
    lastResult = await session.evaluate(buildBootBootstrapSource(
      bootSource,
      bootDocument.timeOrigin,
    ));
    if (lastResult?.played) return lastResult;
    const reason = String(lastResult?.reason || "");
    if (["already-played", "already-installed", "disabled", "reduced-motion"].includes(reason)) {
      return lastResult;
    }
    if (!["document-changed", "not-main-document", "waiting-for-body"].includes(reason)) {
      return lastResult;
    }
    await sleep(120);
  }
  return lastResult;
}

async function waitForVerifiedSession(session, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await verifySession(session);
    if (last?.pass) return last;
    await sleep(400);
  }
  return last;
}

function stateRootFrom(options) {
  const root = options.stateDir ||
    process.env.EVA_CODEX_SKIN_STATE ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), "EVACodexSkin");
  return path.resolve(root);
}

function bootPackFrom(options) {
  const root = options.bootPack
    ? path.resolve(options.bootPack)
    : path.join(stateRootFrom(options), "eva-theme");
  if (!fs.existsSync(path.join(root, "manifest.json"))) return null;
  return loadEvaThemePack(root);
}

function readDriverFromState(stateDir, fallback = "asuka") {
  try {
    const value = fs.readFileSync(path.join(stateDir, "driver.txt"), "utf8").trim();
    return isDriver(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function driverStamp(stateDir) {
  try {
    return fs.statSync(path.join(stateDir, "driver.txt")).mtimeMs;
  } catch {
    return 0;
  }
}

async function writeRuntime(stateDir, data) {
  const target = path.join(stateDir, "runtime.json");
  const temporary = `${target}.${process.pid}.tmp`;
  await fsp.mkdir(stateDir, { recursive: true });
  await fsp.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  await fsp.rename(temporary, target);
}

function runtimeBase(options, driver, status, extra = {}) {
  return {
    schemaVersion: 1,
    app: "EVA-CODEX-SKIN",
    version: SKIN_VERSION,
    pid: process.pid,
    port: options.port,
    driver,
    bootId: options.bootId || null,
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function applyOnce(target, current, port, options) {
  const session = await connectTarget(target, port);
  let earlyScriptId = null;
  try {
    const earlySource = buildEarlySource(current.source, current.revision);
    const early = await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: earlySource,
    });
    earlyScriptId = early.identifier ?? null;
    if (current.bootSource) {
      try {
        await mountBootOnStableDocument(
          session,
          current.bootSource,
          Math.min(options.probeTimeoutMs, 8000),
        );
      } catch (error) {
        console.error(`[eva-skin] boot display failed: ${error.message}`);
      }
    }
    const probe = await waitForCodexProbe(session, options.probeTimeoutMs);
    if (current.bootSource) {
      try {
        const bootPending = await session.evaluate(`(() => {
          try {
            return !window[${JSON.stringify(BOOT_RUNTIME_KEY)}] &&
              localStorage.getItem("eva-codex-skin-boot-launch") !== ${JSON.stringify(current.bootId)};
          } catch {
            return false;
          }
        })()`);
        if (bootPending) {
          await session.evaluate(buildBootBootstrapSource(current.bootSource));
        }
      } catch (error) {
        console.error(`[eva-skin] late boot display failed: ${error.message}`);
      }
    }
    await session.evaluate(buildEarlySource(current.source, current.revision));
    let verified = await waitForVerifiedSession(session, options.verifyTimeoutMs);
    if (!verified?.pass) {
      await session.evaluate(current.source);
      verified = await waitForVerifiedSession(session, 3000);
    }
    return { session, earlyScriptId, probe, verified };
  } catch (error) {
    if (earlyScriptId && !session.closed) {
      await session.send("Page.removeScriptToEvaluateOnNewDocument", {
        identifier: earlyScriptId,
      }).catch(() => {});
    }
    session.close();
    throw error;
  }
}

async function runWatch(options) {
  const stateDir = stateRootFrom(options);
  await fsp.mkdir(stateDir, { recursive: true });
  options.bootId = options.bootId || crypto.randomUUID();
  const bootPack = bootPackFrom(options);
  let driver = options.driver || readDriverFromState(stateDir);
  let current = loadPayload(driver, {
    bootId: options.bootId,
    bootPack,
    forceDriverToken: options.forceDriverToken,
  });
  let stamp = driverStamp(stateDir);
  const sessions = new Map();
  const failures = new Map();
  let stopping = false;
  let lastError = null;

  const stop = () => {
    stopping = true;
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  while (!stopping) {
    const nextStamp = driverStamp(stateDir);
    if (nextStamp !== stamp) {
      stamp = nextStamp;
      const nextDriver = readDriverFromState(stateDir, driver);
      if (nextDriver !== driver) {
        driver = nextDriver;
        current = loadPayload(driver, {
          bootId: options.bootId,
          bootPack,
          forceDriverToken: options.forceDriverToken,
        });
        for (const [id, record] of sessions) {
          try {
            if (record.earlyScriptId) {
              await record.session.send("Page.removeScriptToEvaluateOnNewDocument", {
                identifier: record.earlyScriptId,
              }).catch(() => {});
            }
            record.earlyScriptId = (await record.session.send(
              "Page.addScriptToEvaluateOnNewDocument",
              {
                source: buildEarlySource(
                  current.source,
                  current.revision,
                ),
              },
            )).identifier ?? null;
            await record.session.evaluate(buildEarlySource(current.source, current.revision));
            await record.session.evaluate(current.source);
            record.appliedAt = new Date().toISOString();
            record.driver = driver;
          } catch (error) {
            lastError = `切换主题失败 (${id}): ${error.message}`;
            console.error(`[eva-skin] ${lastError}`);
            record.session.close();
            sessions.delete(id);
          }
        }
      }
    }

    let targets;
    try {
      const all = await listTargets(options.port);
      targets = all.filter((target) => classifyTarget(target) === "main");
    } catch (error) {
      lastError = `CDP 不可用: ${error.message}`;
      await writeRuntime(stateDir, runtimeBase(options, driver, "waiting", {
        error: lastError,
        sessions: [],
      }));
      await sleep(1200);
      continue;
    }

    const activeIds = new Set(targets.map((target) => target.id));
    for (const [id, record] of sessions) {
      if (!activeIds.has(id) || record.session.closed) {
        record.session.close();
        sessions.delete(id);
      }
    }

    for (const target of targets) {
      if (stopping || sessions.has(target.id)) continue;
      if ((failures.get(target.id)?.until ?? 0) > Date.now()) continue;
      try {
        const result = await applyOnce(target, current, options.port, options);
        const record = {
          ...result,
          driver,
          appliedAt: new Date().toISOString(),
        };
        result.session.on("Page.loadEventFired", () => {
          setTimeout(async () => {
            if (record.session.closed) return;
            try {
              if (current.bootSource) {
                const completed = await record.session.evaluate(`(() => {
                  try {
                    return localStorage.getItem("eva-codex-skin-boot-launch") === ${JSON.stringify(current.bootId)};
                  } catch {
                    return false;
                  }
                })()`);
                if (!completed) {
                  await record.session.evaluate(buildBootBootstrapSource(current.bootSource));
                }
              }
              await record.session.evaluate(
                buildEarlySource(
                  current.source,
                  current.revision,
                ),
              );
              await record.session.evaluate(current.source);
            } catch (error) {
              lastError = `重新载入后注入失败: ${error.message}`;
            }
          }, 200);
        });
        sessions.set(target.id, record);
        failures.delete(target.id);
        lastError = null;
        console.log(`[eva-skin] injected ${target.id} (${target.title || target.url})`);
      } catch (error) {
        const previous = failures.get(target.id);
        if (!previous || previous.message !== error.message || Date.now() - previous.at > 8000) {
          console.error(`[eva-skin] injection waiting for ${target.id}: ${error.message}`);
        }
        failures.set(target.id, {
          at: Date.now(),
          until: Date.now() + 1500,
          message: error.message,
        });
        if (!sessions.size) lastError = error.message;
      }
    }

    for (const record of sessions.values()) {
      try {
        const activeDriver = await record.session.evaluate(buildActiveDriverExpression());
        if (!isDriver(activeDriver) || activeDriver === driver) continue;
        driver = activeDriver;
        current = loadPayload(driver, {
          bootId: options.bootId,
          bootPack,
          forceDriverToken: options.forceDriverToken,
        });
        await fsp.writeFile(path.join(stateDir, "driver.txt"), `${driver}\n`, "utf8");
        stamp = driverStamp(stateDir);
        for (const sessionRecord of sessions.values()) {
          sessionRecord.driver = driver;
        }
      } catch {}
    }

    const sessionState = [...sessions.entries()].map(([id, record]) => ({
      targetId: id,
      title: record.session.target.title || "",
      url: record.session.target.url,
      driver: record.driver,
      appliedAt: record.appliedAt,
      verified: record.verified?.pass === true,
    }));
    await writeRuntime(stateDir, runtimeBase(
      options,
      driver,
      sessions.size ? "applied" : "waiting",
      { error: lastError, sessions: sessionState },
    ));
    await sleep(sessions.size ? 1200 : 750);
  }

  for (const record of sessions.values()) {
    try {
      await record.session.evaluate(buildRemoveSource());
      if (record.earlyScriptId) {
        await record.session.send("Page.removeScriptToEvaluateOnNewDocument", {
          identifier: record.earlyScriptId,
        }).catch(() => {});
      }
    } catch {}
    record.session.close();
  }
  await writeRuntime(stateDir, runtimeBase(options, driver, "stopped", { sessions: [] }));
}

async function runVerify(options) {
  const stateDir = stateRootFrom(options);
  const driver = options.driver || readDriverFromState(stateDir);
  const targets = (await listTargets(options.port))
    .filter((target) => classifyTarget(target) === "main");
  const results = [];
  for (const target of targets) {
    let session;
    try {
      session = await connectTarget(target, options.port);
      const probe = await probeSession(session);
      const verified = await waitForVerifiedSession(session, options.verifyTimeoutMs);
      results.push({ id: target.id, title: target.title, url: target.url, probe, result: verified });
    } catch (error) {
      results.push({ id: target.id, title: target.title, url: target.url, error: error.message });
    } finally {
      session?.close();
    }
  }
  const payload = {
    mode: "verify",
    version: SKIN_VERSION,
    port: options.port,
    driver: results.map((entry) => entry.result?.driver).find(isDriver) || driver,
    targets: results,
  };
  console.log(JSON.stringify(payload, null, 2));
  if (!results.length || results.some((entry) => !entry.result?.pass)) process.exitCode = 2;
}

async function runRemove(options) {
  const targets = (await listTargets(options.port))
    .filter((target) => classifyTarget(target) !== "overlay");
  const results = [];
  for (const target of targets) {
    let session;
    try {
      session = await connectTarget(target, options.port);
      await session.evaluate(buildRemoveSource());
      results.push({ id: target.id, url: target.url, removed: true });
    } catch (error) {
      results.push({ id: target.id, url: target.url, removed: false, error: error.message });
    } finally {
      session?.close();
    }
  }
  console.log(JSON.stringify({
    mode: "remove",
    version: SKIN_VERSION,
    port: options.port,
    targets: results,
  }, null, 2));
  if (results.some((entry) => entry.removed !== true)) process.exitCode = 2;
}

async function runOnce(options) {
  const stateDir = stateRootFrom(options);
  const driver = options.driver || readDriverFromState(stateDir);
  options.bootId = options.bootId || crypto.randomUUID();
  const current = loadPayload(driver, {
    bootId: options.bootId,
    bootPack: bootPackFrom(options),
    forceDriverToken: options.forceDriverToken,
  });
  const targets = (await listTargets(options.port))
    .filter((target) => classifyTarget(target) === "main");
  const results = [];
  for (const target of targets) {
    try {
      const applied = await applyOnce(target, current, options.port, options);
      results.push({
        id: target.id,
        title: target.title,
        url: target.url,
        probe: applied.probe,
        result: applied.verified,
      });
      if (options.screenshot) {
        await sleep(350);
        const shot = await applied.session.send("Page.captureScreenshot", {
          format: "png",
          fromSurface: true,
          captureBeyondViewport: false,
        });
        await fsp.mkdir(path.dirname(options.screenshot), { recursive: true });
        await fsp.writeFile(options.screenshot, Buffer.from(shot.data, "base64"));
      }
      applied.session.close();
    } catch (error) {
      results.push({ id: target.id, title: target.title, url: target.url, error: error.message });
    }
  }
  console.log(JSON.stringify({
    mode: "once",
    version: SKIN_VERSION,
    port: options.port,
    driver: results.map((entry) => entry.result?.driver).find(isDriver) || driver,
    targets: results,
  }, null, 2));
  if (!results.length || results.some((entry) => !entry.result?.pass)) process.exitCode = 2;
}

export function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    driver: null,
    stateDir: null,
    bootId: null,
    forceDriverToken: null,
    bootPack: null,
    probeTimeoutMs: 15000,
    verifyTimeoutMs: 15000,
    screenshot: null,
    mode: "watch",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[++index];
      if (value === undefined) throw new Error(`Missing value for ${arg}`);
      return value;
    };
    if (arg === "--watch") options.mode = "watch";
    else if (arg === "--once") options.mode = "once";
    else if (arg === "--verify") options.mode = "verify";
    else if (arg === "--remove") options.mode = "remove";
    else if (arg === "--port") options.port = Number(next());
    else if (arg === "--driver") options.driver = next();
    else if (arg === "--state-dir") options.stateDir = next();
    else if (arg === "--boot-id") options.bootId = next();
    else if (arg === "--force-token") options.forceDriverToken = next();
    else if (arg === "--boot-pack") options.bootPack = next();
    else if (arg === "--probe-timeout-ms") options.probeTimeoutMs = Number(next());
    else if (arg === "--timeout-ms") options.verifyTimeoutMs = Number(next());
    else if (arg === "--screenshot") options.screenshot = path.resolve(next());
    else if (arg === "--help" || arg === "-h") options.mode = "help";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error("Port must be an integer between 1024 and 65535");
  }
  if (options.driver !== null && !isDriver(options.driver)) {
    throw new Error("Driver must be asuka or rei");
  }
  if (options.bootId !== null && !BOOT_ID_PATTERN.test(options.bootId)) {
    throw new Error("Boot id must contain only letters, digits, dot, dash or underscore");
  }
  if (
    options.forceDriverToken !== null &&
    !FORCE_DRIVER_TOKEN_PATTERN.test(options.forceDriverToken)
  ) {
    throw new Error(
      "Force token must contain only letters, digits, dot, dash or underscore",
    );
  }
  for (const key of ["probeTimeoutMs", "verifyTimeoutMs"]) {
    if (!Number.isInteger(options[key]) || options[key] < 1000 || options[key] > 120000) {
      throw new Error(`${key} must be between 1000 and 120000`);
    }
  }
  return options;
}

function printHelp() {
  console.log(`EVA Codex skin injector ${SKIN_VERSION}

Usage:
  node injector.mjs --watch --port 9345 --driver asuka
  node injector.mjs --verify --port 9345
  node injector.mjs --once --port 9345 --driver rei
  node injector.mjs --remove --port 9345

Options:
  --driver <asuka|rei>       select the EVA palette
  --boot-id <id>             stable ID for one official Codex launch
  --force-token <id>         one-shot launcher override for the saved theme
  --boot-pack <path>         local EVA theme media pack
  --state-dir <path>         runtime state directory
  --probe-timeout-ms <ms>    wait for the Codex shell
  --timeout-ms <ms>          wait for visual verification
  --screenshot <path>        capture a PNG in --once mode
`);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`[eva-skin] ${error.message}`);
    process.exitCode = 2;
    return;
  }
  if (options.mode === "help") {
    printHelp();
    return;
  }
  try {
    if (options.mode === "watch") await runWatch(options);
    else if (options.mode === "verify") await runVerify(options);
    else if (options.mode === "remove") await runRemove(options);
    else await runOnce(options);
  } catch (error) {
    console.error(`[eva-skin] ${error.stack || error.message}`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
