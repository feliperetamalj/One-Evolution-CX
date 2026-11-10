"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { importClients, openWaveNow } from "../../actions";

export function OpenWave({ disabled }: { disabled: boolean }) {
  const [msg, action, pending] = useActionState(openWaveNow, null);
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <Button type="submit" size="lg" disabled={disabled || pending}>
        {pending ? "Abriendo y enviando…" : "Abrir ola ahora"}
      </Button>
      {msg && (
        <p role="status" className="text-sm text-muted-foreground">
          {msg}
        </p>
      )}
    </form>
  );
}

export function ImportClients() {
  const [msg, action, pending] = useActionState(importClients, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="csv" className="text-sm text-muted-foreground">
        Pega desde Excel o Google Sheets las columnas <strong className="text-foreground">nombre, email, teléfono, plan</strong>.
        Si el email ya existe, se actualiza.
      </label>
      <textarea
        id="csv"
        name="csv"
        rows={6}
        required
        placeholder={"Nombre;Email;Teléfono;Plan\nCamila Rojas;camila@mail.cl;9 8765 4321;Plan 3"}
        className="w-full rounded-xl border border-input bg-input/20 px-4 py-3 font-mono text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Importando…" : "Importar clientes"}</Button>
        {msg && (
          <p role="status" className="text-sm whitespace-pre-line text-muted-foreground">
            {msg}
          </p>
        )}
      </div>
    </form>
  );
}
