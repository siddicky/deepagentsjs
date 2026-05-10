import "reflect-metadata";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
  });

  app.enableCors();

  const port = Number(process.env.PORT_SUBAGENT ?? process.env.PORT ?? 2024);
  await app.listen(port);

  const logger = new Logger("Bootstrap");
  logger.log(`Agent Protocol server listening on http://localhost:${port}`);
  logger.log("Agents: researcher");
}

bootstrap();
