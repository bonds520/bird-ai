const i18n = {
  zh: {
    app_title: "鳥類辨識系統",
    tab_image: "圖片辨識",
    tab_audio: "鳴聲辨識",
    tab_records: "記錄",
    image_prompt: "拖曳或點選上傳鳥類圖片",
    image_hint: "支援 JPG、PNG、WebP、GIF，上限 100MB",
    audio_prompt: "拖曳或點選上傳鳥鳴音檔",
    audio_hint: "支援 MP3、WAV、OGG、FLAC、M4A，上限 100MB",
    btn_identify: "開始辨識",
    btn_reset: "重新上傳",
    loading_text: "辨識中，請稍候…",
    label_confidence: "信心度",
    label_habitat: "棲地",
    label_distribution: "分布",
    label_other_detections: "其他可能物種",
    source_claude: "Claude Vision",
    source_birdnet: "BirdNET",
    source_ollama_gemma4_enhanced: "Gemma4 Vision",
    correct_btn: "辨識有誤？點此更正",
    correct_title: "搜尋相似鳥種",
    correct_loading: "正在詢問 AI 並搜尋網路資料…",
    correct_current: "目前辨識：",
    correct_confirm: "確認更正",
    correct_done: "已更正為：",
    correct_wiki: "Wikipedia",
    err_no_bird_image: "圖片中未偵測到可辨識的鳥類",
    err_no_bird_audio: "音檔中未偵測到鳥類鳴叫聲",
    err_unsupported: "不支援的檔案格式",
    err_file_too_large: "檔案過大（上限 100MB）",
    err_server: "伺服器錯誤，請稍後再試",
    err_no_key: "本地 AI 服務未啟動或模型載入失敗，請檢查 Ollama 狀態",
    err_unknown: "發生未知錯誤，請重試",
    // save prompt
    save_prompt_title: "儲存至記錄？",
    save_today_label: "是否今日拍攝？",
    save_yes_today: "是，今天",
    save_other_date: "選擇其他日期",
    save_notes_placeholder: "備註（地點、行為…）",
    save_gps_hint: "📍 已取得 GPS 位置",
    save_confirm: "儲存",
    save_cancel: "略過",
    save_success: "✓ 已儲存！",
    // records tab
    records_search_placeholder: "搜尋物種名稱…",
    records_empty_title: "尚無觀察紀錄",
    records_empty_sub: "辨識後點選儲存，就會出現在這裡",
    records_load_more: "載入更多",
    records_del_yes: "刪除",
    records_del_no: "取消",
  },
  en: {
    app_title: "Bird Identification System",
    tab_image: "Image ID",
    tab_audio: "Audio ID",
    tab_records: "Records",
    image_prompt: "Drag & drop or click to upload a bird photo",
    image_hint: "Supports JPG, PNG, WebP, GIF — max 10MB",
    audio_prompt: "Drag & drop or click to upload a bird recording",
    audio_hint: "Supports MP3, WAV, OGG, FLAC, M4A — max 10MB",
    btn_identify: "Identify",
    btn_reset: "Upload Another",
    loading_text: "Identifying, please wait…",
    label_confidence: "Confidence",
    label_habitat: "Habitat",
    label_distribution: "Distribution",
    label_other_detections: "Other Possible Species",
    source_claude: "Claude Vision",
    source_birdnet: "BirdNET",
    source_ollama_gemma4_enhanced: "Gemma4 Vision",
    correct_btn: "Wrong ID? Click to correct",
    correct_title: "Find Similar Species",
    correct_loading: "Asking AI and fetching web data…",
    correct_current: "Current ID: ",
    correct_confirm: "Confirm Correction",
    correct_done: "Corrected to: ",
    correct_wiki: "Wikipedia",
    err_no_bird_image: "No identifiable bird detected in image",
    err_no_bird_audio: "No bird vocalizations detected in audio",
    err_unsupported: "Unsupported file format",
    err_file_too_large: "File too large (max 10MB)",
    err_server: "Server error, please try again",
    err_no_key: "Local AI service not running or model failed to load",
    err_unknown: "An unknown error occurred, please retry",
    // save prompt
    save_prompt_title: "Save to Records?",
    save_today_label: "Captured today?",
    save_yes_today: "Yes, today",
    save_other_date: "Pick a date",
    save_notes_placeholder: "Notes (location, behavior…)",
    save_gps_hint: "📍 GPS location acquired",
    save_confirm: "Save",
    save_cancel: "Skip",
    save_success: "✓ Saved!",
    // records tab
    records_search_placeholder: "Search species…",
    records_empty_title: "No records yet",
    records_empty_sub: "Save a sighting after identification and it will appear here",
    records_load_more: "Load more",
    records_del_yes: "Delete",
    records_del_no: "Cancel",
  },
};

