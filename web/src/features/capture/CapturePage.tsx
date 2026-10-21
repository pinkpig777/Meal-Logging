import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { inputClass } from '@/components/Field';
import { IconCamera, IconClose, IconText } from '@/components/icons';
import { Spinner } from '@/components/LoadingState';
import { ApiError } from '@/lib/api';
import { toIsoWithOffset } from '@/lib/format';
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
    return (
      <div className="flex flex-col items-center gap-6 pt-4">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Your meal photo"
            className="max-h-72 w-full rounded-2xl object-cover"
          />
        ) : (
          <Card className="text-muted w-full">“{trimmed}”</Card>
        )}
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-lg">
          <Spinner />
          <span>{STAGE_COPY[phase.stage]}</span>
        </div>
        <ol className="text-muted flex gap-2 text-xs" aria-hidden="true">
          {(Object.keys(STAGE_COPY) as Stage[])
            .filter((s) => s !== 'uploading' || mode === 'photo')
            .map((s) => (
              <li
                key={s}
                className={`h-1.5 w-10 rounded-full ${s === phase.stage ? 'bg-accent' : 'bg-line'}`}
              />
            ))}
        </ol>
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
            className="max-h-56 w-full rounded-2xl object-cover"
          />
        )}
        <ErrorState error={phase.error} title="We couldn't analyze this meal" onRetry={submit}>
          <Button variant="secondary" className="w-full" onClick={describeInstead}>
            <IconText className="size-5" />
            Describe instead
          </Button>
        </ErrorState>
      </div>
    );
  }

  // ---------- Idle ----------
  return (
    <div className="space-y-5">
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
        <div className="relative">
          <img
            src={previewUrl}
            alt="Your meal photo"
            className="max-h-80 w-full rounded-2xl object-cover"
          />
          <button
            type="button"
            onClick={clearPhoto}
            className="size-touch absolute top-2 right-2 inline-flex items-center justify-center rounded-full bg-black/55 text-white"
            aria-label="Remove photo"
          >
            <IconClose className="size-5" />
          </button>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            Retake photo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <Button
            size="lg"
            variant={mode === 'text' ? 'secondary' : 'primary'}
            className={mode === 'text' ? 'min-h-16' : 'min-h-28 flex-col text-lg'}
            onClick={() => fileInputRef.current?.click()}
          >
            <IconCamera className="size-8" />
            Take photo
          </Button>
          <Button
            size="lg"
            variant={mode === 'text' ? 'primary' : 'secondary'}
            className="min-h-16"
            aria-pressed={mode === 'text'}
            onClick={() => setMode('text')}
          >
            <IconText className="size-6" />
            Describe meal
          </Button>
        </div>
      )}

      {(mode === 'text' || previewUrl) && (
        <div className="space-y-1">
          <label htmlFor="meal-text" className="block text-sm font-medium">
            {mode === 'text' ? 'What did you eat?' : 'Add details (optional)'}
          </label>
          <textarea
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
            className={`${inputClass} py-2`}
          />
          <p className="text-muted text-right text-xs">
            {text.length}/{MAX_TEXT}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <label className="min-h-touch flex items-center gap-3">
          <input
            type="checkbox"
            className="accent-accent size-5"
            checked={backfill}
            onChange={(e) => setBackfill(e.target.checked)}
          />
          <span>Logged later? Set when you ate</span>
        </label>
        {backfill && (
          <div className="space-y-1">
            <label htmlFor="eaten-at" className="block text-sm font-medium">
              When did you eat this?
            </label>
            <input
              id="eaten-at"
              type="datetime-local"
              className={inputClass}
              value={eatenAt}
              max={toLocalInput(new Date())}
              onChange={(e) => setEatenAt(e.target.value)}
            />
          </div>
        )}
        {!backfill && <p className="text-muted text-sm">Meal time: now</p>}
      </div>

      <Button size="lg" className="w-full" disabled={!canSubmit} onClick={submit}>
        Analyze meal
      </Button>
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
