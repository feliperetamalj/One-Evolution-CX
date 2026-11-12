# ONE · Sistema de Experiencia de Clientes (NPS + CSAT)

Resumen del proyecto para armar una presentación. Cada sección `##` es una diapositiva sugerida:
arriba va el mensaje clave y abajo el contenido de apoyo. Al final hay ideas de capturas y una
lista de pendientes.

- **Producción:** https://one-cx.vercel.app (encuesta en `/s/<link personal>`, panel en `/admin`)
- **Estado:** sistema construido y publicado, cargado con **datos ficticios** de 12 olas para la demo.
  Falta configurar el envío de emails y hacer el piloto con clientes reales.
- **Fecha de este resumen:** noviembre de 2026

---

## 1. Portada

**ONE · Experiencia de clientes**
Escuchar a cada cliente cada 14 días y actuar sobre lo que dice.

---

## 2. El problema

> Hoy ONE no tiene una forma sistemática de saber cómo viven los clientes su experiencia, ni de
> enterarse a tiempo cuando alguien está insatisfecho.

- ONE es un gimnasio boutique (Alto Las Rastras, Talca), 100 % personalizado, con 7 coaches y planes
  Personal, Duo, Plan 3, Plan 4, Plan 6 y Pase diario.
- Su promesa: "No somos un gimnasio, somos ONE". Siempre hay un coach al lado, el equipamiento
  está disponible y el ambiente no distrae.
- Con planes de $85.000 a $430.000 CLP al mes, **cada cliente que se va sin avisar es caro**. Un
  cliente molesto que nadie llamó a tiempo es una baja que se pudo evitar.
- Lo que se necesitaba:
  1. Medir lealtad (NPS) y satisfacción por área (CSAT) en forma periódica y comparable.
  2. Ver tendencias: qué mejoró, qué empeoró y desde cuándo.
  3. Detectar a los clientes insatisfechos y **cerrar el ciclo** con ellos (llamarlos y resolver).

---

## 3. La solución en una frase

> Cada 14 días, cada cliente recibe una encuesta de 1 minuto en su celular. El CEO ve los
> resultados en un panel y el equipo hace seguimiento a cada cliente insatisfecho.

Tres piezas:

| Pieza | Para quién | Qué hace |
|---|---|---|
| **Encuesta móvil** | Clientes | 1 pregunta NPS, 8 de satisfacción y un comentario; menos de 60 s |
| **Panel (dashboard)** | CEO y equipo | KPIs, tendencias por ola, comentarios, seguimiento |
| **Automatización** | Nadie (corre sola) | Abre una ola cada 14 días, envía emails y recordatorios, avisa de detractores |

---

## 4. Cómo funciona una "ola"

> Una ola = una ronda de encuestas. Se abre sola cada 14 días y queda abierta 7.

1. **Día 0:** se abre la ola y cada cliente activo recibe un email con su **link personal**.
2. **Día 3:** se envía un recordatorio solo a quienes no han respondido. También se les puede
   escribir por WhatsApp desde el panel, con el mensaje y el link ya escritos.
3. **Día 7:** la ola cierra.
4. **Día 14:** se abre la siguiente.

Al ser links personales (no un formulario anónimo) se puede medir la tasa de respuesta, evitar
respuestas duplicadas y hacer seguimiento a cada caso. Las respuestas son **confidenciales, no
anónimas**: el nombre solo se ve si el cliente marcó "pueden contactarme".

---

## 5. La encuesta del cliente

> Diseñada para responderse en menos de 1 minuto en el celular, con la estética de ONE.

**Paso 1 · NPS:** "Del 0 al 10, ¿qué tan probable es que recomiendes ONE a un amigo o familiar?"
- Botones de color por segmento: 0–6 rojo, 7–8 verde claro y 9–10 verde fuerte.
- La nota queda guardada aunque el cliente abandone la encuesta después.

**Paso 2 · Satisfacción (CSAT):** "¿Qué tan satisfecho/a estás con…?", 8 preguntas de 1 a 5, una por
categoría:

| Equipamiento | Limpieza | Baños y camarines | Ambiente |
|---|---|---|---|
| **Coach** | **Entrenamiento** | **Agenda y horarios** | **Atención** |

