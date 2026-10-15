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
  start: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;

export type SpeechStatus = "idle" | "starting" | "listening" | "denied" | "error";

/** Palavras já finalizadas mantidas para dar contexto ao início de cada nova frase. */
const FINAL_BUFFER_WORDS = 12;

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
 * (finais + provisórias). Reinicia sozinho quando o navegador encerra a sessão.
 * `forgetHeard()` descarta o que já foi ouvido (ex.: após reposicionar o texto manualmente).
 */
export function useSpeechRecognition({
  active,
  lang = "pt-BR",
  onTranscript,
}: {
  active: boolean;
  lang?: string;
  onTranscript: (recentText: string) => void;
}) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
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

    const recognition = new Constructor();
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
      onTranscriptRef.current(`${finalWords.join(" ")} ${interim}`.trim());
    };
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        fatal = true;
        setStatus("denied");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus("error");
      }
    };
    recognition.onend = () => {
      if (stopped || fatal) return;
      // O navegador encerra após silêncio ou ~1 min; retoma em seguida.
      restartTimer = setTimeout(() => {
        try {
          recognition.start();
        } catch {
          setStatus("error");
        }
      }, 250);
    };

    try {
      recognition.start();
    } catch {
      queueMicrotask(() => setStatus("error"));
    }

    return () => {
      stopped = true;
      clearTimeout(restartTimer);
      forgetRef.current = () => {};
      recognition.onend = null;
      recognition.abort();
    };
  }, [active, lang]);

  const forgetHeard = useCallback(() => forgetRef.current(), []);

  return {
    status: active ? (status === "idle" ? "starting" : status) : ("idle" as SpeechStatus),
    forgetHeard,
  };
}
