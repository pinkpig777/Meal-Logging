import { MessageCircle, SendHorizontal } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ChatMessage, ChatRequest, ChatResponse } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { Spinner } from '@/components/LoadingState';
import { StickyActionBar } from '@/components/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDayLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useChat } from './api';
import { recentChatMessages } from './chatHistory';

type DisplayMessage = ChatMessage & { references?: ChatResponse['references'] };
type Period = NonNullable<ChatRequest['period']>;

/** M5 read-only chat. Conversation lives in this page, not in saved meal history. */
export function ChatPage() {
  const chat = useChat();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [period, setPeriod] = useState<Period>('last_14_days');
  const [failedRequest, setFailedRequest] = useState<ChatRequest | null>(null);
  const inFlight = useRef(false);

  function request(body: ChatRequest) {
    if (inFlight.current) return;
    inFlight.current = true;
    chat.mutate(body, {
      onSuccess: (res) => {
        setMessages((m) => [...m, { ...res.message, references: res.references }]);
        setFailedRequest(null);
      },
      onError: () => setFailedRequest(body),
      onSettled: () => {
        inFlight.current = false;
      },
    });
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || inFlight.current || failedRequest) return;
    const next: DisplayMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setDraft('');
    request({ messages: recentChatMessages(next), period });
  }

  function editFailed() {
    if (!failedRequest) return;
    setDraft(failedRequest.messages.at(-1)?.content ?? '');
    setMessages((m) => m.slice(0, -1));
    setFailedRequest(null);
    chat.reset();
  }

  function resetConversation() {
    if (inFlight.current) return;
    setMessages([]);
    setDraft('');
    setFailedRequest(null);
    chat.reset();
  }

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-4">
        <p className="text-label text-muted-foreground font-normal">
          Answers use confirmed meals and goals in the selected period. Recent messages provide
          conversation context. Discussing a food does not log it. This chat clears when you leave.
        </p>
        <div className="space-y-2">
          <Label htmlFor="chat-period">Meal history period</Label>
          <select
            id="chat-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            disabled={messages.length > 0 || chat.isPending}
            className="border-input bg-background rounded-control focus-visible:ring-ring min-h-11 w-full border px-3 text-base focus-visible:ring-2 focus-visible:outline-none"
          >
            <option value="today">Today</option>
            <option value="this_week">This week so far</option>
            <option value="last_week">Last week</option>
            <option value="last_14_days">Last 14 days, including today</option>
          </select>
          {messages.length > 0 && (
            <Button variant="secondary" onClick={resetConversation} disabled={chat.isPending}>
              New conversation / change period
            </Button>
          )}
        </div>
        {messages.length === 0 && !chat.isPending && (
          <EmptyState
            icon={<MessageCircle strokeWidth={1.75} />}
            title="Ask about your meals"
            description="For example: what was my average protein intake in this period?"
          />
        )}
        <ul className="space-y-3" aria-live="polite" aria-busy={chat.isPending}>
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                'rounded-card max-w-[95%] px-4 py-3 break-words',
                m.role === 'user'
                  ? 'bg-primary-soft text-foreground rounded-br-small ml-auto'
                  : 'bg-card border-card-edge shadow-card rounded-bl-small mr-auto border',
              )}
            >
              <span className="sr-only">{m.role === 'user' ? 'You: ' : 'Assistant: '}</span>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.role === 'assistant' && m.references && (
                <div className="text-label mt-3 space-y-2 font-normal">
                  {m.references.dates.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Supporting days">
                      {m.references.dates.map((day) => (
                        <Link
                          key={day}
                          to={`/?date=${day}`}
                          className="text-primary inline-flex min-h-11 items-center underline underline-offset-2"
                        >
                          {formatDayLabel(day)}
                        </Link>
                      ))}
                    </div>
                  )}
                  {m.references.meal_ids.length > 0 && (
                    <div className="flex flex-wrap gap-2" aria-label="Supporting meals">
                      {m.references.meal_ids.map((id, index) => (
                        <Link
                          key={id}
                          to={`/meals/${id}`}
                          className="text-primary inline-flex min-h-11 items-center underline underline-offset-2"
                        >
                          View meal {index + 1}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
          {chat.isPending && (
            <li role="status" className="text-muted-foreground flex items-center gap-2">
              <Spinner className="size-4" /> Thinking…
            </li>
          )}
        </ul>
        {chat.isError && failedRequest && (
          <div className="space-y-2">
            <ErrorState error={chat.error} title="Answer unavailable" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => request(failedRequest)} disabled={chat.isPending}>
                Retry answer
              </Button>
              <Button variant="secondary" onClick={editFailed}>
                Edit question
              </Button>
            </div>
          </div>
        )}
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
            placeholder="Ask about your meals or goals"
            maxLength={4000}
            disabled={chat.isPending || failedRequest !== null}
          />
          <Button
            type="submit"
            size="icon-lg"
            disabled={!draft.trim() || chat.isPending || failedRequest !== null}
            aria-label="Send"
          >
            <SendHorizontal aria-hidden="true" strokeWidth={1.75} />
          </Button>
        </form>
      </StickyActionBar>
    </div>
  );
}
