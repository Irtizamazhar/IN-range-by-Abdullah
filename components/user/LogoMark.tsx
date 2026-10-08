import Image from "next/image";
import Link from "@/components/ui/LoadingLink";
import brandLogo from "@/public/branding/joro-logo.png";

type LogoMarkProps = {
  className?: string;
  compact?: boolean;
  inverse?: boolean;
  withText?: boolean;

  /**
   * Set href={null} when logo should not be clickable.
   * Otherwise it links to homepage.
   */
  href?: string | null;
};

export function LogoMark({
  className = "",
  compact = false,
  inverse = false,
  href = "/",
}: LogoMarkProps) {
  const logo = (
    <div
      className={`
        joro-image-logo
        ${compact ? "joro-image-logo--compact" : ""}
        ${inverse ? "joro-image-logo--inverse" : ""}
      `}
    >
      {/* Soft lime glow */}
      <span
        className="joro-image-logo__glow"
        aria-hidden="true"
      />

      {/* Actual transparent PNG */}
      <Image
        src={brandLogo}
        alt="JORO.pk"
        sizes={compact ? "115px" : "138px"}
        priority
        className="
          joro-image-logo__image
          relative
          z-10
          h-auto
          w-auto
          object-contain
        "
      />

      {/* Premium moving shine */}
      <span
        className="joro-image-logo__shine"
        aria-hidden="true"
      />
    </div>
  );

  const wrapperClass = `
    inline-flex
    min-w-0
    shrink-0
    items-center
    ${className}
  `;

  if (href === null) {
    return (
      <div
        className={wrapperClass}
        aria-label="JORO"
      >
        {logo}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={wrapperClass}
      aria-label="JORO Home"
    >
      {logo}
    </Link>
  );
}
