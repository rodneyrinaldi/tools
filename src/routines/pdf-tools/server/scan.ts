import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { matchesMask, parseMask, validateMask } from "../mask";
import { isGeneratedName, stripExtension } from "../naming";
import type { FileEntry, ScanRequest } from "../operations";

/** Limite de segurança para não varrer o disco inteiro por engano. */
export const MAX_FILES = 5000;

const SKIPPED_FOLDERS = new Set([
  "$recycle.bin",
  "system volume information",
  "node_modules",
]);

export class ScanError extends Error {}

export type FolderScan = { pdfs: FileEntry[]; docx: FileEntry[]; ignored: number };

/**
 * Procura PDFs que passam na máscara e DOCX sem PDF correspondente (cujo `nome.pdf`
 * passaria na máscara). Arquivos gerados por esta rotina são contados e ignorados.
 */
export async function scanFolder({
  root,
  recursive,
  mask,
}: ScanRequest): Promise<FolderScan> {
  const maskError = validateMask(mask);
  if (maskError) throw new ScanError(maskError);
  const trimmedRoot = root.trim();
  if (!trimmedRoot || !path.isAbsolute(trimmedRoot)) {
    throw new ScanError(
      "Informe o caminho completo da pasta, por exemplo D:\\Documentos.",
    );
  }
  const base = path.resolve(trimmedRoot);
  const info = await stat(base).catch(() => null);
  if (!info) throw new ScanError(`A pasta ${base} não existe ou não pode ser acessada.`);
  if (!info.isDirectory()) throw new ScanError(`${base} não é uma pasta.`);

  const patterns = parseMask(mask);
  const result: FolderScan = { pdfs: [], docx: [], ignored: 0 };
  let seen = 0;

  async function visit(folder: string) {
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => null);
    if (!entries) return; // sem permissão: segue adiante

    const pdfNames = new Set(
      entries
        .filter((entry) => entry.isFile() && /\.pdf$/i.test(entry.name))
        .map((entry) => entry.name.toLowerCase()),
    );

    for (const entry of entries) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (
          recursive &&
          !SKIPPED_FOLDERS.has(entry.name.toLowerCase()) &&
          !entry.name.startsWith(".")
        ) {
          await visit(full);
        }
        continue;
      }
      if (!entry.isFile()) continue;

      if (/\.pdf$/i.test(entry.name)) {
        if (isGeneratedName(entry.name)) {
          result.ignored++;
        } else if (matchesMask(entry.name, patterns)) {
          result.pdfs.push(await toEntry(full));
        }
      } else if (/\.docx$/i.test(entry.name) && !entry.name.startsWith("~$")) {
        const pdfName = `${stripExtension(entry.name)}.pdf`;
        if (!pdfNames.has(pdfName.toLowerCase()) && matchesMask(pdfName, patterns)) {
          result.docx.push(await toEntry(full));
        }
      } else {
        continue;
      }

      if (++seen > MAX_FILES) {
        throw new ScanError(
          `Mais de ${MAX_FILES} arquivos encontrados. Restrinja a pasta ou a máscara.`,
        );
      }
    }
  }

  async function toEntry(full: string): Promise<FileEntry> {
    const { size } = await stat(full);
    return { path: full, relativePath: path.relative(base, full), size };
  }

  await visit(base);
  const byPath = (a: FileEntry, b: FileEntry) =>
    a.relativePath.localeCompare(b.relativePath, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    });
  result.pdfs.sort(byPath);
  result.docx.sort(byPath);
  return result;
}
