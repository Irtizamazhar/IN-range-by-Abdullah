import Image from "next/image";
import Link from "next/link";

export function LogoMark({
  className = "",
  compact = false,
  inverse = false,
  /** Set to `null` to render logo without a link (e.g. admin login). */
  href = "/",
}: {
  className?: string;
  withText?: boolean;
  compact?: boolean;
  inverse?: boolean;
  href?: string | null;
}) {
  const width = 300;
  const height = 80;
  const sizeClass = compact
    ? "h-9 sm:h-10"
    : "h-10 sm:h-12";

  const inner = (
    <>
      <Image
        src={inverse ? "/joro-logo-inverse.svg" : "/joro-logo.svg"}
        alt="joro.pk"
        width={width}
        height={height}
        className={`${sizeClass} w-auto shrink-0 object-contain object-left`}
        priority
      />
    </>
  );

  const wrapClass = `flex items-center gap-2 min-w-0 ${className}`;

  if (href == null) {
    return <div className={wrapClass}>{inner}</div>;
  }

  return (
    <Link href={href} className={wrapClass}>
      {inner}
    </Link>
  );
}
