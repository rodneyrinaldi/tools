"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, SegmentedControl, TextArea, TextField } from "@/design-system";
import {
  estimateDurationMs,
  formatDuration,
  parseScript,
  SPEEDS,
  type SpeedPreset,
} from "./script";
import { autoMark, hasMarks, stripMarks } from "./autoMark";
import { isSpeechRecognitionSupported } from "./useSpeechRecognition";
import { clampCountdown, type Preferences } from "./storage";
import styles from "./Editor.module.css";

const SPEED_OPTIONS = [
  { value: "slow", label: "Lento" },
  { value: "normal", label: "Normal" },
  { value: "fast", label: "Rápido" },
] as const satisfies readonly { value: SpeedPreset; label: string }[];

const PAUSE_OPTIONS = [
  { value: "visual", label: "Só visuais" },
  { value: "hold", label: "Seguram o texto" },
] as const;

type Insertion = { label: string; before: string; after?: string; placeholder?: string };

const INSERTIONS: Insertion[] = [
  { label: "⏸ Pausa", before: "[pausa 2]" },
  { label: "Respira", before: "[respira]" },
  { label: "Ênfase", before: "*", after: "*", placeholder: "palavra" },
  { label: "Indicação", before: "[", after: "]", placeholder: "sorria" },
];

function formatDelta(delta: number) {
  if (delta === 0) return "Nada a sugerir";
  const count = Math.abs(delta);
  return `${delta > 0 ? "+" : "−"}${count} ${count === 1 ? "marcação" : "marcações"}`;
}

type EditorProps = {
  preferences: Preferences;
  onChange: (next: Partial<Preferences>) => void;
  onStart: (focus: boolean) => void;
};

