import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../cx";
import styles from "./Badge.module.css";

export type BadgeProps = ComponentPropsWithoutRef<"span"> & {
  tone?: "neutral" | "accent" | "success" | "warning";
};

export function Badge({ tone = "neutral", className, ...rest }: BadgeProps) {
  return (
    <span
      className={cx(styles.badge, tone !== "neutral" && styles[tone], className)}
      {...rest}
    />
  );
}
