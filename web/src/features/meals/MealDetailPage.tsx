import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { IconEdit, IconTrash } from '@/components/icons';
import { LoadingState } from '@/components/LoadingState';
import { Sheet } from '@/components/Sheet';
import { ItemCard } from '@/features/review/ItemEditor';
import {
  MEAL_TYPE_LABEL,
  formatDayLabel,
  formatMacros,
  formatTime,
  formatTotalsKcal,
} from '@/lib/format';
import { useDeleteMeal, useDeleteMealPhoto, useMeal } from './api';

/**
 * M3 · Yi-Wei — confirmed meal: view, edit (reuses the review screen in edit
 * mode), delete meal, delete photo only.
 * TODO(Yi-Wei): meal type / time editing, provenance details, undo after delete.
 */
export function MealDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const mealQuery = useMeal(id);
  const del = useDeleteMeal(id);
  const delPhoto = useDeleteMealPhoto(id);
  const [confirming, setConfirming] = useState<'meal' | 'photo' | null>(null);

  if (mealQuery.isPending) return <LoadingState />;
  if (mealQuery.isError)
    return <ErrorState error={mealQuery.error} onRetry={() => mealQuery.refetch()} />;
  const meal = mealQuery.data;

  return (
    <div className="space-y-4">
      {meal.photo_url && (
        <img
          src={meal.photo_url}
          alt="Meal photo"
          className="max-h-72 w-full rounded-2xl object-cover"
        />
      )}
      <Card className="space-y-1">
        <p className="text-muted text-sm">
          {MEAL_TYPE_LABEL[meal.meal_type]} · {formatDayLabel(meal.local_date)},{' '}
          {formatTime(meal.eaten_at)}
          {meal.status === 'draft' && ' · Draft'}
        </p>
        <p className="text-2xl font-semibold tabular-nums">{formatTotalsKcal(meal.totals)}</p>
        <p className="text-muted text-sm tabular-nums">{formatMacros(meal.totals)}</p>
        {meal.text_input && <p className="text-sm">“{meal.text_input}”</p>}
      </Card>

      {meal.status === 'draft' && (
        <Link
          to={`/meals/${meal.id}/review`}
          className="min-h-touch bg-accent text-accent-fg flex items-center justify-center rounded-xl font-medium"
        >
          Continue review
        </Link>
      )}

      <section className="space-y-3" aria-labelledby="detail-items-h">
        <h2 id="detail-items-h" className="text-lg font-semibold">
          Items
        </h2>
        {meal.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </section>

      {(del.error || delPhoto.error) && <ErrorState error={del.error ?? delPhoto.error} />}

      <div className="grid gap-2">
        {meal.status === 'confirmed' && (
          <Link
            to={`/meals/${meal.id}/review`}
            className="min-h-touch border-line bg-surface flex items-center justify-center gap-2 rounded-xl border font-medium"
          >
            <IconEdit className="size-4" />
            Edit meal
          </Link>
        )}
        {meal.photo_url && (
          <Button variant="secondary" onClick={() => setConfirming('photo')}>
            Delete photo only
          </Button>
        )}
        <Button variant="danger" onClick={() => setConfirming('meal')}>
          <IconTrash className="size-4" />
          Delete meal
        </Button>
      </div>

      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'photo' ? 'Delete photo?' : 'Delete meal?'}
      >
        <p className="text-muted mb-4">
          {confirming === 'photo'
            ? 'The photo is removed permanently. The meal and its values stay.'
            : 'This meal and its photo are removed permanently.'}
        </p>
        <div className="grid gap-2">
          <Button
            variant="danger"
            disabled={del.isPending || delPhoto.isPending}
            onClick={() =>
              confirming === 'photo'
                ? delPhoto.mutate(undefined, { onSettled: () => setConfirming(null) })
                : del.mutate(undefined, {
                    onSuccess: () => navigate('/history', { replace: true }),
                  })
            }
          >
            Delete
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
