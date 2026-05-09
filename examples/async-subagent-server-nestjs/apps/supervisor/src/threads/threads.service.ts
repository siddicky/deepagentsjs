import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService, SupervisorThreadRow } from "../database/database.service";
import { v4 as uuidv4 } from "uuid";

export interface SupervisorThread {
  thread_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  values: {
    messages: { role: string; content: string }[];
  };
}

function rowToThread(row: SupervisorThreadRow): SupervisorThread {
  return {
    thread_id: row.thread_id,
    created_at: row.created_at,
    metadata: row.metadata,
    values: { messages: row.messages },
  };
}

@Injectable()
export class ThreadsService {
  constructor(private readonly db: DatabaseService) {}

  async createThread(
    metadata: Record<string, unknown> = {},
  ): Promise<SupervisorThread> {
    const { rows } = await this.db.query<SupervisorThreadRow>(
      `INSERT INTO supervisor_threads (thread_id, metadata)
       VALUES ($1, $2)
       RETURNING thread_id, created_at, metadata, messages`,
      [uuidv4(), JSON.stringify(metadata)],
    );
    return rowToThread(rows[0]);
  }

  async getThread(threadId: string): Promise<SupervisorThread> {
    const row = await this.db.getThread(threadId);
    if (!row) throw new NotFoundException("Thread not found");
    return rowToThread(row);
  }

  async appendMessage(
    threadId: string,
    message: { role: string; content: string },
  ): Promise<void> {
    await this.db.query(
      `UPDATE supervisor_threads
          SET messages = messages || $1::jsonb
        WHERE thread_id = $2`,
      [JSON.stringify([message]), threadId],
    );
  }

  async getState(threadId: string) {
    const thread = await this.getThread(threadId);
    return {
      values: thread.values,
      checkpoint: null,
    };
  }

  async exists(threadId: string): Promise<boolean> {
    const { rows } = await this.db.query<{ exists: boolean }>(
      "SELECT EXISTS(SELECT 1 FROM supervisor_threads WHERE thread_id = $1) AS exists",
      [threadId],
    );
    return rows[0].exists;
  }
}
