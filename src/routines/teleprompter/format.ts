/**
 * Formatação do roteiro com etiquetas entre chaves (puro):
 *   {amarelo}texto{/}   {grande negrito}texto{/}   {serifa}{azul}texto{/}{/}
 * Cada `{…}` com palavras conhecidas abre um estilo; `{/}` fecha o último aberto.
 * Chaves com palavras desconhecidas ficam como texto normal.
 */

export const TEXT_COLORS = [
  "yellow",
  "red",
  "green",
  "blue",
  "cyan",
  "pink",
  "orange",
  "purple",
  "white",
  "gray",
] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

export type TextStyle = {
  color?: TextColor;
  size?: "small" | "large";
  font?: "serif" | "mono";
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
};

/** Palavras aceitas nas etiquetas (sem acento, minúsculas) → estilo. */
export const STYLE_WORDS: Record<string, TextStyle> = {
  amarelo: { color: "yellow" },
  vermelho: { color: "red" },
  verde: { color: "green" },
  azul: { color: "blue" },
  ciano: { color: "cyan" },
  rosa: { color: "pink" },
  laranja: { color: "orange" },
  roxo: { color: "purple" },
  branco: { color: "white" },
  cinza: { color: "gray" },
  grande: { size: "large" },
  pequeno: { size: "small" },
  serifa: { font: "serif" },
  mono: { font: "mono" },
  negrito: { bold: true },
  italico: { italic: true },
  sublinhado: { underline: true },
  destaque: { highlight: true },
};

/** Rótulo em pt-BR de cada cor (para botões e acessibilidade). */
export const COLOR_LABELS: Record<TextColor, string> = {
  yellow: "amarelo",
  red: "vermelho",
  green: "verde",
  blue: "azul",
  cyan: "ciano",
  pink: "rosa",
  orange: "laranja",
  purple: "roxo",
  white: "branco",
  gray: "cinza",
};

export const SIZE_SCALE = { small: 0.85, large: 1.2 } as const;

const normalize = (word: string) =>
  word.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Interpreta o conteúdo de uma etiqueta `{…}`:
 * `"close"` para `{/}`, o estilo para palavras conhecidas, ou `null` (texto literal).
 */
export function parseStyleTag(content: string): TextStyle | "close" | null {
  const trimmed = content.trim();
  if (trimmed === "/") return "close";
  const words = trimmed
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(normalize);
  if (words.length === 0) return null;
  let style: TextStyle = {};
  for (const word of words) {
    const known = STYLE_WORDS[word];
    if (!known) return null;
    style = { ...style, ...known };
  }
  return style;
}

/** Estilo efetivo de uma pilha de estilos abertos (o mais recente vence). */
export function combineStyles(stack: TextStyle[]): TextStyle | undefined {
  if (stack.length === 0) return undefined;
  return stack.reduce<TextStyle>((acc, style) => ({ ...acc, ...style }), {});
}

/** Fator de largura de uma palavra formatada, para a quebra de linhas. */
export function styleWidthFactor(style: TextStyle | undefined): number {
  if (!style) return 1;
  const size = style.size ? SIZE_SCALE[style.size] : 1;
  const bold = style.bold ? 1.06 : 1;
  const serif = style.font === "serif" ? 1.04 : 1;
  return size * bold * serif;
}

/** Regex de qualquer etiqueta de formatação (para removê-las de um texto). */
export const STYLE_TAG = /\{[^}\n]*\}/g;
