# JORO logo replacement — 2026-10-08

The supplied transparent logo is stored unchanged at `public/branding/joro-logo.png` (906 × 301). Its SHA-256 is `1690064fdfc2b6248809f2c952bba191ba3b4e2eb763217fe8bc6a02cefe18a2`.

`LogoMark` imports this asset for customer, admin and vendor screens. Static imports give the logo and updated auth artwork content-based filenames, avoiding stale image caches. The product fallback and legacy PNG/SVG URLs use the same artwork. Browser icons were converted from the supplied image. The unused historical `public/logo1.png` is preserved as required by the existing implementation notes; it is not displayed by the website.

Only the printed branding in these decorative assets was edited using the built-in imagegen tool (no CLI/API fallback):

- `public/branding/auth/auth-parcel-stack.png`
- `public/branding/auth/auth-mobile-marketplace.png`
- `public/branding/auth/auth-shopping-bag.png`

All three remain 1254 × 1254 transparent PNGs. The shared website logo itself was not generated or redrawn.

## Imagegen prompts

### Parcel stack

Use case: compositing. Asset type: existing transparent parcel stack artwork for a marketplace login page. Input image 1 is the edit target; input image 2 is the exact replacement logo. Replace ONLY every old printed JORO logo in image 1 with the green-and-gold Joro.pk shopping-cart logo from image 2, preserving the reference logo design, Pakistan crescent-and-star shopping bag, lettering and colors. Match the existing prints' size, placement, material texture and perspective on each box. There are four visible old logo prints: the upper brown box face, the front large brown box face, the right face of the large green box, and the right face of the foreground brown box. Replace all four. Preserve the parcels, their positions, shapes, edges, textures, lighting, all non-logo symbols, Pakistan flag, and all existing tagline/script text exactly as in input image 1. Keep the original composition, camera framing and actual transparent alpha background. Do not add objects, crop, redesign the supplied logo, or leave any old black/lime shield-cart JORO marks. Return the edited target artwork only.

### Phone

Use case: precise-object-edit. Asset type: transparent website authentication illustration. Image 1 is the edit target: a tilted black smartphone showing a marketplace UI. Image 2 is the exact replacement logo: glossy green and gold Joro.pk shopping cart with Pakistani crescent and star. Replace ONLY the old lime-green and silver JORO.pk logo near the top of the smartphone screen with the supplied image 2 logo, matching the screen's perspective and keeping the logo within the same area. Keep existing tagline APNI MARKET • APNI CHOICE beneath it unchanged. Preserve the phone, its position, full frame and canvas composition, screen UI, all text, colors, product cards and objects exactly. Keep actual transparent background. Do not add a black background or extra objects. Match the reference logo faithfully including its green and gold coloring; do not retain the old lime and silver logo.

### Shopping bag

Use case: precise-object-edit. Asset type: transparent website authentication illustration. Image 1 is the edit target: dark green shopping bag with tan rope handles. Image 2 is the exact replacement logo: glossy green and gold Joro.pk shopping cart with Pakistani crescent and star. Replace ONLY the old lime-green and silver JORO.pk logo on the front of the bag with the supplied image 2 logo, matching the bag face perspective and keeping the logo within the same area. Keep existing white tagline APNI MARKET • APNI CHOICE beneath it unchanged. Preserve the bag, rope handles, eyelets, materials, colors, shadows, folds, position, full frame and canvas composition exactly. Keep actual transparent background. Do not add a black background or extra objects. Match the reference logo faithfully including its green and gold coloring; do not retain the old lime and silver logo.

## Validation

- TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- Local home, login and admin login routes returned HTTP 200 and rendered the new logo.
- The four fingerprinted logo/artwork URLs served bytes identical to their final source PNGs.
- Browser SVG and ICO routes returned HTTP 200.
- Updated artwork was visually inspected. Live browser layout inspection was unavailable because no connected browser was available.
- Changes are local to this checkout; no production deployment was performed.
