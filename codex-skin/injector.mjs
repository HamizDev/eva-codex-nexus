#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const SKIN_VERSION = "0.1.0";
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
const RUNTIME_KEY = "__EVA_CODEX_SKIN__";
const EARLY_GENERATION_KEY = "__EVA_CODEX_SKIN_EARLY_GENERATION__";
const EARLY_APPLIED_KEY = "__EVA_CODEX_SKIN_EARLY_APPLIED__";

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
    const result = {
      installed: Boolean(root && root.dataset.evaSkin),
      driver: root?.dataset.evaSkin || null,
      version: root?.dataset.evaSkinVersion || null,
      stylePresent: Boolean(style),
      overlayPresent: Boolean(overlay),
      overlayPointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : null,
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
      (result.sidebar?.visible || result.main?.visible || result.settings?.visible) &&
      result.overflowX === false
    );
    return result;
  })()`;
}

function svgDataUrl(filePath) {
  const bytes = fs.readFileSync(filePath);
  return `data:image/svg+xml;base64,${bytes.toString("base64")}`;
}

export function buildInstallSource({
  driver,
  css,
  linework,
  mark,
  version = SKIN_VERSION,
}) {
  if (!isDriver(driver)) throw new Error(`Unknown EVA driver: ${String(driver)}`);
  return `(() => {
    const previous = window[${JSON.stringify(RUNTIME_KEY)}];
    if (previous?.cleanup) {
      try { previous.cleanup(); } catch {}
    }
    const driver = ${JSON.stringify(driver)};
    const version = ${JSON.stringify(version)};
    const root = document.documentElement;
    if (!root) return { installed: false, reason: "missing documentElement" };
    root.dataset.evaSkin = driver;
    root.dataset.evaSkinVersion = version;
    root.style.setProperty("--eva-linework", "url(\\"" + ${JSON.stringify(linework)} + "\\")");
    root.style.setProperty("--eva-mark", "url(\\"" + ${JSON.stringify(mark)} + "\\")");
    let style = document.getElementById(${JSON.stringify(STYLE_ID)});
    if (!style) {
      style = document.createElement("style");
      style.id = ${JSON.stringify(STYLE_ID)};
      (document.head || root).appendChild(style);
    }
    style.textContent = ${JSON.stringify(css)};
    let overlay = document.getElementById(${JSON.stringify(OVERLAY_ID)});
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = ${JSON.stringify(OVERLAY_ID)};
      overlay.setAttribute("aria-hidden", "true");
      overlay.dataset.evaSkinOverlay = "true";
      overlay.innerHTML = [
        '<div class="eva-frame"></div>',
        '<div class="eva-scan"></div>',
        '<div class="eva-art"></div>',
        '<div class="eva-unit">' + (driver === "rei" ? "00" : "02") + '</div>',
        '<div class="eva-label">' + (driver === "rei" ? "EVA-00 // NEXUS LINK" : "EVA-02 // NEXUS LINK") + '</div>',
        '<div class="eva-mark"></div>'
      ].join("");
      (document.body || root).appendChild(overlay);
    }
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
    window[${JSON.stringify(RUNTIME_KEY)}] = { id: ${JSON.stringify(SKIN_ID)}, version, driver, cleanup };
    return { installed: true, driver, version };
  })()`;
}

export function buildEarlySource(payloadSource, revision) {
  const shellSelector = SELECTOR_MAP.shellMain;
  const sidebarSelector = SELECTOR_MAP.sidebar;
  const inputSelector = SELECTOR_MAP.composerInput;
  return `(() => {
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
    document.getElementById(${JSON.stringify(STYLE_ID)})?.remove();
    document.getElementById(${JSON.stringify(OVERLAY_ID)})?.remove();
    const root = document.documentElement;
    try {
      delete root.dataset.evaSkin;
      delete root.dataset.evaSkinVersion;
      root.style.removeProperty("--eva-linework");
      root.style.removeProperty("--eva-mark");
    } catch {}
    try { delete window[${JSON.stringify(RUNTIME_KEY)}]; } catch {
      window[${JSON.stringify(RUNTIME_KEY)}] = undefined;
    }
    try { delete window[${JSON.stringify(EARLY_APPLIED_KEY)}]; } catch {
      window[${JSON.stringify(EARLY_APPLIED_KEY)}] = undefined;
    }
    return true;
  })()`;
}

export function buildPayloadFromStrings({
  driver,
  css,
  linework,
  mark,
  version = SKIN_VERSION,
}) {
  const source = buildInstallSource({ driver, css, linework, mark, version });
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
    .update(mark)
    .digest("hex")
    .slice(0, 24);
  return { driver, version, source, revision };
}

export function loadPayload(driver) {
  if (!isDriver(driver)) throw new Error("主题只能是 asuka 或 rei");
  const css = fs.readFileSync(path.join(ASSETS, "eva-skin.css"), "utf8");
  const linework = svgDataUrl(path.join(ASSETS, "linework.svg"));
  const mark = svgDataUrl(path.join(ASSETS, driver === "rei" ? "rei-mark.svg" : "asuka-mark.svg"));
  return buildPayloadFromStrings({ driver, css, linework, mark });
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
    status,
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

async function applyOnce(target, current, port, options) {
  const session = await connectTarget(target, port);
  let earlyScriptId = null;
  try {
    const early = await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: buildEarlySource(current.source, current.revision),
    });
    earlyScriptId = early.identifier ?? null;
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
  let driver = options.driver || readDriverFromState(stateDir);
  let current = loadPayload(driver);
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
        current = loadPayload(driver);
        for (const [id, record] of sessions) {
          try {
            if (record.earlyScriptId) {
              await record.session.send("Page.removeScriptToEvaluateOnNewDocument", {
                identifier: record.earlyScriptId,
              }).catch(() => {});
            }
            record.earlyScriptId = (await record.session.send(
              "Page.addScriptToEvaluateOnNewDocument",
              { source: buildEarlySource(current.source, current.revision) },
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
                buildEarlySource(current.source, current.revision),
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
    driver,
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
  const current = loadPayload(driver);
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
    driver,
    targets: results,
  }, null, 2));
  if (!results.length || results.some((entry) => !entry.result?.pass)) process.exitCode = 2;
}

export function parseArgs(argv) {
  const options = {
    port: DEFAULT_PORT,
    driver: null,
    stateDir: null,
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
