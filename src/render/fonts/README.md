# Bundled typography

Unmodified Latin WOFF2 subsets downloaded from Google Fonts on 2026-11-11:

- [Manrope](https://fonts.google.com/specimen/Manrope), variable normal 400–700. License: `Manrope-OFL.txt`.
- [Playfair Display SC](https://fonts.google.com/specimen/Playfair+Display+SC), normal 700 (downloaded 2026-11-13). Only the legacy scene route (`src/render/styles.css`) uses it now; Drawing pages set titles in Manrope (`references/look.md`). License: `PlayfairDisplaySC-OFL.txt`.
- [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono), normal 500. License: `IBMPlexMono-OFL.txt`.

The CSS aliases are `Visualize Sans`, `Visualize Mono` and `Visualize Display`. Full copyright and reserved-name notices are retained in the license files. Subsets cover the Latin UI used by these examples; other scripts use the declared system fallbacks. The build embeds both assets as data URLs; it does not call a font service at runtime. Consumers importing `styles.css` can let their CSS bundler handle the local WOFF2 URLs.
