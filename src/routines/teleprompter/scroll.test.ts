import { describe, expect, it } from "vitest";
import { CHAR_MEASURER } from "./measure";
import {
  advance,
  currentLineIndex,
  LINE_HEIGHT_EM,
  offsetEm,
  PARAGRAPH_GAP_EM,
  positionToToken,
  tokenToPosition,
} from "./scroll";
import { parseScript, wrapScript } from "./script";

const lines = wrapScript(
  parseScript("um dois três quatro cinco seis sete oito\n\nnove dez onze doze"),
  12,
  CHAR_MEASURER,
);

describe("offsetEm", () => {
  it("é contínuo dentro da linha e soma o espaço entre parágrafos", () => {
    expect(offsetEm(lines, 0)).toBe(0);
    expect(offsetEm(lines, 0.5)).toBe(LINE_HEIGHT_EM / 2);

    const firstOfSecond = lines.findIndex((l) => l.paragraph === 1);
    expect(offsetEm(lines, firstOfSecond)).toBe(
      firstOfSecond * LINE_HEIGHT_EM + PARAGRAPH_GAP_EM,
    );
    // Atravessando o vão entre parágrafos sem saltos.
    expect(offsetEm(lines, firstOfSecond - 0.5)).toBeCloseTo(
      (offsetEm(lines, firstOfSecond - 1) + offsetEm(lines, firstOfSecond)) / 2,
    );
  });
});

describe("advance", () => {
  it("avança proporcionalmente à duração de cada linha", () => {
    const durations = [1000, 2000, 500];
    expect(advance(0, 500, durations)).toBeCloseTo(0.5);
    expect(advance(0, 1000, durations)).toBeCloseTo(1);
    expect(advance(0, 2000, durations)).toBeCloseTo(1.5);
    expect(advance(0.5, 1500, durations)).toBeCloseTo(1.5);
  });

  it("para no fim do roteiro", () => {
    expect(advance(2.5, 10_000, [1000, 1000, 1000])).toBe(3);
  });
});

describe("posição ↔ token", () => {
  it("ida e volta preserva a posição", () => {
    for (const p of [0, 0.5, 1.25, 2]) {
      expect(tokenToPosition(lines, positionToToken(lines, p))).toBeCloseTo(p, 5);
    }
  });

  it("mantém o mesmo trecho após re-quebrar com outra largura", () => {
    const wide = wrapScript(
      parseScript("um dois três quatro cinco seis sete oito\n\nnove dez onze doze"),
      40,
      CHAR_MEASURER,
    );
    const token = positionToToken(lines, 2);
    const wideLine = wide[currentLineIndex(wide, tokenToPosition(wide, token))];
    expect(wideLine.start).toBeLessThanOrEqual(token);
    expect(wideLine.start + wideLine.tokens.length).toBeGreaterThan(token);
  });

  it("fim do roteiro", () => {
    expect(tokenToPosition(lines, positionToToken(lines, lines.length))).toBe(
      lines.length,
    );
  });
});
