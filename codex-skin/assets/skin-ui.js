function createCompletionGate({ stableMs = 3000 } = {}) {
  const holdMs = Math.max(0, Number(stableMs) || 0);
  let initialized = false;
  let running = false;
  let sawRunning = false;
  let baselineKey = null;
  let baselineSignature = "";
  let baselineConversation = null;
  let lastKey = null;
  let lastSignature = "";
  let lastConversation = null;
  let pending = null;
  let triggeredKey = null;
  let triggeredConversation = null;

  const same = (left, right) => (left ?? null) === (right ?? null);
  const snapshotOf = (value) => ({
    key: typeof value?.key === "string" && value.key ? value.key : null,
    signature: typeof value?.signature === "string" ? value.signature : "",
    conversation: typeof value?.conversation === "string" && value.conversation
      ? value.conversation
      : null,
  });
  const remember = (snapshot) => {
    lastKey = snapshot.key;
    lastSignature = snapshot.signature;
    lastConversation = snapshot.conversation;
  };

  function observe({
    now,
    running: nextRunning,
    approvalVisible = false,
    snapshot = null,
  }) {
    const at = Number(now);
    if (!Number.isFinite(at)) return false;
    const current = snapshotOf(snapshot);

    if (!initialized) {
      initialized = true;
      running = Boolean(nextRunning);
      sawRunning = running;
      baselineKey = current.key;
      baselineSignature = current.signature;
      baselineConversation = current.conversation;
      remember(current);
      return false;
    }

    const wasRunning = running;
    running = Boolean(nextRunning);
    if (running) {
      pending = null;
      if (!wasRunning && !sawRunning) {
        sawRunning = true;
        baselineKey = lastKey;
        baselineSignature = lastSignature;
        baselineConversation = lastConversation;
      }
      return false;
    }

    if (!sawRunning) {
      pending = null;
      remember(current);
      return false;
    }

    if (
      baselineConversation &&
      current.conversation &&
      current.conversation !== baselineConversation
    ) {
      pending = null;
      sawRunning = false;
      remember(current);
      return false;
    }

    if (approvalVisible || !current.key) {
      pending = null;
      return false;
    }

    if (
      !pending ||
      pending.key !== current.key ||
      pending.signature !== current.signature ||
      !same(pending.conversation, current.conversation)
    ) {
      pending = { ...current, since: at };
      return false;
    }

    if (at - pending.since < holdMs) return false;

    const sameKey = same(current.key, baselineKey);
    const sameSignature = same(current.signature, baselineSignature);
    const sameConversation = !baselineConversation ||
      !current.conversation ||
      same(current.conversation, baselineConversation);
    const completed = !(sameKey && sameSignature && sameConversation);
    const duplicate = same(current.key, triggeredKey) &&
      same(current.conversation, triggeredConversation);

    pending = null;
    sawRunning = false;
    remember(current);
    if (!completed || duplicate) return false;
    triggeredKey = current.key;
    triggeredConversation = current.conversation;
    return true;
  }

  function pendingDelay(now) {
    if (!pending) return null;
    return Math.max(0, holdMs - (Number(now) - pending.since));
  }

  return { observe, pendingDelay };
}

