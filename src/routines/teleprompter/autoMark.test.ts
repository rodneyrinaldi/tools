import { describe, expect, it } from "vitest";
import { autoMark, hasMarks, stripMarks } from "./autoMark";

describe("autoMark", () => {
  it("pausa no fim de cada parágrafo, exceto o último", () => {
    const { text } = autoMark("Primeiro parágrafo.\n\nSegundo parágrafo.");
    expect(text).toBe("Primeiro parágrafo. [pausa 2]\n\nSegundo parágrafo.");
  });

  it("pausa curta depois de perguntas e reticências", () => {
    const { text } = autoMark("Sabe por quê? Porque sim… E pronto.");
    expect(text).toBe("Sabe por quê? [pausa 1] Porque sim… [pausa 1] E pronto.");
  });

  it("respira depois de frases longas, mas não depois de curtas", () => {
    const long =
      "Esta frase tem palavras suficientes para pedir um respiro antes da próxima.";
    expect(autoMark(`${long} Curta. Outra.`).text).toBe(
      `${long} [respira] Curta. Outra.`,
    );
  });

  it("respira em vírgula quando a frase é muito longa", () => {
    const words = Array.from({ length: 20 }, (_, i) => `p${i}`).join(" ");
    const { text } = autoMark(`${words}, e continua mais um pouco.`);
    expect(text).toBe(`${words}, [respira] e continua mais um pouco.`);
  });

  it("sorria em saudações e olhe para a câmera em chamadas para ação", () => {
    const { text } = autoMark("Olá, pessoal! Hoje tem novidade. Inscreva-se no canal.");
    expect(text).toBe(
      "[sorria] Olá, pessoal! Hoje tem novidade. [olhe para a câmera] Inscreva-se no canal.",
    );
  });

  it("não confunde palavras que só contêm a saudação", () => {
    expect(autoMark("Oito pessoas vieram.").text).toBe("Oito pessoas vieram.");
  });

  it("enfatiza percentuais fora de trechos já enfatizados", () => {
    expect(autoMark("Crescemos 35%, um recorde.").text).toBe(
      "Crescemos *35%*, um recorde.",
    );
    expect(autoMark("Foi *quase 40% do total* neste ano.").text).toBe(
      "Foi *quase 40% do total* neste ano.",
    );
  });

  it("respeita marcações existentes", () => {
    const source =
      "[olhe] Bom dia! Tudo bem? [respira]\n\nFim. [pausa 3]\n\n[acene] Tchau.";
    expect(autoMark(source)).toEqual({ text: source, added: 0 });
  });

  it("é idempotente", () => {
    const source =
      "Olá, pessoal! Hoje vamos falar de um assunto importante para quem grava vídeos todos os dias. Faz sentido?\n\n// nota: mostrar gráfico\nCrescemos 20% no último mês, e isso só aconteceu porque vocês participaram, comentaram e compartilharam bastante.\n\nComente aqui embaixo. Até a próxima!";
    const once = autoMark(source).text;
    expect(autoMark(once)).toEqual({ text: once, added: 0 });
  });

  it("não altera linhas de nota", () => {
    const { text } = autoMark("// Olá, isto é nota?\nTexto.\n\nFim.");
    expect(text).toBe("// Olá, isto é nota?\nTexto. [pausa 2]\n\nFim.");
  });
});

describe("hasMarks / stripMarks", () => {
  it("detecta marcações fora das notas", () => {
    expect(hasMarks("Texto simples.")).toBe(false);
    expect(hasMarks("// [nota com colchete]\nTexto.")).toBe(false);
    expect(hasMarks("Fim. [pausa]")).toBe(true);
    expect(hasMarks("Isso é *importante*.")).toBe(true);
  });

  it("remove todas as marcações sem deixar espaços sobrando", () => {
    const { text, removed } = stripMarks(
      "[sorria] Olá, pessoal! [respira] Crescemos *20%*, ok? [pausa 1]\n\n  [olhe] Comente [pausa]. Fim.",
    );
    expect(text).toBe("Olá, pessoal! Crescemos 20%, ok?\n\n  Comente. Fim.");
    expect(removed).toBe(6);
  });

  it("preserva notas e o espaçamento do texto sem marcações", () => {
    const source = "// nota [x] *y*\nTexto  com  espaços ?";
    expect(stripMarks(source)).toEqual({ text: source, removed: 0 });
  });

  it("desfaz o Auto num roteiro sem marcações prévias", () => {
    const source =
      "Olá, pessoal! Hoje vamos falar de um assunto importante para quem grava vídeos todos os dias. Faz sentido?\n\nCrescemos 20% no último mês.\n\nInscreva-se no canal. Até a próxima!";
    expect(stripMarks(autoMark(source).text).text).toBe(source);
  });
});
