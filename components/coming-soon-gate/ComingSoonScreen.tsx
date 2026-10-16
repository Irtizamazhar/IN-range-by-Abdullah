"use client";

import Image from "next/image";
import { Lock } from "lucide-react";
import { useState } from "react";

import brandLogo from "@/public/logo.png";

import { GateLoginModal } from "./GateLoginModal";
import styles from "./ComingSoonGate.module.css";

const READY_PERCENT = 80;

function gearPath(cx: number, cy: number, teeth: number, outer: number, inner: number) {
  const step = (Math.PI * 2) / teeth;
  const points: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const angles = [a, a + step * 0.12, a + step * 0.38, a + step * 0.5, a + step * 0.62, a + step * 0.88];
    const radii = [inner, outer, outer, outer, inner, inner];
    angles.forEach((angle, index) => {
      const r = radii[index];
      points.push(`${(cx + r * Math.cos(angle)).toFixed(2)} ${(cy + r * Math.sin(angle)).toFixed(2)}`);
    });
  }
  return `M${points.join("L")}Z`;
}

const LARGE_GEAR = gearPath(94, 80, 12, 58, 47);
const SMALL_GEAR = gearPath(169, 68, 9, 34, 26);
const TINY_GEAR = gearPath(164, 125, 8, 22, 16);

function GearsIllustration() {
  return (
    <svg className={styles.gears} viewBox="0 0 220 160" aria-hidden="true">
      <defs>
        <linearGradient id="joro-cs-gear-green" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#005235" />
          <stop offset="0.6" stopColor="#008F3B" />
          <stop offset="1" stopColor="#B7E33A" />
        </linearGradient>
        <linearGradient id="joro-cs-gear-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6D365" />
          <stop offset="1" stopColor="#C99A1E" />
        </linearGradient>
      </defs>

      {/* Large gear */}
      <g className={styles.gearLarge}>
        <path fill="url(#joro-cs-gear-green)" d={LARGE_GEAR} />
        <circle cx="94" cy="80" r="30" fill="none" stroke="#F7F8F2" strokeOpacity="0.22" strokeWidth="2" />
        <circle cx="94" cy="80" r="17" fill="#F7F8F2" />
        <circle cx="94" cy="80" r="7" fill="url(#joro-cs-gear-gold)" />
      </g>

      {/* Small gear */}
      <g className={styles.gearSmall}>
        <path fill="url(#joro-cs-gear-gold)" d={SMALL_GEAR} />
        <circle cx="169" cy="68" r="10" fill="#F7F8F2" />
        <circle cx="169" cy="68" r="4" fill="#123D27" />
      </g>

      {/* Tiny gear */}
      <g className={styles.gearTiny}>
        <path fill="#111111" d={TINY_GEAR} />
        <circle cx="164" cy="125" r="7" fill="#B7E33A" />
      </g>
    </svg>
  );
}

export function ComingSoonScreen() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className={styles.overlay}>
      <div className={styles.screen}>
        <div className={styles.glowA} aria-hidden="true" />
        <div className={styles.glowB} aria-hidden="true" />
        <div className={styles.gridPattern} aria-hidden="true" />

        <main className={styles.content} aria-labelledby="joro-cs-heading">
          <div className={`${styles.reveal} ${styles.delay1}`}>
            <Image
              src={brandLogo}
              alt="JORO.pk — Jo Chahiye, Yahin Mile!"
              className={styles.logo}
              priority
            />
          </div>

          <div className={`${styles.badge} ${styles.reveal} ${styles.delay2}`}>
            <span className={styles.badgeDot} />
            Private Launch
          </div>

          <div className={`${styles.reveal} ${styles.delay2}`}>
            <GearsIllustration />
          </div>

          <h1 id="joro-cs-heading" className={`${styles.heading} ${styles.reveal} ${styles.delay3}`}>
            Coming <span className={styles.headingAccent}>Soon</span>
          </h1>

          <p className={`${styles.message} ${styles.reveal} ${styles.delay3}`}>
            We&apos;re working on something exciting. Stay tuned!
          </p>

          <div className={`${styles.progress} ${styles.reveal} ${styles.delay4}`}>
            <div className={styles.progressMeta}>
              <span>Website is {READY_PERCENT}% ready</span>
              <span className={styles.progressValue}>{READY_PERCENT}%</span>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={READY_PERCENT}
              aria-label="Website build progress"
            >
              <div
                className={styles.progressFill}
                style={{ "--joro-cs-progress": `${READY_PERCENT}%` } as React.CSSProperties}
              />
            </div>
          </div>
        </main>

        <footer className={`${styles.footer} ${styles.reveal} ${styles.delay5}`}>
          <p className={styles.footerNote}>© {new Date().getFullYear()} JORO.pk · Pakistan Marketplace</p>
          <button
            type="button"
            id="joro-cs-team-login"
            className={styles.teamLoginButton}
            onClick={() => setModalOpen(true)}
          >
            <Lock className={styles.teamLoginIcon} aria-hidden="true" />
            Team Access
          </button>
        </footer>

        {modalOpen && <GateLoginModal onClose={() => setModalOpen(false)} />}
      </div>
    </div>
  );
}
