import React from 'react';
import { BookOpenText, ChevronLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { UiDictionary } from '../../../lib/ui-dictionary';
import { cn } from '../../../lib/utils';
import { Button } from '../../ui/button';
import { BranchSwitcher } from './BranchSwitcher';
import type { BranchOption } from '../../../lib/branch-scope';
import type { NavItem } from './app-shell.types';

type ShellSidebarProps = {
  dictionary: UiDictionary;
  profileIndustryPreset?: string;
  sidebarCollapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;

  visibleNavItems: NavItem[];
  navTourId: (path: string) => string;
  onNavigate: () => void;

  onOpenManual: () => void;
  onOpenSupport: () => void;

  branchOptions: BranchOption[];
  canSwitchBranches: boolean;
  branchScopeLabel: string | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (value: string | null) => void;
};

export function ShellSidebar(props: ShellSidebarProps): React.JSX.Element {
  const {
    dictionary,
    profileIndustryPreset,
    sidebarCollapsed,
    onToggleCollapsed,
    onCloseMobile,
    visibleNavItems,
    navTourId,
    onNavigate,
    onOpenManual,
    onOpenSupport,
    branchOptions,
    canSwitchBranches,
    branchScopeLabel,
    selectedBranchId,
    setSelectedBranchId,
  } = props;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/70 px-4 pb-4 pt-5">
        <div className={cn('flex gap-3', sidebarCollapsed ? 'justify-center' : 'items-start justify-between')}>
          <div className={cn('transition-all', sidebarCollapsed ? 'hidden' : 'block')}>
            <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">HikmahOne</p>
            <p className="mt-2 text-lg font-semibold">{dictionary.theme?.sidebarTitle ?? 'LeadOps'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {dictionary.labels.sidebarSubtitle || 'Tenant-aware workspace'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onCloseMobile}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
              onClick={onToggleCollapsed}
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {!sidebarCollapsed ? (
          <div className="mt-4 rounded-2xl border border-white/70 bg-background/90 p-4 xl:hidden">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Workspace</p>
            <p className="mt-2 text-base font-semibold text-foreground">{dictionary.tenantName}</p>

            <div className="mt-3 space-y-2">
              <BranchSwitcher
                variant="sidebar"
                branchOptions={branchOptions}
                canSwitchBranches={canSwitchBranches}
                branchScopeLabel={branchScopeLabel}
                selectedBranchId={selectedBranchId}
                setSelectedBranchId={setSelectedBranchId}
              />

              {profileIndustryPreset ? (
                <p className="text-xs text-muted-foreground">
                  {profileIndustryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour-id={navTourId(item.to)}
              end={item.to === '/settings'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors',
                  sidebarCollapsed && 'justify-center px-0',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_14px_30px_-18px_hsl(var(--primary))]'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className={cn(sidebarCollapsed && 'hidden')}>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/70 px-3 py-4">
        <div className={cn('grid gap-2', sidebarCollapsed ? 'grid-cols-1' : 'grid-cols-2')}>
          <button
            type="button"
            data-tour-id="manual-button"
            onClick={onOpenManual}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl border border-input bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary/60',
              sidebarCollapsed && 'px-0',
            )}
          >
            <BookOpenText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn(sidebarCollapsed && 'hidden')}>User Manual</span>
          </button>

          <button
            type="button"
            data-tour-id="support-button"
            onClick={onOpenSupport}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-2xl border border-input bg-background px-3 py-3 text-sm font-medium transition-colors hover:bg-secondary/60',
              sidebarCollapsed && 'px-0',
            )}
          >
            <CircleHelp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className={cn(sidebarCollapsed && 'hidden')}>Help & Support</span>
          </button>
        </div>
      </div>
    </div>
  );
}
