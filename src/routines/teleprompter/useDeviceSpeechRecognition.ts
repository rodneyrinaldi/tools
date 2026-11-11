"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KaldiRecognizer, Model } from "vosk-browser";
import { openAudioFeed } from "./audioFeed";
import { SILENCE_MS, type SpeechStatus } from "./useSpeechRecognition";
import { MAX_VOCABULARY } from "./voice";

/**
 * Modelo de português do Vosk (~32 MB). Servido pelo próprio app (baixado no build por
 * `scripts/fetch-voice-model.mjs`); a cópia pública do vosk-browser é a reserva.
 */
export const VOICE_MODEL_FILE = "vosk-model-small-pt-0.3.tar.gz";
export const VOICE_MODEL_URLS = [
  `/models/${VOICE_MODEL_FILE}`,
  `https://ccoreilly.github.io/vosk-browser/models/${VOICE_MODEL_FILE}`,
];
/** Download + descompactação em rede lenta de celular. */
const MODEL_TIMEOUT_MS = 180_000;
/** Palavras já finalizadas mantidas para dar contexto ao início de cada nova frase. */
const FINAL_BUFFER_WORDS = 12;

let modelPromise: Promise<Model> | null = null;

function loadFrom(ModelClass: typeof Model, url: string): Promise<Model> {
  return new Promise((resolve, reject) => {
    // logLevel −1: só erros no console.
    const model = new ModelClass(new URL(url, window.location.href).href, -1);
    const fail = (reason: string) => {
      clearTimeout(timer);
      model.terminate();
      reject(new Error(reason));
    };
    const timer = setTimeout(() => fail("tempo esgotado"), MODEL_TIMEOUT_MS);
    model.on("load", (message) => {
      if (message.event !== "load") return;
      if (message.result) {
        clearTimeout(timer);
        resolve(model);
      } else fail("modelo inválido");
    });
    model.on("error", (message) => {
      if (message.event === "error") fail(message.error);
    });
  });
}

/** Carrega o modelo uma única vez por página (as próximas sessões reaproveitam). */
export function loadVoiceModel(): Promise<Model> {
  modelPromise ??= (async () => {
    const { Model: ModelClass } = await import("vosk-browser");
    let lastError: unknown = new Error("sem endereço do modelo");
    for (const url of VOICE_MODEL_URLS) {
      try {
        return await loadFrom(ModelClass, url);
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError;
  })().catch((error: unknown) => {
    modelPromise = null; // permite tentar de novo numa próxima sessão
    throw error;
  });
  return modelPromise;
}

const words = (text: string) =>
  text.split(/\s+/).filter((word) => word && word !== "[unk]");

/**
 * Reconhecimento de fala no próprio aparelho (Vosk). Mesma interface de
 * `useSpeechRecognition`, mas ouve a faixa de áudio que já existe (a do microfone da
 * câmera) em vez de disputar o microfone — assim a gravação mantém o som.
 *
 * `preload`: começa a baixar o modelo antes de precisar (ex.: durante a contagem).
 * `vocabulary`: palavras do roteiro; restringe o reconhecedor a elas.
 */
export function useDeviceSpeechRecognition({
  active,
  preload = false,
  audioTrack = null,
  vocabulary,
  onTranscript,
}: {
  active: boolean;
  preload?: boolean;
  audioTrack?: MediaStreamTrack | null;
  vocabulary: string[];
  onTranscript: (heard: { text: string; final: boolean }) => void;
}) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [silent, setSilent] = useState(false);
  /** O modelo não carregou ou o motor quebrou: a sessão pode trocar de reconhecedor. */
  const [failed, setFailed] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  const forgetRef = useRef<() => void>(() => {});
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  // A gramática muda só quando o conjunto de palavras muda (não a cada re-quebra de linha).
  const grammarKey = vocabulary.length <= MAX_VOCABULARY ? vocabulary.join(" ") : "";

  useEffect(() => {
    if (!preload && !active) return;
    loadVoiceModel().catch(() => {});
  }, [preload, active]);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let recognizer: KaldiRecognizer | null = null;
    let closeFeed: (() => void) | null = null;
    let ownStream: MediaStream | null = null;
    let finalWords: string[] = [];
    let partialWords: string[] = [];
    /** Palavras da frase em curso ouvidas antes do último forgetHeard(). */
    let skipWords = 0;
    let lastActivity = performance.now();

    const emit = () => {
      onTranscriptRef.current({
        text: [...finalWords, ...partialWords].join(" "),
        final: partialWords.length === 0,
      });
    };

    forgetRef.current = () => {
      finalWords = [];
      skipWords += partialWords.length;
      partialWords = [];
    };

    const fail = (next: SpeechStatus) => {
      if (stopped) return;
      setStatus(next);
      if (next === "error") setFailed(true);
    };

    queueMicrotask(() => {
      if (!stopped) setStatus("loading");
    });

    (async () => {
      const model = await loadVoiceModel().catch(() => null);
      if (stopped) return;
      if (!model) return fail("error");
      setStatus("starting");

      let stream: MediaStream;
      if (audioTrack && audioTrack.readyState === "live") {
        stream = new MediaStream([audioTrack]);
      } else {
        try {
          ownStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
        } catch (error) {
          const name = error instanceof DOMException ? error.name : "";
          return fail(name === "NotAllowedError" ? "denied" : "busy");
        }
        if (stopped) return;
        stream = ownStream;
      }

      // Reconhecedor criado com a taxa real do áudio (o Vosk converte para a do modelo).
      let pendingRate: number | null = null;
      const feed = await openAudioFeed(stream, (samples, sampleRate) => {
        if (!recognizer) {
          pendingRate = sampleRate;
          return;
        }
        recognizer.acceptWaveformFloat(samples, sampleRate);
      }).catch(() => null);
      if (stopped) return feed?.close();
      if (!feed) return fail("error");
      closeFeed = feed.close;

      const grammar = grammarKey
        ? JSON.stringify([...grammarKey.split(" "), "[unk]"])
        : undefined;
      recognizer = new model.KaldiRecognizer(pendingRate ?? feed.sampleRate, grammar);
      recognizer.on("partialresult", (message) => {
        if (message.event !== "partialresult") return;
        const heard = words(message.result.partial).slice(skipWords);
        if (heard.join(" ") === partialWords.join(" ")) return;
        partialWords = heard;
        lastActivity = performance.now();
        setSilent(false);
        emit();
      });
      recognizer.on("result", (message) => {
        if (message.event !== "result") return;
        const heard = words(message.result.text).slice(skipWords);
        skipWords = 0;
        partialWords = [];
        if (heard.length === 0) return;
        finalWords = [...finalWords, ...heard].slice(-FINAL_BUFFER_WORDS);
        lastActivity = performance.now();
        setSilent(false);
        emit();
      });
      recognizer.on("error", () => fail("error"));
      setStatus("listening");
    })();

    const silenceTimer = setInterval(() => {
      setSilent(performance.now() - lastActivity > SILENCE_MS);
    }, 1000);

    return () => {
      stopped = true;
      clearInterval(silenceTimer);
      forgetRef.current = () => {};
      closeFeed?.();
      recognizer?.remove();
      ownStream?.getTracks().forEach((track) => track.stop());
    };
  }, [active, audioTrack, grammarKey]);

  const forgetHeard = useCallback(() => forgetRef.current(), []);

  return {
    status: active ? (status === "idle" ? "loading" : status) : ("idle" as SpeechStatus),
    silent: active && silent && status === "listening",
    failed,
    forgetHeard,
  };
}
