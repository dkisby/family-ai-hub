import { Router, Response } from "express";
import { FoundryService, ChatMessage } from "../services/foundry.js";
import { AuthRequest } from "../middleware/auth.js";
import { loadEnv } from "../utils/env.js";

const env = loadEnv();
const router = Router();

const foundry = new FoundryService(
  env.FOUNDRY_ENDPOINT,
  env.FOUNDRY_API_KEY
);

interface ChatRequestBody {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt?: string;
}

// Non-streaming chat endpoint
router.post(
  "/api/chat",
  async (req: AuthRequest, res: Response) => {
    try {
      const { messages, systemPrompt } = req.body as ChatRequestBody;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages" });
      }

      console.log(`[${req.user?.email}] Chat request:`, messages.length, "messages");

      const response = await foundry.chat(messages, systemPrompt);

      res.json({
        role: "assistant",
        content: response.content,
      });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({
        error: error instanceof Error ? error.message : "Chat failed",
      });
    }
  }
);

// Streaming chat endpoint
router.post(
  "/api/chat/stream",
  async (req: AuthRequest, res: Response) => {
    try {
      const { messages, systemPrompt } = req.body as ChatRequestBody;

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "Invalid messages" });
      }

      console.log(`[${req.user?.email}] Streaming chat request:`, messages.length, "messages");

      res.setHeader("Content-Type", "application/x-ndjson");
      res.setHeader("Transfer-Encoding", "chunked");

      for await (const chunk of foundry.streamChat(messages, systemPrompt)) {
        res.write(JSON.stringify({ delta: chunk }) + "\n");
      }

      res.end();
    } catch (error) {
      console.error("Stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error instanceof Error ? error.message : "Stream failed",
        });
      } else {
        res.end();
      }
    }
  }
);

export { router as chatRouter };
