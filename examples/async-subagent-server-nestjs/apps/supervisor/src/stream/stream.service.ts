import { Injectable, Logger } from "@nestjs/common";
import { AgentService } from "../agent/agent.service";
import { ThreadsService } from "../threads/threads.service";
import { EventBusService, ProtocolEvent } from "./event-bus.service";

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly threadsService: ThreadsService,
    private readonly eventBus: EventBusService,
  ) {}

  async executeRun(
    threadId: string,
    runId: string,
    messages: { role: string; content: string }[],
  ): Promise<void> {
    // Ensure there's a subject ready before we start emitting
    this.eventBus.getSubject(threadId);

    this.eventBus.emit(threadId, lifecycleEvent("run_started", runId));

    try {
      const stream = this.agentService.streamEvents(messages, threadId);

      let step = 0;

      for await (const event of stream) {
        if (event.event === "on_chat_model_stream") {
          const chunk = event.data?.chunk;
          const text =
            typeof chunk?.content === "string"
              ? chunk.content
              : chunk?.content?.[0]?.text ?? "";

          if (text) {
            this.eventBus.emit(
              threadId,
              messagesEvent(
                [{ type: "AIMessageChunk", content: text, id: event.run_id ?? runId }],
                step++,
              ),
            );
          }
        } else if (event.event === "on_chain_end" && event.name === "LangGraph") {
          const output = event.data?.output;
          if (output?.messages?.length) {
            // Only persist the last assistant message — user message was already
            // stored by the command handler; prior history is in MemorySaver.
            const last = output.messages[output.messages.length - 1];
            const content =
              typeof last.content === "string"
                ? last.content
                : JSON.stringify(last.content);
            const assistantMsg = { role: "assistant", content };

            this.eventBus.emit(
              threadId,
              valuesEvent({ messages: [assistantMsg] }, step++),
            );
            await this.threadsService.appendMessage(threadId, assistantMsg);
          }
        }
      }

      this.eventBus.emit(threadId, lifecycleEvent("run_completed", runId));
      this.eventBus.complete(threadId);
    } catch (e) {
      this.logger.error(`[run ${runId}] error: ${e}`);
      this.eventBus.emit(threadId, errorEvent(String(e)));
      this.eventBus.error(threadId, e);
    }
  }
}

function lifecycleEvent(type: string, runId: string): ProtocolEvent {
  return { method: "lifecycle", params: { data: { type, run_id: runId } } };
}

function messagesEvent(
  messages: { type: string; content: string; id: string }[],
  step: number,
): ProtocolEvent {
  return { method: "messages", params: { data: messages, step } };
}

function valuesEvent(values: unknown, step: number): ProtocolEvent {
  return { method: "values", params: { data: values, step } };
}

function errorEvent(message: string): ProtocolEvent {
  return { method: "error", params: { data: { message } } };
}