Cualquier pregunta se puede dejar en blanco si no aplica.

**Paso 3 · Comentario:** la pregunta cambia según la nota NPS que dio:
- Promotor (9–10): "¿Qué es lo que más valoras de ONE?"
- Pasivo (7–8): "¿Qué nos faltó para que fuera un 10?"
- Detractor (0–6): "¿Qué deberíamos mejorar primero?"

Debajo va la casilla "Pueden contactarme sobre mis respuestas" y el aviso de privacidad (Ley 21.719).

**Detalles de experiencia:** colores y tipografías de ONE (negro, blanco hueso, acento arena; Oswald
e Inter), botones grandes para el pulgar, se puede editar la respuesta mientras la ola siga abierta
y hay mensajes claros si el link no es válido o la ola ya cerró.

---

## 6. Banco de preguntas: sin repetir siempre lo mismo

> Para evitar que la encuesta se sienta repetitiva, cada categoría tiene un banco de 5 a 7
> preguntas y a cada cliente le toca una distinta.

- **8 categorías × 6 preguntas = 48 preguntas** iniciales.
- Cada encuesta pregunta **siempre por las 8 categorías**, con **1 pregunta por categoría**, elegida
  al azar y **sin repetirle al cliente la de la vez anterior**.
- Como las preguntas se mezclan en todas las olas, el resultado de cada categoría sigue siendo
  comparable entre olas.
- Desde el panel se agregan y quitan preguntas, con un mínimo de 5 y un máximo de 7 por categoría.
  Quitar una pregunta no borra sus respuestas, y se puede restaurar.
- Cada pregunta muestra su % de satisfechos, para detectar preguntas mal formuladas o temas débiles.
- Las categorías se ven plegadas, con su % de satisfechos, y se despliegan al tocarlas.

---

## 7. El panel del CEO: dashboard

> En menos de 10 segundos: ¿cómo vamos frente a la ola anterior y qué empeoró?

**Indicadores (con su cambio frente al período anterior):**
- **NPS** = % de promotores − % de detractores (de −100 a +100).
- **CSAT global** = % de clientes satisfechos (notas 4–5), promedio de las 8 categorías.
- **Tasa de respuesta** = respuestas ÷ invitaciones. Al tocarla se abre su detalle.
- **Por contactar** = detractores que aceptaron contacto y aún no han sido llamados.

**Gráficos:**
- **NPS por ola:** tendencia con media móvil de 2 olas, para no sobrerreaccionar a muestras chicas.
- **Promotores, pasivos y detractores:** composición de cada ola.
- **CSAT por ola:** una línea por categoría. Se ven todas juntas o se filtra por las que interesen.
- **CSAT por categoría:** de peor a mejor, con su cambio.
- **Mapa de calor categoría × ola:** azul sobre la meta (80 %) y rojo bajo la meta, para ver
  deterioros lentos.
- **Resumen de comentarios:** temas que más mencionan los detractores y últimos comentarios.

**Filtros:** una ola, varias olas (desde–hasta), 1 mes, 3 meses, 6 meses, 1 año o total, y por plan.
Al juntar olas se suman las respuestas, no se promedian porcentajes.

---

## 8. Tasa de respuesta: quién falta

> Al tocar "Tasa de respuesta" se ve la tasa de cada ola y la lista de quienes no respondieron.

- Gráfico de la tasa por ola, con la **meta de 40 %** marcada.
- Para la ola elegida: cuántos respondieron, cuántos faltan y si la ola sigue abierta.
- **Lista de quienes no respondieron**, con su plan y el estado del email (enviado, recordado, sin email).
- Si la ola sigue abierta, hay un botón **"Recordar por WhatsApp"** con el link personal del cliente.
- Filtros por ola y por plan.

---

## 9. Comentarios: qué dicen los clientes

> Una sección dedicada a leer y analizar los comentarios, más allá del resumen del dashboard.

- **Filtros:** período, plan, segmento (detractores, pasivos o promotores), tema y búsqueda por texto.
- **Temas automáticos:** cada comentario se asocia a las 8 categorías por palabras clave ("ducha",
  "camarín" → Baños; "calor", "música" → Ambiente…).
