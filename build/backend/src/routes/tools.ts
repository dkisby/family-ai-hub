import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { FoundryService } from "../services/foundry.js";
import { PlantAssistantService } from "../services/tools/plantAssistant.js";
import { MinecraftAssistantService } from "../services/tools/minecraftAssistant.js";
import { loadEnv } from "../utils/env.js";

const env = loadEnv();
const router = Router();

const foundry = new FoundryService(env.FOUNDRY_ENDPOINT, env.FOUNDRY_API_KEY);
const plantAssistant = new PlantAssistantService(foundry);
const minecraftAssistant = new MinecraftAssistantService(foundry);

interface PlantAnalyzeBody {
  imageDataUrl?: string;
  notes?: string;
}

router.post("/api/tools/plant-assistant/analyze", async (req: AuthRequest, res: Response) => {
  try {
    const { imageDataUrl, notes } = req.body as PlantAnalyzeBody;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res.status(400).json({ error: "imageDataUrl is required" });
    }

    if (!imageDataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "imageDataUrl must be a valid data URL image" });
    }

    const analysis = await plantAssistant.analyzeImage(imageDataUrl, notes);

    return res.json({
      tool: "plant-assistant",
      result: analysis,
    });
  } catch (error) {
    console.error("Plant assistant route error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Plant analysis failed",
    });
  }
});

interface MinecraftAskBody {
  question?: string;
  edition?: "java" | "bedrock" | "auto-detect";
  detail_level?: "simple" | "normal" | "advanced";
}

router.post("/api/tools/minecraft-assistant/ask", async (req: AuthRequest, res: Response) => {
  try {
    const { question, edition = "auto-detect", detail_level = "normal" } = req.body as MinecraftAskBody;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }

    const response = await minecraftAssistant.askMinecraft(question, edition, detail_level);

    return res.json({
      tool: "minecraft-assistant",
      result: response,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Minecraft assistant failed";
    console.error("Minecraft assistant route error:", errorMessage);
    return res.status(400).json({ error: errorMessage });
  }
});

export { router as toolsRouter };
