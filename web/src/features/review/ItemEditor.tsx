import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { MealItem, Portion } from '@/api/types';
import { BottomSheet } from '@/components/BottomSheet';
import { Field } from '@/components/Field';
import { MacroLine } from '@/components/MacroLine';
import { ProvenanceBadge } from '@/components/ProvenanceBadge';
import { ReviewCue } from '@/components/ReviewCue';
import { cueForAttribute } from '@/components/reviewCueStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatItemKcal, formatPortion } from '@/lib/format';

/** Provenance label per item source (§6.2). AI values have no badge. */
const SOURCE_LABEL: Record<MealItem['source'], string | null> = {
  ai: null,
  ai_clarified: 'Updated from your answer',
  user_edited: 'Adjusted by you',
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

/** M2 · Clark — one item: name, portion, kcal (+ range), macros, review cues, provenance. */
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
    <Card className="gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-heading flex flex-wrap items-center gap-2">
            {item.name}
            {item.kind === 'addon' && <Badge variant="secondary">Add-on</Badge>}
          </h3>
          <p className="text-label text-muted-foreground font-normal">
            {formatPortion(item.portion)}
            {item.preparation ? ` · ${item.preparation}` : ''}
          </p>
        </div>
        <p className="text-body shrink-0 text-right font-semibold tabular-nums">
          {formatItemKcal(item.nutrition, item.kcal_range)}
        </p>
      </div>
      <MacroLine nutrition={item.nutrition} />
      {cues.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {cues.map(({ a, status }) => (
            <ReviewCue key={a.id} attribute={a.attribute} status={status!} reason={a.reason} />
          ))}
        </div>
      )}
      {sourceLabel && <ProvenanceBadge label={sourceLabel} />}
      {(onEditPortion || onRemove) && (
        <div className="flex gap-2 pt-2">
          {onEditPortion && (
            <Button
              variant="secondary"
              size="sm"
              disabled={disabled}
              onClick={() => onEditPortion(item)}
            >
              <Pencil aria-hidden="true" strokeWidth={1.75} />
              Edit portion
            </Button>
          )}
          {onRemove && (
            <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onRemove(item)}>
              <Trash2 aria-hidden="true" strokeWidth={1.75} />
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
    <BottomSheet
      open={!!item}
      onClose={onClose}
      title={item ? `Portion · ${item.name}` : 'Portion'}
      description="Nutrition is rescaled from the weight."
    >
      {item && <PortionForm key={item.id} item={item} onSave={onSave} saving={saving} />}
    </BottomSheet>
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
      className="space-y-4 pb-4"
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
        hint="Estimated."
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
