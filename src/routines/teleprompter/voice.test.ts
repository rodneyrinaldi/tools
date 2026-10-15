import { describe, expect, it } from "vitest";
import { CHAR_MEASURER } from "./measure";
import { parseScript, wrapScript } from "./script";
import {
  buildWordIndex,
  cursorForPosition,
  matchSpoken,
  normalizeWord,
  positionForCursor,
  similar,
  trackSpoken,
} from "./voice";

const SCRIPT =
  "Olá pessoal, hoje vamos falar sobre gravação de vídeos [pausa] com teleprompter.\n\n" +
  "Primeiro ajuste a câmera na altura dos olhos. Depois prepare o roteiro com calma.\n\n" +
  "Por fim, grave várias vezes até ficar natural.";
const lines = wrapScript(parseScript(SCRIPT), 30, CHAR_MEASURER);
const words = buildWordIndex(lines);
const indexOf = (word: string, from = 0) =>
  words.findIndex((w, i) => i >= from && w.norm === normalizeWord(word));

describe("normalização e similaridade", () => {
  it("ignora acentos, caixa e pontuação", () => {
    expect(normalizeWord("Câmera,")).toBe("camera");
    expect(normalizeWord("Inscreva-se!")).toBe("inscrevase");
  });

  it("tolera pequenos erros de reconhecimento", () => {
    expect(similar("gravacao", "gravacao")).toBe(true);
    expect(similar("video", "videos")).toBe(true);
    expect(similar("teleprompt", "teleprompter")).toBe(true);
    expect(similar("camera", "calma")).toBe(false);
    expect(similar("de", "do")).toBe(false);
  });

  it("índice de palavras ignora marcações", () => {
    expect(words.some((w) => w.norm.includes("pausa"))).toBe(false);
  });
});

describe("matchSpoken", () => {
  it("avança o cursor para depois da última palavra dita", () => {
    expect(matchSpoken(words, 0, "olá pessoal hoje vamos")).toBe(indexOf("vamos") + 1);
  });

  it("tolera palavras puladas e erros do reconhecedor", () => {
    const cursor = indexOf("falar");
    expect(matchSpoken(words, cursor, "falar sobre gravasão vídeo")).toBe(
      indexOf("videos") + 1,
    );
  });

  it("acompanha um salto para frente com contexto suficiente", () => {
    expect(matchSpoken(words, 0, "ajuste a câmera na altura")).toBe(
      indexOf("altura") + 1,
    );
  });

  it("volta quando a pessoa repete um trecho já lido", () => {
    const cursor = indexOf("roteiro") + 1;
    expect(matchSpoken(words, cursor, "ajuste a câmera na altura dos olhos")).toBe(
      indexOf("olhos") + 1,
    );
  });

  it("ignora palavras curtas e soltas, que são ambíguas", () => {
    const cursor = indexOf("depois");
    expect(matchSpoken(words, cursor, "de")).toBeNull();
    expect(matchSpoken(words, cursor, "a")).toBeNull();
  });

  it("não salta longe com uma única palavra", () => {
    expect(matchSpoken(words, 0, "natural")).toBeNull();
  });

  it("ignora fala que não está no roteiro", () => {
    expect(matchSpoken(words, 3, "espera deixa eu ver aqui")).toBeNull();
  });
});

describe("cursor ↔ posição", () => {
  it("posição cresce dentro da linha conforme as palavras são ditas", () => {
    const first = positionForCursor(words, 0, lines.length);
    const second = positionForCursor(words, 1, lines.length);
    expect(first).toBe(0);
    expect(second).toBeGreaterThan(first);
    expect(second).toBeLessThan(1);
  });

  it("fim do roteiro", () => {
    expect(positionForCursor(words, words.length, lines.length)).toBe(lines.length);
  });

  it("reposicionar manualmente aponta para a primeira palavra da linha", () => {
    const cursor = cursorForPosition(words, 2);
    expect(words[cursor].line).toBe(2);
    expect(words[cursor].indexInLine).toBe(0);
  });
});

describe("trackSpoken — proteção contra vai e volta", () => {
  const at = (cursor: number) => ({ cursor, pending: null });
  const interim = (text: string) => ({ text, final: false });
  const final = (text: string) => ({ text, final: true });

  it("avança na hora em passos pequenos", () => {
    expect(trackSpoken(words, at(0), interim("olá pessoal"))).toEqual(
      at(indexOf("pessoal") + 1),
    );
  });

  it("revisão de hipótese provisória não faz o texto voltar", () => {
    // O reconhecedor ouviu "…hoje vamos" e depois corrigiu para "…hoje".
    const afterVamos = at(indexOf("vamos") + 1);
    expect(trackSpoken(words, afterVamos, interim("olá pessoal hoje"))).toBe(afterVamos);
    expect(trackSpoken(words, afterVamos, final("olá pessoal hoje"))).toBe(afterVamos);
  });

  it("volta apenas quando a pessoa repete um trecho, com frase finalizada", () => {
    const afterRoteiro = at(indexOf("roteiro") + 1);
    const repeated = "ajuste a câmera na altura dos olhos";
    expect(trackSpoken(words, afterRoteiro, interim(repeated))).toBe(afterRoteiro);
    expect(trackSpoken(words, afterRoteiro, final(repeated))).toEqual(
      at(indexOf("olhos") + 1),
    );
  });

  it("salto grande para frente precisa de confirmação na transcrição seguinte", () => {
    const first = trackSpoken(words, at(0), interim("ajuste a câmera na altura"));
    expect(first).toEqual({ cursor: 0, pending: indexOf("altura") + 1 });

    const second = trackSpoken(words, first, interim("ajuste a câmera na altura dos"));
    expect(second).toEqual(at(indexOf("dos") + 1));
  });

  it("um salto isolado (erro do reconhecedor) é descartado quando a leitura segue normal", () => {
    const glitch = trackSpoken(words, at(0), interim("ajuste a câmera na altura"));
    expect(trackSpoken(words, glitch, interim("olá pessoal"))).toEqual(
      at(indexOf("pessoal") + 1),
    );
  });
});
