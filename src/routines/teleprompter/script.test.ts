import { describe, expect, it } from "vitest";
import { CHAR_MEASURER } from "./measure";
import {
  estimateDurationMs,
  lineDurationMs,
  lineIndexAt,
  MIN_LINE_MS,
  parseScript,
  wrapScript,
  type Token,
} from "./script";

const words = (tokens: Token[]) =>
  tokens.filter((t) => t.kind === "word").map((t) => (t.kind === "word" ? t.text : ""));

describe("parseScript", () => {
  it("separa parágrafos por linha em branco e ignora parágrafos vazios", () => {
    const paragraphs = parseScript("um dois\ntrês\n\n\n  \n\nquatro");
    expect(paragraphs).toHaveLength(2);
    expect(words(paragraphs[0])).toEqual(["um", "dois", "três"]);
    expect(words(paragraphs[1])).toEqual(["quatro"]);
  });

  it("remove linhas de nota iniciadas por //", () => {
    const paragraphs = parseScript("// nota interna\nolá\n  // outra nota\nmundo");
    expect(words(paragraphs[0])).toEqual(["olá", "mundo"]);
  });

  it("reconhece pausa padrão, pausa com segundos e respira", () => {
    const [p] = parseScript("a [pausa] b [pausa 5] c [Pausa 1,5s] d [respira]");
    const pauses = p.filter((t) => t.kind === "pause");
    expect(pauses).toEqual([
      { kind: "pause", seconds: 2, breath: false, glue: false },
      { kind: "pause", seconds: 5, breath: false, glue: false },
      { kind: "pause", seconds: 1.5, breath: false, glue: false },
      { kind: "pause", seconds: 1, breath: true, glue: false },
    ]);
  });

  it("reconhece ênfase de várias palavras e indicações de cena", () => {
    const [p] = parseScript("isso é *muito importante*, [sorria] ok");
    expect(p).toEqual([
      { kind: "word", text: "isso", emphasis: false, glue: false },
      { kind: "word", text: "é", emphasis: false, glue: false },
      { kind: "word", text: "muito", emphasis: true, glue: false },
      { kind: "word", text: "importante", emphasis: true, glue: false },
      { kind: "word", text: ",", emphasis: false, glue: true },
      { kind: "cue", text: "sorria", glue: false },
      { kind: "word", text: "ok", emphasis: false, glue: false },
    ]);
  });
});

describe("wrapScript", () => {
  const text =
    "Esta é uma frase razoavelmente longa para testar a quebra de linhas.\n\nSegundo parágrafo curto.";

  it("respeita a largura máxima e não perde palavras", () => {
    const paragraphs = parseScript(text);
    const lines = wrapScript(paragraphs, 20, CHAR_MEASURER);

    for (const line of lines) {
      const rendered = line.tokens
        .map((t) => (t.kind === "word" ? t.text : ""))
        .join(" ");
      expect(rendered.length).toBeLessThanOrEqual(20);
    }
    expect(lines.flatMap((l) => words(l.tokens))).toEqual(paragraphs.flatMap(words));
  });

  it("marca parágrafo e última linha de cada parágrafo", () => {
    const lines = wrapScript(parseScript(text), 20, CHAR_MEASURER);
    const last = lines.filter((l) => l.isLastInParagraph);
    expect(last.map((l) => l.paragraph)).toEqual([0, 1]);
    expect(lines.at(-1)?.paragraph).toBe(1);
  });

  it("uma palavra maior que a largura ocupa a própria linha", () => {
    const lines = wrapScript(parseScript("a supercalifragilístico b"), 5, CHAR_MEASURER);
    expect(lines.map((l) => words(l.tokens))).toEqual([
      ["a"],
      ["supercalifragilístico"],
      ["b"],
    ]);
  });

  it("lineIndexAt mantém a posição de leitura após re-quebrar", () => {
    const paragraphs = parseScript(text);
    const narrow = wrapScript(paragraphs, 15, CHAR_MEASURER);
    const wide = wrapScript(paragraphs, 40, CHAR_MEASURER);
    const position = narrow[3].start;
    const line = wide[lineIndexAt(wide, position)];
    const lineEnd = line.start + line.tokens.length;
    expect(position).toBeGreaterThanOrEqual(line.start);
    expect(position).toBeLessThan(lineEnd);
  });
});

describe("durações", () => {
  it("é proporcional às palavras e à velocidade", () => {
    const [p] = parseScript("um dois três quatro cinco seis sete oito nove dez");
    expect(lineDurationMs(p, 120)).toBe(5000);
    expect(lineDurationMs(p, 60)).toBe(10_000);
  });

  it("soma as pausas e respeita o mínimo por linha", () => {
    const [p] = parseScript("oi [pausa 3]");
    expect(lineDurationMs(p, 140)).toBe(MIN_LINE_MS + 3000);
    const [onlyPause] = parseScript("[pausa 2]");
    expect(lineDurationMs(onlyPause, 140)).toBe(2000);
  });

  it("estima a duração total do roteiro", () => {
    const paragraphs = parseScript("a b c\n\nd e f [pausa 4]");
    expect(estimateDurationMs(paragraphs, 60)).toBe(6000 + 4000);
  });
});
