import asyncio
import base64
import datetime
import io
import json
import os
import shutil
import sqlite3
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime as dt, timezone
from pathlib import Path
from typing import Any, Optional

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

load_dotenv()

# ── 設定 ────────────────────────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
DB_PATH = Path("data/sightings.db")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 10 * 1024 * 1024))
BIRDNET_MIN_CONF = float(os.getenv("BIRDNET_MIN_CONF", "0.10"))
DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", "25.0330"))
DEFAULT_LON = float(os.getenv("DEFAULT_LON", "121.5654"))
MODEL_NAME = os.getenv("LLM_MODEL", "gemma4:latest")

# OpenAI 相容 client（支援 LM Studio / Jan / Ollama）
_llm = OpenAI(
    base_url=os.getenv("LLM_API_BASE", "http://10.0.4.2:1234/v1"),
    api_key=os.getenv("LLM_API_KEY", "not-required"),
)

# ── 中文名稱對照表 ───────────────────────────────────
try:
    with open("bird_names_zh.json", encoding="utf-8") as f:
        ZH_NAME_TABLE: dict[str, str] = json.load(f)
except Exception:
    ZH_NAME_TABLE = {}

# ── System Prompt ────────────────────────────────────
ALT_PROMPT = """\
You are an expert ornithologist. A bird was identified as "{zh_name}" ({en_name}, scientific name: {scientific}).

List exactly 5 bird species that are visually similar to this species and could be confused with it \
(prioritize species found in Taiwan and East Asia).

Respond ONLY with a valid JSON array — no markdown, no extra text:
[
  {{
    "zh_name": "中文名",
    "en_name": "English common name",
    "scientific": "Scientific name",
    "reason": "簡短說明外觀相似處（繁體中文，20字以內）"
  }}
]"""

GEMMA_PROMPT = """You are an expert ornithologist specializing in Asian and Taiwanese avifauna.
Your goal is to identify the bird species in the image with high precision.

Step-by-step reasoning process:
1. Analyze physical characteristics: carefully examine plumage colors, beak shape, eye ring, leg color, and overall body proportions.
2. Geographic Context: Use the provided coordinates to filter for species naturally occurring in that specific region (e.g., Taiwan).
3. Conclusion: Determine the most likely species based on the combination of visual features and regional distribution.

Respond ONLY with a valid JSON object. No markdown, no explanation.
JSON schema:
{
\"zh_name\": \"Standard Chinese Name\",
\"en_name\": \"English name\",
\"scientific\": \"Scientific name (Essential for precise verification)\",
\"confidence\": 0.95,
\"habitat\": {\"zh\": \"棲地描述\", \"en\": \"Habitat description\"},
\"distribution\": {\"zh\": \"分布描述\", \"en\": \"Distribution description\"},
\"not_a_bird\": false
}"""

