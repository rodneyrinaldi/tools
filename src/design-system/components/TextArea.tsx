import { useId, type ComponentProps } from "react";
import { cx } from "../cx";
import fieldStyles from "./TextField.module.css";
import styles from "./TextArea.module.css";

export type TextAreaProps = ComponentProps<"textarea"> & {
  label: string;
  hint?: string;
};

export function TextArea({ label, hint, id, className, ...rest }: TextAreaProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;

  return (
    <div className={cx(fieldStyles.field, className)}>
      <label className={fieldStyles.label} htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        className={cx(fieldStyles.input, styles.textarea)}
        aria-describedby={hintId}
        {...rest}
      />
      {hint && (
        <span id={hintId} className={fieldStyles.hint}>
          {hint}
        </span>
      )}
    </div>
  );
}
