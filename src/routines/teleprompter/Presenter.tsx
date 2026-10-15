"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "@/design-system";
import type { Layout } from "./measure";
import type { Phase } from "./playback";
import { formatDuration, tokenLabel, type Line, type Token } from "./script";
import type { Drive } from "./storage";
import type { SpeechStatus } from "./useSpeechRecognition";
import styles from "./Presenter.module.css";

const IDLE_MS = 2500;

export type PresenterProps = {
  lines: Line[];
  lineIndex: number;
  phase: Phase;
  countdown: number;
  drive: Drive;
  voiceStatus: SpeechStatus;
  voiceSupported: boolean;
  wordsPerMinute: number;
  remainingMs: number | null;
  focus: boolean;
  /** A sessão posiciona a trilha diretamente (a cada quadro), sem re-renderizar. */
  trackRef: (element: HTMLDivElement | null) => void;
  onLayout: (layout: Layout) => void;
  onWheel: (deltaPixels: number) => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onRestart: () => void;
  onSlower: () => void;
  onFaster: () => void;
  onSwitchDrive: () => void;
  onToggleFocus: () => void;
  onExit: () => void;
};

export function Presenter(props: PresenterProps) {
  const content = <PresenterView {...props} />;
  return props.focus ? createPortal(content, document.body) : content;
}

const VOICE_LABEL: Record<SpeechStatus, string> = {
  idle: "Microfone pausado",
  starting: "Ligando microfone…",
  listening: "Ouvindo",
  denied: "Microfone bloqueado",
  error: "Falha no reconhecimento",
};

function PresenterView({
  lines,
  lineIndex,
  phase,
  countdown,
  drive,
  voiceStatus,
  voiceSupported,
  wordsPerMinute,
  remainingMs,
  focus,
  trackRef,
  onLayout,
  onWheel,
  onToggle,
  onPrevious,
  onNext,
  onRestart,
  onSlower,
  onFaster,
  onSwitchDrive,
  onToggleFocus,
  onExit,
}: PresenterProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const idle = useIdle(focus);
  const voiceProblem =
    drive === "voice" && (voiceStatus === "denied" || voiceStatus === "error");
  const controlsHidden = focus && idle && phase === "running" && !voiceProblem;
  const progress = lines.length > 1 ? lineIndex / (lines.length - 1) : 1;

  useReportLayout(columnRef, onLayout);
  useWheel(viewportRef, onWheel);

  return (
    <div
      className={cx(styles.root, focus ? styles.focus : styles.embedded)}
      data-hidden-controls={controlsHidden || undefined}
      role="region"
      aria-label="Apresentação do teleprompter"
    >
      <div ref={viewportRef} className={styles.viewport}>
        <div ref={columnRef} className={styles.column}>
          <div className={styles.guide} aria-hidden>
            <span className={styles.guideArrow}>▶</span>
          </div>
          <div ref={trackRef} className={styles.track}>
            {lines.map((line, index) => (
              <p
                key={line.start}
                className={cx(
                  styles.line,
                  index > 0 &&
                    lines[index - 1].paragraph !== line.paragraph &&
                    styles.paragraphStart,
                )}
                data-state={
                  index < lineIndex ? "past" : index === lineIndex ? "current" : "next"
                }
                aria-current={index === lineIndex ? "true" : undefined}
              >
                {line.tokens.map((token, i) => (
                  <TokenView key={i} token={token} first={i === 0} />
                ))}
              </p>
            ))}
          </div>
        </div>

        {phase === "countdown" && (
          <div className={styles.overlay}>
            <span className={styles.countdown} aria-live="assertive">
              {countdown}
            </span>
            <span className={styles.overlayHint}>
              {drive === "voice"
                ? "Comece a ler quando o texto aparecer — ele acompanha sua voz"
                : "Espaço para começar já"}
            </span>
          </div>
        )}

        {phase === "finished" && (
          <div className={styles.overlay}>
            <span className={styles.end}>Fim</span>
            <div className={styles.overlayActions}>
              <Button variant="primary" onClick={onRestart}>
                Reiniciar
              </Button>
              <Button variant="secondary" onClick={onExit}>
                Voltar ao editor
              </Button>
            </div>
          </div>
        )}

        {voiceProblem && phase !== "finished" && (
          <div className={styles.alert} role="alert">
            {voiceStatus === "denied"
              ? "O navegador bloqueou o microfone. Libere o acesso no ícone da barra de endereço ou use a velocidade."
              : "O reconhecimento de voz falhou (sem internet?). Tente novamente ou use a velocidade."}
            <Button size="sm" variant="secondary" onClick={onSwitchDrive}>
              Usar velocidade
            </Button>
          </div>
        )}
      </div>

      <div className={styles.progress} aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      <div className={styles.controls} aria-hidden={controlsHidden || undefined}>
        <div className={styles.group}>
          <Button
            size="sm"
            variant="ghost"
            onClick={onPrevious}
            aria-label="Voltar uma linha (↑)"
          >
            ↑
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={onToggle}
            disabled={phase === "finished"}
            className={styles.playButton}
          >
            {phase === "running"
              ? "Pausar"
              : phase === "countdown"
                ? "Começar"
                : "Continuar"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onNext}
            aria-label="Avançar uma linha (↓)"
          >
            ↓
          </Button>
        </div>

        {drive === "voice" ? (
          <span className={styles.voice} data-status={voiceStatus} aria-live="polite">
            <span className={styles.voiceDot} aria-hidden />
            {VOICE_LABEL[voiceStatus]}
          </span>
        ) : (
          <div className={styles.group}>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSlower}
              aria-label="Mais lento (−)"
            >
              −
            </Button>
            <span className={styles.speed} aria-live="polite">
              {wordsPerMinute} ppm
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={onFaster}
              aria-label="Mais rápido (+)"
            >
              +
            </Button>
          </div>
        )}

        <span className={styles.status}>
          {lineIndex + 1}/{lines.length}
          {remainingMs !== null && ` · ${formatDuration(remainingMs)}`}
        </span>

        <div className={styles.group}>
          {voiceSupported && (
            <Button size="sm" variant="ghost" onClick={onSwitchDrive}>
              {drive === "voice" ? "⏩ Velocidade" : "🎙 Voz"}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onRestart}>
            Reiniciar
          </Button>
          <Button size="sm" variant="secondary" onClick={onToggleFocus}>
            {focus ? "Encaixar" : "Modo foco"}
          </Button>
          <Button size="sm" variant="secondary" onClick={onExit}>
            Sair
          </Button>
        </div>
      </div>
    </div>
  );
}

