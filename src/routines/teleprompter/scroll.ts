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

/** Avança `p` por `elapsedMs`, respeitando a duração de cada linha (linhas densas rolam mais devagar). */
export function advance(
  position: number,
  elapsedMs: number,
  durations: number[],
): number {
  let p = position;
  let rest = elapsedMs;
  while (rest > 0 && p < durations.length) {
    const index = Math.floor(p);
    const duration = Math.max(1, durations[index]);
    const remaining = (1 - (p - index)) * duration;
    if (rest < remaining) {
      p += rest / duration;
      rest = 0;
    } else {
      p = index + 1;
      rest -= remaining;
    }
  }
  return Math.min(p, durations.length);
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
