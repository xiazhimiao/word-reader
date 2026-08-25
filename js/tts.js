"use strict";

/**
 * 朗读模块 —— 优先使用服务器 /tts 接口生成的“真声音频”（edge-tts 微软神经语音）。
 * mp3 由服务端合成，手机端只负责播放，天然解决了微信/系统语音不合拍的兼容问题。
 * 若服务器不可用，则回退到浏览器自带 speechSynthesis。
 */
const TTS = (function () {
  const SUPPORTED_SS = "speechSynthesis" in window;
  let audio = null;

  function ensureAudio() {
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
    }
    return audio;
  }

  /** 播放服务器合成音频；返回 true 表示已交给服务器方案 */
  function playServerAudio(text, rate) {
    try {
      const el = ensureAudio();
      const url =
        "./tts?text=" + encodeURIComponent(text) +
        "&rate=" + encodeURIComponent(String(rate));
      if (el.src.indexOf("text=") !== -1 &&
          decodeURIComponent(el.src).indexOf(text) !== -1) {
        // 同一句：重新从开头播
        el.currentTime = 0;
      }
      el.src = url;
      el.play().catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- 浏览器原生合成（回退） ----------
  async function _speakSS(text, lang, rate) {
    if (!SUPPORTED_SS) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || "en-US";
    u.rate = rate || 1;
    try { window.speechSynthesis.resume(); } catch (e) {}
    window.speechSynthesis.speak(u);
  }

  function speak(text, lang, rate, mode) {
    if (!text) return;
    // 默认用服务器音频（最正宗）；仅当明确要求用系统合成时走 fallback
    const useServer = mode !== "ss";
    if (useServer && playServerAudio(text, rate || 1)) return;
    _speakSS(text, lang, rate);
  }

  function stop() {
    if (audio) {
      try { audio.pause(); } catch (e) {}
    }
    if (SUPPORTED_SS) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
  }

  // 服务器方案不需要手势解锁；保留空实现以兼容调用方
  function prime() {
    try { ensureAudio(); } catch (e) {}
  }

  function isWeChat() {
    return /MicroMessenger/i.test(navigator.userAgent || "");
  }

  return { speak, stop, prime, isWeChat, supported: true };
})();
