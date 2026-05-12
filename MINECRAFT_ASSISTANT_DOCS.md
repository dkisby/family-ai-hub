# Minecraft Assistant Tool - Implementation Documentation

## Overview
The Minecraft Assistant Tool is a family-friendly, safety-conscious AI tool that helps users (primarily children and parents) learn about Minecraft. It provides guidance on crafting, building, redstone, commands, survival tips, and mob behavior while strictly preventing harmful content like griefing, exploits, or PvP harm tactics.

## Architecture

### Backend Service: `MinecraftAssistantService`
**File:** `build/backend/src/services/tools/minecraftAssistant.ts`

```typescript
export class MinecraftAssistantService {
  async askMinecraft(
    question: string,
    edition: "java" | "bedrock" | "auto-detect",
    detailLevel: "simple" | "normal" | "advanced"
  ): Promise<MinecraftResponse>
}
```

**Key Features:**
- Text-based Q&A using Foundry `chat()` method
- Edition-specific syntax (Java vs. Bedrock)
- Detail level customization (simple, normal, advanced)
- Built-in safety validation (rejects griefing/exploit keywords)
- Structured JSON response parsing with fallback handling

### API Route
**File:** `build/backend/src/routes/tools.ts`

```
POST /api/tools/minecraft-assistant/ask
```

**Request Body:**
```json
{
  "question": "How do I build a piston door?",
  "edition": "java|bedrock|auto-detect",
  "detail_level": "simple|normal|advanced"
}
```

**Response:**
```json
{
  "tool": "minecraft-assistant",
  "result": {
    "answer": "string",
    "steps": ["string"],
    "materials": ["string"],
    "commands": ["string"],
    "notes": "string"
  }
}
```

### Frontend Integration

#### API Client Method
**File:** `build/frontend/src/services/api.ts`

```typescript
async askMinecraft(
  question: string,
  edition: "java" | "bedrock" | "auto-detect" = "auto-detect",
  detailLevel: "simple" | "normal" | "advanced" = "normal"
): Promise<MinecraftAssistantResult>
```

#### UI Component
**File:** `build/frontend/src/components/ChatUI.tsx`

Includes a dedicated Minecraft tool panel with:
- Question input field
- Edition selector dropdown (auto-detect, Java, Bedrock)
- Detail level selector (simple, normal, advanced)
- Result display with collapsible sections (answer, steps, materials, commands, notes)
- Error handling with user-friendly messages

## Type Definitions

### Backend
```typescript
export interface MinecraftResponse {
  answer: string;           // Main explanation
  steps: string[];          // Step-by-step instructions
  materials: string[];      // Required blocks/items
  commands: string[];       // Minecraft commands with syntax
  notes: string;            // Extra tips or warnings
}

type MinecraftEdition = "java" | "bedrock" | "auto-detect";
type DetailLevel = "simple" | "normal" | "advanced";
```

### Frontend
```typescript
export interface MinecraftAssistantResult {
  answer: string;
  steps: string[];
  materials: string[];
  commands: string[];
  notes: string;
}
```

## Safety Validation

The service implements strict keyword filtering to reject unsafe queries:

```typescript
// Rejected patterns:
- /grief|destroy.*home|raid.*base|steal|dupe|exploit|hack|cheat.*client/i
- /pvp.*kill|kill.*player|attack.*player|hurt.*player/i
- /hack|mod.*hack|x-ray|kill.*aura|aimbot|fly.*hack/i
- /server.*crash|crash.*server|lag.*machine|ddos/i
- /cheat.*engine|bypass.*ban|bypass.*anticheat/i
```

**Rejection Response:**
```
"I can't help with that. I focus on constructive Minecraft gameplay, building, and learning. Feel free to ask about crafting, building, redstone, survival tips, or game commands instead!"
```

## System Prompt Engineering

The service builds a context-aware system prompt that:
1. Sets edition context (Java, Bedrock, or both)
2. Sets detail level (simple, normal, or advanced)
3. Enforces safety guardrails
4. Specifies JSON output format
5. Provides examples

