"use client";

import { Badge, Button } from "@/design-system";
import { formatClock, type Take } from "./camera";
import styles from "./Takes.module.css";

export function downloadTake(take: Take) {
  const link = document.createElement("a");
  link.href = take.url;
  link.download = take.name;
  document.body.append(link);
  link.click();
  link.remove();
}

function shareFile(take: Take): File | null {
  if (typeof File === "undefined") return null;
  const file = new File([take.blob], take.name, { type: take.mimeType });
  return navigator.canShare?.({ files: [file] }) ? file : null;
}

/** Compartilhar (no celular: salvar na galeria, enviar por app). `false` se cancelado. */
export async function shareTake(take: Take): Promise<boolean> {
  const file = shareFile(take);
  if (!file) return false;
  try {
    await navigator.share({ files: [file], title: take.name });
    return true;
  } catch {
    return false;
  }
}

const formatSize = (bytes: number) =>
  `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;

type TakeActionsProps = {
  take: Take;
  onSaved: (id: string) => void;
  onRemove?: (id: string) => void;
  size?: "sm" | "md" | "lg";
};

export function TakeActions({ take, onSaved, onRemove, size = "sm" }: TakeActionsProps) {
  const canShare = typeof navigator !== "undefined" && shareFile(take) !== null;

  return (
    <div className={styles.actions}>
      <Button
        size={size}
        variant="primary"
        onClick={() => {
          downloadTake(take);
          onSaved(take.id);
        }}
      >
        Baixar
      </Button>
      {canShare && (
        <Button
          size={size}
          variant="secondary"
          onClick={async () => {
            if (await shareTake(take)) onSaved(take.id);
          }}
        >
          Compartilhar
        </Button>
      )}
      {onRemove && (
        <Button size={size} variant="ghost" onClick={() => onRemove(take.id)}>
          Remover
        </Button>
      )}
    </div>
  );
}

type TakesListProps = {
  takes: Take[];
  onSaved: (id: string) => void;
  onRemove: (id: string) => void;
};

/** Gravações da sessão (ficam só na memória do navegador até a página ser fechada). */
export function TakesList({ takes, onSaved, onRemove }: TakesListProps) {
  if (takes.length === 0) return null;
  return (
    <section className={styles.list} aria-labelledby="takes-title">
      <h3 id="takes-title" className={styles.title}>
        Gravações ({takes.length})
      </h3>
      <p className={styles.hint}>
        Ficam só neste navegador até você fechar a página: baixe ou compartilhe as que
        quiser guardar.
      </p>
      <ul className={styles.items}>
        {takes.map((take) => (
          <li key={take.id} className={styles.item}>
            <video
              className={styles.thumb}
              src={take.url}
              muted
              playsInline
              preload="metadata"
            />
            <div className={styles.info}>
              <span className={styles.name}>{take.name}</span>
              <span className={styles.meta}>
                {formatClock(take.durationMs)} · {formatSize(take.size)}{" "}
                {take.saved ? (
                  <Badge tone="success">Salva</Badge>
                ) : (
                  <Badge tone="warning">Não salva</Badge>
                )}
              </span>
            </div>
            <TakeActions take={take} onSaved={onSaved} onRemove={onRemove} />
          </li>
        ))}
      </ul>
    </section>
  );
}
