import { Injectable, NotFoundException } from "@nestjs/common";
import { v4 as uuidv4 } from "uuid";

export interface SupervisorThread {
  thread_id: string;
  created_at: string;
  metadata: Record<string, unknown>;
  values: {
    messages: { role: string; content: string }[];
  };
}

@Injectable()
export class ThreadsService {
  private readonly threads = new Map<string, SupervisorThread>();

  createThread(metadata: Record<string, unknown> = {}): SupervisorThread {
    const thread: SupervisorThread = {
      thread_id: uuidv4(),
      created_at: new Date().toISOString(),
      metadata,
      values: { messages: [] },
    };
    this.threads.set(thread.thread_id, thread);
    return thread;
  }

  getThread(threadId: string): SupervisorThread {
    const thread = this.threads.get(threadId);
    if (!thread) throw new NotFoundException("Thread not found");
    return thread;
  }

  appendMessage(
    threadId: string,
    message: { role: string; content: string },
  ): void {
    const thread = this.threads.get(threadId);
    if (thread) thread.values.messages.push(message);
  }

  getState(threadId: string) {
    const thread = this.getThread(threadId);
    return {
      values: thread.values,
      checkpoint: null,
    };
  }

  exists(threadId: string): boolean {
    return this.threads.has(threadId);
  }
}
