import pg from "pg";

const adds = [
  ["5b4ee97f-7ded-4877-8736-33506e174cd5", "jaamyy@gmail.com"],
  ["f5454f57-28ef-4362-84b8-208fd55588c8", "jaamyyy@gmail.com"],
  ["74a2b518-1018-4813-a2c7-5f0419319b30", "jamuha@gmail.com"],
  ["b94bb398-e1f1-4d30-a7e1-273ce8e260e0", "demo@admin.com"],
];

const client = new pg.Client({
  connectionString: `postgresql://postgres.zestppstpwjxriwcuykc:${encodeURIComponent("Cyber657886")}@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

for (const [userId, email] of adds) {
  await client.query(
    `insert into public.platform_admins (user_id, email)
     values ($1, $2)
     on conflict (user_id) do update set email = excluded.email`,
    [userId, email],
  );
  console.log(`Promoted: ${email}`);
}

const { rows } = await client.query(
  "select email from public.platform_admins order by email",
);
console.log("\nAll platform admins:", rows.map((r) => r.email).join(", "));

await client.end();
