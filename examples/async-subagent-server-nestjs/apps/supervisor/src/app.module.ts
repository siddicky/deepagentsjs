import { Module } from "@nestjs/common";
import { AgentModule } from "./agent/agent.module";
import { ThreadsModule } from "./threads/threads.module";
import { StreamModule } from "./stream/stream.module";
import { StateController } from "./state/state.controller";

@Module({
  imports: [AgentModule, ThreadsModule, StreamModule],
  controllers: [StateController],
})
export class AppModule {}
