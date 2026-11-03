import { useId, useState } from 'react';
import { Field, selectClass } from '@/components/Field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatKcal } from '@/lib/format';
import {
  ACTIVITIES,
  estimateMaintenance,
  measurements,
  type EquationSex,
  type Units,
} from './goalSetup';

/** Measurements are transient form state; only final goal targets are saved. */
export function GoalCalorieEstimator({ onUse }: { onUse: (kcal: number) => void }) {
  const id = useId();
  const [units, setUnits] = useState<Units>('us');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState<EquationSex | ''>('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState(0);
  const [eligible, setEligible] = useState(false);
  const converted = measurements(Number(height), Number(weight), units);
  const estimate =
    eligible && age.trim() && height.trim() && weight.trim()
      ? estimateMaintenance({ age: Number(age), sex, ...converted, activity })
      : null;

  function changeUnits(next: Units) {
    if (next === units) return;
    // Preserve the entered measurement when changing units, rather than relabeling it.
    const factor =
      next === 'metric'
        ? { height: 2.54, weight: 0.45359237 }
        : { height: 1 / 2.54, weight: 1 / 0.45359237 };
    if (height.trim() && Number.isFinite(Number(height))) {
      setHeight(String(Number((Number(height) * factor.height).toFixed(2))));
    }
    if (weight.trim() && Number.isFinite(Number(weight))) {
      setWeight(String(Number((Number(weight) * factor.weight).toFixed(2))));
    }
    setUnits(next);
  }

  return (
    <section
      className="border-border rounded-control space-y-4 border p-4"
      aria-label="Calorie estimator"
    >
      <h3 className="font-medium">Estimate maintenance calories</h3>
      <p className="text-caption text-muted-foreground">
        An editable starting point for maintaining weight. Actual needs vary; this does not
        automatically add a weight-loss deficit or weight-gain surplus.
      </p>
      <label className="flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="accent-primary focus-visible:ring-ring size-5 shrink-0 focus-visible:ring-2"
          checked={eligible}
          onChange={(e) => setEligible(e.target.checked)}
        />
        <span className="text-label">I am 19 or older and not pregnant or breastfeeding.</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor={`${id}-units`}>Measurement units</Label>
          <select
            id={`${id}-units`}
            className={selectClass}
            value={units}
            onChange={(e) => changeUnits(e.target.value as Units)}
          >
            <option value="us">US (in, lb)</option>
            <option value="metric">Metric (cm, kg)</option>
          </select>
        </div>
        <Field
          label="Age (years)"
          type="number"
          inputMode="numeric"
          min="19"
          max="100"
          step="1"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        />
        <Field
          label={units === 'us' ? 'Height (in)' : 'Height (cm)'}
          type="number"
          inputMode="decimal"
          step="any"
          value={height}
          onChange={(e) => setHeight(e.target.value)}
          hint={units === 'us' ? 'Total inches; 6 ft = 72 in.' : undefined}
        />
        <Field
          label={units === 'us' ? 'Weight (lb)' : 'Weight (kg)'}
          type="number"
          inputMode="decimal"
          step="any"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-sex`}>Sex used by the equation</Label>
        <select
          id={`${id}-sex`}
          value={sex}
          className={selectClass}
          aria-describedby={`${id}-sex-hint`}
          onChange={(e) => setSex(e.target.value as EquationSex | '')}
        >
          <option value="">Choose an equation</option>
          <option value="female">Female equation</option>
          <option value="male">Male equation</option>
        </select>
        <p id={`${id}-sex-hint`} className="text-caption text-muted-foreground">
          The published equations use these two categories. You can enter calories manually instead.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${id}-activity`}>Activity level: {ACTIVITIES[activity].name}</Label>
        <input
          id={`${id}-activity`}
          type="range"
          min="0"
          max="3"
          step="1"
          value={activity}
          aria-valuetext={ACTIVITIES[activity].name}
          aria-describedby={`${id}-activity-hint`}
          onChange={(e) => setActivity(Number(e.target.value))}
          className="accent-primary focus-visible:ring-ring min-h-11 w-full focus-visible:ring-2"
        />
        <p id={`${id}-activity-hint`} className="text-caption text-muted-foreground">
          {ACTIVITIES[activity].description} Include both work and leisure activity.
        </p>
      </div>
      <div className="bg-muted rounded-control space-y-2 p-3" aria-live="polite">
        <p className="font-medium">Estimated maintenance: {formatKcal(estimate)} per day</p>
        {estimate === null && (
          <p className="text-caption text-muted-foreground">
            Complete the fields and eligibility check. Supported entries: age 19–100, height 120–230
            cm, and weight 35–300 kg, or equivalent US units.
          </p>
        )}
      </div>
      <p className="text-caption text-muted-foreground">
        Measurements stay in this form; only targets are saved. Based on{' '}
        <a
          className="text-primary inline-flex min-h-11 items-center underline underline-offset-2"
          target="_blank"
          rel="noreferrer"
          href="https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/dietary-reference-intakes/tables/equations-estimate-energy-requirement.html"
        >
          adult Dietary Reference Intake equations
        </a>
        .
      </p>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        disabled={estimate === null}
        onClick={() => estimate !== null && onUse(estimate)}
      >
        Use calorie estimate
      </Button>
    </section>
  );
}
