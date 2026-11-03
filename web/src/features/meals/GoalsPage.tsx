import { useState } from 'react';
import { toast } from 'sonner';
import type { GoalsResponse } from '@/api/types';
import { ErrorState } from '@/components/ErrorState';
import { Field } from '@/components/Field';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { formatDayLabel, formatGrams, formatKcal } from '@/lib/format';
import { GoalCalorieEstimator } from './GoalCalorieEstimator';
import { GOAL_PRESETS, presetTargets, type GoalTargets, type PresetId } from './goalSetup';
import { useCreateGoal, useGoals } from './api';

/** M3 goal setup: all methods review the same existing, date-versioned goal contract. */
export function GoalsSection() {
  const goals = useGoals();
  if (goals.isPending) return <LoadingState label="Loading goals…" layout="form" />;
  if (goals.isError) return <ErrorState error={goals.error} onRetry={() => goals.refetch()} />;
  return <GoalsForm key={goals.data.current?.id ?? 'none'} data={goals.data} />;
}

function formValues(targets: GoalTargets | null) {
  return {
    kcal: targets ? String(targets.kcal) : '',
    protein_g: targets ? String(targets.protein_g) : '',
    carbs_g: targets ? String(targets.carbs_g) : '',
    fat_g: targets ? String(targets.fat_g) : '',
    effective_from: '',
  };
}

