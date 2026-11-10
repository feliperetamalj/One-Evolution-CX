// Paleta validada con dataviz/validate_palette.js sobre #141414 (par divergente azul↔rojo, gris neutro).
// El gris queda en 2.9:1, por eso cada segmento lleva etiqueta y hay leyenda + tooltip.
// Vive fuera de charts.tsx ("use client"): un Server Component no puede leer valores de un módulo cliente.
export const SEGMENT_COLORS = { detractores: "#e66767", pasivos: "#606059", promotores: "#3987e5" };
