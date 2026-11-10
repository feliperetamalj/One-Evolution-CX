"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { WaveSummary } from "@/lib/survey";
import { SEGMENT_COLORS } from "./colors";


const axis = { tickLine: false, axisLine: false, tickMargin: 8, fontSize: 12 } as const;

function Tip({ active, payload, lines }: { active?: boolean; payload?: { payload: Record<string, number | string> }[]; lines: (row: Record<string, number | string>) => string[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const [title, ...rest] = lines(row);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      {rest.map((l) => (
        <p key={l} className="text-muted-foreground">
          {l}
        </p>
      ))}
    </div>
  );
}

export function NpsTrend({ data }: { data: WaveSummary[] }) {
  const rows = data.filter((w) => w.nps !== null).map((w) => ({ ola: `Ola ${w.wave}`, nps: w.nps!, media: w.npsRolling ?? w.nps!, n: w.responded }));
  const vals = rows.map((r) => r.nps);
  const lo = Math.max(-100, Math.floor((Math.min(...vals) - 15) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 15) / 10) * 10);
  return (
    <ChartContainer config={{ nps: { label: "NPS", color: "var(--brand)" } }} className="aspect-auto h-64 w-full">
      <LineChart data={rows} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="ola" {...axis} />
        <YAxis domain={[lo, hi]} width={36} {...axis} />
        {lo < 0 && <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />}
        <ChartTooltip
          cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
          content={<Tip lines={(r) => [`${r.ola}`, `NPS ${r.nps}`, `Media 2 olas ${r.media}`, `${r.n} respuestas`]} />}
        />
        <Line dataKey="nps" stroke="var(--color-nps)" strokeWidth={2} dot={{ r: 4, fill: "var(--color-nps)", strokeWidth: 0 }} activeDot={{ r: 6 }} isAnimationActive={false}>
          {/* Etiqueta directa solo en la última ola */}
          <LabelList
            dataKey="nps"
            content={({ x, y, value, index }) =>
              index === rows.length - 1 ? (
                <text x={Number(x)} y={Number(y) - 12} textAnchor="middle" className="fill-foreground text-sm font-semibold">
                  {value}
                </text>
              ) : null
            }
          />
        </Line>
      </LineChart>
    </ChartContainer>
  );
}

type Series = { key: string; label: string; color: string };
type TipRow = { dataKey?: string | number; name?: string; value?: number | null; color?: string };

function CsatTip({ active, payload, label }: { active?: boolean; payload?: TipRow[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => typeof p.value === "number").sort((a, b) => b.value! - a.value!);
  return (
    <div className="min-w-44 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {rows.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
          <span className="flex-1">{p.name}</span>
          <span className="text-foreground tabular-nums">{p.value} %</span>
        </p>
      ))}
    </div>
  );
}

