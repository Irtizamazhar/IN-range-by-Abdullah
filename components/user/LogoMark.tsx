import Image from "next/image";
import Link from "next/link";

export function LogoMark({
  className = "",
  withText = false,
  compact = false,
  /** Set to `null` to render logo without a link (e.g. admin login). */
  href = "/",
}: {
  className?: string;
  withText?: boolean;
  compact?: boolean;
  href?: string | null;
}) {
  const width = compact ? 152 : 216;
  const height = compact ? 91 : 130;
  const sizeClass = compact
    ? "h-12 max-h-12 sm:h-14 sm:max-h-14"
    : "h-14 sm:h-16 md:h-[4.25rem] max-h-[4.25rem]";

  const inner = (
    <>
      <Image
        src="/logo.png"
        alt="In Range By Abdullah"
        width={width}
        height={height}
        className={`${sizeClass} w-auto shrink-0 object-contain object-left`}
        priority
      />
      {withText && (
        <span className="leading-tight text-left hidden sm:block min-w-0">
          <span className="text-primaryBlue font-bold text-sm md:text-base block">
            In Range By
          </span>
          <span className="text-primaryYellow font-extrabold text-sm md:text-base tracking-wide block">
            ABDULLAH
          </span>
        </span>
      )}
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
