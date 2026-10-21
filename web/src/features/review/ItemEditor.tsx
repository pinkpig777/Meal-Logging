import { useState } from 'react';
import type { MealItem, Portion } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { IconEdit, IconTrash } from '@/components/icons';
import { ReviewCue } from '@/components/ReviewCue';
import { cueForAttribute } from '@/components/reviewCueStatus';
import { Sheet } from '@/components/Sheet';
import { formatItemKcal, formatMacros, formatPortion } from '@/lib/format';

const SOURCE_LABEL: Record<MealItem['source'], string | null> = {
  ai: null,
  ai_clarified: 'Updated from your answer',
  user_edited: 'Edited by you',
  user_added: 'Added by you',
};

export interface ItemCardProps {
  item: MealItem;
  disabled?: boolean;
  /** Hide cues for attributes that already have a clarification card above. */
  hideAskedCues?: boolean;
  onEditPortion?: (item: MealItem) => void;
  onRemove?: (item: MealItem) => void;
}

/** M2 · Clark — one item row: name, portion, kcal (+ range), macros, review cues. */
export function ItemCard({
  item,
  disabled,
  hideAskedCues,
  onEditPortion,
  onRemove,
}: ItemCardProps) {
  const cues = item.uncertain_attributes
    .map((a) => ({ a, status: cueForAttribute(a) }))
    .filter(({ a, status }) => status && !(hideAskedCues && a.asked && a.status === 'unresolved'));
  const sourceLabel = SOURCE_LABEL[item.source];

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold">
            {item.name}
            {item.kind === 'addon' && (
              <span className="border-line text-muted ml-2 rounded-full border px-2 py-0.5 text-xs font-normal">
                Add-on
              </span>
            )}
          </h3>
          <p className="text-muted text-sm">
            {formatPortion(item.portion)}
            {item.preparation ? ` · ${item.preparation}` : ''}
          </p>
        </div>
        <p className="shrink-0 text-right font-semibold tabular-nums">
          {formatItemKcal(item.nutrition, item.kcal_range)}
        </p>
      </div>
      <p className="text-muted text-sm tabular-nums">{formatMacros(item.nutrition)}</p>
      {cues.map(({ a, status }) => (
        <ReviewCue key={a.id} attribute={a.attribute} status={status!} reason={a.reason} />
      ))}
      {sourceLabel && <p className="text-muted text-xs">{sourceLabel}</p>}
      {(onEditPortion || onRemove) && (
        <div className="flex gap-2 pt-1">
          {onEditPortion && (
            <Button variant="secondary" disabled={disabled} onClick={() => onEditPortion(item)}>
              <IconEdit className="size-4" />
              Edit portion
            </Button>
          )}
          {onRemove && (
            <Button variant="danger" disabled={disabled} onClick={() => onRemove(item)}>
              <IconTrash className="size-4" />
              Remove
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

export interface PortionEditorProps {
  item: MealItem | null;
  onClose: () => void;
  onSave: (itemId: string, portion: Portion) => void;
  saving?: boolean;
}

/**
 * Bottom-sheet portion editor. Changing quantity scales grams proportionally;
 * the server rescales nutrition by grams.
 * TODO(Clark): unit picker, quick steps (½×, 1×, 1½×, 2×), name/preparation
 * edits that offer a re-estimate (useReestimateItem in features/capture/api.ts).
 */
export function PortionEditor({ item, onClose, onSave, saving }: PortionEditorProps) {
  return (
    <Sheet open={!!item} onClose={onClose} title={item ? `Portion · ${item.name}` : 'Portion'}>
      {item && <PortionForm key={item.id} item={item} onSave={onSave} saving={saving} />}
    </Sheet>
  );
}

function PortionForm({
  item,
  onSave,
  saving,
}: {
  item: MealItem;
  onSave: PortionEditorProps['onSave'];
  saving?: boolean;
}) {
  const [qty, setQty] = useState(String(item.portion.qty));
  const [grams, setGrams] = useState(String(Math.round(item.portion.grams)));
  const gramsPerUnit = item.portion.qty > 0 ? item.portion.grams / item.portion.qty : 0;
  const q = Number(qty);
  const g = Number(grams);
  const valid = q > 0 && g > 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSave(item.id, { qty: q, unit: item.portion.unit, grams: g });
      }}
    >
      <Field
        label={`Amount (${item.portion.unit})`}
        type="number"
        inputMode="decimal"
        step="0.25"
        min="0"
        value={qty}
        onChange={(e) => {
          setQty(e.target.value);
          const nq = Number(e.target.value);
          if (gramsPerUnit && nq > 0) setGrams(String(Math.round(nq * gramsPerUnit)));
        }}
      />
      <Field
        label="Weight (g)"
        hint="Estimated. Nutrition is rescaled from the weight."
        type="number"
        inputMode="numeric"
        min="0"
        value={grams}
        onChange={(e) => setGrams(e.target.value)}
      />
      <Button type="submit" className="w-full" disabled={!valid || saving}>
        Save portion
      </Button>
    </form>
  );
}
