import {
  Controller,
  Post,
  Body,
  Param,
  Res,
  Req,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { ThreadsService } from "../threads/threads.service";
import { StreamService } from "./stream.service";
import { EventBusService } from "./event-bus.service";
import { CommandDto } from "./dto/command.dto";
import { SubscribeDto } from "./dto/subscribe.dto";

@Controller("threads")
export class StreamController {
  private readonly logger = new Logger(StreamController.name);

  constructor(
    private readonly threadsService: ThreadsService,
    private readonly streamService: StreamService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * POST /threads/:threadId/commands
   *
   * Handles LangGraph v2 command protocol. Supports run.start to kick off
   * an agent run. Returns immediately; client subscribes to /stream for events.
   */
  @Post(":threadId/commands")
  async command(
    @Param("threadId") threadId: string,
    @Body() dto: CommandDto,
  ) {
    if (!(await this.threadsService.exists(threadId))) {
      throw new NotFoundException("Thread not found");
    }

    if (dto.method === "run.start") {
      const messages = dto.params?.input?.messages ?? [];
      if (!messages.length) {
        throw new BadRequestException("No messages provided");
      }

      const runId = uuidv4();

      // Store incoming user messages
      for (const msg of messages) {
        if (msg.role === "user") {
          await this.threadsService.appendMessage(threadId, msg);
        }
      }

      // Fire and forget — SSE stream carries progress
      this.streamService.executeRun(threadId, runId, messages);

      return { type: "success", id: dto.id, result: { run_id: runId } };
    }

    return {
      type: "error",
      id: dto.id,
      error: "unsupported_method",
      message: `Method "${dto.method}" is not supported`,
    };
  }

  /**
   * POST /threads/:threadId/stream
   *
   * SSE subscription endpoint compatible with @langchain/vue useStream.
   * Client sends { channels, namespaces?, since? } and receives a stream
   * of LangGraph v2 protocol events until the run completes.
   */
  @Post(":threadId/stream")
  async subscribe(
    @Param("threadId") threadId: string,
    @Body() _dto: SubscribeDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!(await this.threadsService.exists(threadId))) {
      res.status(404).json({ error: "Thread not found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const subject = this.eventBus.getSubject(threadId);

    const subscription = subject.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      complete: () => {
        res.write("data: [DONE]\n\n");
        res.end();
      },
      error: () => {
        res.end();
      },
    });

    req.on("close", () => {
      subscription.unsubscribe();
    });
  }
}
