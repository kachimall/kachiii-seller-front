"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  EyeOffIcon,
  ImageOffIcon,
  ImagePlusIcon,
  Loader2Icon,
  MessageSquareQuoteIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/common/states";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { useApi } from "@/hooks/use-api";
import { errorMessage } from "@/lib/api/client";
import {
  getConversation,
  getMessagePhoto,
  getMessageSettings,
  listMessages,
  markConversationRead,
  MESSAGE_SETTINGS_PERMISSION,
  MESSAGES_MANAGE_PERMISSION,
  sendMessage,
} from "@/lib/api/messages";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAuth, useCan } from "@/store/auth";
import { useUnread } from "@/store/unread";
import {
  MESSAGE_MAX_LENGTH,
  MESSAGE_MAX_PHOTOS,
  MESSAGE_PHOTO_ACCEPT,
  MESSAGE_PHOTO_MAX_BYTES,
  type Message,
} from "@/types/messages";

const PAGE = 30;
const POLL_MS = 10_000;

/** Messages newest first, as the API pages them; shown oldest first. */
interface Thread {
  messages: Message[];
  hasOlder: boolean;
}

/** Puts newer messages first, without duplicates. */
function merge(newer: Message[], older: Message[]): Message[] {
  const seen = new Set<string>();
  const out: Message[] = [];
  for (const message of [...newer, ...older]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    out.push(message);
  }
  return out.sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
}

export function ConversationThread({ id }: { id: string }) {
  const can = useCan();
  const suspended = useAuth((s) => s.user?.vendor?.status === "suspended");
  const canManage = can(MESSAGES_MANAGE_PERMISSION);
  const { data: conversation, error: conversationError, reload: reloadConversation } = useApi(`conversation:${id}`, () =>
    getConversation(id),
  );

  const [thread, setThread] = useState<Thread | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  const threadRef = useRef(thread);
  useEffect(() => {
    threadRef.current = thread;
  });

  /** Merges the newest page in; returns how many buyer messages were new. */
  const applyLatest = useCallback((page: { data: Message[]; meta: { has_more: boolean } }) => {
    const known = new Set(threadRef.current?.messages.map((m) => m.id) ?? []);
    const fresh = page.data.filter((m) => !known.has(m.id) && m.sender === "buyer").length;
    setThread((prev) =>
      prev
        ? { messages: merge(page.data, prev.messages), hasOlder: prev.hasOlder }
        : { messages: page.data, hasOlder: page.meta.has_more },
    );
    return fresh;
  }, []);

  const markRead = useCallback(async () => {
    if (!canManage) return;
    try {
      await markConversationRead(id);
      useUnread.getState().changed();
    } catch {
      // Reading is a nicety; the badge corrects itself on the next poll.
    }
  }, [id, canManage]);

  // First load, then read it: opening the conversation reads every message.
  useEffect(() => {
    let cancelled = false;
    listMessages(id, { per_page: PAGE }).then(
      (page) => {
        if (cancelled) return;
        applyLatest(page);
        void markRead();
      },
      (error: unknown) => !cancelled && setLoadError(error),
    );
    return () => {
      cancelled = true;
    };
  }, [id, applyLatest, markRead]);

  // New messages arrive without a push channel: look again every little while.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      listMessages(id, { per_page: PAGE }).then(
        (page) => {
          if (applyLatest(page) > 0) void markRead();
        },
        () => {},
      );
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [id, applyLatest, markRead]);

  // Follow the newest message unless the reader scrolled up to older ones.
  const newestId = thread?.messages[0]?.id;
  useEffect(() => {
    if (newestId && stickToBottom.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [newestId]);

  async function loadOlder() {
    const oldest = thread?.messages[thread.messages.length - 1];
    if (!oldest) return;
    setLoadingOlder(true);
    stickToBottom.current = false;
    try {
      const page = await listMessages(id, { before: oldest.id, per_page: PAGE });
      setThread((prev) => (prev ? { messages: merge(prev.messages, page.data), hasOlder: page.meta.has_more } : prev));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingOlder(false);
    }
  }

  function onSent(message: Message) {
    stickToBottom.current = true;
    setThread((prev) => (prev ? { ...prev, messages: merge([message], prev.messages) } : prev));
    useUnread.getState().changed();
  }

  if (conversationError && !conversation) return <ErrorState error={conversationError} onRetry={reloadConversation} />;
  if (loadError && !thread) return <ErrorState error={loadError} />;

  const ordered = thread ? [...thread.messages].reverse() : [];

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Link href="/messages" className="text-muted-foreground hover:text-foreground md:hidden" aria-label="Back to conversations">
          <ArrowLeftIcon className="size-5" />
        </Link>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary-fixed text-sm font-semibold text-secondary">
          {conversation?.buyer.name.charAt(0).toUpperCase() ?? "…"}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{conversation?.buyer.name ?? "…"}</span>
          <span className="block text-xs text-muted-foreground">Buyer</span>
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
      >
        {!thread ? (
          <LoadingState />
        ) : (
          <div className="grid gap-3">
            {thread.hasOlder && (
              <div className="text-center">
                <Button variant="outline" size="sm" onClick={loadOlder} disabled={loadingOlder}>
                  {loadingOlder && <Loader2Icon className="animate-spin" />}
                  Earlier messages
                </Button>
              </div>
            )}
            {ordered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No messages yet.</p>}
            {ordered.map((message) => (
              <Bubble key={message.id} conversationId={id} message={message} />
            ))}
            <div ref={bottom} />
          </div>
        )}
      </div>

      {canManage && !suspended ? (
        <Composer conversationId={id} onSent={onSent} />
      ) : (
        <p className="border-t px-4 py-3 text-sm text-muted-foreground">
          {suspended ? "Your account is suspended, so you cannot reply." : "Your account can read messages but not answer them."}
        </p>
      )}
    </>
  );
}

