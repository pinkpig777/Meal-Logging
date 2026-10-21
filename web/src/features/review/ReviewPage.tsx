import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { ClarifyAnswer, MealItem, MealPatch, Portion } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import {
  MEAL_TYPE_LABEL,
  formatDayLabel,
  formatMacros,
  formatTime,
  formatTotalsKcal,
} from '@/lib/format';
import { useConfirmMeal, useMeal, useUpdateMeal } from '@/features/meals/api';
import { useClarify, useUpdateDraft } from './api';
import { ClarificationCard } from './ClarificationCard';
import { ItemCard, PortionEditor } from './ItemEditor';

/**
 * M2 · Clark — review a draft: answer clarifications, edit portions, remove
 * items, confirm. Also used to edit a confirmed meal (PATCH /meals/{id});
 * clarifications are draft-only, so they are hidden then.
 */
export function ReviewPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const mealQuery = useMeal(id);
  const meal = mealQuery.data;
  const isDraft = meal?.status === 'draft';

  const clarify = useClarify(id);
  const updateDraft = useUpdateDraft(id);
  const updateConfirmed = useUpdateMeal(id);
  const confirm = useConfirmMeal(id);
  const update = isDraft ? updateDraft : updateConfirmed;

  const [editing, setEditing] = useState<MealItem | null>(null);
  const busy = clarify.isPending || update.isPending || confirm.isPending;
  const mutationError = clarify.error ?? update.error ?? confirm.error;

  if (mealQuery.isPending) return <LoadingState label="Loading your meal…" />;
  if (mealQuery.isError)
    return <ErrorState error={mealQuery.error} onRetry={() => mealQuery.refetch()} />;
  if (!meal) return null;

  if (meal.status === 'failed' || meal.status === 'analyzing') {
    return (
      <EmptyState
        title={meal.status === 'failed' ? 'This analysis did not finish' : 'Still analyzing'}
        description={meal.failure_reason ?? 'Try logging the meal again.'}
        action={
          <Button className="w-full" onClick={() => navigate('/log')}>
            Log again
          </Button>
        }
      />
    );
  }

  const patch = (body: MealPatch) => update.mutate(body);
  const onAnswer = (attributeId: string) => (answer: ClarifyAnswer) =>
    clarify.mutate({ attribute_id: attributeId, answer });
  const onSavePortion = (itemId: string, portion: Portion) =>
    update.mutate(
      { items: [{ op: 'update', id: itemId, portion }] },
      { onSuccess: () => setEditing(null) },
    );

  // Clarifications chosen by the policy (asked). TODO(Clark): ordering/limits.
  const asked = isDraft
    ? meal.items.flatMap((item) =>
        item.uncertain_attributes.filter((a) => a.asked).map((a) => ({ item, a })),
      )
    : [];
  const open = asked.filter(({ a }) => a.status === 'unresolved').length;

  return (
    <div className="space-y-5">
      {/* Summary */}
      <Card className="flex gap-3">
        {meal.photo_url && (
          <img
            src={meal.photo_url}
            alt="Meal photo"
            className="size-20 shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 space-y-0.5">
          <p className="text-muted text-sm">
            {MEAL_TYPE_LABEL[meal.meal_type]} · {formatDayLabel(meal.local_date)},{' '}
            {formatTime(meal.eaten_at)}
          </p>
          <p className="text-2xl font-semibold tabular-nums">{formatTotalsKcal(meal.totals)}</p>
          <p className="text-muted text-sm tabular-nums">{formatMacros(meal.totals)}</p>
          <p className="text-muted text-xs">All values are estimates.</p>
        </div>
      </Card>

      {mutationError && <ErrorState error={mutationError} title="That change didn't save" />}

      {asked.length > 0 && (
        <section className="space-y-3" aria-labelledby="questions-h">
          <h2 id="questions-h" className="text-lg font-semibold">
            A few quick questions{open > 0 ? ` (${open} left)` : ''}
          </h2>
          {asked.map(({ item, a }) => (
            <ClarificationCard
              key={a.id}
              item={item}
              attribute={a}
              disabled={busy}
              onAnswer={onAnswer(a.id)}
            />
          ))}
        </section>
      )}

      <section className="space-y-3" aria-labelledby="items-h">
        <h2 id="items-h" className="text-lg font-semibold">
          Items
        </h2>
        {meal.items.length === 0 && (
          <p className="text-muted">No items left. Add one or log the meal again.</p>
        )}
        {meal.items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            disabled={busy}
            hideAskedCues={isDraft}
            onEditPortion={setEditing}
            onRemove={(it) => patch({ items: [{ op: 'remove', id: it.id }] })}
          />
        ))}
        {/* TODO(Clark): "Add item" (useAddItem) and name/preparation edits with re-estimate. */}
      </section>

      <div
        className="border-line bg-bg/95 sticky z-20 -mx-4 border-t px-4 pt-3 pb-3 backdrop-blur"
        style={{ bottom: 'calc(var(--spacing-nav) + env(safe-area-inset-bottom))' }}
      >
        {isDraft ? (
          <>
            <Button
              size="lg"
              className="w-full"
              disabled={busy || meal.items.length === 0}
              onClick={() =>
                confirm.mutate(undefined, {
                  onSuccess: (m) => navigate(`/meals/${m.id}`, { replace: true }),
                })
              }
            >
              Confirm meal
            </Button>
            <p className="text-muted mt-1 text-center text-xs">
              {open > 0
                ? 'You can confirm now; unanswered questions keep their review cue.'
                : 'Confirming saves this record. Values remain estimates.'}
            </p>
          </>
        ) : (
          <Link
            to={`/meals/${meal.id}`}
            className="bg-accent text-accent-fg flex min-h-14 w-full items-center justify-center rounded-xl text-lg font-medium"
          >
            Done
          </Link>
        )}
      </div>

      <PortionEditor
        item={editing}
        onClose={() => setEditing(null)}
        onSave={onSavePortion}
        saving={update.isPending}
      />
    </div>
  );
}
