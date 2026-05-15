import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { webcrypto } from "crypto";
import { loadEnv } from "../utils/env.js";

export interface DecodedToken {
  oid: string;
  upn: string;
  name?: string;
  email?: string;
  groups: string[];
  hasGroupOverageClaim: boolean;
}

export class AuthorizationError extends Error {
  readonly code: "GROUP_ACCESS_DENIED" | "GROUP_OVERAGE";

  constructor(code: "GROUP_ACCESS_DENIED" | "GROUP_OVERAGE", message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
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

function parseGroupsClaim(decoded: Record<string, unknown>): string[] {
  const groups = decoded.groups;
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .filter((group): group is string => typeof group === "string")
    .map((group) => group.trim())
    .filter(Boolean);
}

function hasGroupOverage(decoded: Record<string, unknown>): boolean {
  if (decoded.hasgroups === true || decoded.hasgroups === "true") {
    return true;
  }

  const claimNames = decoded._claim_names;
  if (!claimNames || typeof claimNames !== "object") {
    return false;
  }

  return "groups" in (claimNames as Record<string, unknown>);
}

function isUserInAllowedGroup(
  userGroups: string[],
  allowedGroupIds: string[]
): boolean {
  if (allowedGroupIds.length === 0) {
    return true;
  }

  if (userGroups.length === 0) {
    return false;
  }

  const allowedSet = new Set(allowedGroupIds.map((groupId) => groupId.toLowerCase()));
  return userGroups.some((groupId) => allowedSet.has(groupId.toLowerCase()));
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

      const groups = parseGroupsClaim(decoded);
      const hasGroupOverageClaim = hasGroupOverage(decoded);
      const groupRestrictionEnabled = env.ENTRA_ALLOWED_GROUP_IDS.length > 0;

      if (groupRestrictionEnabled) {
        if (hasGroupOverageClaim) {
          throw new AuthorizationError(
            "GROUP_OVERAGE",
            "Your account belongs to many groups and this token omitted group memberships. Ask an admin to configure group claims or app role assignment."
          );
        }

        if (!isUserInAllowedGroup(groups, env.ENTRA_ALLOWED_GROUP_IDS)) {
          throw new AuthorizationError(
            "GROUP_ACCESS_DENIED",
            "Your account is not in an allowed Entra group for this app."
          );
        }
      }

      return {
        oid: String(decoded.oid),
        upn: String(decoded.upn || decoded.unique_name || ""),
        name: decoded.name ? String(decoded.name) : undefined,
        email: decoded.email ? String(decoded.email) : undefined,
        groups,
        hasGroupOverageClaim,
      };
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw error;
      }

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