const RECORDS_PAGE = 30;

const state = {
  lang: "zh",
  tab: "image",
  imageFile: null,
  audioFile: null,
  model: "",
  lastResult: null,
  lastSavedId: null,       // ID of the saved sighting (for post-save correction)
  // records
  recordsOffset: 0,
  recordsTotal: 0,
  recordsQuery: "",
  recordsDateFrom: "",
  recordsDateTo: "",
  // save prompt
  saveUseTodayDate: true,
  saveGpsLat: null,
  saveGpsLon: null,
  // correction
  correctSelectedSpecies: null,
};

// ── i18n ────────────────────────────────────────────
function t(key) { return i18n[state.lang][key] || key; }

function updateI18n() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[state.lang][key] !== undefined) el.textContent = i18n[state.lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (i18n[state.lang][key] !== undefined) el.placeholder = i18n[state.lang][key];
  });
  document.documentElement.lang = state.lang === "zh" ? "zh-TW" : "en";
  document.getElementById("lang-toggle").textContent = state.lang === "zh" ? "EN" : "中文";
  if (state.lastResult && !document.getElementById("results").hidden) renderResult(state.lastResult);
}

// ── Tab ──────────────────────────────────────────────
function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll(".tab").forEach(btn => {
    const active = btn.dataset.tab === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", active);
  });
  document.querySelectorAll(".panel").forEach(p => {
    p.classList.toggle("active", p.id === `panel-${tab}`);
  });
  hideResults();
  hideError();
  if (tab === "records") loadRecords(true);
}

// ── Loading / Results / Error ─────────────────────────
function setLoading(on) {
  document.getElementById("loading").hidden = !on;
  document.getElementById(`panel-${state.tab}`).style.display = on ? "none" : "";
  if (on) { hideResults(); hideError(); }
}

function hideResults() {
  document.getElementById("results").hidden = true;
  state.lastResult = null;
  state.lastSavedId = null;
  closeSavePrompt();
  closeCorrectPanel();
}

function hideError() { document.getElementById("error-box").hidden = true; }

function showError(msg) {
  document.getElementById("error-message").textContent = msg;
  document.getElementById("error-box").hidden = false;
}

