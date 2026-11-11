#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SKIN_VERSION = "0.3.1";
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
const STYLE_ID = "eva-codex-skin-style";
const OVERLAY_ID = "eva-codex-skin-overlay";
const BOOT_ID = "eva-codex-skin-boot";
const BOOT_STYLE_ID = "eva-codex-skin-boot-style";
const RUNTIME_KEY = "__EVA_CODEX_SKIN__";
const EARLY_GENERATION_KEY = "__EVA_CODEX_SKIN_EARLY_GENERATION__";
const EARLY_APPLIED_KEY = "__EVA_CODEX_SKIN_EARLY_APPLIED__";
const BOOT_RUNTIME_KEY = "__EVA_CODEX_SKIN_BOOT__";
const BOOT_FINISH_KEY = "__EVA_CODEX_SKIN_BOOT_FINISH__";
const BOOT_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;
const DSH_BOOT_PACK_NAME = "dsh-eva-theme-boot-pack";
const DSH_BOOT_REQUIRED_ASSETS = ["boot", "emergency", "entryPlug", "asukaHead", "reiHead"];
const DSH_BOOT_OPTIONAL_ASSETS = ["asukaVoice", "reiVoice"];
const DSH_BOOT_MAX_BYTES = 16 * 1024 * 1024;
const DRIVER_STORAGE_KEY = "eva-codex-skin-driver-v1";
const FORCE_DRIVER_TOKEN_KEY = "eva-codex-skin-force-driver-token-v1";
const FORCE_DRIVER_TOKEN_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

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
    const browserPanel = document.querySelector(${JSON.stringify(SELECTOR_MAP.browserPanel)});
    const switcher = overlay?.querySelector(".eva-driver-switch") || null;
    const switchButtons = switcher
      ? [...switcher.querySelectorAll("[data-eva-driver]")]
      : [];
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
    const switcherBox = box(switcher);
    const switcherPointerEvents = switcher
      ? getComputedStyle(switcher).pointerEvents
      : null;
    const switcherInsideViewport = Boolean(
      switcherBox &&
      switcherBox.x >= 0 &&
      switcherBox.y >= 0 &&
      switcherBox.x + switcherBox.width <= innerWidth + 1 &&
      switcherBox.y + switcherBox.height <= innerHeight + 1
    );
    const result = {
      installed: Boolean(root && root.dataset.evaSkin),
      driver: root?.dataset.evaSkin || null,
      version: root?.dataset.evaSkinVersion || null,
      stylePresent: Boolean(style),
      overlayPresent: Boolean(overlay),
      overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
      switcher: {
        present: Boolean(switcher),
        visible: switcherBox?.visible === true,
        pointerEvents: switcherPointerEvents,
        insideViewport: switcherInsideViewport,
        hiddenForBrowserPanel: Boolean(browserPanel),
        activeDriver: switchButtons.find(
          (button) => button.getAttribute("aria-pressed") === "true",
        )?.dataset.evaDriver || null,
        buttonCount: switchButtons.length,
      },
      layout: {
        overlay: overlayBox,
        switcher: switcherBox,
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
      result.switcher.present === true &&
      (
        result.switcher.hiddenForBrowserPanel === true ||
        (
          result.switcher.visible === true &&
          result.switcher.pointerEvents === "auto" &&
          result.switcher.insideViewport === true
        )
      ) &&
      result.switcher.buttonCount === 2 &&
      result.switcher.activeDriver === result.driver &&
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
    throw new Error("DSH boot pack contains an invalid asset path");
  }
  const full = path.resolve(root, relative);
  const rel = path.relative(root, full);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("DSH boot pack asset escapes its directory");
  }
  return full;
}

