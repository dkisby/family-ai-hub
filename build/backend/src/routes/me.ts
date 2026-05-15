import { Router, Response } from "express";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/api/me", (req: AuthRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  return res.json({
    oid: req.user.oid,
    email: req.user.email,
    name: req.user.name,
    groups: req.user.groups || [],
  });
});

export { router as meRouter };