function installEvaSkinUi(config) {
  const root = config?.root;
  const overlay = config?.overlay;
  if (!root || !overlay) return { cleanup() {} };

  const media = config.media && typeof config.media === "object" ? config.media : {};
  const setDriver = typeof config.setDriver === "function" ? config.setDriver : null;
  const optionsKey = String(config.optionsKey || "eva-codex-skin-options-v1");
  const welcomeConsumedKey = String(config.welcomeConsumedKey || "");
  const bootResultKey = String(config.bootResultKey || "");
  const defaults = Object.freeze({
    boot: true,
    bootVoice: true,
    pickVoice: true,
    welcomeVoice: true,
    approvalVoice: false,
    completeVoice: false,
    typing: true,
    portrait: true,
    portraitStrength: 0.11,
  });
  const completionStableMs = 3000;
  const welcomeFreshMs = 30000;
  const ranges = Object.freeze({ portraitStrength: [0.03, 0.28] });
  const hasMedia = (id) => typeof media[id] === "string" && media[id].startsWith("data:");
  const hasAny = (ids) => ids.some(hasMedia);
  let currentDriver = root.dataset.evaSkin === "rei" ? "rei" : "asuka";
  let disposed = false;
  let panelOpen = false;
  let audio = null;
  let audioButton = null;
  let typingAudio = null;
  let typingAt = 0;
  let activityObserver = null;
  let activityTimer = null;
  let completionTimer = null;
  let lastApprovalAt = 0;
  const seenApprovals = new Set();
  const completionGate = createCompletionGate({ stableMs: completionStableMs });

  function normalize(key, value) {
    if (!Object.hasOwn(defaults, key)) return undefined;
    if (Object.hasOwn(ranges, key)) {
      const [min, max] = ranges[key];
      const number = Number(value);
      if (!Number.isFinite(number)) return defaults[key];
      return Math.min(max, Math.max(min, Number(number.toFixed(2))));
    }
    return typeof value === "boolean" ? value : defaults[key];
  }

  function loadOptions() {
    const merged = { ...defaults };
    try {
      const saved = JSON.parse(localStorage.getItem(optionsKey) || "{}");
      for (const key of Object.keys(defaults)) {
        if (saved && Object.hasOwn(saved, key)) merged[key] = normalize(key, saved[key]);
      }
    } catch {}
    return merged;
  }

  function saveOptions() {
    try {
      localStorage.setItem(optionsKey, JSON.stringify(options));
    } catch {}
  }

  const options = loadOptions();
  const drivers = [
    { id: "asuka", unit: "02", name: "明日香", en: "ASUKA", head: "asukaHead", portrait: "asukaPortrait", pick: "asukaPickVoice" },
    { id: "rei", unit: "00", name: "绫波丽", en: "REI", head: "reiHead", portrait: "reiPortrait", pick: "reiPickVoice" },
  ];
  const previewSpecs = [
    { id: "boot", label: "启动语音", detail: "同步阶段播放" },
    { id: "pick", label: "选择应答", detail: "切换驾驶员时播放" },
    { id: "welcome", label: "欢迎语音", detail: "启动完成后播放" },
    { id: "approval", label: "审核提醒", detail: "人工审批待处理" },
    { id: "complete", label: "完成提醒", detail: "主任务正常完成" },
  ];
  const hasBootVoice = () => hasAny(["asukaVoice", "reiVoice"]);
  const hasPickVoice = () => hasAny(["asukaPickVoice", "reiPickVoice"]);
  const hasWelcomeVoice = () => hasAny(["asukaWelcome", "reiWelcome"]);
  const hasPortrait = () => hasAny(["asukaPortrait", "reiPortrait"]);

  const portrait = document.createElement("div");
  portrait.className = "eva-portrait";
  portrait.setAttribute("aria-hidden", "true");
  overlay.appendChild(portrait);

  const settingsButton = document.createElement("button");
  settingsButton.type = "button";
  settingsButton.className = "eva-settings-button";
  settingsButton.setAttribute("aria-expanded", "false");
  settingsButton.setAttribute("aria-controls", "eva-codex-skin-settings");
  settingsButton.innerHTML = "<span>設</span><small>SETTINGS</small>";
  overlay.appendChild(settingsButton);

  const panel = document.createElement("section");
  panel.id = "eva-codex-skin-settings";
  panel.className = "eva-config-panel";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", "EVA 角色主题显示设定");
  panel.innerHTML = [
    '<header class="eva-config-head"><div><b>表示設定</b><small>DISPLAY CONFIG</small></div>',
    '<button type="button" class="eva-config-close" aria-label="关闭显示设定" title="关闭（Esc）">×</button></header>',
    '<div class="eva-config-body"></div>',
    '<footer class="eva-config-foot"><span class="eva-config-pack"></span>',
    '<button type="button" class="eva-config-reset">重置全部</button></footer>',
  ].join("");
  overlay.appendChild(panel);

  const body = panel.querySelector(".eva-config-body");
  const packNode = panel.querySelector(".eva-config-pack");
  const controls = [];
  const previewButtons = [];
  const packVersion = String(config.packVersion || "").trim();
  const packCommit = String(config.packCommit || "").trim().slice(0, 8);
  if (packVersion) packNode.textContent = `EVA THEME ${packVersion}${packCommit ? " / " + packCommit : ""}`;
  else packNode.textContent = "EVA 主题素材未导入";

  function addGroup(title) {
    const group = document.createElement("section");
    group.className = "eva-config-group";
    const heading = document.createElement("h2");
    heading.textContent = title;
    group.appendChild(heading);
    body.appendChild(group);
    return group;
  }

  function addSwitch(group, key, label, hint, available = true) {
    const row = document.createElement("div");
    row.className = "eva-config-row";
    const copy = document.createElement("div");
    copy.className = "eva-config-copy";
    const name = document.createElement("b");
    name.textContent = label;
    const detail = document.createElement("small");
    detail.textContent = available ? hint : "需要先导入本地 EVA 主题素材";
    copy.append(name, detail);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-switch";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", label);
    button.disabled = !available;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      options[key] = !options[key];
      saveOptions();
      refresh();
    });
    row.append(copy, button);
    group.appendChild(row);
    controls.push({ kind: "switch", key, button, available });
  }

  function addRange(group, key, label, hint, available = true) {
    const row = document.createElement("div");
    row.className = "eva-config-row eva-config-range-row";
    const copy = document.createElement("div");
    copy.className = "eva-config-copy";
    const name = document.createElement("b");
    name.textContent = label;
    const detail = document.createElement("small");
    detail.textContent = hint;
    copy.append(name, detail);
    const output = document.createElement("output");
    output.className = "eva-config-value";
    row.append(copy, output);
    const strip = document.createElement("div");
    strip.className = "eva-config-range";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", `减小${label}`);
    const input = document.createElement("input");
    const [min, max] = ranges[key];
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.setAttribute("aria-label", label);
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "＋";
    plus.setAttribute("aria-label", `增大${label}`);
    const step = (direction) => {
      options[key] = normalize(key, options[key] + direction * 0.01);
      saveOptions();
      refresh();
    };
    minus.addEventListener("click", () => step(-1));
    plus.addEventListener("click", () => step(1));
    input.addEventListener("input", () => {
      options[key] = normalize(key, Number(input.value));
      saveOptions();
      refresh();
    });
    strip.append(minus, input, plus);
    row.appendChild(strip);
    group.appendChild(row);
    controls.push({ kind: "range", key, input, output, minus, plus, available });
  }

  const pilotGroup = addGroup("驾驶员");
  const pilotGrid = document.createElement("div");
  pilotGrid.className = "eva-config-pilots";
  pilotGroup.appendChild(pilotGrid);
  const pilotButtons = new Map();
  for (const driver of drivers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-pilot";
    button.dataset.evaUiDriver = driver.id;
    button.setAttribute("aria-label", `切换到${driver.name}（EVA-${driver.unit}）`);
    const face = document.createElement("span");
    face.className = "eva-config-face";
    face.style.setProperty("--eva-config-face", hasMedia(driver.head) ? `url("${media[driver.head]}")` : "none");
    const copy = document.createElement("span");
    copy.innerHTML = `<b>${driver.unit}</b><small>${driver.en}</small>`;
    button.append(face, copy);
    button.addEventListener("click", () => {
      const changed = currentDriver !== driver.id;
      if (setDriver) setDriver(driver.id);
      syncDriver(driver.id, false);
      if (changed && options.pickVoice) {
        const id = mediaId(driver.id, "pick");
        if (id) playMedia(id, null, 0.78);
      }
    });
    pilotGrid.appendChild(button);
    pilotButtons.set(driver.id, button);
  }

  const bootGroup = addGroup("启动与声音");
  addSwitch(
    bootGroup,
    "boot",
    "开机动画",
    "下次启动播放驾驶员选择与 NERV 序列；应用内换肤不播放",
  );
  addSwitch(bootGroup, "bootVoice", "启动语音", "同步阶段播放当前驾驶员语音", hasBootVoice());
  addSwitch(bootGroup, "pickVoice", "选择应答", "切换驾驶员时播放短语音", hasPickVoice());
  addSwitch(bootGroup, "welcomeVoice", "欢迎语音", "启动完成后播放", hasWelcomeVoice());
  addSwitch(
    bootGroup,
    "approvalVoice",
    "审核自动语音",
    "待审批出现时播放一次",
    hasAny(["asukaApproval", "reiApproval"]),
  );
  addSwitch(
    bootGroup,
    "completeVoice",
    "完成自动语音",
    "主任务完成时播放一次",
    hasAny(["asukaComplete", "reiComplete"]),
  );
  addSwitch(bootGroup, "typing", "界面打字音", "在输入框中键入时播放短促提示", hasMedia("typing"));

  const previewGroup = addGroup("语音试听");
  const previewGrid = document.createElement("div");
  previewGrid.className = "eva-config-previews";
  previewGroup.appendChild(previewGrid);
  for (const spec of previewSpecs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-preview";
    button.dataset.evaPreview = spec.id;
    button.innerHTML = `<b>${spec.label}</b><small>${spec.detail}</small>`;
    button.addEventListener("click", () => {
      const id = mediaId(currentDriver, spec.id);
      if (!id) return;
      playMedia(id, button, spec.id === "approval" || spec.id === "complete" ? 0.88 : 0.8);
    });
    previewGrid.appendChild(button);
    previewButtons.push(button);
  }

  const visualGroup = addGroup("角色背景");
  addSwitch(visualGroup, "portrait", "显示角色立绘", "随明暗主题切换驾驶员", hasPortrait());
  addRange(visualGroup, "portraitStrength", "背景强度", "线稿背景透明度", hasPortrait());

  function mediaId(driver, kind) {
    const prefix = driver === "rei" ? "rei" : "asuka";
    const suffix = {
      boot: "Voice",
      pick: "PickVoice",
      welcome: "Welcome",
      approval: "Approval",
      complete: "Complete",
    }[kind];
    if (!suffix) return null;
    const id = prefix + suffix;
    return hasMedia(id) ? id : null;
  }

  function stopAudio() {
    if (audioButton) audioButton.setAttribute("aria-pressed", "false");
    audioButton = null;
    if (!audio) return;
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    } catch {}
    audio = null;
  }

  function playMedia(id, button = null, volume = 0.82) {
    if (disposed || !hasMedia(id)) return false;
    if (button && audioButton === button && audio && !audio.paused) {
      stopAudio();
      return true;
    }
    stopAudio();
    try {
      audio = new Audio(media[id]);
      audio.preload = "auto";
      audio.volume = volume;
      audioButton = button;
      if (button) button.setAttribute("aria-pressed", "true");
      const finish = () => {
        if (audioButton === button) stopAudio();
      };
      audio.addEventListener("ended", finish);
      audio.addEventListener("error", finish);
      Promise.resolve(audio.play()).catch(finish);
      return true;
    } catch {
      stopAudio();
      return false;
    }
  }

  function playTyping() {
    if (disposed || !options.typing || !hasMedia("typing")) return;
    const now = performance.now();
    if (now - typingAt < 65) return;
    typingAt = now;
    try {
      if (!typingAudio) {
        typingAudio = new Audio(media.typing);
        typingAudio.preload = "auto";
        typingAudio.volume = 0.34;
      }
      typingAudio.currentTime = 0;
      Promise.resolve(typingAudio.play()).catch(() => {});
    } catch {}
  }

  function stopTyping() {
    if (!typingAudio) return;
    try {
      typingAudio.pause();
      typingAudio.removeAttribute("src");
      typingAudio.load();
    } catch {}
    typingAudio = null;
  }

  function applyPortrait() {
    const portraitId = currentDriver === "rei" ? "reiPortrait" : "asukaPortrait";
    const enabled = options.portrait && hasMedia(portraitId);
    root.dataset.evaPortrait = enabled ? "on" : "off";
    root.style.setProperty("--eva-portrait-strength", String(options.portraitStrength));
    root.style.setProperty(
      "--eva-portrait-image",
      enabled ? `url("${media[portraitId]}")` : "none",
    );
  }

  function syncDriver(driver, playResponse = false) {
    if (driver !== "asuka" && driver !== "rei") return;
    const changed = currentDriver !== driver;
    currentDriver = driver;
    for (const [id, button] of pilotButtons) {
      button.setAttribute("aria-pressed", String(id === driver));
    }
    applyPortrait();
    if (playResponse && options.pickVoice && changed) {
      const id = mediaId(driver, "pick");
      if (id) playMedia(id, null, 0.78);
    }
  }

  function refresh() {
    applyPortrait();
    for (const control of controls) {
      if (control.kind === "switch") {
        const on = Boolean(options[control.key]);
        control.button.setAttribute("aria-checked", String(on));
        control.button.textContent = on ? "承認" : "否定";
        control.button.disabled = !control.available;
      } else {
        const enabled = control.available && options.portrait;
        const [min, max] = ranges[control.key];
        const value = options[control.key];
        control.input.value = String(value);
        control.input.disabled = !enabled;
        control.minus.disabled = !enabled || value <= min;
        control.plus.disabled = !enabled || value >= max;
        control.output.textContent = `${Math.round(value * 100)}%`;
        control.input.setAttribute("aria-valuetext", control.output.textContent);
      }
    }
    for (const button of previewButtons) {
      button.disabled = !mediaId(currentDriver, button.dataset.evaPreview);
    }
  }

  function openPanel() {
    if (panelOpen || disposed) return;
    panelOpen = true;
    panel.hidden = false;
    settingsButton.setAttribute("aria-expanded", "true");
    refresh();
    const selected = panel.querySelector('[data-eva-ui-driver][aria-pressed="true"]');
    (selected || panel.querySelector(".eva-config-close"))?.focus?.({ preventScroll: true });
  }

  function closePanel(restoreFocus = false) {
    if (!panelOpen) return;
    panelOpen = false;
    panel.hidden = true;
    settingsButton.setAttribute("aria-expanded", "false");
    stopAudio();
    if (restoreFocus) settingsButton.focus({ preventScroll: true });
  }

  const onSettingsClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (panelOpen) closePanel(true);
    else openPanel();
  };
  const onPanelPointer = (event) => event.stopPropagation();
  const onPanelClick = (event) => event.stopPropagation();
  const onCloseClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    closePanel(true);
  };
  const onResetClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    Object.assign(options, defaults);
    saveOptions();
    refresh();
  };
  const onKey = (event) => {
    if (event.key !== "Escape" || !panelOpen) return;
    event.preventDefault();
    event.stopPropagation();
    closePanel(true);
  };
  const onTypingInput = (event) => {
    const target = event.target;
    if (!target || panelOpen) return;
    const tagName = String(target.tagName || "").toLowerCase();
    if (tagName !== "textarea" && tagName !== "input" && !target.isContentEditable) return;
    playTyping();
  };
  const onPointerDown = (event) => {
    if (!panelOpen) return;
    const target = event.target;
    if (panel.contains(target) || settingsButton.contains(target)) return;
    closePanel(false);
  };
  const onDriverChange = (event) => {
    const next = event?.detail?.driver;
    if (next === "asuka" || next === "rei") syncDriver(next, false);
  };
  const onBootFinished = (event) => {
    const detail = event?.detail;
    if (!detail?.completed || !detail.bootId || !options.welcomeVoice) return;
    const endedAt = Number(detail.endedAt);
    if (!Number.isFinite(endedAt) || Date.now() - endedAt > welcomeFreshMs) return;
    if (welcomeConsumedKey && window[welcomeConsumedKey] === detail.bootId) return;
    const sessionKey = welcomeConsumedKey ? `${welcomeConsumedKey}:${detail.bootId}` : "";
    if (sessionKey) {
      try {
        if (sessionStorage.getItem(sessionKey)) return;
      } catch {}
    }
    const driver = detail.driver === "rei" ? "rei" : "asuka";
    const id = `${driver}Welcome`;
    if (!hasMedia(id)) return;
    if (welcomeConsumedKey && detail.bootId) {
      try {
        window[welcomeConsumedKey] = detail.bootId;
      } catch {}
    }
    if (sessionKey) {
      try {
        sessionStorage.setItem(sessionKey, "1");
      } catch {}
    }
    playMedia(id, null, 0.78);
  };

  function isVisible(node) {
    if (!(node instanceof Element) || !node.isConnected) return false;
    if (node.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 &&
      style.display !== "none" && style.visibility !== "hidden";
  }

  function isTaskRunning() {
    return [...document.querySelectorAll([
      'button[aria-label="停止"]',
      'button[aria-label="Stop"]',
      'button[aria-label="Stop generating"]',
      '[data-app-action-sidebar-thread-active="true"][data-sidebar-indicator="working"]',
      '[data-app-action-sidebar-thread-active="true"] [data-loading-indicator]',
      '[data-app-action-sidebar-thread-active="true"] [aria-label="处理中"]',
      '[data-app-action-sidebar-thread-active="true"] [aria-label="Working"]',
    ].join(","))].some(isVisible);
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function messageKey(node) {
    const target = node.getAttribute("data-response-annotation-target") ||
      node.querySelector("[data-response-annotation-target]")
        ?.getAttribute("data-response-annotation-target");
    if (target) return target;
    const searchKey = node.getAttribute("data-content-search-unit-key") ||
      node.querySelector("[data-content-search-unit-key]")
        ?.getAttribute("data-content-search-unit-key");
    if (searchKey) return searchKey;
    const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
    return `text:${hashText(text)}:${text.length}`;
  }

  function activeConversationKey() {
    const row = document.querySelector(
      '[data-app-action-sidebar-thread-active="true"][data-app-action-sidebar-thread-id]',
    );
    return row?.getAttribute("data-app-action-sidebar-thread-id") || null;
  }

  function latestFinalSnapshot() {
    const nodes = document.querySelectorAll(
      '[data-local-conversation-final-assistant="true"]',
    );
    const activeConversation = activeConversationKey();
    const node = nodes[nodes.length - 1];
    if (!node) {
      return activeConversation
        ? { key: null, signature: "", conversation: activeConversation }
        : null;
    }
    const text = (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    const conversation = activeConversation ||
      node.closest("[data-response-annotation-conversation]")
        ?.getAttribute("data-response-annotation-conversation") ||
      node.getAttribute("data-response-annotation-conversation") ||
      null;
    return {
      key: messageKey(node),
      signature: `${hashText(text)}:${text.length}`,
      conversation,
    };
  }

  function hasVisibleApproval() {
    return [...document.querySelectorAll(
      '[data-codex-approval-surface="true"]',
    )].some(isVisible);
  }

  function approvalKey(node) {
    const text = (node.innerText || node.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 360);
    const buttons = [...node.querySelectorAll("button")]
      .map((button) => (
        button.innerText ||
        button.getAttribute("aria-label") ||
        ""
      ).replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("|");
    return `approval:${hashText(`${text}|${buttons}`)}`;
  }

  function playTaskVoice(kind) {
    const id = mediaId(currentDriver, kind);
    if (!id) return false;
    return playMedia(id, null, 0.88);
  }

  function scheduleCompletionCheck(delay) {
    if (completionTimer || disposed) return;
    completionTimer = setTimeout(() => {
      completionTimer = null;
      try {
        checkActivity();
      } catch {}
    }, Math.max(120, Number(delay) || 0));
  }

  function checkActivity() {
    if (disposed) return;
    const now = performance.now();
    const running = isTaskRunning();
    const approvalVisible = hasVisibleApproval();
    const snapshot = latestFinalSnapshot();

    for (const node of document.querySelectorAll(
      '[data-codex-approval-surface="true"]',
    )) {
      if (!isVisible(node)) continue;
      const key = approvalKey(node);
      if (seenApprovals.has(key)) continue;
      seenApprovals.add(key);
      if (options.approvalVoice && now - lastApprovalAt >= 1200) {
        lastApprovalAt = now;
        playTaskVoice("approval");
      }
    }

    const completed = completionGate.observe({
      now,
      running,
      approvalVisible,
      snapshot,
    });
    if (completed && options.completeVoice) playTaskVoice("complete");

    const delay = completionGate.pendingDelay(now);
    if (delay !== null) {
      scheduleCompletionCheck(delay + 80);
    } else if (completionTimer) {
      clearTimeout(completionTimer);
      completionTimer = null;
    }
  }

  function scheduleActivityCheck() {
    if (activityTimer || disposed) return;
    activityTimer = setTimeout(() => {
      activityTimer = null;
      try {
        checkActivity();
      } catch {}
    }, 180);
  }

  settingsButton.addEventListener("click", onSettingsClick);
  panel.addEventListener("pointerdown", onPanelPointer);
  panel.addEventListener("click", onPanelClick);
  panel.querySelector(".eva-config-close").addEventListener("click", onCloseClick);
  panel.querySelector(".eva-config-reset").addEventListener("click", onResetClick);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("input", onTypingInput, true);
  root.addEventListener("eva-skin-driver-change", onDriverChange);
  window.addEventListener("eva-skin-boot-finished", onBootFinished);

  syncDriver(currentDriver, false);
  refresh();

  completionGate.observe({
    now: performance.now(),
    running: isTaskRunning(),
    approvalVisible: hasVisibleApproval(),
    snapshot: latestFinalSnapshot(),
  });
  for (const node of document.querySelectorAll(
    '[data-codex-approval-surface="true"]',
  )) {
    if (isVisible(node)) seenApprovals.add(approvalKey(node));
  }
  if (document.body && typeof MutationObserver === "function") {
    activityObserver = new MutationObserver(scheduleActivityCheck);
    activityObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "aria-label",
        "data-codex-approval-surface",
        "data-local-conversation-final-assistant",
        "data-app-action-sidebar-thread-active",
        "data-app-action-sidebar-thread-id",
        "data-sidebar-indicator",
        "data-loading-indicator",
      ],
    });
  }

  if (bootResultKey) {
    try {
      const result = window[bootResultKey];
      if (result && (!welcomeConsumedKey || window[welcomeConsumedKey] !== result.bootId)) {
        onBootFinished({ detail: result });
      }
    } catch {}
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    stopAudio();
    stopTyping();
    if (activityObserver) activityObserver.disconnect();
    activityObserver = null;
    if (activityTimer) clearTimeout(activityTimer);
    if (completionTimer) clearTimeout(completionTimer);
    activityTimer = null;
    completionTimer = null;
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("input", onTypingInput, true);
    root.removeEventListener("eva-skin-driver-change", onDriverChange);
    window.removeEventListener("eva-skin-boot-finished", onBootFinished);
    settingsButton.removeEventListener("click", onSettingsClick);
    panel.remove();
    settingsButton.remove();
    portrait.remove();
    try {
      delete root.dataset.evaPortrait;
      root.style.removeProperty("--eva-portrait-image");
      root.style.removeProperty("--eva-portrait-strength");
    } catch {}
  };

  return { open: openPanel, close: closePanel, refresh, cleanup };
}
