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
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import type { BranchFormState } from '../../platform-admin.types';

type CreateBranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchForm: BranchFormState;
  setBranchForm: React.Dispatch<React.SetStateAction<BranchFormState>>;
  savingBranch: boolean;
  onClose: () => void;
  onCreate: () => void;
};

export function CreateBranchDialog(props: CreateBranchDialogProps): React.JSX.Element {
  const { open, onOpenChange, branchForm, setBranchForm, savingBranch, onClose, onCreate } = props;

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Branch</DialogTitle>
          <DialogDescription>Create a branch for this tenant.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-create-branch-name">Branch Name</Label>
            <Input
              id="platform-create-branch-name"
              value={branchForm.name}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-create-branch-description">Description</Label>
            <Input
              id="platform-create-branch-description"
              value={branchForm.description}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="Optional branch note"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={savingBranch} onClick={onCreate}>
              {savingBranch ? 'Saving...' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
