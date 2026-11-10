import { OPERATIONS, type Operation } from "./operations";

const KEY = "tools:pdf-tools";

/** O que fica salvo no navegador (senhas nunca). */
export type Preferences = {
  operation: Operation;
  root: string;
  recursive: boolean;
  mask: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  operation: "merge",
  root: "",
  recursive: false,
  mask: "*.pdf",
};

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const data = JSON.parse(raw) as Partial<Preferences>;
    return {
      operation: OPERATIONS.some((op) => op.value === data.operation)
        ? (data.operation as Operation)
        : DEFAULT_PREFERENCES.operation,
      root: typeof data.root === "string" ? data.root : DEFAULT_PREFERENCES.root,
      recursive: typeof data.recursive === "boolean" ? data.recursive : false,
      mask:
        typeof data.mask === "string" && data.mask.trim()
          ? data.mask
          : DEFAULT_PREFERENCES.mask,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // armazenamento indisponível — segue sem persistir
  }
}
