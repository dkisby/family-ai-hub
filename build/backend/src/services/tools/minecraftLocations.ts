import pg from "pg";

const { Pool } = pg;

// ─── Types ────────────────────────────────────────────────────────────────────

export type LocationCategory =
  | "shelter"
  | "bed"
  | "house"
  | "village"
  | "cave"
  | "poi"
  | "noi";

export type Dimension = "overworld" | "nether" | "end";

export interface MinecraftLocation {
  id: string;
  world_id: string;
  name: string | null;
  category: LocationCategory;
  x: number;
  y: number;
  z: number;
  dimension: Dimension;
  comment: string;
  created_at: string;
}

export interface SaveLocationInput {
  world_id: string;
  name?: string;
  category: LocationCategory;
  x: number;
  y: number;
  z: number;
  dimension?: Dimension;
  comment: string;
}

export interface UpdateLocationInput {
  name?: string;
  comment?: string;
  category?: LocationCategory;
}

export interface NearestResult extends MinecraftLocation {
  distance: number;
}

export interface ExploreSuggestion {
  direction: string;
  reason: string;
  suggestedX: number;
  suggestedZ: number;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const VALID_CATEGORIES: LocationCategory[] = [
  "shelter", "bed", "house", "village", "cave", "poi", "noi",
];
const VALID_DIMENSIONS: Dimension[] = ["overworld", "nether", "end"];

function validateSaveInput(input: SaveLocationInput): void {
  if (!input.world_id || typeof input.world_id !== "string" || input.world_id.trim() === "") {
    throw new ValidationError("world_id is required");
  }
  if (!input.comment || typeof input.comment !== "string" || input.comment.trim() === "") {
    throw new ValidationError("comment is required", "comment_required");
  }
  if (!VALID_CATEGORIES.includes(input.category)) {
    throw new ValidationError(
      `category must be one of: ${VALID_CATEGORIES.join(", ")}`
    );
  }
  if (
    typeof input.x !== "number" ||
    typeof input.y !== "number" ||
    typeof input.z !== "number"
  ) {
    throw new ValidationError("x, y, and z must be numbers");
  }
  if (!Number.isInteger(input.x) || !Number.isInteger(input.y) || !Number.isInteger(input.z)) {
    throw new ValidationError("x, y, and z must be integers");
  }
  if (input.dimension !== undefined && !VALID_DIMENSIONS.includes(input.dimension)) {
    throw new ValidationError(
      `dimension must be one of: ${VALID_DIMENSIONS.join(", ")}`
    );
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: string = "validation_error"
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

// ─── Exploration suggestion logic ─────────────────────────────────────────────

const EXPLORE_GRID_STEP = 750; // blocks between candidate points
const EXPLORE_MIN_DISTANCE = 500; // min distance from any known location

const COMPASS_DIRECTIONS = [
  { label: "north", dx: 0, dz: -1 },
  { label: "south", dx: 0, dz: 1 },
  { label: "east",  dx: 1, dz: 0 },
  { label: "west",  dx: -1, dz: 0 },
  { label: "northeast", dx: 1, dz: -1 },
  { label: "northwest", dx: -1, dz: -1 },
  { label: "southeast", dx: 1, dz: 1 },
  { label: "southwest", dx: -1, dz: 1 },
];

function xzDist(x1: number, z1: number, x2: number, z2: number): number {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return Math.sqrt(dx * dx + dz * dz);
}

function buildExploreSuggestions(locations: MinecraftLocation[]): ExploreSuggestion[] {
  const nonNoi = locations.filter((l) => l.category !== "noi");
  const noiBoundaries = locations.filter((l) => l.category === "noi");

  if (nonNoi.length === 0) {
    return [
      {
        direction: "any direction",
        reason: "No locations saved yet. Start exploring and save your first shelter!",
        suggestedX: 500,
        suggestedZ: 500,
      },
    ];
  }

  // Find bounding box of all non-NOI locations
  const allX = nonNoi.map((l) => l.x);
  const allZ = nonNoi.map((l) => l.z);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minZ = Math.min(...allZ);
  const maxZ = Math.max(...allZ);
  const centerX = Math.round((minX + maxX) / 2);
  const centerZ = Math.round((minZ + maxZ) / 2);

  // Identify comment-mentioned structures to suggest visiting
  const mentionedTerms = locations.map(
    (l) => `${l.comment} ${l.name ?? ""}`.toLowerCase()
  );
  const commonStructures = [
    "village", "temple", "stronghold", "ocean monument", "end city",
    "nether fortress", "bastion", "mineshaft", "woodland mansion",
    "ancient city", "trail ruins",
  ];
  const notYetVisited = commonStructures.filter(
    (s) => !mentionedTerms.some((t) => t.includes(s))
  );

  const suggestions: ExploreSuggestion[] = [];

  for (const dir of COMPASS_DIRECTIONS) {
    if (suggestions.length >= 5) break;

    const candidateX = centerX + dir.dx * EXPLORE_GRID_STEP;
    const candidateZ = centerZ + dir.dz * EXPLORE_GRID_STEP;

    // Is there a NOI near the candidate?
    const nearNoi = noiBoundaries.some(
      (n) => xzDist(candidateX, candidateZ, n.x, n.z) < EXPLORE_MIN_DISTANCE
    );
    if (nearNoi) continue;

    // Is there any saved location already near the candidate?
    const alreadyScouted = nonNoi.some(
      (l) => xzDist(candidateX, candidateZ, l.x, l.z) < EXPLORE_MIN_DISTANCE
    );
    if (alreadyScouted) continue;

    let reason = `No saved locations to the ${dir.label}.`;
    if (notYetVisited.length > 0) {
      const suggestion = notYetVisited[suggestions.length % notYetVisited.length];
      reason += ` Consider looking for a ${suggestion}.`;
    }

    suggestions.push({
      direction: dir.label,
      reason,
      suggestedX: candidateX,
      suggestedZ: candidateZ,
    });
  }

  // Fallback: always offer at least one suggestion
  if (suggestions.length === 0) {
    const farthestDir = COMPASS_DIRECTIONS[0];
    const fallbackX = centerX + farthestDir.dx * EXPLORE_GRID_STEP * 2;
    const fallbackZ = centerZ + farthestDir.dz * EXPLORE_GRID_STEP * 2;
    suggestions.push({
      direction: "further out",
      reason:
        "Your known locations are densely packed. Venture further out for new discoveries!",
      suggestedX: fallbackX,
      suggestedZ: fallbackZ,
    });
  }

  return suggestions;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class MinecraftLocationsService {
  private readonly pool: pg.Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  // ── Save ────────────────────────────────────────────────────────────────────

  async saveLocation(input: SaveLocationInput): Promise<MinecraftLocation> {
    validateSaveInput(input);

    const result = await this.pool.query<MinecraftLocation>(
      `INSERT INTO minecraft_locations
         (world_id, name, category, x, y, z, dimension, comment)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.world_id.trim(),
        input.name?.trim() ?? null,
        input.category,
        input.x,
        input.y,
        input.z,
        input.dimension ?? "overworld",
        input.comment.trim(),
      ]
    );

    return result.rows[0];
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async listLocations(worldId: string): Promise<MinecraftLocation[]> {
    if (!worldId || typeof worldId !== "string" || worldId.trim() === "") {
      throw new ValidationError("world_id is required");
    }

    const result = await this.pool.query<MinecraftLocation>(
      `SELECT * FROM minecraft_locations
       WHERE world_id = $1
       ORDER BY created_at DESC`,
      [worldId.trim()]
    );

    return result.rows;
  }

  // ── Nearest ─────────────────────────────────────────────────────────────────

  async findNearest(
    worldId: string,
    x: number,
    z: number,
    shelterOnly: boolean
  ): Promise<NearestResult | null> {
    if (!worldId || typeof worldId !== "string" || worldId.trim() === "") {
      throw new ValidationError("world_id is required");
    }
    if (typeof x !== "number" || typeof z !== "number") {
      throw new ValidationError("x and z must be numbers");
    }

    const shelterFilter = shelterOnly
      ? `AND category IN ('shelter','bed','house')`
      : `AND category != 'noi'`;

    // Compute Euclidean x/z distance in SQL for efficient ordering
    const result = await this.pool.query<MinecraftLocation & { distance: number }>(
      `SELECT *,
              SQRT(POWER(x - $2, 2) + POWER(z - $3, 2)) AS distance
       FROM minecraft_locations
       WHERE world_id = $1
         ${shelterFilter}
       ORDER BY distance ASC
       LIMIT 1`,
      [worldId.trim(), x, z]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      ...row,
      distance: Number(row.distance),
    };
  }

  // ── Explore suggestions ──────────────────────────────────────────────────────

  async getExploreSuggestions(worldId: string): Promise<ExploreSuggestion[]> {
    if (!worldId || typeof worldId !== "string" || worldId.trim() === "") {
      throw new ValidationError("world_id is required");
    }

    const locations = await this.listLocations(worldId);
    return buildExploreSuggestions(locations);
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  async deleteLocation(id: string, worldId: string): Promise<boolean> {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new ValidationError("id is required");
    }
    if (!worldId || typeof worldId !== "string" || worldId.trim() === "") {
      throw new ValidationError("world_id is required");
    }

    const result = await this.pool.query(
      `DELETE FROM minecraft_locations
       WHERE id = $1 AND world_id = $2`,
      [id.trim(), worldId.trim()]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async updateLocation(
    id: string,
    worldId: string,
    updates: UpdateLocationInput
  ): Promise<MinecraftLocation | null> {
    if (!id || typeof id !== "string" || id.trim() === "") {
      throw new ValidationError("id is required");
    }
    if (!worldId || typeof worldId !== "string" || worldId.trim() === "") {
      throw new ValidationError("world_id is required");
    }

    if (
      updates.category !== undefined &&
      !VALID_CATEGORIES.includes(updates.category)
    ) {
      throw new ValidationError(
        `category must be one of: ${VALID_CATEGORIES.join(", ")}`
      );
    }

    const setClauses: string[] = [];
    const params: (string | null)[] = [];
    let paramIdx = 3;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(updates.name.trim() || null);
    }
    if (updates.comment !== undefined) {
      if (!updates.comment.trim()) {
        throw new ValidationError("comment cannot be empty", "comment_required");
      }
      setClauses.push(`comment = $${paramIdx++}`);
      params.push(updates.comment.trim());
    }
    if (updates.category !== undefined) {
      setClauses.push(`category = $${paramIdx++}`);
      params.push(updates.category);
    }

    if (setClauses.length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    const result = await this.pool.query<MinecraftLocation>(
      `UPDATE minecraft_locations
       SET ${setClauses.join(", ")}
       WHERE id = $1 AND world_id = $2
       RETURNING *`,
      [id.trim(), worldId.trim(), ...params]
    );

    return result.rows[0] ?? null;
  }
}
