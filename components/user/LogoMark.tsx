import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import brandLogo from "@/public/logo.png";
import inverseLogo from "@/public/logo-inverse.png";
import styles from "./LogoMark.module.css";

type LogoMarkProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  withText?: boolean; // Kept for compatibility with existing consumers.
  href?: string | null;
  priority?: boolean;
};

export function LogoMark({
  className = "",
  compact = false,
  inverse = false,
  href = "/",
  priority = true,
}: LogoMarkProps) {
  const logo = (
    <span
      className={`${styles.root} ${compact ? styles.compact : ""} ${inverse ? styles.inverse : ""}`}
    >
      <Image
        src={inverse ? inverseLogo : brandLogo}
        alt="JORO.pk — Jo Chahiye, Yahin Mile!"
        sizes={inverse ? "(max-width: 639px) 150px, 176px" : compact ? "(max-width: 639px) 106px, 116px" : "(max-width: 639px) 118px, 164px"}
        priority={priority}
        className={styles.image}
      />
    </span>
  );

  const wrapperClass = `inline-flex min-w-0 shrink-0 items-center ${className}`;

  if (href === null) {
    return <div className={wrapperClass} aria-label="JORO.pk">{logo}</div>;
  }

  return (
    <Link href={href} className={wrapperClass} aria-label="JORO.pk home">
      {logo}
    </Link>
  );
}
