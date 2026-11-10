import { existsSync } from "node:fs";
import { copyFile, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { mergeOutputName, numberedName, outputNameFor, stripExtension } from "../naming";
import {
  missingToolFor,
  validateOptions,
  type CompressLevel,
  type FileEntry,
  type FileReport,
  type RunReport,
  type RunRequest,
} from "../operations";
import { convertToA4, mergePdfs, ProtectedPdfError } from "./pdf";
import { scanFolder } from "./scan";
import {
  convertDocx,
  locateTools,
  run,
  runQpdf,
  toolsSummary,
  withTempDir,
  type ToolPaths,
} from "./tools";

const GS_PRESET: Record<CompressLevel, string> = {
  light: "/printer",
  medium: "/ebook",
  strong: "/screen",
};

/** Primeiro nome livre na pasta: nome.pdf, nome (2).pdf, nome (3).pdf… */
export function uniquePath(folder: string, fileName: string): string {
  for (let n = 1; ; n++) {
    const candidate = path.join(folder, numberedName(fileName, n));
    if (!existsSync(candidate)) return candidate;
  }
}

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : "Erro desconhecido.";

/** Executa a operação pedida. Nunca altera os arquivos de origem. */
export async function runOperation(
  request: RunRequest,
  now = new Date(),
): Promise<RunReport> {
  const scan = await scanFolder(request);
  const paths = await locateTools();
  const tools = toolsSummary(paths);

  const missing = missingToolFor(request.operation, tools);
  if (missing) return { ok: false, error: missing };

  const optionsError = validateOptions(
    request.operation,
    scan.pdfs.length + scan.docx.length,
    request.password,
    request.password,
  );
  if (optionsError) return { ok: false, error: optionsError };
  if (scan.docx.length > 0 && !tools.docx) {
    return {
      ok: false,
      error:
        "Há documentos DOCX para converter, mas o Microsoft Word ou o LibreOffice não foram encontrados.",
    };
  }

  // 1. DOCX → PDF (ao lado do DOCX, com o mesmo nome).
  const jobs = scan.docx.map((doc) => ({
    input: doc.path,
    output: uniquePath(
      path.dirname(doc.path),
      `${stripExtension(path.basename(doc.path))}.pdf`,
    ),
  }));
  const conversionResults = await convertDocx(paths, jobs);
  const conversions: FileReport[] = conversionResults.map((result, i) => ({
    source: result.input,
    status: result.ok ? "ok" : "error",
    output: result.ok ? jobs[i].output : undefined,
    message: result.ok ? "Convertido para PDF." : result.error,
  }));

  const root = path.resolve(request.root.trim());
  const converted: FileEntry[] = [];
  for (const report of conversions) {
    if (report.status !== "ok" || !report.output) continue;
    const { size } = await stat(report.output);
    converted.push({
      path: report.output,
      relativePath: path.relative(root, report.output),
      size,
    });
  }
  const inputs = [...scan.pdfs, ...converted].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, "pt-BR", {
      numeric: true,
      sensitivity: "base",
    }),
  );

  // 2. Operação.
  const notes: string[] = [];
  let results: FileReport[];

  if (request.operation === "merge") {
    results = [await merge(inputs, root, now)];
  } else {
    if (request.operation === "compress" && !paths.ghostscript) {
      notes.push("Ghostscript não encontrado: foi feita compressão estrutural com qpdf.");
    }
    results = [];
    for (const input of inputs) {
      results.push(await processOne(request, paths, input));
    }
  }

  return { ok: true, conversions, results, notes };
}

async function merge(inputs: FileEntry[], root: string, now: Date): Promise<FileReport> {
  const source = `${inputs.length} arquivos`;
  try {
    const bytes = await Promise.all(inputs.map((input) => readFile(input.path)));
    const merged = await mergePdfs(bytes);
    const output = uniquePath(root, mergeOutputName(now));
    await writeFile(output, merged, { flag: "wx" });
    return { source, status: "ok", output, sizeAfter: merged.byteLength };
  } catch (error) {
    const failing =
      error instanceof ProtectedPdfError
        ? " Algum arquivo está protegido por senha."
        : "";
    return { source, status: "error", message: `${messageOf(error)}${failing}` };
  }
}

