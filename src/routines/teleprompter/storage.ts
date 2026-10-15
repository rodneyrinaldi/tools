import { SPEEDS, type SpeedPreset } from "./script";

const KEY = "tools:teleprompter";

/** Quem conduz a rolagem: a voz de quem lê ou uma velocidade constante. */
export type Drive = "voice" | "speed";

export type Preferences = {
  text: string;
  drive: Drive;
  speed: SpeedPreset;
  /** No modo velocidade, o texto desacelera nas marcações de pausa. */
  holdPauses: boolean;
  countdown: number;
};

export const DEFAULT_PREFERENCES: Preferences = {
  text: "",
  drive: "voice",
  speed: "normal",
  holdPauses: false,
  countdown: 3,
};

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const data = JSON.parse(raw) as Partial<Preferences>;
    return {
      text: typeof data.text === "string" ? data.text : DEFAULT_PREFERENCES.text,
      drive: data.drive === "speed" || data.drive === "voice" ? data.drive : "voice",
      speed: data.speed && data.speed in SPEEDS ? data.speed : DEFAULT_PREFERENCES.speed,
      holdPauses: typeof data.holdPauses === "boolean" ? data.holdPauses : false,
      countdown: clampCountdown(data.countdown ?? DEFAULT_PREFERENCES.countdown),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Preferences) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(preferences));
  } catch {
    // armazenamento indisponível (aba privada, cota) — segue sem persistir
  }
}

export function clampCountdown(value: number) {
  return Number.isFinite(value) ? Math.min(60, Math.max(0, Math.round(value))) : 0;
}
