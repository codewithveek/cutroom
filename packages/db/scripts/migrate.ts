/** Applies pending migrations to DATABASE_URL. Usage: pnpm --filter @cutroom/db migrate */
import { loadEnv } from "@cutroom/config";
import { createDatabase, runMigrations } from "../src/database";

const env = loadEnv();
if (!env.DATABASE_URL) throw new Error("Set DATABASE_URL to migrate.");
const database = createDatabase({ connectionString: env.DATABASE_URL, maxConnections: 1 });
await runMigrations(database.db);
await database.close();
console.log("Migrations applied.");
