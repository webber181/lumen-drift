// Hands in LUMEN DRIFT: stages the playable game and its screenshots in the output
// directory, then writes the dossier the judge reads.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output. Run `node serve.ts` to play the
// game locally from game/ without any build step.
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The limits the dossier builder enforces on this entry. */
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const root = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function stage(folder: string): void {
  cpSync(join(root, folder), join(outputDir, folder), { recursive: true });
}

mkdirSync(outputDir, { recursive: true });
stage('game');
stage('screenshots');

const dossier = buildDossier(outputDir, CAPS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outputDir, 'dossier.json')} (${dossier.byteLength} bytes)`);
