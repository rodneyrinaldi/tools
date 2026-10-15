import { describe, expect, it } from "vitest";
import { initialPlayback, playbackReducer, type PlaybackState } from "./playback";

describe("playbackReducer", () => {
  it("começa em contagem regressiva, ou direto se a contagem for 0", () => {
    expect(initialPlayback(3)).toEqual({ phase: "countdown", countdown: 3 });
    expect(initialPlayback(0).phase).toBe("running");
  });

  it("a contagem decrementa e inicia ao chegar a zero", () => {
    let state = initialPlayback(2);
    state = playbackReducer(state, { type: "tick" });
    expect(state).toEqual({ phase: "countdown", countdown: 1 });
    state = playbackReducer(state, { type: "tick" });
    expect(state).toEqual({ phase: "running", countdown: 0 });
  });

  it("toggle pausa, continua e pula a contagem", () => {
    const running: PlaybackState = { phase: "running", countdown: 0 };
    const paused = playbackReducer(running, { type: "toggle" });
    expect(paused.phase).toBe("paused");
    expect(playbackReducer(paused, { type: "toggle" }).phase).toBe("running");
    expect(playbackReducer(initialPlayback(5), { type: "toggle" }).phase).toBe("running");
  });

  it("reposicionar após o fim deixa pausado", () => {
    const finished: PlaybackState = { phase: "finished", countdown: 0 };
    expect(playbackReducer(finished, { type: "moved" }).phase).toBe("paused");
    const running: PlaybackState = { phase: "running", countdown: 0 };
    expect(playbackReducer(running, { type: "moved" })).toBe(running);
  });

  it("restart volta ao início com contagem", () => {
    const finished: PlaybackState = { phase: "finished", countdown: 0 };
    expect(playbackReducer(finished, { type: "restart", countdown: 3 })).toEqual(
      initialPlayback(3),
    );
  });
});
