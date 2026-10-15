"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { createMeasurer, type Layout } from "./measure";
import { initialPlayback, playbackReducer } from "./playback";
import { Presenter } from "./Presenter";
import { lineDurationMs, lineIndexAt, parseScript, wrapScript } from "./script";
import {
  advance,
  clamp,
  currentLineIndex,
  LINE_HEIGHT_EM,
  offsetEm,
  positionToToken,
  tokenToPosition,
} from "./scroll";
import type { Drive } from "./storage";
import {
  isSpeechRecognitionSupported,
  useSpeechRecognition,
} from "./useSpeechRecognition";
import {
  buildWordIndex,
  cursorForPosition,
  matchSpoken,
  positionForCursor,
} from "./voice";

const MIN_WPM = 60;
const MAX_WPM = 300;
const WPM_STEP = 10;
/** Constante de tempo da suavização no modo voz: o texto "desliza" até a palavra dita. */
const VOICE_SMOOTHING_MS = 220;
/** Velocidade mínima de aproximação no modo voz (linhas por ms). */
const VOICE_MIN_SPEED = 0.0015;
const FALLBACK_FONT_PX = 32;

type SessionProps = {
  text: string;
  drive: Drive;
  initialWordsPerMinute: number;
  holdPauses: boolean;
  countdown: number;
  focus: boolean;
  onToggleFocus: () => void;
  onExit: () => void;
};

