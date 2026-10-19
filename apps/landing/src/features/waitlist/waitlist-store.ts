import { Pool } from "pg";

export interface WaitlistSignup {
  id: string;
  email: string;
  source: string;
}

export interface WaitlistStore {
  /** Stores the email once; adding it again is not an error (L-2). */
  add(signup: WaitlistSignup): Promise<void>;
}

export class WaitlistUnavailableError extends Error {
  override readonly name = "WaitlistUnavailableError";
}

/** The landing site deploys on its own, so it creates its one table itself, idempotently. */
const createTableSql = `CREATE TABLE IF NOT EXISTS waitlist_signups (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'landing',
  created_at timestamptz NOT NULL DEFAULT now()
)`;

export class PostgresWaitlistStore implements WaitlistStore {
  private readonly pool: Pool;
  private tableReady: Promise<unknown> | undefined;

  constructor(options: { connectionString: string }) {
    this.pool = new Pool({ connectionString: options.connectionString, max: 3 });
  }

  async add(signup: WaitlistSignup): Promise<void> {
    this.tableReady ??= this.pool.query(createTableSql).catch((error: unknown) => {
      this.tableReady = undefined;
      throw error;
    });
    await this.tableReady;
    await this.pool.query(
      "INSERT INTO waitlist_signups (id, email, source) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
      [signup.id, signup.email, signup.source],
    );
  }
}
