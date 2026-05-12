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

export interface PlantAnalysis {
  summary: string;
  likelyIssue: string;
  confidence: number;
  actions: string[];
  warningFlags: string[];
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

  async analyzePlantImage(
    imageDataUrl: string,
    notes?: string
  ): Promise<PlantAnalysis> {
    try {
      const userText = notes?.trim()
        ? `Analyze this plant image. Additional context from user: ${notes.trim()}`
        : "Analyze this plant image.";

      const response = await this.client.post<FoundryResponse>(
        `/openai/deployments/${this.model}/chat/completions`,
        {
          messages: [
            {
              role: "system",
              content:
                "You are a careful plant assistant. Return only valid JSON with keys: summary (string), likelyIssue (string), confidence (number 0-1), actions (array of short strings), warningFlags (array of short strings). Do not include markdown.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: userText,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: imageDataUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 1000,
          response_format: {
            type: "json_object",
          },
        },
        {
          params: {
            "api-version": this.apiVersion,
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(content) as Partial<PlantAnalysis>;

      return {
        summary: typeof parsed.summary === "string" ? parsed.summary : "No summary provided.",
        likelyIssue:
          typeof parsed.likelyIssue === "string"
            ? parsed.likelyIssue
            : "Unknown",
        confidence:
          typeof parsed.confidence === "number"
            ? Math.min(1, Math.max(0, parsed.confidence))
            : 0.4,
        actions: Array.isArray(parsed.actions)
          ? parsed.actions.filter((item): item is string => typeof item === "string")
          : [],
        warningFlags: Array.isArray(parsed.warningFlags)
          ? parsed.warningFlags.filter((item): item is string => typeof item === "string")
          : [],
      };
    } catch (error) {
      console.error("Plant analysis error:", error);
      throw new Error(
        `Failed to analyze plant image: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}
