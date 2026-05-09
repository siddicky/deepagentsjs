import { Controller, Get, Param } from "@nestjs/common";
import { ThreadsService } from "../threads/threads.service";

@Controller("threads")
export class StateController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Get(":threadId/state")
  getState(@Param("threadId") threadId: string) {
    return this.threadsService.getState(threadId);
  }
}
