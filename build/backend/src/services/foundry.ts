import axios, { AxiosInstance } from "axios";
import { Readable } from "stream";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface FoundryResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
  };
}

export class FoundryService {
  private client: AxiosInstance;
  private endpoint: string;
  private apiKey: string;
  private model: string = "gpt-4.1-mini";
  private apiVersion: string = "2024-12-01-preview";

  constructor(endpoint: string, apiKey: string) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: endpoint,
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
    });
  }

  async chat(
    messages: ChatMessage[],
    systemPrompt?: string
  ): Promise<{ content: string; tokens: number }> {
    try {
      const allMessages: ChatMessage[] = [];

      if (systemPrompt) {
        allMessages.push({
          role: "user",
          content: systemPrompt,
        });
      }

      allMessages.push(...messages);

      const response = await this.client.post<FoundryResponse>(
        `/openai/deployments/${this.model}/chat/completions`,
        {
          messages: allMessages,
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          params: {
            "api-version": this.apiVersion,
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || "";
      const tokens = response.data.usage?.completion_tokens || 0;

      return { content, tokens };
    } catch (error) {
      console.error("Foundry API error:", error);
      throw new Error(
        `Failed to call Foundry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async *streamChat(
    messages: ChatMessage[],
    systemPrompt?: string
  ): AsyncGenerator<string> {
    try {
      const allMessages: ChatMessage[] = [];

      if (systemPrompt) {
        allMessages.push({
          role: "user",
          content: systemPrompt,
        });
      }

      allMessages.push(...messages);

      const response = await this.client.post(
        `/openai/deployments/${this.model}/chat/completions`,
        {
          messages: allMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2000,
        },
        {
          params: {
            "api-version": this.apiVersion,
          },
          responseType: "stream",
        }
      );

      console.log("Response data type:", typeof response.data);
      console.log("Response data constructor:", response.data?.constructor?.name);
      console.log("Has Symbol.asyncIterator:", Symbol.asyncIterator in Object(response.data));

      const stream = response.data;
      let buffer = "";

      // Check if already iterable
      if (stream[Symbol.asyncIterator]) {
        console.log("Stream is already async iterable");
        for await (const chunk of stream) {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          console.log("Chunk lines count:", lines.length);

          for (const line of lines) {
            if (
              line.trim().startsWith("data: ") &&
              !line.trim().endsWith("[DONE]")
            ) {
              try {
                const json = JSON.parse(line.substring(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  console.log("Yielding content:", content);
                  yield content;
                }
              } catch (e) {
                console.log("Failed to parse JSON:", line.substring(6), e);
              }
            }
          }
        }
      } else {
        console.log("Converting stream to async iterable");
        const readableStream = Readable.from(stream);
        for await (const chunk of readableStream) {
          buffer += chunk.toString();
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (
              line.trim().startsWith("data: ") &&
              !line.trim().endsWith("[DONE]")
            ) {
              try {
                const json = JSON.parse(line.substring(6));
                const content = json.choices?.[0]?.delta?.content;
                if (content) {
                  yield content;
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Foundry streaming error:", error);
      throw new Error(
        `Failed to stream from Foundry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
