"use client";

import { useCallback, useEffect, useState } from "react";
import type { QuickLogInput } from "@/lib/domain/schemas";

const KEY = "growth-os.quicklog.queue.v1";

function read(): QuickLogInput[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/**
 * Offline-first quick log (v2.0 U5): failed saves persist locally and replay
 * (idempotently, via clientToken + DB uniques) when connectivity returns.
 */
export function useQuickLogQueue() {
  const [queued, setQueued] = useState(0);

  const enqueue = useCallback((entry: QuickLogInput) => {
    const q = read();
    q.push(entry);
    localStorage.setItem(KEY, JSON.stringify(q));
    setQueued(q.length);
  }, []);

  const replay = useCallback(async () => {
    const q = read();
    if (q.length === 0) return;
    const remaining: QuickLogInput[] = [];
    for (const entry of q) {
      try {
        const res = await fetch("/api/log/queue-replay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(entry),
        });
        if (!res.ok && res.status !== 409) remaining.push(entry); // 409 = already applied
      } catch {
        remaining.push(entry);
      }
    }
    localStorage.setItem(KEY, JSON.stringify(remaining));
    setQueued(remaining.length);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // defer initial count + replay to a microtask so the effect itself
    // doesn't set state synchronously
    queueMicrotask(() => {
      if (!cancelled) setQueued(read().length);
      replay();
    });
    window.addEventListener("online", replay);
    return () => {
      cancelled = true;
      window.removeEventListener("online", replay);
    };
  }, [replay]);

  return { enqueue, replay, queued };
}
