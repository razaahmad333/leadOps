import React from 'react';
import type { AuthUser } from '@leadops/shared';
import { BellRing, Menu, Sparkles } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../../ui/dropdown-menu';
import type { UiDictionary } from '../../../lib/ui-dictionary';
import { BranchSwitcher } from './BranchSwitcher';
import type { BranchOption } from '../../../lib/branch-scope';

type TenantOption = {
  tenantId: string;
  tenantName: string;
};

type ShellHeaderProps = {
  user: AuthUser | null;
  dictionary: UiDictionary;
  profileIndustryPreset?: string;
  alternateTenants: TenantOption[];
  onTenantSwitch: (tenantId: string) => void;
  onLogout: () => void;
  onHome: () => void;
  onToggleMobile: () => void;

  branchOptions: BranchOption[];
  canSwitchBranches: boolean;
  branchScopeLabel: string | null;
  selectedBranchId: string | null;
  setSelectedBranchId: (value: string | null) => void;
};

export function ShellHeader(props: ShellHeaderProps): React.JSX.Element {
  const {
    user,
    dictionary,
    profileIndustryPreset,
    alternateTenants,
    onTenantSwitch,
    onLogout,
    onHome,
    onToggleMobile,
    branchOptions,
    canSwitchBranches,
    branchScopeLabel,
    selectedBranchId,
    setSelectedBranchId,
  } = props;

  return (
    <header className="sticky top-0 z-30 px-3 pt-2 sm:px-4 sm:pt-3 lg:px-6 xl:px-8">
      <div className="overflow-hidden rounded-b-[2rem] border-x border-b border-white/80 bg-background/90 px-4 py-4 shadow-[0_24px_50px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:rounded-[1.75rem] sm:border sm:px-5 xl:rounded-[2rem] xl:border-0 xl:bg-[linear-gradient(180deg,rgba(255,255,255,0.52),rgba(239,248,248,0.68))] xl:px-6 xl:py-4 xl:shadow-[0_18px_40px_-34px_rgba(15,23,42,0.28)] xl:backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 xl:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 rounded-2xl"
              onClick={onToggleMobile}
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <p className="max-w-[11rem] truncate text-lg font-semibold leading-none sm:max-w-[16rem] sm:text-xl">
                Welcome{user?.name ? `, ${user.name}` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="secondary" size="icon" className="rounded-2xl">
              <BellRing className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  data-tour-id="workspace-home"
                  variant="outline"
                  className="h-10 max-w-[8.5rem] rounded-2xl px-3 text-left sm:max-w-none"
                >
                  <span className="truncate">{user?.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {alternateTenants.map((tenant) => (
                  <DropdownMenuItem key={tenant.tenantId} onClick={() => onTenantSwitch(tenant.tenantId)}>
                    Switch to {tenant.tenantName}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="hidden xl:block">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Tenant</p>
                <button
                  type="button"
                  data-tour-id="workspace-home"
                  className="mt-1 truncate text-left text-lg font-semibold leading-none sm:text-xl"
                  onClick={onHome}
                >
                  {dictionary.tenantName}
                </button>
                {dictionary.labels.sidebarSubtitle ? (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{dictionary.labels.sidebarSubtitle}</p>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" size="icon" className="rounded-2xl">
                <BellRing className="h-4 w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 max-w-[8.5rem] rounded-2xl px-3 text-left sm:max-w-none"
                  >
                    <span className="truncate">{user?.name}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {alternateTenants.map((tenant) => (
                    <DropdownMenuItem key={tenant.tenantId} onClick={() => onTenantSwitch(tenant.tenantId)}>
                      Switch to {tenant.tenantName}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuItem onClick={onLogout}>Logout</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BranchSwitcher
              variant="header"
              branchOptions={branchOptions}
              canSwitchBranches={canSwitchBranches}
              branchScopeLabel={branchScopeLabel}
              selectedBranchId={selectedBranchId}
              setSelectedBranchId={setSelectedBranchId}
            />
            {profileIndustryPreset ? (
              <Badge variant="outline" className="rounded-full border-white/70 bg-background/90 px-3 py-1">
                {profileIndustryPreset === 'DIAGNOSTICS_LAB' ? 'Diagnostics Lab' : 'Generic'}
              </Badge>
            ) : null}
            {dictionary.featureFlags.aiAssist ? (
              <Badge variant="default" className="gap-1 rounded-full px-3 py-1">
                <Sparkles className="h-3 w-3" />
                AI Assist
              </Badge>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
