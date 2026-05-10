import { Module } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { AgentModule } from "./agent/agent.module";
import { ThreadsModule } from "./threads/threads.module";
import { RunsModule } from "./runs/runs.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [DatabaseModule, AgentModule, ThreadsModule, RunsModule],
  controllers: [HealthController],
})
export class AppModule {}
