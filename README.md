# ONE · Experiencia de clientes

Encuesta quincenal (NPS + 8 CSAT + comentarios) y dashboard del CEO para ONE Evolution.

- Arquitectura: [docs/ADR-001-arquitectura.md](docs/ADR-001-arquitectura.md)
- Plan por etapas: [docs/ROADMAP.md](docs/ROADMAP.md)
- Resumen para presentaciones: [docs/RESUMEN-PRESENTACION.md](docs/RESUMEN-PRESENTACION.md)

```bash
npm install
npm run dev   # http://localhost:3000

npm test      # migración real en Postgres embebido + indicadores + importador CSV
```

## Variables de entorno

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Login del panel (Supabase Auth) |
| `SUPABASE_SECRET_KEY` | Acceso a datos desde el servidor (nunca al navegador) |
| `APP_URL` | Base de los links personales (`/s/<id>`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Envío de encuestas y alertas. Sin key, la app funciona y avisa en los logs |
| `CRON_SECRET` | Protege `/api/cron` (Vercel lo envía solo) |
| `EMAIL_DAILY_LIMIT` | Opcional, por defecto 100 (Resend Free) |

## Operación

- **Deploy:** cada push a `main` en GitHub publica en producción (https://one-cx.vercel.app) vía Vercel.
- **Base de datos:** `supabase/migrations/` (esquema) y `supabase/seed.sql` (datos ficticios, solo dev).
- **Accesos y alertas:** en `/admin/configuracion` se da o quita acceso al panel (crea la cuenta con una
  contraseña temporal), se cambia la contraseña y se elige quién recibe las alertas de detractores.
  El primer admin se crea a mano: Supabase → Authentication → Add user, y su email en la tabla `admins`.
- **Preguntas:** el banco se edita en `/admin/preguntas`; los cambios corren desde la próxima ola.
- **Comentarios y seguimiento:** en `/admin/comentarios` (análisis por tema y close the loop de detractores).
- **Olas:** la primera se abre desde `/admin/clientes`; luego el cron diario abre una cada 14 días,
  envía los emails pendientes y un recordatorio al día 3.