- **Temas por segmento:** cuántos detractores, pasivos y promotores mencionan cada tema, junto al %
  de satisfechos de esa categoría. Así se cruza lo que dicen con cómo calificaron.
- En cada comentario se ven sus temas y, en rojo, las categorías que ese cliente calificó con 1 o 2.

*Ejemplo con los datos de demo:* los detractores hablan de Baños y Limpieza, y los promotores
destacan Coach y Entrenamiento.

---

## 10. Close the loop: ningún detractor sin respuesta

> Cada cliente insatisfecho que acepta ser contactado se convierte en un caso que se sigue hasta cerrarlo.

- **Entran solos** los detractores (0–6) que aceptaron contacto. El equipo también puede sumar a un
  pasivo o promotor con un problema puntual.
- **Tres estados:** Por contactar → En seguimiento → Cerrado, con una **nota** por caso (qué se habló
  y qué se acordó).
- **Meta: contactar a cada uno en menos de 48 h.** Los casos que superan ese plazo se marcan como
  **atrasados**.
- **Indicadores del seguimiento:** casos por contactar y atrasados, % contactados en menos de 48 h y
  tiempo mediano al primer contacto.
- **Alerta inmediata por email** cuando entra un detractor que aceptó contacto. Los destinatarios
  se eligen en Configuración. Empieza a funcionar cuando se activen los emails (ver Próximos pasos).

---

## 11. Administración

- **Clientes y olas:** importar el padrón desde Excel o Google Sheets (copiar y pegar), pausar o
  activar clientes, abrir la primera ola y ver quién falta en la ola actual.
- **Configuración:**
  - **Accesos:** dar o quitar acceso al panel. Se crea la cuenta con una contraseña temporal.
  - **Contraseña:** cada persona puede cambiar la suya.
  - **Alertas:** elegir quién recibe el aviso de detractores.
- **Panel usable en el celular:** menú lateral en computador y barra inferior en móvil.

---

## 12. Cómo está construido (para una audiencia técnica)

> Infraestructura gestionada: el link de la encuesta nunca depende de un computador personal.

| Capa | Herramienta | Por qué |
|---|---|---|
| Aplicación web | **Next.js 16** en **Vercel** | Rápida, sin servidores que mantener; cada cambio se publica solo |
| Base de datos y login | **Supabase** (Postgres + Auth) | Datos seguros y respaldos; el volumen real es chico |
| Emails | **Resend** | Envío de encuestas, recordatorios y alertas |
| Automatización | **Vercel Cron** (diario) | Abre olas, envía y recuerda sin intervención |
| Código | **GitHub** | Cada cambio queda registrado; publicar = hacer push |

**Alternativas evaluadas y descartadas:**
- **Un MacBook como servidor:** costo cero, pero si el equipo se apaga o se corta internet, la
  encuesta se cae.
- **Google Forms + Sheets:** gratis, pero genérico, sin links personales ni seguimiento de detractores.

**Seguridad y privacidad:**
- La base de datos no es accesible desde internet. Todo pasa por el servidor.
- Solo las cuentas autorizadas entran al panel.
- El nombre del cliente se ve solo si aceptó ser contactado.
- Los coaches no ven respuestas individuales.
- Hay un aviso de privacidad acorde a la Ley 21.719, que entra en vigor el 1 de diciembre de 2026.

---

## 13. Costos

| Concepto | Costo mensual |
|---|---|
| Vercel Pro (uso comercial) | ~US$20 |
| Supabase (plan gratuito, holgado para el volumen de ONE) | US$0 |
| Resend (plan gratuito: 100 emails/día) | US$0 |
| **Total** | **~US$20/mes** |

> Una sola baja evitada al año paga varios años del sistema.

---

## 14. Cómo trabajamos

- Proyecto en **etapas**, cada una publicada y verificada antes de pasar a la siguiente:
  0. fundaciones y marca;
  1. base de datos y seguridad;
  2. encuesta;
  3. olas y envíos automáticos;
  4. dashboard;
  5. piloto;
  6. mejoras.
- **Cada cambio se publica solo** en producción al subirlo a GitHub.
- **Pruebas automáticas** que validan los cálculos de NPS, CSAT, períodos, temas y casos sobre una
  base de datos real.
