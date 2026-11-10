// Paleta validada con dataviz/validate_palette.js sobre #141414 (par divergente azul↔rojo, gris neutro).
// El gris queda en 2.9:1, por eso cada segmento lleva etiqueta y hay leyenda + tooltip.
// Vive fuera de charts.tsx ("use client"): un Server Component no puede leer valores de un módulo cliente.
export const SEGMENT_COLORS = { detractores: "#e66767", pasivos: "#606059", promotores: "#3987e5" };

// Una por categoría CSAT, en el orden de csat_categories.position (el color sigue a la categoría, nunca al ranking).
// Paleta categórica de dataviz, pasos oscuros; validada sobre #141414 (todas ≥ 3:1, ΔE CVD adyacente ≥ 8.4).
export const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
