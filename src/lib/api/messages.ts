import { api, apiList, apiWithMeta, fetchBlob, type Query } from "@/lib/api/client";
import type {
  Conversation,
  ConversationsMeta,
  Message,
  MessageSettings,
  MessageSettingsInput,
} from "@/types/messages";

/** Reading conversations needs orders.view; answering and marking read, orders.manage (ConversationPolicy). */
export const MESSAGES_VIEW_PERMISSION = "orders.view";
export const MESSAGES_MANAGE_PERMISSION = "orders.manage";
/** The message settings are the store's own (StorePolicy): stores.manage. */
export const MESSAGE_SETTINGS_PERMISSION = "stores.manage";

export interface ConversationFilters extends Query {
  /** Only conversations with a message the store has not read. */
  unread?: boolean;
  page?: number;
  per_page?: number;
}

/** The store's conversations, latest message first; meta.unread_total counts every unread message. */
export const listConversations = (filters: ConversationFilters = {}) =>
  apiWithMeta<Conversation[], ConversationsMeta>("/vendor/conversations", { query: filters });

export const getConversation = (id: string) => api<Conversation>(`/vendor/conversations/${id}`);

/** Newest first; `before` (a message id) pages back to older ones. */
export const listMessages = (id: string, query: { before?: string; per_page?: number } = {}) =>
  apiList<Message>(`/vendor/conversations/${id}/messages`, query);

/** Answer the buyer: a body (up to 2,000 characters), up to 5 photos, or both. */
export function sendMessage(id: string, body: string | null, photos: File[]) {
  const form = new FormData();
  if (body) form.append("body", body);
  photos.forEach((photo) => form.append("photos[]", photo));
  return api<Message>(`/vendor/conversations/${id}/messages`, { method: "POST", body: form });
}

/** Everything in the conversation is read: its unread count drops to 0. */
export const markConversationRead = (id: string) =>
  api<Conversation>(`/vendor/conversations/${id}/read`, { method: "POST" });

/** One of a message's photos (WebP), numbered from 1, downloaded with the token. */
export const getMessagePhoto = (conversationId: string, messageId: string, number: number, signal?: AbortSignal) =>
  fetchBlob(`/vendor/conversations/${conversationId}/messages/${messageId}/photos/${number}`, signal);

export const getMessageSettings = () => api<MessageSettings>("/vendor/message-settings");

/** Send only what changes; a reply cleared (null) is switched off too. */
export const updateMessageSettings = (body: MessageSettingsInput) =>
  api<MessageSettings>("/vendor/message-settings", { method: "PATCH", body });
