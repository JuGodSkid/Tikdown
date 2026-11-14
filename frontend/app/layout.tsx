import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tikdown | Save TikTok videos",
  description: "Download TikTok videos in the best source quality available.",
  applicationName: "Tikdown",
};

export const viewport: Viewport = {
  themeColor: "#f3f6f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
