"use client";

import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Clipboard,
  Download,
  Film,
  Link2,
  LoaderCircle,
  Menu,
  X,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
} from "lucide-react";

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
  available_qualities?: number[];
};

const API = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/$/, "");

function formatDuration(seconds?: number | null) {
  if (seconds == null) return "Duration unavailable";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = window.localStorage.getItem("tikdown-theme");
    const nextTheme = saved === "dark" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("tikdown-theme", nextTheme);
  }

  async function inspectVideo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setVideo(null);

    if (!API) {
      setError("The downloader is not connected yet. Please try again later.");
      return;
    }

    try {
      const parsed = new URL(url.trim());
      if (!["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"].includes(parsed.hostname.toLowerCase())) {
        throw new Error("Paste a valid TikTok video link.");
      }
    } catch (err) {
      setError(err instanceof Error && err.message.includes("valid TikTok") ? err.message : "Paste a valid TikTok video link.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API}/info?url=${encodeURIComponent(url.trim())}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "We couldn't read this video.");
      setVideo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadVideo() {
    if (!video || !API) return;
    setError("");
    setDownloading(true);

    try {
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
    setError("");
    try {
      const value = await navigator.clipboard.readText();
      if (value) setUrl(value.trim());
    } catch {
      setError("Clipboard access is unavailable here. Paste your link into the field.");
    }
  }

  function clearVideo() {
    setVideo(null);
    setError("");
    setUrl("");
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Tikdown home">
          <span className="wordmark-icon"><ArrowDownToLine size={19} strokeWidth={2.4} /></span>
          <span>tikdown<span className="wordmark-period">.</span></span>
        </a>
        <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} title={theme === "dark" ? "Light mode" : "Dark mode"}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
        </button>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
        <nav className={`topbar-nav ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>Why Tikdown</a>
          <a href="#how-to-use" onClick={() => setMenuOpen(false)}>How it works</a>
          <span className="nav-note"><span className="status-dot" /> Free to use</span>
        </nav>
      </header>

      <section className="hero-layout">
        <div className="intro">
          <p className="hero-badge"><Sparkles size={14} /> SIMPLE TIKTOK VIDEO DOWNLOADER</p>
          <h1>TikTok Video<br />Downloader<br /><span>Without the clutter.</span></h1>
          <p className="intro-copy">
            Save public TikTok videos in the best quality the original source makes available.
            No account, no unnecessary steps.
          </p>
        </div>

        <section className="download-panel" aria-label="TikTok video downloader">
          <div className="panel-heading">
            <div>
              <p className="panel-overline">YOUR DOWNLOAD</p>
              <h2>Download your video</h2>
            </div>
            <span className="panel-number">01 / 01</span>
          </div>

          <form onSubmit={inspectVideo} className="url-form">
            <label htmlFor="tiktok-url">TIKTOK URL</label>
            <div className="url-input-wrap">
              <Link2 size={18} className="url-icon" />
              <input
                id="tiktok-url"
                type="url"
                placeholder="Paste your TikTok link here"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) setError("");
                }}
                autoComplete="url"
                required
              />
              <button className="paste-button" type="button" onClick={pasteLink}>
                <Clipboard size={15} />
                <span>Paste</span>
              </button>
            </div>
            <button className="inspect-button" type="submit" disabled={loading || !url.trim()}>
              {loading ? <><LoaderCircle className="spin" size={17} /> Checking link</> : <>Get video <ArrowUpRight size={17} /></>}
            </button>
            <p className="form-hint">Paste a public TikTok link to check its available source.</p>
          </form>

          {error && <p className="error-message" role="alert">{error}</p>}

          {video && (
            <div className="video-result" aria-live="polite">
              <div className="result-header">
                <span className="result-status"><Check size={13} /> VIDEO FOUND</span>
                <button type="button" className="change-link" onClick={clearVideo}>Change link</button>
              </div>
              <div className="video-summary">
                {video.thumbnail
                  ? <img className="video-thumbnail" src={video.thumbnail} alt="TikTok video thumbnail" />
                  : <div className="video-thumbnail thumbnail-placeholder"><Film size={25} /></div>}
                <div className="video-meta">
                  <h3>{video.title}</h3>
                  <p>@{video.creator} <span>·</span> {formatDuration(video.duration)}</p>
                </div>
              </div>
              <div className="source-details">
                <div>
                  <span className="detail-label">SOURCE QUALITY</span>
                  <strong>{video.quality}</strong>
                </div>
                <div>
                  <span className="detail-label">PROCESSING</span>
                  <strong>Original stream</strong>
                </div>
              </div>
              <button className="inspect-button download-action" type="button" onClick={downloadVideo} disabled={downloading}>
                {downloading
                  ? <><LoaderCircle className="spin" size={17} /> Preparing download</>
                  : <><Download size={17} /> Download video</>}
              </button>
              <p className="result-note">{video.note}</p>
            </div>
          )}

          <div className="panel-foot">
            <ShieldCheck size={15} />
            <span>Only download videos you have permission to save.</span>
          </div>
        </section>
      </section>

      <section className="features-section" id="how-it-works">
        <div className="features-heading">
          <p className="hero-badge"><Sparkles size={13} /> MADE TO BE SIMPLE</p>
          <h2>Why use Tikdown?</h2>
          <p>Everything you need. Nothing getting in the way.</p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-icon"><ShieldCheck size={25} /></span>
            <h3>Clean downloads</h3>
            <p>Get the clean source when TikTok makes a watermark-free stream available.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><Film size={25} /></span>
            <h3>Best available quality</h3>
            <p>We check the available source instead of promising a resolution the video doesn't have.</p>
          </article>
          <article className="feature-card">
            <span className="feature-icon"><Download size={25} /></span>
            <h3>Simple and free</h3>
            <p>No account or subscription. Just paste a link and save the video.</p>
          </article>
        </div>
      </section>

      <section className="how-section" id="how-to-use">
        <div className="how-heading"><p className="section-kicker">HOW IT WORKS</p><h2>Three quick steps</h2></div>
        <div className="how-steps">
          <p><span>01</span> Copy the TikTok video link.</p>
          <p><span>02</span> Paste it above and check the source.</p>
          <p><span>03</span> Download the video to your device.</p>
        </div>
      </section>

      <footer className="footer">
        <a className="wordmark footer-wordmark" href="/">
          <span className="wordmark-icon"><ArrowDownToLine size={16} strokeWidth={2.4} /></span>
          <span>tikdown<span className="wordmark-period">.</span></span>
        </a>
        <p>Save responsibly. Respect the people who make the videos.</p>
        <span className="footer-copyright">© {new Date().getFullYear()} Tikdown</span>
      </footer>
    </main>
  );
}
