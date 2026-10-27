# Proof: real code build (Astro + Tailwind), sample roofing home page

Built 2026-10-27 to test the "real code build" decision. Same chapter cards and words as the engine sample. This is reference material for the house starter kit and the build runner; it is not part of the app.

- `src/bundle/site.json`: the build bundle (business, DNA, chapter words). The page reads only from this.
- `src/styles/site.css`: style numbers as Tailwind v4 `@theme` tokens (ink, asphalt, rain, mist, cloud, teal; Archivo expanded display, Atkinson Hyperlegible body; one easing curve).
- `src/components/RoofScene.astro`: the signature hero (standing-seam roof, three rain depth layers, off for reduced motion).
- `src/components/Material.astro`: service material swatches (shingle, seam, gutter).
- `src/pages/index.astro`: the page.

Run: `npm install astro@5 tailwindcss@4 @tailwindcss/vite@4 @fontsource-variable/archivo @fontsource/atkinson-hyperlegible`, then `npx astro build`. Output: about 388 KB including fonts. One h1, every link named, focus visible, reduced motion respected.

Screenshots: `proof-desk.png`, `proof-phone-top.png`.
