import { useId } from "react";
import { cx } from "../cx";
import styles from "./SegmentedControl.module.css";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type SegmentedControlProps<T extends string> = {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

/** Grupo de opções exclusivas (radio) com visual de pílulas. */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  const name = useId();

  return (
    <fieldset className={cx(styles.fieldset, className)}>
      <legend className={styles.legend}>{label}</legend>
      <div className={styles.track}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              styles.option,
              option.value === value && styles.selected,
              option.disabled && styles.disabled,
            )}
          >
            <input
              type="radio"
              className={styles.input}
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
