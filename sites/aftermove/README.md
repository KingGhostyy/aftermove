# Aftermove

Restricted-access chess coaching Site. Stockfish and saved analysis run in the visitor's browser; only public Chess.com game imports use the hosted server. No user analysis, browser storage, API keys, or credentials are bundled here.

`worker/index.js` embeds the app, chess.js, Stockfish Lite JavaScript/WASM and GPL license. It was generated from the local Aftermove project using `scripts/prepare-sites.mjs` in that project. Regenerate it there when updating the app, then run `npm run build` and `npm run validate` in this directory before publication.

Preserve the Site’s current access policy unless its owner explicitly changes access. Browser data is separate from the localhost app and is not synced between devices.

Stockfish.js: https://github.com/nmrugg/stockfish.js/tree/v19.0.1 (GPLv3). Matching license is served at /licenses/stockfish. chess.js: https://github.com/jhlywa/chess.js (BSD-2-Clause).
