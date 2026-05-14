import { FoundryService, ChatMessage } from "../foundry.js";

export interface MinecraftResponse {
  answer: string;
  steps: string[];
  materials: string[];
  commands: string[];
  notes: string;
}

type MinecraftEdition = "java" | "bedrock" | "auto-detect";
type ResolvedEdition = "java" | "bedrock" | "both";

export class MinecraftAssistantService {
  constructor(private readonly foundry: FoundryService) {}

  async askMinecraft(
    question: string,
    edition: MinecraftEdition = "auto-detect"
  ): Promise<MinecraftResponse> {
    // Validate safety: reject queries about griefing, exploits, or harm
    this.validateSafety(question);

    // Build system prompt with edition context
    const resolvedEdition = this.resolveEdition(question, edition);
    const systemPrompt = this.buildSystemPrompt(resolvedEdition);

    // Call Foundry with structured prompt to extract JSON
    const userText = `User question: ${question}\n\nEdition selection mode: ${edition}. Resolved edition for this answer: ${resolvedEdition}.\n\nPlease respond with ONLY a valid JSON object (no markdown, no extra text) with these keys: answer, steps (array of strings), materials (array of strings), commands (array of strings), notes (string).`;

    const messages: ChatMessage[] = [
      {
        role: "user",
        content: userText,
      },
    ];

    const result = await this.foundry.chat(messages, systemPrompt);

    // Parse and validate the JSON response
    const parsed = this.parseMinecraftResponse(result.content);

    return {
      answer: parsed.answer || "I'm not sure how to help with that.",
      steps: Array.isArray(parsed.steps)
        ? parsed.steps.filter((item): item is string => typeof item === "string")
        : [],
      materials: Array.isArray(parsed.materials)
        ? parsed.materials.filter((item): item is string => typeof item === "string")
        : [],
      commands: Array.isArray(parsed.commands)
        ? parsed.commands.filter((item): item is string => typeof item === "string")
        : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  }

  private resolveEdition(
    question: string,
    requestedEdition: MinecraftEdition
  ): ResolvedEdition {
    if (requestedEdition === "java" || requestedEdition === "bedrock") {
      return requestedEdition;
    }

    const lower = question.toLowerCase();
    const javaSignals = [
      "java edition",
      "fabric",
      "forge",
      "datapack",
      "optifine",
      "scoreboard objectives",
      "nbt",
    ];
    const bedrockSignals = [
      "bedrock edition",
      "pocket edition",
      "mcpe",
      "marketplace",
      "behavior pack",
      "behaviour pack",
      "addon",
      "add-on",
    ];

    const hasJavaSignal = javaSignals.some((signal) => lower.includes(signal));
    const hasBedrockSignal = bedrockSignals.some((signal) => lower.includes(signal));

    if (hasJavaSignal && !hasBedrockSignal) {
      return "java";
    }

    if (hasBedrockSignal && !hasJavaSignal) {
      return "bedrock";
    }

    return "both";
  }

  private buildSystemPrompt(edition: ResolvedEdition): string {
    let editionContext = "";
    if (edition === "java") {
      editionContext =
        "Focus on Java Edition. Use Java Edition command syntax (e.g., /give @s diamond_sword).";
    } else if (edition === "bedrock") {
      editionContext =
        "Focus on Bedrock Edition. Use Bedrock Edition command syntax (e.g., /give @s diamond_sword 1).";
    } else {
      editionContext =
        "Provide information for both Java and Bedrock editions when relevant. Highlight differences if they matter.";
    }

    return `You are a friendly, helpful Minecraft Assistant. Your job is to teach players about Minecraft concepts, crafting recipes, building guides, redstone logic, mob behavior, survival tips, and game commands.

${editionContext}

Provide clear, balanced explanations suitable for most players.

SAFETY RULES (STRICT):
- NEVER provide griefing instructions or PvP harm tactics
- NEVER suggest hacked clients, server exploits, or game-breaking commands
- NEVER encourage unsafe behavior toward other players
- NEVER provide commands that break servers or cause harm
- Always encourage creativity, collaboration, and safe play
- Keep responses age-appropriate and family-friendly
- If a question seems unsafe, politely decline and offer a constructive alternative
- Stay in the spirit of normal gameplay: avoid glitches, dupes, exploits, or shortcut advice that bypasses fair progression.

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object (no markdown code fences, no extra text). The JSON must have exactly these keys:
- "answer": A natural language explanation or answer to the user's question
- "steps": An array of step-by-step instructions (empty array if not applicable)
- "materials": An array of required blocks/items for crafting or building (empty array if not applicable)
- "commands": An array of relevant Minecraft commands with proper syntax (empty array if not applicable)
- "notes": A string with extra tips, warnings, or alternatives (empty string if none)

Example valid response:
{"answer":"To craft a crafting table, you need 4 wooden planks...","steps":["Open your inventory","Place 4 wooden planks in a 2x2 pattern","Take the crafting table from the output slot"],"materials":["4x Wooden Planks (any type)"],"commands":[],"notes":"You can use any type of wood planks. Oak, birch, spruce, etc. all work the same."}`;
  }

  private validateSafety(question: string): void {
    const unsafeKeywords = [
      /grief|destroy.*home|raid.*base|steal|dupe|exploit|hack|cheat.*client|griefing|grief/i,
      /pvp.*kill|kill.*player|attack.*player|hurt.*player/i,
      /hack|mod.*hack|x-ray|kill.*aura|aimbot|fly.*hack|speed.*hack/i,
      /server.*crash|crash.*server|lag.*machine|ddos|lag.*spike/i,
      /cheat.*engine|cheat.*tool|bypass.*ban|bypass.*anticheat/i,
    ];

    for (const pattern of unsafeKeywords) {
      if (pattern.test(question)) {
        throw new Error(
          "I can't help with that. I focus on constructive Minecraft gameplay, building, and learning. " +
            "Feel free to ask about crafting, building, redstone, survival tips, or game commands instead!"
        );
      }
    }
  }

  private parseMinecraftResponse(content: string): Partial<MinecraftResponse> {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn("No JSON found in response:", content);
      return {
        answer: content,
        steps: [],
        materials: [],
        commands: [],
        notes: "",
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate structure
      return {
        answer: typeof parsed.answer === "string" ? parsed.answer : "",
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        materials: Array.isArray(parsed.materials) ? parsed.materials : [],
        commands: Array.isArray(parsed.commands) ? parsed.commands : [],
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      };
    } catch (error) {
      console.error("Failed to parse Minecraft response JSON:", error, content);
      return {
        answer: content,
        steps: [],
        materials: [],
        commands: [],
        notes: "Note: Response parsing encountered an issue. See answer above.",
      };
    }
  }
}
