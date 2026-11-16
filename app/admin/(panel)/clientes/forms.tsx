"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/survey";
import { importClients, openWaveNow, updateClient } from "../../actions";
import { Status, input } from "../configuracion/forms";

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

type Editable = { id: string; full_name: string; email: string | null; phone: string | null; plan: string | null; active: boolean };

export function EditClient({ client: c }: { client: Editable }) {
  const [result, action, pending] = useActionState(updateClient.bind(null, c.id), null);
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm">
        Nombre
        <input name="full_name" required defaultValue={c.full_name} autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Celular
        <input name="phone" type="tel" inputMode="tel" defaultValue={c.phone ? `+${c.phone}` : ""} placeholder="+56 9 1234 5678" autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Email
        <input name="email" type="email" defaultValue={c.email ?? ""} placeholder="Opcional" autoComplete="off" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Plan
        <select name="plan" defaultValue={c.plan ?? ""} className={input}>
          <option value="">Sin plan</option>
          {Object.entries(PLANS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input name="active" type="checkbox" defaultChecked={c.active} className="size-5 accent-brand" />
        Activo: recibe las próximas encuestas
      </label>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Status result={result} />
      </div>
    </form>
  );
}
