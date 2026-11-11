import { afterEach, describe, expect, it, vi } from "vitest";
import { isDeviceRecognitionSupported, resolveEngine } from "./voiceEngine";

function stubDevice() {
  vi.stubGlobal("AudioContext", function AudioContext() {});
  vi.stubGlobal("Worker", function Worker() {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => ({}) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
});

describe("resolveEngine", () => {
  it("usa o preferido quando funciona", () => {
    stubDevice();
    vi.stubGlobal("webkitSpeechRecognition", function Recognition() {});
    expect(isDeviceRecognitionSupported()).toBe(true);
    expect(resolveEngine("device")).toBe("device");
    expect(resolveEngine("browser")).toBe("browser");
  });

  it("cai para o outro motor ou para nenhum", () => {
    vi.stubGlobal("webkitSpeechRecognition", function Recognition() {});
    expect(resolveEngine("device")).toBe("browser");
    vi.unstubAllGlobals();
    expect(resolveEngine("browser")).toBeNull();
    stubDevice();
    expect(resolveEngine("browser")).toBe("device");
  });
});
