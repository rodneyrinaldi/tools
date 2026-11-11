/**
 * Baixa o modelo de voz em português do Vosk para public/models (servido pelo próprio app).
 * Roda antes de `dev` e `build`; se o arquivo já existe, não faz nada. Uma falha não
 * interrompe o build: o teleprompter então baixa o modelo da cópia pública do vosk-browser.
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const FILE = "vosk-model-small-pt-0.3.tar.gz";
const SOURCE = `https://ccoreilly.github.io/vosk-browser/models/${FILE}`;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, "public", "models", FILE);

if (existsSync(target) && statSync(target).size > 1_000_000) process.exit(0);

const partial = `${target}.part`;
try {
  mkdirSync(dirname(target), { recursive: true });
  console.log(`Baixando o modelo de voz (${FILE}, ~32 MB)…`);
  const response = await fetch(SOURCE);
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
  renameSync(partial, target);
  console.log("Modelo de voz pronto em public/models.");
} catch (error) {
  rmSync(partial, { force: true });
  console.warn(`Aviso: não foi possível baixar o modelo de voz (${error}).`);
}
