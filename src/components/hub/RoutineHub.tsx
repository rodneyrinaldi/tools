"use client";

import { useHashRoute } from "@/hooks/useHashRoute";
import { findRoutine, routines } from "@/routines/registry";
import { RoutineCard } from "./RoutineCard";
import { RoutineStage } from "./RoutineStage";
import styles from "./RoutineHub.module.css";

/** Tela única: lista as rotinas ou exibe a rotina selecionada. */
export function RoutineHub() {
  const [activeId, navigate] = useHashRoute();
  const active = activeId ? findRoutine(activeId) : undefined;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          Tools
        </span>
        <span className={styles.counter}>
          {routines.length} {routines.length === 1 ? "rotina" : "rotinas"}
        </span>
      </header>

      {active ? (
        <RoutineStage routine={active} onBack={() => navigate("")} />
      ) : (
        <section aria-labelledby="hub-title">
          <div className={styles.intro}>
            <h1 id="hub-title" className={styles.title}>
              Escolha uma rotina
            </h1>
            <p className={styles.subtitle}>
              {activeId
                ? `A rotina "${activeId}" não existe. Escolha uma das disponíveis.`
                : "Ferramentas utilitárias reunidas em um só lugar."}
            </p>
          </div>

          <ul className={styles.grid}>
            {routines.map((routine) => (
              <li key={routine.id}>
                <RoutineCard routine={routine} onOpen={() => navigate(routine.id)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
