import { Controller, Post, Get, Param } from "@nestjs/common";
import { ThreadsService } from "./threads.service";

@Controller("threads")
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post()
  create() {
    return this.threadsService.createThread();
  }

  @Get(":threadId/state")
  getState(@Param("threadId") threadId: string) {
    return this.threadsService.getThreadState(threadId);
  }
}
