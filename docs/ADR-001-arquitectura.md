# ADR-001: Arquitectura del sistema de Experiencia de Clientes (NPS + CSAT) de ONE

**Estado:** Propuesta
**Fecha:** 2026-11-07
**Decide:** Felipe Retamal (área CX) · CEO de ONE Evolution

---

## Contexto

**El negocio.** ONE es un gimnasio boutique en Alto Las Rastras, Talca. Su promesa (brochure 2026 y web):
"No somos un gimnasio, somos ONE": siempre hay un coach a tu lado, el equipamiento siempre está
disponible y el ambiente está hecho para que nada te distraiga. Es 100 % personalizado.
Planes: Personal, Duo, Plan 3, Plan 4, Plan 6 y Pase diario. Tiene 7 coaches y abre
L–V de 6:30 a 21:00. Ya tiene **app propia** (App Store / Google Play) con agendamiento, perfil y plan.

**El requisito.** Cada 14 días todos los clientes activos reciben una encuesta con:
1 pregunta NPS (0–10), 8 preguntas CSAT (1–5) sobre el gimnasio y una caja de comentarios.
El CEO revisa un dashboard con los KPIs y su tendencia respecto de las olas anteriores.

**Volumen.** Entre decenas y unos 200 clientes activos, es decir, menos de 200 respuestas por ola y
menos de 6.000 al año. **Como problema de datos es chico**: cualquier Postgres sobra. Lo que de
verdad importa es:

1. Que el link de la encuesta **funcione siempre** (un link caído = respuesta perdida y mala
   impresión en una marca premium).
2. Tasa de respuesta alta, lo que exige una encuesta móvil de menos de 60–90 segundos.
3. Una experiencia visual a la altura de la marca (negro, blanco hueso, Oswald/Inter).
4. Bajo costo y poca operación: lo construye y mantiene una sola persona.
5. Datos personales de clientes: hoy rige la Ley 19.628 y la **Ley 21.719 entra en vigor el 1-dic-2026**.

---

## Decisión

**Opción A: Next.js en Vercel + Supabase (Postgres + Auth) + Resend (email).**
El MacBook Pro se usa como **entorno de desarrollo y destino del respaldo semanal**, no como servidor.

```
 Cliente (móvil)                                  CEO (desktop / móvil)
     │ link personal  /s/<token>                        │ login por magic link
     ▼                                                  ▼
┌──────────────────── Vercel · Next.js (región gru1, São Paulo) ────────────────────┐
│  /s/[token]   encuesta (3 pasos, guarda parcial)                                  │
│  /admin       dashboard · clientes · comentarios y seguimiento                    │
│  /api/cron    cron diario: abre ola cada 14 días · recordatorio · alerta CEO      │
└───────────────┬──────────────────────────────────────────────┬────────────────────┘
                │ SQL (service role, solo en el servidor)       │ email transaccional
                ▼                                               ▼
     Supabase Postgres (sa-east-1)                       Resend → clientes / alertas CEO
     tablas + RLS (anon = sin acceso) + vistas KPI
                ▲
                │ supabase db dump (semanal, launchd)
           MacBook Pro (dev + respaldo)
```

---

## Opciones consideradas

### Opción A: Vercel + Supabase + Resend ✅ recomendada

| Dimensión | Evaluación |
|---|---|
| Complejidad | Baja: un solo proyecto Next.js y SQL plano en migraciones |
| Costo | ~US$20/mes (Vercel Pro) + Supabase Free + Resend Free |
| Disponibilidad | Alta: infraestructura gestionada y HTTPS automático |
| Escalabilidad | Holgada: el plan gratuito aguanta 100× el volumen real |
| Familiaridad | Alta: es el stack que propusiste y el más documentado |

**Pros:** el link de la encuesta nunca depende de tu computador. Auth, RLS y backups lógicos vienen
incluidos. Hay deploys con preview por rama, un dominio propio (`encuesta.oneevolution.cl`) en
minutos y cron nativo de Vercel.

**Contras y mitigaciones:**
- **El plan Hobby de Vercel es solo para uso personal no comercial.** Para producción en un negocio
  corresponde Vercel Pro (US$20/mes). Se puede desarrollar en Hobby y pasar a Pro al lanzar.
- **Supabase Free pausa el proyecto tras ~7 días sin actividad.** Con olas quincenales eso ocurriría.
  El cron diario toca la base de datos, así que nunca se pausa.
- **Supabase Free no trae backups descargables.** Se cubre con un `supabase db dump` semanal al Mac
  (launchd). Si se quiere delegar, Supabase Pro cuesta US$25/mes.
