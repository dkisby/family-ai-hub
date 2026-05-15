import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";
import { FoundryService } from "../services/foundry.js";
import { PlantAssistantService } from "../services/tools/plantAssistant.js";
import { MinecraftAssistantService } from "../services/tools/minecraftAssistant.js";
import { MinecraftLocationsService, ValidationError } from "../services/tools/minecraftLocations.js";
import { loadEnv } from "../utils/env.js";

const env = loadEnv();
const router = Router();

const foundry = new FoundryService(env.FOUNDRY_ENDPOINT, env.FOUNDRY_API_KEY);
const plantAssistant = new PlantAssistantService(foundry);
const minecraftAssistant = new MinecraftAssistantService(foundry);
const locationsService = env.DATABASE_URL
  ? new MinecraftLocationsService(env.DATABASE_URL)
  : null;

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
}

router.post("/api/tools/minecraft-assistant/ask", async (req: AuthRequest, res: Response) => {
  try {
    const { question, edition = "auto-detect" } = req.body as MinecraftAskBody;

    if (!question || typeof question !== "string") {
      return res.status(400).json({ error: "question is required" });
    }

    const response = await minecraftAssistant.askMinecraft(question, edition);

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

// ─── Location helper ────────────────────────────────────────────────────────

function getLocationsService(res: Response): MinecraftLocationsService | null {
  if (!locationsService) {
    res.status(503).json({ error: "Location service is not configured (DATABASE_URL missing)." });
    return null;
  }
  return locationsService;
}

function locationError(res: Response, error: unknown): Response {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message, code: error.code });
  }
  console.error("Location service error:", error);
  return res.status(500).json({ error: "Location operation failed" });
}

// ─── Location routes ─────────────────────────────────────────────────────────

// POST /api/tools/minecraft-locations  — save a new location
router.post("/api/tools/minecraft-locations", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const location = await svc.saveLocation(req.body);
    return res.status(201).json(location);
  } catch (error) {
    return locationError(res, error);
  }
});

// GET /api/tools/minecraft-locations?world_id=  — list all for world
router.get("/api/tools/minecraft-locations", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const worldId = String(req.query.world_id ?? "");
    const locations = await svc.listLocations(worldId);
    return res.json(locations);
  } catch (error) {
    return locationError(res, error);
  }
});

// GET /api/tools/minecraft-locations/nearest?shelterOnly=true&world_id=&x=&z=
router.get("/api/tools/minecraft-locations/nearest", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const worldId = String(req.query.world_id ?? "");
    const x = Number(req.query.x);
    const z = Number(req.query.z);
    const shelterOnly = req.query.shelterOnly !== "false";

    if (isNaN(x) || isNaN(z)) {
      return res.status(400).json({ error: "x and z must be valid numbers" });
    }

    const result = await svc.findNearest(worldId, x, z, shelterOnly);
    if (!result) {
      return res.status(404).json({ error: "No matching locations found" });
    }
    return res.json(result);
  } catch (error) {
    return locationError(res, error);
  }
});

// GET /api/tools/minecraft-locations/explore-suggestions?world_id=
router.get("/api/tools/minecraft-locations/explore-suggestions", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const worldId = String(req.query.world_id ?? "");
    const distanceBlocks = Number(req.query.distance_blocks ?? 500);
    if (Number.isNaN(distanceBlocks)) {
      return res.status(400).json({ error: "distance_blocks must be a valid number" });
    }

    const suggestions = await svc.getExploreSuggestions(worldId, distanceBlocks);
    return res.json(suggestions);
  } catch (error) {
    return locationError(res, error);
  }
});

// DELETE /api/tools/minecraft-locations/:id?world_id=
router.delete("/api/tools/minecraft-locations/:id", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const worldId = String(req.query.world_id ?? "");
    const deleted = await svc.deleteLocation(req.params.id, worldId);
    if (!deleted) {
      return res.status(404).json({ error: "Location not found" });
    }
    return res.status(204).end();
  } catch (error) {
    return locationError(res, error);
  }
});

// PUT /api/tools/minecraft-locations/:id?world_id=
router.put("/api/tools/minecraft-locations/:id", async (req: AuthRequest, res: Response) => {
  const svc = getLocationsService(res);
  if (!svc) return;
  try {
    const worldId = String(req.query.world_id ?? "");
    const updated = await svc.updateLocation(req.params.id, worldId, req.body);
    if (!updated) {
      return res.status(404).json({ error: "Location not found" });
    }
    return res.json(updated);
  } catch (error) {
    return locationError(res, error);
  }
});

export { router as toolsRouter };
