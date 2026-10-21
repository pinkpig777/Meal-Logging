import { MessageCircle, SendHorizontal } from 'lucide-react';
import { useState } from 'react';
import type { ChatMessage } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Spinner } from '@/components/LoadingState';
import { StickyActionBar } from '@/components/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-4">
        <p className="text-label text-muted-foreground font-normal">
          Preview. Answers use only your confirmed meals and goals.
        </p>
        {messages.length === 0 && !chat.isPending && (
          <EmptyState
            icon={<MessageCircle strokeWidth={1.75} />}
            title="Ask about your meals"
            description="For example: how much protein did I average this week?"
          />
        )}
        <ul className="space-y-3" aria-live="polite">
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                'rounded-card max-w-[85%] px-4 py-3',
                m.role === 'user'
                  ? 'bg-primary-soft text-foreground rounded-br-small ml-auto'
                  : 'bg-card border-card-edge shadow-card rounded-bl-small mr-auto border',
              )}
            >
              <span className="sr-only">{m.role === 'user' ? 'You: ' : 'Assistant: '}</span>
              {m.content}
            </li>
          ))}
          {chat.isPending && (
            <li className="text-muted-foreground flex items-center gap-2">
              <Spinner className="size-4" /> Thinking…
            </li>
          )}
        </ul>
        {chat.isError && <ErrorState error={chat.error} title="Message not sent" />}
      </div>
      <StickyActionBar>
        <form onSubmit={send} className="flex gap-2">
          <label htmlFor="chat-input" className="sr-only">
            Message
          </label>
          <Input
            id="chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Would a burrito fit my goals tonight?"
          />
          <Button
            type="submit"
            size="icon-lg"
            disabled={!draft.trim() || chat.isPending}
            aria-label="Send"
          >
            <SendHorizontal aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </form>
      </StickyActionBar>
    </div>
  );
}
