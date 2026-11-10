import { describe, expect, it } from "vitest";
import { autoMark } from "./autoMark";
import { CHAR_MEASURER } from "./measure";
import { parseStyleTag, styleWidthFactor } from "./format";
import { parseScript, tokenWidth, type Token } from "./script";

const visible = (tokens: Token[]) =>
  tokens.map((t) => (t.kind === "word" ? t.text : t.kind)).join("|");

describe("parseStyleTag", () => {
  it("combina palavras conhecidas, ignora acentos e reconhece o fechamento", () => {
    expect(parseStyleTag("amarelo")).toEqual({ color: "yellow" });
    expect(parseStyleTag("grande Negrito")).toEqual({ size: "large", bold: true });
    expect(parseStyleTag("itálico, sublinhado")).toEqual({
      italic: true,
      underline: true,
    });
    expect(parseStyleTag(" / ")).toBe("close");
  });

  it("devolve null para palavras desconhecidas (fica como texto)", () => {
    expect(parseStyleTag("amarelo banana")).toBeNull();
    expect(parseStyleTag("")).toBeNull();
  });
});

describe("parser com formatação", () => {
  it("aplica o estilo às palavras dentro da etiqueta e fecha com {/}", () => {
    const [p] = parseScript("antes {amarelo}no meio{/} depois");
    const words = p.filter((t) => t.kind === "word");
    expect(words.map((w) => [w.text, w.kind === "word" ? w.style : undefined])).toEqual([
      ["antes", undefined],
      ["no", { color: "yellow" }],
      ["meio", { color: "yellow" }],
      ["depois", undefined],
    ]);
  });

  it("aninha estilos: o interno soma ao externo", () => {
    const [p] = parseScript("{azul}a {grande negrito}b{/} c{/}");
    const styles = p.map((t) => (t.kind === "word" ? t.style : undefined));
    expect(styles).toEqual([
      { color: "blue" },
      { color: "blue", size: "large", bold: true },
      { color: "blue" },
    ]);
  });

  it("etiquetas não criam nem removem espaços entre palavras", () => {
    const [p] = parseScript("fim{vermelho}!{/}, e {verde}mais{/}.");
    expect(visible(p)).toBe("fim|!|,|e|mais|.");
    expect(p.map((t) => t.glue)).toEqual([false, true, true, false, false, true]);
  });

  it("chaves desconhecidas aparecem como texto", () => {
    const [p] = parseScript("preço {promoção} hoje");
    expect(visible(p)).toBe("preço|{promoção}|hoje");
  });

  it("estilos não atravessam parágrafos", () => {
    const [, second] = parseScript("{rosa}primeiro\n\nsegundo");
    expect(second[0]).toMatchObject({ text: "segundo" });
    expect(second[0].kind === "word" && second[0].style).toBeFalsy();
  });

  it("palavras maiores ocupam mais largura na quebra de linhas", () => {
    const [p] = parseScript("palavra {grande}palavra{/}");
    expect(styleWidthFactor({ size: "large" })).toBeGreaterThan(1);
    expect(tokenWidth(p[1], CHAR_MEASURER)).toBeGreaterThan(
      tokenWidth(p[0], CHAR_MEASURER),
    );
  });
});

describe("marcação automática com formatação", () => {
  it("reconhece o fim da frase mesmo com etiqueta colada", () => {
    expect(autoMark("Primeiro {amarelo}parágrafo.{/}\n\nSegundo.").text).toBe(
      "Primeiro {amarelo}parágrafo.{/} [pausa 2]\n\nSegundo.",
    );
  });

  it("não quebra etiquetas ao enfatizar percentuais", () => {
    const source = "Crescemos {verde}35%{/} no ano.";
    expect(autoMark(source).text).toBe(source);
  });
});
