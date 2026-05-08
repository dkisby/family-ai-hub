export interface Tool {
  name: string;
  description: string;
  handler: (input: Record<string, unknown>) => Promise<unknown>;
}

export class ToolService {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  private registerBuiltInTools() {
    // Example tool: Calculator
    this.register({
      name: "calculate",
      description:
        "Perform basic mathematical calculations (add, subtract, multiply, divide)",
      handler: async (input: Record<string, unknown>) => {
        const { operation, a, b } = input as {
          operation: string;
          a: number;
          b: number;
        };

        const result = {
          add: (x: number, y: number) => x + y,
          subtract: (x: number, y: number) => x - y,
          multiply: (x: number, y: number) => x * y,
          divide: (x: number, y: number) => (y !== 0 ? x / y : null),
        }[operation]?.(a, b);

        return result;
      },
    });

    // Example tool: Get current time
    this.register({
      name: "get_time",
      description: "Get the current date and time",
      handler: async () => new Date().toISOString(),
    });

    // Example tool: Search (stub)
    this.register({
      name: "search",
      description: "Search for information on the internet",
      handler: async (input: Record<string, unknown>) => {
        const { query } = input as { query: string };
        return {
          query,
          results: [
            {
              title: "Search result 1",
              url: "https://example.com/1",
              snippet: "This is a search result snippet.",
            },
          ],
          note: "To enable real search, integrate with Bing Search API or similar",
        };
      },
    });
  }

  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool '${toolName}' not found`);
    }

    return tool.handler(input);
  }

  list(): Array<{
    name: string;
    description: string;
  }> {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
    }));
  }
}

export const toolService = new ToolService();
