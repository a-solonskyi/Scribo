# Skribo favicon and link-preview options

Five independent favicon directions (F1–F5) and five link-preview directions (P1–P5). **Selected: F5 — Draft lines + P2 — Ink.** The selected files have been copied into `public/` and wired into `app/layout.tsx`.

Favicons are editable SVGs with no font dependencies, with PNG exports at 16, 32, 64, 180, and 512 pixels. Link previews are 1200 × 630 PNGs with editable SVG sources. Preview SVG typography uses Georgia and Arial; use the PNG exports for consistent sharing. All assets follow the current monochrome identity, phonetic wordmark, and writing/feedback features.

| Favicon | Direction |
| --- | --- |
| F1 — Open brackets | A sharper version of the existing brackets |
| F2 — Ink tile | White brackets in a compact black tile; recommended |
| F3 — Ink S | A flowing initial |
| F4 — Writing cursor | Brackets framing an insertion cursor |
| F5 — Draft lines | Writing lines with an unfinished last line |

| Preview | Direction |
| --- | --- |
| P1 — Editorial | Current motto, generous whitespace; recommended |
| P2 — Ink | A dark typographic card |
| P3 — Process | Write / Replay / Respond illustrated schematically |
| P4 — Margin notes | Feedback-inspired editorial composition |
| P5 — Signature | Skribo name with phonetic pronunciation |

Previews P3 and P4 are conceptual illustrations, not product screenshots or real user data. The favicon and preview can be selected independently.

Regenerate assets from the project root with `node artifacts/brand-options/build.mjs`. `options.json` embeds preview images for the in-conversation comparison.

The selected favicon is available as `/icon.svg`, with 16px and 32px PNG fallbacks and a 180px Apple touch icon. The selected link preview is `/og.png`. Metadata uses “Skribo”, the Ink preview copy, descriptive image alt text, and the site's production origin so social-image URLs are absolute.

Published as Sites version 24 on September 18, 2026 (Europe/Kiev): https://skribo-essay.andriisolonskyi.chatgpt.site. The release was based on live version 23 and contains only the six branding files. Source commit: `c761ebb5562d9c83cd77126366f641b914b37ff4`. Deployment: `appgdep_6aac56ec41248191a084a118a82d369d`. Verified HTTP 200 responses, rendered social metadata, and exact file matches for all five public image assets.

Visible branding was standardized to **Skribo** in Sites version 25 on September 18, 2026. Source commit: `de9ee6eb6b454c4f034327b5a2f8ce4625dba8f9`. Deployment: `appgdep_6aad11aa42f0819190d2c8086b3e4415`. The release was based on live version 24 and changes only branding text and `public/og.png`; existing URLs, internal identifiers, application logic, and stored data remain unchanged. Build and rendered home/policy-page checks passed.