function renderResult(data) {
  state.lastResult = data;
  const lang = state.lang;

  document.getElementById("res-zh-name").textContent = data.zh_name || "—";
  document.getElementById("res-en-name").textContent = data.en_name || "—";
  document.getElementById("res-scientific").textContent = data.scientific || "";

  const badge = document.getElementById("res-source-badge");
  const sourceKey = `source_${data.source}`;
  badge.textContent = t(sourceKey) !== sourceKey ? t(sourceKey) : data.source;
  badge.className = `source-badge ${data.source}`;

  const pct = Math.round(data.confidence * 100);
  document.getElementById("conf-pct").textContent = `${pct}%`;
  const fill = document.getElementById("conf-fill");
  fill.style.width = `${pct}%`;
  fill.style.backgroundPosition = `${100 - pct}% 0`;

  const habitat = data.habitat || {};
  const distribution = data.distribution || {};
  document.getElementById("res-habitat").textContent =
    (typeof habitat === "object" ? habitat[lang] : habitat) || "—";
  document.getElementById("res-distribution").textContent =
    (typeof distribution === "object" ? distribution[lang] : distribution) || "—";

  const extras = document.getElementById("birdnet-extras");
  if (data.source === "birdnet" && data.raw_detections && data.raw_detections.length > 1) {
    const list = document.getElementById("other-detections-list");
    list.innerHTML = "";
    data.raw_detections.slice(1).forEach(det => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${det.common_name} <em style="font-size:0.78rem;color:var(--text-muted)">${det.scientific_name}</em></span>
        <span class="det-conf">${Math.round(det.confidence * 100)}%</span>`;
      list.appendChild(li);
    });
    extras.hidden = false;
  } else {
    extras.hidden = true;
  }

  document.getElementById("results").hidden = false;
  initSavePrompt();
}

function parseErrorMessage(status, detail) {
  if (status === 503) return t("err_no_key");
  if (status === 404) return state.tab === "audio" ? t("err_no_bird_audio") : t("err_unknown");
  if (detail) {
    if (detail.includes("不支援") || detail.includes("Unsupported")) return t("err_unsupported");
    if (detail.includes("過大") || detail.includes("large")) return t("err_file_too_large");
    if (detail.includes("未偵測到可辨識的鳥類") || detail.includes("No bird detected")) return t("err_no_bird_image");
    if (detail.includes("未偵測到鳥類鳴叫聲") || detail.includes("No bird vocalizations")) return t("err_no_bird_audio");
    return detail;
  }
  return t("err_unknown");
}

async function submitFile(endpoint, file) {
  setLoading(true);
  const form = new FormData();
  form.append("file", file);
  if (state.model) form.append("model", state.model);
  try {
    const res = await fetch(endpoint, { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    document.getElementById(`panel-${state.tab}`).style.display = "";
    if (!res.ok) showError(parseErrorMessage(res.status, data.detail || ""));
    else renderResult(data);
  } catch {
    setLoading(false);
    document.getElementById(`panel-${state.tab}`).style.display = "";
    showError(t("err_server"));
  }
}

// ── Save Prompt ───────────────────────────────────────
function initSavePrompt() {
  state.saveUseTodayDate = true;
  state.saveGpsLat = null;
  state.saveGpsLon = null;

  // 重置 UI
  document.getElementById("save-date-today").classList.add("active");
  document.getElementById("save-date-other").classList.remove("active");
  document.getElementById("save-custom-date").hidden = true;
  document.getElementById("save-notes").value = "";
  document.getElementById("save-gps-hint").hidden = true;

  // 展開
  document.getElementById("save-prompt").classList.add("open");

  // 嘗試取得 GPS
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        state.saveGpsLat = pos.coords.latitude;
        state.saveGpsLon = pos.coords.longitude;
        const hint = document.getElementById("save-gps-hint");
        hint.textContent = t("save_gps_hint");
        hint.hidden = false;
      },
      () => {},
      { timeout: 8000 }
    );
  }
}

function closeSavePrompt() {
  document.getElementById("save-prompt").classList.remove("open");
  state.saveGpsLat = null;
  state.saveGpsLon = null;
}

async function saveRecord() {
  const sightedAt = state.saveUseTodayDate
    ? new Date().toLocaleDateString("en-CA")
    : document.getElementById("save-custom-date").value;

  if (!sightedAt) return;

  const r = state.lastResult;
  const form = new FormData();
  form.append("zh_name", r.zh_name || "");
  form.append("en_name", r.en_name || "");
  form.append("scientific", r.scientific || "");
  form.append("confidence", r.confidence ?? 0);
  form.append("source", r.source || "");
  form.append("habitat_zh", r.habitat?.zh || "");
  form.append("habitat_en", r.habitat?.en || "");
  form.append("dist_zh", r.distribution?.zh || "");
  form.append("dist_en", r.distribution?.en || "");
  form.append("sighted_at", sightedAt);
  form.append("notes", document.getElementById("save-notes").value.trim());
  if (state.saveGpsLat !== null) form.append("lat", state.saveGpsLat);
  if (state.saveGpsLon !== null) form.append("lon", state.saveGpsLon);
  if (state.tab === "image" && state.imageFile) form.append("image", state.imageFile);

  try {
    const res = await fetch("/api/records", { method: "POST", body: form });
    if (res.ok) {
      const data = await res.json();
      state.lastSavedId = data.id;
      closeSavePrompt();
      showSaveFeedback();
    }
  } catch { /* silent */ }
}

function showSaveFeedback() {
  const banner = document.createElement("div");
  banner.className = "save-success-banner";
  banner.textContent = t("save_success");
  const results = document.getElementById("results");
  results.appendChild(banner);
  setTimeout(() => banner.remove(), 2000);
}

// ── Records Tab ──────────────────────────────────────
function initRecordsPanel() {
  let debounceTimer;
  document.getElementById("records-search").addEventListener("input", e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.recordsQuery = e.target.value.trim();
      loadRecords(true);
    }, 300);
  });
  document.getElementById("records-date-from").addEventListener("change", e => {
    state.recordsDateFrom = e.target.value;
    loadRecords(true);
  });
  document.getElementById("records-date-to").addEventListener("change", e => {
    state.recordsDateTo = e.target.value;
    loadRecords(true);
  });
  document.getElementById("records-load-more").addEventListener("click", () => loadRecords(false));
}

async function loadRecords(reset) {
  if (reset) {
    state.recordsOffset = 0;
    document.getElementById("records-list").innerHTML = "";
  }

  const params = new URLSearchParams({
    limit: RECORDS_PAGE,
    offset: state.recordsOffset,
  });
  if (state.recordsQuery)   params.set("q", state.recordsQuery);
  if (state.recordsDateFrom) params.set("date_from", state.recordsDateFrom);
  if (state.recordsDateTo)   params.set("date_to",   state.recordsDateTo);

  try {
    const res = await fetch(`/api/records?${params}`);
    if (!res.ok) return;
    const data = await res.json();
    state.recordsTotal = data.total;

    const list = document.getElementById("records-list");
    data.items.forEach(item => list.appendChild(renderRecordCard(item)));

    state.recordsOffset += data.items.length;

    const empty = document.getElementById("records-empty");
    empty.hidden = state.recordsTotal > 0;

    const loadMore = document.getElementById("records-load-more");
    loadMore.hidden = state.recordsOffset >= state.recordsTotal;
  } catch { /* silent */ }
}

function renderRecordCard(item) {
  const card = document.createElement("div");
  card.className = "record-card";
  card.dataset.id = item.id;

  // 縮圖
  let thumbEl;
  if (item.thumbnail) {
    thumbEl = document.createElement("img");
    thumbEl.className = "record-thumb";
    thumbEl.src = item.thumbnail;
    thumbEl.alt = item.zh_name;
  } else {
    thumbEl = document.createElement("div");
    thumbEl.className = "record-thumb-placeholder";
    thumbEl.textContent = "🐦";
  }

  // 日期
  const dateStr = formatRecordDate(item.sighted_at);

  // 名稱區
  const body = document.createElement("div");
  body.className = "record-body";
  body.innerHTML = `
    <div class="record-names">
      <span class="r-zh">${item.zh_name}</span>
      <span class="r-en">${item.en_name}</span>
    </div>
    <div class="r-sci">${item.scientific}</div>
    ${item.notes ? `<div class="r-notes">📝 ${item.notes}</div>` : ""}
  `;

  // 右側 meta
  const meta = document.createElement("div");
  meta.className = "record-meta";
  meta.innerHTML = `
    <span class="record-date">${dateStr}</span>
    <span class="record-conf">${Math.round(item.confidence * 100)}%</span>
  `;

  // 刪除按鈕
  const delBtn = document.createElement("button");
  delBtn.className = "record-delete-btn";
  delBtn.title = t("records_del_yes");
  delBtn.textContent = "🗑";
  delBtn.addEventListener("click", () => deleteRecord(item.id, card, delBtn));

  card.append(thumbEl, body, meta, delBtn);
  return card;
}

function formatRecordDate(dateStr) {
  try {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString(state.lang === "zh" ? "zh-TW" : "en-US",
      { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

function deleteRecord(id, cardEl, delBtn) {
  // 第一次點擊：顯示內聯確認
  if (!cardEl.querySelector(".record-delete-confirm")) {
    delBtn.hidden = true;
    const confirm = document.createElement("div");
    confirm.className = "record-delete-confirm";
    confirm.innerHTML = `
      <button class="del-yes">${t("records_del_yes")}</button>
      <button class="del-no">${t("records_del_no")}</button>
    `;
    confirm.querySelector(".del-yes").addEventListener("click", async () => {
      try {
        await fetch(`/api/records/${id}`, { method: "DELETE" });
      } catch { /* silent */ }
      cardEl.classList.add("removing");
      setTimeout(() => {
        cardEl.remove();
        state.recordsTotal--;
        state.recordsOffset = Math.max(0, state.recordsOffset - 1);
        document.getElementById("records-empty").hidden = state.recordsTotal > 0;
      }, 260);
    });
    confirm.querySelector(".del-no").addEventListener("click", () => {
      confirm.remove();
      delBtn.hidden = false;
    });
    cardEl.appendChild(confirm);
  }
}

// ── Image Panel ──────────────────────────────────────
function initImagePanel() {
  const drop = document.getElementById("image-drop");
  const input = document.getElementById("image-input");
  const preview = document.getElementById("image-preview");
  const placeholder = document.getElementById("image-placeholder");
  const submit = document.getElementById("image-submit");

  const RAW_EXTS = new Set(["cr2","cr3","nef","arw","orf","rw2","dng","raf","pef","srw","x3f","raw"]);
  function setImageFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!file.type.startsWith("image/") && !RAW_EXTS.has(ext)) return;
    state.imageFile = file;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    placeholder.hidden = true;
    submit.disabled = false;
    hideError();
  }

  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") input.click(); });
  input.addEventListener("change", () => { if (input.files[0]) setImageFile(input.files[0]); });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) setImageFile(e.dataTransfer.files[0]);
  });
  submit.addEventListener("click", () => {
    if (state.imageFile) submitFile("/api/identify/image", state.imageFile);
  });
}

// ── Audio Panel ──────────────────────────────────────
function initAudioPanel() {
  const drop = document.getElementById("audio-drop");
  const input = document.getElementById("audio-input");
  const placeholder = document.getElementById("audio-placeholder");
  const selected = document.getElementById("audio-selected");
  const filename = document.getElementById("audio-filename");
  const submit = document.getElementById("audio-submit");

  const allowed = new Set(["audio/mpeg", "audio/wav", "audio/ogg", "audio/flac",
    "audio/x-flac", "audio/mp4", "audio/x-m4a"]);

  function setAudioFile(file) {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowed.has(file.type) && !["mp3","wav","ogg","flac","m4a"].includes(ext)) return;
    state.audioFile = file;
    filename.textContent = file.name;
    placeholder.hidden = true;
    selected.hidden = false;
    submit.disabled = false;
    hideError();
  }

  drop.addEventListener("click", () => input.click());
  drop.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") input.click(); });
  input.addEventListener("change", () => { if (input.files[0]) setAudioFile(input.files[0]); });
  drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("drag-over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
  drop.addEventListener("drop", e => {
    e.preventDefault();
    drop.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) setAudioFile(e.dataTransfer.files[0]);
  });
  submit.addEventListener("click", () => {
    if (state.audioFile) submitFile("/api/identify/audio", state.audioFile);
  });
}

// ── Wikipedia ────────────────────────────────────────
async function fetchWikiSummary(enName) {
  try {
    const title = encodeURIComponent(enName.replace(/ /g, "_"));
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    return {
      thumbnail: d.thumbnail?.source || null,
      extract: d.extract || "",
      url: d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${title}`,
    };
  } catch {
    return null;
  }
}

