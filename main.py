from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
import uuid
import time
from pathlib import Path
import os
from collections import defaultdict, deque

app = FastAPI(title="Siraj API", version="1.2.0")

# ──────────────────────────────────────────────────────────────
# CORS (Secure default): set env ALLOW_ORIGINS="http://localhost:5500,https://your-gh-pages"
# ──────────────────────────────────────────────────────────────
raw_origins = os.getenv("ALLOW_ORIGINS", "").strip()
if raw_origins:
  allow_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
else:
  # dev defaults (add your production domain here)
  allow_origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
  ]

app.add_middleware(
  CORSMiddleware,
  allow_origins=allow_origins,
  allow_methods=["GET", "POST"],
  allow_headers=["Content-Type"],
  allow_credentials=False,
)

DB_PATH = Path(__file__).resolve().parent / "siraj.db"
MAX_PAYLOAD_BYTES = int(os.getenv("MAX_PAYLOAD_BYTES", "200000"))  # 200KB

# ──────────────────────────────────────────────────────────────
# Simple in-memory rate limit: 30 requests/min per IP
# ──────────────────────────────────────────────────────────────
WINDOW_SEC = 60
MAX_REQ_PER_WINDOW = 30
ip_hits = defaultdict(lambda: deque())

def rate_limit(request: Request):
  ip = request.client.host if request.client else "unknown"
  now = time.time()
  q = ip_hits[ip]
  while q and (now - q[0]) > WINDOW_SEC:
    q.popleft()
  if len(q) >= MAX_REQ_PER_WINDOW:
    raise HTTPException(status_code=429, detail="Too many requests")
  q.append(now)

def db():
  conn = sqlite3.connect(DB_PATH, check_same_thread=False)
  conn.row_factory = sqlite3.Row
  return conn

def init_db():
  conn = db()
  conn.execute(
    """
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      payload TEXT NOT NULL
    )
    """
  )
  conn.commit()
  conn.close()

init_db()

class ReportIn(BaseModel):
  payload: dict

@app.get("/")
def home():
  return {"message": "Siraj backend running 🚀", "version": app.version}

@app.get("/health")
def health():
  return {"status": "ok"}

@app.post("/reports")
def create_report(body: ReportIn, request: Request):
  rate_limit(request)

  raw = json.dumps(body.payload, ensure_ascii=False).encode("utf-8")
  if len(raw) > MAX_PAYLOAD_BYTES:
    raise HTTPException(status_code=413, detail="Payload too large")

  report_id = str(uuid.uuid4())
  created_at = int(time.time())

  conn = db()
  conn.execute(
    "INSERT INTO reports (id, created_at, payload) VALUES (?, ?, ?)",
    (report_id, created_at, raw.decode("utf-8")),
  )
  conn.commit()
  conn.close()

  return {"id": report_id, "created_at": created_at}

@app.get("/reports/{report_id}")
def get_report(report_id: str, request: Request):
  rate_limit(request)

  conn = db()
  row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
  conn.close()

  if not row:
    raise HTTPException(status_code=404, detail="Report not found")

  return {
    "id": row["id"],
    "created_at": row["created_at"],
    "payload": json.loads(row["payload"]),
  }