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
      const assembledChunks: string[] = [];

      for await (const event of stream) {
        if (event.event === "on_chat_model_stream") {
          const chunk = event.data?.chunk;
          const text =
            typeof chunk?.content === "string"
              ? chunk.content
              : chunk?.content?.[0]?.text ?? "";

          if (text) {
            assembledChunks.push(text);
            this.eventBus.emit(
              threadId,
              messagesEvent(
                [
                  {
                    type: "AIMessageChunk",
                    content: text,
                    id: event.run_id ?? runId,
                  },
                ],
                step,
              ),
            );
          }
        } else if (event.event === "on_chain_end" && event.name === "LangGraph") {
          // Final state
          const output = event.data?.output;
          if (output?.messages) {
            const msgs: { role: string; content: string }[] =
              output.messages.map((m: { _getType?: () => string; content: unknown }) => ({
                role: m._getType?.() === "human" ? "user" : "assistant",
                content:
                  typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content),
              }));

            this.eventBus.emit(
              threadId,
              valuesEvent({ messages: msgs }, ++step),
            );

            // Persist final messages to thread
            for (const msg of msgs) {
              this.threadsService.appendMessage(threadId, msg);
            }
          }
        }

        step++;
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
  return {
    method: "lifecycle",
    params: { data: { type, run_id: runId } },
  };
}

function messagesEvent(
  messages: { type: string; content: string; id: string }[],
  step: number,
): ProtocolEvent {
  return {
    method: "messages",
    params: { data: messages, step },
  };
}

function valuesEvent(values: unknown, step: number): ProtocolEvent {
  return {
    method: "values",
    params: { data: values, step },
  };
}

function errorEvent(message: string): ProtocolEvent {
  return {
    method: "error",
    params: { data: { message } },
  };
}
