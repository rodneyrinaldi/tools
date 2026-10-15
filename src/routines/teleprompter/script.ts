/**
 * Lógica pura do teleprompter: transforma o roteiro em tokens, quebra em linhas
 * de largura fixa e calcula quanto tempo cada linha fica no topo.
 */

export type Token =
  | { kind: "word"; text: string; emphasis: boolean; glue: boolean }
  | { kind: "cue"; text: string; glue: boolean }
  | { kind: "pause"; seconds: number; breath: boolean; glue: boolean };

export type Paragraph = Token[];

export type Line = {
  tokens: Token[];
  paragraph: number;
  /** Índice global (no roteiro todo) do primeiro token da linha — posição estável entre re-quebras. */
  start: number;
  isLastInParagraph: boolean;
};

export type Measurer = {
  /** Largura de um texto na fonte da apresentação. */
  text: (value: string) => number;
  /** Tamanho de 1em na mesma unidade de `text`. */
  em: number;
};

export const SPEEDS = { slow: 110, normal: 140, fast: 175 } as const;
export type SpeedPreset = keyof typeof SPEEDS;

export const DEFAULT_PAUSE_SECONDS = 2;
export const BREATH_SECONDS = 1;
/** Tempo mínimo de uma linha com texto, para não "piscar" em linhas muito curtas. */
export const MIN_LINE_MS = 700;

const TOKEN_PATTERN = /\[([^\]\n]*)\]|\*([^*\n]+)\*|\S+/g;
const PAUSE_PATTERN = /^pausa(?:\s+(\d+(?:[.,]\d+)?)\s*s?)?$/i;
const BREATH_PATTERN = /^respira$/i;

export function parseScript(source: string): Paragraph[] {
  const withoutNotes = source
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  return withoutNotes
    .split(/\n\s*\n/)
    .map(parseParagraph)
    .filter((paragraph) => paragraph.length > 0);
}

function parseParagraph(text: string): Paragraph {
  const tokens: Token[] = [];
  let previousEnd = -1;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const glue = match.index === previousEnd;
    previousEnd = match.index + match[0].length;
    const [raw, bracket, emphasis] = match;

    if (bracket !== undefined) {
      const content = bracket.trim();
      const pause = PAUSE_PATTERN.exec(content);
      if (pause) {
        const seconds = pause[1]
          ? Number(pause[1].replace(",", "."))
          : DEFAULT_PAUSE_SECONDS;
        tokens.push({ kind: "pause", seconds, breath: false, glue });
      } else if (BREATH_PATTERN.test(content)) {
        tokens.push({ kind: "pause", seconds: BREATH_SECONDS, breath: true, glue });
      } else if (content) {
        tokens.push({ kind: "cue", text: content, glue });
      }
    } else if (emphasis !== undefined) {
      emphasis
        .trim()
        .split(/\s+/)
        .forEach((word, i) =>
          tokens.push({
            kind: "word",
            text: word,
            emphasis: true,
            glue: glue && i === 0,
          }),
        );
    } else {
      tokens.push({ kind: "word", text: raw, emphasis: false, glue });
    }
  }

  return tokens;
}

export function tokenLabel(token: Token): string {
  switch (token.kind) {
    case "word":
      return token.text;
    case "cue":
      return token.text;
    case "pause":
      return token.breath ? "respira" : `⏸ ${formatSeconds(token.seconds)}`;
  }
}

function formatSeconds(seconds: number) {
  return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
}

/** Largura de um token; etiquetas e indicações usam fonte menor + respiro lateral. */
export function tokenWidth(token: Token, measure: Measurer): number {
  if (token.kind === "word") return measure.text(token.text);
  return measure.text(tokenLabel(token)) * 0.6 + measure.em * 0.8;
}

/** Quebra gulosa: cada linha recebe o máximo de tokens que cabem em `maxWidth`. */
export function wrapScript(
  paragraphs: Paragraph[],
  maxWidth: number,
  measure: Measurer,
): Line[] {
  const lines: Line[] = [];
  const space = measure.text(" ");
  let globalIndex = 0;

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const firstLineOfParagraph = lines.length;
    let current: Token[] = [];
    let currentStart = globalIndex;
    let width = 0;

    paragraph.forEach((token) => {
      const tokenW = tokenWidth(token, measure);
      const gap = current.length > 0 && !token.glue ? space : 0;

      if (current.length > 0 && width + gap + tokenW > maxWidth) {
        lines.push({
          tokens: current,
          paragraph: paragraphIndex,
          start: currentStart,
          isLastInParagraph: false,
        });
        current = [];
        currentStart = globalIndex;
        width = 0;
      }

      width += (current.length > 0 && !token.glue ? space : 0) + tokenW;
      current.push(token);
      globalIndex += 1;
    });

    if (current.length > 0) {
      lines.push({
        tokens: current,
        paragraph: paragraphIndex,
        start: currentStart,
        isLastInParagraph: true,
      });
    } else if (lines.length > firstLineOfParagraph) {
      lines[lines.length - 1].isLastInParagraph = true;
    }
  });

  return lines;
}

/** Tempo que a linha leva para passar pela guia; com `holdPauses`, soma as pausas marcadas. */
export function lineDurationMs(
  tokens: Token[],
  wordsPerMinute: number,
  holdPauses = true,
): number {
  let words = 0;
  let pauseMs = 0;
  for (const token of tokens) {
    if (token.kind === "word") words += 1;
    if (token.kind === "pause" && holdPauses) pauseMs += token.seconds * 1000;
  }
  const readingMs =
    words > 0 ? Math.max(MIN_LINE_MS, (words / wordsPerMinute) * 60_000) : 0;
  return Math.max(readingMs + pauseMs, pauseMs > 0 ? 0 : MIN_LINE_MS);
}

export function estimateDurationMs(paragraphs: Paragraph[], wordsPerMinute: number) {
  const tokens = paragraphs.flat();
  const words = tokens.filter((t) => t.kind === "word").length;
  const pauses = tokens.reduce((sum, t) => sum + (t.kind === "pause" ? t.seconds : 0), 0);
  return (words / wordsPerMinute) * 60_000 + pauses * 1000;
}

/** Índice da linha que contém o token global `position` (posição de leitura estável). */
export function lineIndexAt(lines: Line[], position: number): number {
  let index = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].start <= position) index = i;
    else break;
  }
  return index;
}

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0
    ? `${minutes} min ${String(seconds).padStart(2, "0")} s`
    : `${seconds} s`;
}
