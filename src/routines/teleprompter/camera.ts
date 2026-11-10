/** Câmera e gravação: tipos e funções puras. */

export type Facing = "user" | "environment";
export type DimLevel = "light" | "medium" | "strong";
export type RecorderState = "inactive" | "recording" | "paused";

/** Opacidade da camada escura sobre a câmera. */
export const DIM_OPACITY: Record<DimLevel, number> = {
  light: 0.35,
  medium: 0.55,
  strong: 0.72,
};

/** Uma gravação feita na sessão. */
export type Take = {
  id: string;
  url: string;
  blob: Blob;
  name: string;
  mimeType: string;
  size: number;
  durationMs: number;
  /** Já foi baixada ou compartilhada. */
  saved: boolean;
};

/**
 * Formato de gravação preferido entre os suportados. MP4 primeiro: abre direto na galeria
 * do celular e em apps de mensagem; WebM como alternativa (Chrome/Android mais antigos).
 */
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export function pickRecordingMimeType(
  isSupported: (type: string) => boolean,
): string | null {
  return MIME_CANDIDATES.find((type) => isSupported(type)) ?? null;
}

export function extensionFor(mimeType: string): "mp4" | "webm" {
  return mimeType.includes("mp4") ? "mp4" : "webm";
}

export function recordingFileName(date: Date, mimeType: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `teleprompter-${stamp}.${extensionFor(mimeType)}`;
}

/** 83_000 → "01:23"; acima de 1 h → "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mmss = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export const INSECURE_CONTEXT_MESSAGE =
  "O navegador só libera a câmera em HTTPS ou em localhost. No celular, abra o app pelo endereço HTTPS (veja o README da rotina).";

/** Mensagem amigável para falhas de getUserMedia. */
export function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "O acesso à câmera/microfone foi negado. Libere a permissão no ícone da barra de endereço e tente de novo.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera compatível foi encontrada neste aparelho.";
    case "NotReadableError":
    case "AbortError":
      return "A câmera está em uso por outro aplicativo. Feche-o e tente de novo.";
    default:
      return "Não foi possível ligar a câmera.";
  }
}