function TokenView({ token, first }: { token: Token; first: boolean }) {
  const space = first || token.glue ? "" : " ";
  if (token.kind === "word") {
    return (
      <>
        {space}
        {token.emphasis ? (
          <strong className={styles.emphasis}>{token.text}</strong>
        ) : (
          token.text
        )}
      </>
    );
  }
  return (
    <>
      {space}
      <span
        className={cx(
          styles.marker,
          token.kind === "cue" ? styles.cue : token.breath ? styles.breath : styles.pause,
        )}
      >
        {tokenLabel(token)}
      </span>
    </>
  );
}

/** Fica `true` após IDLE_MS sem mexer o mouse/tocar a tela (só no modo foco). */
function useIdle(enabled: boolean) {
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let id = setTimeout(() => setIdle(true), IDLE_MS);
    const wake = () => {
      setIdle(false);
      clearTimeout(id);
      id = setTimeout(() => setIdle(true), IDLE_MS);
    };
    window.addEventListener("pointermove", wake);
    window.addEventListener("pointerdown", wake);
    return () => {
      clearTimeout(id);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("pointerdown", wake);
    };
  }, [enabled]);

  return idle;
}

/** Roda do mouse/trackpad reposiciona o texto (sem rolar a página por trás). */
function useWheel(
  ref: RefObject<HTMLElement | null>,
  onWheel: (deltaPixels: number) => void,
) {
  const onWheelRef = useRef(onWheel);
  useEffect(() => {
    onWheelRef.current = onWheel;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const listener = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      onWheelRef.current(event.deltaY * scale);
    };
    element.addEventListener("wheel", listener, { passive: false });
    return () => element.removeEventListener("wheel", listener);
  }, [ref]);
}

/** Informa largura e fonte reais da coluna para a quebra de linhas usar medição exata. */
function useReportLayout(
  ref: RefObject<HTMLElement | null>,
  onLayout: (layout: Layout) => void,
) {
  const onLayoutRef = useRef(onLayout);
  useEffect(() => {
    onLayoutRef.current = onLayout;
  });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const report = () => {
      const style = getComputedStyle(element);
      onLayoutRef.current({
        width:
          element.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight),
        font: `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
        fontSize: parseFloat(style.fontSize),
      });
    };

    const observer = new ResizeObserver(report);
    observer.observe(element);
    // Remede quando as webfonts terminarem de carregar.
    document.fonts?.ready.then(report).catch(() => {});
    return () => observer.disconnect();
  }, [ref]);
}
