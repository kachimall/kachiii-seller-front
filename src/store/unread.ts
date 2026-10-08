"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { listConversations, MESSAGES_VIEW_PERMISSION } from "@/lib/api/messages";
import { useCan } from "@/store/auth";

interface UnreadState {
  /** Every buyer message the store has not read; null until loaded. */
  count: number | null;
  /** Bumped when a conversation changes here (a reply sent, a thread read), so lists reload. */
  version: number;
  set: (count: number) => void;
  refresh: () => Promise<void>;
  /** A conversation changed: reload the lists and the count. */
  changed: () => void;
}

/** The unread messages count in the sidebar, refreshed by the messages pages as they read. */
export const useUnread = create<UnreadState>()((set, get) => ({
  count: null,
  version: 0,
  set: (count) => set({ count }),
  changed: () => {
    set((state) => ({ version: state.version + 1 }));
    void get().refresh();
  },
  refresh: async () => {
    try {
      const { meta } = await listConversations({ per_page: 1 });
      set({ count: meta.unread_total });
    } catch {
      // A badge is not worth an error: keep the last count.
    }
  },
}));

const POLL_MS = 60_000;

/** Keeps the count fresh while the Seller Centre is open (every minute, and on focus). */
export function useUnreadPolling() {
  const can = useCan();
  const allowed = can(MESSAGES_VIEW_PERMISSION);
  useEffect(() => {
    if (!allowed) return;
    const refresh = useUnread.getState().refresh;
    void refresh();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [allowed]);
}
