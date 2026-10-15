import type { ComponentPropsWithoutRef, ElementType } from "react";
import { cx } from "../cx";
import styles from "./Surface.module.css";

type SurfaceOwnProps<T extends ElementType> = {
  as?: T;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "strong";
  interactive?: boolean;
};

export type SurfaceProps<T extends ElementType = "div"> = SurfaceOwnProps<T> &
  Omit<ComponentPropsWithoutRef<T>, keyof SurfaceOwnProps<T>>;

const paddingClass = {
  none: undefined,
  sm: styles.padSm,
  md: styles.padMd,
  lg: styles.padLg,
} as const;

/** Painel de vidro translúcido — bloco básico de todas as telas. */
export function Surface<T extends ElementType = "div">({
  as,
  padding = "md",
  variant = "default",
  interactive = false,
  className,
  ...rest
}: SurfaceProps<T>) {
  const Component: ElementType = as ?? "div";
  return (
    <Component
      className={cx(
        styles.surface,
        paddingClass[padding],
        variant === "strong" && styles.strong,
        interactive && styles.interactive,
        className,
      )}
      {...rest}
    />
  );
}