- Revisión visual en computador y celular de cada pantalla. En esa revisión se encontraron y
  corrigieron errores antes del piloto: botones que no guardaban, colores del mapa de calor y la
  página que se desbordaba en el celular.

---

## 15. Estado actual

**Listo y publicado:**
- Encuesta móvil completa, con banco de preguntas.
- Olas automáticas, recordatorios y alertas de detractores (el código está listo; falta activar los
  emails).
- Dashboard con KPIs, tendencias, filtros por período y plan, y CSAT por ola.
- Detalle de la tasa de respuesta, con quiénes no respondieron.
- Comentarios con análisis por tema y Close the loop.
- Administración de clientes, preguntas, accesos y alertas.

**Datos actuales:** 40 clientes ficticios y 12 olas de demo, que muestran por ejemplo una caída en
Baños en la ola 9.

---

## 16. Próximos pasos

**Antes del piloto:**
1. Configurar el envío de emails (Resend) y el dominio `oneevolution.cl`, con los registros DNS.
   Así las encuestas salen desde una dirección de ONE.
2. Borrar los datos ficticios y cargar el padrón real de clientes.
3. Activar un respaldo semanal de la base de datos.
4. Pasar Vercel al plan Pro (uso comercial).
5. Revisar el aviso de privacidad frente a la Ley 21.719.
6. Reemplazar el logo por el vector oficial.

**Piloto (≈ 4 semanas):**
- **Ola 0, interna:** responden los coaches y el CEO; se ajustan textos y tiempos.
- **Ola 1:** 15–20 clientes de distintos planes.
- **Ola 2:** todos los clientes activos.
- Las 2 primeras olas completas son la **línea base**: recién ahí se fijan metas de NPS y CSAT.

**Metas iniciales del sistema:**
- Tasa de respuesta ≥ 40 %.
- Tiempo mediano para responder < 90 segundos.
- 100 % de los detractores que aceptaron contacto llamados en menos de 48 h.

**Mejoras futuras (cuando haya datos):**

| Mejora | Cuándo |
|---|---|
| Qué categoría pesa más en el NPS (análisis de drivers) | Con 6 o más olas de datos |
| Resultados por coach | Hay que acordarlo con el equipo |
| Encuesta por WhatsApp automático | Si la tasa de respuesta por email baja del 30 % |
| Integración con la app de ONE (padrón automático, encuesta tras una clase) | Cuando se sepa qué expone su backend |
| Alternar grupos de clientes (cada uno responde 1 vez al mes) | Si hay señales de fatiga |

---

## Anexo A · Capturas sugeridas para la presentación

Todas en https://one-cx.vercel.app (el panel requiere iniciar sesión):

| Diapositiva | Captura |
|---|---|
| 5 | La encuesta en el celular: paso NPS con los botones de colores y paso CSAT |
| 7 | Dashboard completo en computador (filtro "6 meses") |
| 7 | Gráfico "CSAT por ola" con solo Baños y Ambiente, donde se ve la caída de la ola 9 |
| 7 | Mapa de calor, con la celda roja de Baños en la ola 9 |
| 8 | Tasa de respuesta: gráfico y lista de quienes no respondieron |
| 9 | Comentarios: temas por segmento |
| 10 | Close the loop: las 3 columnas y los indicadores de 48 h |
| 6 | Banco de preguntas: categorías plegadas y una desplegada |
| 11 | Dashboard en el celular, con la barra inferior |

## Anexo B · Glosario

| Término | Significado |
|---|---|
| **NPS** (Net Promoter Score) | ¿Nos recomendarías? De 0 a 10. NPS = % promotores (9–10) − % detractores (0–6) |
| **Promotor / Pasivo / Detractor** | Clientes con nota 9–10 / 7–8 / 0–6 |
| **CSAT** (Customer Satisfaction) | % de clientes satisfechos (notas 4 y 5 en escala de 1 a 5) |
| **Ola** | Una ronda de encuestas: se abre cada 14 días y dura 7 |
| **Tasa de respuesta** | Respuestas ÷ clientes invitados en la ola |
| **Close the loop** | Contactar al cliente insatisfecho, entender el problema, resolverlo y cerrar el caso |
| **Línea base** | Resultados de las primeras olas reales, contra los que se fijan las metas |
