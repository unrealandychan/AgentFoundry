"use client";

import { agentColor, renderMarkdown } from "./utils/chatUtils";
import type { ChatMessage } from "./utils/chatUtils";

export function ChatBubble({ message, agentIndex }: { message: ChatMessage; agentIndex: number }) {
  const isUser = message.role === "user";
  const isCoordinator = agentIndex === -1;
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      {!isUser && message.agentName && (
        <span
          className={`mb-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isCoordinator ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700" : agentColor(agentIndex)
          }`}
        >
          {message.agentName}
        </span>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-indigo-600 text-white"
            : (isCoordinator
              ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-200"
              : "bg-gray-100 dark:bg-gray-800 text-slate-800 dark:text-slate-100")
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm">{renderMarkdown(message.content)}</div>
        )}
      </div>
    </div>
  );
}