async function processOne(
  request: RunRequest,
  paths: ToolPaths,
  input: FileEntry,
): Promise<FileReport> {
  const operation = request.operation as Exclude<RunRequest["operation"], "merge">;
  const folder = path.dirname(input.path);
  const output = uniquePath(folder, outputNameFor(path.basename(input.path), operation));
  const base: FileReport = { source: input.path, status: "ok", sizeBefore: input.size };

  try {
    switch (operation) {
      case "a4": {
        const converted = await convertToA4(await readFile(input.path));
        await writeFile(output, converted, { flag: "wx" });
        return { ...base, output, sizeAfter: converted.byteLength };
      }

      case "compress":
        return await compress(paths, input, output, request.level, base);

      case "protect": {
        const qpdf = paths.qpdf!;
        if ((await run(qpdf, ["--is-encrypted", input.path])).code === 0) {
          return {
            ...base,
            status: "error",
            message: "O arquivo já está protegido por senha.",
          };
        }
        const result = await runQpdf(qpdf, [
          "--encrypt",
          `--user-password=${request.password}`,
          `--owner-password=${request.password}`,
          "--bits=256",
          "--",
          input.path,
          output,
        ]);
        return qpdfOutcome(result.code, result.stderr, base, output);
      }

      case "unprotect": {
        const qpdf = paths.qpdf!;
        if ((await run(qpdf, ["--is-encrypted", input.path])).code !== 0) {
          return {
            ...base,
            status: "unchanged",
            message: "O arquivo não estava protegido.",
          };
        }
        const result = await runQpdf(qpdf, [
          "--decrypt",
          `--password=${request.password}`,
          input.path,
          output,
        ]);
        if (/invalid password/i.test(result.stderr)) {
          return { ...base, status: "error", message: "Senha incorreta." };
        }
        return qpdfOutcome(result.code, result.stderr, base, output);
      }
    }
  } catch (error) {
    return { ...base, status: "error", message: messageOf(error) };
  }
}

/** qpdf: 0 = ok, 3 = ok com avisos, 2 = erro. */
async function qpdfOutcome(
  code: number,
  stderr: string,
  base: FileReport,
  output: string,
): Promise<FileReport> {
  if ((code === 0 || code === 3) && existsSync(output)) {
    const { size } = await stat(output);
    return { ...base, output, sizeAfter: size };
  }
  return { ...base, status: "error", message: firstLine(stderr) || "Falha no qpdf." };
}

async function compress(
  paths: ToolPaths,
  input: FileEntry,
  output: string,
  level: CompressLevel,
  base: FileReport,
): Promise<FileReport> {
  return withTempDir(async (dir) => {
    // Caminhos temporários só com ASCII: o Ghostscript nem sempre lida bem com acentos no Windows.
    const tempIn = path.join(dir, "in.pdf");
    const tempOut = path.join(dir, "out.pdf");
    await copyFile(input.path, tempIn);

    const result = paths.ghostscript
      ? await run(paths.ghostscript, [
          "-sDEVICE=pdfwrite",
          "-dCompatibilityLevel=1.6",
          `-dPDFSETTINGS=${GS_PRESET[level]}`,
          "-dDetectDuplicateImages=true",
          "-dNOPAUSE",
          "-dBATCH",
          "-dQUIET",
          "-dSAFER",
          `-sOutputFile=${tempOut}`,
          tempIn,
        ])
      : await run(paths.qpdf!, [
          "--object-streams=generate",
          "--compress-streams=y",
          "--recompress-flate",
          "--compression-level=9",
          tempIn,
          tempOut,
        ]);

    if (!existsSync(tempOut) || (result.code !== 0 && result.code !== 3)) {
      const protectedHint = /password|encrypt/i.test(result.stderr)
        ? "O arquivo está protegido por senha. Use Desproteger antes."
        : firstLine(result.stderr) || "Falha na compressão.";
      return { ...base, status: "error", message: protectedHint };
    }

    const { size } = await stat(tempOut);
    if (size >= input.size) {
      return {
        ...base,
        status: "unchanged",
        sizeAfter: size,
        message:
          "Sem ganho: o resultado não ficou menor que o original e foi descartado.",
      };
    }
    await copyFile(tempOut, output);
    return { ...base, output, sizeAfter: size };
  });
}

const firstLine = (text: string) => text.trim().split(/\r?\n/)[0] ?? "";
