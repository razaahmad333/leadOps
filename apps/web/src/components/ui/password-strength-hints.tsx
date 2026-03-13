import { Check, X } from 'lucide-react';
import { evaluatePasswordStrength } from '../../lib/password-strength';
import { cn } from '../../lib/utils';
import { Badge } from './badge';

interface PasswordStrengthHintsProps {
  password: string;
  className?: string;
}

function badgeVariant(level: ReturnType<typeof evaluatePasswordStrength>['level']): 'success' | 'warning' | 'danger' {
  if (level === 'Strong') {
    return 'success';
  }

  if (level === 'Medium') {
    return 'warning';
  }

  return 'danger';
}

export function PasswordStrengthHints({ password, className }: PasswordStrengthHintsProps): JSX.Element {
  const evaluation = evaluatePasswordStrength(password);

  const checks = [
    { key: 'minLength', label: 'At least 8 characters', passed: evaluation.meetsMinLength },
    { key: 'lower', label: 'Lowercase letter', passed: evaluation.hasLower },
    { key: 'upper', label: 'Uppercase letter', passed: evaluation.hasUpper },
    { key: 'number', label: 'Number', passed: evaluation.hasNumber },
    { key: 'symbol', label: 'Symbol', passed: evaluation.hasSymbol },
    { key: 'recommendedLength', label: '12+ characters (recommended)', passed: evaluation.meetsRecommendedLength },
  ];

  return (
    <div className={cn('rounded-2xl border border-white/70 bg-secondary/30 p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Password Strength</p>
        <Badge variant={badgeVariant(evaluation.level)}>{evaluation.level}</Badge>
      </div>
      <div className="mt-3 grid gap-1 text-xs">
        {checks.map((check) => (
          <p key={check.key} className={cn('flex items-center gap-2', check.passed ? 'text-emerald-700' : 'text-muted-foreground')}>
            {check.passed ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            <span>{check.label}</span>
          </p>
        ))}
      </div>
    </div>
  );
}
