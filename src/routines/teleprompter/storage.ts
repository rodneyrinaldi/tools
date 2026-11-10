import type { DimLevel, Facing } from "./camera";
import { SPEEDS, type SpeedPreset } from "./script";

const KEY = "tools:teleprompter";

/** Quem conduz a rolagem: a voz de quem lê ou uma velocidade constante. */
export type Drive = "voice" | "speed";

/** Cor base do texto lido (a formatação {cor} do roteiro tem prioridade). */
export type BaseTextColor = "white" | "yellow" | "cyan" | "green";

export type Preferences = {
  text: string;
  drive: Drive;
  speed: SpeedPreset;
  /** No modo velocidade, o texto desacelera nas marcações de pausa. */
  holdPauses: boolean;
  countdown: number;
  textColor: BaseTextColor;
  /** Câmera ao fundo, com gravação. */
  camera: boolean;
  dim: DimLevel;
  facing: Facing;
};

export const DEFAULT_PREFERENCES: Preferences = {
  text: "",
  drive: "voice",
  speed: "normal",
  holdPauses: false,
  countdown: 3,
  textColor: "white",
  camera: false,
  dim: "medium",
  facing: "user",
};

const oneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
  fallback: T,
): T => (options.includes(value as T) ? (value as T) : fallback);

export function loadPreferences(): Preferences {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const data = JSON.parse(raw) as Partial<Preferences>;
    const d = DEFAULT_PREFERENCES;
    return {
      text: typeof data.text === "string" ? data.text : d.text,
      drive: oneOf(data.drive, ["voice", "speed"], d.drive),
      speed: data.speed && data.speed in SPEEDS ? data.speed : d.speed,
      holdPauses: typeof data.holdPauses === "boolean" ? data.holdPauses : d.holdPauses,
      countdown: clampCountdown(data.countdown ?? d.countdown),
      textColor: oneOf(data.textColor, ["white", "yellow", "cyan", "green"], d.textColor),
      camera: typeof data.camera === "boolean" ? data.camera : d.camera,
      dim: oneOf(data.dim, ["light", "medium", "strong"], d.dim),
      facing: oneOf(data.facing, ["user", "environment"], d.facing),
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
