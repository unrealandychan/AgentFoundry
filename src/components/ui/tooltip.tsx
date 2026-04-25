"use client";

import { useState, useRef, useEffect } from "react";

interface TooltipProperties {
  /** Short label for the info subject (e.g. "Why this template?") */
  title: string;
  /** Body text explaining why the selection matters / what it generates */
  body: string;
  /** Additional CSS classes for the trigger icon */
  className?: string;
  /** Where the popup appears relative to the trigger. Default: "top" (above trigger) */
  placement?: "top" | "bottom";
}

/**
 * Inline ⓘ tooltip. No external dependencies; uses CSS-only positioning.
 * Click or focus to open; click elsewhere or press Escape to close.
 */
export function Tooltip({ title, body, className = "", placement = "top" }: TooltipProperties) {
  const [open, setOpen] = useState(false);
  const reference = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (reference.current && !reference.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  return (
    <div ref={reference} className={`relative inline-flex items-center ${className}`}>
      {/* span instead of button to avoid nested-button hydration error when used inside card buttons */}
      <span
        role="button"
        tabIndex={0}
        aria-label={`Info: ${title}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }
        }}
        className="ml-1.5 flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-indigo-300 bg-indigo-50 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:bg-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1"
      >
        ⓘ
      </span>

      {open && (
        <div
          role="tooltip"
          className={`absolute left-1/2 z-50 w-72 -translate-x-1/2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-xl ${
            placement === "bottom" ? "top-full mt-2" : "bottom-full mb-2"
          }`}
        >
          {/* Arrow */}
          <div
            className={`absolute left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 ${
              placement === "bottom" ? "-top-1.5 border-l border-t" : "-bottom-2 border-b border-r"
            }`}
          />

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
            {title}
          </p>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{body}</p>
        </div>
      )}
    </div>
  );
}
