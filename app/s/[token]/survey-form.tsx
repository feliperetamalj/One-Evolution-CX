"use client";

import { MotionConfig } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { TransitionPanel } from "@/components/motion-primitives/transition-panel";
import { Button } from "@/components/ui/button";
import { CSAT_SCALE, NPS_QUESTION, commentPrompt, segment, type Segment } from "@/lib/survey";
import { cn } from "@/lib/utils";
import { saveResponse, type Answer, type SaveResult } from "./actions";

const STEPS = 3;
const ERRORS = {
  closed: "Esta encuesta ya cerró, así que no pudimos guardar tu respuesta.",
  invalid: "Algo no cuadró con tus respuestas. Recarga la página e inténtalo de nuevo.",
  unknown: "No pudimos guardar tu respuesta. Revisa tu conexión e inténtalo de nuevo.",
};
// Color por segmento; el número sigue siendo la etiqueta, así que no depende solo del color.
const NPS_TONE: Record<Segment, string> = {
  detractor: "border-red-400/50 bg-red-400/20 text-red-200 has-checked:border-red-400 has-checked:bg-red-400",
  pasivo: "border-green-300/70 bg-green-300/35 text-green-50 has-checked:border-green-200 has-checked:bg-green-200",
  promotor: "border-green-400 bg-green-500/60 text-white has-checked:border-green-400 has-checked:bg-green-400",
};

