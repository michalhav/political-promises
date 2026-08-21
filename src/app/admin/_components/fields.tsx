import type { ReactNode } from "react";

/** Vstupní prvky redakční konzole. Utilitární, bez ozdob — je to interní nástroj. */

const CONTROL = "border-border bg-background w-full rounded-md border px-3 py-2";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      {children}
      {hint ? <span className="text-muted block text-xs">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CONTROL} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${CONTROL} min-h-24 font-mono text-sm`} />;
}

export function Select({
  options,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: readonly { value: string; label: string }[];
}) {
  return (
    <select {...props} className={CONTROL}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** Skóre 0–5 pro dimenzi hodnotitelnosti. */
export function ScoreInput({
  name,
  label,
  question,
  defaultValue,
}: {
  name: string;
  label: string;
  question: string;
  defaultValue?: number;
}) {
  return (
    <Field label={label} hint={question} required>
      <input
        type="number"
        name={name}
        min={0}
        max={5}
        step={1}
        required
        defaultValue={defaultValue ?? 0}
        className={CONTROL}
      />
    </Field>
  );
}
