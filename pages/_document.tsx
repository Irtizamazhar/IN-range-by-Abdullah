import { Html, Head, Main, NextScript } from "next/document";

/**
 * App Router is primary (`app/`). This file exists so dev HMR does not look for a
 * missing `.next/server/pages/_document.js` (Windows cache / hybrid tooling).
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
