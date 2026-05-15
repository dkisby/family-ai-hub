import React, { useState, useRef, useEffect } from "react";
import {
  ChatMessage as IChatMessage,
  PlantAssistantResult,
  MinecraftAssistantResult,
  MinecraftLocation,
  NearestLocation,
  ExploreSuggestion,
  LocationCategory,
  Dimension,
} from "../services/api";
import { apiClient } from "../services/api";

interface ChatUIProps {
  authToken: string;
  preferenceKey: string;
}

type ToolTab = "plant" | "minecraft" | "locations";

export const ChatUI: React.FC<ChatUIProps> = ({ authToken, preferenceKey }) => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [toolNotes, setToolNotes] = useState("");
  const [toolFile, setToolFile] = useState<File | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<PlantAssistantResult | null>(null);
  const [minecraftQuestion, setMinecraftQuestion] = useState("");
  const [preferredEdition, setPreferredEdition] = useState<"java" | "bedrock">("bedrock");
  const [editionMode, setEditionMode] = useState<"preferred" | "auto-detect">("preferred");
  const [minecraftLoading, setMinecraftLoading] = useState(false);
  const [minecraftError, setMinecraftError] = useState<string | null>(null);
  const [minecraftResult, setMinecraftResult] = useState<MinecraftAssistantResult | null>(null);
  const [activeToolTab, setActiveToolTab] = useState<ToolTab>("plant");

  // Locations state
  const [locWorldId, setLocWorldId] = useState("");
  const [locName, setLocName] = useState("");
  const [locCategory, setLocCategory] = useState<LocationCategory>("shelter");
  const [locX, setLocX] = useState("");
  const [locY, setLocY] = useState("");
  const [locZ, setLocZ] = useState("");
  const [locDimension, setLocDimension] = useState<Dimension>("overworld");
  const [locComment, setLocComment] = useState("");
  const [locSaveLoading, setLocSaveLoading] = useState(false);
  const [locSaveError, setLocSaveError] = useState<string | null>(null);
  const [locSaveSuccess, setLocSaveSuccess] = useState<MinecraftLocation | null>(null);

  const [locListWorldId, setLocListWorldId] = useState("");
  const [locListLoading, setLocListLoading] = useState(false);
  const [locListError, setLocListError] = useState<string | null>(null);
  const [locList, setLocList] = useState<MinecraftLocation[] | null>(null);

  const [locNearestWorldId, setLocNearestWorldId] = useState("");
  const [locNearestX, setLocNearestX] = useState("");
  const [locNearestZ, setLocNearestZ] = useState("");
  const [locNearestShelterOnly, setLocNearestShelterOnly] = useState(true);
  const [locNearestLoading, setLocNearestLoading] = useState(false);
  const [locNearestError, setLocNearestError] = useState<string | null>(null);
  const [locNearest, setLocNearest] = useState<NearestLocation | null>(null);

  const [locExploreWorldId, setLocExploreWorldId] = useState("");
  const [locExploreLoading, setLocExploreLoading] = useState(false);
  const [locExploreError, setLocExploreError] = useState<string | null>(null);
  const [locSuggestions, setLocSuggestions] = useState<ExploreSuggestion[] | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    apiClient.setAuthToken(authToken);
  }, [authToken]);

  useEffect(() => {
    const key = `familyHub.minecraft.preferredEdition.${preferenceKey}`;
    const saved = window.localStorage.getItem(key);
    if (saved === "java" || saved === "bedrock") {
      setPreferredEdition(saved);
    }
  }, [preferenceKey]);

  useEffect(() => {
    const key = `familyHub.minecraft.preferredEdition.${preferenceKey}`;
    window.localStorage.setItem(key, preferredEdition);
  }, [preferenceKey, preferredEdition]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || loading) {
      return;
    }
    const userMessage: IChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const assistantMessage: IChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      let fullResponse = "";
      await apiClient.streamChatMessage(
        {
          messages: [...messages, userMessage],
          systemPrompt:
            "You are a helpful AI assistant. You have access to tools to help users.",
        },
        (chunk) => {
          fullResponse += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1].content = fullResponse;
            return updated;
          });
        }
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      setMessages((prev) => prev.slice(0, -1)); // Remove incomplete assistant message
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as unknown as React.FormEvent);
    }
  };

  const fileToDataUrl = async (file: File): Promise<string> => {
    const original = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not decode image"));
      image.src = original;
    });

    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not process image");
    }

    ctx.drawImage(img, 0, 0, width, height);

    // Start with high quality and reduce until payload is reasonably small.
    let quality = 0.9;
    let output = canvas.toDataURL("image/jpeg", quality);
    while (output.length > 6_500_000 && quality > 0.45) {
      quality -= 0.1;
      output = canvas.toDataURL("image/jpeg", quality);
    }

    return output;
  };

  const handleAnalyzePlant = async () => {
    if (!toolFile || toolLoading) {
      return;
    }

    setToolLoading(true);
    setToolError(null);
    setToolResult(null);

    try {
      const dataUrl = await fileToDataUrl(toolFile);
      const result = await apiClient.analyzePlantImage(dataUrl, toolNotes);
      setToolResult(result);
    } catch (err) {
      setToolError(err instanceof Error ? err.message : "Plant analysis failed");
    } finally {
      setToolLoading(false);
    }
  };

  const handleAskMinecraft = async () => {
    if (!minecraftQuestion.trim() || minecraftLoading) {
      return;
    }

    setMinecraftLoading(true);
    setMinecraftError(null);
    setMinecraftResult(null);

    try {
      const edition = editionMode === "preferred" ? preferredEdition : "auto-detect";
      const result = await apiClient.askMinecraft(minecraftQuestion, edition);
      setMinecraftResult(result);
    } catch (err) {
      setMinecraftError(err instanceof Error ? err.message : "Minecraft assistant failed");
    } finally {
      setMinecraftLoading(false);
    }
  };

  // ── Location handlers ─────────────────────────────────────────────────────

  const handleSaveLocation = async () => {
    setLocSaveLoading(true);
    setLocSaveError(null);
    setLocSaveSuccess(null);
    try {
      const location = await apiClient.saveLocation({
        world_id: locWorldId.trim(),
        name: locName.trim() || undefined,
        category: locCategory,
        x: parseInt(locX, 10),
        y: parseInt(locY, 10),
        z: parseInt(locZ, 10),
        dimension: locDimension,
        comment: locComment.trim(),
      });
      setLocSaveSuccess(location);
      setLocName("");
      setLocX("");
      setLocY("");
      setLocZ("");
      setLocComment("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save location";
      setLocSaveError(msg);
    } finally {
      setLocSaveLoading(false);
    }
  };

  const handleListLocations = async () => {
    setLocListLoading(true);
    setLocListError(null);
    setLocList(null);
    try {
      const list = await apiClient.listLocations(locListWorldId.trim());
      setLocList(list);
    } catch (err) {
      setLocListError(err instanceof Error ? err.message : "Failed to list locations");
    } finally {
      setLocListLoading(false);
    }
  };

  const handleFindNearest = async () => {
    setLocNearestLoading(true);
    setLocNearestError(null);
    setLocNearest(null);
    try {
      const result = await apiClient.findNearest(
        locNearestWorldId.trim(),
        parseInt(locNearestX, 10),
        parseInt(locNearestZ, 10),
        locNearestShelterOnly
      );
      setLocNearest(result);
    } catch (err) {
      setLocNearestError(err instanceof Error ? err.message : "Failed to find nearest location");
    } finally {
      setLocNearestLoading(false);
    }
  };

  const handleExploreSuggestions = async () => {
    setLocExploreLoading(true);
    setLocExploreError(null);
    setLocSuggestions(null);
    try {
      const suggestions = await apiClient.getExploreSuggestions(locExploreWorldId.trim());
      setLocSuggestions(suggestions);
    } catch (err) {
      setLocExploreError(err instanceof Error ? err.message : "Failed to get suggestions");
    } finally {
      setLocExploreLoading(false);
    }
  };

  const handleDeleteLocation = async (id: string, worldId: string) => {
    try {
      await apiClient.deleteLocation(id, worldId);
      setLocList((prev) => prev ? prev.filter((l) => l.id !== id) : prev);
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50/80 backdrop-blur-sm">
      <div className="border-b border-gray-200/80 bg-white/85 p-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <p className="text-sm text-gray-500">Powered by Foundry</p>
      </div>

      <div className="border-b border-gray-200/80 bg-white/80 p-3">
        <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-slate-50/90 p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Tools</h2>
            <span className="text-xs text-slate-500">Open one tool at a time</span>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveToolTab("plant")}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeToolTab === "plant"
                  ? "bg-emerald-700 text-white"
                  : "bg-white text-slate-700 hover:bg-emerald-100"
              }`}
            >
              Plant Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveToolTab("minecraft")}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeToolTab === "minecraft"
                  ? "bg-blue-700 text-white"
                  : "bg-white text-slate-700 hover:bg-blue-100"
              }`}
            >
              Minecraft Assistant
            </button>
            <button
              type="button"
              onClick={() => setActiveToolTab("locations")}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeToolTab === "locations"
                  ? "bg-amber-700 text-white"
                  : "bg-white text-slate-700 hover:bg-amber-100"
              }`}
            >
              MC GPS
            </button>
          </div>

          {activeToolTab === "plant" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm text-slate-700 mb-2">
                Upload one plant photo for quick diagnosis.
              </p>
              <div className="flex flex-col md:flex-row gap-2 md:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setToolFile(e.target.files?.[0] ?? null)}
                  className="text-sm"
                />
                <input
                  type="text"
                  value={toolNotes}
                  onChange={(e) => setToolNotes(e.target.value)}
                  placeholder="Optional notes (e.g. yellow leaves for 3 days)"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button
                  type="button"
                  onClick={handleAnalyzePlant}
                  disabled={!toolFile || toolLoading}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {toolLoading ? "Analyzing..." : "Analyze"}
                </button>
              </div>

              {toolError && (
                <div className="mt-3 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">
                  {toolError}
                </div>
              )}

              {toolResult && (
                <div className="mt-3 text-sm bg-white border border-emerald-200 rounded-lg p-3">
                  <p><span className="font-semibold">Summary:</span> {toolResult.summary}</p>
                  <p><span className="font-semibold">Likely issue:</span> {toolResult.likelyIssue}</p>
                  <p><span className="font-semibold">Confidence:</span> {Math.round(toolResult.confidence * 100)}%</p>
                  <p className="font-semibold mt-2">Actions:</p>
                  <ul className="list-disc ml-5">
                    {toolResult.actions.map((action, idx) => (
                      <li key={`${action}-${idx}`}>{action}</li>
                    ))}
                  </ul>
                  {toolResult.warningFlags.length > 0 && (
                    <>
                      <p className="font-semibold mt-2">Warning flags:</p>
                      <ul className="list-disc ml-5 text-amber-700">
                        {toolResult.warningFlags.map((flag, idx) => (
                          <li key={`${flag}-${idx}`}>{flag}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {activeToolTab === "minecraft" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm text-slate-700 mb-2">
                Ask about crafting, redstone, builds, commands, and survival tips.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-2 md:items-end">
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Your preferred edition</label>
                    <select
                      value={preferredEdition}
                      onChange={(e) =>
                        setPreferredEdition(e.target.value as "java" | "bedrock")
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="java">Java Edition</option>
                      <option value="bedrock">Bedrock Edition</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Answer mode</label>
                    <select
                      value={editionMode}
                      onChange={(e) =>
                        setEditionMode(e.target.value as "preferred" | "auto-detect")
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="preferred">Use my preferred edition</option>
                      <option value="auto-detect">Auto-detect from question</option>
                    </select>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Auto-detect checks your question for Java/Bedrock clues. If unclear, it gives safe guidance for both editions.
                </p>
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <input
                    type="text"
                    value={minecraftQuestion}
                    onChange={(e) => setMinecraftQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !minecraftLoading) {
                        handleAskMinecraft();
                      }
                    }}
                    placeholder="e.g. How do I build a piston door?"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAskMinecraft}
                    disabled={!minecraftQuestion.trim() || minecraftLoading}
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {minecraftLoading ? "Thinking..." : "Ask"}
                  </button>
                </div>
              </div>

              {minecraftError && (
                <div className="mt-3 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">
                  {minecraftError}
                </div>
              )}

              {minecraftResult && (
                <div className="mt-3 text-sm bg-white border border-blue-200 rounded-lg p-3 space-y-2">
                  <div>
                    <p className="font-semibold text-gray-900">Answer:</p>
                    <p className="text-gray-800">{minecraftResult.answer}</p>
                  </div>
                  {minecraftResult.steps.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-900">Steps:</p>
                      <ol className="list-decimal ml-5 text-gray-800 space-y-1">
                        {minecraftResult.steps.map((step, idx) => (
                          <li key={`${step}-${idx}`}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {minecraftResult.materials.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-900">Materials:</p>
                      <ul className="list-disc ml-5 text-gray-800">
                        {minecraftResult.materials.map((material, idx) => (
                          <li key={`${material}-${idx}`}>{material}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {minecraftResult.commands.length > 0 && (
                    <div>
                      <p className="font-semibold text-gray-900">Commands:</p>
                      <ul className="list-disc ml-5 text-gray-700 bg-gray-900 text-green-400 p-2 rounded font-mono text-xs">
                        {minecraftResult.commands.map((command, idx) => (
                          <li key={`${command}-${idx}`}>{command}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {minecraftResult.notes && (
                    <div>
                      <p className="font-semibold text-gray-900">Notes:</p>
                      <p className="text-gray-700 italic">{minecraftResult.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeToolTab === "locations" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-4">
              <p className="text-sm text-slate-700">
                Save and retrieve Minecraft coordinates across multiple worlds.
              </p>

              {/* ── Save location ── */}
              <details className="group" open>
                <summary className="cursor-pointer text-sm font-semibold text-amber-800 select-none">
                  Save a Location
                </summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={locWorldId}
                    onChange={(e) => setLocWorldId(e.target.value)}
                    placeholder="World ID (e.g. world1)"
                    className="col-span-2 md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={locName}
                    onChange={(e) => setLocName(e.target.value)}
                    placeholder="Name (optional)"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <select
                    value={locCategory}
                    onChange={(e) => setLocCategory(e.target.value as LocationCategory)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="shelter">Shelter</option>
                    <option value="bed">Bed</option>
                    <option value="house">House</option>
                    <option value="village">Village</option>
                    <option value="cave">Cave</option>
                    <option value="poi">POI</option>
                    <option value="noi">NOI (Nothing of Interest)</option>
                  </select>
                  <select
                    value={locDimension}
                    onChange={(e) => setLocDimension(e.target.value as Dimension)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    <option value="overworld">Overworld</option>
                    <option value="nether">Nether</option>
                    <option value="end">End</option>
                  </select>
                  <input
                    type="number"
                    value={locX}
                    onChange={(e) => setLocX(e.target.value)}
                    placeholder="X"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={locY}
                    onChange={(e) => setLocY(e.target.value)}
                    placeholder="Y"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={locZ}
                    onChange={(e) => setLocZ(e.target.value)}
                    placeholder="Z"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    value={locComment}
                    onChange={(e) => setLocComment(e.target.value)}
                    placeholder="Comment (required)"
                    className="col-span-2 md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLocation}
                    disabled={locSaveLoading || !locWorldId.trim() || !locX || !locY || !locZ || !locComment.trim()}
                    className="col-span-2 md:col-span-3 px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {locSaveLoading ? "Saving..." : "Save Location"}
                  </button>
                </div>
                {locSaveError && (
                  <div className="mt-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">{locSaveError}</div>
                )}
                {locSaveSuccess && (
                  <div className="mt-2 text-sm text-green-800 bg-green-100 px-3 py-2 rounded">
                    Saved: <strong>{locSaveSuccess.name ?? "Unnamed"}</strong> ({locSaveSuccess.category}) at ({locSaveSuccess.x}, {locSaveSuccess.y}, {locSaveSuccess.z})
                  </div>
                )}
              </details>

              {/* ── List locations ── */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-amber-800 select-none">
                  List All Locations
                </summary>
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="text"
                    value={locListWorldId}
                    onChange={(e) => setLocListWorldId(e.target.value)}
                    placeholder="World ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleListLocations}
                    disabled={locListLoading || !locListWorldId.trim()}
                    className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {locListLoading ? "Loading..." : "List"}
                  </button>
                </div>
                {locListError && (
                  <div className="mt-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">{locListError}</div>
                )}
                {locList && (
                  <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
                    {locList.length === 0 ? (
                      <p className="text-sm text-slate-500">No locations saved for this world.</p>
                    ) : (
                      locList.map((loc) => (
                        <div key={loc.id} className="flex items-start justify-between gap-2 bg-white border border-amber-200 rounded px-3 py-2 text-xs">
                          <div>
                            <span className="font-semibold">{loc.name ?? "Unnamed"}</span>
                            <span className="ml-2 text-amber-700 capitalize">[{loc.category}]</span>
                            <span className="ml-2 text-slate-500">{loc.dimension}</span>
                            <span className="ml-2 font-mono">({loc.x}, {loc.y}, {loc.z})</span>
                            <p className="text-slate-600 mt-0.5">{loc.comment}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteLocation(loc.id, loc.world_id)}
                            className="text-red-500 hover:text-red-700 shrink-0 text-xs"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </details>

              {/* ── Nearest shelter ── */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-amber-800 select-none">
                  Find Nearest Location
                </summary>
                <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={locNearestWorldId}
                    onChange={(e) => setLocNearestWorldId(e.target.value)}
                    placeholder="World ID"
                    className="col-span-2 md:col-span-4 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={locNearestX}
                    onChange={(e) => setLocNearestX(e.target.value)}
                    placeholder="Your X"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <input
                    type="number"
                    value={locNearestZ}
                    onChange={(e) => setLocNearestZ(e.target.value)}
                    placeholder="Your Z"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      id="shelterOnly"
                      type="checkbox"
                      checked={locNearestShelterOnly}
                      onChange={(e) => setLocNearestShelterOnly(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="shelterOnly" className="text-xs text-slate-700">Shelter only</label>
                  </div>
                  <button
                    type="button"
                    onClick={handleFindNearest}
                    disabled={locNearestLoading || !locNearestWorldId.trim() || !locNearestX || !locNearestZ}
                    className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {locNearestLoading ? "Searching..." : "Find"}
                  </button>
                </div>
                {locNearestError && (
                  <div className="mt-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">{locNearestError}</div>
                )}
                {locNearest && (
                  <div className="mt-2 bg-white border border-amber-200 rounded px-3 py-2 text-sm">
                    <p className="font-semibold">{locNearest.name ?? "Unnamed"} <span className="text-amber-700 capitalize">[{locNearest.category}]</span></p>
                    <p className="font-mono text-xs">({locNearest.x}, {locNearest.y}, {locNearest.z}) — {locNearest.dimension}</p>
                    <p className="text-slate-600 text-xs mt-1">{locNearest.comment}</p>
                    <p className="text-xs text-slate-500 mt-1">Distance: <strong>{Math.round(locNearest.distance)} blocks</strong></p>
                  </div>
                )}
              </details>

              {/* ── Explore suggestions ── */}
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-amber-800 select-none">
                  Where Should I Explore?
                </summary>
                <div className="mt-2 flex gap-2 items-center">
                  <input
                    type="text"
                    value={locExploreWorldId}
                    onChange={(e) => setLocExploreWorldId(e.target.value)}
                    placeholder="World ID"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleExploreSuggestions}
                    disabled={locExploreLoading || !locExploreWorldId.trim()}
                    className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {locExploreLoading ? "Thinking..." : "Suggest"}
                  </button>
                </div>
                {locExploreError && (
                  <div className="mt-2 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">{locExploreError}</div>
                )}
                {locSuggestions && (
                  <div className="mt-2 space-y-2">
                    {locSuggestions.map((s, idx) => (
                      <div key={idx} className="bg-white border border-amber-200 rounded px-3 py-2 text-sm">
                        <p className="font-semibold capitalize">{s.direction}</p>
                        <p className="text-slate-700">{s.reason}</p>
                        <p className="font-mono text-xs text-slate-500 mt-1">Try: X={s.suggestedX}, Z={s.suggestedZ}</p>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-500">Ask me anything!</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-100 text-gray-900 rounded-bl-none"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">
                {message.content}
              </p>

              {message.toolCalls && message.toolCalls.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  {message.toolCalls.map((tool) => (
                    <div key={tool.id} className="text-xs mt-1">
                      <span className="font-semibold">🔧 {tool.name}:</span>
                      <pre className="bg-gray-800 text-green-400 p-1 rounded mt-1 overflow-x-auto text-xs">
                        {JSON.stringify(tool.result || tool.input, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs opacity-70 mt-1">
                {new Date(message.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg rounded-bl-none">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg text-sm">
              ❌ {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-200/80 p-4 bg-white/90">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message... (Shift+Enter for new line)"
            disabled={loading}
            rows={1}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};
