# Roadmap: Experiencia de Clientes ONE

La arquitectura y sus razones están en [ADR-001](ADR-001-arquitectura.md).
Cada etapa termina en algo desplegado y verificable. No se avanza a la siguiente sin cumplir el **"Listo cuando"**.

| Etapa | Entregable | Esfuerzo estimado |
|---|---|---|
| 0 | Fundaciones y marca | ½ día |
| 1 | Base de datos, seguridad y KPIs | 1 día |
| 2 | Encuesta del cliente | 2 días |
| 3 | Olas automáticas y envíos | 1,5 días |
| 4 | Dashboard del CEO | 2–3 días |
| 5 | Piloto y lanzamiento | 2 olas (~4 semanas de calendario) |
| 6 | Mejoras v2 (cuando haya datos) | Según lo que muestren los datos |

**Skills por etapa:** `/ponytail:ponytail` aplica en todas (código mínimo, sin andamiaje "por si acaso").

| Skill | Dónde se usa |
|---|---|
| `/design-styles` | E0: elegir el estilo base, alineado al brochure (oscuro, editorial y minimal) |
| `/ui-styling` | E0: tokens de Tailwind y shadcn · E2/E4: componentes |
| `/apple-design` | E0: tipografía · E2: zonas táctiles, springs y `prefers-reduced-motion` · E4: detalles |
| `/ui-ux-pro-max` | E2: UX del formulario móvil y accesibilidad · E4: revisión final |
| `/motion-primitives` | E2: transiciones entre pasos · E4: `AnimatedNumber` en las tarjetas de KPI |
| `/data:build-dashboard` | E4: estructura del dashboard (KPIs, filtros, tablas), adaptada a Next.js en vez de un HTML suelto |

---

## Etapa 0: Fundaciones y marca

**Objetivo:** un proyecto vacío pero desplegado, con la identidad de ONE ya en el código.

- [x] `git init` (repositorio local)
- [x] Repositorio en GitHub: `feliperetamalj/One-Evolution-CX` (público, sin secretos; `.env*` queda fuera)
- [x] Proyecto Next.js 16 + Tailwind v4 + shadcn/ui (estilo base `power` de design-styles)
- [x] Proyecto Supabase en la organización de ONE (quedó en us-west-2; Vercel en `pdx1` para estar junto a la base). Hoy tiene datos ficticios: limpiar antes del piloto
- [x] Proyecto Vercel `one-cx` (región `pdx1`), desplegado en https://one-cx.vercel.app por CLI
- [x] Variables de entorno de producción cargadas en Vercel
- [x] Vercel conectado al repo de GitHub: cada push a `main` publica en producción
- [ ] Cuenta Resend y dominio verificado (SPF/DKIM en el DNS de `oneevolution.cl`)
- [x] Tokens de marca en `app/globals.css` (contraste WCAG AA verificado):
  - Fondo `#0B0B0B` · superficie `#141414` · texto hueso `#EDEDE8` · gris `#9A9A9A` · acento arena `#C8A97E` (el de la app)
  - Tipografías: Oswald (titulares) e Inter (texto)
  - Logo en SVG redibujado desde el brochure (`components/logo.tsx`), a reemplazar por el vector oficial

**Listo cuando:** existe una URL de preview con una página en la tipografía y los colores de ONE.

---

## Etapa 1: Base de datos, seguridad y KPIs

**Objetivo:** el modelo del ADR en migraciones SQL, con los KPIs calculados por la base de datos.

- [x] Migración con `clients`, `waves`, `invitations`, `responses`, `csat_scores` y `admins`, más restricciones `CHECK`
- [x] RLS en todas las tablas y permisos revocados a `anon`/`authenticated`: todo pasa por el servidor con la secret key
- [x] Vistas `wave_plan_stats` y `csat_stats` (conteos por ola y plan); los indicadores se calculan en `lib/survey.ts`
- [x] Funciones `open_wave()` y `save_response()` (valida que la ola siga abierta)
- [x] Seed con 40 clientes ficticios y 4 olas (caída de "Baños" en la ola 3)
- [x] Test (`npm test`): corre la migración real en Postgres embebido (PGlite) y verifica NPS, CSAT, rechazos y el importador CSV
- [x] Migraciones y seed aplicados en Supabase con la CLI; advisors de seguridad sin observaciones
- [x] Verificado contra Supabase: la key publicable recibe "permission denied" en tablas, vistas y funciones

