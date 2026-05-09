import { Controller, Post, Get, Body, Param } from "@nestjs/common";
import { RunsService } from "./runs.service";
import { CreateRunDto } from "./dto/create-run.dto";

@Controller("threads")
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

  @Post(":threadId/runs")
  create(@Param("threadId") threadId: string, @Body() dto: CreateRunDto) {
    return this.runsService.createRun(threadId, dto);
  }

  @Get(":threadId/runs/:runId")
  findOne(
    @Param("threadId") threadId: string,
    @Param("runId") runId: string,
  ) {
    return this.runsService.getRun(threadId, runId);
  }

  @Post(":threadId/runs/:runId/cancel")
  cancel(
    @Param("threadId") threadId: string,
    @Param("runId") runId: string,
  ) {
    return this.runsService.cancelRun(threadId, runId);
  }
}
