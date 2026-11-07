// Corre la migración real en un Postgres embebido (PGlite) y verifica guardado + indicadores.
// npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { parseClients, summarize, type CsatStat, type WavePlanStat } from "../lib/survey.ts";

const dir = new URL("./migrations/", import.meta.url);
const migrations = readdirSync(dir).sort().map((f) => readFileSync(new URL(f, dir), "utf8"));

test("migración, respuestas e indicadores", async () => {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated; create role service_role;"); // roles de Supabase
  for (const m of migrations) await db.exec(m);

  await db.exec(`
    insert into clients (full_name, email, plan) values
      ('Ana', 'ana@x.cl', 'personal'), ('Beto', 'beto@x.cl', 'personal'),
      ('Caro', 'caro@x.cl', 'duo'), ('Dani', 'dani@x.cl', 'duo'), ('Eli', null, 'plan6');
    insert into clients (full_name, plan, active) values ('Inactivo', 'personal', false);
  `);

  const openWave = async () => (await db.query<{ w: number }>("select open_wave() as w")).rows[0].w;
  const wave1 = await openWave();
  const ids = async (wave: number) =>
    Object.fromEntries(
      (await db.query<{ full_name: string; id: string }>(
        "select c.full_name, i.id from invitations i join clients c on c.id = i.client_id where wave_id = $1",
        [wave],
      )).rows.map((r) => [r.full_name, r.id]),
    );
  const inv = await ids(wave1);
  assert.equal(Object.keys(inv).length, 5, "invita solo a clientes activos");

  const bank = (await db.query<{ category: string; n: number }>(
    "select category, count(*)::int as n from questions where active group by category",
  )).rows;
  assert.equal(bank.length, 8, "8 categorías con preguntas");
  assert.ok(bank.every((c) => c.n >= 5 && c.n <= 7), "5 a 7 preguntas por categoría");
  const asked = (await db.query<{ n: number; categories: number }>(
    "select count(*)::int as n, count(distinct category)::int as categories from invitation_questions where invitation_id = $1",
    [inv.Ana],
  )).rows[0];
  assert.deepEqual(asked, { n: 8, categories: 8 }, "1 pregunta por categoría");

  const save = (id: string, nps: number, csat: object = {}, comment: string | null = null, contact = false) =>
    db.query("select save_response($1, $2, $3, $4, $5)", [id, nps, JSON.stringify(csat), comment, contact]);

  await save(inv.Ana, 10, { equipamiento: 5, banos: 4 });
  await save(inv.Ana, 10, { equipamiento: 5, banos: 5 }); // editar reemplaza
  await save(inv.Beto, 9, { equipamiento: 3 });
  await save(inv.Caro, 7);
  await save(inv.Dani, 3, { banos: 1 }, "   ", true);

  const wave2 = await openWave();
  await save((await ids(wave2)).Ana, 0);
  const repeated = (await db.query<{ n: number }>(`
    select count(*)::int as n
    from invitation_questions a join invitations ia on ia.id = a.invitation_id
    join invitation_questions b on b.category = a.category and b.question_id = a.question_id
    join invitations ib on ib.id = b.invitation_id and ib.client_id = ia.client_id
    where ia.wave_id = $1 and ib.wave_id = $2`, [wave1, wave2])).rows[0].n;
  assert.equal(repeated, 0, "no repite la pregunta de la ola anterior");

  const stat = (await db.query<{ n: number; top2: number }>(`
    select s.n, s.top2 from question_stats s
    join invitation_questions iq on iq.question_id = s.question_id
    where iq.invitation_id = $1 and iq.category = 'banos'`, [inv.Ana])).rows[0];
  assert.ok(stat.n >= 1 && stat.top2 >= 1, "estadística por pregunta");

  const stats = async () => ({
    s: (await db.query<WavePlanStat>("select * from wave_plan_stats")).rows,
    c: (await db.query<CsatStat>("select * from csat_stats")).rows,
  });
  const { s, c } = await stats();

  const [w1, w2] = summarize(s, c);
  assert.deepEqual(
    { invited: w1.invited, responded: w1.responded, promoters: w1.promoters, passives: w1.passives, detractors: w1.detractors },
    { invited: 5, responded: 4, promoters: 2, passives: 1, detractors: 1 },
  );
  assert.equal(w1.nps, 25); // (2 − 1) / 4
  assert.equal(w1.responseRate, 80);
  assert.deepEqual(w1.items.equipamiento, { n: 2, top2: 50, avg: 4 });
  assert.deepEqual(w1.items.banos, { n: 2, top2: 50, avg: 3 });
  assert.equal(w1.csat, 50);
  assert.equal(w2.nps, -100);
  assert.equal(w2.npsRolling, 0); // (2 + 0 − 1 − 1) / (4 + 1)
  assert.equal(summarize(s, c, "duo")[0].nps, -50);

  const dani = (await db.query<{ comment: string | null }>("select comment from responses where nps = 3")).rows[0];
  assert.equal(dani.comment, null, "comentario vacío queda en null");

  await assert.rejects(save(inv.Ana, 10, { wifi: 5 }), "categoría desconocida");
  await assert.rejects(save(inv.Ana, 10, { equipamiento: 6 }), "nota CSAT fuera de rango");
  await assert.rejects(save(inv.Ana, 11), "NPS fuera de rango");

  await db.query("update waves set opens_at = now() - interval '8 days', closes_at = now() - interval '1 day' where id = $1", [wave1]);
  await assert.rejects(save(inv.Beto, 10), /invitation_closed/);
  await assert.rejects(save("00000000-0000-0000-0000-000000000000", 10), /invitation_closed/);
});

test("importar clientes desde CSV de Excel", () => {
  const { rows, errors } = parseClients(
    "Nombre;Email;Teléfono;Plan\nCamila Rojas;Camila@Mail.CL;9 8765 4321;Plan 3\nTomás Díaz;;+56 9 1234 5678;Personal\n;x@y.cl;;\nAna;malo;;Duo\nBeto,beto@x.cl,87654321,pase diario",
  );
  assert.deepEqual(rows, [
    { full_name: "Camila Rojas", email: "camila@mail.cl", phone: "56987654321", plan: "plan3" },
    { full_name: "Tomás Díaz", email: null, phone: "56912345678", plan: "personal" },
    { full_name: "Beto", email: "beto@x.cl", phone: "56987654321", plan: "pase" },
  ]);
  assert.deepEqual(errors, ["Línea 4: falta el nombre", "Línea 5: email inválido (malo)"]);
});
