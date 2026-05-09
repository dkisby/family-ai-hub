import express, { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import { loadEnv } from "./utils/env.js";
import { authMiddleware } from "./middleware/auth.js";
import { chatRouter } from "./routes/chat.js";
import { healthRouter } from "./routes/health.js";

const env = loadEnv();
const app: Express = express();
const allowedOrigins = new Set(
  [env.FRONTEND_ORIGIN, ...env.CORS_ALLOWED_ORIGINS].filter(Boolean)
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  })
);
app.use(express.json());
app.use(healthRouter);
app.use("/api", authMiddleware);
app.use(chatRouter);
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: err.message || "Internal server error",
  });
});
const PORT = env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✓ Backend API running on http://localhost:${PORT}`);
  console.log(`✓ Foundry endpoint: ${env.FOUNDRY_ENDPOINT}`);
});
