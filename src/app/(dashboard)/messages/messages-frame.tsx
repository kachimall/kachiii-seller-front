"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CameraIcon, SettingsIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { useApi } from "@/hooks/use-api";
import { listConversations, MESSAGE_SETTINGS_PERMISSION, MESSAGES_VIEW_PERMISSION } from "@/lib/api/messages";
import { cn } from "@/lib/utils";
import { useCan } from "@/store/auth";
import { useUnread } from "@/store/unread";
import type { Conversation } from "@/types/messages";

const PAGE = 20;
const POLL_MS = 20_000;

/** The conversations on the left, the open one on the right (one at a time on small screens). */
export function MessagesFrame({ children }: { children: ReactNode }) {
  const can = useCan();
  const params = useParams<{ id?: string }>();
  const selected = params.id ?? null;

  if (!can(MESSAGES_VIEW_PERMISSION)) return <ForbiddenState />;

  return (
    <>
      <PageHeader
        title="Messages"
        description="Buyers' questions to your store. Answer them here; they get an email when you reply."
        actions={
          can(MESSAGE_SETTINGS_PERMISSION) && (
            <ButtonLink href="/message-settings">
              <SettingsIcon /> Message settings
            </ButtonLink>
          )
        }
      />
      <div className="grid h-[calc(100dvh-13rem)] min-h-[28rem] overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:grid-cols-[20rem_1fr]">
        <div className={cn("min-h-0 border-r", selected ? "hidden md:flex" : "flex")}>
          <ConversationList selected={selected} />
        </div>
        <div className={cn("min-h-0 min-w-0", selected ? "flex flex-col" : "hidden md:flex md:flex-col")}>{children}</div>
      </div>
    </>
  );
}

function ConversationList({ selected }: { selected: string | null }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [pages, setPages] = useState(1);
  const [tick, setTick] = useState(0);
  const version = useUnread((s) => s.version);
  const perPage = Math.min(100, PAGE * pages);

  // New messages arrive without a push channel: look again every little while.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") setTick((t) => t + 1);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const { data, error, loading, reload } = useApi(`conversations:${unreadOnly}:${perPage}:${version}:${tick}`, () =>
    listConversations({ unread: unreadOnly || undefined, per_page: perPage }),
  );

  // Keep the sidebar badge in step with what the list shows.
  const unreadTotal = data?.meta.unread_total;
  useEffect(() => {
    if (unreadTotal !== undefined) useUnread.getState().set(unreadTotal);
  }, [unreadTotal]);

  let body: ReactNode;
  if (error && !data) body = <ErrorState error={error} onRetry={reload} />;
  else if (!data) body = <LoadingState />;
  else if (data.data.length === 0)
    body = (
      <EmptyState
        title={unreadOnly ? "All caught up" : "No messages yet"}
        description={unreadOnly ? "Every message has been read." : "When a buyer writes to your store, the conversation shows here."}
      />
    );
  else
    body = (
      <ul className={cn("divide-y transition-opacity", loading && "opacity-80")}>
        {data.data.map((conversation) => (
          <ConversationRow key={conversation.id} conversation={conversation} active={conversation.id === selected} />
        ))}
      </ul>
    );

  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex items-center gap-1 border-b p-2">
        {[false, true].map((value) => (
          <Button
            key={String(value)}
            size="sm"
            variant={unreadOnly === value ? "secondary" : "ghost"}
            onClick={() => {
              setUnreadOnly(value);
              setPages(1);
            }}
          >
            {value ? `Unread${unreadTotal ? ` (${unreadTotal})` : ""}` : "All"}
          </Button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {body}
        {data?.meta.has_more && perPage < 100 && (
          <div className="p-3 text-center">
            <Button variant="outline" size="sm" onClick={() => setPages((p) => p + 1)}>
              Show more
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({ conversation, active }: { conversation: Conversation; active: boolean }) {
  const last = conversation.last_message;
  const unread = conversation.unread_count ?? 0;
  const preview = !last
    ? "No messages"
    : last.hidden
      ? "Message hidden by KACHI"
      : last.body
        ? last.body
        : last.photos.length > 0
          ? null
          : "";

  return (
    <li>
      <Link
        href={`/messages/${conversation.id}`}
        aria-current={active ? "page" : undefined}
        className={cn("flex gap-3 px-4 py-3 transition-colors hover:bg-muted", active && "bg-primary-fixed/60 hover:bg-primary-fixed/60")}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-sm font-semibold text-secondary">
          {conversation.buyer.name.charAt(0).toUpperCase()}
        </span>
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm", unread > 0 ? "font-semibold" : "font-medium")}>{conversation.buyer.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{shortTime(conversation.last_message_at)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
              {last?.sender === "store" && "You: "}
              {preview ?? (
                <span className="inline-flex items-center gap-1">
                  <CameraIcon className="size-3.5" /> Photo
                </span>
              )}
            </span>
            {unread > 0 && (
              <span className="min-w-5 shrink-0 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground">
                {unread}
              </span>
            )}
          </span>
        </span>
      </Link>
    </li>
  );
}

const timeFormat = new Intl.DateTimeFormat("en-AE", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-AE", { day: "numeric", month: "short" });

/** Today: the time; otherwise the day. */
export function shortTime(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString() ? timeFormat.format(date) : dayFormat.format(date);
}
