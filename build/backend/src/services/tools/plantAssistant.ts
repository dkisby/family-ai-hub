import { FoundryService } from "../foundry.js";

export interface PlantAnalysis {
  plantName?: string;
  summary: string;
  likelyIssue: string;
  confidence: number;
  actions: string[];
  warningFlags: string[];
}

export class PlantAssistantService {
  constructor(private readonly foundry: FoundryService) {}

  async analyzeImage(
    imageDataUrl: string,
    notes?: string
  ): Promise<PlantAnalysis> {
    const userText = notes?.trim()
      ? `Analyze this plant image. Additional context from user: ${notes.trim()}`
      : "Analyze this plant image.";

    const parsed = await this.foundry.generateStructuredImageResponse<Partial<PlantAnalysis>>({
      systemPrompt:
        "You are a careful plant assistant. Identify the plant and return only valid JSON with keys: plantName (string), summary (string), likelyIssue (string), confidence (number 0-1), actions (array of short strings), warningFlags (array of short strings). Do not include markdown.",
      userText,
      imageDataUrl,
      maxTokens: 1000,
      temperature: 0.2,
    });

    return {
      plantName:
        typeof parsed.plantName === "string" ? parsed.plantName : undefined,
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary
          : "No summary provided.",
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
  }
}