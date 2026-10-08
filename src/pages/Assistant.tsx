import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Calendar, MapPin, Plus, Send, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { TASK_PRIORITY_OPTIONS } from '@/components/tasks/TaskFormDialog';
import { TaskFormDialog } from '@/components/tasks/TaskFormDialog';
import { aiApi } from '@/services/ai';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { cn } from '@/utils/cn';
import type { AiChatMessage, AiSuggestion, TaskPriority } from '@/types';

const NO_SELECTION = 'all';

const PRIORITY_BADGE: Record<TaskPriority, BadgeProps['variant']> = {
  low: 'info',
  medium: 'default',
  high: 'warning',
  critical: 'danger',
};

const SUGGESTED_PROMPTS = [
  'What needs attention on my farm right now?',
  'Are any tasks at risk of being late?',
  'Which inputs are running low?',
];

function priorityLabel(value: TaskPriority): string {
  return TASK_PRIORITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function Assistant() {
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [suggestionFarm, setSuggestionFarm] = useState(NO_SELECTION);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [taskDialog, setTaskDialog] = useState<{ open: boolean; title: string; priority: TaskPriority; farmId: string }>({
    open: false,
    title: '',
    priority: 'medium',
    farmId: '',
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  const statusQuery = useQuery({
    queryKey: ['ai', 'status'],
    queryFn: aiApi.status,
    retry: 0,
  });

  const farmsQuery = useQuery({
    queryKey: ['ai-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  function messageError(error: unknown): string {
    return error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  }

  async function handleSend() {
    const content = input.trim();
    if (!content || chatting) return;

    const userMessage: AiChatMessage = { role: 'user', content };
    const history = messages;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setChatting(true);
    setChatError(null);

    try {
      const result = await aiApi.chat(content, history);
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
    } catch (error) {
      setChatError(messageError(error));
    } finally {
      setChatting(false);
    }
  }

  async function handleSuggest() {
    if (suggesting) return;
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await aiApi.suggest(suggestionFarm === NO_SELECTION ? undefined : suggestionFarm);
      setSuggestions(result.suggestions);
    } catch (error) {
      setSuggestError(messageError(error));
    } finally {
      setSuggesting(false);
    }
  }

  function openTaskDialog(suggestion: AiSuggestion) {
    setTaskDialog({
      open: true,
      title: suggestion.title,
      priority: suggestion.priority,
      farmId: suggestion.farmId,
    });
  }

  const notConfigured = statusQuery.data?.configured === false;
  const farms = farmsQuery.data?.items ?? [];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">AI Assistant</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Ask about your farm, or let FarmFlow suggest what to work on next.
        </p>
      </section>

      {statusQuery.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : notConfigured ? (
        <Alert variant="warning">
          <AlertTitle>The AI assistant isn't connected yet</AlertTitle>
          <AlertDescription>
            Add an OPENAI_API_KEY to <code className="rounded bg-amber-100/70 px-1 py-0.5 text-xs">.env</code> on the
            server and restart the API. Chat and suggestions will start working automatically.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wider text-slate-400">
            <Bot className="size-4" aria-hidden />
            Ask FarmFlow
          </h3>

          <div
            ref={scrollRef}
            className="mb-3 flex h-80 flex-col gap-2 overflow-y-auto rounded-xl bg-slate-50 p-3"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                  <Bot className="size-6" aria-hidden />
                </div>
                <div className="max-w-xs space-y-1">
                  <p className="text-sm font-semibold text-slate-700">Ask me anything about your farm</p>
                  <p className="text-xs text-slate-500">
                    I can help with open tasks, low stock, deadlines and what to prioritise.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setInput(prompt)}
                      className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-800 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                    message.role === 'user'
                      ? 'self-end rounded-br-md bg-brand-600 text-white'
                      : 'self-start rounded-bl-md bg-white text-slate-800 shadow-sm ring-1 ring-slate-200',
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
              ))
            )}

            {chatting ? (
              <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-md bg-white px-3 py-2 shadow-sm ring-1 ring-slate-200">
                {[0, 1, 2].map((dot) => (
                  <span
                    key={dot}
                    className="size-1.5 animate-pulse rounded-full bg-slate-400"
                    style={{ animationDelay: `${dot * 150}ms` }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {chatError ? (
            <Alert variant="danger" className="mb-3">
              <AlertDescription>{chatError}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={(event) => { event.preventDefault(); void handleSend(); }} className="flex items-center gap-2">
            <Input
              aria-label="Message the assistant"
              placeholder="Ask about your farm…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void handleSend();
                }
              }}
            />
            <Button type="submit" disabled={!input.trim() || chatting} loading={chatting} aria-label="Send message">
              <Send className="size-4" aria-hidden />
            </Button>
          </form>
        </section>

        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-400">
              <Sparkles className="size-4" aria-hidden />
              Suggested tasks
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-44">
                <Select value={suggestionFarm} onValueChange={setSuggestionFarm} disabled={farms.length === 0}>
                  <SelectTrigger aria-label="Filter by farm">
                    <SelectValue placeholder="All farms" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_SELECTION}>All farms</SelectItem>
                    {farms.map((farm) => (
                      <SelectItem key={farm.id} value={farm.id}>
                        {farm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void handleSuggest()} loading={suggesting}>
                <Sparkles className="size-4" aria-hidden />
                Generate
              </Button>
            </div>
          </div>

          {suggestError ? (
            <Alert variant="danger" className="mb-3">
              <AlertDescription>{suggestError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex-1 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3">
            {suggestions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <p className="text-sm font-semibold text-slate-700">Plan your next move</p>
                <p className="max-w-xs text-xs text-slate-500">
                  Generate 3-6 concrete tasks based on your open work, low stock and the weather.
                </p>
              </div>
            ) : (
              suggestions.map((suggestion, index) => (
                <div
                  key={`${suggestion.farmId}-${index}`}
                  className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{suggestion.title}</p>
                    <Badge variant={PRIORITY_BADGE[suggestion.priority]} className="shrink-0">
                      {priorityLabel(suggestion.priority)}
                    </Badge>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="size-3" aria-hidden />
                    {suggestion.farmName}
                  </p>
                  {suggestion.rationale ? (
                    <p className="mt-1.5 text-xs text-slate-600">{suggestion.rationale}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    {suggestion.deadlineAt ? (
                      <p className="flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="size-3" aria-hidden />
                        {new Date(suggestion.deadlineAt).toLocaleDateString()}
                      </p>
                    ) : (
                      <span aria-hidden />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTaskDialog(suggestion)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      Add task
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <TaskFormDialog
        open={taskDialog.open}
        onOpenChange={(open) => {
          setTaskDialog((current) => ({ ...current, open }));
          if (!open) {
            void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
            void queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }
        }}
        defaultFarmId={taskDialog.farmId || undefined}
        defaultTitle={taskDialog.title}
        defaultPriority={taskDialog.priority}
      />
    </div>
  );
}