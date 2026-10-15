"use client";

import { useCallback, useEffect, useState } from "react";
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

  function start(withFocus: boolean) {
    if (withFocus) enterFocus();
    setMode({ kind: "presenting", id: Date.now() });
  }

  function exit() {
    leaveFocus();
    setMode({ kind: "editing" });
  }

  if (mode.kind === "presenting") {
    return (
      <Session
        key={mode.id}
        text={preferences.text}
        drive={preferences.drive}
        initialWordsPerMinute={SPEEDS[preferences.speed]}
        holdPauses={preferences.holdPauses}
        countdown={preferences.countdown}
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
    />
  );
}