export function SurveyForm({
  id,
  firstName,
  closesAt,
  questions,
  initial,
}: {
  id: string;
  firstName: string;
  closesAt: string;
  questions: { category: string; text: string }[]; // 1 por categoría
  initial: Answer | null;
}) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [a, setA] = useState<Answer>(initial ?? { nps: -1, csat: {}, comment: "", contactOk: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<keyof typeof ERRORS | null>(null);
  const moved = useRef(false);

  // Al cambiar de paso: volver arriba y llevar el foco al título (VoiceOver lo anuncia).
  useEffect(() => {
    if (!moved.current) return;
    window.scrollTo({ top: 0 });
    document.getElementById(`step-${step}`)?.focus({ preventScroll: true });
  }, [step]);

  const go = (next: number) => {
    moved.current = true;
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const save = async (answer: Answer, final = false) => {
    const res: SaveResult = await saveResponse(id, answer, final).catch(() => ({ ok: false, error: "unknown" }) as const);
    setError(res.ok ? null : res.error);
    return res.ok;
  };

  const setCsat = (key: string, score: number | null) =>
    setA((prev) => {
      const csat = { ...prev.csat };
      if (score === null) delete csat[key];
      else csat[key] = score;
      return { ...prev, csat };
    });

  const submit = async () => {
    setSaving(true);
    const ok = await save(a, true);
    setSaving(false);
    if (ok) go(3);
  };

  const steps = [
    <section key="nps" className="flex flex-col gap-6">
      {initial && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
          Ya respondiste esta encuesta. Puedes cambiar tus respuestas hasta el {closesAt}.
        </p>
      )}
      <div className="flex flex-col gap-3">
        <p className="text-eyebrow text-brand">Hola, {firstName}</p>
        <StepTitle step={0}>{NPS_QUESTION}</StepTitle>
      </div>
      <div role="radiogroup" aria-labelledby="step-0" aria-describedby="nps-scale" className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 11 }, (_, n) => (
          <Choice
            key={n}
            name="nps"
            value={n}
            checked={a.nps === n}
            onSelect={() => setA({ ...a, nps: n })}
            className={cn("basis-[calc((100%-2.5rem)/6)] sm:basis-[calc((100%-5rem)/11)]", NPS_TONE[segment(n)])}
          />
        ))}
      </div>
      <p id="nps-scale" className="text-center text-sm text-muted-foreground">
        0 = nada probable · 10 = muy probable
      </p>
      <Actions>
        <Button size="lg" className="flex-1" disabled={a.nps < 0} onClick={() => (save(a), go(1))}>
          Continuar
        </Button>
      </Actions>
    </section>,

    <section key="csat" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <StepTitle step={1}>¿Qué tan satisfecho/a estás con…?</StepTitle>
        <p className="text-sm text-pretty text-muted-foreground">
          Piensa en tus sesiones de las últimas 2 semanas y evalúa cada aspecto del gimnasio. Si algo no aplica, déjalo
          en blanco.
        </p>
      </div>
      {questions.map((q) => (
        <fieldset key={q.category} className="flex flex-col gap-1.5">
          <legend className="mb-3 font-medium">{q.text}</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Choice
                key={n}
                name={q.category}
                value={n}
                label={`${n}, ${CSAT_SCALE[n - 1]}`}
                checked={a.csat[q.category] === n}
                onSelect={() => setCsat(q.category, n)}
                onTap={() => a.csat[q.category] === n && setCsat(q.category, null)}
              />
            ))}
          </div>
          {/* Ya va en el aria-label de cada opción */}
          <div aria-hidden className="flex justify-between text-xs text-muted-foreground">
            <span>{CSAT_SCALE[0]}</span>
            <span>{CSAT_SCALE[4]}</span>
          </div>
        </fieldset>
      ))}
      <Actions>
        <Button size="lg" variant="ghost" onClick={() => go(0)}>
          Atrás
        </Button>
        <Button size="lg" className="flex-1" onClick={() => (save(a), go(2))}>
          Continuar
        </Button>
      </Actions>
    </section>,

    <section key="comment" className="flex flex-col gap-6">
      <StepTitle step={2}>{a.nps >= 0 ? commentPrompt(a.nps) : "¿Algo más que quieras contarnos?"}</StepTitle>
      <textarea
        aria-labelledby="step-2"
        value={a.comment}
        onChange={(e) => setA({ ...a, comment: e.target.value })}
        maxLength={2000}
        rows={5}
        placeholder="Opcional"
        className="w-full resize-none rounded-xl border border-input bg-input/20 px-4 py-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <label className="flex min-h-11 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={a.contactOk}
          onChange={(e) => setA({ ...a, contactOk: e.target.checked })}
          className="size-5 shrink-0 accent-brand"
        />
        <span>Pueden contactarme sobre mis respuestas</span>
      </label>
      <p className="text-sm text-pretty text-muted-foreground">
        Tus respuestas son confidenciales: el equipo de ONE ve resultados agregados y solo verá tu nombre si aceptas
        que te contactemos. Las usamos únicamente para mejorar tu experiencia.
      </p>
      <Actions>
        <Button size="lg" variant="ghost" onClick={() => go(1)} disabled={saving}>
          Atrás
        </Button>
        <Button size="lg" className="flex-1" onClick={submit} disabled={saving}>
          {saving ? "Enviando…" : "Enviar"}
        </Button>
      </Actions>
    </section>,

    <section key="thanks" className="flex flex-col items-center gap-4 pt-8 text-center">
      <StepTitle step={3} className="text-display">
        Gracias, {firstName}
      </StepTitle>
      <p className="max-w-sm text-pretty text-muted-foreground">
        {a.nps <= 6 && a.contactOk
          ? "Leímos tu respuesta. Alguien del equipo te escribirá en los próximos días."
          : "Tu opinión ya está en manos del equipo. Nos vemos en tu próxima sesión."}
      </p>
    </section>,
  ];

  return (
    <MotionConfig reducedMotion="user">
      {step < STEPS && (
        <div className="mb-8 flex flex-col gap-2">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            Paso {step + 1} de {STEPS}
          </p>
          <div className="flex gap-1.5" aria-hidden>
            {Array.from({ length: STEPS }, (_, i) => (
              <span
                key={i}
                className={cn("h-1 flex-1 rounded-full transition-colors duration-300", i <= step ? "bg-brand" : "bg-muted")}
              />
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {ERRORS[error]}
        </p>
      )}
      <TransitionPanel
        activeIndex={step}
        custom={dir}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        variants={{
          enter: (d: number) => ({ x: d * 32, opacity: 0 }),
          center: { x: 0, opacity: 1 },
          exit: (d: number) => ({ x: d * -32, opacity: 0 }),
        }}
      >
        {steps}
      </TransitionPanel>
    </MotionConfig>
  );
}

function StepTitle({ step, className, children }: { step: number; className?: string; children: React.ReactNode }) {
  return (
    <h1
      id={`step-${step}`}
      tabIndex={-1}
      className={cn("text-2xl leading-snug font-semibold tracking-tight text-balance font-sans outline-none", className)}
    >
      {children}
    </h1>
  );
}

// Radio nativo con forma de botón: flechas del teclado y VoiceOver funcionan sin código extra.
// onTap solo se dispara con dedo/mouse (e.detail > 0), no al moverse con flechas: así tocar de nuevo un CSAT lo borra.
function Choice({
  name,
  value,
  label,
  checked,
  onSelect,
  onTap,
  className,
}: {
  name: string;
  value: number;
  label?: string;
  checked: boolean;
  onSelect: () => void;
  onTap?: () => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex h-12 cursor-pointer items-center justify-center rounded-xl border border-input bg-input/20 text-lg font-medium tabular-nums select-none",
        "transition-[background-color,color,border-color,scale] duration-100 active:scale-95",
        "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
        "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        aria-label={label}
        onChange={onSelect}
        onClick={(e) => e.detail > 0 && onTap?.()}
        className="sr-only"
      />
      {value}
    </label>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 flex gap-3 bg-background/85 px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:-mx-6 sm:px-6">
      {children}
    </div>
  );
}
