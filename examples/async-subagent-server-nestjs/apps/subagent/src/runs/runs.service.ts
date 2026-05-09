import {
  Injectable,
  NotFoundException,
  Logger,
} from "@nestjs/common";
import { DatabaseService, Run } from "../database/database.service";
import { AgentService } from "../agent/agent.service";
import { CreateRunDto } from "./dto/create-run.dto";
import { HumanMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class RunsService {
  private readonly logger = new Logger(RunsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly agentService: AgentService,
  ) {}

  async createRun(threadId: string, dto: CreateRunDto): Promise<Run> {
    const thread = await this.db.getThread(threadId);
    if (!thread) throw new NotFoundException("Thread not found");

    if (dto.multitask_strategy === "interrupt") {
      await this.db.query(
        `UPDATE runs SET status = 'cancelled'
          WHERE thread_id = $1 AND status = 'running'`,
        [threadId],
      );
      await this.db.query(
        "UPDATE threads SET output = NULL WHERE thread_id = $1",
        [threadId],
      );
    }

    const userMessage =
      dto.input?.messages?.find((m) => m.role === "user")?.content ?? "";

    await this.db.query(
      `UPDATE threads
          SET messages = messages || $1::jsonb
        WHERE thread_id = $2`,
      [JSON.stringify([{ role: "user", content: userMessage }]), threadId],
    );

    const runId = uuidv4();
    const { rows } = await this.db.query<Run>(
      `INSERT INTO runs (run_id, thread_id, assistant_id)
       VALUES ($1, $2, $3)
       RETURNING run_id, thread_id, assistant_id, status, created_at, error`,
      [runId, threadId, dto.assistant_id ?? "researcher"],
    );
    const run = rows[0];

    // Fire and forget — client polls GET /threads/:threadId/runs/:runId
    void this.executeRun(run.run_id, threadId, userMessage).catch((err) =>
      this.logger.error(`[run ${run.run_id}] unhandled error: ${err}`),
    );

    return run;
  }

  async getRun(threadId: string, runId: string): Promise<Run> {
    const run = await this.db.getRun(runId);
    if (!run || run.thread_id !== threadId)
      throw new NotFoundException("Run not found");
    return run;
  }

  async cancelRun(threadId: string, runId: string): Promise<Run> {
    const run = await this.db.getRun(runId);
    if (!run || run.thread_id !== threadId)
      throw new NotFoundException("Run not found");
    await this.db.query(
      "UPDATE runs SET status = 'cancelled' WHERE run_id = $1",
      [runId],
    );
    return { ...run, status: "cancelled" };
  }

  private async executeRun(
    runId: string,
    threadId: string,
    input: string,
  ): Promise<void> {
    try {
      await this.db.query(
        "UPDATE runs SET status = 'running' WHERE run_id = $1",
        [runId],
      );
      const agent = this.agentService.getAgent();
      const result = await agent.invoke({
        messages: [new HumanMessage(input)],
      });

      const lastMessage = result.messages[result.messages.length - 1];
      const output =
        typeof lastMessage.content === "string"
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

      await this.db.query(
        `UPDATE threads
            SET output   = $1,
                messages = messages || $2::jsonb
          WHERE thread_id = $3`,
        [
          output,
          JSON.stringify([{ role: "assistant", content: output }]),
          threadId,
        ],
      );
      await this.db.query(
        "UPDATE runs SET status = 'success' WHERE run_id = $1",
        [runId],
      );
    } catch (e) {
      await this.db.query(
        "UPDATE runs SET status = 'error', error = $1 WHERE run_id = $2",
        [String(e), runId],
      );
      this.logger.error(`[run ${runId}] error: ${e}`);
    }
  }
}
