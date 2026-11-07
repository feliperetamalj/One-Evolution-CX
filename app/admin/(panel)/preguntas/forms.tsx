"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addQuestion } from "../../actions";

export function AddQuestion({ category, label }: { category: string; label: string }) {
  const [error, action, pending] = useActionState(addQuestion.bind(null, category), null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="text"
          required
          minLength={5}
          maxLength={160}
          aria-label={`Nueva pregunta de ${label}`}
          placeholder="Completa: ¿Qué tan satisfecho/a estás con…?"
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-input/20 px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
        />
        <Button disabled={pending}>{pending ? "Añadiendo…" : "Añadir"}</Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
