import { useState } from 'react';
import type { GoalCreate, GoalsResponse } from '@/api/types';
import { Button } from '@/components/Button';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { LoadingState } from '@/components/LoadingState';
import { formatDayLabel, toLocalDateString } from '@/lib/format';
import { useCreateGoal, useGoals } from './api';

/**
 * M3 · Yi-Wei — goals form (POST /goals; goals are versioned by effective date).
 * Rendered as a section of SettingsPage; also exported as a standalone page.
 * TODO(Yi-Wei): goal history list, macro ↔ kcal consistency hint, presets.
 */
export function GoalsSection() {
  const goals = useGoals();
  if (goals.isPending) return <LoadingState label="Loading goals…" />;
  if (goals.isError) return <ErrorState error={goals.error} onRetry={() => goals.refetch()} />;
  // Remount the form when the current goal changes so it starts from the latest values.
  return <GoalsForm key={goals.data.current?.id ?? 'none'} data={goals.data} />;
}

function GoalsForm({ data }: { data: GoalsResponse }) {
  const create = useCreateGoal();
  const cur = data.current;
  const [form, setForm] = useState({
    kcal: cur ? String(Math.round(cur.kcal)) : '',
    protein_g: cur ? String(Math.round(cur.protein_g)) : '',
    carbs_g: cur ? String(Math.round(cur.carbs_g)) : '',
    fat_g: cur ? String(Math.round(cur.fat_g)) : '',
    effective_from: toLocalDateString(new Date()),
  });
  const [saved, setSaved] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  const nums = [form.kcal, form.protein_g, form.carbs_g, form.fat_g].map(Number);
  const valid = nums.every((v) => Number.isFinite(v) && v >= 0) && nums[0] > 0;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const body: GoalCreate = {
          kcal: nums[0],
          protein_g: nums[1],
          carbs_g: nums[2],
          fat_g: nums[3],
          effective_from: form.effective_from || undefined,
        };
        create.mutate(body, { onSuccess: () => setSaved(true) });
      }}
    >
      <p className="text-muted text-sm">
        Daily targets you choose for yourself.
        {cur && ` Current goal since ${formatDayLabel(cur.effective_from)}.`}
      </p>
      <Field
        label="Calories (kcal)"
        type="number"
        inputMode="numeric"
        min="0"
        value={form.kcal}
        onChange={set('kcal')}
        required
      />
      <div className="grid grid-cols-3 gap-2">
        <Field
          label="Protein (g)"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.protein_g}
          onChange={set('protein_g')}
          required
        />
        <Field
          label="Carbs (g)"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.carbs_g}
          onChange={set('carbs_g')}
          required
        />
        <Field
          label="Fat (g)"
          type="number"
          inputMode="numeric"
          min="0"
          value={form.fat_g}
          onChange={set('fat_g')}
          required
        />
      </div>
      <Field
        label="Starting from"
        type="date"
        value={form.effective_from}
        onChange={set('effective_from')}
        hint="Earlier days keep the goal that applied then."
      />
      {create.isError && <ErrorState error={create.error} title="Goal not saved" />}
      <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
        Save goal
      </Button>
      {saved && (
        <p role="status" className="text-muted text-center text-sm">
          Goal saved.
        </p>
      )}
    </form>
  );
}

export function GoalsPage() {
  return <GoalsSection />;
}
