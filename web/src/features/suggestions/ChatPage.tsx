import { useState } from 'react';
import type { ChatMessage } from '@/api/types';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { inputClass } from '@/components/Field';
import { Spinner } from '@/components/LoadingState';
import { useChat } from './api';

/**
 * M5 · Zach — grounded chat placeholder (scope TBD in the M5 design doc).
 * TODO(Zach): scope, references rendering (meal/date links), streaming,
 * hypothetical meals never entering history.
 */
export function ChatPage() {
  const chat = useChat();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    chat.mutate(
      { messages: next },
      { onSuccess: (res) => setMessages((m) => [...m, res.message]) },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm">
        Preview. Answers use only your confirmed meals and goals.
      </p>
      <ul className="space-y-2" aria-live="polite">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.role === 'user'
                ? 'bg-accent text-accent-fg ml-8 rounded-2xl px-3 py-2'
                : 'bg-surface mr-8 rounded-2xl px-3 py-2'
            }
          >
            <span className="sr-only">{m.role === 'user' ? 'You: ' : 'Assistant: '}</span>
            {m.content}
          </li>
        ))}
        {chat.isPending && (
          <li className="text-muted mr-8 flex items-center gap-2">
            <Spinner className="size-4" /> Thinking…
          </li>
        )}
      </ul>
      {chat.isError && <ErrorState error={chat.error} title="Message not sent" />}
      <form onSubmit={send} className="flex gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <input
          id="chat-input"
          className={inputClass}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Would a burrito fit my goals tonight?"
        />
        <Button type="submit" disabled={!draft.trim() || chat.isPending}>
          Send
        </Button>
      </form>
    </div>
  );
}
