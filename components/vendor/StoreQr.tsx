"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LoadingButton } from "@/components/ui/LoadingButton";
import styles from "./StoreQr.module.css";

const logoPath = "/branding/joro-logo.png";
const qrOptions = { width: 680, margin: 4, errorCorrectionLevel: "H" as const, color: { dark: "#000000", light: "#ffffff" } };

function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, initial: number, min: number) {
  let size = initial;
  do { ctx.font = `700 ${size}px Arial, sans-serif`; if (ctx.measureText(text).width <= maxWidth) break; size -= 2; } while (size > min);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the QR card artwork."));
    image.src = src;
  });
}

/** Export at 1200 × 1800 pixels. The QR includes a four module quiet zone. */
export async function renderStoreQrCard(url: string, name: string, qrDataUrl: string): Promise<HTMLCanvasElement> {
  const [logo, qr] = await Promise.all([loadImage(logoPath), loadImage(qrDataUrl)]);
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 1800;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  const glow = ctx.createRadialGradient(600, 850, 100, 600, 850, 1000);
  glow.addColorStop(0, "#ffffff"); glow.addColorStop(1, "#e6f4ee");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, 1200, 1800);
  ctx.fillStyle = "#005754";
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(395, 0); ctx.bezierCurveTo(240, 65, 125, 245, 0, 320); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#91d500";
  ctx.beginPath(); ctx.moveTo(325, 0); ctx.lineTo(385, 0); ctx.bezierCurveTo(225, 70, 110, 205, 0, 300); ctx.lineTo(0, 280); ctx.bezierCurveTo(120, 190, 220, 70, 325, 0); ctx.fill();
  ctx.fillStyle = "#dcefe8";
  ctx.beginPath(); ctx.ellipse(1160, 280, 155, 300, -.65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#b7e895";
  ctx.beginPath(); ctx.ellipse(1200, 510, 100, 200, .7, 0, Math.PI * 2); ctx.fill();
  const logoWidth = 555;
  const markHeight = Math.round(logo.height * .64);
  ctx.drawImage(logo, 0, 0, logo.width, markHeight, (1200 - logoWidth) / 2, 92, logoWidth, logoWidth * markHeight / logo.width);
  ctx.textAlign = "center"; ctx.font = "700 49px Arial, sans-serif";
  ctx.fillStyle = "#063a39"; ctx.fillText("Jo Chahiye,", 474, 355);
  ctx.fillStyle = "#64b900"; ctx.fillText("Yahin Mile!", 783, 355);
  ctx.fillStyle = "#edf7f4"; rounded(ctx, 125, 430, 950, 170, 38); ctx.fill();
  fitText(ctx, name, 875, 72, 30);
  ctx.fillStyle = "#053c3b"; ctx.fillText(name, 600, 535, 875);
  ctx.fillStyle = "#76c600"; rounded(ctx, 520, 565, 160, 7, 4); ctx.fill();
  const border = ctx.createLinearGradient(240, 640, 960, 1390);
  border.addColorStop(0, "#005b58"); border.addColorStop(.5, "#9cdd00"); border.addColorStop(1, "#00625b");
  ctx.fillStyle = border; rounded(ctx, 205, 640, 790, 790, 68); ctx.fill();
  ctx.fillStyle = "#ffffff"; rounded(ctx, 218, 653, 764, 764, 56); ctx.fill();
  ctx.drawImage(qr, 260, 695, 680, 680);
  ctx.fillStyle = "#ffffff"; rounded(ctx, 105, 1480, 990, 120, 60); ctx.fill();
  ctx.strokeStyle = "#d2e4df"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#e6f0ed"; rounded(ctx, 130, 1500, 80, 80, 40); ctx.fill();
  ctx.strokeStyle = "#064b49"; ctx.lineWidth = 9; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(155, 1550); ctx.lineTo(182, 1523); ctx.moveTo(158, 1527); ctx.lineTo(145, 1540); ctx.moveTo(180, 1549); ctx.lineTo(169, 1560); ctx.stroke();
  const displayUrl = url.replace(/^https:\/\//, "");
  fitText(ctx, displayUrl, 810, 39, 22);
  ctx.fillStyle = "#083b3b"; ctx.textAlign = "left"; ctx.fillText(displayUrl, 245, 1555, 810);
  ctx.fillStyle = "#91d500";
  ctx.beginPath(); ctx.moveTo(0, 1650); ctx.bezierCurveTo(320, 1840, 780, 1700, 1200, 1610); ctx.lineTo(1200, 1800); ctx.lineTo(0, 1800); ctx.fill();
  ctx.fillStyle = "#00615b";
  ctx.beginPath(); ctx.moveTo(0, 1695); ctx.bezierCurveTo(360, 1765, 720, 1765, 1200, 1660); ctx.lineTo(1200, 1800); ctx.lineTo(0, 1800); ctx.fill();
  return canvas;
}

export function StoreQr({ url, name }: { url: string | null; name: string }) {
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let current = true;
    setQrDataUrl(""); setError("");
    if (url) QRCode.toDataURL(url, qrOptions).then(data => { if (current) setQrDataUrl(data); }).catch(() => { if (current) setError("Could not generate the store QR code."); });
    return () => { current = false; };
  }, [url]);
  async function copyLink() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setNotice("Store link copied."); setError(""); }
    catch { setError("Could not copy the link. Select the address on the card to copy it manually."); }
  }
  async function downloadPng() {
    if (!url || !qrDataUrl) return;
    try {
      const canvas = await renderStoreQrCard(url, name, qrDataUrl);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("PNG export failed.");
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl; link.download = `joro-store-${url.split("/").pop()}-qr-card.png`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice("QR card downloaded."); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download the QR card."); }
  }
  async function shareLink() {
    if (!url) return;
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); setNotice("Store link shared."); }
      else await copyLink();
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      await copyLink();
    }
  }
  return <section className={styles.section} aria-labelledby="store-qr-title">
    <div className={styles.heading}><h2 id="store-qr-title">Store QR code</h2><p>Share your public storefront with customers.</p></div>
    {!url ? <p className={styles.unavailable}>Your store QR is available after your store is approved.</p> : <>
      <div className={styles.card} aria-label={`QR card for ${name}`}>
        <div className={styles.topWave} aria-hidden="true" />
        <div className={styles.logoBlock}><div className={styles.logoCrop}><img src={logoPath} alt="JORO" /></div><p>Jo Chahiye, <span>Yahin Mile!</span></p></div>
        <div className={styles.name}>{name}</div>
        <div className={styles.qrBorder}>{qrDataUrl ? <img src={qrDataUrl} alt={`QR code opening ${url}`} /> : <span role="status">Generating QR code…</span>}</div>
        <div className={styles.linkBar}><span aria-hidden="true">↗</span><span className={styles.linkText}>{url.replace(/^https:\/\//, "")}</span></div>
        <div className={styles.bottomWave} aria-hidden="true" />
      </div>
      <div className={styles.actions}>
        <LoadingButton type="button" disabled={!qrDataUrl} onClick={downloadPng} className={styles.primary}>Download QR Card PNG</LoadingButton>
        <LoadingButton type="button" onClick={copyLink}>Copy Store Link</LoadingButton>
        <a href={url} target="_blank" rel="noopener noreferrer">Visit Store</a>
        <LoadingButton type="button" onClick={shareLink}>Share Store Link</LoadingButton>
      </div>
      <p className={styles.feedback} role="status">{notice}</p>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </>}
  </section>;
}