function Bubble({ conversationId, message }: { conversationId: string; message: Message }) {
  const mine = message.sender === "store";
  return (
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("grid max-w-[80%] gap-1", mine && "justify-items-end")}>
        <div
          className={cn(
            "grid gap-2 rounded-2xl px-3.5 py-2.5 text-sm",
            mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted",
            message.hidden && "bg-destructive/5 text-destructive ring-1 ring-destructive/20",
          )}
        >
          {message.hidden ? (
            <span className="flex items-start gap-2">
              <EyeOffIcon className="mt-0.5 size-4 shrink-0" />
              Hidden by KACHI{message.hidden_reason ? `: ${message.hidden_reason}` : "."}
            </span>
          ) : (
            <>
              {message.body && <p className="wrap-break-word whitespace-pre-line">{message.body}</p>}
              {message.photos.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {message.photos.map((_, i) => (
                    <MessagePhoto key={i} conversationId={conversationId} messageId={message.id} number={i + 1} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <span className="px-1 text-xs text-muted-foreground">
          {message.auto_reply && <>{message.auto_reply === "welcome" ? "Welcome reply" : "Away reply"} (automatic) · </>}
          {formatDateTime(message.sent_at)}
        </span>
      </div>
    </div>
  );
}

function MessagePhoto({ conversationId, messageId, number }: { conversationId: string; messageId: string; number: number }) {
  const { data: url, error } = useApi(`message-photo:${messageId}:${number}`, async () =>
    URL.createObjectURL(await getMessagePhoto(conversationId, messageId, number)),
  );
  // Revoke each object URL when it is replaced or the photo unmounts.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  const frame = "flex size-24 items-center justify-center overflow-hidden rounded-lg bg-background/40 ring-1 ring-foreground/5";
  if (error) {
    return (
      <span className={frame} title="Could not load this photo">
        <ImageOffIcon className="size-5 text-muted-foreground" />
      </span>
    );
  }
  if (!url) {
    return (
      <span className={frame}>
        <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={frame}>
      {/* eslint-disable-next-line @next/next/no-img-element -- an object URL of a private photo */}
      <img src={url} alt={`Photo ${number}`} className="size-full object-cover" />
    </a>
  );
}

interface Attached {
  file: File;
  url: string;
}

function Composer({ conversationId, onSent }: { conversationId: string; onSent: (message: Message) => void }) {
  const can = useCan();
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<Attached[]>([]);
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { data: settings } = useApi(can(MESSAGE_SETTINGS_PERMISSION) ? "message-settings" : null, getMessageSettings);
  const quickReplies = settings?.quick_replies ?? [];

  // Free the previews' object URLs when the composer goes away.
  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  });
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MESSAGE_MAX_PHOTOS - photos.length;
    const picked = Array.from(files);
    const accepted: Attached[] = [];
    for (const file of picked) {
      if (!MESSAGE_PHOTO_ACCEPT.split(",").includes(file.type)) {
        toast.error(`${file.name}: send JPG, PNG or WebP photos.`);
      } else if (file.size > MESSAGE_PHOTO_MAX_BYTES) {
        toast.error(`${file.name}: each photo can be up to 5 MB.`);
      } else if (accepted.length < room) {
        accepted.push({ file, url: URL.createObjectURL(file) });
      }
    }
    if (picked.length > room) toast.error(`Up to ${MESSAGE_MAX_PHOTOS} photos per message.`);
    setPhotos((prev) => [...prev, ...accepted]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function send() {
    const body = text.trim();
    if ((!body && photos.length === 0) || pending) return;
    setPending(true);
    try {
      const message = await sendMessage(
        conversationId,
        body || null,
        photos.map((p) => p.file),
      );
      photos.forEach((p) => URL.revokeObjectURL(p.url));
      setPhotos([]);
      setText("");
      onSent(message);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function insert(reply: string) {
    setText((prev) => (prev.trim() ? `${prev.trimEnd()}\n${reply}` : reply).slice(0, MESSAGE_MAX_LENGTH));
    textarea.current?.focus();
  }

  return (
    <form
      className="grid gap-2 border-t p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photos.map((photo, i) => (
            <span key={photo.url} className="relative size-16 overflow-hidden rounded-lg ring-1 ring-foreground/10">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview */}
              <img src={photo.url} alt={photo.file.name} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
                aria-label={`Remove ${photo.file.name}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Textarea
        ref={textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void send();
          }
        }}
        rows={2}
        maxLength={MESSAGE_MAX_LENGTH}
        placeholder="Write a reply…"
        aria-label="Reply"
        disabled={pending}
      />
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept={MESSAGE_PHOTO_ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={pending || photos.length >= MESSAGE_MAX_PHOTOS}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlusIcon /> Photos
        </Button>
        {quickReplies.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="sm" disabled={pending} />}>
              <MessageSquareQuoteIcon /> Quick replies
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-72 w-80 overflow-y-auto">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Insert a quick reply</DropdownMenuLabel>
                {quickReplies.map((reply, i) => (
                  <DropdownMenuItem key={i} onClick={() => insert(reply)}>
                    <span className="line-clamp-2">{reply}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {text.length > MESSAGE_MAX_LENGTH - 200 ? `${text.length}/${MESSAGE_MAX_LENGTH}` : "Ctrl+Enter to send"}
        </span>
        <Button type="submit" size="sm" disabled={pending || (!text.trim() && photos.length === 0)}>
          {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          Send
        </Button>
      </div>
    </form>
  );
}
