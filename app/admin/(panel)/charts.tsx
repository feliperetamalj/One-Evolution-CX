"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { WaveSummary } from "@/lib/survey";

// Paleta validada con dataviz/validate_palette.js sobre #141414 (par divergente azul↔rojo, gris neutro).
// El gris queda en 2.9:1, por eso cada segmento lleva etiqueta y hay leyenda + tooltip.
export const SEGMENT_COLORS = { detractores: "#e66767", pasivos: "#606059", promotores: "#3987e5" };

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