export function loadDshBootPack(packRoot) {
  if (!packRoot) return null;
  const root = path.resolve(packRoot);
  const manifestPath = path.join(root, "manifest.json");
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8").replace(/^\uFEFF/, ""));
  if (manifest?.schemaVersion !== 1 || manifest?.package !== DSH_BOOT_PACK_NAME) {
    throw new Error("DSH boot pack manifest has an unsupported schema");
  }
  if (!Array.isArray(manifest.assets)) throw new Error("DSH boot pack has no asset list");
  const entries = new Map();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.id !== "string" || entries.has(asset.id)) {
      throw new Error("DSH boot pack contains a duplicate or invalid asset");
    }
    entries.set(asset.id, asset);
  }
  for (const id of DSH_BOOT_REQUIRED_ASSETS) {
    if (!entries.has(id)) throw new Error(`DSH boot pack is missing required asset: ${id}`);
  }
  const allowed = new Set([...DSH_BOOT_REQUIRED_ASSETS, ...DSH_BOOT_OPTIONAL_ASSETS]);
  const assets = {};
  const inline = {};
  const hashes = [];
  let totalBytes = 0;
  for (const [id, entry] of entries) {
    if (!allowed.has(id)) continue;
    const filePath = resolvePackFile(root, entry.file);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`DSH boot pack asset is missing: ${entry.file}`);
    }
    const bytes = fs.statSync(filePath).size;
    totalBytes += bytes;
    if (totalBytes > DSH_BOOT_MAX_BYTES) {
      throw new Error("DSH boot pack exceeds the 16 MiB loading limit");
    }
    if (Number.isInteger(entry.bytes) && entry.bytes !== bytes) {
      throw new Error(`DSH boot pack size mismatch: ${entry.file}`);
    }
    const sha256 = fileSha256(filePath);
    if (typeof entry.sha256 === "string" && entry.sha256.toLowerCase() !== sha256) {
      throw new Error(`DSH boot pack SHA-256 mismatch: ${entry.file}`);
    }
    const type = typeof entry.type === "string" ? entry.type : "";
    if (!/^(?:image\/(?:gif|png|svg\+xml)|audio\/mpeg)$/.test(type)) {
      throw new Error(`DSH boot pack has an unsupported MIME type: ${type}`);
    }
    const data = fs.readFileSync(filePath);
    assets[id] = `data:${type};base64,${data.toString("base64")}`;
    if (type === "image/svg+xml") {
      const markup = data.toString("utf8").replace(/^\uFEFF/, "");
      if (/<\s*script\b|\son[a-z]+\s*=|@import|url\(\s*["']?\s*(?:https?:|\/\/)/i.test(markup)) {
        throw new Error(`DSH boot pack SVG contains active or remote content: ${entry.file}`);
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

function buildDshBootMarkup(driver, pack, syncSeconds) {
  const copy = bootProfile(driver);
  const avatar = pack.assets[driver === "rei" ? "reiHead" : "asukaHead"];
  const voice = pack.assets[driver === "rei" ? "reiVoice" : "asukaVoice"];
  const mode = driver === "rei" ? "LIGHT / UNIT 00" : "DARK / UNIT 02";
  const source = pack.manifest.sourceVersion
    ? `DSH BOOT ${pack.manifest.sourceVersion}`
    : "DSH BOOT";
  return [
    '<div class="eva-dsh-layer eva-dsh-gif-layer" data-dsh-layer="gif">',
    `<img class="eva-dsh-gif" src="${pack.assets.boot}" alt="" width="256" height="256">`,
    "</div>",
    '<div class="eva-dsh-layer eva-dsh-alert-layer" data-dsh-layer="emergency">',
    `<img class="eva-dsh-alert-art" src="${pack.assets.emergency}" alt="">`,
    '<div class="eva-dsh-alert-scan" aria-hidden="true"></div>',
    "</div>",
    '<div class="eva-dsh-layer eva-dsh-console-layer" data-dsh-layer="sync">',
    '<header class="eva-dsh-head">',
    '<div><span class="eva-dsh-kicker"><b>NERV</b> // MAGI SYSTEM</span>',
    `<strong>${copy.code}</strong><small>${source}</small></div>`,
    '<span class="eva-dsh-head-code">TOKYO-III<br><b>LEVEL 07</b></span>',
    "</header>",
    '<main class="eva-dsh-grid">',
    '<section class="eva-dsh-bay">',
    '<span class="eva-dsh-bay-label">NERV / ENTRY SYSTEM<b>ENTRY PLUG / CONNECTED</b></span>',
    '<div class="eva-dsh-plug" role="img" aria-label="Entry Plug">' + pack.inline.entryPlug + "</div>",
    '<span class="eva-dsh-bay-lock">INTERLOCK / ENGAGED</span>',
    '<span class="eva-dsh-bay-target">驾驶员已装载 · PILOT LOADED</span>',
    "</section>",
    '<section class="eva-dsh-panel">',
    '<div class="eva-dsh-pilot">',
    `<span class="eva-dsh-pilot-face" style="--dsh-avatar:url('${avatar}')"></span>`,
    '<div class="eva-dsh-pilot-copy">',
    `<span class="eva-dsh-unit">${copy.unit}</span>`,
    `<h1>${copy.pilotCn}</h1><p>${copy.pilot}</p>`,
    `<small>${copy.unitLabel}<br>${mode}</small>`,
    "</div>",
    "</div>",
    '<div class="eva-dsh-sync-console">',
    '<div class="eva-dsh-sync-ring" aria-hidden="true">',
    '<svg viewBox="0 0 180 180" fill="none" stroke="currentColor">',
    '<circle cx="90" cy="90" r="86" stroke-dasharray="1 7" opacity=".4"/>',
    '<circle cx="90" cy="90" r="70" stroke-width="3" opacity=".15"/>',
    '<circle class="eva-dsh-ring-meter" cx="90" cy="90" r="70" stroke-width="3" pathLength="100"/>',
    '<path d="M90 0v9m90 81h-9M90 180v-9M0 90h9" opacity=".8"/>',
    "</svg>",
    '<span class="eva-dsh-percent">00%</span><small>SYNC RATIO</small>',
    "</div>",
    '<div class="eva-dsh-sync-copy"><span class="eva-dsh-live"><i></i>NEURAL LINK ACTIVE</span>',
    `<h2>${driver === "rei" ? "绫波丽" : "明日香"}</h2><p>同步中 / SYNCHRONIZING</p>`,
    '<div class="eva-dsh-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i></i></div>',
    `<div class="eva-dsh-meter-copy"><span>00%</span><span>00:00 / 00:${String(syncSeconds).padStart(2, "0")}</span></div></div>`,
    "</div>",
    '<div class="eva-dsh-systems" aria-hidden="true">',
    "<span>A10 INTERFACE<b>CONNECTED</b></span><span>L.C.L. CHAMBER<b>SEALED</b></span><span>MAGI SYSTEM<b>STABLE</b></span>",
    "</div>",
    "</section>",
    "</main>",
    '<footer class="eva-dsh-foot"><span class="eva-dsh-status"><i></i>驾驶舱同步中 · LINK ESTABLISHING</span>',
    '<span class="eva-dsh-magi">MELCHIOR·1 / BALTHASAR·2 / CASPER·3</span></footer>',
    "</div>",
    '<button type="button" class="eva-dsh-skip" aria-label="跳过启动动画">跳过 / ESC</button>',
    voice ? `<audio class="eva-dsh-voice" preload="auto" src="${voice}"></audio>` : "",
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
    let attemptTimer = null;
    let attemptDeadline = 0;
    let finishTimer = null;
    let cleanupTimer = null;
    let mounted = false;
    const removeListeners = () => {
      window.removeEventListener("keydown", onKey, true);
      boot.removeEventListener("click", onSkip);
    };
    const cleanup = () => {
      if (attemptTimer) clearInterval(attemptTimer);
      if (finishTimer) clearTimeout(finishTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      attemptTimer = null;
      finishTimer = null;
      cleanupTimer = null;
      removeListeners();
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
      try { localStorage.setItem(storageKey, bootId); } catch {}
      root.dataset.evaBoot = driver;
      mounted = true;
      shownAt = performance.now();
      window.addEventListener("keydown", onKey, true);
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

export function buildDshBootSource({ driver, css, bootId, pack }) {
  if (!isDriver(driver)) throw new Error(`Unknown EVA driver: ${String(driver)}`);
  if (typeof bootId !== "string" || !BOOT_ID_PATTERN.test(bootId)) {
    throw new Error("Boot id must contain only letters, digits, dot, dash or underscore");
  }
  if (!pack?.assets?.boot || !pack?.assets?.emergency || !pack?.assets?.entryPlug) {
    throw new Error("DSH boot pack is incomplete");
  }
  const voiceId = driver === "rei" ? "reiVoice" : "asukaVoice";
  const voiceEntry = Array.isArray(pack.manifest.assets)
    ? pack.manifest.assets.find((asset) => asset?.id === voiceId)
    : null;
  const syncMs = Number.isFinite(voiceEntry?.durationSeconds)
    ? Math.max(3000, Math.min(12000, Math.round(voiceEntry.durationSeconds * 1000)))
    : 4600;
  const syncSeconds = Math.max(1, Math.round(syncMs / 1000));
  const markup = buildDshBootMarkup(driver, pack, syncSeconds);
  const source = pack.manifest.sourceCommit
    ? String(pack.manifest.sourceCommit).slice(0, 8)
    : "local";
  return `(() => {
    const bootId = ${JSON.stringify(bootId)};
    const driver = ${JSON.stringify(driver)};
    const styleId = ${JSON.stringify(BOOT_STYLE_ID)};
    const elementId = ${JSON.stringify(BOOT_ID)};
    const storageKey = "eva-codex-skin-boot-launch";
    const runtimeKey = ${JSON.stringify(BOOT_RUNTIME_KEY)};
    const finishKey = ${JSON.stringify(BOOT_FINISH_KEY)};
    const source = ${JSON.stringify(source)};
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
    boot.dataset.dshSource = source;
    boot.setAttribute("role", "dialog");
    boot.setAttribute("aria-modal", "true");
    boot.setAttribute("aria-label", "NERV 驾驶员启动序列");
    boot.innerHTML = ${JSON.stringify(markup)};
    const phases = { gif: 3840, emergency: 3000, sync: ${syncMs} };
    let shownAt = 0;
    let mounted = false;
    let leaving = false;
    let appReady = false;
    let sequenceDone = false;
    let attemptTimer = null;
    let phaseTimer = null;
    let cleanupTimer = null;
    let progressFrame = null;
    let syncStarted = 0;
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
      const audio = boot.querySelector(".eva-dsh-voice");
      if (audio) {
        try { audio.pause(); } catch {}
      }
    };
    const removeListeners = () => {
      window.removeEventListener("keydown", onKey, true);
      boot.removeEventListener("click", onBackdropClick);
    };
    const cleanup = () => {
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      if (attemptTimer) clearInterval(attemptTimer);
      if (phaseTimer) clearTimeout(phaseTimer);
      if (cleanupTimer) clearTimeout(cleanupTimer);
      if (progressFrame !== null) cancelAnimationFrame(progressFrame);
      phaseTimer = null;
      attemptTimer = null;
      cleanupTimer = null;
      progressFrame = null;
      stopAudio();
      removeListeners();
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
      stopAudio();
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
      if (phase === "emergency") {
        phaseTimer = later(startSync, phases.emergency);
      }
    };
    const tickSync = (now) => {
      progressFrame = null;
      if (leaving) return;
      const ratio = Math.min(1, Math.max(0, (now - syncStarted) / phases.sync));
      const percent = Math.round(ratio * 100);
      const ring = boot.querySelector(".eva-dsh-ring-meter");
      const meter = boot.querySelector(".eva-dsh-meter");
      const percentNode = boot.querySelector(".eva-dsh-percent");
      const meterPercent = boot.querySelector(".eva-dsh-meter-copy span");
      const meterTime = boot.querySelector(".eva-dsh-meter-copy span:last-child");
      boot.style.setProperty("--dsh-progress", percent);
      if (ring) ring.style.strokeDasharray = percent + " 100";
      if (meter) meter.setAttribute("aria-valuenow", String(percent));
      const label = String(percent).padStart(2, "0") + "%";
      if (percentNode) percentNode.textContent = label;
      if (meterPercent) meterPercent.textContent = label;
      if (meterTime) meterTime.textContent = "00:" + String(Math.floor(ratio * ${syncSeconds})).padStart(2, "0") + " / 00:" + String(${syncSeconds}).padStart(2, "0");
      if (ratio < 1) {
        progressFrame = requestAnimationFrame(tickSync);
      } else {
        sequenceDone = true;
        maybeFinish();
      }
    };
    const startSync = () => {
      if (leaving) return;
      setPhase("sync");
      syncStarted = performance.now();
      const voice = boot.querySelector(".eva-dsh-voice");
      if (voice) {
        voice.volume = 0.75;
        try { Promise.resolve(voice.play()).catch(() => {}); } catch {}
      }
      progressFrame = requestAnimationFrame(tickSync);
    };
    const onSkip = (event) => {
      event.preventDefault();
      event.stopPropagation();
      leave();
    };
    const onBackdropClick = (event) => {
      if (event.target?.closest?.("button,audio")) return;
      leave();
    };
    const onKey = (event) => {
      if (event.key === "Escape" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        leave();
      }
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
      try { localStorage.setItem(storageKey, bootId); } catch {}
      root.dataset.evaBoot = driver;
      mounted = true;
      shownAt = performance.now();
      window.addEventListener("keydown", onKey, true);
      boot.addEventListener("click", onBackdropClick);
      boot.querySelector(".eva-dsh-skip")?.addEventListener("click", onSkip);
      requestAnimationFrame(() => {
        if (!leaving) boot.classList.add("is-active");
      });
      phaseTimer = later(() => setPhase("emergency"), phases.gif);
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
      return { played: true, driver, source };
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
      '<div class="eva-driver-switch" role="group" aria-label="EVA 驾驶员主题">',
      '<span class="eva-driver-switch-label" aria-hidden="true">PILOT</span>',
      '<button type="button" class="eva-driver-button" data-eva-driver="asuka" aria-label="切换到明日香主题（EVA-02）" aria-pressed="' + (initialDriver === "asuka") + '">',
      '<span class="eva-driver-switch-unit">02</span><small>ASUKA</small></button>',
      '<button type="button" class="eva-driver-button" data-eva-driver="rei" aria-label="切换到绫波丽主题（EVA-00）" aria-pressed="' + (initialDriver === "rei") + '">',
      '<span class="eva-driver-switch-unit">00</span><small>REI</small></button>',
      '</div>'
    ].join("");
    (document.body || root).appendChild(overlay);
    let runtime = null;
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
      for (const button of overlay.querySelectorAll("[data-eva-driver]")) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.evaDriver === next),
        );
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
    for (const button of overlay.querySelectorAll("[data-eva-driver]")) {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyDriver(button.dataset.evaDriver, true);
      });
    }
    applyDriver(initialDriver, false);
    return { installed: true, driver: initialDriver, version };
  })()`;
}

export function buildEarlySource(payloadSource, revision, bootSource = "") {
  const shellSelector = SELECTOR_MAP.shellMain;
  const sidebarSelector = SELECTOR_MAP.sidebar;
  const inputSelector = SELECTOR_MAP.composerInput;
  return `(() => {
    ${bootSource ? `try { ${bootSource}; } catch (error) { console.error("[eva-skin] boot install failed", error); }` : ""}
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
  const source = buildInstallSource({
    driver,
    css,
    linework,
    mark,
    marks: markSet,
    version,
    forceDriverToken,
  });
  const bootSource = bootId
    ? bootPack
      ? buildDshBootSource({ driver, css: bootCss, bootId, pack: bootPack })
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
    ? fs.readFileSync(path.join(ASSETS, bootPack ? "dsh-boot.css" : "boot.css"), "utf8")
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
    : path.join(stateRootFrom(options), "dsh-boot");
  if (!fs.existsSync(path.join(root, "manifest.json"))) return null;
  return loadDshBootPack(root);
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
    const earlySource = buildEarlySource(
      current.source,
      current.revision,
      current.bootSource,
    );
    const early = await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: earlySource,
    });
    earlyScriptId = early.identifier ?? null;
    if (current.bootSource) {
      try {
        await session.evaluate(current.bootSource);
      } catch (error) {
        console.error(`[eva-skin] boot display failed: ${error.message}`);
      }
    }
    const probe = await waitForCodexProbe(session, options.probeTimeoutMs);
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
                  current.bootSource,
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
              await record.session.evaluate(
                buildEarlySource(
                  current.source,
                  current.revision,
                  current.bootSource,
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
  --boot-pack <path>         local DSH boot asset pack
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
