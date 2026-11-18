// Crimewave entry packager.
// Hands the game in as the bounty expects: game/ (static files) and screenshots/ (renders) copied next to a
// dossier.json. Run with `node main.ts`; no build step, Node's standard library plus the vendored helper only.
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// Where this file lives is where game/ and screenshots/ are read from, wherever the shell is standing.
const here = dirname(fileURLToPath(import.meta.url));

// The grader supplies MAKEFUN_OUTPUT_DIR; without it the contract says /output.
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Copy one folder of the entry into the output, replacing any stale copy so reruns never mix old and new files.
function publishFolder(name: string): void {
  const from = join(here, name);
  const to = join(outDir, name);
  if (!existsSync(from)) {
    throw new Error(`missing ${name}/ beside main.ts (${from})`);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
publishFolder('game');
publishFolder('screenshots');

// The scorer's caps, as documented in the header of vendor/makefun-game.ts. Only text_max_bytes changes the
// bytes of the dossier; the rest make this program fail here exactly where the scorer would refuse the entry.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

// The dossier is derived from the copies in the output directory, which is what the scorer reads too.
writeFileSync(join(outDir, 'dossier.json'), buildDossier(outDir, caps));
console.log(`entry written to ${outDir}`);
