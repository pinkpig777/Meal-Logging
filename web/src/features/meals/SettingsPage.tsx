import { LogOut } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { Profile } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { ErrorState } from '@/components/ErrorState';
import { selectClass } from '@/components/Field';
import { LoadingState } from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
    <div className="space-y-8">
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
        <p className="break-words">
          Signed in as <span className="font-medium">{profile.data?.email ?? user?.email}</span>
          {mode === 'dev' && <span className="text-muted-foreground"> (dev auth mode)</span>}
        </p>
        <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
          <LogOut aria-hidden="true" strokeWidth={1.75} />
          Sign out
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3" aria-label={title}>
      <h2 className="text-heading">{title}</h2>
      <Card>{children}</Card>
    </section>
  );
}

function ProfileStatus({ q }: { q: ReturnType<typeof useProfile> }) {
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <LoadingState layout="form" />;
}

function ModelPicker({ profile }: { profile: Profile }) {
  const models = useModelsConfig();
  const update = useUpdateProfile();
  if (models.isPending) return <LoadingState layout="form" />;
  if (models.isError) return <ErrorState error={models.error} onRetry={() => models.refetch()} />;
  const selected = profile.analysis_model ?? models.data.default;

  return (
    <fieldset className="space-y-3" disabled={update.isPending}>
      <legend className="text-label text-muted-foreground mb-3 font-normal">
        Used for new meals. Meals keep the model that analyzed them.
      </legend>
      {models.data.models.map((m) => (
        <label
          key={m.id}
          className="min-h-touch rounded-control border-border has-checked:border-primary has-checked:bg-primary-soft flex cursor-pointer items-start gap-3 border-2 p-3 transition-colors duration-150"
        >
          <input
            type="radio"
            name="analysis_model"
            className="accent-primary mt-0.5 size-5 shrink-0"
            checked={selected === m.id}
            onChange={() => update.mutate({ analysis_model: m.id })}
          />
          <span>
            <span className="block font-medium">
              {m.label}
              {m.id === models.data.default && (
                <span className="text-muted-foreground font-normal"> (default)</span>
              )}
            </span>
            <span className="text-label text-muted-foreground block font-normal">
              {m.description}
            </span>
            <span className="text-caption text-muted-foreground block">{m.id}</span>
          </span>
        </label>
      ))}
      {update.isError && <ErrorState error={update.error} title="Not saved" className="py-2" />}
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
    <div className="space-y-3">
      <label htmlFor="tz" className="text-label text-muted-foreground block font-normal">
        Days are counted in this time zone.
      </label>
      <select
        id="tz"
        className={selectClass}
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
          className="h-auto min-h-12 w-full py-3 whitespace-normal"
          onClick={() => update.mutate({ timezone: device })}
        >
          Use this device’s time zone ({device.replaceAll('_', ' ')})
        </Button>
      )}
      {update.isError && <ErrorState error={update.error} title="Not saved" className="py-2" />}
    </div>
  );
}
