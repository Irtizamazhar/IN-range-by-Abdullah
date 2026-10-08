"use client";

import { Fragment, useEffect, useState } from "react";
import styles from "./HeroHeadline.module.css";

const WORDS = ["Jo", "chahiye,", "JORO", "par", "dhoondo."] as const;
const WORD_DELAY_MS = 250;
const COMPLETE_PAUSE_MS = 2500;

export function HeroHeadline() {
  const [visibleWords, setVisibleWords] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setVisibleWords(count => count === WORDS.length ? 0 : count + 1);
    }, visibleWords === WORDS.length ? COMPLETE_PAUSE_MS : WORD_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [visibleWords]);

  return (
    <h1 className={`${styles.headline} max-w-[620px] text-[38px] font-black leading-[0.98] tracking-[-0.055em] text-white sm:text-[48px] lg:text-[55px]`}>
      <span className="sr-only">{WORDS.join(" ")}</span>
      <span className={styles.words} aria-hidden="true">
        <span className={`${styles.cursor} ${styles.initialCursor}`} data-active={visibleWords === 0} />
        {WORDS.map((word, index) => (
          <Fragment key={word}>
            {index === 2 ? <br /> : index > 0 ? " " : null}
            <span
              className={`${styles.word} ${word === "JORO" ? "text-brand-primary" : ""}`}
              data-hero-word={word}
              data-visible={index < visibleWords}
            >
              {word}
              <span
                className={styles.cursor}
                data-active={visibleWords === index + 1 && visibleWords < WORDS.length}
              />
            </span>
          </Fragment>
        ))}
      </span>
    </h1>
  );
}
