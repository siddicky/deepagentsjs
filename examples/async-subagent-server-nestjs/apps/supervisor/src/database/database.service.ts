import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import pkg from "pg";

const { Pool } = pkg;

export interface SupervisorThreadRow {
  thread_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  messages: { role: string; content: string }[];
}

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: InstanceType<typeof Pool>;

  async onModuleInit() {
    this.pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ??
        "postgres://postgres:postgres@localhost:5432/agentdb",
    });
    await this.initSchema();
    this.logger.log("Supervisor database initialized");
  }

  private async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS supervisor_threads (
        thread_id  TEXT        PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata   JSONB       NOT NULL DEFAULT '{}',
        messages   JSONB       NOT NULL DEFAULT '[]'
      );
    `);
  }

  async query<T extends pkg.QueryResultRow = pkg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pkg.QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async getThread(threadId: string): Promise<SupervisorThreadRow | null> {
    const { rows } = await this.pool.query<SupervisorThreadRow>(
      "SELECT thread_id, created_at, metadata, messages FROM supervisor_threads WHERE thread_id = $1",
      [threadId],
    );
    return rows[0] ?? null;
  }
}
