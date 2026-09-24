import { Noto_Nastaliq_Urdu } from "next/font/google";

const urduTaglineFont = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  weight: "700",
  display: "swap",
});

export function BrandTagline({ inverse = false }: { inverse?: boolean }) {
  return (
    <p
      lang="ur"
      dir="rtl"
      className={`${urduTaglineFont.className} joro-header-tagline${inverse ? " joro-header-tagline--inverse" : ""}`}
    >
      <span className="sr-only">اپنی مارکیٹ • اپنی پسند</span>
      <span aria-hidden="true" className="joro-header-tagline__visual">
        <span>اپنی مارکیٹ</span>
        <span className="joro-header-tagline__diamond" />
        <span>اپنی پسند</span>
      </span>
    </p>
  );
}
