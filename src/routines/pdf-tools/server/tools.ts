/**
 * Localiza e executa as ferramentas externas: qpdf, Ghostscript e conversor de DOCX
 * (Microsoft Word via COM, ou LibreOffice).
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Tools } from "../operations";

const isWindows = process.platform === "win32";

export type ToolPaths = {
  qpdf: string | null;
  ghostscript: string | null;
  soffice: string | null;
  word: boolean;
};

export type ExecResult = { code: number; stdout: string; stderr: string };

export function run(
  file: string,
  args: string[],
  timeoutMs = 10 * 60_000,
): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        const code =
          error && typeof (error as NodeJS.ErrnoException).code === "number"
            ? Number((error as NodeJS.ErrnoException).code)
            : error
              ? 1
              : 0;
        resolve({
          code,
          stdout: String(stdout),
          stderr: String(stderr || error?.message || ""),
        });
      },
    );
  });
}

function findOnPath(names: string[]): string | null {
  const dirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = isWindows ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of dirs) {
    for (const name of names) {
      for (const ext of extensions) {
        const candidate = path.join(dir, name + ext);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return null;
}

/** Procura `<base>\<pasta que começa com prefix>\<relative>` e prefere a versão mais nova. */
function findInstalled(base: string, prefix: string, relative: string): string | null {
  try {
    const folders = readdirSync(base)
      .filter((name) => name.toLowerCase().startsWith(prefix))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const folder of folders) {
      const candidate = path.join(base, folder, relative);
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    // pasta base inexistente
  }
  return null;
}

function fromEnv(name: string): string | null {
  const value = process.env[name];
  return value && existsSync(value) ? value : null;
}

const programFiles = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"]].filter(
  (dir): dir is string => Boolean(dir),
);

function locateQpdf() {
  return (
    fromEnv("QPDF_PATH") ??
    findOnPath(["qpdf"]) ??
    programFiles.map((dir) => findInstalled(dir, "qpdf", "bin/qpdf.exe")).find(Boolean) ??
    null
  );
}

function locateGhostscript() {
  return (
    fromEnv("GHOSTSCRIPT_PATH") ??
    findOnPath(isWindows ? ["gswin64c", "gswin32c"] : ["gs"]) ??
    programFiles
      .flatMap((dir) => [
        findInstalled(path.join(dir, "gs"), "gs", "bin/gswin64c.exe"),
        findInstalled(path.join(dir, "gs"), "gs", "bin/gswin32c.exe"),
      ])
      .find(Boolean) ??
    null
  );
}

function locateSoffice() {
  return (
    fromEnv("SOFFICE_PATH") ??
    findOnPath(["soffice"]) ??
    programFiles
      .map((dir) => path.join(dir, "LibreOffice", "program", "soffice.exe"))
      .find((candidate) => existsSync(candidate)) ??
    null
  );
}

async function hasWord(): Promise<boolean> {
  if (!isWindows) return false;
  const result = await run("reg", ["query", "HKCR\\Word.Application\\CLSID"], 10_000);
  return result.code === 0;
}

/** Detecta a cada chamada: a pessoa pode instalar uma ferramenta com o app aberto. */
export async function locateTools(): Promise<ToolPaths> {
  return {
    qpdf: locateQpdf(),
    ghostscript: locateGhostscript(),
    soffice: locateSoffice(),
    word: await hasWord(),
  };
}

export function toolsSummary(paths: ToolPaths): Tools {
  return {
    qpdf: Boolean(paths.qpdf),
    ghostscript: Boolean(paths.ghostscript),
    docx: paths.word ? "word" : paths.soffice ? "libreoffice" : null,
  };
}

/** Pasta temporária própria, removida ao final de `work`. */
export async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(tmpdir(), "pdf-tools-"));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Executa o qpdf com os argumentos num arquivo (`@arquivo`), para senhas não aparecerem na linha de comando. */
export async function runQpdf(qpdf: string, args: string[]): Promise<ExecResult> {
  return withTempDir(async (dir) => {
    const argsFile = path.join(dir, "args.txt");
    await writeFile(argsFile, args.join("\n"), { encoding: "utf8", mode: 0o600 });
    return run(qpdf, [`@${argsFile}`]);
  });
}

export type ConversionResult = { input: string; ok: boolean; error?: string };

const WORD_SCRIPT = String.raw`
param([string]$JobsFile, [string]$ResultFile)
$ErrorActionPreference = 'Stop'
$jobs = Get-Content -Raw -Encoding UTF8 $JobsFile | ConvertFrom-Json
$results = @()
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  foreach ($job in $jobs) {
    $doc = $null
    try {
      # Senha fictícia: documentos protegidos falham em vez de abrir uma janela pedindo senha.
      $doc = $word.Documents.Open($job.input, $false, $true, $false, 'senha-invalida')
      $doc.ExportAsFixedFormat($job.output, 17)
      $results += @{ input = $job.input; ok = $true }
    } catch {
      $results += @{ input = $job.input; ok = $false; error = $_.Exception.Message }
    } finally {
      if ($doc) { $doc.Close(0) | Out-Null }
    }
  }
} finally {
  if ($word) {
    $word.Quit() | Out-Null
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($word) | Out-Null
  }
}
ConvertTo-Json -InputObject @($results) -Depth 3 | Set-Content -Encoding UTF8 $ResultFile
`;

/** Converte DOCX → PDF. `jobs[i].output` é o PDF a gerar. */
export async function convertDocx(
  paths: ToolPaths,
  jobs: { input: string; output: string }[],
): Promise<ConversionResult[]> {
  if (jobs.length === 0) return [];

  if (paths.word) {
    return withTempDir(async (dir) => {
      const script = path.join(dir, "word-to-pdf.ps1");
      const jobsFile = path.join(dir, "jobs.json");
      const resultFile = path.join(dir, "result.json");
      await writeFile(script, `﻿${WORD_SCRIPT}`, "utf8");
      await writeFile(jobsFile, JSON.stringify(jobs), "utf8");
      const execution = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          script,
          "-JobsFile",
          jobsFile,
          "-ResultFile",
          resultFile,
        ],
        Math.max(2, jobs.length) * 2 * 60_000,
      );
      const raw = await readFile(resultFile, "utf8").catch(() => null);
      if (!raw) {
        const error = execution.stderr.trim() || "O Word não respondeu.";
        return jobs.map((job) => ({ input: job.input, ok: false, error }));
      }
      return JSON.parse(raw.replace(/^﻿/, "")) as ConversionResult[];
    });
  }

  if (paths.soffice) {
    const results: ConversionResult[] = [];
    for (const job of jobs) {
      const execution = await run(paths.soffice, [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        path.dirname(job.output),
        job.input,
      ]);
      const ok = execution.code === 0 && existsSync(job.output);
      results.push({
        input: job.input,
        ok,
        error: ok ? undefined : execution.stderr.trim() || "Falha na conversão.",
      });
    }
    return results;
  }

  return jobs.map((job) => ({
    input: job.input,
    ok: false,
    error: "Nenhum conversor de DOCX encontrado (Microsoft Word ou LibreOffice).",
  }));
}
