"use strict";

/** 学习器：单元 → 单词/句子两种卡片。 */

(function () {
  // 单元清单：wordFile=单词表，sentFile=句子表。新增单元在此加一行。
  const UNITS = [
    { id: "unit1", name: "Unit 1", sub: "第一单元", wordFile: "unit1.csv", sentFile: "unit1-sentences.csv" },
    { id: "unit2", name: "Unit 2", sub: "第二单元", wordFile: "unit2.csv", sentFile: null }
  ];

  // 句子中常用单词的释义（查词用）。键为小写词条。
  const GLOSS = {
    my: "我的", best: "最好的", friend: "朋友", is: "是", clever: "聪明的",
    let: "让", me: "我（宾格）", say: "说", it: "它", aloud: "大声地",
    i: "我", think: "认为", "he's": "他是", different: "不一样的",
    there: "那里", no: "没有", doubt: "疑问", he: "他",
    plays: "演奏（play 的第三人称）", the: "（定冠词）", pipa: "琵琶",
    very: "非常", loud: "大声的", so: "如此/那么", yes: "是的",
    good: "好的", lovely: "可爱的", "she's": "她是", she: "她",
    helps: "帮助（help 的第三人称）", many: "许多", people: "人们",
    "i'm": "我是", proud: "自豪的", can:"能/会", see:"看见", again:"再一次"
  };

  let currentUnit = null;
  let mode = "word"; // word | sentence
  let cards = [];
  let idx = 0;
  let rate = 1;

  const $ = (s) => document.querySelector(s);

  function loadPrefs() {
    try {
      const r = parseFloat(localStorage.getItem("wordreader_rate"));
      if (r && r >= 0.4 && r <= 1.6) rate = r;
    } catch (e) {}
  }
  function savePrefs() {
    try {
      localStorage.setItem("wordreader_rate", String(rate));
    } catch (e) {}
  }

  async function loadDeck(file) {
    // 始终从服务器拉取最新 CSV，避免旧 localStorage 缓存污染（导致释义错乱）
    const res = await fetch("./" + file, { cache: "no-store" });
    if (!res.ok) throw new Error("加载 " + file + " 失败 (" + res.status + ")");
    const text = await res.text();
    return Store.parseCSV(text);
  }

  function setMode(nextMode) {
    mode = nextMode;
    $$("#modeSwitch button").forEach((b) => b.classList.toggle("is-active", b.dataset.mode === mode));
    refreshDeck();
  }

  function refreshDeck() {
    const file = mode === "word" ? currentUnit.wordFile : currentUnit.sentFile;
    if (!file) {
      cards = [];
      idx = 0;
      renderCard();
      return;
    }
    loadDeck(file).then((items) => {
      const list = items.map((it) => ({
        term: it.term,
        phonetic: it.phonetic || "",
        meaning: it.meaning || "",
        type: mode
      }));
      cards = list;
      idx = 0;
      renderCard();
    }).catch((err) => alert(err.message));
  }

  // ---------- 单元列表 ----------
  function renderUnitList() {
    const box = $("#unitList");
    box.innerHTML = "";
    UNITS.forEach((u) => {
      const btn = document.createElement("div");
      btn.className = "unit-item";
      btn.innerHTML =
        "<div><div class='u-name'>" + u.name + "</div><div class='u-sub'>" + u.sub + "</div></div>" +
        "<div class='u-arrow'>›</div>";
      btn.addEventListener("click", () => openUnit(u));
      box.appendChild(btn);
    });
  }

  async function openUnit(u) {
    TTS.prime(); // 移动端：在点击瞬间唤醒语音引擎
    currentUnit = u;
    mode = "word";
    $("#home").classList.add("hidden");
    $("#study").classList.remove("hidden");
    refreshDeck();
  }

  function goHome() {
    currentUnit = null;
    cards = [];
    idx = 0;
    $("#study").classList.add("hidden");
    $("#home").classList.remove("hidden");
    renderUnitList();
  }

  // ---------- 卡片 ----------
  function speakText(text) {
    TTS.speak(text, "en-US", rate);
  }

  function renderCard() {
    const box = $("#card");
    if (!cards.length) {
      box.innerHTML = "<div class='done-box'><div class='d-emoji'>📭</div><div class='d-text'>本单元暂无"
        + (mode === "word" ? "单词" : "句子") + "</div></div>";
      $("#listenBtn").classList.add("hidden");
      $("#prevBtn").classList.add("hidden");
      $("#nextBtn").textContent = "回单元列表";
      $("#progress").textContent = "0 / 0";
      return;
    }
    if (idx >= cards.length) {
      $("#progress").textContent = cards.length + " / " + cards.length;
      box.innerHTML =
        "<div class='done-box'><div class='d-emoji'>🎉</div>" +
        "<div class='d-text'>这组" + (mode === "word" ? "单词" : "句子") + "学完啦！</div>" +
        "<div class='d-sub'>共 " + cards.length + " 个</div></div>";
      $("#listenBtn").classList.add("hidden");
      $("#prevBtn").classList.add("hidden");
      $("#nextBtn").textContent = "回单元列表";
      return;
    }

    const c = cards[idx];
    $("#progress").textContent = (idx + 1) + " / " + cards.length;
    $("#listenBtn").classList.remove("hidden");
    $("#prevBtn").classList.toggle("hidden", idx === 0);
    $("#nextBtn").textContent = idx === cards.length - 1 ? "完成 ›" : "下一个 ›";

    if (mode === "word") {
      $("#listenBtn").textContent = "🔊 朗读单词";
      renderWordCard(c);
      speakText(c.term);
    } else {
      $("#listenBtn").textContent = "🔊 整句朗读";
      renderSentenceCard(c);
      speakText(c.term);
    }
  }

  function renderWordCard(c) {
    $("#card").innerHTML =
      "<div class='card-flag'>单词</div>" +
      "<div class='card-term'>" + esc(c.term) + "</div>" +
      "<div class='card-phonetic'>" + esc(c.phonetic) + "</div>" +
      "<div class='card-meaning'>" + esc(c.meaning) + "</div>";
  }

  // 句子卡片：句子 + 单词块 + 单词释义 + 整句翻译（用 DOM API 构建，避免 HTML 转义问题）
  function renderSentenceCard(c) {
    const tokens = splitWords(c.term);
    const card = $("#card");
    card.textContent = "";

    // 类型角标
    const flag = el("div", "card-flag");
    flag.textContent = "句子";
    card.appendChild(flag);

    // 单词块容器
    const wordsBox = el("div", "s-words");
    const chips = [];
    tokens.forEach((w, i) => {
      const chip = el("span", w.gloss ? "s-word" : "s-word no-gloss");
      chip.textContent = w.disp;
      chip.dataset.i = String(i);
      wordsBox.appendChild(chip);
      chips.push(chip);
    });
    card.appendChild(wordsBox);

    // 当前词的释义
    const worth = el("div", "s-worth");
    card.appendChild(worth);

    // 整句翻译
    if (c.meaning) {
      const tr = el("div", "sent-tr");
      tr.textContent = c.meaning;
      card.appendChild(tr);
    }

    highlightWord(0, true);
  }

  function highlightWord(i, speakIt) {
    const card = $("#card");
    const chips = Array.from(card.querySelectorAll(".s-word"));
    const c = cards[idx];
    if (!c) return;
    const tokens = splitWords(c.term);
    const wIdx = Math.max(0, Math.min(i, tokens.length - 1));

    chips.forEach((ch, j) => ch.classList.toggle("is-active", j === wIdx));

    const raw = tokens[wIdx] ? tokens[wIdx].disp : "";
    const gloss = tokens[wIdx] && tokens[wIdx].gloss
      ? tokens[wIdx].gloss
      : "(暂无释义，点击可单独朗读)";

    const worth = card.querySelector(".s-worth");
    if (worth) {
      const wSpan = el("span", "w");
      wSpan.textContent = raw;
      const mSpan = el("span", "m");
      mSpan.textContent = gloss;
      worth.textContent = "";
      worth.appendChild(wSpan);
      worth.appendChild(mSpan);
    }
    if (speakIt && tokens[wIdx]) speakText(tokens[wIdx].clean);
  }

  function next() {
    if (idx < cards.length) idx++;
    if (idx >= cards.length) { goHome(); return; }
    renderCard();
  }

  function prev() {
    if (idx > 0) { idx--; renderCard(); }
  }

  // ---------- 交互 ----------
  function init() {
    loadPrefs();
    renderUnitList();

    // 语速按钮
    const rateBtns = $("#rateBtns");
    Array.from(rateBtns.querySelectorAll("button")).forEach((btn) => {
      if (parseFloat(btn.dataset.rate) === rate) btn.classList.add("is-active");
      btn.addEventListener("click", () => {
        rate = parseFloat(btn.dataset.rate);
        Array.from(rateBtns.querySelectorAll("button")).forEach((b) => b.classList.toggle("is-active", b === btn));
        savePrefs();
        const c = cards[idx];
        if (c) speakText(c.term);
      });
    });

    $("#backBtn").addEventListener("click", () => { TTS.prime(); goHome(); });
    $("#nextBtn").addEventListener("click", () => { TTS.prime(); next(); });
    $("#prevBtn").addEventListener("click", () => { TTS.prime(); prev(); });
    $("#listenBtn").addEventListener("click", () => {
      const c = cards[idx];
      if (!c) return;
      speakText(c.term);
    });

    $$("#modeSwitch button").forEach((b) =>
      b.addEventListener("click", () => { TTS.prime(); setMode(b.dataset.mode); })
    );

    // 卡片点击：单词卡=点词发音；句子卡=点单词块查词/发音，点空白=整句
    $("#card").addEventListener("click", (e) => {
      TTS.prime();
      const chip = e.target.closest(".s-word");
      const c = cards[idx];
      if (!c) return;
      if (chip) {
        const i = parseInt(chip.dataset.i, 10);
        highlightWord(i, true);
        return;
      }
      if (e.target.closest(".done-box") || e.target.closest(".s-words")) return;
      speakText(c.term);
    });

    if (!TTS.supported) {
      showTtsWarn("⚠ 当前浏览器不支持语音合成，请改用 Edge、Chrome 或系统浏览器。");
    }
    if (TTS.isWeChat()) {
      showTtsWarn("⚠ 微信内置浏览器可能无法朗读。请点右上角「···」→「在浏览器打开」后使用。");
    }
  }

  function showTtsWarn(msg) {
    const warnEl = $("#ttsWarn");
    warnEl.textContent = msg;
    warnEl.classList.remove("hidden");
  }

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function el(tag, cls) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }
  // 拆分句子为单词对象：disp=原始显示(去尾部标点)，clean=查词用(全小写去标点)
  function splitWords(sentence) {
    return String(sentence || "").split(/\s+/).filter(Boolean).map((tok) => {
      const disp = tok; // 保留原句标点（如 Yes, / is. / He's），便于对照原句
      const clean = tok.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, "").replace(/[^a-zA-Z']/g, ""); // 查词/朗读用，去标点
      const lower = clean.toLowerCase();
      return { disp, clean, lower, gloss: GLOSS[lower] || "" };
    });
  }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }

  function showVersion() {
    const v = (window.__APP_VER__ || "unknown") + " · " + (window.__DEMO__ || "dev");
    const node = document.getElementById("appVersion");
    if (node) node.textContent = v;
    document.title = "Word Reader " + v;
  }

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("DOMContentLoaded", showVersion);
})();
