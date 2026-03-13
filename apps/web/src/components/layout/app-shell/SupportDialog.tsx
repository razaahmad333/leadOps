import React from 'react';
import { Mail, Phone } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../ui/dialog';

type SupportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supportPhone: string;
  supportEmail: string;
  supportPhoneHref: string;
  onLaunchTour: () => void;
  onOpenManual: () => void;
};

export function SupportDialog(props: SupportDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    supportPhone,
    supportEmail,
    supportPhoneHref,
    onLaunchTour,
    onOpenManual,
  } = props;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Help & Support</DialogTitle>
          <DialogDescription>
            Reach out if you need help with login, tenant access, or day-to-day platform issues.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={onLaunchTour} className="w-full">
              Start Tour
            </Button>
            <Button variant="outline" onClick={onOpenManual} className="w-full">
              Open Manual
            </Button>
          </div>

          <a
            href={supportPhoneHref}
            className="flex items-center gap-3 rounded-2xl border border-white/70 bg-secondary/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background">
              <Phone className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Phone</span>
              <span className="block truncate">{supportPhone}</span>
            </span>
          </a>

          <a
            href={`mailto:${supportEmail}`}
            className="flex items-center gap-3 rounded-2xl border border-white/70 bg-secondary/30 px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-background">
              <Mail className="h-4 w-4 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-xs uppercase tracking-[0.16em] text-muted-foreground">Email</span>
              <span className="block truncate">{supportEmail}</span>
            </span>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
