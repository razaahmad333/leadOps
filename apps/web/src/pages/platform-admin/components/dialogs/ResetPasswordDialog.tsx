import React from 'react';
import { Button } from '../../../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../components/ui/dialog';
import { Label } from '../../../../components/ui/label';
import { PasswordInput } from '../../../../components/ui/password-input';
import { PasswordStrengthHints } from '../../../../components/ui/password-strength-hints';
import type { PasswordFormState, PasswordTarget } from '../../platform-admin.types';

type ResetPasswordDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passwordUser: PasswordTarget | null;
  passwordForm: PasswordFormState;
  setPasswordForm: React.Dispatch<React.SetStateAction<PasswordFormState>>;
  savingPassword: boolean;
  onClose: () => void;
  onSave: () => void;
};

export function ResetPasswordDialog(props: ResetPasswordDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    passwordUser,
    passwordForm,
    setPasswordForm,
    savingPassword,
    onClose,
    onSave,
  } = props;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {passwordUser?.email}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reset-password">New Password</Label>
            <PasswordInput
              id="reset-password"
              name="reset-password"
              autoComplete="new-password"
              value={passwordForm.password}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  password: event.target.value,
                }))
              }
            />
            {passwordForm.password.trim().length > 0 && passwordForm.password.trim().length < 8 ? (
              <p className="text-xs text-red-600">Password must be at least 8 characters.</p>
            ) : null}
            <PasswordStrengthHints password={passwordForm.password} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">Confirm Password</Label>
            <PasswordInput
              id="reset-password-confirm"
              name="reset-password-confirm"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(event) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={savingPassword} onClick={onSave}>
              {savingPassword ? 'Saving...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
