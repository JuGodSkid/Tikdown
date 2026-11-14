"use client";

import { useState } from "react";
import { ArrowDownToLine, Check, Clipboard, Download, Film, Link2, LoaderCircle, ShieldCheck, Sparkles, Zap } from "lucide-react";

type VideoInfo = {
  id: string;
  title: string;
  creator: string;
  thumbnail?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  quality: string;
  note: string;
};

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function formatDuration(seconds?: number | null) {
  if (!seconds) return "Unknown duration";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  async function inspectVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVideo(null);
    if (!API) {
      setError("The downloader API has not been connected yet. Please try again after deployment is configured.");
      return;
    }
    if (!/^(https?:\/\/)?([\w-]+\.)?tiktok\.com\//i.test(url.trim())) {
      setError("Paste a valid TikTok video link.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(`${API}/info?url=${encodeURIComponent(url.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Could not read this video.");
      setVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadVideo() {
    if (!video || !API) return;
    setError("");
    setDownloading(true);
    try {
      // Fetch first so API errors are shown inside the page instead of opening
      // a blank browser tab containing a raw JSON response.
      const response = await fetch(`${API}/download?url=${encodeURIComponent(url.trim())}`);
      if (!response.ok) {
        const contentType = response.headers.get("content-type") || "";
        let message = "The video could not be downloaded. Please try again.";
        if (contentType.includes("application/json")) {
          const data = await response.json();
          message = data.detail || message;
        } else {
          const body = await response.text();
          if (body) message = body.slice(0, 240);
        }
        throw new Error(message);
      }

      const file = await response.blob();
      if (!file.size) throw new Error("TikTok returned an empty video file.");

      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="?([^";]+)"?/i);
      const filename = match?.[1] || `tikdown-${video.id || "video"}.mp4`;
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The download could not be started. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  async function pasteLink() {
    try {
      const value = await navigator.clipboard.readText();
      if (value) setUrl(value.trim());
    } catch {
      setError("Clipboard access is unavailable. Paste your link into the box.");
    }
  }

  return (
    <main className="page-shell">
      <nav className="nav">
        <a className="brand" href="/" aria-label="Tikdown home">
          <span className="brand-mark"><ArrowDownToLine size={20} strokeWidth={2.7} /></span>
          <span>tik<span>down</span></span>
        </a>
        <a className="nav-link" href="#how-it-works">How it works <span>↗</span></a>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="pulse" /> SIMPLE. CLEAN. ORIGINAL QUALITY.</div>
        <h1>Your TikTok.<br /><span>Saved your way.</span></h1>
        <p className="hero-copy">Download videos in the best quality TikTok makes available. No unnecessary compression. No account needed.</p>

        <form className="download-card" onSubmit={inspectVideo}>
          <label htmlFor="tiktok-url">PASTE TIKTOK LINK</label>
          <div className="input-row">
            <Link2 className="input-icon" size={19} />
            <input
              id="tiktok-url"
              type="url"
              placeholder="https://www.tiktok.com/@user/video/..."
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoComplete="url"
              required
            />
            <button className="paste-button" type="button" onClick={pasteLink}><Clipboard size={16} /> Paste</button>
          </div>
          <button className="primary-button" type="submit" disabled={loading || !url.trim()}>
            {loading ? <><LoaderCircle className="spin" size={18} /> Checking video...</> : <><Sparkles size={17} /> Find video</>}
          </button>
          {error && <p className="error-message" role="alert">{error}</p>}
        </form>

        {video && (
          <section className="result-card" aria-live="polite">
            <div className="result-top">
              {video.thumbnail ? <img className="thumbnail" src={video.thumbnail} alt="TikTok video thumbnail" /> : <div className="thumbnail placeholder"><Film size={26} /></div>}
              <div className="result-copy">
                <div className="result-kicker"><Check size={14} /> VIDEO FOUND</div>
                <h2>{video.title}</h2>
                <p>@{video.creator} · {formatDuration(video.duration)}</p>
              </div>
            </div>
            <div className="quality-row">
              <div><span className="quality-label">AVAILABLE SOURCE</span><strong>{video.quality}</strong></div>
              <div><span className="quality-label">FORMAT</span><strong>Best available</strong></div>
              <div><span className="quality-label">PROCESSING</span><strong>No re-encode</strong></div>
            </div>
            <button className="primary-button result-download" onClick={downloadVideo} disabled={downloading}>
              {downloading ? <><LoaderCircle className="spin" size={18} /> Starting download...</> : <><Download size={18} /> Download video</>}
            </button>
            <p className="quality-note">{video.note}</p>
          </section>
        )}
        <div className="trust-row">
          <span><ShieldCheck size={15} /> No account required</span>
          <span><Zap size={15} /> Direct file download</span>
          <span><Film size={15} /> Original stream quality</span>
        </div>
      </section>

      <section className="feature-strip" id="how-it-works">
        <article><span className="feature-icon"><Sparkles size={19} /></span><h3>Best available quality</h3><p>We use the highest-resolution source TikTok exposes. If it is 4K, we keep it 4K.</p></article>
        <article><span className="feature-icon"><ShieldCheck size={19} /></span><h3>No fake upgrades</h3><p>No artificial upscaling, no sneaky compression, and no quality claims pulled from thin air.</p></article>
        <article><span className="feature-icon"><Download size={19} /></span><h3>Simple downloads</h3><p>Paste a link, check the source details, then save the video directly to your device.</p></article>
      </section>

      <section className="how-section">
        <div className="section-tag">THREE STEPS. THAT'S IT.</div>
        <h2>From link to library.</h2>
        <div className="steps">
          <div><span>01</span><h3>Copy the link</h3><p>Copy the share link of a public TikTok video you own or have permission to save.</p></div>
          <div><span>02</span><h3>Paste it here</h3><p>We'll check the video and show the best source resolution available.</p></div>
          <div><span>03</span><h3>Download</h3><p>Save the available source without unnecessary re-encoding.</p></div>
        </div>
      </section>

      <footer>
        <a className="brand footer-brand" href="/"><span className="brand-mark"><ArrowDownToLine size={17} /></span><span>tik<span>down</span></span></a>
        <p>Only download content you own or are authorized to save. Respect creators' rights and TikTok's terms.</p>
        <span className="copyright">© {new Date().getFullYear()} Tikdown</span>
      </footer>
    </main>
  );
}
