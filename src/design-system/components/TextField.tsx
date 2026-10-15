import { useId, type ComponentPropsWithoutRef } from "react";
import { cx } from "../cx";
import styles from "./TextField.module.css";

export type TextFieldProps = ComponentPropsWithoutRef<"input"> & {
  label: string;
  hint?: string;
};

export function TextField({ label, hint, id, className, ...rest }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cx(styles.field, className)}>
      <label className={styles.label} htmlFor={inputId}>
        {label}
      </label>
      <input id={inputId} className={styles.input} aria-describedby={hintId} {...rest} />
      {hint && (
        <span id={hintId} className={styles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
