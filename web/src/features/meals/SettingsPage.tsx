import { useMemo, type ReactNode } from 'react';
import type { Profile } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorState } from '@/components/ErrorState';
import { inputClass } from '@/components/Field';
import { LoadingState } from '@/components/LoadingState';
import { useModelsConfig } from '@/features/capture/api';
import { GoalsSection } from './GoalsPage';
import { useProfile, useUpdateProfile } from './api';

/**
 * M3 · Yi-Wei — goals, analysis model (ADR-0006), time zone, account.
 * TODO(Yi-Wei): display name, dietary restrictions, account deletion.
 */
export function SettingsPage() {
  const { user, signOut, mode } = useAuth();
  const profile = useProfile();

  return (
    <div className="space-y-6">
      <Section title="Goals">
        <GoalsSection />
      </Section>

      <Section title="Analysis model">
        {profile.data ? <ModelPicker profile={profile.data} /> : <ProfileStatus q={profile} />}
      </Section>

      <Section title="Time zone">
        {profile.data ? <TimezonePicker profile={profile.data} /> : <ProfileStatus q={profile} />}
      </Section>

      <Section title="Account">
        <p className="text-sm">
          Signed in as <span className="font-medium">{profile.data?.email ?? user?.email}</span>
          {mode === 'dev' && <span className="text-muted"> (dev auth mode)</span>}
        </p>
        <Button variant="secondary" className="mt-3 w-full" onClick={() => void signOut()}>
          Sign out
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

function ProfileStatus({ q }: { q: ReturnType<typeof useProfile> }) {
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <LoadingState />;
}

function ModelPicker({ profile }: { profile: Profile }) {
  const models = useModelsConfig();
  const update = useUpdateProfile();
  if (models.isPending) return <LoadingState />;
  if (models.isError) return <ErrorState error={models.error} onRetry={() => models.refetch()} />;
  const selected = profile.analysis_model ?? models.data.default;

  return (
    <fieldset className="space-y-2" disabled={update.isPending}>
      <legend className="text-muted mb-2 text-sm">
        Used for new meals. Meals keep the model that analyzed them.
      </legend>
      {models.data.models.map((m) => (
        <label
          key={m.id}
          className="min-h-touch border-line has-checked:border-accent flex cursor-pointer items-start gap-3 rounded-xl border p-3"
        >
          <input
            type="radio"
            name="analysis_model"
            className="accent-accent mt-1 size-5"
            checked={selected === m.id}
            onChange={() => update.mutate({ analysis_model: m.id })}
          />
          <span>
            <span className="block font-medium">
              {m.label}
              {m.id === models.data.default && (
                <span className="text-muted font-normal"> (default)</span>
              )}
            </span>
            <span className="text-muted block text-sm">{m.description}</span>
            <span className="text-muted block text-xs">{m.id}</span>
          </span>
        </label>
      ))}
      {update.isError && <ErrorState error={update.error} title="Not saved" />}
    </fieldset>
  );
}

function TimezonePicker({ profile }: { profile: Profile }) {
  const update = useUpdateProfile();
  const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = useMemo(() => {
    const all =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return [...new Set([profile.timezone, device, ...all])].filter(Boolean);
  }, [profile.timezone, device]);

  return (
    <div className="space-y-2">
      <label htmlFor="tz" className="text-muted block text-sm">
        Days are counted in this time zone.
      </label>
      <select
        id="tz"
        className={inputClass}
        value={profile.timezone}
        disabled={update.isPending}
        onChange={(e) => update.mutate({ timezone: e.target.value })}
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
      {device && device !== profile.timezone && (
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => update.mutate({ timezone: device })}
        >
          Use this device’s time zone ({device.replaceAll('_', ' ')})
        </Button>
      )}
      {update.isError && <ErrorState error={update.error} title="Not saved" />}
    </div>
  );
}
