// The store's conversations with buyers (DECISIONS MS1) and its messaging tools (MS2).
import type { IsoDate, Ulid } from "@/types/api";

export type MessageSender = "buyer" | "store";

export interface Message {
  id: Ulid;
  sender: MessageSender;
  /** "welcome" or "away" when the store's settings sent it by themselves. */
  auto_reply: "welcome" | "away" | null;
  /** null when KACHI hid it. */
  body: string | null;
  /** Portal paths of the photos (WebP); they need the bearer token. */
  photos: string[];
  hidden: boolean;
  hidden_reason: string | null;
  sent_at: IsoDate;
}

export interface Conversation {
  id: Ulid;
  /** The buyer's first name and last initial. */
  buyer: { name: string };
  last_message: Message | null;
  /** Messages the store has not read. */
  unread_count?: number;
  last_message_at: IsoDate | null;
}

/** meta of GET /vendor/conversations: every message the store has not read. */
export interface ConversationsMeta {
  current_page: number;
  per_page: number;
  has_more: boolean;
  total?: number;
  last_page?: number;
  unread_total: number;
}

/** Day 1 is Monday, 7 Sunday; "HH:MM", UAE time. */
export interface OpeningHours {
  day: number;
  opens: string;
  closes: string;
}

export interface MessageSettings {
  welcome_message: string | null;
  welcome_message_enabled: boolean;
  away_message: string | null;
  away_message_enabled: boolean;
  /** null: always open. Days left out are closed. */
  opening_hours: OpeningHours[] | null;
  quick_replies: string[];
  /** Whether a buyer writing now finds the store open (when not, the away reply answers). */
  open_now: boolean;
}

/** PATCH /vendor/message-settings: send only what changes; quick_replies is the whole list. */
export type MessageSettingsInput = Partial<Omit<MessageSettings, "open_now">>;

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_MAX_PHOTOS = 5;
export const MESSAGE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const MESSAGE_PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
export const AUTO_REPLY_MAX = 1000;
export const QUICK_REPLIES_MAX = 20;

export const WEEKDAYS: { day: number; label: string }[] = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
  { day: 6, label: "Saturday" },
  { day: 7, label: "Sunday" },
];
