import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { webcrypto } from "crypto";
import { loadEnv } from "../utils/env.js";

export interface DecodedToken {
  oid: string;
  upn: string;
  name?: string;
  email?: string;
}

const env = loadEnv();

// jose expects Web Crypto APIs; ensure availability in Node runtimes where global crypto is absent.
if (!globalThis.crypto) {
  (globalThis as any).crypto = webcrypto as any;
}

const issuer = `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/v2.0`;
const jwksUri = new URL(`https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/discovery/v2.0/keys`);
const jwks = createRemoteJWKSet(jwksUri);

function buildAudiences(): string[] {
  if (!env.ENTRA_API_CLIENT_ID) {
    return [];
  }

  return [env.ENTRA_API_CLIENT_ID, `api://${env.ENTRA_API_CLIENT_ID}`];
}

export class AuthService {
  
  static async validateToken(token: string): Promise<DecodedToken | null> {
    try {
      const cleanToken = token.replace(/^Bearer\s+/i, "");

      const verifyOptions: {
        issuer: string;
        audience?: string[];
      } = {
        issuer,
      };

      const audiences = buildAudiences();
      if (audiences.length > 0) {
        verifyOptions.audience = audiences;
      }

      const { payload } = await jwtVerify(cleanToken, jwks, verifyOptions);
      const decoded = payload as JWTPayload & Record<string, unknown>;

      if (!decoded || !decoded.oid) {
        return null;
      }

      return {
        oid: String(decoded.oid),
        upn: String(decoded.upn || decoded.unique_name || ""),
        name: decoded.name ? String(decoded.name) : undefined,
        email: decoded.email ? String(decoded.email) : undefined,
      };
    } catch (error) {
      console.error("Token validation error:", error);
      return null;
    }
  }

  
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