export function Editor({ preferences, onChange, onStart }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  // Última ação do botão Auto (inserir ou remover) — desfazível enquanto o texto não for editado.
  const [lastAuto, setLastAuto] = useState<{
    before: string;
    after: string;
    /** Positivo: marcações inseridas; negativo: removidas. */
    delta: number;
  } | null>(null);
  const canUndoAuto = lastAuto !== null && lastAuto.after === preferences.text;
  const marked = hasMarks(preferences.text);

  const paragraphs = parseScript(preferences.text);
  const isEmpty = paragraphs.length === 0;
  const voiceSupported = isSpeechRecognitionSupported();
  const drive = voiceSupported ? preferences.drive : "speed";
  const estimate = estimateDurationMs(
    paragraphs,
    drive === "voice" ? SPEEDS.normal : SPEEDS[preferences.speed],
  );

  useEffect(() => {
    if (!confirmingClear) return;
    const id = setTimeout(() => setConfirmingClear(false), 3000);
    return () => clearTimeout(id);
  }, [confirmingClear]);

  function insert({ before, after = "", placeholder = "" }: Insertion) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart: start, selectionEnd: end, value } = textarea;
    const selected = value.slice(start, end) || placeholder;
    const needsSpace = start > 0 && !/\s/.test(value[start - 1]);
    const snippet = `${needsSpace ? " " : ""}${before}${selected}${after}`;
    onChange({ text: value.slice(0, start) + snippet + value.slice(end) });

    requestAnimationFrame(() => {
      textarea.focus();
      const selectionStart = start + snippet.length - after.length - selected.length;
      textarea.setSelectionRange(selectionStart, selectionStart + selected.length);
    });
  }

  /**
   * Alterna as marcações da seleção (ou, sem seleção, do roteiro inteiro):
   * sem marcações → insere automaticamente; com marcações → remove todas.
   */
  function toggleAutoMarks() {
    const textarea = textareaRef.current;
    const value = preferences.text;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    const hasSelection = end > start;

    const target = hasSelection ? value.slice(start, end) : value;
    let text: string;
    let delta: number;
    if (hasMarks(target)) {
      const result = stripMarks(target);
      text = result.text;
      delta = -result.removed;
    } else {
      const result = autoMark(target);
      text = result.text;
      delta = result.added;
    }
    const next = hasSelection ? value.slice(0, start) + text + value.slice(end) : text;

    setLastAuto({ before: value, after: next, delta });
    if (delta !== 0) onChange({ text: next });
  }

  function undoAutoMarks() {
    if (!lastAuto) return;
    onChange({ text: lastAuto.before });
    setLastAuto(null);
  }

  function clear() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    setConfirmingClear(false);
    onChange({ text: "" });
    textareaRef.current?.focus();
  }

  return (
    <div className={styles.root}>
      <TextArea
        ref={textareaRef}
        label="Roteiro"
        hint="Separe parágrafos com uma linha em branco. Linhas iniciadas por // são notas e não aparecem."
        placeholder={
          "Olá! Hoje vou mostrar… [pausa]\n\nNo próximo parágrafo, *destaque* o que importa. [sorria]"
        }
        value={preferences.text}
        onChange={(event) => onChange({ text: event.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !isEmpty) {
            event.preventDefault();
            onStart(false);
          }
        }}
        rows={12}
        spellCheck
      />

      <div className={styles.markers} role="group" aria-label="Inserir marcação">
        <span className={styles.markersLabel}>Inserir:</span>
        {INSERTIONS.map((insertion) => (
          <Button
            key={insertion.label}
            size="sm"
            variant="secondary"
            onClick={() => insert(insertion)}
          >
            {insertion.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={marked ? "secondary" : "primary"}
          onClick={toggleAutoMarks}
          disabled={isEmpty}
          aria-pressed={marked}
          title={
            marked
              ? "Remove todas as marcações (na seleção, se houver)"
              : "Insere pausas, respiros, indicações e ênfases onde for mais apropriado (na seleção, se houver)"
          }
        >
          {marked ? "✨ Remover marcações" : "✨ Auto"}
        </Button>
        {canUndoAuto && lastAuto.delta !== 0 && (
          <Button size="sm" variant="ghost" onClick={undoAutoMarks}>
            Desfazer
          </Button>
        )}
        <span className={styles.autoStatus} role="status">
          {canUndoAuto && formatDelta(lastAuto.delta)}
        </span>
      </div>

      <div className={styles.settings}>
        <SegmentedControl
          label="Condução"
          options={[
            { value: "voice", label: "🎙 Voz", disabled: !voiceSupported },
            { value: "speed", label: "⏩ Velocidade" },
          ]}
          value={drive}
          onChange={(next) => onChange({ drive: next })}
        />
        {drive === "speed" && (
          <>
            <SegmentedControl
              label="Velocidade"
              options={SPEED_OPTIONS}
              value={preferences.speed}
              onChange={(speed) => onChange({ speed })}
            />
            <SegmentedControl
              label="Pausas marcadas"
              options={PAUSE_OPTIONS}
              value={preferences.holdPauses ? "hold" : "visual"}
              onChange={(value) => onChange({ holdPauses: value === "hold" })}
            />
          </>
        )}
        <TextField
          label="Contagem regressiva (s)"
          type="number"
          inputMode="numeric"
          min={0}
          max={60}
          value={preferences.countdown}
          onChange={(event) =>
            onChange({ countdown: clampCountdown(event.target.valueAsNumber) })
          }
          className={styles.countdown}
        />
        <div className={styles.estimate}>
          <span className={styles.estimateLabel}>Duração estimada</span>
          <Badge tone="accent">
            {isEmpty ? "—" : `≈ ${formatDuration(estimate)}`} ·{" "}
            {drive === "voice" ? "no seu ritmo" : `${SPEEDS[preferences.speed]} ppm`}
          </Badge>
        </div>
      </div>

      <p className={styles.driveHint}>
        {drive === "voice"
          ? "O texto acompanha sua fala: leia no seu ritmo, pule ou repita trechos. Usa o reconhecimento de voz do navegador — no Chrome, o áudio é processado pelo Google. ↑ ↓ ou a roda do mouse reposicionam a qualquer momento."
          : voiceSupported
            ? "Rolagem em velocidade constante. Durante a leitura: + e − ajustam a velocidade, ↑ ↓ ou a roda do mouse reposicionam, Espaço pausa."
            : "Rolagem em velocidade constante. Para o texto seguir sua voz, use Chrome ou Edge."}
      </p>

      <div className={styles.actions}>
        <Button variant="ghost" onClick={clear} disabled={!preferences.text}>
          {confirmingClear ? "Confirmar limpeza" : "Limpar"}
        </Button>
        <span className={styles.spacer} />
        <Button variant="secondary" onClick={() => onStart(false)} disabled={isEmpty}>
          Iniciar
        </Button>
        <Button variant="primary" onClick={() => onStart(true)} disabled={isEmpty}>
          Iniciar em modo foco
        </Button>
      </div>
    </div>
  );
}
