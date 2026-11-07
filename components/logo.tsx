// ponytail: logo redibujado desde el brochure 2026; reemplazar por el vector oficial cuando ONE lo entregue.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="20 25 840 380"
      fill="currentColor"
      role="img"
      aria-label="ONE Your Evolution"
      className={className}
    >
      <circle cx="172" cy="172" r="103.5" fill="none" stroke="currentColor" strokeWidth="73" />
      <path d="M335 310V35h80l120 200V35h75v280h-80L410 110v200z" />
      <path d="M628 35h217v13H641v118h159v13H641v118h204v13H628z" />
      <text
        x="460"
        y="393"
        textAnchor="middle"
        textLength="750"
        lengthAdjust="spacing"
        fontSize="46"
        fontWeight="500"
        style={{ fontFamily: "var(--font-sans)" }}
      >
        YOUR EVOLUTION
      </text>
    </svg>
  );
}
