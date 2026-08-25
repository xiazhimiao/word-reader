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

  function cacheKey(id) {
    return "wordreader_" + id + "_v3";
  }

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
    let cached = null;
    try {
      cached = localStorage.getItem(cacheKey(file));
    } catch (e) {}
    if (cached) {
      const arr = JSON.parse(cached);
      if (Array.isArray(arr) && arr.length) return arr;
    }
    const res = await fetch("./" + file);
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

  // 句子卡片：句子 + 单词块 + 单词释义
  function renderSentenceCard(c) {
    const tokens = c.term.split(/\s+/).filter(Boolean);
    const words = tokens.map((tok) => {
      const clean = tok.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, "");
      return { disp: tok, clean, lower: clean.toLowerCase(), gloss: GLOSS[clean.toLowerCase()] || "" };
    });

    let chunk = "", prevCls = "", chunks = "";
    // 保持换行语义（原文以 "," /"." 分隔，这里按整句排）
    chunks = words.map((w) => {
      const cls = w.gloss ? "s-word" : "s-word no-gloss";
      return "<span class='" + cls + "' data-i='" + words.indexOf(w) + "'>" + esc(w.disp) + "</span>";
    }).join(" ");

    const translationHtml = c.meaning
      ? "<div class='sent-tr'>" + esc(c.meaning) + "</div>"
      : "";

    $("#card").innerHTML =
      "<div class='card-flag'>句子</div>" +
      "<div class='s-words' style='display:flex;flex-wrap:wrap;gap:8px;justify-content:center'>" + chunks + "</div>" +
      "<div class='s-worth'></div>" +
      translationHtml;

    // 默认高亮第一个词并显示释义
    highlightWord(0, true);
  }

  function highlightWord(i, speakIt) {
    const box = $("#card");
    const ws = Array.from(box.querySelectorAll(".s-word"));
    const c = cards[idx];
    const tokens = c.term.split(/\s+/).filter(Boolean);
    const wIdx = i;
    ws.forEach((el, j) => el.classList.toggle("is-active", j === wIdx));

    const tok = tokens[wIdx];
    const clean = tok.replace(/^[^a-zA-Z']+|[^a-zA-Z']+$/g, "");
    const gloss = GLOSS[clean.toLowerCase()] || "(暂无释义，点击可单独朗读)";

    const worth = box.querySelector(".s-worth");
    if (worth) {
      worth.innerHTML = "<span class='w'>" + esc(tok) + "</span><span class='m'>" + esc(gloss) + "</span>";
    }
    if (speakIt) speakText(clean);
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
    const el = $("#ttsWarn");
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  // ---------- 工具 ----------
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function $$(s) { return Array.from(document.querySelectorAll(s)); }

  document.addEventListener("DOMContentLoaded", init);
})();
