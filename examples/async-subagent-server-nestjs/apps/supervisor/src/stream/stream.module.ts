import { Module } from "@nestjs/common";
import { StreamController } from "./stream.controller";
import { StreamService } from "./stream.service";
import { EventBusService } from "./event-bus.service";
import { ThreadsModule } from "../threads/threads.module";

@Module({
  imports: [ThreadsModule],
  controllers: [StreamController],
  providers: [StreamService, EventBusService],
})
export class StreamModule {}
