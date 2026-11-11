import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Listener = (message: Record<string, unknown>) => void;

const fake = vi.hoisted(() => ({
  loadResult: true,
  modelUrls: [] as string[],
  recognizers: [] as {
    sampleRate: number;
    grammar?: string;
    handlers: Record<string, (message: unknown) => void>;
    chunks: number;
    removed: boolean;
  }[],
  feedClosed: 0,
  onChunk: null as null | ((samples: Float32Array, rate: number) => void),
}));

vi.mock("vosk-browser", () => {
  class Model {
    constructor(url: string) {
      fake.modelUrls.push(url);
    }
    on(event: string, listener: Listener) {
      if (event === "load") {
        queueMicrotask(() => listener({ event: "load", result: fake.loadResult }));
      }
    }
    terminate() {}
    get KaldiRecognizer() {
      return class {
        state = {
          sampleRate: 0,
          grammar: undefined as string | undefined,
          handlers: {} as Record<string, (message: unknown) => void>,
          chunks: 0,
          removed: false,
        };
        constructor(sampleRate: number, grammar?: string) {
          this.state.sampleRate = sampleRate;
          this.state.grammar = grammar;
          fake.recognizers.push(this.state);
        }
        on(event: string, listener: (message: unknown) => void) {
          this.state.handlers[event] = listener;
        }
        acceptWaveformFloat() {
          this.state.chunks++;
        }
        remove() {
          this.state.removed = true;
        }
      };
    }
  }
  return { Model };
});

vi.mock("./audioFeed", () => ({
  openAudioFeed: async (
    _stream: unknown,
    onChunk: (samples: Float32Array, rate: number) => void,
  ) => {
    fake.onChunk = onChunk;
    return { sampleRate: 48000, close: () => fake.feedClosed++ };
  },
}));

import {
  useDeviceSpeechRecognition,
  VOICE_MODEL_URLS,
} from "./useDeviceSpeechRecognition";

const stopMic = vi.fn();

beforeEach(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopMic }] })),
    },
  });
});

afterEach(() => {
  fake.loadResult = true;
  fake.modelUrls = [];
  fake.recognizers = [];
  fake.feedClosed = 0;
  fake.onChunk = null;
  stopMic.mockClear();
});

function partial(text: string) {
  fake.recognizers.at(-1)!.handlers.partialresult({
    event: "partialresult",
    result: { partial: text },
  });
}

function result(text: string) {
  fake.recognizers.at(-1)!.handlers.result({
    event: "result",
    result: { text, result: [] },
  });
}

describe("useDeviceSpeechRecognition", () => {
  it("sem modelo, tenta todas as fontes e avisa a falha (para trocar de reconhecedor)", async () => {
    fake.loadResult = false;
    const { result: hook } = renderHook(() =>
      useDeviceSpeechRecognition({
        active: true,
        vocabulary: ["olá"],
        onTranscript: () => {},
      }),
    );
    await waitFor(() => expect(hook.current.failed).toBe(true));
    expect(hook.current.status).toBe("error");
    expect(fake.modelUrls).toHaveLength(VOICE_MODEL_URLS.length);
  });

  it("ouve, restringe ao roteiro e entrega frases provisórias e finais", async () => {
    const heard: { text: string; final: boolean }[] = [];
    const { result: hook, unmount } = renderHook(() =>
      useDeviceSpeechRecognition({
        active: true,
        vocabulary: ["olá", "mundo", "hoje"],
        onTranscript: (h) => heard.push(h),
      }),
    );
    await waitFor(() => expect(hook.current.status).toBe("listening"));

    const recognizer = fake.recognizers[0];
    expect(recognizer.sampleRate).toBe(48000);
    expect(JSON.parse(recognizer.grammar!)).toEqual(["olá", "mundo", "hoje", "[unk]"]);

    fake.onChunk!(new Float32Array(4096), 48000);
    expect(recognizer.chunks).toBe(1);

    act(() => partial("olá [unk]"));
    act(() => result("olá mundo"));
    act(() => partial("hoje"));
    expect(heard).toEqual([
      { text: "olá", final: false },
      { text: "olá mundo", final: true },
      { text: "olá mundo hoje", final: false },
    ]);

    // Após reposicionar, o que já foi ouvido não conta mais.
    act(() => hook.current.forgetHeard());
    act(() => partial("hoje olá"));
    expect(heard.at(-1)).toEqual({ text: "olá", final: false });

    unmount();
    expect(recognizer.removed).toBe(true);
    expect(fake.feedClosed).toBe(1);
    expect(stopMic).toHaveBeenCalled();
  });

  it("pausado não ouve nada", () => {
    const { result: hook } = renderHook(() =>
      useDeviceSpeechRecognition({
        active: false,
        vocabulary: [],
        onTranscript: () => {},
      }),
    );
    expect(hook.current.status).toBe("idle");
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });
});
