import type { Measurer } from "./script";

/** Medidor por contagem de caracteres — usado antes da medição real e em ambientes sem canvas. */
export const CHAR_MEASURER: Measurer = { text: (value) => value.length, em: 2 };
export const CHAR_LINE_WIDTH = 36;

export type Layout = { width: number; font: string; fontSize: number };

let context: CanvasRenderingContext2D | null | undefined;

/** Medidor com a fonte real via canvas; cai no medidor por caracteres se indisponível. */
export function createMeasurer(layout: Layout | null): {
  measure: Measurer;
  maxWidth: number;
} {
  if (!layout || layout.width <= 0)
    return { measure: CHAR_MEASURER, maxWidth: CHAR_LINE_WIDTH };

  if (context === undefined) {
    try {
      context = document.createElement("canvas").getContext("2d");
    } catch {
      context = null;
    }
  }
  if (!context) return { measure: CHAR_MEASURER, maxWidth: CHAR_LINE_WIDTH };

  const ctx = context;
  const cache = new Map<string, number>();
  return {
    // Margem de 3% para cobrir negrito da ênfase e diferenças de arredondamento.
    maxWidth: layout.width * 0.97,
    measure: {
      em: layout.fontSize,
      text: (value) => {
        let width = cache.get(value);
        if (width === undefined) {
          ctx.font = layout.font;
          width = ctx.measureText(value).width;
          cache.set(value, width);
        }
        return width;
      },
    },
  };
}
