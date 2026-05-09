import "reflect-metadata";
import { config } from "dotenv";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../../../.env") });

import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error"],
    // Disable body-size limit interference with SSE
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
    "Vue SDK: useStream({ apiUrl: 'http://localhost:" + port + "', assistantId: 'supervisor' })",
  );
}

bootstrap();
