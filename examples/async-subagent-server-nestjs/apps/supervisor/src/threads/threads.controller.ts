import { Controller, Post, Get, Param, Body } from "@nestjs/common";
import { ThreadsService } from "./threads.service";
import { CreateThreadDto } from "./dto/create-thread.dto";

@Controller("threads")
export class ThreadsController {
  constructor(private readonly threadsService: ThreadsService) {}

  @Post()
  create(@Body() dto?: CreateThreadDto) {
    return this.threadsService.createThread(dto?.metadata);
  }

  @Get(":threadId")
  findOne(@Param("threadId") threadId: string) {
    return this.threadsService.getThread(threadId);
  }
}
