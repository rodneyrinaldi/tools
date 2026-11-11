"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button, cx } from "@/design-system";
import { DIM_OPACITY, type DimLevel, type RecorderState, type Take } from "./camera";
import { CameraBar, RecIndicator } from "./CameraBar";
import type { Layout } from "./measure";
import type { Phase } from "./playback";
import { formatDuration, type Line } from "./script";
import type { BaseTextColor, Drive } from "./storage";
import { TakeActions } from "./Takes";
import { TokenView } from "./TokenView";
import type { SpeechStatus } from "./useSpeechRecognition";
import styles from "./Presenter.module.css";

/** Câmera ao fundo + gravação (modo câmera). */
export type CameraPresentation = {
  stream: MediaStream | null;
  error: string | null;
  hasAudio: boolean;
  /** Sem som de propósito: o microfone ficou com o reconhecimento de voz do navegador. */
  mutedForVoice: boolean;
  /** Câmera frontal aparece espelhada (como um espelho); a gravação sai normal. */
  mirrored: boolean;
  dim: DimLevel;
  recorder: RecorderState;
  canRecord: boolean;
  canFlip: boolean;
  elapsedMs: number;
  /** Última gravação concluída: mostra a prévia com baixar/compartilhar. */
  lastTake: Take | null;
  onRecord: () => void;
  onStop: () => void;
  onFlip: () => void;
  onTakeSaved: (id: string) => void;
  onCloseTake: () => void;
};

const IDLE_MS = 2500;

export type PresenterProps = {
  lines: Line[];
  lineIndex: number;
  phase: Phase;
  countdown: number;
  drive: Drive;
  voiceStatus: SpeechStatus;
  /** Modo voz rodando sem nenhuma fala reconhecida há alguns segundos. */
  voiceSilent: boolean;
  voiceSupported: boolean;
  wordsPerMinute: number;
  remainingMs: number | null;
  focus: boolean;
  textColor: BaseTextColor;
  /** Multiplicador do tamanho da letra. */
  fontScale: number;
  onSmallerText: () => void;
  onLargerText: () => void;
  camera: CameraPresentation | null;
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
  loading: "Preparando a voz…",
  starting: "Ligando microfone…",
  listening: "Ouvindo",
  denied: "Microfone bloqueado",
  busy: "Microfone ocupado",
  error: "Falha no reconhecimento",
};

const VOICE_PROBLEM_MESSAGE: Partial<Record<SpeechStatus, string>> = {
  denied:
    "O navegador bloqueou o microfone. Libere o acesso no ícone da barra de endereço ou use a velocidade.",
  busy: "O microfone está ocupado (pela câmera/gravação) e o reconhecimento de voz não consegue usá-lo neste aparelho. Use a velocidade — a gravação continua com som.",
  error:
    "O reconhecimento de voz falhou (sem internet?). Tente novamente ou use a velocidade.",
};

/** Na primeira vez o reconhecedor no aparelho baixa o modelo de voz (~32 MB). */
const VOICE_LOADING_MESSAGE =
  "Preparando o reconhecimento de voz no aparelho… Na primeira vez ele baixa cerca de 32 MB; depois funciona até sem internet.";

