"use client";

import { useActionState } from "react";

import type { ActionResult } from "@/app/admin/actions";

/**
 * Formulář redakční konzole.
 *
 * Jediná klientská komponenta v adminu. Existuje kvůli tomu, aby se chyby
 * validace zobrazily u formuláře a nezmizely při přesměrování — redaktor
 * potřebuje vidět, co je špatně, a mít vyplněné hodnoty pořád před sebou.
 *
 * Samotná akce běží na serveru; tahle komponenta jen zobrazuje její výsledek.
 * Žádná autorizace tu není a být nesmí.
 */
interface AdminFormProps {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  /** Formuláře typu „odhlásit" žádná pole nemají. */
  children?: React.ReactNode;
  /** Nenápadné potvrzení u destruktivních akcí. */
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
}

const BUTTON_CLASSES = {
  primary: "bg-accent text-accent-foreground",
  secondary: "border-border border",
  danger: "border-border border text-muted",
} as const;

export function AdminForm({
  action,
  submitLabel,
  children,
  confirm,
  variant = "secondary",
}: AdminFormProps) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );

  return (
    <form
      action={formAction}
      className="space-y-3"
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}

      {state?.errors && state.errors.length > 0 ? (
        <div role="alert" className="border-border rounded-md border border-dashed p-3 text-sm">
          <p className="font-semibold">Uložení neproběhlo</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.errors.map((issue, index) => (
              <li key={index}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {state?.ok && state.message ? (
        <p role="status" className="text-sm">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`rounded-md px-4 py-2 font-medium disabled:opacity-60 ${BUTTON_CLASSES[variant]}`}
      >
        {pending ? "Pracuji…" : submitLabel}
      </button>
    </form>
  );
}