- **Resend Free permite 100 emails/día y 3.000/mes.** Si hay más de 100 clientes, los envíos se
  reparten en 2 días o se usa Brevo Free (300/día).

### Opción B: MacBook Pro como servidor + playit.gg

| Dimensión | Evaluación |
|---|---|
| Complejidad | Media-alta: tú operas el SO, la base de datos, el túnel, HTTPS y los backups |
| Costo | ~US$0–4/mes (playit premium para dominio propio) + electricidad + **tu tiempo** |
| Disponibilidad | Baja: depende de que el Mac esté encendido, sin dormir, con internet y sin updates pendientes |
| Escalabilidad | Suficiente en carga, frágil en operación |
| Familiaridad | Media |

**Pros:** costo de hosting cero, control total y los datos quedan en tu equipo.

**Contras:** el Mac pasa a ser un punto único de falla (tapa cerrada, corte de luz o de internet,
reinicio por actualización = encuesta y dashboard caídos). Expone un computador personal a internet.
Los backups y la seguridad quedan a tu cargo. Además, playit.gg está pensado para servidores de
juegos: para HTTP, Cloudflare Tunnel es mejor (gratis, dominio propio y HTTPS).

**Veredicto:** muy buena opción para desarrollo y demos, mala para producción.

### Opción C: Google Forms + Sheets + Looker Studio

| Dimensión | Evaluación |
|---|---|
| Complejidad | Muy baja: 1–2 días |
| Costo | US$0 |
| Disponibilidad | Alta |
| Escalabilidad | Suficiente |
| Familiaridad | Alta |

**Pros:** rápido y gratis. Sirve para validar las preguntas con una ola de prueba.

**Contras:** se ve genérico, lo opuesto a "experiencia premium". No hay links personales sin
trucos, así que no se puede medir la tasa de respuesta, evitar duplicados ni hacer seguimiento
de detractores. Los envíos son manuales y el dashboard queda limitado.

> Las herramientas SaaS de encuestas (Typeform y similares) tienen problemas parecidos a los de C,
> con costo mensual y sin control del dashboard ni de los datos.

---

## Análisis de trade-offs

- **Disponibilidad vs. costo.** La diferencia entre A y B es de unos US$20/mes. A cambio, A elimina
  el único riesgo que importa: que un cliente abra el link y no cargue. Con planes de
  US$85.000–430.000 CLP/mes por cliente, una sola baja evitada paga años de hosting.
- **Control vs. operación.** B da control total, pero convierte al área de CX en un área de
  infraestructura. A deja el tiempo para lo que mueve el NPS: leer comentarios y cerrar el ciclo
  con los clientes.
- **Velocidad vs. experiencia.** C sale en un día pero contradice la marca. A tarda unas 2 semanas
  de trabajo, pero la encuesta misma pasa a ser un punto de contacto premium.

---

## Diseño técnico (resumen)

**Región (cambio en la implementación):** el proyecto de Supabase quedó creado en **us-west-2 (Oregón)**, no en
São Paulo. Las funciones de Vercel corren en `pdx1` (Portland), junto a la base, para que las consultas
no crucen el continente. La única latencia larga es usuario↔servidor (~0,6 s por página medida desde Chile).
Si se quiere bajar más, se puede recrear el proyecto en `sa-east-1` y pasar Vercel a `gru1`.

**Stack:** Next.js 16 (App Router, Server Actions) · Tailwind v4 + shadcn/ui · `motion` ·
shadcn Charts (Recharts) · Supabase Postgres + Auth · Resend · Vercel Cron.

**Modelo de datos** (el estado de cada ola se deriva de sus fechas, sin columnas de estado):

| Tabla | Columnas clave |
|---|---|
| `clients` | id, full_name, email, phone, plan, active |
| `waves` | id, opens_at, closes_at (una ola cada 14 días, abierta 7) |
| `invitations` | id (= **token** aleatorio de 122 bits), wave_id, client_id, plan (copia del plan al momento de invitar), sent_at, reminded_at · unique(wave_id, client_id) |
| `responses` | invitation_id (PK), nps 0–10, comment, contact_ok, followed_up_at, created_at |
| `csat_categories` | key, label, position: las 8 categorías CSAT, fijas |
| `questions` | id, category, text, active: el banco, de 5 a 7 preguntas activas por categoría |
| `invitation_questions` | invitation_id, category, question_id: la pregunta que le tocó a cada invitación en cada categoría |
| `csat_scores` | invitation_id, item (= categoría), score 1–5 · FK a la pregunta asignada. Sin fila = "no aplica" |
| `admins` | email (lista de quienes pueden ver el dashboard; se administra en Configuración) |
| `settings` | una sola fila: alert_emails (quién recibe la alerta de detractores) |

