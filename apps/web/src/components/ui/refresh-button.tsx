import React from 'react';
import { RefreshCw } from 'lucide-react';
import { Button, type ButtonProps } from './button';
import { cn } from '../../lib/utils';

type RefreshButtonProps = Omit<ButtonProps, 'children'> & {
  loading?: boolean;
  label?: string;
};

export function RefreshButton(props: RefreshButtonProps): React.JSX.Element {
  const {
    loading = false,
    label = 'Refresh',
    type = 'button',
    variant = 'outline',
    ...rest
  } = props;

  return (
    <Button type={type} variant={variant} disabled={loading || rest.disabled} {...rest}>
      <RefreshCw className={cn('h-4 w-4', loading ? 'animate-spin' : undefined)} />
      {label}
    </Button>
  );
}
