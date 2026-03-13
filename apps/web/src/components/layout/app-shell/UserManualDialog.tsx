import React from 'react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';
import type { ManualModule } from './app-shell.types';

type UserManualDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualModules: ManualModule[];
  onLaunchTour: () => void;
  onOpenSupport: () => void;
  onOpenRoute: (route: string) => void;
};

export function UserManualDialog(props: UserManualDialogProps): React.JSX.Element {
  const { open, onOpenChange, manualModules, onLaunchTour, onOpenSupport, onOpenRoute } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>User Manual</DialogTitle>
          <DialogDescription>
            Guided operating notes for the modules you can access in this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-2xl border border-white/70 bg-secondary/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Quick Start</p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>1. Confirm your active branch context before you start daily operations.</p>
              <p>2. Keep Today queue clear by marking completed follow-ups quickly.</p>
              <p>3. Update enquiry status and next follow-up together to keep reminders in sync.</p>
              <p>4. Use Settings modules for controlled operational changes (roles, team, reminders).</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button onClick={onLaunchTour} className="w-full sm:w-auto">
                Start Interactive Tour
              </Button>
              <Button variant="outline" onClick={onOpenSupport} className="w-full sm:w-auto">
                Open Help & Support
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Modules You Can Access
            </p>
            {manualModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules available for this account.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {manualModules.map((module) => (
                  <div key={module.id} className="rounded-2xl border border-white/70 bg-background/80 p-4">
                    <p className="text-sm font-semibold">{module.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{module.description}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => onOpenRoute(module.route)}
                    >
                      Open
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
