# Aftermove

A private, computer-only chess coach. Enter a Chess.com username, analyze 1–15 recent completed standard games, review strengths and costly moves, and practice positions from those games.

## Run

Requires Node.js 22 or later. From this folder:

```sh
npm install
npm start
```

Open **http://127.0.0.1:5173** in a current desktop browser. Keep the terminal running; press Control-C there to stop the app. No build step or account is required. `npm test` runs the analysis regression tests and a real Stockfish smoke test.

## What the MVP does

- Loads the latest 15 completed games into a picker. Select the exact 1–15 games to analyze; saved games are marked Analyzed and can be reviewed directly. New games played after loading do not change the selected game identities. Imports are serial and limited to the most recent 24 available monthly archives. Chess.com may cache its public API, so newly finished games may take time to appear.
- Runs Stockfish 19 Lite in one browser worker, with a 32 MB hash table, a 250 ms budget per position and a short gap between moves. Other engine memory is additional. Both players’ moves are analyzed, reusing evaluations at consecutive positions. Games run sequentially, and a browser lock prevents competing analysis jobs in tabs using the same origin. Older saved games have an Analyze both sides button in review; stopping an upgrade preserves the previous saved result.
- Saves completed games in IndexedDB in your browser, keyed by account and game. Changing the selected batch does not discard previously analyzed games. Stop cancels work; a partially analyzed game is restarted when you retry.
- Shows game results, evaluation losses by phase, a relative strength, a focus area and move-by-move engine continuations. Miss labels identify passed-up winning advantages or forced mates when the resulting position stays playable (at least −0.50 pawns from the moving side). Other mistakes are 1–2 pawn evaluation drops; blunders are at least 2 pawns or allowing forced mate. Both sides receive Best/Good ratings during forced mate, with a small Forced mate context label. Misses count as costly moves separately from mistakes and blunders; progress and practice still focus on the account owner. Forced-mate changes are classified separately and excluded from pawn averages.
- Offers Fresh puzzles by default: 360 distinct Stockfish-checked Lichess puzzles in forcing mates, winning material, safe replies, and endgames. Broad theme suggestions use errors across the current username’s saved games. Only unseen positions are offered, recorded per username in browser local storage. Exhausting the library stops the sequence; Review seen puzzles explicitly opens earlier positions. Imported game positions are excluded by board/turn/rights/en-passant identity. The From your games tab selects up to 30 practice positions from mistakes with adequate search depth. Click a piece then a destination; promotion supports all four pieces. Hints, reveal, retry, and checks of alternative moves are included.

## Privacy and limitations

The server binds only to `127.0.0.1`; there are no public sign-ups, hosted services, analytics, AI API keys, or API charges. Only the Chess.com public API is contacted to import games. Analysis and saved results stay in this browser profile. Use the same URL/browser each time; clearing website data removes saved results. Public usernames and games remain public on Chess.com.

This is quick engine analysis with structured coaching, not conversational AI. Short searches can miss ideas. Ten to fifteen games are a small sample; phase summaries describe this batch rather than establish long-term skill. Opening names come from PGN metadata. Repetition history is not passed into position searches, and full tactical-theme diagnosis, spaced repetition, and account syncing are not part of this MVP. Fresh-puzzle themes are broad heuristics, and the bundled library has finite variety. Keep the tab visible for best speed; background browser throttling can slow analysis.

## Dependencies and attribution

