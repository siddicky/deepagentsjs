import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("ok")
  check() {
    return { ok: true };
  }
}
