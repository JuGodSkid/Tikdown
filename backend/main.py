from __future__ import annotations

import re
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from yt_dlp import YoutubeDL
from yt_dlp.utils import DownloadError

app = FastAPI(title="Tikdown API", version="1.0.0")

# The frontend is configured through NEXT_PUBLIC_API_URL. CORS is restricted to
# browser origins that are explicitly allowed by the deployment environment.
import os
allowed_origins = [item.strip() for item in os.getenv("ALLOWED_ORIGINS", "*").split(",") if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

TIKTOK_HOSTS = {
    "tiktok.com",
    "www.tiktok.com",
    "m.tiktok.com",
    "vm.tiktok.com",
    "vt.tiktok.com",
}
MAX_FILE_BYTES = 500 * 1024 * 1024


def validate_tiktok_url(raw_url: str) -> str:
    value = raw_url.strip()
    if not value or len(value) > 2048:
        raise HTTPException(status_code=400, detail="Enter a valid TikTok video link.")
    parsed = urlparse(value)
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"http", "https"} or not any(
        host == domain or host.endswith("." + domain) for domain in TIKTOK_HOSTS
    ):
        raise HTTPException(status_code=400, detail="Only TikTok links are supported.")
    if parsed.username or parsed.password:
        raise HTTPException(status_code=400, detail="That link is not valid.")
    return value


def ydl_options() -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 20,
        "retries": 2,
        "fragment_retries": 2,
        "max_filesize": MAX_FILE_BYTES,
        "cachedir": False,
    }


def friendly_error(exc: Exception) -> str:
    message = str(exc).lower()
    if "private" in message or "login" in message or "sign in" in message:
        return "This video is private or requires a TikTok login."
    if "not available" in message or "deleted" in message:
        return "This video is unavailable. It may have been deleted or restricted."
    if "max-filesize" in message or "file is larger" in message:
        return "This video is larger than the current 500 MB download limit."
    return "TikTok could not provide this video. Check the link and try again."


@app.get("/health")
def health():
    return {"status": "ok", "service": "tikdown-api"}


@app.get("/info")
def info(url: str = Query(..., min_length=8, max_length=2048)):
    video_url = validate_tiktok_url(url)
    try:
        with YoutubeDL(ydl_options()) as ydl:
            data = ydl.extract_info(video_url, download=False)
        if not data:
            raise HTTPException(status_code=422, detail="No video information was returned.")
        formats = data.get("formats") or []
        video_formats = [
            f for f in formats
            if f.get("vcodec") not in (None, "none") and f.get("height")
        ]
        best = max(video_formats, key=lambda f: (f.get("height") or 0, f.get("tbr") or 0), default={})
        height = best.get("height")
        width = best.get("width")
        return {
            "id": data.get("id"),
            "title": data.get("title") or "TikTok video",
            "creator": data.get("uploader") or data.get("creator") or "TikTok creator",
            "thumbnail": data.get("thumbnail"),
            "duration": data.get("duration"),
            "width": width,
            "height": height,
            "quality": f"{height}p" if height else "Best available",
            "note": "This is the highest video resolution exposed by the source. Actual availability can change.",
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=friendly_error(exc)) from exc


@app.get("/download")
def download(url: str = Query(..., min_length=8, max_length=2048)):
    video_url = validate_tiktok_url(url)
    temp_dir = tempfile.mkdtemp(prefix="tikdown-")
    output_template = str(Path(temp_dir) / "%(id)s.%(ext)s")
    options = {
        **ydl_options(),
        "format": "bestvideo*+bestaudio/best",
        "outtmpl": output_template,
        "merge_output_format": "mp4",
        "overwrites": True,
    }
    try:
        with YoutubeDL(options) as ydl:
            info_data = ydl.extract_info(video_url, download=True)
            prepared = Path(ydl.prepare_filename(info_data))
        candidates = list(Path(temp_dir).glob("*"))
        media_files = [p for p in candidates if p.is_file() and p.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}]
        if prepared.exists() and prepared.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}:
            media_path = prepared
        elif media_files:
            media_path = max(media_files, key=lambda p: p.stat().st_size)
        else:
            raise RuntimeError("The downloaded media file could not be located.")
        if media_path.stat().st_size > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="This video exceeds the 500 MB download limit.")
        safe_id = re.sub(r"[^A-Za-z0-9_-]", "", str(info_data.get("id") or "video"))[:80] or "video"
        suffix = media_path.suffix.lower()
        return FileResponse(
            media_path,
            media_type="video/mp4" if suffix == ".mp4" else "application/octet-stream",
            filename=f"tikdown-{safe_id}{suffix}",
            background=BackgroundTask(lambda: __import__("shutil").rmtree(temp_dir, ignore_errors=True)),
        )
    except HTTPException:
        __import__("shutil").rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as exc:
        __import__("shutil").rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=friendly_error(exc)) from exc
