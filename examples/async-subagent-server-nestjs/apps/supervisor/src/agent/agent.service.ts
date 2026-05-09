import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { createDeepAgent, type AsyncSubAgent } from "deepagents";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

const SYSTEM_PROMPT =
  "You are a research supervisor coordinating a background researcher agent.\n\n" +
  "For general questions, answer directly — do NOT launch a researcher.\n\n" +
  'Only launch the researcher when the user says "research", "investigate", "look into", or "find out".\n\n' +
  "START: When the user asks to research something:\n" +
  '  1. Call start_async_task with agentName "researcher" and the topic.\n' +
  "  2. Report the taskId and stop. Do NOT immediately check status.\n\n" +
  "CHECK: When the user asks for status or results:\n" +
  "  1. Call check_async_task with the exact taskId.\n" +
  "  2. Report what the tool returns. If still running, say so and stop.\n\n" +
  "UPDATE: When the user asks to change what the researcher is working on:\n" +
  "  1. Call update_async_task with the taskId and new instructions.\n" +
  "  2. Confirm the update.\n\n" +
  "CANCEL: When the user asks to cancel a task:\n" +
  "  1. Call cancel_async_task with the exact taskId.\n" +
  "  2. Confirm the cancellation.\n\n" +
  "LIST: When the user asks to list tasks or check all statuses:\n" +
  "  1. Call list_async_tasks.\n" +
  "  2. Present the live statuses.\n\n" +
  "Rules:\n" +
  "- Never report a stale status from memory. Always call a tool.\n" +
  "- Never poll in a loop. One tool call per user request.\n" +
  "- Always show the full taskId — never truncate it.";

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private agent: ReturnType<typeof createDeepAgent>;

  onModuleInit() {
    const researcherUrl =
      process.env.RESEARCHER_URL ?? "http://localhost:2024";

    const asyncSubAgents: AsyncSubAgent[] = [
      {
        name: "researcher",
        description:
          "A research agent that investigates any topic using web search. " +
          "Runs in the background and returns a detailed summary.",
        graphId: "researcher",
        url: researcherUrl,
      },
    ];

    this.agent = createDeepAgent({
      checkpointer: new MemorySaver(),
      systemPrompt: SYSTEM_PROMPT,
      subagents: asyncSubAgents,
    });

    this.logger.log(
      `Supervisor agent initialized (researcher at ${researcherUrl})`,
    );
  }

  async invoke(
    messages: { role: string; content: string }[],
    threadId: string,
  ): Promise<string> {
    const input = messages[messages.length - 1];
    const result = await this.agent.invoke(
      { messages: [new HumanMessage(input.content)] },
      { configurable: { thread_id: threadId } },
    );

    const last = result.messages[result.messages.length - 1];
    return typeof last.content === "string"
      ? last.content
      : JSON.stringify(last.content);
  }

  streamEvents(
    messages: { role: string; content: string }[],
    threadId: string,
  ) {
    const input = messages[messages.length - 1];
    return this.agent.streamEvents(
      { messages: [new HumanMessage(input.content)] },
      {
        version: "v2",
        configurable: { thread_id: threadId },
      },
    );
  }
}
