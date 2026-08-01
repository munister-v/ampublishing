"""
AM Publishing — приём заявок на услуги.

Сайт статический (GitHub Pages), поэтому заявки принимает этот маленький
сервис на VPS: пишет их в SQLite, отдаёт админке по токену и, если задан
Telegram-бот, шлёт уведомление.

Публичные ручки:
    POST /leads/api/leads          — отправка заявки с сайта
    GET  /leads/api/health         — проверка живости

Админские (заголовок X-Admin-Token):
    GET    /leads/api/leads        — список
    PATCH  /leads/api/leads/<id>   — смена статуса
    DELETE /leads/api/leads/<id>   — удаление
    GET    /leads/api/leads.csv    — выгрузка
    GET    /leads/api/stats        — счётчики по статусам
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import sqlite3
import time
from contextlib import closing
from datetime import datetime, timezone
from urllib import request as urlrequest

from flask import Flask, Response, g, jsonify, request

APP_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("LEADS_DB", os.path.join(APP_DIR, "database", "leads.db"))
ADMIN_TOKEN = os.environ.get("LEADS_ADMIN_TOKEN", "")
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        "https://ampublishing.org,https://www.ampublishing.org,http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]

# Антиспам: не больше N заявок с одного IP за окно.
RATE_LIMIT_MAX = int(os.environ.get("LEADS_RATE_LIMIT", "5"))
RATE_LIMIT_WINDOW = int(os.environ.get("LEADS_RATE_WINDOW", "3600"))
DUPLICATE_WINDOW = int(os.environ.get("LEADS_DUPLICATE_WINDOW", "600"))
MAX_FIELD = 4000

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
STATUSES = ("new", "in_progress", "done", "archived")

app = Flask(__name__)


# ---------- база ----------

def get_db() -> sqlite3.Connection:
    if "db" not in g:
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA busy_timeout=15000")
        g.db = conn
    return g.db


@app.teardown_appcontext
def close_db(_exc=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    with closing(sqlite3.connect(DB_PATH)) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS leads (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                public_id     TEXT UNIQUE NOT NULL,
                created_at    TEXT NOT NULL,
                created_ts    INTEGER NOT NULL,
                name          TEXT NOT NULL,
                email         TEXT NOT NULL,
                phone         TEXT DEFAULT '',
                service       TEXT DEFAULT '',
                service_title TEXT DEFAULT '',
                message       TEXT DEFAULT '',
                language      TEXT DEFAULT 'ru',
                page_url      TEXT DEFAULT '',
                consent       INTEGER DEFAULT 0,
                attribution   TEXT DEFAULT '{}',
                status        TEXT DEFAULT 'new',
                ip            TEXT DEFAULT '',
                user_agent    TEXT DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_created ON leads(created_ts DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_leads_ip ON leads(ip, created_ts)")
        conn.commit()


# ---------- вспомогательное ----------

def cors_origin() -> str:
    origin = request.headers.get("Origin", "")
    return origin if origin in ALLOWED_ORIGINS else (ALLOWED_ORIGINS[0] if ALLOWED_ORIGINS else "*")


@app.after_request
def add_cors(resp: Response) -> Response:
    resp.headers["Access-Control-Allow-Origin"] = cors_origin()
    resp.headers["Vary"] = "Origin"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PATCH, DELETE, OPTIONS"
    return resp


@app.route("/leads/api/<path:_any>", methods=["OPTIONS"])
def preflight(_any):
    return ("", 204)


def client_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For", "")
    return (forwarded.split(",")[0] if forwarded else request.remote_addr or "").strip()


def require_admin() -> bool:
    token = request.headers.get("X-Admin-Token", "") or request.args.get("token", "")
    return bool(ADMIN_TOKEN) and token == ADMIN_TOKEN


def clean(value, limit: int = MAX_FIELD) -> str:
    return str(value or "").strip()[:limit]


def notify_telegram(lead: dict) -> None:
    if not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    lines = [
        "🖋 Новая заявка на услугу",
        f"Услуга: {lead['service_title'] or lead['service']}",
        f"Имя: {lead['name']}",
        f"E-mail: {lead['email']}",
    ]
    if lead["phone"]:
        lines.append(f"Телефон: {lead['phone']}")
    lines += ["", lead["message"], "", f"Язык: {lead['language']} · {lead['public_id']}"]
    text = "\n".join(lines)
    payload = json.dumps({"chat_id": TELEGRAM_CHAT_ID, "text": text}).encode()
    req = urlrequest.Request(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    try:
        urlrequest.urlopen(req, timeout=8).read()
    except Exception as exc:  # уведомление не должно ронять приём заявки
        app.logger.warning("telegram notify failed: %s", exc)


# ---------- публичные ручки ----------

@app.get("/leads/api/health")
def health():
    db = get_db()
    total = db.execute("SELECT COUNT(*) AS c FROM leads").fetchone()["c"]
    return jsonify({"ok": True, "leads": total, "time": datetime.now(timezone.utc).isoformat()})


@app.post("/leads/api/leads")
def create_lead():
    data = request.get_json(silent=True) or request.form.to_dict() or {}

    # Приманка для ботов — заполнено, значит не человек. Отвечаем «ок»,
    # чтобы бот не подбирал другую форму, но ничего не сохраняем.
    if clean(data.get("honeypot") or data.get("company")):
        return jsonify({"ok": True, "id": "ignored"}), 202

    name = clean(data.get("name"), 200)
    email = clean(data.get("email"), 200)
    message = clean(data.get("message") or data.get("description"))

    if not name or not EMAIL_RE.match(email) or not message:
        return jsonify({"ok": False, "error": "name, email and message are required"}), 400

    ip = client_ip()
    now = int(time.time())
    db = get_db()

    recent = db.execute(
        "SELECT COUNT(*) AS c FROM leads WHERE ip = ? AND created_ts > ?",
        (ip, now - RATE_LIMIT_WINDOW),
    ).fetchone()["c"]
    if recent >= RATE_LIMIT_MAX:
        return jsonify({"ok": False, "error": "rate limit"}), 429

    service = clean(data.get("service"), 120)
    duplicate = db.execute(
        "SELECT public_id FROM leads WHERE email = ? AND service = ? AND created_ts > ?",
        (email.lower(), service, now - DUPLICATE_WINDOW),
    ).fetchone()
    if duplicate:
        return jsonify({"ok": True, "duplicate": True, "id": duplicate["public_id"]}), 200

    public_id = clean(data.get("id"), 40) or f"LEAD-{now}"
    lead = {
        "public_id": public_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_ts": now,
        "name": name,
        "email": email.lower(),
        "phone": clean(data.get("phone"), 60),
        "service": service,
        "service_title": clean(data.get("serviceTitle"), 200),
        "message": message,
        "language": clean(data.get("language"), 5) or "ru",
        "page_url": clean(data.get("pageUrl"), 500),
        "consent": 1 if data.get("consent") else 0,
        "attribution": json.dumps(data.get("attribution") or {}, ensure_ascii=False)[:2000],
        "status": "new",
        "ip": ip,
        "user_agent": clean(request.headers.get("User-Agent"), 400),
    }

    db.execute(
        """
        INSERT INTO leads (public_id, created_at, created_ts, name, email, phone, service,
                           service_title, message, language, page_url, consent, attribution,
                           status, ip, user_agent)
        VALUES (:public_id, :created_at, :created_ts, :name, :email, :phone, :service,
                :service_title, :message, :language, :page_url, :consent, :attribution,
                :status, :ip, :user_agent)
        """,
        lead,
    )
    db.commit()

    notify_telegram(lead)
    return jsonify({"ok": True, "id": public_id}), 201


# ---------- админские ручки ----------

def row_to_dict(row: sqlite3.Row) -> dict:
    item = dict(row)
    try:
        item["attribution"] = json.loads(item.get("attribution") or "{}")
    except json.JSONDecodeError:
        item["attribution"] = {}
    item["consent"] = bool(item.get("consent"))
    return item


@app.get("/leads/api/leads")
def list_leads():
    if not require_admin():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    status = request.args.get("status", "")
    limit = min(int(request.args.get("limit", "200")), 1000)
    query = "SELECT * FROM leads"
    params: list = []
    if status in STATUSES:
        query += " WHERE status = ?"
        params.append(status)
    query += " ORDER BY created_ts DESC LIMIT ?"
    params.append(limit)
    rows = get_db().execute(query, params).fetchall()
    return jsonify({"ok": True, "leads": [row_to_dict(row) for row in rows]})


@app.get("/leads/api/stats")
def stats():
    if not require_admin():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    rows = get_db().execute("SELECT status, COUNT(*) AS c FROM leads GROUP BY status").fetchall()
    return jsonify({"ok": True, "stats": {row["status"]: row["c"] for row in rows}})


@app.patch("/leads/api/leads/<public_id>")
def update_lead(public_id: str):
    if not require_admin():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    data = request.get_json(silent=True) or {}
    status = clean(data.get("status"), 20)
    if status not in STATUSES:
        return jsonify({"ok": False, "error": "bad status"}), 400
    db = get_db()
    db.execute("UPDATE leads SET status = ? WHERE public_id = ?", (status, public_id))
    db.commit()
    return jsonify({"ok": True})


@app.delete("/leads/api/leads/<public_id>")
def delete_lead(public_id: str):
    if not require_admin():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    db = get_db()
    db.execute("DELETE FROM leads WHERE public_id = ?", (public_id,))
    db.commit()
    return jsonify({"ok": True})


@app.get("/leads/api/leads.csv")
def export_csv():
    if not require_admin():
        return jsonify({"ok": False, "error": "unauthorized"}), 401
    rows = get_db().execute("SELECT * FROM leads ORDER BY created_ts DESC").fetchall()
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerow(
        ["ID", "Дата", "Имя", "Email", "Телефон", "Услуга", "Язык", "Статус", "Согласие", "Источник", "Сообщение"]
    )
    for row in rows:
        item = row_to_dict(row)
        writer.writerow(
            [
                item["public_id"],
                item["created_at"],
                item["name"],
                item["email"],
                item["phone"],
                item["service_title"] or item["service"],
                item["language"],
                item["status"],
                "да" if item["consent"] else "нет",
                (item["attribution"] or {}).get("source", ""),
                item["message"],
            ]
        )
    return Response(
        "﻿" + buffer.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=leads.csv"},
    )


init_db()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5062")), debug=False)