function TargetSummary({ targets }: { targets: GoalTargets }) {
  return (
    <dl className="grid grid-cols-2 gap-3" aria-label="Daily targets">
      {[
        ['Calories', formatKcal(targets.kcal)],
        ['Protein', formatGrams(targets.protein_g)],
        ['Carbs', formatGrams(targets.carbs_g)],
        ['Fat', formatGrams(targets.fat_g)],
      ].map(([name, value]) => (
        <div key={name}>
          <dt className="text-caption text-muted-foreground">{name}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function GoalsForm({ data }: { data: GoalsResponse }) {
  const create = useCreateGoal();
  const cur = data.current;
  const [mode, setMode] = useState<'closed' | 'choose' | 'preset' | 'review'>('closed');
  const [preset, setPreset] = useState<PresetId>('standard');
  const [calories, setCalories] = useState(String(cur?.kcal ?? 2000));
  const [estimateOpen, setEstimateOpen] = useState(false);
  const [form, setForm] = useState(() => formValues(cur));
  const [method, setMethod] = useState('Manual entry');
  const proposal = presetTargets(Number(calories), preset);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };
  const raw = [form.kcal, form.protein_g, form.carbs_g, form.fat_g];
  const nums = raw.map(Number);
  const valid =
    raw.every((v) => v.trim() !== '') &&
    nums.every((v) => Number.isFinite(v) && v >= 0) &&
    nums[0] > 0 &&
    Number.isInteger(nums[0]);
  const macroEnergy = nums[1] * 4 + nums[2] * 4 + nums[3] * 9;

  function openSetup() {
    create.reset();
    setForm(formValues(cur));
    setCalories(String(cur?.kcal ?? 2000));
    setEstimateOpen(false);
    setMode('choose');
  }

  if (mode === 'closed')
    return (
      <div className="space-y-4">
        {cur ? (
          <>
            <p className="text-label text-muted-foreground font-normal">
              Current daily targets since {formatDayLabel(cur.effective_from)}.
            </p>
            <TargetSummary targets={cur} />
          </>
        ) : (
          <p>No goals set yet. Choose targets that work for you.</p>
        )}
        <Button type="button" className="w-full" onClick={openSetup}>
          Set goals
        </Button>
      </div>
    );

  if (mode === 'choose')
    return (
      <div className="space-y-4">
        <h3 className="font-medium">How would you like to set your goals?</h3>
        <p className="text-label text-muted-foreground font-normal">
          Enter your own targets or start with a calorie-based preset. You can review and edit
          everything before saving.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={() => {
            setMethod('Manual entry');
            setMode('review');
          }}
        >
          Enter manually
        </Button>
        <div className="grid grid-cols-2 gap-3">
          {GOAL_PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              variant="secondary"
              onClick={() => {
                setPreset(p.id);
                setMode('preset');
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('closed')}>
          Cancel
        </Button>
      </div>
    );

  if (mode === 'preset')
    return (
      <div className="space-y-4">
        <h3 className="font-medium">
          {GOAL_PRESETS.find((p) => p.id === preset)?.name} starting targets
        </h3>
        <p className="text-label text-muted-foreground font-normal">
          This preset divides your calorie target into protein, carbs, and fat. It is an editable
          template, not a personalized diet prescription.
        </p>
        {preset === 'keto' && (
          <p className="text-caption text-muted-foreground">
            Keto is a very-low-carb, high-fat template. This split does not guarantee ketosis or
            suitability for you.
          </p>
        )}
        <Field
          label="Daily calories for preset (kcal)"
          type="number"
          inputMode="numeric"
          min="500"
          max="10000"
          step="1"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          hint={
            cur
              ? 'Starts from your current calorie goal. Edit it or estimate maintenance below.'
              : '2,000 kcal is a placeholder, not a personalized estimate. Edit it or use the estimator below.'
          }
        />
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          aria-expanded={estimateOpen}
          onClick={() => setEstimateOpen((open) => !open)}
        >
          {estimateOpen ? 'Hide calorie estimator' : 'Estimate my calories'}
        </Button>
        {estimateOpen && (
          <GoalCalorieEstimator
            onUse={(kcal) => {
              setCalories(String(kcal));
              setEstimateOpen(false);
            }}
          />
        )}
        <div className="bg-muted rounded-control space-y-3 p-4" aria-live="polite">
          <p className="font-medium">Preset preview</p>
          {proposal ? (
            <TargetSummary targets={proposal} />
          ) : (
            <p>Enter whole-number calories from 500 to 10,000 to preview this template.</p>
          )}
          <p className="text-caption text-muted-foreground">
            Macro grams are rounded; their calorie total can differ slightly.
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={!proposal}
          onClick={() => {
            if (proposal) {
              setForm(formValues(proposal));
              setMethod(GOAL_PRESETS.find((p) => p.id === preset)?.name ?? 'Preset');
              setMode('review');
            }
          }}
        >
          Review targets
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={() => setMode('choose')}>
          Back to methods
        </Button>
      </div>
    );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || create.isPending) return;
        create.mutate(
          {
            kcal: nums[0],
            protein_g: nums[1],
            carbs_g: nums[2],
            fat_g: nums[3],
            effective_from: form.effective_from || undefined,
          },
          {
            onSuccess: () => {
              toast.success('Goal saved');
              setMode('closed');
            },
          },
        );
      }}
    >
      <h3 className="font-medium">Review daily targets</h3>
      <p className="text-label text-muted-foreground font-normal">
        Started from: {method}. Adjust any target before saving.
      </p>
      <fieldset className="space-y-4" disabled={create.isPending}>
        <legend className="sr-only">Editable daily targets</legend>
        <Field
          label="Calories (kcal)"
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          value={form.kcal}
          onChange={set('kcal')}
          required
        />
        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Protein (g)"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.protein_g}
            onChange={set('protein_g')}
            required
          />
          <Field
            label="Carbs (g)"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.carbs_g}
            onChange={set('carbs_g')}
            required
          />
          <Field
            label="Fat (g)"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={form.fat_g}
            onChange={set('fat_g')}
            required
          />
        </div>
        {valid && Math.abs(macroEnergy - nums[0]) > Math.max(50, nums[0] * 0.05) && (
          <p className="text-caption text-muted-foreground">
            These macro targets add up to about {formatKcal(macroEnergy)}, which differs from your
            calorie target. You can adjust either before saving.
          </p>
        )}
        <Field
          label="Starting from (optional)"
          type="date"
          value={form.effective_from}
          onChange={set('effective_from')}
          hint="Leave blank for today in your profile's time zone. Earlier days keep their previous goals."
        />
      </fieldset>
      {create.isError && (
        <ErrorState error={create.error} title="Goal not saved" className="py-2" />
      )}
      <Button type="submit" className="w-full" disabled={!valid || create.isPending}>
        {create.isPending ? 'Saving…' : 'Save goal'}
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={create.isPending}
        onClick={() => {
          create.reset();
          setMode('choose');
        }}
      >
        Back to methods
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="w-full"
        disabled={create.isPending}
        onClick={() => {
          create.reset();
          setMode('closed');
        }}
      >
        Cancel
      </Button>
    </form>
  );
}

export function GoalsPage() {
  return <GoalsSection />;
}
