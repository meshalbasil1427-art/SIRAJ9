from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import json
import uuid
import time
from pathlib import Path

app = FastAPI(title="Siraj AI Engine", version="2.0.0")

# تفعيل CORS لضمان اتصال الفرونت-إند بدون مشاكل
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = Path(__file__).resolve().parent / "siraj.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reports (
            id TEXT PRIMARY KEY,
            created_at INTEGER,
            role_name TEXT,
            score INTEGER,
            payload TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

class ReportIn(BaseModel):
    payload: dict

@app.get("/")
def home():
    return {"status": "Siraj AI Engine is Active 🚀", "vision_alignment": "2030"}

@app.post("/reports")
async def create_report(body: ReportIn):
    data = body.payload
    report_id = data.get("id", str(uuid.uuid4()))
    
    # محاكة "معالجة ذكية" في الباك-إند
    score = data.get("result", {}).get("score", 0)
    role_name = data.get("role", {}).get("name", "Unknown")
    
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute(
            "INSERT INTO reports (id, created_at, role_name, score, payload) VALUES (?, ?, ?, ?, ?)",
            (report_id, int(time.time()), role_name, score, json.dumps(data, ensure_ascii=False))
        )
        conn.commit()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

    return {"id": report_id, "message": "Analysis processed and secured."}

@app.get("/stats")
def get_stats():
    """هذه الدالة تعطي إحصائيات للمحكمين عن أكثر الوظائف طلباً في تطبيقك"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT role_name, COUNT(*) FROM reports GROUP BY role_name")
    stats = dict(cursor.fetchall())
    conn.close()
    return {"usage_by_role": stats}