// ── Correction Panel ─────────────────────────────────
function closeCorrectPanel() {
  document.getElementById("correct-panel").classList.remove("open");
  document.getElementById("correct-grid").innerHTML = "";
  document.getElementById("correct-confirm-bar").hidden = true;
  state.correctSelectedSpecies = null;
}

function initCorrectionButtons() {
  document.getElementById("correct-btn").addEventListener("click", () => openCorrectPanel());
  document.getElementById("correct-close-btn").addEventListener("click", closeCorrectPanel);
  document.getElementById("correct-confirm-btn").addEventListener("click", confirmCorrection);
}

async function openCorrectPanel(recordId = null) {
  const r = state.lastResult;
  if (!r) return;

  const panel = document.getElementById("correct-panel");
  const grid = document.getElementById("correct-grid");
  const loading = document.getElementById("correct-loading");
  const confirmBar = document.getElementById("correct-confirm-bar");

  // 重置狀態
  grid.innerHTML = "";
  confirmBar.hidden = true;
  state.correctSelectedSpecies = null;

  // 顯示目前辨識
  document.getElementById("correct-current-species").textContent =
    `${t("correct_current")}${r.zh_name} · ${r.en_name} (${r.scientific})`;

  panel.classList.add("open");
  loading.hidden = false;

  // 向後端取得相似物種
  const form = new FormData();
  form.append("scientific", r.scientific);
  form.append("zh_name", r.zh_name);
  form.append("en_name", r.en_name);
  if (state.model) form.append("model", state.model);
  if (state.tab === "image" && state.imageFile) form.append("image", state.imageFile);

  let alternatives = [];
  try {
    const res = await fetch("/api/identify/alternatives", { method: "POST", body: form });
    if (res.ok) alternatives = await res.json();
  } catch { /* 繼續顯示空結果 */ }

  loading.hidden = true;

  if (alternatives.length === 0) {
    grid.innerHTML = `<p style="color:var(--text-muted);font-size:0.85rem;padding:0.5rem 0">無法取得相似物種，請稍後再試。</p>`;
    return;
  }

  // 平行取得 Wikipedia 資料並渲染
  const wikiResults = await Promise.all(alternatives.map(a => fetchWikiSummary(a.en_name)));
  alternatives.forEach((alt, i) => {
    const card = renderAltCard(alt, wikiResults[i]);
    grid.appendChild(card);
  });
}

