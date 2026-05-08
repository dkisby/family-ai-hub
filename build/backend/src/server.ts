import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { loadEnv } from "./utils/env.js";
import { authMiddleware } from "./middleware/auth.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";

const env = loadEnv();
const app: Express = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check (no auth required)
app.use(healthRouter);

// Auth middleware for all API routes
app.use("/api", authMiddleware);

// Routes
app.use(chatRouter);

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: err.message || "Internal server error",
  });
});

// Start server
const PORT = env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Backend API running on http://localhost:${PORT}`);
  console.log(`✓ Foundry endpoint: ${env.FOUNDRY_ENDPOINT}`);
});
