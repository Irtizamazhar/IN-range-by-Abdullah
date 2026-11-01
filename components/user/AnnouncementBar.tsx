"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import styles from "./AnnouncementBar.module.css";

export function AnnouncementBar() {
  const [happy, setHappy] = useState(false);
  const [celebration, setCelebration] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  function celebrate() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(timer.current);
    setHappy(true);
    setCelebration(value => value + 1);
    timer.current = setTimeout(() => setHappy(false), 1450);
  }
  return <div className={styles.space}>
    <section className={styles.bar + (happy ? " " + styles["is-happy"] : "")} role="button" tabIndex={0}
      aria-label="Welcome to JORO! Activate a happy celebration" onClick={celebrate}
      onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); celebrate(); } }}>

<div className={styles["texture"]}></div><div className={styles["beams"]}></div><div className={styles["floor-glow"]}></div>
<svg className={styles["trail"]} viewBox="0 0 1000 145" preserveAspectRatio="none" aria-hidden="true"><path d="M 5,117 C 170,120 175,14 335,66 S 600,133 703,58 S 854,65 995,18" /></svg>
<span className={styles["glimmer"] + " " + styles["g1"]}></span><span className={styles["glimmer"] + " " + styles["g2"]}></span><span className={styles["glimmer"] + " " + styles["g3"]}></span><span className={styles["glimmer"] + " " + styles["g4"]}></span><span className={styles["glimmer"] + " " + styles["g5"]}></span><span className={styles["glimmer"] + " " + styles["g6"]}></span>

<div className={styles["character"] + " " + styles["bag"]} aria-hidden="true"><svg viewBox="0 0 110 120"><defs><linearGradient id="bagFill" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#f1ff9c"/><stop offset=".5" stopColor="#a8e631"/><stop offset="1" stopColor="#54a92b"/></linearGradient></defs><ellipse cx="53" cy="113" rx="37" ry="5" fill="#061e13" opacity=".45"/><path d="M34 40V27C34 3 77 3 77 27v13" stroke="#f2ffcc" strokeWidth="8" strokeLinecap="round" fill="none"/><g className={styles["arm-left"]}><path d="M21 70C8 67 8 54 3 52" stroke="#a9e845" strokeWidth="9" strokeLinecap="round" fill="none"/><circle cx="4" cy="49" r="6" fill="#e1ff87"/></g><g className={styles["arm-right"]}><path d="M89 68q13-5 16-23" stroke="#a9e845" strokeWidth="9" strokeLinecap="round" fill="none"/><circle cx="104" cy="43" r="6" fill="#e1ff87"/></g><path d="M22 40 88 40 95 104 25 104Z" fill="url(#bagFill)" stroke="#f3ffaf" strokeWidth="2"/><path d="M88 40 98 46 103 98 95 104Z" fill="#428927"/><path d="M30 104v8m43-8v8" stroke="#a9e845" strokeWidth="8" strokeLinecap="round"/><g className={styles["eyes"]} fill="#163a26"><ellipse cx="45" cy="74" rx="4.5" ry="6"/><ellipse cx="70" cy="74" rx="4.5" ry="6"/><circle cx="46" cy="72" r="1.4" fill="white"/><circle cx="71" cy="72" r="1.4" fill="white"/></g><path className={styles["mouth-normal"]} d="M48 87Q58 97 68 87" fill="none" stroke="#194126" strokeWidth="3.5" strokeLinecap="round"/><path className={styles["mouth-happy"]} d="M46 86Q58 106 71 86Z" fill="#1b4929"/><ellipse cx="35" cy="86" rx="6" ry="3.5" fill="#f68d9e" opacity=".85"/><ellipse cx="80" cy="86" rx="6" ry="3.5" fill="#f68d9e" opacity=".85"/></svg></div>
<div className={styles["headline"]}><span className={styles["words"]}>Welcome to</span><span className={styles["brand"]}>JORO!</span></div>

<div className={styles["character"] + " " + styles["gift"]} aria-hidden="true"><svg viewBox="0 0 110 120"><defs><linearGradient id="giftFill" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#fffbc0"/><stop offset=".55" stopColor="#ffdd76"/><stop offset="1" stopColor="#eea34f"/></linearGradient></defs><ellipse cx="56" cy="114" rx="36" ry="5" fill="#061e13" opacity=".45"/><path d="M56 39C29 43 24 21 36 14S55 29 56 39C58 13 81 7 87 20S72 41 56 39" stroke="#bdf36d" strokeWidth="8" strokeLinecap="round" fill="none"/><g className={styles["arm-left"]}><path d="M21 74Q10 74 6 59" stroke="#ffd470" strokeWidth="8" strokeLinecap="round" fill="none"/><circle cx="6" cy="57" r="5.5" fill="#ffea91"/></g><g className={styles["arm-right"]}><path d="M92 73q11-7 13-20" stroke="#ffd470" strokeWidth="8" strokeLinecap="round" fill="none"/><circle cx="105" cy="50" r="5.5" fill="#ffea91"/></g><rect x="20" y="55" width="73" height="49" rx="5" fill="url(#giftFill)"/><rect x="16" y="41" width="81" height="20" rx="5" fill="#ffe99e"/><rect x="49" y="41" width="16" height="63" fill="#70c73a"/><path d="M21 61h71" stroke="#e6ae48" strokeWidth="2"/><path d="M36 103v9m39-9v9" stroke="#ffdc76" strokeWidth="8" strokeLinecap="round"/><g className={styles["eyes"]} fill="#5e3a20"><ellipse cx="38" cy="80" rx="4" ry="5"/><ellipse cx="76" cy="80" rx="4" ry="5"/><circle cx="39" cy="78" r="1.3" fill="white"/><circle cx="77" cy="78" r="1.3" fill="white"/></g><path className={styles["mouth-normal"]} d="M48 91q10 9 19 0" stroke="#603c1f" strokeWidth="3" strokeLinecap="round" fill="none"/><path className={styles["mouth-happy"]} d="M47 88q10 18 22 0Z" fill="#613e22"/><ellipse cx="28" cy="88" rx="6" ry="3" fill="#ee8b88"/><ellipse cx="85" cy="88" rx="6" ry="3" fill="#ee8b88"/></svg></div>
<span className={styles["joy"] + " " + styles["one"]} aria-hidden="true">♥</span><span className={styles["joy"] + " " + styles["two"]} aria-hidden="true">✦</span><span className={styles["joy"] + " " + styles["three"]} aria-hidden="true">♥</span>
      {happy && Array.from({ length: 26 }, (_, index) => <span key={celebration + "-" + index} aria-hidden="true" className={styles["celebrate-spark"]} style={{
        "--c": ["#d8ff60", "#fff6a4", "#ffbc75", "#b4ffe9", "#ffffff", "#8eea55"][index % 6],
        "--x": ((index / 25 - .5) * 80) + "vw", "--y": ((index % 5 - 2) * 4) + "px",
        "--r": (index * 25 - 325) + "deg", "--delay": (index % 7 * 20) + "ms",
      } as CSSProperties} />)}
    </section>
  </div>;
}