function renderAltCard(species, wiki) {
  const card = document.createElement("div");
  card.className = "alt-card";

  // 圖片（Wikipedia 或佔位）
  let imgEl;
  if (wiki?.thumbnail) {
    imgEl = document.createElement("img");
    imgEl.className = "alt-card-img";
    imgEl.src = wiki.thumbnail;
    imgEl.alt = species.en_name;
    imgEl.loading = "lazy";
  } else {
    imgEl = document.createElement("div");
    imgEl.className = "alt-card-img-placeholder";
    imgEl.textContent = "🐦";
  }

  // Wikipedia 連結
  const wikiLink = wiki?.url
    ? `<a class="alt-card-wiki-link" href="${wiki.url}" target="_blank" rel="noopener">↗ ${t("correct_wiki")}</a>`
    : "";

  const body = document.createElement("div");
  body.className = "alt-card-body";
  body.innerHTML = `
    <div class="alt-card-zh">${species.zh_name}</div>
    <div class="alt-card-en">${species.en_name}</div>
    <div class="alt-card-sci">${species.scientific}</div>
    <div class="alt-card-reason">${species.reason}</div>
    ${wikiLink}
  `;

  card.append(imgEl, body);
  card.addEventListener("click", () => selectAltCard(card, species));
  return card;
}

