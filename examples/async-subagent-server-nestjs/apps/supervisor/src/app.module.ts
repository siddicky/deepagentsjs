import { Module } from "@nestjs/common";
import { AgentModule } from "./agent/agent.module";
import { DatabaseModule } from "./database/database.module";
import { ThreadsModule } from "./threads/threads.module";
import { StreamModule } from "./stream/stream.module";
import { StateController } from "./state/state.controller";

@Module({
  imports: [DatabaseModule, AgentModule, ThreadsModule, StreamModule],
  controllers: [StateController],
})
export class AppModule {}