function PresenterView({
  lines,
  lineIndex,
  phase,
  countdown,
  drive,
  voiceStatus,
  voiceSilent,
  voiceSupported,
  wordsPerMinute,
  remainingMs,
  focus,
  textColor,
  fontScale,
  onSmallerText,
  onLargerText,
  camera,
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
  const idle = useIdle(focus && !camera);
  const voiceProblem = drive === "voice" && voiceStatus in VOICE_PROBLEM_MESSAGE;
  const voiceUnheard =
    drive === "voice" && !voiceProblem && voiceSilent && phase === "running";
  const controlsHidden =
    focus && !camera && idle && phase === "running" && !voiceProblem && !voiceUnheard;
  const progress = lines.length > 1 ? lineIndex / (lines.length - 1) : 1;
  const recording = camera !== null && camera.recorder !== "inactive";

  // Remede ao mudar o tamanho da letra: a largura da coluna pode não mudar (celular).
  useReportLayout(columnRef, onLayout, fontScale);
  useWheel(viewportRef, onWheel);

  return (
    <div
      className={cx(
        styles.root,
        focus ? styles.focus : styles.embedded,
        camera && styles.withCamera,
      )}
      data-hidden-controls={controlsHidden || undefined}
      data-text-color={textColor}
      style={{ "--tp-scale": fontScale } as CSSProperties}
      role="region"
      aria-label="Apresentação do teleprompter"
    >
      {camera && (
        <CameraLayer stream={camera.stream} mirrored={camera.mirrored} dim={camera.dim} />
      )}
      {camera && <RecIndicator recorder={camera.recorder} elapsedMs={camera.elapsedMs} />}

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

        {/* Esmaecimento do topo e da base, na largura toda (mais leve que mask-image). */}
        <div className={styles.fadeTop} aria-hidden />
        <div className={styles.fadeBottom} aria-hidden />

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

        {phase === "finished" && !camera?.lastTake && (
          <div className={cx(styles.overlay, recording && styles.overlaySoft)}>
            <span className={styles.end}>Fim</span>
            <div className={styles.overlayActions}>
              {recording ? (
                <Button size="lg" variant="danger" onClick={camera?.onStop}>
                  ⏹ Parar gravação
                </Button>
              ) : (
                <>
                  <Button variant="primary" onClick={onRestart}>
                    Reiniciar
                  </Button>
                  <Button variant="secondary" onClick={onExit}>
                    Voltar ao editor
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {camera && !camera.stream && !camera.error && (
          <div className={styles.cameraStatus} role="status">
            Ligando a câmera… Se o navegador perguntar, permita o acesso à câmera e ao
            microfone.
          </div>
        )}

        {camera?.stream && !camera.hasAudio && (
          <div className={styles.cameraStatus} role="status">
            {camera.mutedForVoice
              ? "Vídeo sem som: o microfone fica com o reconhecimento de voz do navegador."
              : "Sem microfone: o vídeo será gravado sem som."}
          </div>
        )}

        {drive === "voice" && voiceStatus === "loading" && phase === "running" && (
          <div className={styles.cameraStatus} role="status">
            {VOICE_LOADING_MESSAGE}
          </div>
        )}

        {camera?.error && (
          <div className={styles.alert} role="alert">
            {camera.error} Sem câmera, o texto continua funcionando (▶ Ensaiar).
          </div>
        )}

        {camera?.lastTake && (
          <div className={styles.overlay}>
            <div
              className={styles.takeSheet}
              role="dialog"
              aria-label="Gravação concluída"
            >
              <span className={styles.takeTitle}>Gravação concluída</span>
              <video
                className={styles.takeVideo}
                src={camera.lastTake.url}
                controls
                playsInline
              />
              <TakeActions
                take={camera.lastTake}
                onSaved={camera.onTakeSaved}
                size="lg"
              />
              <Button variant="ghost" onClick={camera.onCloseTake}>
                Voltar à câmera
              </Button>
            </div>
          </div>
        )}

        {voiceProblem && phase !== "finished" && (
          <div className={styles.alert} role="alert">
            {VOICE_PROBLEM_MESSAGE[voiceStatus]}
            <Button size="sm" variant="secondary" onClick={onSwitchDrive}>
              Usar velocidade
            </Button>
          </div>
        )}

        {voiceUnheard && (
          <div className={styles.alert} role="alert">
            Não estou ouvindo sua voz: o texto só anda quando a fala é reconhecida. Fale
            perto do microfone — ou use a velocidade.
            <Button size="sm" variant="secondary" onClick={onSwitchDrive}>
              Usar velocidade
            </Button>
          </div>
        )}
      </div>

      <div className={styles.progress} aria-hidden>
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>

      {camera && (
        <CameraBar
          phase={phase}
          recorder={camera.recorder}
          canRecord={camera.canRecord}
          canFlip={camera.canFlip}
          drive={drive}
          voiceStatus={voiceStatus}
          voiceSupported={voiceSupported}
          wordsPerMinute={wordsPerMinute}
          onRecord={camera.onRecord}
          onStop={camera.onStop}
          onToggle={onToggle}
          onPrevious={onPrevious}
          onNext={onNext}
          onSlower={onSlower}
          onFaster={onFaster}
          onSwitchDrive={onSwitchDrive}
          onFlip={camera.onFlip}
          onSmallerText={onSmallerText}
          onLargerText={onLargerText}
          onExit={onExit}
        />
      )}

      {!camera && (
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
            <Button
              size="sm"
              variant="ghost"
              onClick={onSmallerText}
              aria-label="Diminuir a letra ([)"
            >
              A−
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onLargerText}
              aria-label="Aumentar a letra (])"
            >
              A+
            </Button>
          </div>

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
      )}
    </div>
  );
}

/** Vídeo da câmera ao fundo, sob uma camada escura que deixa o texto legível. */
function CameraLayer({
  stream,
  mirrored,
  dim,
}: {
  stream: MediaStream | null;
  mirrored: boolean;
  dim: DimLevel;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.srcObject = stream;
    if (!stream) return;
    try {
      // Autoplay bloqueado não é erro: o vídeo começa ao primeiro toque.
      void video.play()?.catch(() => {});
    } catch {
      // ambiente sem suporte a mídia
    }
  }, [stream]);

  return (
    <div className={styles.cameraLayer} aria-hidden>
      <video
        ref={videoRef}
        className={cx(styles.cameraVideo, mirrored && styles.mirrored)}
        autoPlay
        muted
        playsInline
      />
      <div className={styles.cameraDim} style={{ opacity: DIM_OPACITY[dim] }} />
    </div>
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
  /** Muda quando o tamanho da letra muda: força nova medição. */
  remeasureKey: unknown,
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
  }, [ref, remeasureKey]);
}
