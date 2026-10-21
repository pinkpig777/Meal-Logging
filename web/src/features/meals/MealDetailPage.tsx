import { ImageOff, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/BottomSheet';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MacroLine } from '@/components/MacroLine';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ItemCard } from '@/features/review/ItemEditor';
import { MEAL_TYPE_LABEL, formatDayLabel, formatTime, formatTotalsKcalValue } from '@/lib/format';
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

  if (mealQuery.isPending) return <LoadingState layout="detail" />;
  if (mealQuery.isError)
    return <ErrorState error={mealQuery.error} onRetry={() => mealQuery.refetch()} />;
  const meal = mealQuery.data;

  return (
    <div className="space-y-6">
      {meal.photo_url && (
        <img
          src={meal.photo_url}
          alt="Meal photo"
          className="rounded-card max-h-72 w-full object-cover"
        />
      )}
      <Card size="hero" className="gap-1">
        <p className="text-label text-muted-foreground flex flex-wrap items-center gap-2 font-normal">
          {MEAL_TYPE_LABEL[meal.meal_type]} · {formatDayLabel(meal.local_date)},{' '}
          {formatTime(meal.eaten_at)}
          {meal.status === 'draft' && <Badge variant="secondary">Draft</Badge>}
        </p>
        <p className="flex items-baseline gap-1.5">
          <span className="text-display tabular-nums">{formatTotalsKcalValue(meal.totals)}</span>
          <span className="text-heading text-muted-foreground font-normal">kcal</span>
        </p>
        <MacroLine nutrition={meal.totals} className="text-label" />
        {meal.text_input && <p className="text-muted-foreground pt-2">“{meal.text_input}”</p>}
        <p className="text-caption text-muted-foreground pt-2">All values are estimates.</p>
      </Card>

      {meal.status === 'draft' && (
        <Button asChild className="w-full">
          <Link to={`/meals/${meal.id}/review`}>Continue review</Link>
        </Button>
      )}

      <section className="space-y-3" aria-labelledby="detail-items-h">
        <h2 id="detail-items-h" className="text-heading">
          Items
        </h2>
        {meal.items.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </section>

      {(del.error || delPhoto.error) && (
        <Card>
          <ErrorState error={del.error ?? delPhoto.error} title="Not deleted" />
        </Card>
      )}

      <div className="grid gap-3">
        {meal.status === 'confirmed' && (
          <Button asChild variant="secondary" className="w-full">
            <Link to={`/meals/${meal.id}/review`}>
              <Pencil aria-hidden="true" strokeWidth={1.75} />
              Edit meal
            </Link>
          </Button>
        )}
        {meal.photo_url && (
          <Button variant="ghost" className="w-full" onClick={() => setConfirming('photo')}>
            <ImageOff aria-hidden="true" strokeWidth={1.75} />
            Delete photo only
          </Button>
        )}
        <Button variant="destructive" className="w-full" onClick={() => setConfirming('meal')}>
          <Trash2 aria-hidden="true" strokeWidth={1.75} />
          Delete meal
        </Button>
      </div>

      <BottomSheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'photo' ? 'Delete photo?' : 'Delete meal?'}
        description={
          confirming === 'photo'
            ? 'The photo is removed permanently. The meal and its values stay.'
            : 'This meal and its photo are removed permanently.'
        }
        footer={
          <>
            <Button
              variant="destructive"
              className="w-full"
              disabled={del.isPending || delPhoto.isPending}
              onClick={() =>
                confirming === 'photo'
                  ? delPhoto.mutate(undefined, {
                      onSuccess: () => toast.success('Photo deleted'),
                      onSettled: () => setConfirming(null),
                    })
                  : del.mutate(undefined, {
                      onSuccess: () => {
                        toast.success('Meal deleted');
                        navigate('/history', { replace: true });
                      },
                    })
              }
            >
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
              Delete
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}
