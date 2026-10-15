import { Badge, Surface } from "@/design-system";
import type { RoutineManifest, RoutineStatus } from "@/routines/types";
import styles from "./RoutineCard.module.css";

const statusBadge: Record<
  RoutineStatus,
  { label: string; tone: "success" | "accent" | "warning" }
> = {
  stable: { label: "Estável", tone: "success" },
  beta: { label: "Beta", tone: "accent" },
  experimental: { label: "Experimental", tone: "warning" },
};

type RoutineCardProps = {
  routine: RoutineManifest;
  onOpen: () => void;
};

export function RoutineCard({ routine, onOpen }: RoutineCardProps) {
  const status = statusBadge[routine.status];

  return (
    <Surface as="button" interactive onClick={onOpen} className={styles.card}>
      <span className={styles.top}>
        <span className={styles.icon} aria-hidden>
          {routine.icon}
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </span>
      <span className={styles.title}>{routine.title}</span>
      <span className={styles.description}>{routine.description}</span>
    </Surface>
  );
}
