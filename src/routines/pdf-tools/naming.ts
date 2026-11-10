/** Nomes dos arquivos produzidos (puro — só manipula nomes, não toca no disco). */
import type { Operation } from "./operations";

export const OUTPUT_SUFFIX: Record<Exclude<Operation, "merge">, string> = {
  compress: "-comprimido",
  a4: "-a4",
  protect: "-protegido",
  unprotect: "-desprotegido",
};

const GENERATED = new RegExp(
  `(?:${Object.values(OUTPUT_SUFFIX).join("|")})(?: \\(\\d+\\))?\\.pdf$|^juntado-\\d{8}-\\d{6}(?: \\(\\d+\\))?\\.pdf$`,
  "i",
);

/** Arquivo produzido por esta rotina (não deve ser reprocessado). */
export function isGeneratedName(fileName: string): boolean {
  return GENERATED.test(fileName);
}

export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function outputNameFor(fileName: string, operation: Exclude<Operation, "merge">) {
  return `${stripExtension(fileName)}${OUTPUT_SUFFIX[operation]}.pdf`;
}

export function mergeOutputName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `juntado-${day}-${time}.pdf`;
}

/** `nome.pdf` → `nome (n).pdf`, para não sobrescrever arquivos existentes. */
export function numberedName(fileName: string, n: number): string {
  return n <= 1 ? fileName : `${stripExtension(fileName)} (${n}).pdf`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[unit]}`;
}
