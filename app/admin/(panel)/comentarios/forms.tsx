"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { saveCaseNote } from "../../actions";

// Nota del seguimiento: qué se habló y qué se acordó con el cliente.
export function CaseNote({ id, note }: { id: string; note: string | null }) {
  const [result, action, pending] = useActionState(saveCaseNote.bind(null, id), null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <textarea
        name="note"
        defaultValue={note ?? ""}
        maxLength={1000}
        rows={2}
        aria-label="Nota del seguimiento"
        placeholder="Qué se habló y qué se acordó…"
        className="w-full resize-y rounded-xl border border-input bg-input/20 px-3 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
      />
      <div className="flex items-center gap-3">
        <Button variant="outline" disabled={pending}>
          {pending ? "Guardando…" : "Guardar nota"}
        </Button>
        {result && (
          <p role={result.error ? "alert" : "status"} className={result.error ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
            {result.error ?? result.ok}
          </p>
        )}
      </div>
    </form>
  );
}
