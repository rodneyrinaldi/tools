"use client";

import { Button, cx } from "@/design-system";
import { formatClock, type RecorderState } from "./camera";
import type { Phase } from "./playback";
import type { Drive } from "./storage";
import type { SpeechStatus } from "./useSpeechRecognition";
import styles from "./CameraBar.module.css";

const VOICE_SHORT: Record<SpeechStatus, string> = {
  idle: "Voz pausada",
  starting: "Ligando…",
  listening: "Ouvindo",
  denied: "Mic bloqueado",
  busy: "Mic ocupado",
  error: "Falha na voz",
};

export type CameraBarProps = {
  phase: Phase;
  recorder: RecorderState;
  canRecord: boolean;
  canFlip: boolean;
  drive: Drive;
  voiceStatus: SpeechStatus;
  voiceSupported: boolean;
  wordsPerMinute: number;
  onRecord: () => void;
  onStop: () => void;
  onToggle: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSlower: () => void;
  onFaster: () => void;
  onSwitchDrive: () => void;
  onFlip: () => void;
  onSmallerText: () => void;
  onLargerText: () => void;
  onExit: () => void;
};

/** Controles do modo câmera, para toque: ações principais grandes, ao alcance do polegar. */
export function CameraBar(props: CameraBarProps) {
  const { phase, recorder, drive } = props;
  const recording = recorder !== "inactive";
  const running = phase === "running";

  return (
    <div className={styles.bar}>
      <div className={styles.secondary}>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onPrevious}
          aria-label="Voltar uma linha"
        >
          ↑
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onNext}
          aria-label="Avançar uma linha"
        >
          ↓
        </Button>
        {drive === "voice" ? (
          <span
            className={styles.voice}
            data-status={props.voiceStatus}
            aria-live="polite"
          >
            <span className={styles.dot} aria-hidden />
            {VOICE_SHORT[props.voiceStatus]}
          </span>
        ) : (
          <span className={styles.speed}>
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onSlower}
              aria-label="Mais lento"
            >
              −
            </Button>
            <span aria-live="polite">{props.wordsPerMinute} ppm</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={props.onFaster}
              aria-label="Mais rápido"
            >
              +
            </Button>
          </span>
        )}
        {props.voiceSupported && (
          <Button size="sm" variant="ghost" onClick={props.onSwitchDrive}>
            {drive === "voice" ? "⏩ Velocidade" : "🎙 Voz"}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onSmallerText}
          aria-label="Diminuir a letra"
        >
          A−
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onLargerText}
          aria-label="Aumentar a letra"
        >
          A+
        </Button>
        {props.canFlip && !recording && (
          <Button
            size="sm"
            variant="ghost"
            onClick={props.onFlip}
            aria-label="Trocar de câmera"
          >
            🔄
          </Button>
        )}
      </div>

      <div className={styles.primary}>
        <Button
          size="lg"
          variant="secondary"
          onClick={props.onExit}
          className={styles.side}
        >
          Sair
        </Button>

        {recording ? (
          <Button
            size="lg"
            variant="primary"
            onClick={props.onToggle}
            className={styles.main}
            aria-label={
              recorder === "recording" ? "Pausar gravação" : "Continuar gravação"
            }
          >
            {recorder === "recording" ? "⏸" : "▶"}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="danger"
            onClick={props.onRecord}
            disabled={!props.canRecord || phase === "countdown"}
            className={cx(styles.main, styles.rec)}
            aria-label="Gravar"
          >
            <span className={styles.recDot} aria-hidden />
          </Button>
        )}

        {recording ? (
          <Button
            size="lg"
            variant="danger"
            onClick={props.onStop}
            className={styles.side}
          >
            ⏹ Parar
          </Button>
        ) : (
          <Button
            size="lg"
            variant="secondary"
            onClick={props.onToggle}
            disabled={phase === "finished"}
            className={styles.side}
          >
            {running ? "⏸ Pausar" : phase === "countdown" ? "Começar" : "▶ Ensaiar"}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Indicador fixo de gravação: ● REC 01:23 / ⏸ PAUSADO. */
export function RecIndicator({
  recorder,
  elapsedMs,
}: {
  recorder: RecorderState;
  elapsedMs: number;
}) {
  if (recorder === "inactive") return null;
  return (
    <div className={styles.indicator} data-state={recorder} role="status">
      <span className={styles.indicatorDot} aria-hidden />
      {recorder === "recording" ? "REC" : "PAUSADO"} {formatClock(elapsedMs)}
    </div>
  );
}