**Banco de preguntas.** Cada encuesta pregunta por las 8 categorías, 1 pregunta por categoría. La
pregunta se asigna al abrir la ola (`assign_questions`): al azar entre las activas, sin repetirle al
cliente la que tuvo en esa categoría la vez anterior. El azar por invitación (y no una pregunta fija por
ola) mezcla las preguntas en todas las olas, así que el CSAT de una categoría sigue siendo comparable
entre olas. Quitar una pregunta la archiva: sus respuestas pasadas siguen contando. El texto no se edita,
para no cambiarle el sentido a las respuestas que ya tiene.

**Vistas** (se calculan al vuelo, el volumen no justifica materializarlas): `wave_plan_stats`
(invitados, respuestas, promotores y detractores por ola y plan), `csat_stats` (ola × plan × categoría:
n, top-2-box, suma) y `question_stats` (n y top-2-box por pregunta). Los indicadores se calculan en
`lib/survey.ts`.

**Definiciones**
- **NPS** = % de notas 9–10 − % de notas 0–6 (rango −100 a +100).
- **CSAT de una categoría** = % de respuestas 4–5 (top-2-box). Se muestra también el promedio 1–5.
- **CSAT global** = promedio de los top-2-box de las 8 categorías.
- **Tasa de respuesta** = respuestas ÷ invitaciones de la ola.
- **Backlog de seguimiento** = detractores que aceptaron contacto y aún no tienen `followed_up_at`.

**Seguridad**
- RLS activo en todas las tablas y **ninguna política para `anon`**.
- La encuesta se lee y escribe solo desde Server Actions con la service role key, que nunca llega
  al navegador.
- El dashboard exige sesión de Supabase Auth y que el usuario esté en `admins`. Se verifica en **cada
  página y Server Action**, no en el layout: en el App Router layout y página se renderizan en paralelo
  y al navegar solo se pide la página.
- *Cambio en la implementación:* login con email + contraseña en vez de magic link, porque el SMTP por
  defecto de Supabase solo envía a miembros del equipo. El magic link se puede activar cuando Resend
  esté configurado como SMTP propio.
- Restricciones `CHECK` en la base de datos como última barrera de validación.
- El token da acceso solo a su propia invitación y caduca cuando cierra la ola.

**Privacidad (confidencial, no anónimo)**
- Cada respuesta queda ligada al cliente, lo que permite medir la tasa de respuesta, segmentar por
  plan y hacer seguimiento.
- El dashboard muestra el **nombre solo si el cliente marcó "pueden contactarme"**. Si no, la
  respuesta aparece como "Cliente confidencial".
- Los coaches nunca ven respuestas individuales.
- La encuesta incluye un aviso de finalidad y tratamiento de datos (Ley 21.719).

---

## Consecuencias

**Más fácil:** comparar olas, ver qué atributo empeoró y quién necesita una llamada. Iterar
preguntas y diseño con deploys de preview. Sumar después WhatsApp o la integración con la app.

**Más difícil:** hay 3 cuentas que administrar (Vercel, Supabase, Resend) y ~US$20/mes de costo fijo.

**A revisar más adelante:**
- **Fatiga de encuesta.** 26 encuestas al año por cliente es mucho. Si la tasa de respuesta cae
  bajo ~30 % por 2 olas seguidas, conviene alternar cohortes: cada cliente responde una vez al mes
  y el CEO igual recibe datos cada 14 días.
- **Muestras chicas.** Con ~80 respuestas, el NPS se mueve ±10–15 puntos solo por azar. El
  dashboard muestra siempre el *n* y una media móvil de 2 olas para no sobrerreaccionar.
- **Integración con la app de ONE.** Puede aportar el padrón, el coach y la asistencia, o lanzar
  la encuesta después de una clase.

---

## Decisiones pendientes (con valor por defecto)

| # | Decisión | Por defecto si no se define |
|---|---|---|
| 1 | ¿De dónde sale el padrón de clientes? (backend de la app, planilla, otro) | Importar un CSV desde el admin |
| 2 | Canal de envío | Email automático + botón "Enviar por WhatsApp" (link `wa.me` prellenado) para recordatorios |
| 3 | Acceso DNS de `oneevolution.cl` | Necesario para `encuesta.oneevolution.cl` y para enviar desde `@oneevolution.cl` |
| 4 | Plan de Vercel en producción | Pro (US$20/mes) |
| 5 | Pregunta 8 (coach) vs. solo infraestructura | Se incluye la del coach porque es la promesa central de ONE |

---

## Próximos pasos

Ver [ROADMAP.md](ROADMAP.md).
