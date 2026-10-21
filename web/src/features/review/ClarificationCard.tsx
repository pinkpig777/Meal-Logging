import { useState } from 'react';
import type { ClarifyAnswer, MealItem, UncertainAttribute } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { inputClass } from '@/components/Field';
import { IconCheck } from '@/components/icons';
import { ReviewCue } from '@/components/ReviewCue';
import { cueForAttribute } from '@/components/reviewCueStatus';
import { formatKcal } from '@/lib/format';

export interface ClarificationCardProps {
  item: MealItem;
  attribute: UncertainAttribute;
  disabled?: boolean;
  onAnswer: (answer: ClarifyAnswer) => void;
}

/**
 * M2 · Clark — one targeted question about one uncertain attribute.
 * Quick replies + "Not sure" + "Something else" (free text → re-estimate).
 */
export function ClarificationCard({
  item,
  attribute: a,
  disabled,
  onAnswer,
}: ClarificationCardProps) {
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState('');
  const cue = cueForAttribute(a);
  const answeredOption = a.status === 'answered' ? a.resolution?.option_id : null;

  // TODO(Clark): decide whether to show each option's kcal on the chip, how to
  // order cards (impact_kcal?), and whether answered cards collapse.
  return (
    <Card className="space-y-3">
      <div className="space-y-1">
        <p className="text-muted text-xs font-medium tracking-wide uppercase">{item.name}</p>
        <h3 className="text-base font-semibold">{a.question}</h3>
        {cue && <ReviewCue attribute={a.attribute} status={cue} reason={a.reason} />}
        {a.status === 'answered' && (
          <p className="text-muted flex items-center gap-1 text-sm">
            <IconCheck className="size-4" />
            Updated from your answer{a.resolution?.text ? `: “${a.resolution.text}”` : ''}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={a.question}>
        {a.options.map((o) => (
          <Chip
            key={o.id}
            disabled={disabled}
            selected={answeredOption === o.id}
            onClick={() => onAnswer({ kind: 'option', option_id: o.id })}
          >
            {o.label}
            <span className="text-muted">· {formatKcal(o.nutrition.kcal)}</span>
          </Chip>
        ))}
        <Chip
          disabled={disabled}
          selected={a.status === 'not_sure'}
          onClick={() => onAnswer({ kind: 'not_sure' })}
        >
          Not sure
        </Chip>
        <Chip disabled={disabled} selected={otherOpen} onClick={() => setOtherOpen((v) => !v)}>
          Something else
        </Chip>
      </div>

      {otherOpen && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const t = otherText.trim();
            if (!t) return;
            onAnswer({ kind: 'other', text: t });
            setOtherOpen(false);
            setOtherText('');
          }}
        >
          <label className="sr-only" htmlFor={`other-${a.id}`}>
            Your answer
          </label>
          <input
            id={`other-${a.id}`}
            className={inputClass}
            value={otherText}
            maxLength={200}
            onChange={(e) => setOtherText(e.target.value)}
            placeholder="Type your answer"
            autoFocus
          />
          <Button type="submit" disabled={disabled || !otherText.trim()}>
            Save
          </Button>
        </form>
      )}
    </Card>
  );
}
