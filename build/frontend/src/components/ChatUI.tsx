import React, { useState, useRef, useEffect } from "react";
import {
  ChatMessage as IChatMessage,
  PlantAssistantResult,
  MinecraftAssistantResult,
} from "../services/api";
import { apiClient } from "../services/api";

interface ChatUIProps {
  authToken: string;
}

export const ChatUI: React.FC<ChatUIProps> = ({ authToken }) => {
  const [messages, setMessages] = useState<IChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [toolNotes, setToolNotes] = useState("");
  const [toolFile, setToolFile] = useState<File | null>(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState<string | null>(null);
  const [toolResult, setToolResult] = useState<PlantAssistantResult | null>(null);
  const [minecraftQuestion, setMinecraftQuestion] = useState("");
  const [minecraftEdition, setMinecraftEdition] = useState<"java" | "bedrock" | "auto-detect">("auto-detect");
  const [minecraftDetail, setMinecraftDetail] = useState<"simple" | "normal" | "advanced">("normal");
  const [minecraftLoading, setMinecraftLoading] = useState(false);
  const [minecraftError, setMinecraftError] = useState<string | null>(null);
  const [minecraftResult, setMinecraftResult] = useState<MinecraftAssistantResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    apiClient.setAuthToken(authToken);
  }, [authToken]);
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
      const result = await apiClient.askMinecraft(minecraftQuestion, minecraftEdition, minecraftDetail);
      setMinecraftResult(result);
    } catch (err) {
      setMinecraftError(err instanceof Error ? err.message : "Minecraft assistant failed");
    } finally {
      setMinecraftLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      <div className="border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-900">Chat</h1>
        <p className="text-sm text-gray-500">Powered by Foundry</p>
      </div>

      <div className="border-b border-gray-200 bg-green-50 p-4">
        <h2 className="text-base font-semibold text-gray-900">Plant Assistant Tool</h2>
        <p className="text-sm text-gray-600 mb-3">
          Upload a plant image to get a structured diagnosis from your backend tool route.
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
            className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {toolLoading ? "Analyzing..." : "Analyze Plant"}
          </button>
        </div>

        {toolError && (
          <div className="mt-3 text-sm text-red-700 bg-red-100 px-3 py-2 rounded">
            {toolError}
          </div>
        )}

        {toolResult && (
          <div className="mt-3 text-sm bg-white border border-green-200 rounded-lg p-3">
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

      <div className="border-b border-gray-200 bg-blue-50 p-4">
        <h2 className="text-base font-semibold text-gray-900">⛏️ Minecraft Assistant Tool</h2>
        <p className="text-sm text-gray-600 mb-3">
          Ask questions about Minecraft crafting, building, redstone, commands, and survival tips.
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col md:flex-row gap-2 md:items-end">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-700 block mb-1">Edition</label>
              <select
                value={minecraftEdition}
                onChange={(e) => setMinecraftEdition(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="auto-detect">Auto-detect</option>
                <option value="java">Java Edition</option>
                <option value="bedrock">Bedrock Edition</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-700 block mb-1">Detail Level</label>
              <select
                value={minecraftDetail}
                onChange={(e) => setMinecraftDetail(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="simple">Simple (like I'm 7)</option>
                <option value="normal">Normal</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>
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
              placeholder="e.g. How do I build a piston door? What's the crafting recipe for a brewing stand?"
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

      <div className="border-t border-gray-200 p-4 bg-white">
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
