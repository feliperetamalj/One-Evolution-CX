"use client";

import { Check, Copy, X } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { addAdmin, changePassword, removeAdmin, saveAlertEmails, type FormResult } from "../../actions";

const input =
  "h-11 w-full rounded-xl border border-input bg-input/20 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm";

function Status({ result }: { result: FormResult }) {
  if (!result?.error && !result?.ok) return null;
  return result.error ? (
    <p role="alert" className="text-sm text-destructive">
      {result.error}
    </p>
  ) : (
    <p role="status" className="text-sm text-muted-foreground">
      {result.ok}
    </p>
  );
}

export function AddAdmin() {
  const [result, action, pending] = useActionState(addAdmin, null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex gap-2">
        <input name="email" type="email" required autoComplete="off" aria-label="Email" placeholder="nombre@oneevolution.cl" className={input} />
        <Button disabled={pending} className="shrink-0">
          {pending ? "Dando acceso…" : "Dar acceso"}
        </Button>
      </form>
      {result?.password ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <p className="text-pretty">
            Cuenta creada para <strong>{result.ok}</strong>. Su contraseña temporal es:
          </p>
          <div className="flex items-center gap-2">
            <code className="rounded-lg bg-background px-3 py-2 font-mono text-base tracking-wide">{result.password}</code>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(result.password!).then(() => setCopied(true))}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copiada" : "Copiar"}
            </Button>
          </div>
          <p className="text-pretty text-muted-foreground">
            Se muestra solo esta vez. Compártela por un canal privado; podrá cambiarla en Configuración.
          </p>
        </div>
      ) : (
        <Status result={result} />
      )}
    </div>
  );
}

export function RemoveAdmin({ email }: { email: string }) {
  return (
    <form action={removeAdmin.bind(null, email)}>
      <button
        aria-label={`Quitar el acceso de ${email}`}
        title="Quitar acceso"
        onClick={(e) => !confirm(`¿Quitar el acceso de ${email}? Su cuenta se borra.`) && e.preventDefault()}
        className="flex size-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" aria-hidden />
      </button>
    </form>
  );
}

export function AlertEmails({ emails }: { emails: string[] }) {
  const [result, action, pending] = useActionState(saveAlertEmails, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="alert-emails" className="text-sm text-muted-foreground">
        Un email por línea.
      </label>
      <textarea
        id="alert-emails"
        name="emails"
        rows={3}
        defaultValue={emails.join("\n")}
        placeholder="ceo@oneevolution.cl"
        className="w-full rounded-xl border border-input bg-input/20 px-3 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>{pending ? "Guardando…" : "Guardar"}</Button>
        <Status result={result} />
      </div>
    </form>
  );
}

export function ChangePassword() {
  const [result, action, pending] = useActionState(changePassword, null);
  return (
    <form action={action} className="flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1.5 text-sm">
        Contraseña actual
        <input name="current" type="password" required autoComplete="current-password" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Nueva contraseña
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        Repite la nueva contraseña
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={input} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending}>{pending ? "Cambiando…" : "Cambiar contraseña"}</Button>
        <Status result={result} />
      </div>
    </form>
  );
}