# ── SQLite ───────────────────────────────────────────
def init_db() -> None:
    DB_PATH.parent.mkdir(exist_ok=True)
    with sqlite3.connect(DB_PATH) as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS sightings (
                id             INTEGER PRIMARY KEY AUTOINCREMENT,
                zh_name        TEXT    NOT NULL,
                en_name        TEXT    NOT NULL,
                scientific     TEXT    NOT NULL,
                confidence     REAL    NOT NULL,
                source         TEXT    NOT NULL,
                habitat_zh     TEXT,
                habitat_en     TEXT,
                dist_zh        TEXT,
                dist_en        TEXT,
                sighted_at     TEXT    NOT NULL,
                created_at     TEXT    NOT NULL,
                lat            REAL,
                lon            REAL,
                notes          TEXT,
                thumbnail      TEXT,
                corrected_from TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_sighted_at ON sightings(sighted_at DESC);
            CREATE INDEX IF NOT EXISTS idx_scientific  ON sightings(scientific);
        """)
        # 遷移舊資料庫：加入 corrected_from 欄位
        try:
            conn.execute("ALTER TABLE sightings ADD COLUMN corrected_from TEXT")
        except sqlite3.OperationalError:
            pass

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ── RAW 檔支援 ───────────────────────────────────────
RAW_EXTS = {".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2",
            ".dng", ".raf", ".pef", ".srw", ".x3f", ".raw"}

def _open_any_image(src) -> "Image.Image":
    """開啟任意格式（含 RAW）回傳 PIL RGB Image。src 可為 Path 或 bytes。"""
    from PIL import Image, ImageOps
    suffix = (src.suffix.lower() if isinstance(src, Path) else "").lstrip(".")
    is_raw = Path(f".{suffix}").suffix.lower() in RAW_EXTS if suffix else False

    if isinstance(src, Path):
        is_raw = src.suffix.lower() in RAW_EXTS
        if is_raw:
            import rawpy, numpy as _np
            with rawpy.imread(str(src)) as raw:
                rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
            return Image.fromarray(rgb)
        return ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    else:
        # bytes 輸入：非 RAW 直接 PIL 開，RAW 需先存暫存檔
        try:
            return ImageOps.exif_transpose(Image.open(io.BytesIO(src))).convert("RGB")
        except Exception:
            import rawpy, numpy as _np, tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".raw") as tmp:
                tmp.write(src)
                tmp_path = tmp.name
            try:
                with rawpy.imread(tmp_path) as raw:
                    rgb = raw.postprocess(use_camera_wb=True, no_auto_bright=False, output_bps=8)
                return Image.fromarray(rgb)
            finally:
                Path(tmp_path).unlink(missing_ok=True)

def make_thumbnail(data: bytes) -> Optional[str]:
    try:
        img = _open_any_image(data)
        img.thumbnail((320, 320))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=60)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return None

# ── 批次篩選 ─────────────────────────────────────────
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff"} | RAW_EXTS
_batch_executor = ThreadPoolExecutor(max_workers=1)
_batch_jobs: dict[str, dict] = {}


def _laplacian_var(pil_img) -> float:
    arr = np.array(pil_img.convert("L"), dtype=np.float32)
    lap = (
        -arr[:-2, 1:-1] - arr[2:, 1:-1]
        - arr[1:-1, :-2] - arr[1:-1, 2:]
        + 4 * arr[1:-1, 1:-1]
    )
    return float(lap.var())


def _run_batch(
    job_id: str, source_dir: Path, dest_dir: Path,
    theme: str, blur_thr: float, focus_thr: float,
    center_ratio: float, action: str, model: str = "",
) -> None:
    from PIL import Image, ImageOps  # noqa: PLC0415
    actual_model = model.strip() or MODEL_NAME
    job = _batch_jobs[job_id]
    files = sorted(f for f in source_dir.iterdir()
                   if f.is_file() and f.suffix.lower() in IMAGE_EXTS)
    job["total"] = len(files)
    job["status"] = "running"

    for img_path in files:
        if job["cancel_requested"]:
            job["status"] = "cancelled"
            return

        entry: dict = {
            "filename": img_path.name,
            "thumbnail": None,
            "theme_match": None,
            "blur_score": None,
            "focus_score": None,
            "passed": False,
            "reject_reason": None,
        }
        try:
            # 只開一次檔案，支援 RAW 格式
            img = _open_any_image(img_path)

            # 縮圖（顯示用，從已載入影像建立，不重開檔案）
            thumb = img.copy()
            thumb.thumbnail((320, 320))
            buf = io.BytesIO()
            thumb.save(buf, format="JPEG", quality=60)
            entry["thumbnail"] = "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

            # 縮小至 1024px 做品質分析（大幅降低運算量）
            if max(img.size) > 1024:
                r = 1024 / max(img.size)
                img = img.resize(
                    (int(img.width * r), int(img.height * r)), Image.BILINEAR
                )

            # ── Step 1: 整體模糊偵測（純影像運算，毫秒級）──
            blur = _laplacian_var(img)
            entry["blur_score"] = round(blur, 1)
            if blur < blur_thr:
                entry["reject_reason"] = "畫面模糊"
                job["log"].append(entry)
                job["processed"] += 1
                continue

            # ── Step 2: 主體對焦偵測（可調範圍）──────────
            ratio = max(0.2, min(1.0, center_ratio / 100.0))
            w, h = img.size
            margin_x = int(w * (1 - ratio) / 2)
            margin_y = int(h * (1 - ratio) / 2)
            center = img.crop((margin_x, margin_y, w - margin_x, h - margin_y))
            focus = _laplacian_var(center)
            entry["focus_score"] = round(focus, 1)
            if focus < focus_thr:
                entry["reject_reason"] = "主體未準焦"
                job["log"].append(entry)
                job["processed"] += 1
                continue

            # ── Step 3: AI 主題判斷（只對品質通過的照片呼叫）
            if theme.strip():
                job["current_file"] = img_path.name
                ai_img = img.copy()
                if max(ai_img.size) > 512:          # 縮小至 512px，加快傳輸與推論
                    r = 512 / max(ai_img.size)
                    ai_img = ai_img.resize(
                        (int(ai_img.width * r), int(ai_img.height * r)), Image.LANCZOS
                    )
                buf = io.BytesIO()
                ai_img.save(buf, format="JPEG", quality=75)
                b64 = base64.b64encode(buf.getvalue()).decode()
                resp = _llm.chat.completions.create(
                    model=actual_model,
                    max_tokens=5,
                    timeout=120,
                    messages=[{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                            {"type": "text", "text": f'Does this photo contain {theme}? Answer ONLY "yes" or "no".'},
                        ],
                    }],
                )
                answer = resp.choices[0].message.content.strip().lower()
                theme_match = answer.startswith("y") or "yes" in answer[:8]
                entry["theme_match"] = theme_match
                if not theme_match:
                    entry["reject_reason"] = "未偵測到指定主題"
                    job["log"].append(entry)
                    job["processed"] += 1
                    continue

            # ── 通過：複製 / 移動 ─────────────────────
            dest_path = dest_dir / img_path.name
            counter = 1
            while dest_path.exists():
                dest_path = dest_dir / f"{img_path.stem}_{counter}{img_path.suffix}"
                counter += 1
            if action == "move":
                shutil.move(str(img_path), str(dest_path))
            else:
                shutil.copy2(str(img_path), str(dest_path))

            entry["passed"] = True
            job["passed"] += 1

        except Exception as exc:
            entry["reject_reason"] = f"處理失敗: {exc}"

        job["log"].append(entry)
        job["processed"] += 1

    job["status"] = "done"


# ── BirdNET ──────────────────────────────────────────
birdnet_analyzer = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global birdnet_analyzer
    init_db()
    print(f"✅ 資料庫已就緒：{DB_PATH}")
    try:
        from birdnetlib.analyzer import Analyzer
        birdnet_analyzer = Analyzer()
        print("✅ BirdNET 模型載入成功")
    except BaseException as e:
        print(f"⚠️  BirdNET 模型載入失敗（音訊辨識不可用）: {e}")
        birdnet_analyzer = None
    yield

# ── FastAPI ──────────────────────────────────────────
app = FastAPI(title="BirdFinder Local AI", lifespan=lifespan)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ── Pydantic 模型 ─────────────────────────────────────
class IdentificationResult(BaseModel):
    zh_name: str
    en_name: str
    scientific: str
    confidence: float
    habitat: dict[str, str]
    distribution: dict[str, str]
    source: str
    raw_detections: list[dict[str, Any]] | None = None

class SightingItem(BaseModel):
    id: int
    zh_name: str
    en_name: str
    scientific: str
    confidence: float
    source: str
    habitat_zh: Optional[str]
    habitat_en: Optional[str]
    dist_zh: Optional[str]
    dist_en: Optional[str]
    sighted_at: str
    created_at: str
    lat: Optional[float]
    lon: Optional[float]
    notes: Optional[str]
    thumbnail: Optional[str]
    corrected_from: Optional[str] = None

class AlternativeSpecies(BaseModel):
    zh_name: str
    en_name: str
    scientific: str
    reason: str

class SightingListResponse(BaseModel):
    total: int
    items: list[SightingItem]

class SaveResponse(BaseModel):
    id: int
    created_at: str

class PatchRequest(BaseModel):
    sighted_at: Optional[str] = None
    notes: Optional[str] = None
    zh_name: Optional[str] = None
    en_name: Optional[str] = None
    scientific: Optional[str] = None
    corrected_from: Optional[str] = None

class BatchRequest(BaseModel):
    source_dir: str
    dest_dir: str
    theme: str = ""
    blur_threshold: float = 100.0
    focus_threshold: float = 100.0
    center_ratio: float = 70.0
    action: str = "copy"
    model: str = ""

# ── 辨識端點 ──────────────────────────────────────────
@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/api/models")
async def list_models():
    try:
        models = _llm.models.list()
        return {"models": [m.id for m in models.data]}
    except Exception as e:
        raise HTTPException(500, detail=f"無法取得模型列表: {e}")

@app.post("/api/identify/image", response_model=IdentificationResult)
async def identify_image(file: UploadFile = File(...), model: str = Form("")):
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, detail="檔案過大")

    # RAW 或一般圖片統一轉為 JPEG 再送 Vision API
    try:
        img = _open_any_image(data)
        if max(img.size) > 1920:
            r = 1920 / max(img.size)
            img = img.resize((int(img.width * r), int(img.height * r)))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=90)
        b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")
    except Exception as e:
        raise HTTPException(400, detail=f"無法解析圖片：{e}")
    try:
        user_content = (
            f"Identify this bird. The photograph was taken at coordinates "
            f"Lat: {DEFAULT_LAT}, Lon: {DEFAULT_LON} (Taiwan region). "
            f"Please perform a detailed visual analysis and provide the most accurate species identification."
        )
        actual_model = model.strip() or MODEL_NAME
        response = _llm.chat.completions.create(
            model=actual_model,
            messages=[
                {"role": "system", "content": GEMMA_PROMPT},
                {"role": "user", "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}},
                    {"type": "text", "text": user_content},
                ]},
            ],
        )
        raw_text = response.choices[0].message.content.strip()
        if "```" in raw_text:
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        parsed = json.loads(raw_text.strip())
        if parsed.get("not_a_bird"):
            raise HTTPException(400, detail="圖片中未偵測到可辨識的鳥類")
        sci_name = parsed.get("scientific", "").strip()
        if sci_name in ZH_NAME_TABLE:
            parsed["zh_name"] = ZH_NAME_TABLE[sci_name]
        return IdentificationResult(
            zh_name=parsed.get("zh_name", ""),
            en_name=parsed.get("en_name", ""),
            scientific=sci_name,
            confidence=float(parsed.get("confidence", 0.0)),
            habitat=parsed.get("habitat", {"zh": "", "en": ""}),
            distribution=parsed.get("distribution", {"zh": "", "en": ""}),
            source="ollama_gemma4_enhanced",
        )
    except Exception as e:
        raise HTTPException(500, detail=f"辨識失敗: {str(e)}")

@app.post("/api/identify/audio", response_model=IdentificationResult)
async def identify_audio(file: UploadFile = File(...)):
    if birdnet_analyzer is None:
        raise HTTPException(503, detail="BirdNET 模型未載入，請確認 birdnetlib 已正確安裝")
    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, detail="檔案過大")
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    tmp_path = UPLOAD_DIR / f"{uuid.uuid4()}{suffix}"
    try:
        tmp_path.write_bytes(data)
        from birdnetlib import Recording
        recording = Recording(
            birdnet_analyzer,
            str(tmp_path),
            lat=DEFAULT_LAT,
            lon=DEFAULT_LON,
            date=datetime.date.today(),
            min_conf=BIRDNET_MIN_CONF,
        )
        recording.analyze()
        detections = recording.detections
        if not detections:
            raise HTTPException(400, detail="音檔中未偵測到鳥類鳴叫聲")
        species_map: dict[str, dict] = {}
        for d in detections:
            sci = d.get("scientific_name", "")
            if sci not in species_map or d["confidence"] > species_map[sci]["confidence"]:
                species_map[sci] = d
        ranked = sorted(species_map.values(), key=lambda x: x["confidence"], reverse=True)
        top = ranked[0]
        sci_name = top.get("scientific_name", "")
        zh_name = ZH_NAME_TABLE.get(sci_name, top.get("common_name", ""))
        return IdentificationResult(
            zh_name=zh_name,
            en_name=top.get("common_name", ""),
            scientific=sci_name,
            confidence=float(top.get("confidence", 0.0)),
            habitat={"zh": "", "en": ""},
            distribution={"zh": "", "en": ""},
            source="birdnet",
            raw_detections=[
                {
                    "common_name": d.get("common_name", ""),
                    "scientific_name": d.get("scientific_name", ""),
                    "confidence": float(d.get("confidence", 0.0)),
                }
                for d in ranked
            ],
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, detail=f"音訊辨識失敗: {str(e)}")
    finally:
        tmp_path.unlink(missing_ok=True)

# ── 相似物種端點 ──────────────────────────────────────
@app.post("/api/identify/alternatives", response_model=list[AlternativeSpecies])
async def get_alternatives(
    scientific: str = Form(...),
    zh_name: str = Form(...),
    en_name: str = Form(...),
    model: str = Form(""),
    image: Optional[UploadFile] = File(None),
):
    prompt = ALT_PROMPT.format(zh_name=zh_name, en_name=en_name, scientific=scientific)
    messages: list[dict] = []

    if image is not None:
        img_data = await image.read()
        if img_data:
            b64 = base64.b64encode(img_data).decode()
            messages.append({
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
                    {"type": "text", "text": prompt},
                ],
            })
        else:
            messages.append({"role": "user", "content": prompt})
    else:
        messages.append({"role": "user", "content": prompt})

    try:
        response = _llm.chat.completions.create(
            model=model.strip() or MODEL_NAME, messages=messages)
        raw = response.choices[0].message.content.strip()
        if "```" in raw:
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        alternatives = json.loads(raw.strip())
        return [AlternativeSpecies(**a) for a in alternatives[:5]]
    except Exception as e:
        raise HTTPException(500, detail=f"無法取得相似物種：{str(e)}")

# ── 記錄 CRUD 端點 ────────────────────────────────────
@app.post("/api/records", response_model=SaveResponse, status_code=201)
async def create_record(
    zh_name: str = Form(...),
    en_name: str = Form(...),
    scientific: str = Form(...),
    confidence: float = Form(...),
    source: str = Form(...),
    sighted_at: str = Form(...),
    habitat_zh: str = Form(""),
    habitat_en: str = Form(""),
    dist_zh: str = Form(""),
    dist_en: str = Form(""),
    notes: str = Form(""),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    thumbnail = None
    if image is not None:
        img_data = await image.read()
        if img_data:
            thumbnail = make_thumbnail(img_data)

    created_at = dt.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO sightings
               (zh_name, en_name, scientific, confidence, source,
                habitat_zh, habitat_en, dist_zh, dist_en,
                sighted_at, created_at, lat, lon, notes, thumbnail)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (zh_name, en_name, scientific, confidence, source,
             habitat_zh or None, habitat_en or None,
             dist_zh or None, dist_en or None,
             sighted_at, created_at,
             lat, lon,
             notes or None, thumbnail),
        )
        record_id = cur.lastrowid
    return SaveResponse(id=record_id, created_at=created_at)

@app.get("/api/records", response_model=SightingListResponse)
async def list_records(
    q: str = "",
    date_from: str = "",
    date_to: str = "",
    limit: int = 50,
    offset: int = 0,
):
    limit = min(limit, 500)
    conditions = []
    params: list[Any] = []
    if q:
        conditions.append("(zh_name LIKE ? OR en_name LIKE ? OR scientific LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]
    if date_from:
        conditions.append("sighted_at >= ?")
        params.append(date_from)
    if date_to:
        conditions.append("sighted_at <= ?")
        params.append(date_to)
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    with get_db() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM sightings {where}", params).fetchone()[0]
        rows = conn.execute(
            f"SELECT * FROM sightings {where} ORDER BY sighted_at DESC, id DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    return SightingListResponse(
        total=total,
        items=[SightingItem(**dict(r)) for r in rows],
    )

@app.get("/api/records/{record_id}", response_model=SightingItem)
async def get_record(record_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM sightings WHERE id=?", (record_id,)).fetchone()
    if row is None:
        raise HTTPException(404, detail="記錄不存在")
    return SightingItem(**dict(row))

@app.delete("/api/records/{record_id}", status_code=204)
async def delete_record(record_id: int):
    with get_db() as conn:
        affected = conn.execute("DELETE FROM sightings WHERE id=?", (record_id,)).rowcount
    if affected == 0:
        raise HTTPException(404, detail="記錄不存在")
    return Response(status_code=204)

@app.patch("/api/records/{record_id}", response_model=SightingItem)
async def patch_record(record_id: int, body: PatchRequest):
    fields, params = [], []
    if body.sighted_at is not None:
        fields.append("sighted_at=?"); params.append(body.sighted_at)
    if body.notes is not None:
        fields.append("notes=?"); params.append(body.notes or None)
    if body.zh_name is not None:
        fields.append("zh_name=?"); params.append(body.zh_name)
    if body.en_name is not None:
        fields.append("en_name=?"); params.append(body.en_name)
    if body.scientific is not None:
        fields.append("scientific=?"); params.append(body.scientific)
    if body.corrected_from is not None:
        fields.append("corrected_from=?"); params.append(body.corrected_from)
    if not fields:
        raise HTTPException(400, detail="沒有可更新的欄位")
    params.append(record_id)
    with get_db() as conn:
        conn.execute(f"UPDATE sightings SET {', '.join(fields)} WHERE id=?", params)
        row = conn.execute("SELECT * FROM sightings WHERE id=?", (record_id,)).fetchone()
    if row is None:
        raise HTTPException(404, detail="記錄不存在")
    return SightingItem(**dict(row))

# ── 批次篩選端點 ──────────────────────────────────────
@app.get("/api/batch/validate")
async def batch_validate(path: str):
    p = Path(path)
    if not p.is_dir():
        raise HTTPException(400, detail="資料夾不存在")
    count = sum(1 for f in p.iterdir() if f.is_file() and f.suffix.lower() in IMAGE_EXTS)
    return {"valid": True, "image_count": count}

@app.post("/api/batch/start")
async def batch_start(req: BatchRequest):
    src = Path(req.source_dir)
    if not src.is_dir():
        raise HTTPException(400, detail="來源資料夾不存在")
    dst = Path(req.dest_dir)
    dst.mkdir(parents=True, exist_ok=True)

    job_id = str(uuid.uuid4())
    _batch_jobs[job_id] = {
        "status": "starting",
        "total": 0, "processed": 0, "passed": 0,
        "current_file": "",
        "log": [], "cancel_requested": False,
    }
    loop = asyncio.get_running_loop()
    loop.run_in_executor(
        _batch_executor, _run_batch,
        job_id, src, dst, req.theme,
        req.blur_threshold, req.focus_threshold,
        req.center_ratio, req.action, req.model,
    )
    return {"job_id": job_id}

@app.get("/api/batch/{job_id}/status")
async def batch_status(job_id: str):
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="任務不存在")
    return {k: v for k, v in job.items() if k not in ("log", "cancel_requested")}

@app.get("/api/batch/{job_id}/result")
async def batch_result(job_id: str):
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="任務不存在")
    return {k: v for k, v in job.items() if k != "cancel_requested"}

@app.post("/api/batch/{job_id}/cancel")
async def batch_cancel(job_id: str):
    job = _batch_jobs.get(job_id)
    if not job:
        raise HTTPException(404, detail="任務不存在")
    job["cancel_requested"] = True
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
