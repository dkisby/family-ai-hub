import axios, { AxiosInstance } from "axios";
import { BACKEND_API_URL } from "../auth/authConfig";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: unknown;
}

export interface ChatRequest {
  messages: ChatMessage[];
  systemPrompt?: string;
}

export interface ChatResponse {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: BACKEND_API_URL,
      timeout: 30000,
    });
  }

  setAuthToken(token: string) {
    this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    const response = await this.client.post<ChatResponse>("/api/chat", request);
    return response.data;
  }

  async streamChatMessage(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await this.client.post("/api/chat/stream", request, {
      responseType: "stream",
    });

    return new Promise((resolve, reject) => {
      response.data.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        try {
          const json = JSON.parse(text);
          if (json.delta) {
            onChunk(json.delta);
          }
        } catch {
          // Some chunks might not be valid JSON, skip
        }
      });

      response.data.on("end", resolve);
      response.data.on("error", reject);
    });
  }

  async getHealth(): Promise<{ status: "ok" }> {
    const response = await this.client.get("/health");
    return response.data;
  }
}

export const apiClient = new APIClient();
