"""
Сервер сайта TKPL Launcher.

- Раздаёт сайт: html/, css/, js/ и файл лаунчера из downloads/
- POST /api/feedback — принимает отзыв с формы и отправляет его письмом на почту автора

Запуск:  python py/server.py      (потом открыть http://localhost:8000)
Настройки почты лежат в py/.env (пример в py/.env.example).
"""

from __future__ import annotations

import json
import logging
import os
import re
import smtplib
import ssl
import threading
import time
from collections import defaultdict, deque
from datetime import datetime
from email.message import EmailMessage
from email.utils import formataddr
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

# ---------- пути ----------
PY_DIR = Path(__file__).resolve().parent
ROOT = PY_DIR.parent
HTML_DIR = ROOT / "html"
CSS_DIR = ROOT / "css"
JS_DIR = ROOT / "js"
DOWNLOADS_DIR = ROOT / "downloads"
FEEDBACK_LOG = PY_DIR / "feedback.jsonl"  # запасная копия всех отзывов


# ---------- настройки из .env ----------
def load_env(path: Path) -> None:
    """Простой разбор .env без лишних зависимостей. Переменные окружения важнее файла."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_env(PY_DIR / ".env")

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")  # пароль приложения Google пишут с пробелами
FEEDBACK_TO = os.getenv("FEEDBACK_TO", "") or SMTP_USER
HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8000"))

# лимиты
MAX_NAME = 40
MAX_CONTACT = 100
MAX_MESSAGE = 2000
RATE_LIMIT = 3            # не больше 3 отзывов…
RATE_WINDOW = 10 * 60     # …за 10 минут с одного IP

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("tkpl-site")

app = Flask(__name__, static_folder=None)
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024  # отзыв не может весить больше 32 КБ


# ---------- раздача сайта ----------
@app.get("/")
def index():
    return send_from_directory(HTML_DIR, "index.html")


@app.get("/css/<path:name>")
def css(name: str):
    return send_from_directory(CSS_DIR, name)


@app.get("/js/<path:name>")
def js(name: str):
    return send_from_directory(JS_DIR, name)


@app.get("/downloads/<path:name>")
def downloads(name: str):
    if name.lower().endswith(".exe"):
        return send_from_directory(DOWNLOADS_DIR, name, as_attachment=True, download_name="TKPL Launcher.exe")
    return send_from_directory(DOWNLOADS_DIR, name)  # LICENSE.txt и прочие тексты открываются в браузере


@app.after_request
def security_headers(resp):
    resp.headers.setdefault("X-Content-Type-Options", "nosniff")
    resp.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    resp.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    return resp


# ---------- защита от спама ----------
_hits: dict[str, deque[float]] = defaultdict(deque)
_hits_lock = threading.Lock()


def client_ip() -> str:
    # за прокси (nginx, хостинг) настоящий IP приходит в X-Forwarded-For
    forwarded = request.headers.get("X-Forwarded-For", "")
    return forwarded.split(",")[0].strip() or request.remote_addr or "unknown"


def rate_limited(ip: str) -> bool:
    now = time.monotonic()
    with _hits_lock:
        q = _hits[ip]
        while q and now - q[0] > RATE_WINDOW:
            q.popleft()
        if len(q) >= RATE_LIMIT:
            return True
        q.append(now)
        return False


# ---------- отправка письма ----------
CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def clean(value, limit: int, multiline: bool = False) -> str:
    text = str(value or "")
    text = CONTROL_CHARS.sub("", text)
    if not multiline:
        text = " ".join(text.split())  # никаких переносов строк — защита заголовков письма
    return text.strip()[:limit]


def send_mail(fb: dict) -> None:
    if not SMTP_USER or not SMTP_PASSWORD:
        raise RuntimeError("Почта не настроена: заполни SMTP_USER и SMTP_PASSWORD в py/.env")

    stars = f"{fb['rating']}/5" if fb["rating"] else "без оценки"
    msg = EmailMessage()
    msg["Subject"] = f"[TKPL] Отзыв от {fb['name']} ({stars})"
    msg["From"] = formataddr(("TKPL Launcher — сайт", SMTP_USER))
    msg["To"] = FEEDBACK_TO
    if EMAIL_RE.match(fb["contact"]):
        msg["Reply-To"] = fb["contact"]  # можно сразу нажать «Ответить»

    msg.set_content(
        f"Ник: {fb['name']}\n"
        f"Контакт: {fb['contact'] or 'не указан'}\n"
        f"Оценка: {stars}\n"
        f"Время: {fb['time']}\n"
        f"IP: {fb['ip']}\n"
        f"\n{fb['message']}\n"
    )

    context = ssl.create_default_context()
    if SMTP_PORT == 465:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, context=context, timeout=15) as s:
            s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)
    else:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
            s.starttls(context=context)
            s.login(SMTP_USER, SMTP_PASSWORD)
            s.send_message(msg)


def save_backup(fb: dict) -> None:
    with FEEDBACK_LOG.open("a", encoding="utf-8") as f:
        f.write(json.dumps(fb, ensure_ascii=False) + "\n")


# ---------- API ----------
@app.post("/api/feedback")
def feedback():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(ok=False, error="Неверный формат запроса"), 400

    # ловушка: это поле видят только боты. Делаем вид, что всё прошло
    if data.get("website"):
        return jsonify(ok=True)

    name = clean(data.get("name"), MAX_NAME)
    contact = clean(data.get("contact"), MAX_CONTACT)
    message = clean(data.get("message"), MAX_MESSAGE, multiline=True)
    rating = data.get("rating")
    rating = rating if isinstance(rating, int) and 1 <= rating <= 5 else None

    if len(name) < 2:
        return jsonify(ok=False, error="Напиши ник, хотя бы 2 символа"), 400
    if len(message) < 5:
        return jsonify(ok=False, error="Сообщение слишком короткое"), 400

    ip = client_ip()
    if rate_limited(ip):
        return jsonify(ok=False, error="Слишком много сообщений. Попробуй через 10 минут."), 429

    fb = {
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "ip": ip,
        "name": name,
        "contact": contact,
        "rating": rating,
        "message": message,
    }
    save_backup(fb)

    try:
        send_mail(fb)
    except Exception:
        log.exception("Не удалось отправить письмо")
        return jsonify(ok=False, error="Не получилось отправить письмо. Попробуй позже."), 502

    log.info("Отзыв от %s отправлен на %s", name, FEEDBACK_TO)
    return jsonify(ok=True)


@app.errorhandler(413)
def too_large(_):
    return jsonify(ok=False, error="Слишком длинное сообщение"), 413


@app.errorhandler(404)
def not_found(_):
    return jsonify(ok=False, error="Не найдено"), 404


if __name__ == "__main__":
    if not SMTP_USER or not SMTP_PASSWORD:
        log.warning("Почта не настроена — отзывы будут только сохраняться в %s", FEEDBACK_LOG)
    log.info("Сайт: http://%s:%s", "localhost" if HOST in ("127.0.0.1", "0.0.0.0") else HOST, PORT)
    app.run(host=HOST, port=PORT, debug=False)