**Example system prompt (simple + Java):**
```
You are a friendly, helpful Minecraft Assistant...
Focus on Java Edition. Use Java Edition command syntax...
Explain everything like you're talking to a 7-year-old. Use simple words. Keep it short...
[Safety rules...]
RESPONSE FORMAT: You MUST respond with ONLY a valid JSON object...
```

## Example Test Cases

### Test Case 1: Crafting Recipe (Normal Detail, Auto-Detect)
**Input:**
```json
{
  "question": "What's the crafting recipe for a brewing stand?",
  "edition": "auto-detect",
  "detail_level": "normal"
}
```

**Expected Output Structure:**
```json
{
  "tool": "minecraft-assistant",
  "result": {
    "answer": "A brewing stand is used to brew potions and is made with blaze rods and cobblestone...",
    "steps": [
      "Mine or find cobblestone",
      "Kill blazes in the Nether to get blaze rods",
      "Open crafting table",
      "Place 1 blaze rod in center",
      "Place 3 cobblestone in top row",
      "Drag crafting result to inventory"
    ],
    "materials": [
      "1x Blaze Rod",
      "3x Cobblestone (or any type)"
    ],
    "commands": [],
    "notes": "Blaze rods are only found from blazes in Nether fortresses. You can use any cobblestone type."
  }
}
```

### Test Case 2: Redstone Logic (Advanced Detail, Java)
**Input:**
```json
{
  "question": "How do I make a piston door?",
  "edition": "java",
  "detail_level": "advanced"
}
```

**Expected Output Structure:**
```json
{
  "tool": "minecraft-assistant",
  "result": {
    "answer": "Piston doors are redstone contraptions that use pistons to move blocks and create doors...",
    "steps": [
      "Design door frame size and location",
      "Place pistons facing inward",
      "Add redstone wire and repeaters for timing",
      "Connect to button or lever",
      "Test door opening/closing"
    ],
    "materials": [
      "Sticky pistons",
      "Redstone dust",
      "Redstone repeaters",
      "Any solid blocks (oak wood, stone, etc.)",
      "Button or lever"
    ],
    "commands": [],
    "notes": "Advanced designs use slime blocks and honey for compact doors. Timing is critical - use repeaters set to 2-tick delays."
  }
}
```

### Test Case 3: Survival Beginner (Simple Detail)
**Input:**
```json
{
  "question": "Explain redstone repeaters like I'm 7.",
  "edition": "auto-detect",
  "detail_level": "simple"
}
```

**Expected Output Structure:**
```json
{
  "tool": "minecraft-assistant",
  "result": {
    "answer": "Redstone repeaters are like tiny bouncers! When redstone power hits them, they keep it going longer and stronger!",
    "steps": [
      "Find redstone repeater in creative or craft it",
      "Place it on the ground",
      "Connect redstone dust to the back",
      "Connect redstone dust to the front",
      "Turn on the redstone - it carries the power!"
    ],
    "materials": [
      "1x Redstone repeater"
    ],
    "commands": [],
    "notes": "Think of it like a relay runner passing a baton. It takes the signal and passes it forward stronger!"
  }
}
```

### Test Case 4: Safety Rejection (Exploit Request)
**Input:**
```json
{
  "question": "How do I use X-ray hacks to find diamonds faster?",
  "edition": "java",
  "detail_level": "normal"
}
```

**Expected Response:**
```json
{
  "error": "I can't help with that. I focus on constructive Minecraft gameplay, building, and learning. Feel free to ask about crafting, building, redstone, survival tips, or game commands instead!"
}
```
**HTTP Status:** 400 Bad Request

### Test Case 5: Commands (Java vs. Bedrock)
**Input:**
```json
{
  "question": "How do I give a player a diamond sword?",
  "edition": "bedrock",
  "detail_level": "normal"
}
```

**Expected Output (Bedrock Syntax):**
```json
{
  "tool": "minecraft-assistant",
  "result": {
    "answer": "In Bedrock Edition, you can use the /give command to give items to players...",
    "steps": [
      "Open chat (T on keyboard)",
      "Type the /give command",
      "Press Enter"
    ],
    "materials": [],
    "commands": [
      "/give @s diamond_sword 1",
      "/give @a[name=PlayerName] diamond_sword 1"
    ],
    "notes": "In Bedrock, you must specify quantity (1). In Java Edition, quantity defaults to 1 if omitted."
  }
}
```

