import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, label, ...props }, ref) => {
    const active = checked === true;

    return (
      <label className={cn('flex cursor-pointer items-center gap-3 text-sm', props.disabled && 'cursor-not-allowed opacity-70')}>
        <span className="relative flex h-4 w-4 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          {...props}
        />
          <span className={cn(
            'flex h-4 w-4 items-center justify-center rounded border border-input bg-background transition-colors',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2',
            active && 'border-primary bg-primary',
            className,
          )}>
            <Check className={cn('h-3 w-3 text-primary-foreground transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
          </span>
        </span>
        {label ? <span>{label}</span> : null}
      </label>
    );
  },
);
Checkbox.displayName = 'Checkbox';
