import React from 'react';
import { Check, MapPin } from 'lucide-react';
import type { BranchOption } from '../../../lib/branch-scope';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';

type BranchSwitcherProps = {
  branchOptions: BranchOption[];
  canSwitchBranches: boolean;
  branchScopeLabel: string | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (value: string | null) => void;
  variant: 'sidebar' | 'header';
};

export function BranchSwitcher(props: BranchSwitcherProps): React.JSX.Element | null {
  const {
    branchOptions,
    canSwitchBranches,
    branchScopeLabel,
    selectedBranchId,
    setSelectedBranchId,
    variant,
  } = props;

  if (!branchScopeLabel) {
    return null;
  }

  if (canSwitchBranches) {
    if (variant === 'sidebar') {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              data-tour-id="branch-switcher"
              variant="outline"
              className="h-9 w-full justify-start px-3 text-sm"
            >
              <MapPin className="mr-2 h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{branchScopeLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setSelectedBranchId(null)}>
              <span className="mr-2 inline-flex w-4 justify-center">
                {!selectedBranchId ? <Check className="h-3 w-3" /> : null}
              </span>
              All branches ({branchOptions.length})
            </DropdownMenuItem>
            {branchOptions.map((branch) => (
              <DropdownMenuItem key={branch.id} onClick={() => setSelectedBranchId(branch.id)}>
                <span className="mr-2 inline-flex w-4 justify-center">
                  {selectedBranchId === branch.id ? <Check className="h-3 w-3" /> : null}
                </span>
                {branch.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            data-tour-id="branch-switcher"
            variant="outline"
            className="h-8 rounded-full border-white/70 bg-background/90 px-3 text-xs"
          >
            <MapPin className="mr-1 h-3 w-3" />
            <span>{branchScopeLabel}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => setSelectedBranchId(null)}>
            <span className="mr-2 inline-flex w-4 justify-center">
              {!selectedBranchId ? <Check className="h-3 w-3" /> : null}
            </span>
            All branches ({branchOptions.length})
          </DropdownMenuItem>
          {branchOptions.map((branch) => (
            <DropdownMenuItem key={branch.id} onClick={() => setSelectedBranchId(branch.id)}>
              <span className="mr-2 inline-flex w-4 justify-center">
                {selectedBranchId === branch.id ? <Check className="h-3 w-3" /> : null}
              </span>
              {branch.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'sidebar') {
    return <p className="text-xs text-muted-foreground">Branch: {branchScopeLabel}</p>;
  }

  return (
    <Badge variant="outline" className="gap-1 rounded-full border-white/70 bg-background/90 px-3 py-1">
      <MapPin className="h-3 w-3" />
      {branchScopeLabel}
    </Badge>
  );
}
