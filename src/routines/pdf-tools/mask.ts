/**
 * Máscara de nomes de arquivo estilo Windows: `*` = qualquer sequência, `?` = um caractere,
 * várias máscaras separadas por `;`. Não diferencia maiúsculas.
 */

export function parseMask(mask: string): RegExp[] {
  return mask
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const source = part
        .split("")
        .map((char) =>
          char === "*"
            ? ".*"
            : char === "?"
              ? "."
              : char.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
        )
        .join("");
      return new RegExp(`^${source}$`, "i");
    });
}

export function matchesMask(fileName: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(fileName));
}

/** Mensagem de erro para máscara inválida, ou `null` se estiver ok. */
export function validateMask(mask: string): string | null {
  const parts = mask
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "Informe ao menos uma máscara, por exemplo *.pdf.";
  if (parts.some((part) => /[\\/:"<>|]/.test(part))) {
    return 'A máscara se aplica só ao nome do arquivo: não use \\ / : " < > |.';
  }
  return null;
}
