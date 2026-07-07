// Rebuilds a disposable Postgres database from schema.sql + supabase/migrations/*.sql
// (in filename order, which is chronological for this repo's date-prefixed migrations)
// plus supabase/testing/auth_shim.sql, so integration tests can exercise the real
// RPCs/RLS without a live Supabase project or the Supabase CLI.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const databaseUrl = process.env.TEST_DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/fitness_test";
const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");

async function run(client, label, sql) {
  process.stdout.write(`applying ${label}... `);
  await client.query(sql);
  console.log("ok");
}

async function recreateDatabase() {
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${databaseName}"`);
    await admin.query(`create database "${databaseName}"`);
  } finally {
    await admin.end();
  }
}

async function main() {
  await recreateDatabase();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await run(client, "supabase/testing/auth_shim.sql", readFileSync(path.join(rootDir, "supabase/testing/auth_shim.sql"), "utf8"));
    await run(client, "supabase/schema.sql", readFileSync(path.join(rootDir, "supabase/schema.sql"), "utf8"));

    const migrationsDir = path.join(rootDir, "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of migrationFiles) {
      await run(client, `supabase/migrations/${file}`, readFileSync(path.join(migrationsDir, file), "utf8"));
    }

    await run(
      client,
      "supabase/testing/post_migrations_grants.sql",
      readFileSync(path.join(rootDir, "supabase/testing/post_migrations_grants.sql"), "utf8")
    );
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
