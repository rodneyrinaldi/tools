import { describe, expect, it } from "vitest";
import {
  cameraErrorMessage,
  extensionFor,
  formatClock,
  pickRecordingMimeType,
  recordingFileName,
} from "./camera";

describe("formato de gravação", () => {
  it("prefere MP4 e cai para WebM", () => {
    expect(pickRecordingMimeType(() => true)).toBe("video/mp4;codecs=avc1,mp4a.40.2");
    expect(pickRecordingMimeType((type) => type.startsWith("video/webm"))).toBe(
      "video/webm;codecs=vp9,opus",
    );
    expect(pickRecordingMimeType(() => false)).toBeNull();
  });

  it("nome do arquivo com data, hora e extensão do formato", () => {
    const date = new Date(2026, 10, 10, 9, 5, 7);
    expect(recordingFileName(date, "video/mp4")).toBe("teleprompter-20261110-090507.mp4");
    expect(recordingFileName(date, "video/webm;codecs=vp8")).toBe(
      "teleprompter-20261110-090507.webm",
    );
    expect(extensionFor("video/webm")).toBe("webm");
  });
});

describe("formatClock", () => {
  it("mostra mm:ss e horas quando passa de 1 h", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(83_400)).toBe("01:23");
    expect(formatClock(3_723_000)).toBe("1:02:03");
  });
});

describe("cameraErrorMessage", () => {
  it("explica permissão negada, câmera ausente e em uso", () => {
    const error = (name: string) => Object.assign(new Error("x"), { name });
    expect(cameraErrorMessage(error("NotAllowedError"))).toMatch(/negado/);
    expect(cameraErrorMessage(error("NotFoundError"))).toMatch(/Nenhuma câmera/);
    expect(cameraErrorMessage(error("NotReadableError"))).toMatch(/em uso/);
    expect(cameraErrorMessage("??")).toMatch(/Não foi possível/);
  });
});