// CSAT por categoría a lo largo de las olas. Con todas visibles, tocar una la deja sola; después cada toque suma o quita.
// Pasar el mouse (o el foco) por una categoría destaca su línea.
export function CsatTrend({ data, categories, target }: { data: WaveSummary[]; categories: Series[]; target: number }) {
  const keys = categories.map((c) => c.key);
  const [on, setOn] = useState(() => new Set(keys));
  const [focus, setFocus] = useState<string | null>(null);
  const all = on.size === keys.length;
  const shown = categories.filter((c) => on.has(c.key));
  const pick = (k: string) =>
    setOn((prev) => {
      if (prev.size === keys.length) return new Set([k]);
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next.size ? next : new Set(keys);
    });

  const rows: Record<string, string | number | null>[] = data.map((w) => ({ ola: `Ola ${w.wave}`, ...Object.fromEntries(keys.map((k) => [k, w.items[k]?.top2 ?? null])) }));
  const vals = rows.flatMap((r) => shown.map((c) => r[c.key]).filter((v): v is number => typeof v === "number"));
  const lo = Math.max(0, Math.floor((Math.min(target, ...vals) - 10) / 10) * 10);
  const chip = "inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm transition-colors";

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Categorías del gráfico" className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={all}
          onClick={() => setOn(new Set(keys))}
          className={`${chip} ${all ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}
        >
          Todas
        </button>
        {categories.map((c) => {
          const active = on.has(c.key);
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={active && !all}
              onClick={() => pick(c.key)}
              onMouseEnter={() => active && setFocus(c.key)}
              onMouseLeave={() => setFocus(null)}
              onFocus={() => active && setFocus(c.key)}
              onBlur={() => setFocus(null)}
              className={`${chip} ${active ? "text-foreground" : "text-muted-foreground"} ${active && !all ? "border-ring" : "border-border"} hover:text-foreground`}
            >
              <span
                className="size-2.5 rounded-full border-2"
                style={active ? { background: c.color, borderColor: c.color } : { borderColor: "var(--muted-foreground)" }}
                aria-hidden
              />
              {c.label}
            </button>
          );
        })}
      </div>

      <ChartContainer config={Object.fromEntries(categories.map((c) => [c.key, { label: c.label, color: c.color }]))} className="aspect-auto h-72 w-full">
        <LineChart data={rows} margin={{ top: 16, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="ola" {...axis} />
          <YAxis domain={[lo, 100]} tickFormatter={(v) => `${v}%`} width={44} {...axis} />
          <ReferenceLine y={target} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <ChartTooltip cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }} content={<CsatTip />} />
          {shown.map((c) => (
            <Line
              key={c.key}
              dataKey={c.key}
              name={c.label}
              stroke={c.color}
              strokeWidth={2}
              strokeOpacity={focus && focus !== c.key ? 0.15 : 1}
              dot={{ r: 4, fill: c.color, stroke: "var(--card)", strokeWidth: 2, fillOpacity: focus && focus !== c.key ? 0.15 : 1 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

const compositionConfig = {
  detractores: { label: "Detractores (0–6)", color: SEGMENT_COLORS.detractores },
  pasivos: { label: "Pasivos (7–8)", color: SEGMENT_COLORS.pasivos },
  promotores: { label: "Promotores (9–10)", color: SEGMENT_COLORS.promotores },
} satisfies ChartConfig;

export function Composition({ data }: { data: WaveSummary[] }) {
  const pct = (part: number, w: WaveSummary) => Math.round((100 * part) / w.responded);
  const rows = data
    .filter((w) => w.responded)
    .map((w) => ({ ola: `Ola ${w.wave}`, detractores: pct(w.detractors, w), pasivos: pct(w.passives, w), promotores: pct(w.promoters, w), n: w.responded }));
  const label = (fill: string) => (
    <LabelList position="center" fill={fill} fontSize={11} fontWeight={600} formatter={(v: unknown) => (Number(v) >= 12 ? `${v}%` : "")} />
  );
  return (
    <ChartContainer config={compositionConfig} className="aspect-auto h-64 w-full">
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="ola" {...axis} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} width={40} {...axis} />
        <ChartTooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          content={<Tip lines={(r) => [`${r.ola} · ${r.n} respuestas`, `Promotores ${r.promotores}%`, `Pasivos ${r.pasivos}%`, `Detractores ${r.detractores}%`]} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="detractores" stackId="s" fill="var(--color-detractores)" stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
          {label("#0b0b0b")}
        </Bar>
        <Bar dataKey="pasivos" stackId="s" fill="var(--color-pasivos)" stroke="var(--card)" strokeWidth={2} isAnimationActive={false}>
          {label("#ffffff")}
        </Bar>
        <Bar dataKey="promotores" stackId="s" fill="var(--color-promotores)" stroke="var(--card)" strokeWidth={2} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {label("#0b0b0b")}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// Select que escribe su valor en la URL (?param=valor); vacío lo quita.
export function ParamSelect({ param, label, value, options }: { param: string; label: string; value: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const params = useSearchParams();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const p = new URLSearchParams(params);
        if (e.target.value) p.set(param, e.target.value);
        else p.delete(param);
        router.push(`?${p}`, { scroll: false });
      }}
      className="h-11 rounded-xl border border-input bg-input/20 px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
