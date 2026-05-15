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

export interface PlantAssistantResult {
  summary: string;
  likelyIssue: string;
  confidence: number;
  actions: string[];
  warningFlags: string[];
}

export interface MinecraftAssistantResult {
  answer: string;
  steps: string[];
  materials: string[];
  commands: string[];
  notes: string;
}

export type LocationCategory =
  | "shelter"
  | "bed"
  | "house"
  | "village"
  | "cave"
  | "poi"
  | "noi";

export type Dimension = "overworld" | "nether" | "end";

export interface MinecraftLocation {
  id: string;
  world_id: string;
  name: string | null;
  category: LocationCategory;
  x: number;
  y: number;
  z: number;
  dimension: Dimension;
  comment: string;
  created_at: string;
}

export interface NearestLocation extends MinecraftLocation {
  distance: number;
}

export interface ExploreSuggestion {
  direction: string;
  reason: string;
  suggestedX: number;
  suggestedZ: number;
}

export interface SaveLocationInput {
  world_id: string;
  name?: string;
  category: LocationCategory;
  x: number;
  y: number;
  z: number;
  dimension?: Dimension;
  comment: string;
}

export interface UpdateLocationInput {
  name?: string;
  comment?: string;
  category?: LocationCategory;
}

export interface CurrentUser {
  oid: string;
  email: string;
  name?: string;
  groups: string[];
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
    const token = this.client.defaults.headers.common["Authorization"];
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token && typeof token === "string") {
      headers["Authorization"] = token;
    }
    
    const response = await fetch(`${BACKEND_API_URL}/api/chat/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines[lines.length - 1];

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim();
          if (line) {
            try {
              const json = JSON.parse(line);
              if (json.delta) {
                onChunk(json.delta);
              }
            } catch {
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  async getHealth(): Promise<{ status: "ok" }> {
    const response = await this.client.get("/health");
    return response.data;
  }

  async getCurrentUser(): Promise<CurrentUser> {
    const response = await this.client.get<CurrentUser>("/api/me");
    return response.data;
  }

  async analyzePlantImage(
    imageDataUrl: string,
    notes?: string
  ): Promise<PlantAssistantResult> {
    const response = await this.client.post<{
      tool: string;
      result: PlantAssistantResult;
    }>("/api/tools/plant-assistant/analyze", {
      imageDataUrl,
      notes,
    });

    return response.data.result;
  }

  async askMinecraft(
    question: string,
    edition: "java" | "bedrock" | "auto-detect" = "auto-detect"
  ): Promise<MinecraftAssistantResult> {
    const response = await this.client.post<{
      tool: string;
      result: MinecraftAssistantResult;
    }>("/api/tools/minecraft-assistant/ask", {
      question,
      edition,
    });

    return response.data.result;
  }

  // ── Minecraft Locations ───────────────────────────────────────────────────

  async saveLocation(input: SaveLocationInput): Promise<MinecraftLocation> {
    const response = await this.client.post<MinecraftLocation>(
      "/api/tools/minecraft-locations",
      input
    );
    return response.data;
  }

  async listLocations(worldId: string): Promise<MinecraftLocation[]> {
    const response = await this.client.get<MinecraftLocation[]>(
      "/api/tools/minecraft-locations",
      { params: { world_id: worldId } }
    );
    return response.data;
  }

  async findNearest(
    worldId: string,
    x: number,
    z: number,
    shelterOnly = true
  ): Promise<NearestLocation> {
    const response = await this.client.get<NearestLocation>(
      "/api/tools/minecraft-locations/nearest",
      { params: { world_id: worldId, x, z, shelterOnly } }
    );
    return response.data;
  }

  async getExploreSuggestions(
    worldId: string,
    distanceBlocks?: number
  ): Promise<ExploreSuggestion[]> {
    const response = await this.client.get<ExploreSuggestion[]>(
      "/api/tools/minecraft-locations/explore-suggestions",
      {
        params: {
          world_id: worldId,
          ...(distanceBlocks ? { distance_blocks: distanceBlocks } : {}),
        },
      }
    );
    return response.data;
  }

  async deleteLocation(id: string, worldId: string): Promise<void> {
    await this.client.delete(`/api/tools/minecraft-locations/${id}`, {
      params: { world_id: worldId },
    });
  }

  async updateLocation(
    id: string,
    worldId: string,
    updates: UpdateLocationInput
  ): Promise<MinecraftLocation> {
    const response = await this.client.put<MinecraftLocation>(
      `/api/tools/minecraft-locations/${id}`,
      updates,
      { params: { world_id: worldId } }
    );
    return response.data;
  }
}

export const apiClient = new APIClient();
