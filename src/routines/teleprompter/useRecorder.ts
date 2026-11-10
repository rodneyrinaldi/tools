"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  pickRecordingMimeType,
  recordingFileName,
  type RecorderState,
  type Take,
} from "./camera";

const TIMESLICE_MS = 1000;

/**
 * Grava o `stream` com MediaRecorder. Cada gravação concluída é entregue em `onTake`.
 * Desmontar com gravação ativa encerra e entrega a gravação (nada se perde ao sair).
 */
export function useRecorder(stream: MediaStream | null, onTake: (take: Take) => void) {
  const [state, setState] = useState<RecorderState>("inactive");
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const timing = useRef({ accumulated: 0, startedAt: 0 });
  const stopped = useRef<Promise<void> | null>(null);
  const onTakeRef = useRef(onTake);
  useEffect(() => {
    onTakeRef.current = onTake;
  });

  const supported = typeof MediaRecorder !== "undefined";

  const start = useCallback((): boolean => {
    if (!stream || !supported || recorderRef.current) return false;
    const mimeType = pickRecordingMimeType((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined,
    );
    const chunks: Blob[] = [];
    const startedAtDate = new Date();

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    stopped.current = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "video/webm";
        const blob = new Blob(chunks, { type });
        // `accumulated` já inclui o último trecho: stop() e o desmonte o somam antes de parar.
        const durationMs = timing.current.accumulated;
        onTakeRef.current({
          id: `${startedAtDate.getTime()}`,
          url: URL.createObjectURL(blob),
          blob,
          name: recordingFileName(startedAtDate, type),
          mimeType: type,
          size: blob.size,
          durationMs,
          saved: false,
        });
        recorderRef.current = null;
        stopped.current = null;
        resolve();
      };
    });

    recorder.start(TIMESLICE_MS);
    recorderRef.current = recorder;
    timing.current = { accumulated: 0, startedAt: performance.now() };
    setElapsedMs(0);
    setState("recording");
    return true;
  }, [stream, supported]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "recording") return;
    recorder.pause();
    timing.current.accumulated += performance.now() - timing.current.startedAt;
    setElapsedMs(timing.current.accumulated);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder?.state !== "paused") return;
    recorder.resume();
    timing.current.startedAt = performance.now();
    setState("recording");
  }, []);

  /** Encerra a gravação; resolve quando a gravação foi entregue em `onTake`. */
  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      timing.current.accumulated += performance.now() - timing.current.startedAt;
    }
    const done = stopped.current;
    recorder.stop();
    setState("inactive");
    setElapsedMs(timing.current.accumulated);
    await done;
  }, []);

  // Cronômetro da gravação.
  useEffect(() => {
    if (state !== "recording") return;
    const id = setInterval(() => {
      setElapsedMs(
        timing.current.accumulated + performance.now() - timing.current.startedAt,
      );
    }, 250);
    return () => clearInterval(id);
  }, [state]);

  // Sair da sessão gravando: encerra e entrega a gravação.
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        if (recorder.state === "recording") {
          timing.current.accumulated += performance.now() - timing.current.startedAt;
        }
        recorder.stop();
      }
    },
    [],
  );

  return { supported, state, elapsedMs, start, pause, resume, stop };
}
