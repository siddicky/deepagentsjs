# Async Subagent Server — NestJS

A NestJS monorepo re-implementation of the [async-subagent-server](../async-subagent-server) example, split into two independent microservices:

| Service | Port | Purpose |
|---------|------|---------|
| **Subagent** | 2024 | Agent Protocol server hosting the researcher DeepAgent (Postgres-backed) |
| **Supervisor** | 3000 | LangGraph v2 API server — connects to the subagent and exposes a Vue SDK-compatible SSE streaming interface |

## Architecture

```
Vue Frontend
  │  useStream({ apiUrl: "http://localhost:3000", assistantId: "supervisor" })
  │
  ▼
┌─────────────────────────────────────┐
│  Supervisor Service  (port 3000)    │
│  NestJS — LangGraph v2 protocol     │
│  POST /threads/:id/commands         │
│  POST /threads/:id/stream  (SSE)    │
│  GET  /threads/:id/state            │
└────────────────┬────────────────────┘
                 │ AsyncSubAgent → HTTP
                 ▼
┌─────────────────────────────────────┐
│  Subagent Service   (port 2024)     │
│  NestJS — Agent Protocol            │
│  POST /threads                      │
│  POST /threads/:id/runs             │
│  GET  /threads/:id/runs/:runId      │
│  GET  /threads/:id/state            │
│  POST /threads/:id/runs/:runId/cancel│
└────────────────┬────────────────────┘
                 │
                 ▼
    ┌──────────────────────────────┐
    │     PostgreSQL (agentdb)     │
    │  threads, runs               │  ← subagent
    │  supervisor_threads          │  ← supervisor
    └──────────────────────────────┘
```

## Prerequisites

- Node.js 22+
- pnpm
- PostgreSQL 16 (or Docker)
- `ANTHROPIC_API_KEY` (required)
- `TAVILY_API_KEY` (optional — stub search used if not set)

## Quick start (Docker Compose)

```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY

docker compose up --build
```

Services:
- Subagent: http://localhost:2024
- Supervisor: http://localhost:3000
- Postgres: localhost:5433

## Quick start (local)

```bash
# 1. Install dependencies (from this directory)
pnpm install

# 2. Copy and edit .env
cp .env.example .env

# 3. Start Postgres (or update DATABASE_URL to point at your instance)
docker run -d -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=agentdb \
  postgres:16-alpine

# 4. Start both services in separate terminals
pnpm dev:subagent     # http://localhost:2024
pnpm dev:supervisor   # http://localhost:3000
```

## API Reference

### Subagent Service — Agent Protocol (port 2024)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ok` | Health check |
| POST | `/threads` | Create a thread |
| GET | `/threads/:threadId/state` | Get thread output |
| POST | `/threads/:threadId/runs` | Start a background run |
| GET | `/threads/:threadId/runs/:runId` | Poll run status |
| POST | `/threads/:threadId/runs/:runId/cancel` | Cancel a run |

### Supervisor Service — LangGraph v2 Protocol (port 3000)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/threads` | Create a supervisor conversation thread |
| GET | `/threads/:threadId` | Get thread metadata |
| GET | `/threads/:threadId/state` | Get current thread state (messages) |
| POST | `/threads/:threadId/commands` | Send a command (`run.start`) |
| POST | `/threads/:threadId/stream` | Subscribe to SSE event stream |

## Vue Frontend Integration

```typescript
import { useStream } from "@langchain/vue";
import { ref } from "vue";

const threadId = ref<string | null>(null);

const stream = useStream({
  apiUrl: "http://localhost:3000",
  assistantId: "supervisor",
  threadId,
  onThreadId: (id) => { threadId.value = id; },
  messagesKey: "messages",
});

// Send a message
stream.submit({
  messages: [{ role: "user", content: "Research the latest AI developments" }]
});

// Reactive state
stream.messages;   // ShallowRef<BaseMessage[]>
stream.isLoading;  // ComputedRef<boolean>
stream.values;     // ShallowRef — full agent state
```

## SSE Event Format

The supervisor streams LangGraph v2 protocol events:

```
data: {"method":"lifecycle","params":{"data":{"type":"run_started","run_id":"..."}}}

data: {"method":"messages","params":{"data":[{"type":"AIMessageChunk","content":"...","id":"..."}],"step":1}}

data: {"method":"values","params":{"data":{"messages":[...]},"step":2}}

data: {"method":"lifecycle","params":{"data":{"type":"run_completed","run_id":"..."}}}

data: [DONE]
```

## Manual curl test

```bash
# 1. Create a supervisor thread
THREAD=$(curl -s -X POST http://localhost:3000/threads \
  -H "Content-Type: application/json" -d '{}' | jq -r .thread_id)
echo "Thread: $THREAD"

# 2. Open SSE stream (in a separate terminal)
curl -N -X POST http://localhost:3000/threads/$THREAD/stream \
  -H "Content-Type: application/json" \
  -d '{"channels":["messages","values","lifecycle"]}'

# 3. Send a command to start a run
curl -X POST http://localhost:3000/threads/$THREAD/commands \
  -H "Content-Type: application/json" \
  -d '{
    "method": "run.start",
    "id": "cmd-1",
    "params": {
      "input": {
        "messages": [{"role":"user","content":"research the latest developments in quantum computing"}]
      }
    }
  }'

# 4. Check subagent health
curl http://localhost:2024/ok
```

## Development runtime

`pnpm dev:*` runs both services through `ts-node --transpile-only`. NestJS
relies on `Reflect` decorator metadata for constructor-based DI, which
`tsx`/esbuild does not emit; `ts-node` honours `emitDecoratorMetadata: true`
from `tsconfig.json` and resolves dependencies correctly.

For production, run `pnpm build` and use the `start:*` scripts to launch
plain `node` against the compiled output in `dist/`.

## Swapping the agent

To use a different researcher agent, edit `apps/subagent/src/agent/agent.service.ts`.
The only requirement is that the agent accepts a `messages` array and returns one.

To change the supervisor's behaviour, edit the system prompt in
`apps/supervisor/src/agent/agent.service.ts`.
