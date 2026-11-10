/**
 * Geometria da rolagem contínua (puro).
 * A posição de leitura `p` é um número de linhas fracionário: 2.5 = metade da linha 2 passou pela guia.
 * `p === lines.length` significa que o roteiro terminou.
 */
import { lineIndexAt, type Line } from "./script";

/** Altura de linha e espaço entre parágrafos, em em (precisam bater com o CSS). */
export const LINE_HEIGHT_EM = 1.5;
export const PARAGRAPH_GAP_EM = 1;

export function lineTopEm(lines: Line[], index: number): number {
  const paragraph = lines[Math.min(index, lines.length - 1)]?.paragraph ?? 0;
  return index * LINE_HEIGHT_EM + paragraph * PARAGRAPH_GAP_EM;
}

/** Deslocamento vertical (em) da trilha de texto para a posição `p`. */
export function offsetEm(lines: Line[], position: number): number {
  if (lines.length === 0) return 0;
  const index = clamp(Math.floor(position), 0, lines.length - 1);
  const fraction = clamp(position - index, 0, 1);
  const top = lineTopEm(lines, index);
  const nextTop =
    index + 1 < lines.length ? lineTopEm(lines, index + 1) : top + LINE_HEIGHT_EM;
  return top + fraction * (nextTop - top);
}

export function currentLineIndex(lines: Line[], position: number): number {
  return clamp(Math.floor(position), 0, Math.max(0, lines.length - 1));
}

export type Motion = { position: number; velocity: number };

/** Tempo para a velocidade se ajustar quando o trecho muda (evita solavancos). */
export const SPEED_SMOOTHING_MS = 600;
/** Janela de linhas usada para a velocidade: a anterior e as seguintes. */
const WINDOW_BEFORE = 1;
const WINDOW_AFTER = 3;

/**
 * Velocidade-alvo (linhas/ms) em torno da linha atual: média de uma janela de linhas, para
 * a rolagem ficar praticamente constante — linhas curtas e longas não fazem o texto "pulsar".
 * Pausas que seguram o texto continuam desacelerando o trecho delas.
 */
export function windowVelocity(durations: number[], lineIndex: number): number {
  const from = Math.max(0, lineIndex - WINDOW_BEFORE);
  const to = Math.min(durations.length - 1, lineIndex + WINDOW_AFTER);
  let total = 0;
  for (let i = from; i <= to; i++) total += Math.max(1, durations[i]);
  return (to - from + 1) / total;
}

/**
 * Altura de cada linha em "linhas": 1, ou mais na última linha do parágrafo (que percorre
 * também o espaço até o próximo). Usada para a rolagem ter a mesma velocidade na tela.
 */
export function lineSpans(lines: Line[]): number[] {
  return lines.map((_, i) =>
    i + 1 < lines.length
      ? (lineTopEm(lines, i + 1) - lineTopEm(lines, i)) / LINE_HEIGHT_EM
      : 1,
  );
}

/**
 * Modo velocidade: rolagem contínua quase constante. `velocity` em linhas/ms;
 * `null` = começar já na velocidade do trecho atual. `spans` (ver lineSpans) mantém a
 * velocidade na tela igual também na passagem entre parágrafos.
 */
export function stepSpeed(
  position: number,
  velocity: number | null,
  elapsedMs: number,
  durations: number[],
  spans?: number[],
): Motion {
  const end = durations.length;
  if (position >= end) return { position: end, velocity: 0 };
  const index = Math.floor(position);
  const target = windowVelocity(durations, index);
  const v =
    velocity === null
      ? target
      : velocity + (target - velocity) * (1 - Math.exp(-elapsedMs / SPEED_SMOOTHING_MS));
  const span = spans?.[index] ?? 1;
  return { position: Math.min(end, position + (v * elapsedMs) / span), velocity: v };
}

/** Rigidez da mola do modo voz (ω, em 1/ms): ~0,25 s até meio caminho, ~0,9 s até chegar. */
export const VOICE_SPRING = 0.007;
const SUBSTEP_MS = 8;

/**
 * Modo voz: mola criticamente amortecida até o alvo — acelera e freia suave, sem
 * ultrapassar e sem recuar quando o alvo está à frente.
 */
export function stepSpring(
  position: number,
  velocity: number,
  target: number,
  elapsedMs: number,
): Motion {
  const ahead = target >= position;
  let p = position;
  let v = velocity;
  for (let rest = elapsedMs; rest > 0; rest -= SUBSTEP_MS) {
    const dt = Math.min(rest, SUBSTEP_MS);
    const acceleration =
      VOICE_SPRING * VOICE_SPRING * (target - p) - 2 * VOICE_SPRING * v;
    v += acceleration * dt;
    if (ahead ? v < 0 : v > 0) v = 0;
    p += v * dt;
  }
  const passed = ahead ? p > target : p < target;
  if (passed || (Math.abs(target - p) < 0.01 && Math.abs(v) < 0.0005)) {
    return { position: target, velocity: 0 };
  }
  return { position: p, velocity: v };
}

/** Posição em "tokens" (estável entre re-quebras de linha) ↔ posição em linhas. */
export function positionToToken(lines: Line[], position: number): number {
  if (lines.length === 0) return 0;
  if (position >= lines.length) {
    const last = lines[lines.length - 1];
    return last.start + last.tokens.length;
  }
  const index = currentLineIndex(lines, position);
  return lines[index].start + (position - index) * lines[index].tokens.length;
}

export function tokenToPosition(lines: Line[], token: number): number {
  if (lines.length === 0) return 0;
  const last = lines[lines.length - 1];
  if (token >= last.start + last.tokens.length) return lines.length;
  const index = lineIndexAt(lines, Math.floor(token));
  const line = lines[index];
  return index + clamp((token - line.start) / line.tokens.length, 0, 0.999);
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
