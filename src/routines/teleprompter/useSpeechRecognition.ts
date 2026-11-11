"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Tipos mínimos da Web Speech API (ainda não estão em todas as versões do lib.dom). */
type RecognitionAlternative = { transcript: string };
type RecognitionResult = { isFinal: boolean; 0: RecognitionAlternative };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type RecognitionErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  /** Navegadores recentes aceitam uma faixa de áudio para reconhecer (em vez do microfone padrão). */
  start: (audioTrack?: MediaStreamTrack) => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

/** `loading`: baixando/preparando o modelo do reconhecedor no aparelho. */
export type SpeechStatus =
  "idle" | "loading" | "starting" | "listening" | "denied" | "busy" | "error";

/** Palavras já finalizadas mantidas para dar contexto ao início de cada nova frase. */
const FINAL_BUFFER_WORDS = 12;
/** Sem nenhuma fala reconhecida por este tempo, `silent` vira true. */
export const SILENCE_MS = 8000;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported() {
  return getRecognitionConstructor() !== null;
}

/**
 * Escuta o microfone enquanto `active` e entrega as palavras mais recentes ouvidas
 * (finais + provisórias), indicando se a frase já foi finalizada. Reinicia sozinho quando o navegador encerra a sessão.
 * `forgetHeard()` descarta o que já foi ouvido (ex.: após reposicionar o texto manualmente).
 */
export function useSpeechRecognition({
  active,
  lang = "pt-BR",
  audioTrack = null,
  onTranscript,
}: {
  active: boolean;
  lang?: string;
  /**
   * Faixa de áudio a reconhecer — a do microfone já aberto pela câmera. No celular, o
   * reconhecimento costuma não conseguir abrir o microfone enquanto a câmera o usa.
   */
  audioTrack?: MediaStreamTrack | null;
  /** `final`: o reconhecedor fechou a frase (sem hipótese provisória pendente). */
  onTranscript: (heard: { text: string; final: boolean }) => void;
}) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [silent, setSilent] = useState(false);
  const onTranscriptRef = useRef(onTranscript);
  const forgetRef = useRef<() => void>(() => {});
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    if (!active) return;
    const Constructor = getRecognitionConstructor();
    if (!Constructor) return;

    let stopped = false;
    let fatal = false;
    let restartTimer: ReturnType<typeof setTimeout> | undefined;
    let finalWords: string[] = [];
    // Resultados (índice/trecho) já ouvidos antes do último forgetHeard().
    let seen = { count: 0, lastTranscript: "" };
    let skip = { index: -1, chars: 0 };
    let lastActivity = performance.now();
    // Cópia da faixa: o reconhecimento pode encerrá-la sem afetar a gravação.
    const track = audioTrack?.clone?.() ?? null;

    const recognition = new Constructor();
    const startRecognition = () => {
      if (track) {
        try {
          recognition.start(track);
          return;
        } catch {
          // Navegador sem suporte a faixa própria: usa o microfone padrão.
        }
      }
      recognition.start();
    };
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    forgetRef.current = () => {
      finalWords = [];
      skip = { index: seen.count - 1, chars: seen.lastTranscript.length };
    };

    recognition.onstart = () => {
      seen = { count: 0, lastTranscript: "" };
      skip = { index: -1, chars: 0 };
      setStatus("listening");
    };
    recognition.onresult = (event) => {
      lastActivity = performance.now();
      setSilent(false);
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (i < skip.index) continue;
        const transcript =
          i === skip.index
            ? result[0].transcript.slice(skip.chars)
            : result[0].transcript;
        if (result.isFinal) {
          finalWords = [...finalWords, ...transcript.split(/\s+/)]
            .filter(Boolean)
            .slice(-FINAL_BUFFER_WORDS);
        } else {
          interim += ` ${transcript}`;
        }
      }
      const last = event.results[event.results.length - 1];
      seen = { count: event.results.length, lastTranscript: last?.[0].transcript ?? "" };
      onTranscriptRef.current({
        text: `${finalWords.join(" ")} ${interim}`.trim(),
        final: interim.trim() === "",
      });
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        fatal = true;
        setStatus("denied");
      } else if (event.error === "audio-capture") {
        // Microfone ocupado (ex.: pela gravação) — insistir só repetiria o erro.
        fatal = true;
        setStatus("busy");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("error");
      }
    };
    recognition.onend = () => {
      if (stopped || fatal) return;
      // O navegador encerra após silêncio ou ~1 min; retoma em seguida.
      restartTimer = setTimeout(() => {
        try {
          startRecognition();
        } catch {
          setStatus("error");
        }
      }, 250);
    };

    // Vigia de silêncio: avisa se nada for reconhecido por SILENCE_MS.
    const silenceTimer = setInterval(() => {
      setSilent(performance.now() - lastActivity > SILENCE_MS);
    }, 1000);

    try {
      startRecognition();
    } catch {
      queueMicrotask(() => setStatus("error"));
    }

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      clearInterval(silenceTimer);
      forgetRef.current = () => {};
      recognition.onend = null;
      recognition.abort();
      track?.stop();
    };
  }, [active, lang, audioTrack]);

  const forgetHeard = useCallback(() => forgetRef.current(), []);

  return {
    status: active ? (status === "idle" ? "starting" : status) : ("idle" as SpeechStatus),
    /** Rodando sem nenhuma fala reconhecida há mais de SILENCE_MS. */
    silent: active && silent,
    forgetHeard,
  };
}
