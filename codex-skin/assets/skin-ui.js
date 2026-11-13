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

  function reset() {
    initialized = false;
    running = false;
    sawRunning = false;
    baselineKey = null;
    baselineSignature = "";
    baselineConversation = null;
    lastKey = null;
    lastSignature = "";
    lastConversation = null;
    pending = null;
    triggeredKey = null;
    triggeredConversation = null;
  }

  return { observe, pendingDelay, reset };
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
    tps: true,
    locale: "zh-Hant",
  });
  const locales = Object.freeze(["zh-Hant", "zh-Hans", "ja", "en"]);
  const localeLabels = Object.freeze({
    "zh-Hant": "繁體中文",
    "zh-Hans": "简体中文",
    ja: "日本語",
    en: "ENGLISH",
  });
  const messages = Object.freeze({
    "zh-Hant": {
      panelTitle: "顯示設定",
      panelSubtitle: "DISPLAY CONFIG",
      close: "關閉顯示設定",
      panelAria: "EVA 角色主題顯示設定",
      settingsAria: "EVA 顯示設定",
      dragHint: "拖曳標題列可自由移動",
      groupPilot: "駕駛員與語言",
      groupStartup: "啟動與聲音",
      groupPreview: "語音試聽",
      groupVisual: "外觀與輸出",
      languageAria: "介面語言",
      boot: "開機動畫",
      bootHint: "下次啟動時播放駕駛員選擇與 NERV 序列；在應用內換膚時不播放",
      bootVoice: "啟動語音",
      bootVoiceHint: "同步階段播放目前駕駛員語音",
      pickVoice: "選擇應答",
      pickVoiceHint: "切換駕駛員時播放短語音",
      welcomeVoice: "歡迎語音",
      welcomeVoiceHint: "啟動完成後播放",
      approvalVoice: "審核提示語音",
      approvalVoiceHint: "待審核出現時播放一次",
      completeVoice: "完成提示語音",
      completeVoiceHint: "主任務完成時播放一次",
      typing: "介面打字音",
      typingHint: "在輸入框中鍵入時播放短促提示",
      portrait: "顯示角色立繪",
      portraitHint: "隨明暗主題切換駕駛員",
      portraitStrength: "背景強度",
      portraitStrengthHint: "線稿背景透明度",
      tps: "輸出速度 HUD",
      tpsHint: "依串流回覆文字估算 token，以平滑視窗顯示即時、峰值與平均速度",
      previewBoot: "啟動語音",
      previewBootHint: "同步階段播放",
      previewPick: "選擇應答",
      previewPickHint: "切換駕駛員時播放",
      previewWelcome: "歡迎語音",
      previewWelcomeHint: "啟動完成後播放",
      previewApproval: "審核提醒",
      previewApprovalHint: "人工審核待處理",
      previewComplete: "完成提醒",
      previewCompleteHint: "主任務正常完成",
      needAssets: "需要先匯入本機 EVA 主題素材",
      reset: "重設全部",
      on: "開啟",
      off: "關閉",
      driverAsuka: "明日香",
      driverRei: "綾波麗",
      switchToDriver: "切換至{driver}（EVA-{unit}）",
      decrease: "減小{label}",
      increase: "增大{label}",
      packUnavailable: "EVA 主題素材未匯入",
      tpsAria: "估算輸出速度",
      tpsTitle: "估算值：依 2.4 秒滑動視窗內的文字增量換算",
    },
    "zh-Hans": {
      panelTitle: "显示设置",
      panelSubtitle: "DISPLAY CONFIG",
      close: "关闭显示设置",
      panelAria: "EVA 角色主题显示设置",
      settingsAria: "EVA 显示设置",
      dragHint: "拖动标题栏可自由移动",
      groupPilot: "驾驶员与语言",
      groupStartup: "启动与声音",
      groupPreview: "语音试听",
      groupVisual: "外观与输出",
      languageAria: "界面语言",
      boot: "开机动画",
      bootHint: "下次启动时播放驾驶员选择与 NERV 序列；在应用内换肤时不播放",
      bootVoice: "启动语音",
      bootVoiceHint: "同步阶段播放当前驾驶员语音",
      pickVoice: "选择应答",
      pickVoiceHint: "切换驾驶员时播放短语音",
      welcomeVoice: "欢迎语音",
      welcomeVoiceHint: "启动完成后播放",
      approvalVoice: "审批提示语音",
      approvalVoiceHint: "待审批出现时播放一次",
      completeVoice: "完成提示语音",
      completeVoiceHint: "主任务完成时播放一次",
      typing: "界面打字音",
      typingHint: "在输入框中键入时播放短促提示",
      portrait: "显示角色立绘",
      portraitHint: "随明暗主题切换驾驶员",
      portraitStrength: "背景强度",
      portraitStrengthHint: "线稿背景透明度",
      tps: "输出速度 HUD",
      tpsHint: "根据流式回复文字估算 token，以平滑窗口显示即时、峰值与平均速度",
      previewBoot: "启动语音",
      previewBootHint: "同步阶段播放",
      previewPick: "选择应答",
      previewPickHint: "切换驾驶员时播放",
      previewWelcome: "欢迎语音",
      previewWelcomeHint: "启动完成后播放",
      previewApproval: "审核提醒",
      previewApprovalHint: "人工审批待处理",
      previewComplete: "完成提醒",
      previewCompleteHint: "主任务正常完成",
      needAssets: "需要先导入本机 EVA 主题素材",
      reset: "重置全部",
      on: "开启",
      off: "关闭",
      driverAsuka: "明日香",
      driverRei: "绫波丽",
      switchToDriver: "切换到{driver}（EVA-{unit}）",
      decrease: "减小{label}",
      increase: "增大{label}",
      packUnavailable: "EVA 主题素材未导入",
      tpsAria: "估算输出速度",
      tpsTitle: "估算值：根据 2.4 秒滑动窗口内的文字增量换算",
    },
    ja: {
      panelTitle: "表示設定",
      panelSubtitle: "DISPLAY CONFIG",
      close: "表示設定を閉じる",
      panelAria: "EVA キャラクターテーマ表示設定",
      settingsAria: "EVA 表示設定",
      dragHint: "ヘッダーをドラッグして自由に移動",
      groupPilot: "パイロットと言語",
      groupStartup: "起動とサウンド",
      groupPreview: "ボイス試聴",
      groupVisual: "外観と出力",
      languageAria: "表示言語",
      boot: "起動アニメーション",
      bootHint: "次回起動時にパイロット選択と NERV シーケンスを再生；アプリ内のテーマ切り替えでは再生しません",
      bootVoice: "起動ボイス",
      bootVoiceHint: "同期中に現在のパイロット音声を再生",
      pickVoice: "選択応答",
      pickVoiceHint: "パイロット切り替え時に短い音声を再生",
      welcomeVoice: "歓迎ボイス",
      welcomeVoiceHint: "起動完了後に再生",
      approvalVoice: "承認待ちボイス",
      approvalVoiceHint: "承認待ちが表示された時に一度再生",
      completeVoice: "完了通知ボイス",
      completeVoiceHint: "メインタスク完了時に一度再生",
      typing: "入力サウンド",
      typingHint: "入力欄でキー入力時に短い音を再生",
      portrait: "キャラクター立ち絵",
      portraitHint: "テーマに合わせてパイロットを切り替え",
      portraitStrength: "背景強度",
      portraitStrengthHint: "線画背景の透明度",
      tps: "出力速度 HUD",
      tpsHint: "ストリーミング本文から token を推定し、平滑化した現在・ピーク・平均速度を表示",
      previewBoot: "起動ボイス",
      previewBootHint: "同期中に再生",
      previewPick: "選択応答",
      previewPickHint: "パイロット切り替え時に再生",
      previewWelcome: "歓迎ボイス",
      previewWelcomeHint: "起動完了後に再生",
      previewApproval: "承認待ち通知",
      previewApprovalHint: "手動承認待ち",
      previewComplete: "完了通知",
      previewCompleteHint: "メインタスク正常完了",
      needAssets: "先にローカル EVA テーマ素材をインポートしてください",
      reset: "全てリセット",
      on: "オン",
      off: "オフ",
      driverAsuka: "アスカ",
      driverRei: "レイ",
      switchToDriver: "{driver}に切り替え（EVA-{unit}）",
      decrease: "{label}を下げる",
      increase: "{label}を上げる",
      packUnavailable: "EVA テーマ素材が未インポートです",
      tpsAria: "推定出力速度",
      tpsTitle: "推定値：2.4 秒のスライディングウィンドウ内の文字増分から換算",
    },
    en: {
      panelTitle: "DISPLAY CONFIG",
      panelSubtitle: "EVA THEME",
      close: "Close display settings",
      panelAria: "EVA character theme display settings",
      settingsAria: "EVA display settings",
      dragHint: "Drag the header to move the panel freely",
      groupPilot: "PILOT & LANGUAGE",
      groupStartup: "STARTUP & AUDIO",
      groupPreview: "VOICE PREVIEW",
      groupVisual: "APPEARANCE & OUTPUT",
      languageAria: "Interface language",
      boot: "Boot animation",
      bootHint: "Play the pilot selection and NERV sequence on next launch; not replayed when switching themes in-app",
      bootVoice: "Startup voice",
      bootVoiceHint: "Play the current pilot voice during sync",
      pickVoice: "Select response",
      pickVoiceHint: "Play a short voice when switching pilot",
      welcomeVoice: "Welcome voice",
      welcomeVoiceHint: "Play after startup completes",
      approvalVoice: "Approval alert",
      approvalVoiceHint: "Play once when an approval request appears",
      completeVoice: "Completion alert",
      completeVoiceHint: "Play once when the main task completes",
      typing: "Typing SFX",
      typingHint: "Play a short cue while typing in the composer",
      portrait: "Show character portrait",
      portraitHint: "Switch pilot with the light or dark theme",
      portraitStrength: "Background strength",
      portraitStrengthHint: "Line-art background opacity",
      tps: "Output speed HUD",
      tpsHint: "Estimate tokens from streamed reply text with a smoothed rate window",
      previewBoot: "Startup voice",
      previewBootHint: "Play during sync",
      previewPick: "Select response",
      previewPickHint: "Play when switching pilot",
      previewWelcome: "Welcome voice",
      previewWelcomeHint: "Play after startup completes",
      previewApproval: "Approval alert",
      previewApprovalHint: "Waiting for manual approval",
      previewComplete: "Completion alert",
      previewCompleteHint: "Main task completed normally",
      needAssets: "Import local EVA theme assets first",
      reset: "Reset all",
      on: "ON",
      off: "OFF",
      driverAsuka: "Asuka",
      driverRei: "Rei",
      switchToDriver: "Switch to {driver} (EVA-{unit})",
      decrease: "Decrease {label}",
      increase: "Increase {label}",
      packUnavailable: "EVA theme assets not imported",
      tpsAria: "Estimated output speed",
      tpsTitle: "EST: calculated from text growth in a 2.4-second sliding window",
    },
  });
  const t = (key, values = null) => {
    let text = messages[options.locale]?.[key] ?? messages["zh-Hant"][key] ?? key;
    if (values && typeof values === "object") {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
  const completionStableMs = 3000;
  const welcomeFreshMs = 30000;
  const ranges = Object.freeze({ portraitStrength: [0.03, 0.28] });
  const audioLevels = Object.freeze({
    preview: 1,
    voice: 1,
    task: 1,
    typing: 0.4,
  });
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
  let activityPollTimer = null;
  let markerPollTimer = null;
  let completionTimer = null;
  let activityMonitorActive = false;
  let lastApprovalAt = 0;
  const seenApprovals = new Set();
  const completionGate = createCompletionGate({ stableMs: completionStableMs });
  let markedBrowserRail = null;
  let markedBrowserSurface = null;
  let markedSummaryDialog = null;
  const markedQueueRails = new Set();
  const markedQueueCards = new Set();

  function normalize(key, value) {
    if (!Object.hasOwn(defaults, key)) return undefined;
    if (key === "locale") {
      return locales.includes(value) ? value : defaults.locale;
    }
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
    { id: "asuka", unit: "02", nameKey: "driverAsuka", en: "ASUKA", head: "asukaHead", portrait: "asukaPortrait", pick: "asukaPickVoice" },
    { id: "rei", unit: "00", nameKey: "driverRei", en: "REI", head: "reiHead", portrait: "reiPortrait", pick: "reiPickVoice" },
  ];
  const previewSpecs = [
    { id: "boot", labelKey: "previewBoot", detailKey: "previewBootHint" },
    { id: "pick", labelKey: "previewPick", detailKey: "previewPickHint" },
    { id: "welcome", labelKey: "previewWelcome", detailKey: "previewWelcomeHint" },
    { id: "approval", labelKey: "previewApproval", detailKey: "previewApprovalHint" },
    { id: "complete", labelKey: "previewComplete", detailKey: "previewCompleteHint" },
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
  settingsButton.setAttribute("aria-label", t("settingsAria"));
  settingsButton.innerHTML = "<span>設</span><small>SETTINGS</small>";
  overlay.appendChild(settingsButton);

  const panel = document.createElement("section");
  panel.id = "eva-codex-skin-settings";
  panel.className = "eva-config-panel";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("role", "region");
  panel.setAttribute("aria-label", t("panelAria"));
  panel.setAttribute("lang", options.locale);
  panel.innerHTML = [
    '<header class="eva-config-head" data-eva-drag-handle>',
    '<span class="eva-config-grip" aria-hidden="true"></span>',
    '<div><b></b><small></small></div>',
    '<button type="button" class="eva-config-close" aria-label="" title="">×</button></header>',
    '<div class="eva-config-body"></div>',
    '<footer class="eva-config-foot"><span class="eva-config-pack"></span>',
    '<button type="button" class="eva-config-reset"></button></footer>',
  ].join("");
  overlay.appendChild(panel);

  const tpsHud = document.createElement("div");
  tpsHud.className = "eva-tps-hud";
  tpsHud.hidden = true;
  tpsHud.setAttribute("role", "status");
  tpsHud.setAttribute("aria-live", "off");
  tpsHud.innerHTML = [
    '<div class="eva-tps-line"><span class="eva-tps-value">0</span><small>tok/s</small><em>EST</em></div>',
    '<svg class="eva-tps-spark" viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">',
    '<polyline points="0,22 100,22"></polyline></svg>',
    '<div class="eva-tps-meta"><span>PEAK <b>0</b></span><span>AVG <b>0</b></span></div>',
  ].join("");
  overlay.appendChild(tpsHud);

  const body = panel.querySelector(".eva-config-body");
  const packNode = panel.querySelector(".eva-config-pack");
  const panelTitle = panel.querySelector(".eva-config-head b");
  const panelSubtitle = panel.querySelector(".eva-config-head small");
  const closeButton = panel.querySelector(".eva-config-close");
  const resetButton = panel.querySelector(".eva-config-reset");
  const panelHead = panel.querySelector(".eva-config-head");
  const tpsValue = tpsHud.querySelector(".eva-tps-value");
  const tpsPeak = tpsHud.querySelector(".eva-tps-meta b");
  const tpsAverage = tpsHud.querySelectorAll(".eva-tps-meta b")[1];
  const tpsSpark = tpsHud.querySelector(".eva-tps-spark polyline");
  const controls = [];
  const previewButtons = [];
  const groupNodes = [];
  const pilotButtons = new Map();
  const languageButtons = new Map();
  const packVersion = String(config.packVersion || "").trim();
  const packCommit = String(config.packCommit || "").trim().slice(0, 8);
  let openGroupKey = "groupPilot";
  let panelCloseTimer = null;
  let panelLeft = null;
  let panelTop = null;
  let dragState = null;
  if (packVersion) packNode.textContent = `EVA THEME ${packVersion}${packCommit ? " / " + packCommit : ""}`;
  else packNode.textContent = t("packUnavailable");

  function setGroupOpen(group, open, exclusive = true) {
    const next = Boolean(open);
    if (next && exclusive) {
      for (const other of groupNodes) {
        if (other !== group && other.open) setGroupOpen(other, false, false);
      }
    }
    group.open = next;
    group.content.hidden = !next;
    group.toggle.setAttribute("aria-expanded", String(next));
    group.mark.textContent = next ? "−" : "+";
    if (next) openGroupKey = group.key;
    else if (openGroupKey === group.key) openGroupKey = null;
    if (panelOpen && panelLeft !== null && panelTop !== null) {
      requestAnimationFrame(() => {
        if (panelOpen) setPanelPosition(panelLeft, panelTop);
      });
    }
  }

  function addGroup(key) {
    const group = document.createElement("section");
    group.className = "eva-config-group";
    group.dataset.evaGroup = key;
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "eva-config-group-toggle";
    toggle.setAttribute("aria-expanded", "false");
    const heading = document.createElement("h2");
    heading.textContent = t(key);
    const mark = document.createElement("span");
    mark.className = "eva-config-group-mark";
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = "+";
    toggle.append(heading, mark);
    const content = document.createElement("div");
    content.className = "eva-config-group-body";
    content.id = `eva-config-group-${key}`;
    content.hidden = true;
    group.append(toggle, content);
    toggle.setAttribute("aria-controls", content.id);
    body.appendChild(group);
    const entry = { key, element: group, toggle, heading, mark, content, open: false };
    toggle.addEventListener("click", () => setGroupOpen(entry, !entry.open));
    groupNodes.push(entry);
    if (key === "groupPilot") setGroupOpen(entry, true, false);
    return entry;
  }

  function addSwitch(group, key, label, hint, available = true) {
    const row = document.createElement("div");
    row.className = "eva-config-row";
    const copy = document.createElement("div");
    copy.className = "eva-config-copy";
    const name = document.createElement("b");
    name.textContent = t(label);
    const detail = document.createElement("small");
    detail.textContent = available ? t(hint) : t("needAssets");
    copy.append(name, detail);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-switch";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-label", t(label));
    button.disabled = !available;
    button.addEventListener("click", () => {
      if (button.disabled) return;
      options[key] = !options[key];
      saveOptions();
      refresh();
    });
    row.append(copy, button);
    group.content.appendChild(row);
    controls.push({ kind: "switch", key, labelKey: label, hintKey: hint, name, detail, button, available });
  }

  function addRange(group, key, label, hint, available = true) {
    const row = document.createElement("div");
    row.className = "eva-config-row eva-config-range-row";
    const copy = document.createElement("div");
    copy.className = "eva-config-copy";
    const name = document.createElement("b");
    name.textContent = t(label);
    const detail = document.createElement("small");
    detail.textContent = t(hint);
    copy.append(name, detail);
    const output = document.createElement("output");
    output.className = "eva-config-value";
    row.append(copy, output);
    const strip = document.createElement("div");
    strip.className = "eva-config-range";
    const minus = document.createElement("button");
    minus.type = "button";
    minus.textContent = "−";
    minus.setAttribute("aria-label", t("decrease", { label: t(label) }));
    const input = document.createElement("input");
    const [min, max] = ranges[key];
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.step = "0.01";
    input.setAttribute("aria-label", t(label));
    const plus = document.createElement("button");
    plus.type = "button";
    plus.textContent = "＋";
    plus.setAttribute("aria-label", t("increase", { label: t(label) }));
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
    group.content.appendChild(row);
    controls.push({
      kind: "range",
      key,
      labelKey: label,
      hintKey: hint,
      name,
      detail,
      input,
      output,
      minus,
      plus,
      available,
    });
  }

  const pilotGroup = addGroup("groupPilot");
  const pilotGrid = document.createElement("div");
  pilotGrid.className = "eva-config-pilots";
  pilotGroup.content.appendChild(pilotGrid);
  for (const driver of drivers) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-pilot";
    button.dataset.evaUiDriver = driver.id;
    button.setAttribute("aria-label", t("switchToDriver", {
      driver: t(driver.nameKey),
      unit: driver.unit,
    }));
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
        if (id) playMedia(id, null, audioLevels.voice);
      }
    });
    pilotGrid.appendChild(button);
    pilotButtons.set(driver.id, button);
  }

  const languageRow = document.createElement("div");
  languageRow.className = "eva-config-language-row";
  const languageLabel = document.createElement("span");
  languageLabel.className = "eva-config-language-label";
  const languageGroup = document.createElement("div");
  languageGroup.className = "eva-config-languages";
  languageGroup.setAttribute("role", "group");
  languageGroup.setAttribute("aria-label", t("languageAria"));
  for (const locale of locales) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-language";
    button.dataset.evaUiLocale = locale;
    button.textContent = localeLabels[locale];
    button.setAttribute("aria-label", localeLabels[locale]);
    button.addEventListener("click", () => {
      if (options.locale === locale) return;
      options.locale = locale;
      saveOptions();
      applyLocale();
    });
    languageGroup.appendChild(button);
    languageButtons.set(locale, button);
  }
  languageRow.append(languageLabel, languageGroup);
  pilotGroup.content.appendChild(languageRow);

  languageLabel.textContent = t("languageAria");

  const bootGroup = addGroup("groupStartup");
  addSwitch(
    bootGroup,
    "boot",
    "boot",
    "bootHint",
  );
  addSwitch(bootGroup, "bootVoice", "bootVoice", "bootVoiceHint", hasBootVoice());
  addSwitch(bootGroup, "pickVoice", "pickVoice", "pickVoiceHint", hasPickVoice());
  addSwitch(bootGroup, "welcomeVoice", "welcomeVoice", "welcomeVoiceHint", hasWelcomeVoice());
  addSwitch(
    bootGroup,
    "approvalVoice",
    "approvalVoice",
    "approvalVoiceHint",
    hasAny(["asukaApproval", "reiApproval"]),
  );
  addSwitch(
    bootGroup,
    "completeVoice",
    "completeVoice",
    "completeVoiceHint",
    hasAny(["asukaComplete", "reiComplete"]),
  );
  addSwitch(bootGroup, "typing", "typing", "typingHint", hasMedia("typing"));

  const previewGroup = addGroup("groupPreview");
  const previewGrid = document.createElement("div");
  previewGrid.className = "eva-config-previews";
  previewGroup.content.appendChild(previewGrid);
  for (const spec of previewSpecs) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "eva-config-preview";
    button.dataset.evaPreview = spec.id;
    button.innerHTML = `<b>${t(spec.labelKey)}</b><small>${t(spec.detailKey)}</small>`;
    button.addEventListener("click", () => {
      const id = mediaId(currentDriver, spec.id);
      if (!id) return;
      playMedia(
        id,
        button,
        spec.id === "approval" || spec.id === "complete"
          ? audioLevels.task
          : audioLevels.preview,
      );
    });
    previewGrid.appendChild(button);
    previewButtons.push(button);
  }

  const visualGroup = addGroup("groupVisual");
  addSwitch(visualGroup, "portrait", "portrait", "portraitHint", hasPortrait());
  addRange(visualGroup, "portraitStrength", "portraitStrength", "portraitStrengthHint", hasPortrait());
  addSwitch(visualGroup, "tps", "tps", "tpsHint");

  function applyLocale() {
    const locale = options.locale;
    panel.lang = locale;
    panel.setAttribute("aria-label", t("panelAria"));
    settingsButton.setAttribute("aria-label", t("settingsAria"));
    panelTitle.textContent = t("panelTitle");
    panelSubtitle.textContent = t("panelSubtitle");
    closeButton.setAttribute("aria-label", t("close"));
    closeButton.title = `${t("close")} (Esc)`;
    panelHead.title = t("dragHint");
    resetButton.textContent = t("reset");
    languageLabel.textContent = t("languageAria");
    languageGroup.setAttribute("aria-label", t("languageAria"));
    if (!packVersion) packNode.textContent = t("packUnavailable");
    for (const group of groupNodes) {
      group.heading.textContent = t(group.key);
      group.toggle.setAttribute("aria-label", t(group.key));
    }
    for (const control of controls) {
      const label = t(control.labelKey);
      control.name.textContent = label;
      control.detail.textContent = control.available ? t(control.hintKey) : t("needAssets");
      if (control.kind === "switch") {
        control.button.setAttribute("aria-label", label);
      } else {
        control.input.setAttribute("aria-label", label);
        control.minus.setAttribute("aria-label", t("decrease", { label }));
        control.plus.setAttribute("aria-label", t("increase", { label }));
      }
    }
    previewButtons.forEach((button, index) => {
      const spec = previewSpecs[index];
      button.innerHTML = `<b>${t(spec.labelKey)}</b><small>${t(spec.detailKey)}</small>`;
    });
    for (const driver of drivers) {
      pilotButtons.get(driver.id)?.setAttribute("aria-label", t("switchToDriver", {
        driver: t(driver.nameKey),
        unit: driver.unit,
      }));
    }
    for (const [localeId, button] of languageButtons) {
      button.setAttribute("aria-pressed", String(localeId === locale));
    }
    tpsHud.setAttribute("aria-label", t("tpsAria"));
    tpsHud.title = t("tpsTitle");
    refresh();
    if (panelOpen && panelLeft !== null && panelTop !== null) {
      requestAnimationFrame(() => {
        if (panelOpen) setPanelPosition(panelLeft, panelTop);
      });
    }
  }

  const TPS_WINDOW_MS = 2400;
  const TPS_SAMPLE_MS = 320;
  const TPS_TOKEN_WEIGHTS = Object.freeze({
    han: 0.78,
    kana: 0.82,
    hangul: 1.12,
    symbol: 1.2,
    punctuation: 0.58,
  });

  const tpsState = {
    timer: null,
    turnKey: null,
    lastTokens: 0,
    lastAt: 0,
    current: 0,
    peak: 0,
    total: 0,
    turnStartAt: 0,
    lastChangeAt: 0,
    lastSampleAt: 0,
    history: [],
    samples: [],
  };
  const assistantTokenCache = new WeakMap();

  function estimateTokens(text) {
    const source = String(text || "");
    if (!source) return 0;
    const segments = source.match(
      /\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana}|\p{Script=Hangul}|\p{Extended_Pictographic}|[A-Za-z0-9_]+|[^\s]/gu,
    ) || [];
    let tokens = 0;
    for (const segment of segments) {
      if (/^\p{Script=Han}$/u.test(segment)) tokens += TPS_TOKEN_WEIGHTS.han;
      else if (/^[\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(segment)) tokens += TPS_TOKEN_WEIGHTS.kana;
      else if (/^\p{Script=Hangul}$/u.test(segment)) tokens += TPS_TOKEN_WEIGHTS.hangul;
      else if (/^\p{Extended_Pictographic}$/u.test(segment)) tokens += TPS_TOKEN_WEIGHTS.symbol;
      else if (/^[A-Za-z0-9_]+$/.test(segment)) tokens += Math.max(0.35, segment.length * 0.25);
      else tokens += TPS_TOKEN_WEIGHTS.punctuation;
    }
    return Math.max(1, tokens);
  }

  function nodeTokenCount(node) {
    const text = node.textContent || "";
    const previous = assistantTokenCache.get(node);
    if (previous?.text === text) return previous.tokens;
    let tokens;
    if (previous && text.length > previous.length && text.startsWith(previous.text)) {
      tokens = previous.tokens + estimateTokens(text.slice(previous.length));
    } else {
      tokens = estimateTokens(text);
    }
    assistantTokenCache.set(node, { text, length: text.length, tokens });
    return tokens;
  }

  function tpsSnapshot() {
    const turns = document.querySelectorAll("[data-turn-key]");
    let turn = null;
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      if (isVisible(turns[index])) {
        turn = turns[index];
        break;
      }
    }
    if (!turn) return null;
    const key = turn.getAttribute("data-turn-key") || "";
    const nodes = turn.querySelectorAll(
      '[data-markdown-text-style="assistant-message"]',
    );
    let tokens = 0;
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (index < nodes.length - 1) {
        const cached = assistantTokenCache.get(node);
        if (cached) {
          tokens += cached.tokens;
          continue;
        }
      }
      tokens += nodeTokenCount(node);
    }
    return { key, tokens };
  }

  function resetTps(tokens = 0, now = performance.now()) {
    tpsState.turnKey = null;
    tpsState.lastTokens = tokens;
    tpsState.lastAt = now;
    tpsState.current = 0;
    tpsState.peak = 0;
    tpsState.total = 0;
    tpsState.turnStartAt = 0;
    tpsState.lastChangeAt = 0;
    tpsState.lastSampleAt = now;
    tpsState.history = [{ at: now, tokens }];
    tpsState.samples = [];
  }

  function sampleWindowRate(now, tokens) {
    const history = tpsState.history;
    history.push({ at: now, tokens });
    while (history.length > 1 && now - history[1].at >= TPS_WINDOW_MS) history.shift();
    const base = history[0];
    const span = Math.max(0, (now - base.at) / 1000);
    if (span < 0.45 || tokens <= base.tokens) return 0;
    return (tokens - base.tokens) / span;
  }

  function drawTps() {
    const samples = tpsState.samples;
    const peak = Math.max(1, ...samples);
    const width = 100;
    const height = 22;
    let points;
    if (samples.length === 0) {
      points = `0,${height} 100,${height}`;
    } else if (samples.length === 1) {
      const y = height - Math.max(1, (samples[0] / peak) * (height - 3));
      points = `0,${y.toFixed(1)} 100,${y.toFixed(1)}`;
    } else {
      const step = width / (samples.length - 1);
      points = samples.map((value, index) => {
        const y = height - Math.max(1, (value / peak) * (height - 3));
        return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
      }).join(" ");
    }
    tpsSpark.setAttribute("points", points);
  }

  function showTps() {
    if (!tpsHud.hidden) {
      drawTps();
      return;
    }
    tpsHud.hidden = false;
    drawTps();
  }

  function hideTps() {
    tpsHud.hidden = true;
    tpsState.current = 0;
    tpsState.samples = [];
  }

  function sampleTps() {
    if (
      disposed ||
      !options.tps ||
      document.visibilityState === "hidden" ||
      bootOverlayActive()
    ) return;
    const now = performance.now();
    const running = isTaskRunning();
    if (tpsState.lastSampleAt && now - tpsState.lastSampleAt > TPS_WINDOW_MS * 2) {
      resetTps(tpsState.lastTokens, now);
    }
    tpsState.lastSampleAt = now;
    if (!running && tpsHud.hidden && now - tpsState.lastChangeAt > 2400) return;
    const snapshot = tpsSnapshot();
    if (!snapshot) {
      if (!running && now - tpsState.lastChangeAt > 2400) hideTps();
      return;
    }

    if (tpsState.turnKey !== snapshot.key) {
      resetTps(snapshot.tokens, now);
      tpsState.turnKey = snapshot.key;
      hideTps();
    }

    const previousTokens = tpsState.lastTokens;
    const delta = Math.max(0, snapshot.tokens - previousTokens);
    const windowRate = sampleWindowRate(now, snapshot.tokens);
    if (delta > 0.01) {
      if (!tpsState.turnStartAt) {
        tpsState.turnStartAt = tpsState.lastAt || now;
      }
      tpsState.total += delta;
      tpsState.lastChangeAt = now;
    }
    tpsState.current = now - tpsState.lastChangeAt < 1200 ? windowRate : 0;
    tpsState.peak = Math.max(tpsState.peak, tpsState.current);

    tpsState.lastTokens = snapshot.tokens;
    tpsState.lastAt = now;
    const active = running || now - tpsState.lastChangeAt < 1600;
    if (!active) {
      if (now - tpsState.lastChangeAt > 2400) hideTps();
      return;
    }
    if (tpsState.total <= 0 && tpsState.current <= 0) {
      hideTps();
      return;
    }

    tpsState.samples.push(tpsState.current);
    if (tpsState.samples.length > 30) tpsState.samples.shift();
    const activeSeconds = tpsState.turnStartAt && tpsState.lastChangeAt > tpsState.turnStartAt
      ? (tpsState.lastChangeAt - tpsState.turnStartAt) / 1000
      : 0;
    const average = activeSeconds >= 0.45
      ? tpsState.total / activeSeconds
      : tpsState.current;
    tpsValue.textContent = String(Math.max(0, Math.round(tpsState.current)));
    tpsPeak.textContent = String(Math.max(0, Math.round(tpsState.peak)));
    tpsAverage.textContent = String(Math.max(0, Math.round(average)));
    showTps();
  }

  function startTps() {
    if (tpsState.timer || disposed) return;
    const now = performance.now();
    const snapshot = tpsSnapshot();
    resetTps(snapshot?.tokens || 0, now);
    if (snapshot?.key) tpsState.turnKey = snapshot.key;
    tpsState.timer = setInterval(sampleTps, TPS_SAMPLE_MS);
  }

  function stopTps() {
    if (!tpsState.timer) return;
    clearInterval(tpsState.timer);
    tpsState.timer = null;
  }

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

  function playMedia(id, button = null, volume = audioLevels.preview) {
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
        typingAudio.volume = audioLevels.typing;
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
      if (id) playMedia(id, null, audioLevels.voice);
    }
  }

  function refresh() {
    applyPortrait();
    refreshSkinMarkers();
    syncActivityMonitoring();
    for (const control of controls) {
      if (control.kind === "switch") {
        const on = Boolean(options[control.key]);
        control.button.setAttribute("aria-checked", String(on));
        control.button.textContent = on ? t("on") : t("off");
        control.button.disabled = !control.available;
      } else {
        const dependency = control.key === "portraitStrength" ? options.portrait : true;
        const enabled = control.available && dependency;
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
      const id = mediaId(currentDriver, button.dataset.evaPreview);
      button.disabled = !id;
      button.title = id ? "" : t("needAssets");
    }
    if (options.tps) startTps();
    else {
      stopTps();
      hideTps();
    }
  }

  function clampPanelLeft(value) {
    const width = panel.offsetWidth || panel.getBoundingClientRect().width;
    const edge = 10;
    const max = Math.max(edge, window.innerWidth - width - edge);
    return Math.min(max, Math.max(edge, Number(value) || edge));
  }

  function clampPanelTop(value) {
    const height = panel.offsetHeight || panel.getBoundingClientRect().height;
    const edge = 10;
    const max = Math.max(edge, window.innerHeight - height - edge);
    return Math.min(max, Math.max(edge, Number(value) || edge));
  }

  function setPanelPosition(left, top) {
    panelLeft = clampPanelLeft(left);
    panelTop = clampPanelTop(top);
    panel.style.setProperty("--eva-panel-left", `${panelLeft}px`);
    panel.style.setProperty("--eva-panel-right", "auto");
    panel.style.setProperty("--eva-panel-top", `${panelTop}px`);
    panel.style.setProperty("--eva-panel-translate-x", "0px");
    panel.style.setProperty("--eva-panel-translate-y", "0px");
  }

  function openPanel() {
    if (panelOpen || disposed) return;
    if (panelCloseTimer) {
      clearTimeout(panelCloseTimer);
      panelCloseTimer = null;
    }
    panelOpen = true;
    panel.hidden = false;
    overlay.classList.add("has-config-open");
    settingsButton.setAttribute("aria-expanded", "true");
    refresh();
    if (panelLeft !== null && panelTop !== null) setPanelPosition(panelLeft, panelTop);
    requestAnimationFrame(() => {
      if (panelOpen) panel.classList.add("is-open");
    });
    const selected = panel.querySelector('[data-eva-ui-driver][aria-pressed="true"]');
    (selected || panel.querySelector(".eva-config-close"))?.focus?.({ preventScroll: true });
  }

  function closePanel(restoreFocus = false) {
    if (!panelOpen) return;
    panelOpen = false;
    panel.classList.remove("is-open");
    overlay.classList.remove("has-config-open");
    settingsButton.setAttribute("aria-expanded", "false");
    stopAudio();
    if (panelCloseTimer) clearTimeout(panelCloseTimer);
    panelCloseTimer = setTimeout(() => {
      panelCloseTimer = null;
      if (!panelOpen) panel.hidden = true;
    }, 170);
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
    applyLocale();
  };
  const onKey = (event) => {
    if (!panelOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePanel(true);
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...panel.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    )].filter((node) => !node.closest("[hidden]") && node.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
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
  const canDragPanel = () => (
    panelOpen &&
    !window.matchMedia("(max-width: 760px)").matches
  );
  const onDragStart = (event) => {
    if (!canDragPanel() || event.button !== 0 || event.target.closest("button")) return;
    const rect = panel.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    panel.classList.add("is-dragging");
    try {
      panelHead.setPointerCapture?.(event.pointerId);
    } catch {}
    event.preventDefault();
  };
  const onDragMove = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    setPanelPosition(
      dragState.startLeft + event.clientX - dragState.startX,
      dragState.startTop + event.clientY - dragState.startY,
    );
    event.preventDefault();
  };
  const onDragEnd = (event) => {
    if (!dragState) return;
    if (event.pointerId !== dragState.pointerId) return;
    dragState = null;
    panel.classList.remove("is-dragging");
    try {
      if (panelHead.hasPointerCapture?.(event.pointerId)) {
        panelHead.releasePointerCapture(event.pointerId);
      }
    } catch {}
  };
  const onResize = () => {
    if (!panelOpen || panelLeft === null || panelTop === null) return;
    if (window.matchMedia("(max-width: 760px)").matches) return;
    setPanelPosition(panelLeft, panelTop);
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
    playMedia(id, null, audioLevels.voice);
  };

  function isVisible(node) {
    if (!(node instanceof Element) || !node.isConnected) return false;
    return !node.closest("[hidden], [inert], [aria-hidden='true']");
  }

  function bootOverlayActive() {
    const boot = document.getElementById("eva-codex-skin-boot");
    return Boolean(boot && boot.isConnected);
  }

  function isTaskRunning() {
    const nodes = document.querySelectorAll([
      'button[aria-label="停止"]',
      'button[aria-label="Stop"]',
      'button[aria-label="Stop generating"]',
      '[data-app-action-sidebar-thread-active="true"][data-sidebar-indicator="working"]',
      '[data-app-action-sidebar-thread-active="true"] [data-loading-indicator]',
      '[data-app-action-sidebar-thread-active="true"] [aria-label="处理中"]',
      '[data-app-action-sidebar-thread-active="true"] [aria-label="Working"]',
    ].join(","));
    for (const node of nodes) {
      if (isVisible(node)) return true;
    }
    return false;
  }

  function reconcileMarkedNodes(marked, next, attribute) {
    for (const node of marked) {
      if (!next.has(node)) node.removeAttribute(attribute);
    }
    for (const node of next) {
      if (!marked.has(node)) node.setAttribute(attribute, "");
    }
    marked.clear();
    for (const node of next) marked.add(node);
  }

  function refreshSkinMarkers() {
    if (disposed) return;
    const browserInput = document.querySelector("[data-browser-sidebar-address-input]");
    const browserRail = browserInput?.closest(
      'aside[data-app-shell-focus-area="right-panel"]',
    ) || null;
    const browserSurface = browserInput?.closest(
      '[data-menu-overlay-surface="true"]',
    ) || null;
    if (markedBrowserRail !== browserRail) {
      markedBrowserRail?.removeAttribute("data-eva-browser-rail");
      browserRail?.setAttribute("data-eva-browser-rail", "");
      markedBrowserRail = browserRail;
    }
    if (markedBrowserSurface !== browserSurface) {
      markedBrowserSurface?.removeAttribute("data-eva-browser-surface");
      browserSurface?.setAttribute("data-eva-browser-surface", "");
      markedBrowserSurface = browserSurface;
    }
    const hasBrowser = Boolean(browserInput);
    if (root.hasAttribute("data-eva-browser-active") !== hasBrowser) {
      root.toggleAttribute("data-eva-browser-active", hasBrowser);
    }

    const queueRails = new Set();
    for (const action of document.querySelectorAll(
      'button[aria-label="引导"],button[aria-label="删除排队的消息"],button[aria-label="排队消息操作"]',
    )) {
      const rail = action.closest('[class*="rail-"]');
      if (rail) queueRails.add(rail);
    }
    reconcileMarkedNodes(markedQueueRails, queueRails, "data-eva-queue-rail");

    const queueCards = new Set();
    for (const card of document.querySelectorAll(
      '[class*="bg-surface-elevated-secondary"][class*="rounded-3xl"]',
    )) {
      if (card.querySelector("button span.truncate-text")) queueCards.add(card);
    }
    reconcileMarkedNodes(markedQueueCards, queueCards, "data-eva-queue-card");

    const summaryDialog = document.querySelector(
      '[class~="group/summary-panel"]',
    )?.closest('[role="dialog"]') || null;
    if (markedSummaryDialog !== summaryDialog) {
      markedSummaryDialog?.removeAttribute("data-eva-summary-dialog");
      summaryDialog?.setAttribute("data-eva-summary-dialog", "");
      markedSummaryDialog = summaryDialog;
    }
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
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
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
    const text = (node.textContent || "")
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

  function hasVisibleApproval(nodes = null) {
    const source = nodes || document.querySelectorAll(
      '[data-codex-approval-surface="true"]',
    );
    return [...source].some(isVisible);
  }

  function approvalKey(node) {
    const text = (node.textContent || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 360);
    const buttons = [...node.querySelectorAll("button")]
      .map((button) => (
        button.textContent ||
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
    return playMedia(id, null, audioLevels.task);
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
    if (disposed || document.visibilityState === "hidden" || bootOverlayActive()) return;
    const now = performance.now();
    const running = isTaskRunning();
    const approvalNodes = [...document.querySelectorAll(
      '[data-codex-approval-surface="true"]',
    )].filter(isVisible);
    const approvalVisible = approvalNodes.length > 0;
    const snapshot = latestFinalSnapshot();

    for (const node of approvalNodes) {
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
    }, 240);
  }

  function activityMonitoringWanted() {
    return Boolean(options.approvalVoice || options.completeVoice);
  }

  function stopActivityMonitor() {
    activityMonitorActive = false;
    if (activityObserver) activityObserver.disconnect();
    activityObserver = null;
    if (activityTimer) clearTimeout(activityTimer);
    if (activityPollTimer) clearInterval(activityPollTimer);
    if (completionTimer) clearTimeout(completionTimer);
    activityTimer = null;
    activityPollTimer = null;
    completionTimer = null;
  }

  function startActivityMonitor() {
    if (activityMonitorActive || disposed || !activityMonitoringWanted()) return;
    if (!document.body || typeof MutationObserver !== "function") return;
    completionGate.reset();
    seenApprovals.clear();
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
    activityObserver = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target;
        if (target instanceof Element &&
          target.closest("#eva-codex-skin-overlay, #eva-codex-skin-boot")) {
          continue;
        }
        scheduleActivityCheck();
        return;
      }
    });
    activityObserver.observe(document.body, {
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
    activityPollTimer = setInterval(() => {
      if (document.visibilityState !== "hidden") scheduleActivityCheck();
    }, 1000);
    activityMonitorActive = true;
  }

  function syncActivityMonitoring() {
    if (activityMonitoringWanted()) startActivityMonitor();
    else stopActivityMonitor();
  }

  settingsButton.addEventListener("click", onSettingsClick);
  panel.addEventListener("pointerdown", onPanelPointer);
  panel.addEventListener("click", onPanelClick);
  panelHead.addEventListener("pointerdown", onDragStart);
  panelHead.addEventListener("pointermove", onDragMove);
  panelHead.addEventListener("pointerup", onDragEnd);
  panelHead.addEventListener("pointercancel", onDragEnd);
  closeButton.addEventListener("click", onCloseClick);
  resetButton.addEventListener("click", onResetClick);
  document.addEventListener("keydown", onKey, true);
  document.addEventListener("pointerdown", onPointerDown, true);
  document.addEventListener("pointerup", onDragEnd, true);
  document.addEventListener("pointercancel", onDragEnd, true);
  document.addEventListener("input", onTypingInput, true);
  root.addEventListener("eva-skin-driver-change", onDriverChange);
  window.addEventListener("eva-skin-boot-finished", onBootFinished);
  window.addEventListener("resize", onResize);

  syncDriver(currentDriver, false);
  applyLocale();
  refreshSkinMarkers();
  markerPollTimer = setInterval(refreshSkinMarkers, 1000);
  syncActivityMonitoring();

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
    stopTps();
    stopActivityMonitor();
    if (markerPollTimer) clearInterval(markerPollTimer);
    if (panelCloseTimer) clearTimeout(panelCloseTimer);
    markerPollTimer = null;
    panelCloseTimer = null;
    dragState = null;
    markedBrowserRail?.removeAttribute("data-eva-browser-rail");
    markedBrowserSurface?.removeAttribute("data-eva-browser-surface");
    markedSummaryDialog?.removeAttribute("data-eva-summary-dialog");
    for (const node of markedQueueRails) node.removeAttribute("data-eva-queue-rail");
    for (const node of markedQueueCards) node.removeAttribute("data-eva-queue-card");
    markedQueueRails.clear();
    markedQueueCards.clear();
    root.removeAttribute("data-eva-browser-active");
    overlay.classList.remove("has-config-open");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("pointerup", onDragEnd, true);
    document.removeEventListener("pointercancel", onDragEnd, true);
    document.removeEventListener("input", onTypingInput, true);
    root.removeEventListener("eva-skin-driver-change", onDriverChange);
    window.removeEventListener("eva-skin-boot-finished", onBootFinished);
    window.removeEventListener("resize", onResize);
    settingsButton.removeEventListener("click", onSettingsClick);
    panelHead.removeEventListener("pointerdown", onDragStart);
    panelHead.removeEventListener("pointermove", onDragMove);
    panelHead.removeEventListener("pointerup", onDragEnd);
    panelHead.removeEventListener("pointercancel", onDragEnd);
    panel.remove();
    settingsButton.remove();
    portrait.remove();
    tpsHud.remove();
    try {
      delete root.dataset.evaPortrait;
      root.style.removeProperty("--eva-portrait-image");
      root.style.removeProperty("--eva-portrait-strength");
    } catch {}
  };

  return { open: openPanel, close: closePanel, refresh, cleanup };
}