**Listo cuando:** `supabase db reset` levanta todo desde cero y el test pasa.

---

## Etapa 2: Encuesta del cliente (`/s/[token]`)

**Objetivo:** que responder tome menos de 60 segundos en un iPhone y se sienta como ONE.

**Flujo (3 pantallas + agradecimiento):**

1. **NPS:** "Del 0 al 10, ¿qué tan probable es que recomiendes ONE a un amigo o familiar?"
   Botones coloreados por segmento (0–6 rojo, 7–8 verde claro, 9–10 verde fuerte). Tocar solo selecciona; "Continuar"
   guarda la nota y avanza. El NPS queda guardado aunque el cliente abandone la encuesta.
2. **CSAT:** "¿Qué tan satisfecho/a estás con…?" y una descripción breve de qué se evalúa. Ocho filas compactas con
   escala de 1 a 5, con "Muy insatisfecho" bajo el 1 y "Muy satisfecho" bajo el 5; cualquier fila se puede dejar en blanco (= no aplica).
   Cada fila es 1 pregunta de una de las 8 categorías, sacada del banco de preguntas (ver Etapa 4b):

   | Clave | Categoría |
   |---|---|
   | `equipamiento` | Equipamiento |
   | `limpieza` | Limpieza |
   | `banos` | Baños y camarines |
   | `ambiente` | Ambiente |
   | `coach` | Coach |
   | `entrenamiento` | Entrenamiento |
   | `agenda` | Agenda y horarios |
   | `atencion` | Atención |

3. **Comentario:** la pregunta cambia según la nota NPS que dio el cliente:

   | Nota NPS | Pregunta del comentario |
   |---|---|
   | 9–10 | "¿Qué es lo que más valoras de ONE?" |
   | 7–8 | "¿Qué nos faltó para que fuera un 10?" |
   | 0–6 | "¿Qué deberíamos mejorar primero?" |

   Debajo va la casilla *"Pueden contactarme sobre mis respuestas"* y el aviso de privacidad.
4. **Gracias:** mensaje personalizado con el nombre y un "nos vemos en tu próxima sesión".

**Casos borde:**
- Token inválido → mensaje amable.
- Ola cerrada → "Esta encuesta ya cerró; te llegará la próxima en 2 semanas".
- Encuesta ya respondida → se puede editar hasta que cierre la ola.

**Estado:** construida (`app/s/[token]`). Verificado en navegador móvil: NPS en 2 filas, se avanza con "Continuar",
tocar de nuevo quita una nota CSAT. Probada de punta a punta con la base real:
guardado, agradecimiento, edición, ola cerrada y link inválido.

**Listo cuando:**
- Se completa en menos de 60 segundos en un móvil.
- Las zonas táctiles miden al menos 44 px.
- Funciona con VoiceOver.
- Lighthouse Accesibilidad ≥ 95.
- Respeta `prefers-reduced-motion`.

---

## Etapa 3: Olas automáticas y envíos

**Objetivo:** cero trabajo manual cada 14 días.

**Estado:** construida (`app/api/cron`, `lib/invites.ts`, `/admin/clientes`). La primera ola se abre a mano;
el cron toma la posta. Falta: probar con la base real, configurar Resend + DNS y el respaldo semanal.

- [ ] Admin de clientes: importar CSV y activar/desactivar clientes (CRUD mínimo)
- [ ] Vercel Cron diario (~10:00 hora de Chile) que llama a `/api/cron`:
  - Si pasaron 14 días desde la última ola: crea la ola (abierta 7 días), genera los tokens y envía los emails.
  - Al día 3: envía un recordatorio a quienes no han respondido.
  - Siempre hace una consulta a la base de datos, para que Supabase Free no pause el proyecto.
- [ ] Email con la marca, en HTML simple:
  - Asunto: *"{Nombre}, ¿cómo estuvo tu experiencia en ONE estas 2 semanas?"*
  - Un solo botón y el texto "toma 1 minuto"
- [ ] Botón "Enviar por WhatsApp" por cliente en el admin: abre un link `wa.me` con el mensaje y el link personal ya escritos
- [ ] **Alerta al CEO:** si llega un detractor (0–6) que aceptó contacto, se envía un email inmediato con la nota y el comentario
- [ ] Respaldo: `supabase db dump` semanal al MacBook (launchd)

