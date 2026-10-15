/**
 * Máquina de estados pura da reprodução. A posição do texto vive fora daqui
 * (laço de animação), pois muda a cada quadro.
 */

export type Phase = "countdown" | "running" | "paused" | "finished";

export type PlaybackState = { phase: Phase; countdown: number };

export type PlaybackAction =
  | { type: "tick" }
  | { type: "toggle" }
  | { type: "moved" }
  | { type: "finish" }
  | { type: "restart"; countdown: number };

export function initialPlayback(countdown: number): PlaybackState {
  return countdown > 0
    ? { phase: "countdown", countdown }
    : { phase: "running", countdown: 0 };
}

export function playbackReducer(
  state: PlaybackState,
  action: PlaybackAction,
): PlaybackState {
  switch (action.type) {
    case "tick":
      if (state.phase !== "countdown") return state;
      return state.countdown <= 1
        ? { phase: "running", countdown: 0 }
        : { ...state, countdown: state.countdown - 1 };
    case "toggle":
      if (state.phase === "running") return { ...state, phase: "paused" };
      if (state.phase === "paused" || state.phase === "countdown") {
        return { phase: "running", countdown: 0 };
      }
      return state;
    case "moved":
      // Reposicionar depois do fim reabre a leitura, pausada.
      return state.phase === "finished" ? { ...state, phase: "paused" } : state;
    case "finish":
      return { ...state, phase: "finished" };
    case "restart":
      return initialPlayback(action.countdown);
  }
}
