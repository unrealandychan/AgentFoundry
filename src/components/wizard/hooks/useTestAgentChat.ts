import { useState, useCallback, useRef } from "react";
import type { AgentDefinition, ChatMessage } from "../utils/chatUtils";

interface UseTestAgentChatProps {
  agentDefs: AgentDefinition[];
  systemPrompt: string;
  sessionId: string;
  model: string;
  collaborate: boolean;
  rounds: number;
  reflective: boolean;
}

interface UseTestAgentChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  thinkingAgent: string | null;
  error: string | null;
  input: string;
  setInput: (value: string) => void;
  workspaceFiles: string[];
  uploading: boolean;
  uploadError: string | null;
  totalCharsIn: number;
  totalCharsOut: number;
  bottomRef: React.RefObject<HTMLDivElement>;
  sendMessage: () => Promise<void>;
  uploadFiles: (files: FileList | null) => Promise<void>;
  clearHistory: () => void;
}

export function useTestAgentChat({
  agentDefs,
  sessionId,
  model,
  collaborate,
  rounds,
  reflective,
}: UseTestAgentChatProps): UseTestAgentChatReturn {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [thinkingAgent, setThinkingAgent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [totalCharsIn, setTotalCharsIn] = useState(0);
  const [totalCharsOut, setTotalCharsOut] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setUploadError(null);
      const uploaded: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("sessionId", sessionId);
        formData.append("file", file);
        try {
          const res = await fetch("/api/workspace/upload", { method: "POST", body: formData });
          if (res.ok) {
            const data = (await res.json()) as { name: string };
            uploaded.push(data.name);
          } else {
            const data = (await res.json()) as { error?: string };
            setUploadError(data.error ?? "Upload failed");
          }
        } catch {
          setUploadError("Upload failed — check the file type and size (max 2 MB).");
        }
      }
      if (uploaded.length > 0) {
        setWorkspaceFiles((previous) => {
          const seen = new Set(previous);
          return [...previous, ...uploaded.filter((n) => !seen.has(n))];
        });
      }
      setUploading(false);
    },
    [sessionId],
  );

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading || agentDefs.length === 0) return;
    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    // Capture history BEFORE adding the new user message
    const priorMessages = [...messages];
    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setLoading(true);
    setThinkingAgent(null);
    setError(null);

    // Accumulate input chars for cost estimate (system prompts + history + user message)
    const systemChars = agentDefs.reduce((acc, a) => acc + a.instructions.length, 0);
    const historyChars = priorMessages.reduce((acc, m) => acc + m.content.length, 0);
    setTotalCharsIn((c) => c + systemChars + historyChars + userMessage.content.length);

    // Seed one empty placeholder for the first responding agent
    setMessages((previous) => [
      ...previous,
      { role: "assistant", content: "", agentName: undefined },
    ]);

    try {
      const response = await fetch("/api/test-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agents: agentDefs,
          message: userMessage.content,
          history: priorMessages.map(({ role, content, agentName }) => ({
            role,
            content,
            agentName,
          })),
          model,
          sessionId,
          collaborate: collaborate && agentDefs.length > 1,
          reflective,
          rounds,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Request failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response body");

      // Each agent segment starts with a JSON header line: {"agentId":"...","agentName":"..."}\n
      // then the streamed text. In collaborate mode there are multiple such segments.
      let headerBuffer = "";
      let headerParsed = false;

      const appendToLast = (delta: string) => {
        setMessages((previous) => {
          const updated = [...previous];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: last.content + delta };
          }
          return updated;
        });
      };

      const setLastAgentName = (name: string) => {
        setThinkingAgent(name);
        setMessages((previous) => {
          const updated = [...previous];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = { ...last, agentName: name };
          }
          return updated;
        });
      };

      let done = false;
      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        const chunk = decoder.decode(value, { stream: !done });

        if (headerParsed) {
          // Check if a new agent header starts inside this chunk (collaborate mode)
          // A new header looks like: \n{"agentId":
          const newHeaderMatch = chunk.indexOf('\n{"agentId"');
          if (newHeaderMatch !== -1) {
            // Flush text before the new header into the current bubble
            const textBefore = chunk.slice(0, newHeaderMatch);
            if (textBefore) appendToLast(textBefore);

            // Start a new empty bubble for the next agent
            setMessages((previous) => [
              ...previous,
              { role: "assistant", content: "", agentName: undefined },
            ]);
            headerParsed = false;
            headerBuffer = chunk.slice(newHeaderMatch + 1); // skip the leading \n

            // Re-process the new header immediately if it contains a newline
            const innerNewline = headerBuffer.indexOf("\n");
            if (innerNewline !== -1) {
              try {
                const header = JSON.parse(headerBuffer.slice(0, innerNewline)) as {
                  agentId: string;
                  agentName: string;
                };
                setLastAgentName(header.agentName);
              } catch {
                /* treat as content */
              }
              const rest = headerBuffer.slice(innerNewline + 1);
              headerBuffer = "";
              headerParsed = true;
              if (rest) appendToLast(rest);
            }
          } else if (chunk) {
            appendToLast(chunk);
          }
        } else {
          // Accumulate until we see the newline that terminates the header JSON
          headerBuffer += chunk;
          const newlineIndex = headerBuffer.indexOf("\n");
          if (newlineIndex !== -1) {
            try {
              const header = JSON.parse(headerBuffer.slice(0, newlineIndex)) as {
                agentId: string;
                agentName: string;
              };
              setLastAgentName(header.agentName);
            } catch {
              /* treat whole buffer as content */
            }
            const rest = headerBuffer.slice(newlineIndex + 1);
            headerBuffer = "";
            headerParsed = true;
            if (rest) appendToLast(rest);
          }
        }
      }
    } catch (error_) {
      setError(error_ instanceof Error ? error_.message : "Something went wrong");
      setMessages((previous) => previous.slice(0, -1));
    } finally {
      // Accumulate output chars for cost estimate (from all assistant messages added this turn)
      setMessages((current) => {
        const outChars = current
          .filter((m) => m.role === "assistant")
          .reduce((acc, m) => acc + m.content.length, 0);
        setTotalCharsOut(outChars);
        return current;
      });
      setLoading(false);
      setThinkingAgent(null);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [input, loading, agentDefs, messages, model, sessionId, collaborate, reflective, rounds]);

  return {
    messages,
    loading,
    thinkingAgent,
    error,
    input,
    setInput,
    workspaceFiles,
    uploading,
    uploadError,
    totalCharsIn,
    totalCharsOut,
    bottomRef,
    sendMessage,
    uploadFiles,
    clearHistory,
  };
}
