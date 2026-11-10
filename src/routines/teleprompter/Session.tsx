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
import type { DimLevel, Facing, Take } from "./camera";
import type { BaseTextColor, Drive } from "./storage";
import { useCamera } from "./useCamera";
import { useRecorder } from "./useRecorder";
import {
  isSpeechRecognitionSupported,
  useSpeechRecognition,
} from "./useSpeechRecognition";
import {
  buildWordIndex,
  cursorForPosition,
  positionForCursor,
  trackSpoken,
} from "./voice";

const MIN_WPM = 60;
const MAX_WPM = 300;
const WPM_STEP = 10;
/** Constante de tempo da suavização no modo voz: o texto "desliza" até a palavra dita. */
const VOICE_SMOOTHING_MS = 220;
/** Velocidade mínima de aproximação no modo voz (linhas por ms). */
const VOICE_MIN_SPEED = 0.0015;
const FALLBACK_FONT_PX = 32;

export type CameraOptions = { dim: DimLevel; facing: Facing };

type SessionProps = {
  text: string;
  drive: Drive;
  initialWordsPerMinute: number;
  holdPauses: boolean;
  countdown: number;
  textColor: BaseTextColor;
  /** Câmera ao fundo com gravação; `null` = sem câmera. */
  camera: CameraOptions | null;
  onTake: (take: Take) => void;
  onTakeSaved: (id: string) => void;
  focus: boolean;
  onToggleFocus: () => void;
  onExit: () => void;
  /** Pede tela cheia ao navegador (precisa de um toque/clique da pessoa). */
  onRequestFullscreen: () => void;
};

