# Tikdown

Tikdown is a mobile-first TikTok link downloader for videos you own or have permission to save. It retrieves the best source TikTok makes available and avoids re-encoding downloaded media. It cannot create genuine 4K when the source is not 4K.

## Architecture
- `frontend/`: Next.js website, deployed on Vercel.
- `backend/`: FastAPI + yt-dlp downloader, deployed on Render with Docker and FFmpeg.

## Deploy backend to Render
Create a Docker web service for this repository:
- Dockerfile path: `backend/Dockerfile`
- Docker context: repository root
- Health check path: `/health`
- Region: Singapore (closest available region to much of our intended audience)
- Start command: use the Dockerfile default.

After deployment, copy the Render service URL.

## Deploy frontend to Vercel
Import `JuGodSkid/Tikdown` and set the project root directory to `frontend`.
Add this environment variable for Production, Preview and Development:
- `NEXT_PUBLIC_API_URL` = your Render service URL (for example `https://tikdown-api.onrender.com`)

Redeploy after adding the variable.

## Local development
Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Frontend (in another terminal):
```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## Important limitations
- Only public TikTok links are supported. Private, deleted, age-restricted, login-gated or otherwise unavailable videos cannot be fetched.
- Use this service only for videos you created or have permission to download. Respect creators' rights and TikTok's terms.
- Quality is limited to the source streams TikTok exposes. No artificial upscaling or lossy re-encoding is performed.
- The API uses temporary local files that are deleted after the response. A Render free instance may sleep and has limited resources; sustained public traffic may require a paid instance and abuse protection.
