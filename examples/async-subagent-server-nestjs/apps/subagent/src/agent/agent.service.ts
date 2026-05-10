import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { createDeepAgent } from "deepagents";

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private agent: ReturnType<typeof createDeepAgent>;

  onModuleInit() {
    const webSearch = tool(
      async ({ query }: { query: string }) => {
        if (process.env.TAVILY_API_KEY) {
          const res = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: process.env.TAVILY_API_KEY,
              query,
              max_results: 5,
            }),
          });
          const data = (await res.json()) as {
            results?: { title: string; content: string; url: string }[];
          };
          if (!data.results?.length) return `No results for "${query}"`;
          return data.results
            .map(
              (r, i) =>
                `${i + 1}. **${r.title}**\n   ${r.content}\n   Source: ${r.url}`,
            )
            .join("\n\n");
        }

        return [
          `[stub] Search results for "${query}":`,
          `1. Key finding: Recent developments show significant progress in ${query}`,
          `2. Expert analysis: Industry leaders are investing heavily in ${query}`,
          `3. Market data: The ${query} sector has seen notable activity this quarter`,
        ].join("\n");
      },
      {
        name: "web_search",
        description:
          "Search the web for information. Use this to find current data, news, and analysis.",
        schema: z.object({
          query: z.string().describe("The search query"),
        }),
      },
    );

    this.agent = createDeepAgent({
      systemPrompt:
        "You are a thorough research agent. Investigate topics using web search and produce " +
        "a well-structured research summary (300–500 words). Cite sources where possible.\n\n" +
        "If you receive new instructions mid-conversation, follow them immediately without " +
        "asking for clarification — discard prior work and start fresh on the new task.",
      tools: [webSearch],
    });

    if (!process.env.TAVILY_API_KEY) {
      this.logger.warn(
        "TAVILY_API_KEY not set — using stub search. Set it for real web search.",
      );
    }

    this.logger.log("Researcher agent initialized");
  }

  getAgent() {
    return this.agent;
  }
}