/** Uma apresentação em andamento: rolagem contínua conduzida pela voz ou por velocidade. */
export function Session({
  text,
  drive: initialDrive,
  initialWordsPerMinute,
  holdPauses,
  countdown,
  textColor,
  camera: cameraOptions,
  onTake,
  onTakeSaved,
  focus,
  onToggleFocus,
  onExit,
  onRequestFullscreen,
}: SessionProps) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const [wordsPerMinute, setWordsPerMinute] = useState(initialWordsPerMinute);
  const [drive, setDrive] = useState<Drive>(() =>
    initialDrive === "voice" && isSpeechRecognitionSupported() ? "voice" : "speed",
  );
  // Com câmera, espera a pessoa apertar Gravar ou Ensaiar.
  const [playback, dispatch] = useReducer(
    playbackReducer,
    { countdown, autoStart: !cameraOptions },
    (init) => initialPlayback(init.countdown, init.autoStart),
  );

  // Câmera e gravação.
  const [facing, setFacing] = useState<Facing>(cameraOptions?.facing ?? "user");
  const camera = useCamera(Boolean(cameraOptions), facing);
  const [lastTake, setLastTake] = useState<Take | null>(null);
  const recorder = useRecorder(camera.stream, (take) => {
    setLastTake(take);
    onTake(take);
  });
  /** Gravar foi pedido: a gravação começa quando a contagem terminar. */
  const recordIntent = useRef(false);
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
  // cursor/pending: acompanhamento da voz (ver trackSpoken).
  const engine = useRef({
    position: 0,
    target: 0,
    token: 0,
    cursor: 0,
    pending: null as number | null,
  });
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

  // Texto re-quebrado (medição inicial da fonte, redimensionar, trocar de visualização):
  // mantém o ponto de leitura. O cursor da voz é um índice de palavra — não muda com a
  // quebra — então só o alvo é recalculado, e nunca para trás da posição atual.
  useEffect(() => {
    const e = engine.current;
    e.position = tokenToPosition(lines, e.token);
    e.target = Math.max(e.position, positionForCursor(words, e.cursor, lines.length));
    paint();
  }, [lines, words, paint]);

  // Contagem regressiva (ao chegar a zero, começa a gravação pedida).
  const startRecording = recorder.start;
  useEffect(() => {
    if (playback.phase !== "countdown") return;
    const id = setTimeout(() => {
      if (playback.countdown <= 1 && recordIntent.current) {
        recordIntent.current = false;
        startRecording();
      }
      dispatch({ type: "tick" });
    }, 1000);
    return () => clearTimeout(id);
  }, [playback.phase, playback.countdown, startRecording]);

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
      const next = trackSpoken(words, { cursor: e.cursor, pending: e.pending }, heard);
      e.pending = next.pending;
      if (next.cursor === e.cursor) return;
      e.cursor = next.cursor;
      e.target = positionForCursor(words, next.cursor, lines.length);
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
      e.pending = null;
      commit(position);
      forgetHeard();
      dispatch({ type: "moved" });
    },
    [commit, forgetHeard],
  );

  const restart = useCallback(() => {
    engine.current.target = 0;
    engine.current.cursor = 0;
    engine.current.pending = null;
    commit(0);
    forgetHeard();
    dispatch({ type: "restart", countdown });
  }, [commit, forgetHeard, countdown]);

  /**
   * No modo câmera, a tela cheia do navegador é pedida no primeiro toque em Gravar/Ensaiar —
   * e não ao abrir: no Android, o pedido de permissão da câmera derruba a tela cheia.
   */
  function fullscreenOnGesture() {
    if (cameraOptions && typeof document !== "undefined" && !document.fullscreenElement) {
      onRequestFullscreen();
    }
  }

  /** Pausa/continua o texto e, se estiver gravando, a gravação junto. */
  function togglePlay() {
    if (playback.phase === "paused") fullscreenOnGesture();
    if (playback.phase === "countdown" && recordIntent.current) {
      recordIntent.current = false;
      recorder.start();
    } else if (recorder.state === "recording") {
      recorder.pause();
    } else if (recorder.state === "paused") {
      recorder.resume();
    }
    dispatch({ type: "toggle" });
  }

  /** Gravar: contagem regressiva e então grava e rola o texto a partir da posição atual. */
  function record() {
    if (!camera.stream || !recorder.supported || recorder.state !== "inactive") return;
    fullscreenOnGesture();
    setLastTake(null);
    if (playback.phase === "finished") {
      engine.current = { ...engine.current, target: 0, cursor: 0, pending: null };
      commit(0);
      forgetHeard();
    }
    if (countdown > 0) recordIntent.current = true;
    else recorder.start();
    dispatch({ type: "start", countdown });
  }

  async function stopRecording() {
    recordIntent.current = false;
    await recorder.stop();
    dispatch({ type: "pause" });
  }

  /** Sair: encerra a gravação em andamento (ela vai para a lista) antes de sair. */
  async function exit() {
    if (recorder.state !== "inactive") await recorder.stop();
    onExit();
  }

  function changeSpeed(delta: number) {
    if (drive !== "speed") return;
    setWordsPerMinute((wpm) => clamp(wpm + delta, MIN_WPM, MAX_WPM));
  }

  function switchDrive() {
    const e = engine.current;
    e.target = e.position;
    e.cursor = cursorForPosition(latest.current.words, e.position);
    e.pending = null;
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
        " ": togglePlay,
        Escape: focus && !cameraOptions ? onToggleFocus : () => void exit(),
        g: () => (recorder.state === "inactive" ? record() : void stopRecording()),
        G: () => (recorder.state === "inactive" ? record() : void stopRecording()),
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
      // O modo câmera sempre cobre a tela inteira, com ou sem a tela cheia do navegador.
      focus={focus || Boolean(cameraOptions)}
      textColor={textColor}
      camera={
        cameraOptions && {
          stream: camera.stream,
          error: camera.error,
          hasAudio: camera.hasAudio,
          mirrored: facing === "user",
          dim: cameraOptions.dim,
          recorder: recorder.state,
          canRecord: Boolean(camera.stream) && recorder.supported,
          canFlip: camera.cameraCount > 1,
          elapsedMs: recorder.elapsedMs,
          lastTake,
          onRecord: record,
          onStop: () => void stopRecording(),
          onFlip: () => setFacing((f) => (f === "user" ? "environment" : "user")),
          onTakeSaved,
          onCloseTake: () => setLastTake(null),
        }
      }
      trackRef={setTrack}
      onLayout={handleLayout}
      onWheel={handleWheel}
      onToggle={togglePlay}
      onPrevious={() => moveBy(-1, true)}
      onNext={() => moveBy(1, true)}
      onRestart={restart}
      onSlower={() => changeSpeed(-WPM_STEP)}
      onFaster={() => changeSpeed(WPM_STEP)}
      onSwitchDrive={switchDrive}
      onToggleFocus={onToggleFocus}
      onExit={() => void exit()}
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
