import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('border-line bg-surface rounded-2xl border p-4 shadow-xs', className)}
      {...rest}
    />
  );
}