- [chess.js](https://github.com/jhlywa/chess.js), BSD-2-Clause, for PGN parsing and legal moves.
- [Stockfish.js 19.0.1](https://github.com/nmrugg/stockfish.js/tree/v19.0.1), GPLv3, by Nathan Rugg and contributors, based on [Stockfish](https://github.com/official-stockfish/Stockfish). The app serves the unmodified lite single-threaded engine and its bundled license. Matching source is linked in the app. The npm package includes other engine builds on disk, but only the approximately 1.7 MB lite single-threaded build is loaded by the browser.

Independent project; not affiliated with or endorsed by Chess.com or Lichess. No proprietary chess-site assets are used.

## Board controls

In game review, move a piece directly on the original board to start a variation from the displayed position. **Try your own moves** also opens variation mode. Drag or click to move either side, toggle automatic engine replies, or request one engine move. Arrow keys and move chips navigate your line; playing from an earlier point replaces its later continuation. **Return to original game** restores the reviewed position. Try your idea precomputes and caches the current position’s next engine move in the background (700ms search budget); Play engine move reuses the finished result or waits for the same pending search. Show engine suggestion on the board toggles a green arrow, hidden by default. Engine replies automatically on both sides plays both colors at roughly one move per second, waiting for analysis when needed. Uncheck it, navigate, reset, or return to the game to pause. Autoplay stops at checkmate or a draw, including repetition within the variation. Suggestions update without rebuilding the board during a drag. Searches are cancelled when the position changes; cached entries are scoped to this variation and bounded to 64 positions. Variations are temporary and are not saved after leaving review.

Legal destination dots appear when you pick up a piece, with rings around captures. Accepted practice moves automatically receive one engine reply; misses and mistakes also receive a reply. You can continue playing your side afterward.

Clock annotations estimate time spent per move in supported timed games, including increment. Overview flags mistakes after at least 15 seconds and twice your median move time, requiring five timed moves in that game. Missing clocks stay unavailable. Game review offers a cancellable deeper check (two seconds before and two seconds after), saving revised evaluations and continuations. Timing does not reveal what you were thinking.

Right-click and drag between squares to draw an arrow; repeat the same arrow to remove it. Right-click a single square to circle it, or use **Clear arrows**. After trying or revealing a practice move, use the **left/right arrow keys**, board arrow buttons, or move chips to explore the continuation. Arrow keys also step backward/forward through game review. Input fields keep their normal keyboard behavior. Use **Try again from start** to reset the exercise. Coaching describes concrete captures, checks, mate/stalemate, newly controlled king squares, and the engine’s reply; it does not invent deeper strategic explanations when the line does not establish them.

The evaluation bar uses White’s perspective (+ for White, − for Black), with M for mate. It updates for the visible position and shares the existing engine lock. Left-clicking the board clears arrows and circles while retaining normal piece selection.

Practice pieces also support left-button drag-and-drop; invalid drops leave the position unchanged. After a non-preferred move, the app compares equal-budget engine searches and distinguishes good/playable alternatives, missed opportunities, mistakes, and inconclusive searches. A miss can preserve a playable position while overlooking a stronger opportunity. The opponent reply is shown automatically. Use Show solution to reveal the continuation list and replay controls; arrow keys can also inspect the line. These labels remain short-search coaching estimates, not proof of a unique best move.

Game review has a rounded two-column move panel for White and Black. Click a move to show the position after it; left/right keys step through both players’ moves. New imports retain the complete move history. Older saved games recover intervening moves from their positions; older cache entries may lack the final opponent reply.

## Private Sites hosting

The `sites/aftermove` directory contains the hosted edition, preserving its current Sites access policy. Generate its embedded Worker from current app files with `node scripts/prepare-sites.mjs`, then build and validate within that directory. The original localhost server remains available. Hosted access uses Sites authentication; Stockfish and IndexedDB still run in the browser, while the Worker fetches public Chess.com games. Hosted and localhost saved data are separate, with no automatic device sync. The local-only privacy statements above describe `npm start`.

Game-review move cells show your thinking time to one decimal place and a faint bar relative to your longest move in that game. Long-think mistakes have amber markers. The longest-think shortcut and bottom timing summary jump to their moves and expand the details. During engine searches, the previous evaluation remains visible with an updating label; it is replaced only when a valid current evaluation arrives.

## Verification coverage

`npm test` covers scoring, timing, review histories, chess continuations (including promotion/castling/en passant), real Stockfish mating/terminal positions and cancellation, drag-event regressions, storage failure reporting, and local/hosted API behavior. HTTP integration tests bind an ephemeral loopback port; restricted environments must allow local network access to run them.

The November 2, 2026 manual pass exercised both move columns and start/end navigation; original-board and variation moves; engine replies and reset during thinking; practice hints/reveal/retry; failed imports, account switching, stop and reload persistence; timing shortcuts; annotation clearing; competing tabs; and a 600px layout. This verifies the available in-app browser, not a cross-browser certification. Storage quota failures use simulated writes. The promotion chooser was not manually exercised in this pass; underlying promotion continuations are tested. Fifteen-game background stress and offline recovery are not covered by this pass. Variations reconstruct repetition within the branch, but do not include moves before its starting position.

## Progress and puzzle validation

Progress uses all cached analysis for the active username, deduplicated by game, and orders games by played date. Rapid is the default when available; formats can be filtered, and empty formats remain empty. Rates are mistakes and blunders per 100 analyzed moves, weighted by move count. An earlier/recent comparison requires at least six dated assessed games. This is a view of saved samples, not a rating or proof of improvement; deeper rechecks can revise past points. Click a game below the chart to review it.

The bundled library contains 360 distinct puzzles from the [Lichess puzzle database](https://database.lichess.org/#puzzles), released under CC0. Each has its source puzzle link. No runtime puzzle API or user data upload is involved. Run `node scripts/import-puzzles.mjs /path/to/lichess_db_puzzle.csv` to regenerate `public/puzzle-bank.js` from the official CSV. The original 120 puzzles span ratings 800–1800. Another 240 span 1400–2200, split evenly between 1400–1799 and 1800–2200, with 30 additions per broad theme in each band. All require popularity at least 80 and at least 100 plays, with one puzzle per source game. Existing puzzle IDs remain stable so seen history is preserved. Puzzle ratings are shown beside the board; these are Lichess puzzle ratings, not playing ratings. It applies the opponent’s first move before presenting the position, then verifies legal solutions and agreement with a Stockfish 19 Lite search (500ms for the original set, 750–1000ms for additions, depth at least 10). It rejects terminal/shallow/mismatched lines, forced-losing positions, unverified mating drills, and non-winning material/endgame drills. These quick local checks supplement the database analysis; they are not an exhaustive proof. `npm test` checks library legality, profile matching, imported-position exclusion, per-user unseen history, weighted progress and empty-format rendering.

To reproduce the expanded library from the CSV, build the base set and append the two rating bands:

```sh
node scripts/import-puzzles.mjs /path/to/lichess_db_puzzle.csv
node scripts/import-puzzles.mjs /path/to/lichess_db_puzzle.csv --append --min-rating=1400 --max-rating=1799 --per-theme=30 --budget=750
node scripts/import-puzzles.mjs /path/to/lichess_db_puzzle.csv --append --min-rating=1800 --max-rating=2200 --per-theme=30 --budget=1000
```

Imports write only after reaching the requested counts. `--append` keeps all existing puzzles, skips their IDs, board positions and source games, and adds the requested count per theme. Rebuilding from a newer database may select different IDs because ratings and votes change; commit and retain the bank to preserve a release’s puzzle identities.

**Play best move** appears after a sufficiently analyzed weaker move in Practice and Try your idea, including a playable alternative when another move is clearly preferred. It rewinds the latest attempted turn, removes that move and any following automatic reply, and plays the stored engine recommendation while preserving the earlier line. Equally good alternatives and uncertain searches do not offer a correction. In Practice it shows the engine reply; variations follow the existing automatic-reply setting. New manual moves, reset, navigation and leaving the variation cancel pending comparisons. Hints and solution reveals clear obsolete practice corrections.

## Compare a played move with the engine

In game review, select either player’s move and choose **Show best instead** beside the move list. The app rewinds that selected move and plays the engine suggestion in a separate variation. Use **Return to original game** to return to the selected move. If the engine chooses the original move, the comparison says it was already preferred. The saved game is never edited. **Play engine move** remains available for the position currently on the board.

## Board explanations

Game review, variations, and played practice moves show a short board-based explanation beside the board: checks, forks, undefended pieces, captures, development, castling, and promotions. Sage arrows show the move or attacking targets; muted red arrows show a legal capture against an undefended piece. Use Show idea arrows to hide them; left-click or Clear arrows dismisses them too. Initial practice positions reveal no explanation or answer arrows. These are observable board facts, not a complete strategic diagnosis or a claim that every sacrifice is bad.

## Compare a move and its alternative

After a checked practice or exploration move, the comparison cards keep **Your move** and **Best move** available from the same starting position. Selecting a card updates the board, explanation, and arrows; the navigation arrows step through that branch's engine reply. Switching cards pauses autoplay and does not count as solving a practice puzzle. Show best instead in historical review also retains the played move for comparison, including an opponent's move. Engine settings and idea arrows use rounded On/Off buttons.

Press **Space** in game review or move exploration to play the next engine move without scrolling. Holding Space does not queue extra moves; typing in fields keeps normal Space behavior. The shortcut is shown on the Play engine move buttons. Legal capture targets use the same green dots as empty destinations, above the piece artwork.

## Compact exploration workspace

Exploration uses a compact board and move list with an always-visible bottom control bar, including Idea arrows at the starting position. The list includes the original game up to the branch point and the exploration line, with correct White/Black move numbers. Click an exploration move to step through the branch; click a muted original move to return to that point in game review. Move history and longer comparison notes scroll inside their panel so the board navigation and controls stay visible on desktop. Verified at 1280×720 and 1098×720 with no page overflow.
