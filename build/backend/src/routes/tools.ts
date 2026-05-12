import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { FoundryService } from "../services/foundry.js";
import { loadEnv } from "../utils/env.js";

const env = loadEnv();
const router = Router();

const foundry = new FoundryService(env.FOUNDRY_ENDPOINT, env.FOUNDRY_API_KEY);

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

    const analysis = await foundry.analyzePlantImage(imageDataUrl, notes);

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

export { router as toolsRouter };
