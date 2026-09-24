# Store QR validation — 2026-09-24

- Unit tests: 27/27 passed (`npm test`).
- Production build: passed (`npm run build`), including TypeScript validation and all 90 static pages. The local development server was temporarily stopped to release the Windows Prisma DLL lock.
- Lint: passed with existing Next.js image optimization warnings.
- Actual StoreQr browser regression: passed (`node scripts/test-store-qr.cjs`). Checks missing-domain gate, generation, destination link, PNG/SVG downloads, print invocation, literal shop-name rendering, opener isolation, and reset after a URL change.
- Downloaded PNG and SVG (browser-rasterized) independently decoded with OpenCV at 1200, 310 and 240 pixels: all six decoded to the exact test destination, `https://store.example.org/stores/validation-shop`. This is a test URL, not a deployed store.
- Print fixed: retain access to the new window, detach its opener, build text safely with DOM APIs, and wait for the QR image to load before printing.
- Public storefront source permits anonymous visitors; middleware restricts admin/vendor dashboards, not `/stores/:slug`. Previous slugs resolve through stored aliases.
- Local HTTP verification: `/api/stores` returned 200; an unauthenticated request to `/stores/shopift` returned 200 without a login redirect. Development server restored at `http://localhost:3000`.

## Live-device acceptance still requires deployment

The environment has `NEXTAUTH_URL=http://localhost:3000` and no `NEXT_PUBLIC_APP_URL`. A public HTTPS deployment has not been provided. No physical phone scan or production destination reachability is claimed.

After deployment, set `NEXT_PUBLIC_APP_URL` to the actual HTTPS origin, configure `NEXTAUTH_URL` consistently, rebuild/restart, generate an approved seller's QR, then scan with a phone on mobile data. It must open that seller's storefront without requiring sign-in. Repeat with a printed/downloaded QR and after a seller slug change.
