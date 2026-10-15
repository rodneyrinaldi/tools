import { Suspense } from "react";
import { Button, Surface } from "@/design-system";
import type { RoutineManifest } from "@/routines/types";
import styles from "./RoutineStage.module.css";

type RoutineStageProps = {
  routine: RoutineManifest;
  onBack: () => void;
};

/** Moldura padrão onde qualquer rotina é renderizada. */
export function RoutineStage({ routine, onBack }: RoutineStageProps) {
  const Routine = routine.component;

  return (
    <section aria-labelledby="routine-title" className={styles.stage}>
      <div className={styles.header}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Rotinas
        </Button>
        <h1 id="routine-title" className={styles.title}>
          <span aria-hidden>{routine.icon}</span> {routine.title}
        </h1>
        <p className={styles.description}>{routine.description}</p>
      </div>

      <Surface padding="lg">
        <Suspense fallback={<p className={styles.loading}>Carregando rotina…</p>}>
          <Routine />
        </Suspense>
      </Surface>
    </section>
  );
}