## Integration Instructions

### Adding to Family AI Hub

1. **Service Already Created:** `build/backend/src/services/tools/minecraftAssistant.ts`

2. **Route Already Added:** Tools route updated at `build/backend/src/routes/tools.ts`

3. **Frontend API Method Added:** `build/frontend/src/services/api.ts`

4. **UI Panel Added:** Minecraft panel in `build/frontend/src/components/ChatUI.tsx`

### Deployment

1. **Commit changes:**
   ```bash
   git add build/backend/src/services/tools/minecraftAssistant.ts
   git add build/backend/src/routes/tools.ts
   git add build/frontend/src/services/api.ts
   git add build/frontend/src/components/ChatUI.tsx
   git commit -m "feat: Add Minecraft Assistant Tool with safety validation"
   git push
   ```

2. **GitHub Actions:** CI/CD pipeline will automatically:
   - Build backend (TypeScript validation)
   - Build frontend (React/Vite)
   - Push Docker images to ACR
   - Deploy to Azure Container Apps

3. **Testing:**
   - Backend endpoint: `POST https://hub.kisbyfamily.com/api/tools/minecraft-assistant/ask`
   - Requires valid JWT token from Azure AD auth
   - UI accessible in chat interface

### Rate Limiting

Minecraft Assistant requests are subject to the global rate limiter:
- **General limit:** 100 requests per 15 minutes
- **Tool-specific:** 30 requests per 15 minutes (applied via `/api/*` routes)

## Extending the Tool Architecture

To add another tool (e.g., Minecraft Mod Advisor):

1. **Create service file:** `build/backend/src/services/tools/minecraftModAdvisor.ts`
   ```typescript
   import { FoundryService, ChatMessage } from "../foundry.js";
   
   export class MinecraftModAdvisorService {
     constructor(private readonly foundry: FoundryService) {}
     async suggestMods(...): Promise<ModSuggestions> { ... }
   }
   ```

2. **Add to tools route:** `build/backend/src/routes/tools.ts`
   ```typescript
   import { MinecraftModAdvisorService } from "../services/tools/minecraftModAdvisor.js";
   const modAdvisor = new MinecraftModAdvisorService(foundry);
   
   router.post("/api/tools/minecraft-mod-advisor/suggest", async (req, res) => { ... });
   ```

3. **Add frontend method:** `build/frontend/src/services/api.ts`
   ```typescript
   async suggestMods(preferences: string): Promise<ModSuggestions> { ... }
   ```

4. **Add UI panel:** `build/frontend/src/components/ChatUI.tsx`
   - Add state variables for mod advisor
   - Add handler function
   - Add UI panel section

## Error Handling

### Backend Error Responses

**400 Bad Request:** Missing or invalid input
```json
{ "error": "question is required" }
```

**400 Bad Request:** Safety validation failure
```json
{ "error": "I can't help with that. I focus on constructive Minecraft gameplay..." }
```

**500 Internal Server Error:** Foundry API failure
```json
{ "error": "Failed to call Foundry: [details]" }
```

### Frontend Error Handling

- Displays error messages in red box above results
- Maintains question/edition/detail level inputs for retry
- Shows loading state during processing
- No sensitive information exposed to user

## Performance Considerations

- **Response Time:** ~1-3 seconds (includes Foundry API latency)
- **Token Usage:** ~500-2000 tokens per request (varies by detail level)
- **Payload Size:** Request <1KB, Response <2KB (excluding answer text)
- **Concurrency:** Stateless design allows unlimited parallel requests (limited by Foundry API quota)

## Future Enhancements

Potential improvements for v2:

1. **Streaming Responses:** For long answers, stream chunks to frontend
2. **Image Support:** Accept screenshots for identification help
3. **Version Tracking:** Support multiple Minecraft versions (1.20, 1.19, etc.)
4. **Conversation Memory:** Track multi-turn conversations per session
5. **Community Recipes:** Integrate user-contributed builds and recipes
6. **Video Tutorials:** Link to relevant YouTube tutorials
7. **Mod Support:** Extended guidance for popular mods (Minecraft Forge, Fabric)
