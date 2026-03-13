import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import type { NavItem } from './app-shell.types';

type ShellBottomNavProps = {
  mobilePrimaryNav: NavItem[];
  navTourId: (path: string) => string;
};

export function ShellBottomNav({ mobilePrimaryNav, navTourId }: ShellBottomNavProps): React.JSX.Element | null {
  if (mobilePrimaryNav.length === 0) {
    return null;
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/80 bg-background/92 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur xl:hidden">
      <div className="grid grid-cols-4 gap-1 rounded-[1.4rem] border border-white/70 bg-background/95 p-1 shadow-[0_-14px_30px_-24px_rgba(15,23,42,0.35)]">
        {mobilePrimaryNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              data-tour-id={navTourId(item.to)}
              className={({ isActive }) =>
                cn(
                  'grid min-w-0 min-h-[4.4rem] place-items-center gap-1 rounded-[1.1rem] px-1 py-2 text-center text-[10px] font-semibold leading-none transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_14px_26px_-18px_hsl(var(--primary))]'
                    : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="block w-full truncate text-center leading-[1.1]">{item.mobileLabel}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
