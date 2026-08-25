"use strict";

/**
 * 数据存储层：所有数据保存在浏览器 localStorage，不上传网络。
 * 数据模型:
 * {
 *   id: string,
 *   type: 'word' | 'sentence',
 *   term: string,       // 单词 / 句子本体
 *   phonetic: string,   // 音标
 *   meaning: string,    // 释义 / 中文翻译
 *   example: string,    // 例句
 *   exampleTr: string,  // 例句翻译（可选）
 *   createdAt: number,  // 添加时间戳
 *   familiar: boolean   // 是否熟悉（卡片记忆标记）
 * }
 */

const Store = (function () {
  const KEY = "wordreader_data_v1";
  const STATS_KEY = "wordreader_stats_v1";

  function defaultData() {
    return { words: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultData();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.words)) return defaultData();
      return parsed;
    } catch (e) {
      return defaultData();
    }
  }

  function save(data) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {
      alert("保存失败：浏览器存储已满或不可用。");
    }
  }

  function uid() {
    return "id_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function normalize(item) {
    return {
      id: item.id || uid(),
      type: item.type === "sentence" ? "sentence" : "word",
      term: (item.term || "").trim(),
      phonetic: (item.phonetic || "").trim(),
      meaning: (item.meaning || "").trim(),
      example: (item.example || "").trim(),
      exampleTr: (item.exampleTr || "").trim(),
      createdAt: item.createdAt || Date.now(),
      familiar: !!item.familiar
    };
  }

  function getAll() {
    return load().words;
  }

  function getById(id) {
    return getAll().find((w) => w.id === id) || null;
  }

  /** 增：返回新增的对象 */
  function add(obj) {
    const data = load();
    const item = normalize(Object.assign({}, obj, { id: uid(), createdAt: Date.now() }));
    if (!item.term) return null;
    data.words.unshift(item);
    save(data);
    return item;
  }

  /** 改：返回更新后的对象或 null */
  function update(id, patch) {
    const data = load();
    const idx = data.words.findIndex((w) => w.id === id);
    if (idx < 0) return null;
    data.words[idx] = normalize(Object.assign({}, data.words[idx], patch, { id }));
    save(data);
    return data.words[idx];
  }

  /** 删：返回是否删除成功 */
  function remove(id) {
    const data = load();
    const before = data.words.length;
    data.words = data.words.filter((w) => w.id !== id);
    if (data.words.length === before) return false;
    save(data);
    return true;
  }

  /** 批量导入，返回 { added, skipped } */
  function importMany(items) {
    const data = load();
    const existingKeys = new Set(data.words.map((w) => w.term.toLowerCase()));
    let added = 0, skipped = 0;
    items.forEach((it) => {
      const item = normalize(Object.assign({}, it, { id: uid(), createdAt: Date.now() }));
      if (!item.term) return;
      if (item.type === "word" && existingKeys.has(item.term.toLowerCase())) {
        skipped++;
        return;
      }
      data.words.unshift(item);
      existingKeys.add(item.term.toLowerCase());
      added++;
    });
    save(data);
    return { added, skipped };
  }

  function replaceAll(items) {
    const data = load();
    data.words = items.map((it) => normalize(Object.assign({}, it, { id: uid(), createdAt: Date.now() })));
    save(data);
  }

  function clear() {
    localStorage.removeItem(KEY);
    localStorage.removeItem(STATS_KEY);
  }

  // ---- 统计 ----
  function getStats() {
    try {
      return JSON.parse(localStorage.getItem(STATS_KEY)) || { quizTotal: 0, quizRight: 0 };
    } catch (e) {
      return { quizTotal: 0, quizRight: 0 };
    }
  }
  function recordQuiz(right, total) {
    const s = getStats();
    s.quizTotal += total;
    s.quizRight += right;
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  }
  function resetStats() {
    localStorage.setItem(STATS_KEY, JSON.stringify({ quizTotal: 0, quizRight: 0 }));
  }

  // ---- 时间分类 ----
  function timeBucket(ts) {
    const now = new Date();
    const d = new Date(ts);
    const sameDay = d.toDateString() === now.toDateString();
    const startOfWeek = new Date(now);
    const startDay = (now.getDay() + 6) % 7; // 周一为本周开始
    startOfWeek.setDate(now.getDate() - startDay);
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    if (sameDay) return "today";
    if (d >= startOfWeek) return "week";
    if (d >= startOfMonth) return "month";
    return "older";
  }

  // ---- CSV 解析（支持引号、逗号、换行） ----
  function parseCSV(text) {
    // 去掉 BOM
    text = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
    const rows = [];
    let cur = "", row = [], inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuote) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQuote = false;
        } else cur += ch;
      } else {
        if (ch === '"') inQuote = true;
        else if (ch === ",") { row.push(cur); cur = ""; }
        else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else cur += ch;
      }
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }

    // 识别表头（第一行是否含 word/单词/term/句子 等字段名）
    const items = [];
    let startIdx = 0;
    const first = rows[0] || [];
    const headerNames = [
      "term", "phonetic", "meaning", "example", "exampleTr"
    ].map(() => null);
    const headerOk =
      first.some((c) => /word|单词|term|术语|句|sentence|例句|音标|释义|翻译|mean/i.test(c));

    if (headerOk) {
      startIdx = 1;
      // 根据表头名映射列：把“翻译/释义”识别为 meaning 列
      first.forEach((h, i) => {
        const name = (h || "").trim().toLowerCase();
        if (/term|word|单词|术语|句|sentence|例句/.test(name)) headerNames[0] = i;
        else if (/音标|phonetic|ipa|pron/.test(name)) headerNames[1] = i;
        else if (/释义|meaning|翻译|translation|trans|中文|解释|cn/.test(name)) headerNames[2] = i;
        else if (/例句翻译|示例翻译|exampleTr/.test(name)) headerNames[4] = i;
        else if (/例句|example|示例|例句/.test(name)) headerNames[3] = i;
      });
    }
    const get = (col, n) => (headerNames[n] == null ? "" : (col[headerNames[n]] || "").trim());

    for (let r = startIdx; r < rows.length; r++) {
      const col = rows[r];
      let term = "", phonetic = "", meaning = "", example = "", exampleTr = "";
      if (headerOk) {
        // 用表头映射取各列；term 无匹配则用第一个非空列兜底
        term = get(col, 0);
        phonetic = get(col, 1);
        meaning = get(col, 2);
        example = get(col, 3);
        exampleTr = get(col, 4);
        if (!term) term = (col[0] || "").trim();
      } else {
        term = (col[0] || "").trim();
        phonetic = (col[1] || "").trim();
        meaning = (col[2] || "").trim();
        example = (col[3] || "").trim();
        exampleTr = (col[4] || "").trim();
      }
      if (!term) continue;
      items.push({ term, phonetic, meaning, example, exampleTr });
    }
    return items;
  }

  return {
    getAll, getById, add, update, remove,
    importMany, replaceAll, clear,
    getStats, recordQuiz, resetStats,
    timeBucket, parseCSV
  };
})();
