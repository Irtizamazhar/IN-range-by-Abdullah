import type { AppProps } from "next/app";

/** Required companion to `_document` when the `pages` runtime is compiled. */
export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