**Listo cuando:** una ola de prueba llega a 3 emails reales, las respuestas aparecen en la base de datos, el recordatorio solo sale a quienes no respondieron y un detractor genera la alerta.

---

## Etapa 4: Dashboard del CEO (`/admin`)

**Objetivo:** que el CEO responda en menos de 10 segundos *"¿cómo vamos frente a la ola anterior y qué empeoró?"*.

**Estado:** construida (`/admin`). Paleta de gráficos validada con la skill dataviz (par divergente azul↔rojo
con gris neutro; etiquetas en cada segmento porque el gris queda en 2,9:1). El gráfico de NPS es de una sola
serie: la media de 2 olas va en la tarjeta y el tooltip, porque como segunda línea no se distinguía.
Falta: verlo con el seed en la base real.

- [ ] Login con magic link, restringido a quienes están en `admins`
- [ ] **Fila de KPIs** (cada uno con su Δ respecto de la ola anterior y el *n*): NPS, CSAT global, tasa de respuesta y detractores pendientes de seguimiento
- [ ] **Tendencia del NPS** por ola, con la media móvil de 2 olas
- [ ] **Composición por ola:** barras apiladas de promotores, pasivos y detractores
- [ ] **CSAT por atributo:** barras ordenadas de peor a mejor, con su Δ respecto de la ola anterior
- [ ] **Mapa de calor** atributo × ola, para ver deterioros lentos
- [ ] **Comentarios:** filtros por ola, segmento NPS, plan y texto; botón "Marcar como contactado" (`followed_up_at`)
- [ ] Filtro global por plan (Personal / Duo / 3 / 4 / 6)
- [ ] Usable en el móvil del CEO

**Listo cuando:** con el seed de la Etapa 1, el CEO (o tú en su lugar) identifica el atributo que más cayó y el detractor pendiente sin ayuda.

---

## Etapa 4b: Admin v2

- [x] Menú lateral con íconos (Dashboard, Clientes y olas, Banco de preguntas, Configuración); en el móvil, barra inferior
- [x] **Banco de preguntas** (`/admin/preguntas`): 8 categorías con 5 a 7 preguntas cada una (48 iniciales). El admin añade y
  quita preguntas; cada encuesta hace 1 pregunta por categoría, al azar y sin repetirle al cliente la de la vez anterior.
  Muestra el % de satisfechos de cada pregunta.
- [ ] **Configuración:** dar y quitar acceso al panel, cambiar la contraseña y elegir quién recibe las alertas de detractores
- [ ] **Filtros del dashboard:** una ola, varias olas, 1 mes, 3 meses, 6 meses, 1 año y total

---

## Etapa 5: Piloto y lanzamiento

1. **Ola 0, interna:** coaches y CEO responden. Se ajustan los textos, los tiempos y los emails.
2. **Ola 1, piloto:** 15–20 clientes de distintos planes. Se mide la tasa de respuesta y el tiempo mediano de respuesta.
3. **Ola 2, todos los clientes activos:** las 2 primeras olas completas son la **línea base**. Las metas de NPS y CSAT se fijan después, no antes.
4. Aviso de privacidad revisado frente a la Ley 21.719 (se puede usar `/compliance-cl`) y una política de retención de datos.
5. Se pasa Vercel a Pro.

**Metas iniciales del sistema:**
- Tasa de respuesta ≥ 40 %.
- Tiempo mediano de respuesta < 90 s.
- 100 % de los detractores que aceptaron contacto reciben una llamada en menos de 48 h.

---

## Etapa 6: Mejoras v2 (solo si los datos lo justifican)

| Mejora | Cuándo hacerla |
|---|---|
| Análisis de drivers: qué atributo CSAT se correlaciona más con el NPS | Con ≥ 6 olas de datos |
| Segmentar por coach | Cuando el padrón tenga el coach asignado; es un tema sensible, hay que acordarlo con el equipo |
| WhatsApp Cloud API con plantilla aprobada | Si la tasa de respuesta por email baja del 30 % |
| Integración con la app de ONE (padrón automático o encuesta después de una clase) | Cuando sepamos qué expone su backend |
| Alternar cohortes (cada cliente responde 1 vez al mes) | Si hay fatiga: tasa de respuesta a la baja por 2 olas seguidas |
