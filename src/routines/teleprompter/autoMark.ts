/**
 * Marcação automática do roteiro (heurísticas para português, sem rede).
 * Insere pausas, respiros, indicações de cena e ênfases onde costumam fazer sentido.
 * Respeita marcações existentes: rodar duas vezes não duplica nada.
 */

export type AutoMarkResult = { text: string; added: number };

/** Palavras sem respiro a partir das quais o fim de frase recebe [respira]. */
export const BREATH_AFTER_WORDS = 12;
/** Palavras sem respiro a partir das quais uma vírgula recebe [respira]. */
export const BREATH_AT_COMMA_WORDS = 20;

export const PARAGRAPH_PAUSE = "[pausa 2]";
export const SHORT_PAUSE = "[pausa 1]";
export const BREATH = "[respira]";
export const SMILE = "[sorria]";
export const LOOK = "[olhe para a câmera]";

type SourceToken = { text: string; start: number; end: number; marker: boolean };
type Insertion = { at: number; text: string } | { at: number; end: number; text: string };

const TOKEN = /\[[^\]\n]*\]|\S+/g;
const PAUSE_MARKER = /^\[\s*(pausa|respira)\b/i;
const SENTENCE_END = /[.!?…]["”’')\]]*$/;
const ABBREVIATION = /^(sr|sra|srta|dr|dra|prof|profa|etc|ex|p\.ex|obs)\.$/i;
const CLAUSE_END = /[,;:]["”’')\]]*$/;
const PERCENT = /^(\d+(?:[.,]\d+)?%)(.*)$/;

// Limites de palavra com letras acentuadas (\b do JS só entende ASCII).
const word = (pattern: string) => new RegExp(`(?<!\\p{L})(?:${pattern})(?!\\p{L})`, "iu");
const GREETING = word(
  "ol[áa]|oi|bom dia|boa tarde|boa noite|bem[- ]vind[oa]s?|obrigad[oa]s?|valeu|parab[ée]ns|tchau|at[ée] (?:a pr[óo]xima|logo|mais)",
);
const CALL_TO_ACTION = word(
  "inscreva-se|se inscrev\\p{L}*|clique|comente|compartilhe|curta (?:o|este|esse) v[íi]deo|(?:me|nos) siga|siga (?:o|a|nosso|nossa|meu|minha) (?:canal|perfil|p[áa]gina)|acesse|ative o sininho|deixe (?:seu|o) like|link na descri\\p{L}*",
);

export function autoMark(source: string): AutoMarkResult {
  const blocks = collectBlocks(source);
  const insertions: Insertion[] = [];

  blocks.forEach((block, blockIndex) => {
    const isLastBlock = blockIndex === blocks.length - 1;
    let wordsSinceBreath = 0;
    let inEmphasis = false;

    const sentences = splitSentences(block);
    sentences.forEach((sentence, sentenceIndex) => {
      const isLastSentence = sentenceIndex === sentences.length - 1;
      const words = sentence.filter((t) => !t.marker);
      if (words.length === 0) {
        if (sentence.some((t) => PAUSE_MARKER.test(t.text))) wordsSinceBreath = 0;
        return;
      }

      // Indicação de cena no início da frase (uma por frase, só se não houver nenhuma).
      const hasCue = sentence.some((t) => t.marker && !PAUSE_MARKER.test(t.text));
      const sentenceText = words.map((t) => t.text).join(" ");
      if (!hasCue) {
        const cue = CALL_TO_ACTION.test(sentenceText)
          ? LOOK
          : GREETING.test(sentenceText)
            ? SMILE
            : null;
        if (cue) insertions.push({ at: sentence[0].start, text: `${cue} ` });
      }

      sentence.forEach((token, i) => {
        if (token.marker) {
          if (PAUSE_MARKER.test(token.text)) wordsSinceBreath = 0;
          return;
        }
        wordsSinceBreath += 1;

        // Ênfase em percentuais fora de trechos já enfatizados.
        if (!inEmphasis && !token.text.includes("*")) {
          const percent = PERCENT.exec(token.text);
          if (percent) {
            insertions.push({
              at: token.start,
              end: token.end,
              text: `*${percent[1]}*${percent[2]}`,
            });
          }
        }
        // Número ímpar de * abre ou fecha um trecho enfatizado.
        if (token.text.split("*").length % 2 === 0) inEmphasis = !inEmphasis;

        const next = sentence[i + 1];
        if (
          next &&
          !next.marker &&
          CLAUSE_END.test(token.text) &&
          wordsSinceBreath >= BREATH_AT_COMMA_WORDS
        ) {
          insertions.push({ at: token.end, text: ` ${BREATH}` });
          wordsSinceBreath = 0;
        }
      });

      const last = sentence[sentence.length - 1];
      if (last.marker) {
        if (PAUSE_MARKER.test(last.text)) wordsSinceBreath = 0;
        return;
      }

      const isParagraphEnd = isLastSentence && !isLastBlock;
      let mark: string | null = null;
      if (isParagraphEnd) mark = PARAGRAPH_PAUSE;
      else if (/[?…]["”’')\]]*$|\.\.\.$/.test(last.text)) mark = SHORT_PAUSE;
      else if (!isLastSentence && wordsSinceBreath >= BREATH_AFTER_WORDS) mark = BREATH;

      if (mark) {
        insertions.push({ at: last.end, text: ` ${mark}` });
        wordsSinceBreath = 0;
      }
    });
  });

  return { text: apply(source, insertions), added: insertions.length };
}

/** Marcação entre colchetes junto com os espaços que a antecedem. */
const MARKER_WITH_SPACE = /[ \t]*\[[^\]\n]*\]/g;
const EMPHASIS = /\*([^*\n]+)\*/g;
const isNote = (line: string) => line.trim().startsWith("//");

/** O roteiro tem alguma marcação (indicação, pausa, respiro ou ênfase) fora das notas? */
export function hasMarks(source: string): boolean {
  return source
    .split("\n")
    .some(
      (line) => !isNote(line) && (/\[[^\]\n]*\]/.test(line) || /\*[^*\n]+\*/.test(line)),
    );
}

/**
 * Remove todas as marcações: colchetes somem e ênfases viram texto normal.
 * Notas `//` e o espaçamento do resto do texto ficam intactos.
 */
export function stripMarks(source: string): { text: string; removed: number } {
  let removed = 0;
  const text = source
    .split("\n")
    .map((line) => {
      if (isNote(line)) return line;
      const indent = /^\s*/.exec(line)?.[0] ?? "";
      const startsWithMarker = line.slice(indent.length).startsWith("[");
      let body = line
        .slice(indent.length)
        .replace(MARKER_WITH_SPACE, () => {
          removed += 1;
          return "";
        })
        .replace(EMPHASIS, (_, content: string) => {
          removed += 1;
          return content;
        });
      if (startsWithMarker) body = body.trimStart();
      return indent + body;
    })
    .join("\n");
  return { text, removed };
}

/** Parágrafos (separados por linha em branco) como listas de tokens, ignorando notas `//`. */
function collectBlocks(source: string): SourceToken[][] {
  const blocks: SourceToken[][] = [];
  let current: SourceToken[] = [];
  let offset = 0;

  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current.length) blocks.push(current);
      current = [];
    } else if (!trimmed.startsWith("//")) {
      for (const match of line.matchAll(TOKEN)) {
        current.push({
          text: match[0],
          start: offset + match.index,
          end: offset + match.index + match[0].length,
          marker: match[0].startsWith("["),
        });
      }
    }
    offset += line.length + 1;
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * Agrupa tokens em frases. Pausas/respiros logo após o fim da frase continuam na mesma frase,
 * para que "Fim. [pausa]" seja reconhecido como já marcado; indicações abrem a frase seguinte.
 */
function splitSentences(tokens: SourceToken[]): SourceToken[][] {
  const sentences: SourceToken[][] = [];
  let current: SourceToken[] = [];
  let ended = false;

  for (const token of tokens) {
    if (ended && !PAUSE_MARKER.test(token.text)) {
      sentences.push(current);
      current = [];
      ended = false;
    }
    current.push(token);
    if (
      !token.marker &&
      SENTENCE_END.test(token.text) &&
      !ABBREVIATION.test(token.text)
    ) {
      ended = true;
    }
  }
  if (current.length) sentences.push(current);
  return sentences;
}

function apply(source: string, insertions: Insertion[]) {
  let result = source;
  [...insertions]
    // De trás para frente; na mesma posição, substituições antes das inserções.
    .sort((a, b) => b.at - a.at || Number("end" in b) - Number("end" in a))
    .forEach((insertion) => {
      const end = "end" in insertion ? insertion.end : insertion.at;
      result = result.slice(0, insertion.at) + insertion.text + result.slice(end);
    });
  return result;
}
