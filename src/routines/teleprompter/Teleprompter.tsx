"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Take } from "./camera";
import { Editor } from "./Editor";
import { SPEEDS } from "./script";
import { Session } from "./Session";
import { loadPreferences, savePreferences, type Preferences } from "./storage";

type Mode = { kind: "editing" } | { kind: "presenting"; id: number };

export default function Teleprompter() {
  // A rotina só monta no cliente (lazy, após a hidratação), então ler o storage aqui é seguro.
  const [preferences, setPreferences] = useState<Preferences>(loadPreferences);
  const [mode, setMode] = useState<Mode>({ kind: "editing" });
  const [focus, setFocus] = useState(false);
  // Gravações da sessão: vivem aqui para sobreviver ao sair da apresentação.
  const [takes, setTakes] = useState<Take[]>([]);

  useEffect(() => savePreferences(preferences), [preferences]);

  const enterFocus = useCallback(() => {
    setFocus(true);
    document.documentElement.requestFullscreen?.().catch(() => {
      // Tela cheia negada: o modo foco continua cobrindo a janela.
    });
  }, []);

  const leaveFocus = useCallback(() => {
    setFocus(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  // Saiu da tela cheia pelo navegador (Esc/F11) → volta para a visualização encaixada.
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFocus(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  // Sem rolagem da página por trás do modo foco.
  useEffect(() => {
    if (!focus) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [focus]);

  // Avisa antes de fechar a página com gravações não salvas.
  const hasUnsaved = takes.some((take) => !take.saved);
  useEffect(() => {
    if (!hasUnsaved) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsaved]);

  // Libera a memória dos vídeos ao sair da rotina.
  const takesRef = useRef(takes);
  useEffect(() => {
    takesRef.current = takes;
  });
  useEffect(
    () => () => takesRef.current.forEach((take) => URL.revokeObjectURL(take.url)),
    [],
  );

  function start(withFocus: boolean) {
    // Com câmera, a apresentação sempre ocupa a tela toda.
    if (withFocus || preferences.camera) enterFocus();
    setMode({ kind: "presenting", id: Date.now() });
  }

  function exit() {
    leaveFocus();
    setMode({ kind: "editing" });
  }

  const addTake = useCallback(
    (take: Take) => setTakes((current) => [take, ...current]),
    [],
  );
  const markSaved = useCallback(
    (id: string) =>
      setTakes((current) =>
        current.map((take) => (take.id === id ? { ...take, saved: true } : take)),
      ),
    [],
  );
  const removeTake = useCallback(
    (id: string) =>
      setTakes((current) =>
        current.filter((take) => {
          if (take.id === id) URL.revokeObjectURL(take.url);
          return take.id !== id;
        }),
      ),
    [],
  );

  if (mode.kind === "presenting") {
    return (
      <Session
        key={mode.id}
        text={preferences.text}
        drive={preferences.drive}
        initialWordsPerMinute={SPEEDS[preferences.speed]}
        holdPauses={preferences.holdPauses}
        countdown={preferences.countdown}
        textColor={preferences.textColor}
        camera={
          preferences.camera ? { dim: preferences.dim, facing: preferences.facing } : null
        }
        onTake={addTake}
        onTakeSaved={markSaved}
        focus={focus}
        onToggleFocus={focus ? leaveFocus : enterFocus}
        onExit={exit}
      />
    );
  }

  return (
    <Editor
      preferences={preferences}
      onChange={(next) => setPreferences((previous) => ({ ...previous, ...next }))}
      onStart={start}
      takes={takes}
      onTakeSaved={markSaved}
      onTakeRemove={removeTake}
    />
  );
}
