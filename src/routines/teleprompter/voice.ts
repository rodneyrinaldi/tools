/**
 * "Seguir a voz" (puro): alinha as palavras reconhecidas pelo microfone com o roteiro.
 *
 * O cursor aponta para a próxima palavra a ser dita. A cada transcrição, procuramos as
 * últimas palavras faladas numa janela em torno do cursor, tolerando erros de reconhecimento
 * (acentos, plurais, palavras cortadas) e palavras puladas.
 */
import type { Line } from "./script";

export type ScriptWord = {
  norm: string;
  line: number;
  indexInLine: number;
  wordsInLine: number;
};

/** Quantas palavras faladas recentes entram no alinhamento. */
export const RECENT_WORDS = 6;
/** Janela de busca em torno do cursor (em palavras). */
export const LOOK_BEHIND = 12;
export const LOOK_AHEAD = 30;

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function buildWordIndex(lines: Line[]): ScriptWord[] {
  const words: ScriptWord[] = [];
  lines.forEach((line, lineIndex) => {
    const lineWords = line.tokens.filter((t) => t.kind === "word");
    lineWords.forEach((token, indexInLine) => {
      words.push({
        norm: token.kind === "word" ? normalizeWord(token.text) : "",
        line: lineIndex,
        indexInLine,
        wordsInLine: lineWords.length,
      });
    });
  });
  return words;
}

/** Palavras "parecidas" o bastante para o reconhecimento de fala. */
export function similar(spoken: string, script: string): boolean {
  if (!spoken || !script) return false;
  if (spoken === script) return true;
  const shortest = Math.min(spoken.length, script.length);
  if (shortest >= 5 && (script.startsWith(spoken) || spoken.startsWith(script)))
    return true;
  if (shortest < 4) return false;
  const limit = Math.max(spoken.length, script.length) >= 7 ? 2 : 1;
  return (
    Math.abs(spoken.length - script.length) <= limit &&
    levenshtein(spoken, script) <= limit
  );
}

/** Palavras curtas ("de", "e", "o") pesam menos: são comuns demais para ancorar. */
const weight = (word: string) => (word.length >= 4 ? 1 : 0.4);

/**
 * Retorna o novo cursor (índice da próxima palavra a ser dita) ou `null` se não houver
 * correspondência confiável.
 */
export function matchSpoken(
  words: ScriptWord[],
  cursor: number,
  spokenText: string,
): number | null {
  const recent = spokenText
    .split(/\s+/)
    .map(normalizeWord)
    .filter(Boolean)
    .slice(-RECENT_WORDS);
  if (recent.length === 0 || words.length === 0) return null;

  const lastSpoken = recent[recent.length - 1];
  const from = Math.max(0, cursor - LOOK_BEHIND);
  const to = Math.min(words.length - 1, cursor + LOOK_AHEAD);
  let best: { index: number; score: number } | null = null;

  for (let j = from; j <= to; j++) {
    if (!similar(lastSpoken, words[j].norm)) continue;

    // Caminha para trás casando as demais palavras faladas, permitindo pular até 2 do roteiro.
    let score = weight(lastSpoken);
    let s = j - 1;
    for (let k = recent.length - 2; k >= 0 && s >= 0; k--) {
      for (let t = s; t >= Math.max(0, s - 2); t--) {
        if (similar(recent[k], words[t].norm)) {
          score += weight(recent[k]);
          s = t - 1;
          break;
        }
      }
    }

    const distance = j - cursor;
    const required = distance < 0 ? 2.4 : distance > 3 ? 1.8 : 1;
    if (score < required) continue;

    const adjusted = score - Math.abs(distance) * 0.05 - (distance < 0 ? 0.5 : 0);
    if (!best || adjusted > best.score) best = { index: j, score: adjusted };
  }

  return best ? best.index + 1 : null;
}

/** Posição de rolagem (em linhas) correspondente ao cursor. */
export function positionForCursor(
  words: ScriptWord[],
  cursor: number,
  lineCount: number,
) {
  if (cursor >= words.length) return lineCount;
  const word = words[Math.max(0, cursor)];
  return word.line + word.indexInLine / word.wordsInLine;
}

/** Cursor correspondente a uma posição de rolagem (ao reposicionar manualmente). */
export function cursorForPosition(words: ScriptWord[], position: number): number {
  const index = words.findIndex(
    (word) => word.line + word.indexInLine / word.wordsInLine >= position - 0.001,
  );
  return index === -1 ? words.length : index;
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}