function selectAltCard(card, species) {
  document.querySelectorAll(".alt-card").forEach(c => c.classList.remove("selected"));
  card.classList.add("selected");
  state.correctSelectedSpecies = species;

  const bar = document.getElementById("correct-confirm-bar");
  document.getElementById("correct-selected-name").textContent =
    `${species.zh_name} · ${species.en_name}`;
  bar.hidden = false;
}

async function confirmCorrection() {
  const s = state.correctSelectedSpecies;
  if (!s) return;

  const original = state.lastResult;

  // 更新畫面上的辨識結果
  state.lastResult = {
    ...original,
    zh_name: s.zh_name,
    en_name: s.en_name,
    scientific: s.scientific,
  };
  renderResult(state.lastResult);

  // 顯示更正標記
  const namesEl = document.querySelector(".species-names");
  const existingBadge = namesEl.querySelector(".corrected-badge");
  if (!existingBadge) {
    const badge = document.createElement("div");
    badge.className = "corrected-badge";
    badge.innerHTML = `✏️ ${t("correct_done")}${original.zh_name}`;
    namesEl.appendChild(badge);
  }

  // 若已儲存至記錄，同步更新
  if (state.lastSavedId) {
    try {
      await fetch(`/api/records/${state.lastSavedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zh_name: s.zh_name,
          en_name: s.en_name,
          scientific: s.scientific,
          corrected_from: original.scientific,
        }),
      });
    } catch { /* silent */ }
  }

  closeCorrectPanel();
}

// ── Batch Panel ──────────────────────────────────────
const batchState = {
  jobId: null,
  pollingTimer: null,
  log: [],
  filter: "all",
};

function initBatchPanel() {
  document.getElementById("batch-src-verify").addEventListener("click", verifyBatchSrc);
  document.getElementById("batch-blur").addEventListener("input", e => {
    document.getElementById("blur-display").textContent = e.target.value;
  });
  document.getElementById("batch-focus").addEventListener("input", e => {
    document.getElementById("focus-display").textContent = e.target.value;
  });
  document.getElementById("batch-center").addEventListener("input", e => {
    document.getElementById("center-display").textContent = e.target.value + "%";
  });
  // AI 主題判斷開關
  document.getElementById("batch-theme-enabled").addEventListener("change", e => {
    const on = e.target.checked;
    const input = document.getElementById("batch-theme");
    const warn  = document.querySelector(".batch-ai-warning");
    const hint  = document.getElementById("batch-theme-off-hint");
    input.disabled = !on;
    input.classList.toggle("batch-theme-disabled", !on);
    warn.hidden  = !on;
    hint.hidden  = on;
  });

  document.getElementById("batch-start-btn").addEventListener("click", startBatch);
  document.getElementById("batch-cancel-btn").addEventListener("click", cancelBatch);
  document.querySelectorAll(".batch-ftab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".batch-ftab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      batchState.filter = btn.dataset.filter;
      renderBatchLog();
    });
  });
  document.getElementById("batch-export-btn").addEventListener("click", exportBatchCSV);
}

async function verifyBatchSrc() {
  const path = document.getElementById("batch-src").value.trim();
  const hint = document.getElementById("batch-src-hint");
  if (!path) { hint.textContent = ""; return; }
  try {
    const res = await fetch(`/api/batch/validate?path=${encodeURIComponent(path)}`);
    if (res.ok) {
      const d = await res.json();
      hint.textContent = `✅ 找到 ${d.image_count} 張圖片`;
      hint.className = "batch-hint success";
    } else {
      hint.textContent = "❌ 資料夾不存在";
      hint.className = "batch-hint error";
    }
  } catch {
    hint.textContent = "❌ 連線失敗";
    hint.className = "batch-hint error";
  }
}

async function startBatch() {
  const src = document.getElementById("batch-src").value.trim();
  const dst = document.getElementById("batch-dst").value.trim();
  if (!src || !dst) {
    alert("請填寫來源與目的資料夾");
    return;
  }
  const aiEnabled  = document.getElementById("batch-theme-enabled").checked;
  const theme      = aiEnabled ? document.getElementById("batch-theme").value.trim() : "";
  const blurThr    = parseFloat(document.getElementById("batch-blur").value);
  const focusThr   = parseFloat(document.getElementById("batch-focus").value);
  const centerRatio = parseFloat(document.getElementById("batch-center").value);
  const action     = document.querySelector('input[name="batch-action"]:checked').value;

  try {
    const res = await fetch("/api/batch/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_dir: src, dest_dir: dst, theme,
        blur_threshold: blurThr, focus_threshold: focusThr,
        center_ratio: centerRatio, action, model: state.model,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      alert(d.detail || "啟動失敗");
      return;
    }
    const d = await res.json();
    batchState.jobId = d.job_id;
    batchState.log   = [];

    document.getElementById("batch-start-btn").disabled = true;
    document.getElementById("batch-cancel-btn").hidden  = false;
    document.getElementById("batch-progress-section").hidden = false;
    document.getElementById("batch-result-section").hidden   = true;
    document.getElementById("batch-progress-bar").style.width = "0%";
    document.getElementById("batch-progress-label").textContent = "正在準備…";

    batchState.pollingTimer = setInterval(pollBatch, 2000);
    pollBatch();
  } catch {
    alert("連線失敗，請確認伺服器正在運行");
  }
}

async function pollBatch() {
  const { jobId } = batchState;
  if (!jobId) return;
  try {
    const res = await fetch(`/api/batch/${jobId}/status`);
    if (!res.ok) return;
    const d = await res.json();

    const pct = d.total > 0 ? Math.round((d.processed / d.total) * 100) : 0;
    document.getElementById("batch-progress-bar").style.width = `${pct}%`;
    const fileHint = d.current_file ? ` — AI 判斷中: ${d.current_file}` : "";
    document.getElementById("batch-progress-label").textContent =
      `已處理 ${d.processed} / ${d.total} 張（通過 ${d.passed} 張）${fileHint}`;

    if (["done", "cancelled", "error"].includes(d.status)) {
      clearInterval(batchState.pollingTimer);
      batchState.pollingTimer = null;
      document.getElementById("batch-start-btn").disabled = false;
      document.getElementById("batch-cancel-btn").hidden  = true;

      const rRes = await fetch(`/api/batch/${jobId}/result`);
      if (rRes.ok) {
        const result = await rRes.json();
        batchState.log = result.log || [];
        showBatchResult(result);
      }
    }
  } catch { /* silent */ }
}

async function cancelBatch() {
  const { jobId } = batchState;
  if (!jobId) return;
  await fetch(`/api/batch/${jobId}/cancel`, { method: "POST" }).catch(() => {});
}

function showBatchResult(result) {
  const failed = result.total - result.passed;
  document.getElementById("bs-total").textContent = result.total;
  document.getElementById("bs-pass").textContent  = result.passed;
  document.getElementById("bs-fail").textContent  = failed;
  document.getElementById("batch-result-section").hidden = false;
  batchState.filter = "all";
  document.querySelectorAll(".batch-ftab").forEach(b => b.classList.remove("active"));
  document.querySelector('.batch-ftab[data-filter="all"]').classList.add("active");
  renderBatchLog();
}

function renderBatchLog() {
  const list = document.getElementById("batch-log-list");
  list.innerHTML = "";
  const filtered = batchState.log.filter(e => {
    if (batchState.filter === "pass") return e.passed;
    if (batchState.filter === "fail") return !e.passed;
    return true;
  });
  filtered.forEach(e => list.appendChild(buildBatchLogRow(e)));
}

function buildBatchLogRow(entry) {
  const row = document.createElement("div");
  row.className = `batch-log-row ${entry.passed ? "pass" : "fail"}`;

  const thumb = document.createElement("div");
  thumb.className = "batch-log-thumb";
  if (entry.thumbnail) {
    const img = document.createElement("img");
    img.src = entry.thumbnail;
    img.alt = entry.filename;
    thumb.appendChild(img);
  } else {
    thumb.textContent = "🖼";
  }

  const body = document.createElement("div");
  body.className = "batch-log-body";
  const scores = [];
  if (entry.blur_score  !== null) scores.push(`模糊: ${entry.blur_score}`);
  if (entry.focus_score !== null) scores.push(`對焦: ${entry.focus_score}`);
  if (entry.theme_match !== null) scores.push(entry.theme_match ? "主題: ✓" : "主題: ✗");
  body.innerHTML = `
    <span class="batch-log-name">${entry.filename}</span>
    <span class="batch-log-scores">${scores.join(" · ") || "—"}</span>
  `;

  const status = document.createElement("div");
  status.className = "batch-log-status";
  if (entry.passed) {
    status.innerHTML = '<span class="batch-log-badge pass">✅ 通過</span>';
  } else {
    const reason = entry.reject_reason || "拒絕";
    status.innerHTML = `<span class="batch-log-badge fail">❌ ${reason}</span>`;
  }

  row.append(thumb, body, status);
  return row;
}

function exportBatchCSV() {
  const rows = [["檔名", "模糊分數", "對焦分數", "主題符合", "結果", "拒絕原因"]];
  batchState.log.forEach(e => {
    rows.push([
      e.filename,
      e.blur_score  ?? "",
      e.focus_score ?? "",
      e.theme_match === null ? "" : (e.theme_match ? "是" : "否"),
      e.passed ? "通過" : "拒絕",
      e.reject_reason ?? "",
    ]);
  });
  const csv = rows.map(r =>
    r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")
  ).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `batch_result_${new Date().toLocaleDateString("en-CA")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Model Selector ───────────────────────────────────
async function loadModels() {
  const sel = document.getElementById("model-select");
  try {
    const res = await fetch("/api/models");
    if (!res.ok) throw new Error();
    const data = await res.json();
    const models = data.models || [];
    if (models.length === 0) throw new Error();

    sel.innerHTML = "";
    models.forEach(id => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = id.includes("/") ? id.split("/").pop() : id;
      opt.title = id;
      sel.appendChild(opt);
    });

    const saved = localStorage.getItem("selectedModel");
    if (saved && models.includes(saved)) sel.value = saved;
    state.model = sel.value;
    updateFooterModel(state.model);

    sel.addEventListener("change", () => {
      state.model = sel.value;
      localStorage.setItem("selectedModel", sel.value);
      updateFooterModel(state.model);
    });
  } catch {
    sel.innerHTML = '<option value="">（無法載入模型列表）</option>';
  }
}

function updateFooterModel(modelId) {
  const el = document.getElementById("footer-model");
  if (!el) return;
  const label = modelId
    ? (modelId.includes("/") ? modelId.split("/").pop() : modelId)
    : "Vision AI";
  el.textContent = label;
}

// ── Reset ────────────────────────────────────────────
function initReset() {
  document.getElementById("reset-btn").addEventListener("click", () => {
    state.imageFile = null;
    state.audioFile = null;

    const preview = document.getElementById("image-preview");
    preview.hidden = true;
    preview.src = "";
    document.getElementById("image-placeholder").hidden = false;
    document.getElementById("image-submit").disabled = true;

    document.getElementById("audio-selected").hidden = true;
    document.getElementById("audio-placeholder").hidden = false;
    document.getElementById("audio-submit").disabled = false;

    hideResults();
    hideError();
  });
}

// ── Save Prompt Buttons ──────────────────────────────
function initSavePromptButtons() {
  document.getElementById("save-date-today").addEventListener("click", () => {
    state.saveUseTodayDate = true;
    document.getElementById("save-date-today").classList.add("active");
    document.getElementById("save-date-other").classList.remove("active");
    document.getElementById("save-custom-date").hidden = true;
  });
  document.getElementById("save-date-other").addEventListener("click", () => {
    state.saveUseTodayDate = false;
    document.getElementById("save-date-other").classList.add("active");
    document.getElementById("save-date-today").classList.remove("active");
    const picker = document.getElementById("save-custom-date");
    picker.value = new Date().toLocaleDateString("en-CA");
    picker.hidden = false;
  });
  document.getElementById("save-confirm-btn").addEventListener("click", saveRecord);
  document.getElementById("save-cancel-btn").addEventListener("click", closeSavePrompt);
}

// ── Init ─────────────────────────────────────────────
function init() {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("lang-toggle").addEventListener("click", () => {
    state.lang = state.lang === "zh" ? "en" : "zh";
    updateI18n();
  });

  initImagePanel();
  initAudioPanel();
  initReset();
  initSavePromptButtons();
  initRecordsPanel();
  initCorrectionButtons();
  initBatchPanel();
  updateI18n();
  loadModels();
}

document.addEventListener("DOMContentLoaded", init);
