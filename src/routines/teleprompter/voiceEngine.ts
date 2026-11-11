/**
 * Qual reconhecedor de voz usar.
 *
 * - `device`: reconhece no próprio aparelho (Vosk, WebAssembly), ouvindo o mesmo microfone
 *   da câmera — o vídeo sai com som e a voz conduz o texto ao mesmo tempo. Na primeira vez
 *   baixa o modelo de português (~32 MB); depois funciona sem internet.
 * - `browser`: Web Speech API do navegador (no Chrome, processada pelo Google). Quer o
 *   microfone só para si: com a câmera, o vídeo é gravado sem som.
 */
import { isSpeechRecognitionSupported } from "./useSpeechRecognition";

export type VoiceEngine = "device" | "browser";

export function isDeviceRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return (
    typeof w.WebAssembly === "object" &&
    typeof w.Worker === "function" &&
    (typeof w.AudioContext === "function" ||
      typeof w.webkitAudioContext === "function") &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function isEngineSupported(engine: VoiceEngine): boolean {
  return engine === "device"
    ? isDeviceRecognitionSupported()
    : isSpeechRecognitionSupported();
}

/** O motor preferido, se funcionar aqui; senão o outro; `null` se nenhum funcionar. */
export function resolveEngine(preferred: VoiceEngine): VoiceEngine | null {
  const other: VoiceEngine = preferred === "device" ? "browser" : "device";
  if (isEngineSupported(preferred)) return preferred;
  return isEngineSupported(other) ? other : null;
}

export function isVoiceSupported(): boolean {
  return resolveEngine("device") !== null;
}
