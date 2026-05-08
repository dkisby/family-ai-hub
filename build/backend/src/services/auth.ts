import jwt from "jsonwebtoken";

export interface DecodedToken {
  oid: string;
  upn: string;
  name?: string;
  email?: string;
}

export class AuthService {
  /**
   * Validate and decode a Bearer token
   * In production, validate signature against Entra public keys
   */
  static validateToken(token: string): DecodedToken | null {
    try {
      // Remove "Bearer " prefix if present
      const cleanToken = token.replace(/^Bearer\s+/i, "");

      // Decode without verification for now (DEVELOPMENT ONLY)
      // In production, verify against Microsoft's public keys
      const decoded = jwt.decode(cleanToken) as Record<string, any>;

      if (!decoded || !decoded.oid) {
        return null;
      }

      return {
        oid: decoded.oid,
        upn: decoded.upn || decoded.unique_name || "",
        name: decoded.name,
        email: decoded.email,
      };
    } catch (error) {
      console.error("Token validation error:", error);
      return null;
    }
  }

  /**
   * Extract Bearer token from Authorization header
   */
  static extractToken(authHeader?: string): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
      return null;
    }

    return parts[1];
  }
}
