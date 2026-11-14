from __future__ import annotations

import os
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from yt_dlp import YoutubeDL

app = FastAPI(title="Tikdown API", version="1.0.3")

allowed_origins = [
    item.strip()
    for item in os.getenv(
        "ALLOWED_ORIGINS",
        "https://tikdown-zeta.vercel.app,https://tikdown-ju-god.vercel.app",
    ).split(",")
    if item.strip()
]
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
        "socket_timeout": 30,
        "retries": 3,
        "fragment_retries": 3,
        "max_filesize": MAX_FILE_BYTES,
        "cachedir": False,
    }


def is_clean_playable_video_format(fmt: dict) -> bool:
    note = str(fmt.get("format_note") or "").lower()
    codec = str(fmt.get("vcodec") or "").lower()
    return (
        codec not in {"", "none"}
        and "bytevc2" not in codec
        and bool(fmt.get("height"))
        and "watermarked" not in note
        and "unplayable" not in note
    )


def friendly_error(exc: Exception) -> str:
    message = str(exc).lower()
    if "private" in message or "login" in message or "sign in" in message:
        return "This video is private or requires a TikTok login."
    if "not available" in message or "deleted" in message:
        return "TikTok could not provide this video. It may be restricted, region-limited, or temporarily unavailable."
    if "max-filesize" in message or "file is larger" in message:
        return "This video is larger than the current 500 MB download limit."
    if "requested format is not available" in message:
        return "TikTok did not expose a downloadable video stream for this link. Try again later."
    return "TikTok could not provide this video right now. Please try again."


@app.get("/")
def root():
    return {"status": "ok", "service": "tikdown-api", "health": "/health"}


@app.get("/health")
def health():
    return {"status": "ok", "service": "tikdown-api", "version": app.version}


@app.get("/info")
def info(url: str = Query(..., min_length=8, max_length=2048)):
    video_url = validate_tiktok_url(url)
    try:
        with YoutubeDL(ydl_options()) as ydl:
            data = ydl.extract_info(video_url, download=False)
        if not data:
            raise HTTPException(status_code=422, detail="No video information was returned.")

        clean_formats = [
            fmt for fmt in (data.get("formats") or [])
            if is_clean_playable_video_format(fmt)
        ]
        if not clean_formats:
            raise HTTPException(
                status_code=422,
                detail="TikTok did not expose a playable video source for this link.",
            )

        best = max(
            clean_formats,
            key=lambda fmt: (fmt.get("height") or 0, fmt.get("width") or 0, fmt.get("tbr") or 0),
        )
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
            "watermark_free_source": True,
            "note": "Highest playable source resolution exposed by TikTok. Genuine 4K is available only when the source itself is 4K.",
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
        # Let yt-dlp's maintained TikTok extractor choose its best playable
        # stream. It ranks native playback streams above TikTok's watermarked
        # download endpoint and marks unsupported ByteVC2 streams unplayable.
        # The previous custom selector filtered out every available format.
        "format": "best",
        "outtmpl": output_template,
        "overwrites": True,
    }

    try:
        with YoutubeDL(options) as ydl:
            info_data = ydl.extract_info(video_url, download=True)
            prepared = Path(ydl.prepare_filename(info_data))

        media_files = [
            path for path in Path(temp_dir).glob("*")
            if path.is_file() and path.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}
        ]
        if prepared.exists() and prepared.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov"}:
            media_path = prepared
        elif media_files:
            media_path = max(media_files, key=lambda path: path.stat().st_size)
        else:
            raise RuntimeError("The downloaded media file could not be located.")

        if media_path.stat().st_size > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="This video exceeds the current 500 MB download limit.")

        safe_id = re.sub(r"[^A-Za-z0-9_-]", "", str(info_data.get("id") or "video"))[:80] or "video"
        suffix = media_path.suffix.lower()
        return FileResponse(
            media_path,
            media_type="video/mp4" if suffix == ".mp4" else "application/octet-stream",
            filename=f"tikdown-{safe_id}{suffix}",
            background=BackgroundTask(shutil.rmtree, temp_dir, ignore_errors=True),
        )
    except HTTPException:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=friendly_error(exc)) from exc
