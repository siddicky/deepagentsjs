import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import pkg from "pg";

const { Pool } = pkg;

export interface Thread {
  thread_id: string;
  created_at: string;
  messages: { role: string; content: string }[];
  output: string | null;
}

export interface Run {
  run_id: string;
  thread_id: string;
  assistant_id: string;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  created_at: string;
  error?: string;
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
    this.logger.log("Database initialized");
  }

  private async initSchema(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS threads (
        thread_id  TEXT        PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        messages   JSONB       NOT NULL DEFAULT '[]',
        output     TEXT
      );

      CREATE TABLE IF NOT EXISTS runs (
        run_id       TEXT        PRIMARY KEY,
        thread_id    TEXT        NOT NULL REFERENCES threads(thread_id),
        assistant_id TEXT        NOT NULL,
        status       TEXT        NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        error        TEXT
      );
    `);
  }

  async query<T extends pkg.QueryResultRow = pkg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<pkg.QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async getThread(threadId: string): Promise<Thread | null> {
    const { rows } = await this.pool.query<Thread>(
      "SELECT thread_id, created_at, messages, output FROM threads WHERE thread_id = $1",
      [threadId],
    );
    return rows[0] ?? null;
  }

  async getRun(runId: string): Promise<Run | null> {
    const { rows } = await this.pool.query<Run>(
      "SELECT run_id, thread_id, assistant_id, status, created_at, error FROM runs WHERE run_id = $1",
      [runId],
    );
    return rows[0] ?? null;
  }
}
