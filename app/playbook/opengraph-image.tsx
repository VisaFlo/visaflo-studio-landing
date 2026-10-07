import { readFile } from "node:fs/promises"
import path from "node:path"
import { ImageResponse } from "next/og"

export const alt = "VisaFlo Studio Video Playbook: 50 channels, 7,558 videos, 9 video formats. Available on studio.visaflo.ca."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default async function Image() {
  const [bold, serif] = await Promise.all([
    readFile(path.join(process.cwd(), "assets/fonts/GeistBold.ttf")),
    readFile(path.join(process.cwd(), "assets/fonts/Newsreader.ttf")),
  ])
  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#1c1b18", color: "#faf9f6", padding: "44px 64px", fontFamily: "Geist", position: "relative" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: "Newsreader", fontSize: 36 }}>VisaFlo</span>
        <span style={{ fontFamily: "Newsreader", fontSize: 23, border: "1px solid #faf9f6", padding: "3px 8px" }}>Studio</span>
        <span style={{ fontSize: 15, marginLeft: 18, color: "#b9b5ac" }}>OCTOBER 2026</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", fontSize: 80, lineHeight: 1.07, fontWeight: 700, marginTop: 55, letterSpacing: "-2px" }}>
        <span>50 channels.</span><span>7,558 videos.</span><span>9 video formats.</span>
      </div>
      <div style={{ display: "flex", fontSize: 22, marginTop: 25, color: "#dddad3" }}>The free video playbook for immigration lawyers and RCICs.</div>
      <div style={{ display: "flex", position: "absolute", bottom: 40, left: 64, fontSize: 19 }}>Available on studio.visaflo.ca</div>
    </div>,
    { ...size, fonts: [
      { name: "Geist", data: bold.buffer.slice(bold.byteOffset, bold.byteOffset + bold.byteLength) as ArrayBuffer, weight: 700, style: "normal" },
      { name: "Newsreader", data: serif.buffer.slice(serif.byteOffset, serif.byteOffset + serif.byteLength) as ArrayBuffer, weight: 400, style: "normal" },
    ] },
  )
}
