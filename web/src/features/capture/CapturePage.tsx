import { Camera, Check, PenLine, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/ErrorState';
import { Spinner } from '@/components/LoadingState';
import { StickyActionBar } from '@/components/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api';
import { toIsoWithOffset } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAnalyzeMeal } from './api';
import { resizePhoto, uploadMealPhoto } from './photo';

/**
 * M1 · Charlie — capture flow (M1 design §3.8).
 * idle → (uploading → identifying → estimating) → review, or → error.
 */

type Stage = 'uploading' | 'identifying' | 'estimating';
const STAGE_COPY: Record<Stage, string> = {
  uploading: 'Uploading…',
  identifying: 'Identifying foods…',
  estimating: 'Estimating portions…',
};
const MAX_TEXT = 500;

type Phase =
  { kind: 'idle' } | { kind: 'working'; stage: Stage } | { kind: 'error'; error: unknown };

/** "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CapturePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const analyze = useAnalyzeMeal();

  const [mode, setMode] = useState<'photo' | 'text'>(
    params.get('mode') === 'text' ? 'text' : 'photo',
  );
  const [photo, setPhoto] = useState<{ file: File; url: string } | null>(null);
  const file = photo?.file ?? null;
  const previewUrl = photo?.url ?? null;
  const [text, setText] = useState('');
  const [backfill, setBackfill] = useState(params.get('backfill') === '1');
  const [eatenAt, setEatenAt] = useState(() => toLocalInput(new Date()));
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  /** Reuse the uploaded path on Retry so we don't upload twice. */
  const uploadedRef = useRef<{ file: File; path: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Release the preview object URL when the photo changes or the page unmounts.
  useEffect(() => (photo ? () => URL.revokeObjectURL(photo.url) : undefined), [photo]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      window.clearTimeout(timerRef.current);
    },
    [],
  );

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!f) return;
    setPhoto({ file: f, url: URL.createObjectURL(f) });
    setMode('photo');
    setPhase({ kind: 'idle' });
  }

  function clearPhoto() {
    setPhoto(null);
    uploadedRef.current = null;
  }

  const trimmed = text.trim();
  const canSubmit = mode === 'photo' ? !!file : trimmed.length > 0;

  async function submit() {
    if (!user || !canSubmit) return;
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      let photo_path: string | null = null;
      if (mode === 'photo' && file) {
        if (uploadedRef.current?.file === file) {
          photo_path = uploadedRef.current.path;
        } else {
          setPhase({ kind: 'working', stage: 'uploading' });
          const blob = await resizePhoto(file);
          if (controller.signal.aborted) return;
          photo_path = await uploadMealPhoto(blob, user.id);
          uploadedRef.current = { file, path: photo_path };
        }
      }
      if (controller.signal.aborted) return;
      setPhase({ kind: 'working', stage: 'identifying' });
      // Staged copy only; the request is a single synchronous call.
      timerRef.current = window.setTimeout(
        () =>
          setPhase((p) => (p.kind === 'working' ? { kind: 'working', stage: 'estimating' } : p)),
        3500,
      );
      const meal = await analyze.mutateAsync({
        photo_path,
        text_input: trimmed || null,
        eaten_at: backfill && eatenAt ? toIsoWithOffset(new Date(eatenAt)) : null,
        meal_type: null, // server infers from local time
        signal: controller.signal,
      });
      navigate(`/meals/${meal.id}/review`);
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase({ kind: 'error', error: normalizeUploadError(error) });
    } finally {
      window.clearTimeout(timerRef.current);
    }
  }

  function cancel() {
    // TODO(Charlie): the server may still finish and keep a draft; consider
    // cleaning it up or listing unfinished drafts in History.
    abortRef.current?.abort();
    window.clearTimeout(timerRef.current);
    setPhase({ kind: 'idle' });
  }

  function describeInstead() {
    clearPhoto();
    setMode('text');
    setPhase({ kind: 'idle' });
  }

  // ---------- Working ----------
  if (phase.kind === 'working') {
    const stages = (Object.keys(STAGE_COPY) as Stage[]).filter(
      (s) => s !== 'uploading' || mode === 'photo',
    );
    const current = stages.indexOf(phase.stage);
    return (
      <div className="space-y-6">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Your meal photo"
            className="rounded-card max-h-72 w-full object-cover"
          />
        ) : (
          <Card>
            <p className="text-muted-foreground">“{trimmed}”</p>
          </Card>
        )}
        <Card className="gap-4">
          <div role="status" aria-live="polite" className="flex items-center gap-3">
            <Spinner />
            <span className="text-heading">{STAGE_COPY[phase.stage]}</span>
          </div>
          <ol className="space-y-2" aria-label="Progress">
            {stages.map((s, i) => (
              <li
                key={s}
                className={cn(
                  'text-label flex items-center gap-2 font-normal',
                  i <= current ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-5 items-center justify-center rounded-full',
                    i < current && 'bg-primary text-primary-foreground',
                    i === current && 'border-primary border-2',
                    i > current && 'border-border border-2',
                  )}
                >
                  {i < current && <Check className="size-3" strokeWidth={3} />}
                </span>
                {STAGE_COPY[s].replace('…', '')}
                <span className="sr-only">
                  {i < current ? ' (done)' : i === current ? ' (in progress)' : ''}
                </span>
              </li>
            ))}
          </ol>
        </Card>
        <Button variant="secondary" className="w-full" onClick={cancel}>
          Cancel
        </Button>
      </div>
    );
  }

  // ---------- Error ----------
  if (phase.kind === 'error') {
    return (
      <div className="space-y-4">
        {previewUrl && (
          <img
            src={previewUrl}
            alt="Your meal photo"
            className="rounded-card max-h-56 w-full object-cover"
          />
        )}
        <Card>
          <ErrorState error={phase.error} title="We couldn't analyze this meal" onRetry={submit}>
            <Button variant="secondary" className="w-full" onClick={describeInstead}>
              <PenLine aria-hidden="true" strokeWidth={1.75} />
              Describe instead
            </Button>
          </ErrorState>
        </Card>
      </div>
    );
  }

  // ---------- Idle ----------
  const showAction = mode === 'text' || !!previewUrl;
  return (
    <div className="flex flex-col">
      <div className="space-y-6">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={onPick}
        />

        {mode === 'photo' && previewUrl ? (
          <div className="space-y-3">
            <div className="relative">
              <img
                src={previewUrl}
                alt="Your meal photo"
                className="rounded-card max-h-80 w-full object-cover"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={clearPhoto}
                className="absolute top-3 right-3 border-transparent"
                aria-label="Remove photo"
              >
                <X aria-hidden="true" strokeWidth={1.75} />
              </Button>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera aria-hidden="true" strokeWidth={1.75} />
              Retake photo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {mode === 'text' ? (
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => fileInputRef.current?.click()}
              >
                <Camera aria-hidden="true" strokeWidth={1.75} />
                Take photo instead
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-card bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/85 flex min-h-44 flex-col items-center justify-center gap-3 p-5 transition-colors duration-150"
              >
                <span className="bg-primary-foreground/15 flex size-16 items-center justify-center rounded-full">
                  <Camera className="size-8" strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="text-title">Take photo</span>
                <span className="text-label font-normal opacity-90">
                  Snap your plate; we'll estimate the rest
                </span>
              </button>
            )}
            <Button
              variant="secondary"
              className={cn('w-full', mode === 'text' && 'bg-primary-soft border-primary')}
              aria-pressed={mode === 'text'}
              onClick={() => setMode('text')}
            >
              <PenLine aria-hidden="true" strokeWidth={1.75} />
              Describe meal
            </Button>
          </div>
        )}

        {(mode === 'text' || previewUrl) && (
          <div className="space-y-2">
            <Label htmlFor="meal-text">
              {mode === 'text' ? 'What did you eat?' : 'Add details (optional)'}
            </Label>
            <Textarea
              id="meal-text"
              rows={3}
              maxLength={MAX_TEXT}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === 'text'
                  ? 'e.g. chicken burrito bowl, extra rice'
                  : 'e.g. extra rice, no cheese'
              }
            />
            <p className="text-caption text-muted-foreground text-right tabular-nums">
              {text.length}/{MAX_TEXT}
            </p>
          </div>
        )}

        <Card className="gap-3">
          <div className="min-h-touch flex items-center gap-3">
            <Checkbox
              id="backfill"
              checked={backfill}
              onCheckedChange={(v) => setBackfill(v === true)}
            />
            <Label htmlFor="backfill" className="text-body font-normal">
              Logged later? Set when you ate
            </Label>
          </div>
          {backfill ? (
            <div className="space-y-2">
              <Label htmlFor="eaten-at">When did you eat this?</Label>
              <Input
                id="eaten-at"
                type="datetime-local"
                value={eatenAt}
                max={toLocalInput(new Date())}
                onChange={(e) => setEatenAt(e.target.value)}
              />
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">Meal time: now</p>
          )}
        </Card>
      </div>

      {showAction && (
        <StickyActionBar>
          <Button className="w-full" disabled={!canSubmit} onClick={submit}>
            <Sparkles aria-hidden="true" strokeWidth={1.75} />
            Analyze meal
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}

function normalizeUploadError(error: unknown): unknown {
  if (error instanceof ApiError) return error;
  // Supabase storage / canvas errors → a user-safe ApiError.
  return new ApiError({
    status: 0,
    code: 'UPLOAD_FAILED',
    message: "We couldn't prepare or upload this photo. Try again, or describe your meal instead.",
  });
}
