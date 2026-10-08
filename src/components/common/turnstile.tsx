"use client";

import Script from "next/script";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Cloudflare Turnstile (bot check on sign-up and sign-in, DECISIONS R13). The backend checks the
 * token only while its secret key is set; the widget shows only while this site key is set, so
 * either side can leave it off.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

interface TurnstileApi {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme?: "light" | "dark" | "auto";
      action?: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * The token for a form, and a reset to call after each submit: Cloudflare accepts a token once,
 * so a refused submit needs a fresh one. Without a site key the token is null and nothing renders.
 */
export function useTurnstile() {
  const [token, setToken] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setNonce((n) => n + 1);
  }, []);
  return { enabled: TURNSTILE_SITE_KEY !== "", token, setToken, nonce, reset };
}

export function Turnstile({
  action,
  nonce,
  onToken,
}: {
  action?: string;
  /** Changing it resets the widget for a fresh token. */
  nonce: number;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [ready, setReady] = useState(() => typeof window !== "undefined" && Boolean(window.turnstile));
  const [failed, setFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const onTokenRef = useRef(onToken);
  useEffect(() => {
    onTokenRef.current = onToken;
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ready || !container.current || !window.turnstile) return;
    const turnstile = window.turnstile;
    widget.current = turnstile.render(container.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: resolvedTheme === "dark" ? "dark" : "light",
      action,
      callback: (token) => {
        setFailed(false);
        onTokenRef.current(token);
      },
      "expired-callback": () => onTokenRef.current(null),
      "error-callback": () => {
        setFailed(true);
        onTokenRef.current(null);
      },
    });
    return () => {
      if (widget.current) turnstile.remove(widget.current);
      widget.current = null;
    };
  }, [ready, resolvedTheme, action]);

  useEffect(() => {
    if (nonce > 0 && widget.current && window.turnstile) window.turnstile.reset(widget.current);
  }, [nonce]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="grid gap-1">
      <Script src={SCRIPT_URL} strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={container} className="min-h-[65px]" />
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          The robot check could not load. Reload the page and try again.
        </p>
      )}
    </div>
  );
}
