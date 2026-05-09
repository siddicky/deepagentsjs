import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService, Thread } from "../database/database.service";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class ThreadsService {
  constructor(private readonly db: DatabaseService) {}

  async createThread(): Promise<Thread> {
    const threadId = uuidv4();
    const { rows } = await this.db.query<Thread>(
      `INSERT INTO threads (thread_id) VALUES ($1)
       RETURNING thread_id, created_at, messages, output`,
      [threadId],
    );
    return rows[0];
  }

  async getThreadState(threadId: string) {
    const thread = await this.db.getThread(threadId);
    if (!thread) throw new NotFoundException("Thread not found");
    return {
      values: { messages: thread.messages },
      next: [],
      metadata: {},
    };
  }
}
