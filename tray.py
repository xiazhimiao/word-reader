"""Word Reader 系统托盘启动器。

双击运行后：
  - 自动启动内网 HTTP 服务（同 server.py）
  - 任务栏右下角出现 Word Reader 图标
  - 右键图标：
        · 打开网页        -> 用默认浏览器打开本机页面
        · 复制访问地址     -> 复制 http://IP:8000 到剪贴板
        · 查看本机IP      -> 弹窗显示局域网 IP
        · 重新加载数据     -> 清除浏览器缓存提示（占位）
        · 停止服务         -> 退出程序

用法：
    python tray.py
或双击 start.bat（推荐）。
"""

import io
import os
import socket
import sys
import threading
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

# 复用 server.py 里的 HTTP 服务逻辑（不重复代码）
try:
    from server import Handler, PORT
except Exception as e:  # noqa: BLE001
    print("导入 server.py 失败:", e)
    sys.exit(1)

try:
    import pystray
    from PIL import Image, ImageDraw
except ImportError:
    print("缺少依赖，请先安装：pip install pystray pillow")
    sys.exit(1)

import webbrowser
import tkinter as tk
from http.server import ThreadingHTTPServer


def build_icon():
    """用 Pillow 画一个简单的字母图标。"""
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([2, 2, 62, 62], radius=14, fill=(79, 109, 245, 255))
    d.text((20, 16), "W", fill=(255, 255, 255, 255))
    return img


def get_lan_ip():
    """获取本机局域网 IP。"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:  # noqa: BLE001
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def show_info(title, text):
    """弹窗显示信息（tkinter）。"""
    def _run():
        root = tk.Tk()
        root.title(title)
        root.geometry("360x140")
        root.attributes("-topmost", True)
        root.configure(bg="#ffffff")
        tk.Label(root, text=text, font=("Microsoft YaHei", 12),
                 bg="#ffffff", justify="left", padx=16, pady=16).pack(anchor="w")
        root.after(5000, root.destroy)
        root.mainloop()
    threading.Thread(target=_run, daemon=True).start()


def serve_http():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.serve_forever()


def on_open(icon, item):
    ip = get_lan_ip()
    webbrowser.open("http://%s:%d" % (ip, PORT))


def on_copy(icon, item):
    ip = get_lan_ip()
    addr = "http://%s:%d" % (ip, PORT)
    threading.Thread(target=_copy_thread, args=(addr,), daemon=True).start()
    show_info("已复制", addr)


def _copy_thread(text):
    try:
        subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             "Set-Clipboard -Value '" + text.replace("'", "''") + "'"],
            check=True, capture_output=True)
    except Exception:  # noqa: BLE001
        pass


def on_ip(icon, item):
    ip = get_lan_ip()
    show_info("访问地址", "本机:      http://127.0.0.1:%d\n局域网: http://%s:%d" % (PORT, ip, PORT))


def on_clear_cache(icon, item):
    show_info("提示", "请在浏览器按 Ctrl+Shift+R 强制刷新，\n以加载最新的页面与数据。")


def stop(icon, item):
    icon.stop()
    # 结束整个进程（连同后台 HTTP 服务线程）
    sys.exit(0)


def main():
    # 1. 启动 HTTP 服务（后台线程）
    t = threading.Thread(target=serve_http, daemon=True)
    t.start()

    ip = get_lan_ip()
    print("Word Reader 已启动: http://%s:%d" % (ip, PORT))
    print("已加载系统托盘，右键图标可打开网页 / 查看IP / 停止服务。")

    # 2. 创建托盘图标
    icon = pystray.Icon(
        "WordReader",
        icon=build_icon(),
        title="Word Reader · 单词学习器\nhttp://%s:%d" % (ip, PORT),
        menu=pystray.Menu(
            pystray.MenuItem("🌐 打开网页", on_open, default=True),
            pystray.MenuItem("📋 复制访问地址", on_copy),
            pystray.MenuItem("🖥 查看本机IP", on_ip),
            pystray.MenuItem("🔄 重新加载数据", on_clear_cache),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("⏹ 停止服务", stop),
        ),
    )

    try:
        icon.run()
    except KeyboardInterrupt:
        pass
    finally:
        sys.exit(0)


if __name__ == "__main__":
    main()
