// Compatibility entry point. Requires the official Lichess puzzle CSV path.
// Example: node scripts/build-puzzles.mjs /path/to/lichess_db_puzzle.csv
if(!process.argv[2])throw new Error('Provide the official Lichess puzzle CSV path. See README.md.');
await import('./import-puzzles.mjs');
