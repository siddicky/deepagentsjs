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
    bodyParser: true,
  });

  app.enableCors({
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  const port = Number(process.env.PORT_SUPERVISOR ?? 3000);
  await app.listen(port);

  const logger = new Logger("Bootstrap");
  logger.log(`Supervisor service listening on http://localhost:${port}`);
  logger.log(
    `Researcher URL: ${process.env.RESEARCHER_URL ?? "http://localhost:2024"}`,
  );
  logger.log(
    `Vue SDK: useStream({ apiUrl: 'http://localhost:${port}', assistantId: 'supervisor' })`,
  );
}

bootstrap();
