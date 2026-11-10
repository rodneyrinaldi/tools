/**
 * Tipos compartilhados entre a UI e o servidor, rótulos e o resumo de confirmação (puro).
 */
import { OUTPUT_SUFFIX } from "./naming";

export type Operation = "merge" | "compress" | "a4" | "protect" | "unprotect";
export type CompressLevel = "light" | "medium" | "strong";

export type FileEntry = {
  /** Caminho absoluto. */
  path: string;
  /** Caminho relativo à pasta informada (para exibição). */
  relativePath: string;
  size: number;
};

export type Tools = {
  qpdf: boolean;
  ghostscript: boolean;
  /** Conversor de DOCX disponível. */
  docx: "word" | "libreoffice" | null;
};

export type ScanRequest = { root: string; recursive: boolean; mask: string };

export type ScanResult =
  | {
      ok: true;
      root: string;
      pdfs: FileEntry[];
      /** DOCX sem PDF correspondente: serão convertidos antes da operação. */
      docx: FileEntry[];
      /** Arquivos gerados por esta rotina, ignorados na busca. */
      ignored: number;
      tools: Tools;
    }
  | { ok: false; error: string };

export type RunRequest = ScanRequest & {
  operation: Operation;
  level: CompressLevel;
  password: string;
};

export type FileStatus = "ok" | "unchanged" | "error";

export type FileReport = {
  source: string;
  status: FileStatus;
  output?: string;
  message?: string;
  sizeBefore?: number;
  sizeAfter?: number;
};

export type RunReport =
  | {
      ok: true;
      conversions: FileReport[];
      results: FileReport[];
      notes: string[];
    }
  | { ok: false; error: string };

export const OPERATIONS: readonly { value: Operation; label: string; verb: string }[] = [
  { value: "merge", label: "Juntar", verb: "juntar" },
  { value: "compress", label: "Comprimir", verb: "comprimir" },
  { value: "a4", label: "Converter para A4", verb: "converter para A4" },
  { value: "protect", label: "Proteger", verb: "proteger com senha" },
  { value: "unprotect", label: "Desproteger", verb: "remover a senha de" },
];

export const COMPRESS_LEVELS: readonly {
  value: CompressLevel;
  label: string;
  detail: string;
}[] = [
  { value: "light", label: "Leve", detail: "qualidade de impressão, 300 dpi" },
  { value: "medium", label: "Médio", detail: "qualidade de tela, 150 dpi" },
  { value: "strong", label: "Forte", detail: "menor tamanho, 72 dpi" },
];

export const MIN_PASSWORD_LENGTH = 4;

/** Por que a operação não pode rodar com as ferramentas disponíveis (ou `null`). */
export function missingToolFor(operation: Operation, tools: Tools): string | null {
  if ((operation === "protect" || operation === "unprotect") && !tools.qpdf) {
    return "Requer o qpdf instalado.";
  }
  if (operation === "compress" && !tools.qpdf && !tools.ghostscript) {
    return "Requer o Ghostscript (recomendado) ou o qpdf instalado.";
  }
  return null;
}

/** Erro de validação das opções escolhidas, ou `null`. */
export function validateOptions(
  operation: Operation,
  fileCount: number,
  password: string,
  passwordConfirmation: string,
): string | null {
  if (fileCount === 0) return "Nenhum arquivo encontrado com esses critérios.";
  if (operation === "merge" && fileCount < 2)
    return "Para juntar, são necessários ao menos 2 arquivos.";
  if (operation === "protect") {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `A senha precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (password !== passwordConfirmation)
      return "A confirmação não confere com a senha.";
  }
  if (operation === "unprotect" && !password)
    return "Informe a senha atual dos arquivos.";
  if (/[\r\n]/.test(password)) return "A senha não pode conter quebras de linha.";
  return null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto da confirmação: descreve exatamente o que será feito. */
export function buildSummary(
  request: RunRequest,
  scan: { pdfs: FileEntry[]; docx: FileEntry[]; tools: Tools },
): string[] {
  const total = scan.pdfs.length + scan.docx.length;
  const verb = OPERATIONS.find((op) => op.value === request.operation)?.verb ?? "";
  const where = `em ${request.root}${request.recursive ? " e subpastas" : ""} (máscara ${request.mask})`;
  const lines: string[] = [];

  lines.push(`Vou ${verb} ${plural(total, "arquivo", "arquivos")} ${where}.`);

  if (scan.docx.length > 0) {
    lines.push(
      `Antes, ${plural(scan.docx.length, "documento DOCX será convertido", "documentos DOCX serão convertidos")} para PDF (gravado com o mesmo nome, ao lado do DOCX) usando o ${scan.tools.docx === "word" ? "Microsoft Word" : "LibreOffice"}.`,
    );
  }

  switch (request.operation) {
    case "merge":
      lines.push(
        `Os arquivos serão unidos na ordem da lista em um único arquivo, juntado-AAAAMMDD-HHMMSS.pdf, gravado em ${request.root}.`,
      );
      break;
    case "compress": {
      const level = COMPRESS_LEVELS.find((l) => l.value === request.level);
      lines.push(
        scan.tools.ghostscript
          ? `Compressão ${level?.label.toLowerCase()} (${level?.detail}) com Ghostscript.`
          : "Compressão estrutural com qpdf (Ghostscript não encontrado: o ganho tende a ser menor).",
      );
      lines.push(
        `Cada resultado será gravado ao lado do original como nome${OUTPUT_SUFFIX.compress}.pdf; se não ficar menor que o original, será descartado.`,
      );
      break;
    }
    case "a4":
      lines.push(
        `Cada página irá para uma página A4 (retrato ou paisagem conforme a original), com o conteúdo ajustado proporcionalmente. Resultado ao lado do original como nome${OUTPUT_SUFFIX.a4}.pdf.`,
      );
      break;
    case "protect":
      lines.push(
        `Os arquivos receberão senha para abrir (AES-256). Resultado ao lado do original como nome${OUTPUT_SUFFIX.protect}.pdf.`,
      );
      break;
    case "unprotect":
      lines.push(
        `A senha informada será usada para remover a proteção. Resultado ao lado do original como nome${OUTPUT_SUFFIX.unprotect}.pdf.`,
      );
      break;
  }

  lines.push(
    "Nenhum arquivo original será alterado ou apagado; se um nome de saída já existir, será gravado como “nome (2).pdf”.",
  );
  return lines;
}
