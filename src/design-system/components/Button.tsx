import type { ComponentPropsWithoutRef } from "react";
import { cx } from "../cx";
import styles from "./Button.module.css";

export type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  /** `lg`: alvo de toque grande (56px), para controles usados no celular. */
  size?: "sm" | "md" | "lg";
};

export function Button({
  variant = "secondary",
  size = "md",
  type = "button",
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(styles.button, styles[variant], styles[size], className)}
      {...rest}
    />
  );
}
