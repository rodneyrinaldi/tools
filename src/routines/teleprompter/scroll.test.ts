import { describe, expect, it } from "vitest";
import { CHAR_MEASURER } from "./measure";
import {
  currentLineIndex,
  LINE_HEIGHT_EM,
  lineSpans,
  offsetEm,
  PARAGRAPH_GAP_EM,
  positionToToken,
  stepSpeed,
  stepSpring,
  windowVelocity,
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

/** Simula `ms` de animação em quadros de 16 ms. */
function simulate(
  stepFn: (
    motion: { position: number; velocity: number | null },
    dt: number,
  ) => {
    position: number;
    velocity: number;
  },
  ms: number,
  start = { position: 0, velocity: null as number | null },
) {
  let motion = start;
  const trail: number[] = [];
  for (let t = 0; t < ms; t += 16) {
    motion = stepFn(motion, 16);
    trail.push(motion.position);
  }
  return { motion, trail };
}

describe("stepSpeed (modo velocidade)", () => {
  it("começa já na velocidade da linha e anda proporcional à duração", () => {
    const { motion } = simulate(
      (m, dt) => stepSpeed(m.position, m.velocity, dt, [1000]),
      496,
    );
    expect(motion.position).toBeCloseTo(0.496, 2);
  });

  it("linhas curtas e longas misturadas não fazem o texto pulsar", () => {
    // Alternando linhas de 2 e 4 palavras (700 ms e 1714 ms cada).
    const durations = Array.from({ length: 12 }, (_, i) => (i % 2 ? 1714 : 700));
    const { trail } = simulate(
      (m, dt) => stepSpeed(m.position, m.velocity, dt, durations),
      8000,
    );
    const steps = trail.slice(1).map((p, i) => p - trail[i]);
    // Velocidade por linha variaria 2,4×; com a janela, varia menos de 15%.
    expect(Math.max(...steps) / Math.min(...steps)).toBeLessThan(1.15);
  });

  it("um trecho com pausa que segura o texto desacelera aos poucos", () => {
    const durations = [...Array(6).fill(1000), 4000, ...Array(6).fill(1000)];
    const { trail } = simulate(
      (m, dt) => stepSpeed(m.position, m.velocity, dt, durations),
      9000,
    );
    const steps = trail.slice(1).map((p, i) => p - trail[i]);
    const jumps = steps.slice(1).map((s, i) => Math.abs(s / steps[i] - 1));
    expect(Math.min(...steps)).toBeLessThan(steps[0] * 0.8); // desacelerou
    expect(Math.max(...jumps)).toBeLessThan(0.05); // sem solavanco entre quadros
  });

  it("mantém a velocidade na tela também na passagem entre parágrafos", () => {
    const spans = lineSpans(lines);
    const lastOfFirst = lines.findIndex((l) => l.isLastInParagraph);
    expect(spans[lastOfFirst]).toBeCloseTo(
      (LINE_HEIGHT_EM + PARAGRAPH_GAP_EM) / LINE_HEIGHT_EM,
    );
    expect(spans[0]).toBe(1);
    // Numa linha com o dobro de percurso, a posição avança metade no mesmo tempo.
    const normal = stepSpeed(0, 0.001, 100, [1000, 1000], [1, 1]).position;
    const longer = stepSpeed(0, 0.001, 100, [1000, 1000], [2, 1]).position;
    expect(longer).toBeCloseTo(normal / 2);
  });

  it("windowVelocity é a média de linhas em torno da atual", () => {
    expect(windowVelocity([1000, 1000, 1000], 1)).toBeCloseTo(1 / 1000);
    expect(windowVelocity([500, 1500, 500, 1500, 500], 1)).toBeCloseTo(5 / 4500);
  });

  it("para no fim do roteiro", () => {
    expect(stepSpeed(2.99, 0.01, 100, [1000, 1000, 1000]).position).toBe(3);
    expect(stepSpeed(3, 0.01, 100, [1000, 1000, 1000])).toEqual({
      position: 3,
      velocity: 0,
    });
  });
});

describe("stepSpring (modo voz)", () => {
  const towards =
    (target: number) => (m: { position: number; velocity: number | null }, dt: number) =>
      stepSpring(m.position, m.velocity ?? 0, target, dt);

  it("chega ao alvo em menos de 1 s, sem ultrapassar e sem recuar", () => {
    const { motion, trail } = simulate(towards(1), 1000);
    expect(motion).toEqual({ position: 1, velocity: 0 });
    expect(Math.max(...trail)).toBeLessThanOrEqual(1);
    trail.slice(1).forEach((p, i) => expect(p).toBeGreaterThanOrEqual(trail[i]));
  });

  it("acelera e freia suave: começa e termina devagar", () => {
    const { trail } = simulate(towards(1), 1000);
    const steps = trail.slice(1).map((p, i) => p - trail[i]);
    const fastest = Math.max(...steps);
    expect(steps[0]).toBeLessThan(fastest / 2);
    expect(steps.filter((s) => s > 0).at(-1)!).toBeLessThan(fastest / 2);
  });

  it("alvo novo à frente no meio do caminho continua o movimento sem parar", () => {
    const half = simulate(towards(1), 200).motion;
    const { trail } = simulate(towards(2), 300, half);
    trail.slice(1).forEach((p, i) => expect(p).toBeGreaterThan(trail[i]));
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
