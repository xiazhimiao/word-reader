"""Word Reader 本地服务。

- 托管静态文件（index.html / css / js / csv）
- 提供 /tts 接口：用 edge-tts（微软神经语音）把任意文本合成 mp3 返回

用法（需能上外网）：
    python server.py
然后手机/电脑访问  http://<电脑IP>:8000
"""

import asyncio
import io
import json
import mimetypes
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import edge_tts

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8000
DEFAULT_VOICE = "en-US-AriaNeural"  # 女声，清晰自然
CACHE_SIZE = 400

# 语音缓存（内存）：key -> (bytes, ts)
_audio_cache = {}
_cache_order = []


def synthesize(text, voice, rate):
    """生成 mp3 字节。返回 (status, bytes, error)。"""
    key = (text, voice, rate)
    if key in _audio_cache:
        return 200, _audio_cache[key][0], None

    async def _run():
        buf = io.BytesIO()
        com = edge_tts.Communicate(text, voice, rate=rate)
        async for chunk in com.stream():
            if chunk["type"] == "audio":
                buf.write(chunk["data"])
        return buf.getvalue()

    try:
        try:
            data = asyncio.run(_run())
        except RuntimeError:
            # 已运行在事件循环中的线程
            loop = asyncio.new_event_loop()
            try:
                data = loop.run_until_complete(_run())
            finally:
                loop.close()
    except Exception as e:  # noqa: BLE001
        return 500, None, str(e)

    if not data:
        return 502, None, "edge-tts 未返回音频（可能无法联网）"

    # 写入缓存
    _audio_cache[key] = (data, time.time())
    _cache_order.append(key)
    if len(_audio_cache) > CACHE_SIZE:
        oldest = _cache_order.pop(0)
        _audio_cache.pop(oldest, None)

    return 200, data, None


def rate_to_edge(rate):
    """0.5~1.5 转成 edge-tts 的 +40% / -20% 格式。"""
    try:
        r = float(rate)
    except (TypeError, ValueError):
        r = 1.0
    pct = int((r - 1.0) * 100)
    return ("+" if pct >= 0 else "-") + str(abs(pct)) + "%"


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/octet-stream"):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/tts":
            self.handle_tts(parsed)
        else:
            self.handle_static(path)

    def handle_tts(self, parsed):
        q = parse_qs(parsed.query)
        text = (q.get("text") or [""])[0]
        voice = (q.get("voice") or [DEFAULT_VOICE])[0]
        rate = rate_to_edge((q.get("rate") or ["1"])[0])
        if not text:
            self._send(400, b"missing text", "text/plain; charset=utf-8")
            return
        code, data, err = synthesize(text, voice, rate)
        if code != 200:
            body = json.dumps({"error": err}).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(body)
            return
        self._send(200, data, "audio/mpeg")

    def handle_static(self, path):
        if path in ("/", ""):
            path = "/index.html"
        # 防目录穿越
        filepath = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not filepath.startswith(ROOT):
            self._send(403, b"forbidden", "text/plain; charset=utf-8")
            return
        if os.path.isdir(filepath):
            filepath = os.path.join(filepath, "index.html")
        if not os.path.isfile(filepath):
            self._send(404, b"not found", "text/plain; charset=utf-8")
            return
        ctype, _ = mimetypes.guess_type(filepath)
        if ctype is None:
            ctype = "application/octet-stream"
        if filepath.endswith(".js"):
            ctype = "application/javascript"
        elif filepath.endswith(".css"):
            ctype = "text/css"
        elif filepath.endswith(".csv"):
            ctype = "text/csv; charset=utf-8"
        with open(filepath, "rb") as f:
            self._send(200, f.read(), ctype)

    def log_message(self, fmt, *args):
        # pythonw 无控制台时 sys.stdout 为 None，直接写会抛异常导致连接被关闭
        out = sys.stdout
        if out is None:
            return
        try:
            out.write("%s %s\n" % (time.strftime("%H:%M:%S"), fmt % args))
        except Exception:  # noqa: BLE001
            pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("Word Reader 已启动: http://0.0.0.0:%d" % PORT)
    print("语音: edge-tts (%s)，需电脑能联网。" % DEFAULT_VOICE)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")