/** Uma apresentação em andamento: rolagem contínua conduzida pela voz ou por velocidade. */
export function Session({
  text,
  drive: initialDrive,
  initialWordsPerMinute,
  holdPauses,
  countdown,
  focus,
  onToggleFocus,
  onExit,
}: SessionProps) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [wordsPerMinute, setWordsPerMinute] = useState(initialWordsPerMinute);
  const [drive, setDrive] = useState<Drive>(() =>
    initialDrive === "voice" && isSpeechRecognitionSupported() ? "voice" : "speed",
  );
  const [playback, dispatch] = useReducer(playbackReducer, countdown, initialPlayback);
  // Token inicial da linha sob a guia: muda só quando a linha muda e sobrevive a re-quebras.
  const [lineToken, setLineToken] = useState(0);

  const paragraphs = useMemo(() => parseScript(text), [text]);
  const lines = useMemo(() => {
    const { measure, maxWidth } = createMeasurer(layout);
    return wrapScript(paragraphs, maxWidth, measure);
  }, [paragraphs, layout]);
  const durations = useMemo(
    () => lines.map((line) => lineDurationMs(line.tokens, wordsPerMinute, holdPauses)),
    [lines, wordsPerMinute, holdPauses],
  );
  const words = useMemo(() => buildWordIndex(lines), [lines]);
  const lineIndex = Math.min(lineIndexAt(lines, lineToken), lines.length - 1);

  // Estado do laço de animação: muda a cada quadro, por isso fica em refs.
  const engine = useRef({ position: 0, target: 0, cursor: 0, token: 0 });
  const trackRef = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ lines, durations, words });
  useEffect(() => {
    latest.current = { lines, durations, words };
  });

  const paint = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const em = offsetEm(latest.current.lines, engine.current.position);
    track.style.transform = `translate3d(0, ${-em}em, 0)`;
  }, []);

  const commit = useCallback(
    (position: number) => {
      const { lines } = latest.current;
      engine.current.position = position;
      engine.current.token = positionToToken(lines, position);
      paint();
      setLineToken(lines[currentLineIndex(lines, position)]?.start ?? 0);
    },
    [paint],
  );

  const setTrack = useCallback(
    (element: HTMLDivElement | null) => {
      trackRef.current = element;
      paint();
    },
    [paint],
  );

  // Texto re-quebrado (redimensionou / trocou de visualização): mantém o ponto de leitura.
  useEffect(() => {
    const e = engine.current;
    e.position = tokenToPosition(lines, e.token);
    e.target = e.position;
    e.cursor = cursorForPosition(words, e.position);
    paint();
  }, [lines, words, paint]);

  // Contagem regressiva.
  useEffect(() => {
    if (playback.phase !== "countdown") return;
    const id = setTimeout(() => dispatch({ type: "tick" }), 1000);
    return () => clearTimeout(id);
  }, [playback.phase, playback.countdown]);

  // Laço de animação.
  useEffect(() => {
    if (playback.phase !== "running") return;
    let frame = 0;
    let last: number | null = null;

    const step = (now: number) => {
      const elapsed = last === null ? 0 : Math.min(now - last, 100);
      last = now;
      const { lines, durations, words } = latest.current;
      const e = engine.current;

      let next: number;
      if (drive === "speed") {
        next = advance(e.position, elapsed, durations);
      } else {
        // Aproximação suave, com velocidade mínima para chegar ao alvo em tempo finito.
        const distance = e.target - e.position;
        const step = Math.max(
          Math.abs(distance) * (1 - Math.exp(-elapsed / VOICE_SMOOTHING_MS)),
          VOICE_MIN_SPEED * elapsed,
        );
        next = e.position + Math.sign(distance) * Math.min(step, Math.abs(distance));
      }
      commit(next);

      const ended =
        drive === "speed"
          ? next >= lines.length
          : e.cursor >= words.length && next >= e.target - 0.02;
      if (ended) {
        dispatch({ type: "finish" });
        return;
      }
      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playback.phase, drive, commit]);

  const voiceStatus = useSpeechRecognition({
    active: drive === "voice" && playback.phase === "running",
    onTranscript: (heard) => {
      const { lines, words } = latest.current;
      const e = engine.current;
      const cursor = matchSpoken(words, e.cursor, heard);
      if (cursor === null || cursor === e.cursor) return;
      e.cursor = cursor;
      e.target = positionForCursor(words, cursor, lines.length);
    },
  });
  const forgetHeard = voiceStatus.forgetHeard;

  /** Reposiciona manualmente (setas, roda do mouse, passador). */
  const moveBy = useCallback(
    (deltaLines: number, snapToLine: boolean) => {
      const { lines, words } = latest.current;
      const e = engine.current;
      const base = !snapToLine
        ? e.position
        : deltaLines > 0
          ? Math.floor(e.position)
          : Math.ceil(e.position);
      const position = clamp(base + deltaLines, 0, Math.max(0, lines.length - 0.001));
      e.target = position;
      e.cursor = cursorForPosition(words, position);
      commit(position);
      forgetHeard();
      dispatch({ type: "moved" });
    },
    [commit, forgetHeard],
  );

  const restart = useCallback(() => {
    engine.current.target = 0;
    engine.current.cursor = 0;
    commit(0);
    forgetHeard();
    dispatch({ type: "restart", countdown });
  }, [commit, forgetHeard, countdown]);

  function changeSpeed(delta: number) {
    if (drive !== "speed") return;
    setWordsPerMinute((wpm) => clamp(wpm + delta, MIN_WPM, MAX_WPM));
  }

  function switchDrive() {
    const e = engine.current;
    e.target = e.position;
    e.cursor = cursorForPosition(latest.current.words, e.position);
    forgetHeard();
    setDrive((current) =>
      current === "voice" || !isSpeechRecognitionSupported() ? "speed" : "voice",
    );
  }

  function handleLayout(next: Layout) {
    setLayout((previous) =>
      previous &&
      previous.width === next.width &&
      previous.font === next.font &&
      previous.fontSize === next.fontSize
        ? previous
        : next,
    );
  }

  function handleWheel(deltaPixels: number) {
    const lineHeightPx = (layout?.fontSize ?? FALLBACK_FONT_PX) * LINE_HEIGHT_EM;
    moveBy(deltaPixels / lineHeightPx, false);
  }

  // Atalhos de teclado — ref para sempre usar os handlers mais recentes sem re-assinar.
  const keyHandlerRef = useRef<(event: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select")
      ) {
        return;
      }
      const actions: Record<string, () => void> = {
        " ": () => dispatch({ type: "toggle" }),
        Escape: focus ? onToggleFocus : onExit,
        r: restart,
        R: restart,
        f: onToggleFocus,
        F: onToggleFocus,
        v: switchDrive,
        V: switchDrive,
        ArrowDown: () => moveBy(1, true),
        PageDown: () => moveBy(1, true),
        ArrowUp: () => moveBy(-1, true),
        PageUp: () => moveBy(-1, true),
        "+": () => changeSpeed(WPM_STEP),
        "=": () => changeSpeed(WPM_STEP),
        "-": () => changeSpeed(-WPM_STEP),
        _: () => changeSpeed(-WPM_STEP),
      };
      const action = actions[event.key];
      if (!action) return;
      event.preventDefault();
      action();
    };
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener("keydown", listener, { capture: true });
    return () => window.removeEventListener("keydown", listener, { capture: true });
  }, []);

  useWakeLock();

  const remainingMs =
    drive === "speed" ? durations.slice(lineIndex).reduce((a, b) => a + b, 0) : null;

  return (
    <Presenter
      lines={lines}
      lineIndex={lineIndex}
      phase={playback.phase}
      countdown={playback.countdown}
      drive={drive}
      voiceStatus={voiceStatus.status}
      voiceSupported={isSpeechRecognitionSupported()}
      wordsPerMinute={wordsPerMinute}
      remainingMs={remainingMs}
      focus={focus}
      trackRef={setTrack}
      onLayout={handleLayout}
      onWheel={handleWheel}
      onToggle={() => dispatch({ type: "toggle" })}
      onPrevious={() => moveBy(-1, true)}
      onNext={() => moveBy(1, true)}
      onRestart={restart}
      onSlower={() => changeSpeed(-WPM_STEP)}
      onFaster={() => changeSpeed(WPM_STEP)}
      onSwitchDrive={switchDrive}
      onToggleFocus={onToggleFocus}
      onExit={onExit}
    />
  );
}

/** Mantém a tela acesa enquanto a sessão existir (quando o navegador suporta). */
function useWakeLock() {
  useEffect(() => {
    let sentinel: WakeLockSentinel | undefined;
    let released = false;

    const acquire = () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (released) lock.release().catch(() => {});
          else sentinel = lock;
        })
        .catch(() => {});
    };

    acquire();
    // O navegador libera o lock ao trocar de aba; readquire ao voltar.
    document.addEventListener("visibilitychange", acquire);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", acquire);
      sentinel?.release().catch(() => {});
    };
  }, []);
}
