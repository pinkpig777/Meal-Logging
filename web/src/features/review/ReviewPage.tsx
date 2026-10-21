import { CircleAlert, Check } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import type { ClarifyAnswer, MealItem, MealPatch, Portion } from '@/api/types';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MacroLine } from '@/components/MacroLine';
import { StickyActionBar } from '@/components/StickyActionBar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  MEAL_TYPE_LABEL,
  formatDayLabel,
  formatTime,
  formatTotalsKcalValue,
  hasKcalRange,
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

  if (mealQuery.isPending) return <LoadingState label="Loading your meal…" layout="detail" />;
  if (mealQuery.isError)
    return <ErrorState error={mealQuery.error} onRetry={() => mealQuery.refetch()} />;
  if (!meal) return null;

  if (meal.status === 'failed' || meal.status === 'analyzing') {
    return (
      <EmptyState
        icon={<CircleAlert strokeWidth={1.75} />}
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
    <div className="flex flex-col">
      <div className="space-y-6">
        {/* Summary */}
        <Card size="hero" className="flex-row gap-4">
          {meal.photo_url && (
            <img
              src={meal.photo_url}
              alt="Meal photo"
              className="rounded-control size-20 shrink-0 object-cover"
            />
          )}
          <div className="min-w-0 space-y-1">
            <p className="text-label text-muted-foreground font-normal">
              {MEAL_TYPE_LABEL[meal.meal_type]} · {formatDayLabel(meal.local_date)},{' '}
              {formatTime(meal.eaten_at)}
            </p>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="text-title tabular-nums">{formatTotalsKcalValue(meal.totals)}</span>
              <span className="text-label text-muted-foreground font-normal">
                kcal{hasKcalRange(meal.totals) ? ' (range)' : ''}
              </span>
            </p>
            <MacroLine nutrition={meal.totals} />
            <p className="text-caption text-muted-foreground pt-1">All values are estimates.</p>
          </div>
        </Card>

        {mutationError && (
          <Card>
            <ErrorState error={mutationError} title="That change didn't save" />
          </Card>
        )}

        {asked.length > 0 && (
          <section className="space-y-3" aria-labelledby="questions-h">
            <h2 id="questions-h" className="text-heading flex items-center gap-2">
              A few quick questions{open > 0 ? ` (${open} left)` : ''}
              {open === 0 && (
                <Check className="text-primary size-5" strokeWidth={1.75} aria-hidden="true" />
              )}
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
          <h2 id="items-h" className="text-heading">
            Items
          </h2>
          {meal.items.length === 0 && (
            <p className="text-muted-foreground">No items left. Add one or log the meal again.</p>
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
      </div>

      <StickyActionBar>
        {isDraft ? (
          <>
            <Button
              className="w-full"
              disabled={busy || meal.items.length === 0}
              onClick={() =>
                confirm.mutate(undefined, {
                  onSuccess: (m) => {
                    toast.success('Meal saved');
                    navigate(`/meals/${m.id}`, { replace: true });
                  },
                })
              }
            >
              <Check aria-hidden="true" strokeWidth={1.75} />
              Confirm meal
            </Button>
            <p className="text-caption text-muted-foreground mt-2 text-center">
              {open > 0
                ? 'You can confirm now; unanswered questions keep their review cue.'
                : 'Confirming saves this record. Values remain estimates.'}
            </p>
          </>
        ) : (
          <Button asChild className="w-full">
            <Link to={`/meals/${meal.id}`}>Done</Link>
          </Button>
        )}
      </StickyActionBar>

      <PortionEditor
        item={editing}
        onClose={() => setEditing(null)}
        onSave={onSavePortion}
        saving={update.isPending}
      />
    </div>
  );
}
