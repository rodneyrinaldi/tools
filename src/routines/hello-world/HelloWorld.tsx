"use client";

import { useState } from "react";
import { Button, Surface, TextField } from "@/design-system";
import { buildGreeting } from "./greeting";
import styles from "./HelloWorld.module.css";

export default function HelloWorld() {
  const [name, setName] = useState("");

  return (
    <div className={styles.root}>
      <Surface variant="strong" padding="lg" className={styles.greetingCard}>
        <p className={styles.greeting} aria-live="polite">
          {buildGreeting(name)}
        </p>
      </Surface>

      <div className={styles.form}>
        <TextField
          label="Seu nome"
          placeholder="Ex.: Ada"
          hint="Deixe em branco para cumprimentar o mundo."
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="given-name"
        />
        <Button variant="ghost" onClick={() => setName("")} disabled={!name}>
          Limpar
        </Button>
      </div>
    </div>
  );
}
