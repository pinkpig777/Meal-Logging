import type { ChatMessage } from '@/api/types';

/** Match the backend's bounds while always retaining the latest user question. */
export function recentChatMessages(messages: ChatMessage[]): ChatMessage[] {
  let size = 0;
  const selected: ChatMessage[] = [];
  for (const message of messages.slice(-20).reverse()) {
    if (size + message.content.length > 20_000) break;
    selected.unshift({ role: message.role, content: message.content });
    size += message.content.length;
  }
  return selected;
}
