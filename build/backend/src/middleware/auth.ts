import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.js";

export interface AuthRequest extends Request {
  user?: {
    oid: string;
    email: string;
    name?: string;
  };
}

export function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing authorization header" });
  }

  const token = AuthService.extractToken(authHeader);
  if (!token) {
    return res.status(401).json({ error: "Invalid authorization header" });
  }

  AuthService.validateToken(token)
    .then((decoded) => {
      if (!decoded) {
        return res.status(401).json({ error: "Invalid token" });
      }

      req.user = {
        oid: decoded.oid,
        email: decoded.email || decoded.upn,
        name: decoded.name,
      };

      return next();
    })
    .catch((error) => {
      console.error("Authentication middleware error:", error);
      return res.status(401).json({ error: "Invalid token" });
    });
}
