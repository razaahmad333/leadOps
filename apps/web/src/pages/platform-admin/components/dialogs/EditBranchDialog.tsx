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

type EditBranchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchForm: BranchFormState;
  setBranchForm: React.Dispatch<React.SetStateAction<BranchFormState>>;
  savingBranch: boolean;
  editingBranchId: string | null;
  onClose: () => void;
  onSave: () => void;
};

export function EditBranchDialog(props: EditBranchDialogProps): React.JSX.Element {
  const {
    open,
    onOpenChange,
    branchForm,
    setBranchForm,
    savingBranch,
    editingBranchId,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Branch</DialogTitle>
          <DialogDescription>Update branch name and description.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform-edit-branch-name">Branch Name</Label>
            <Input
              id="platform-edit-branch-name"
              value={branchForm.name}
              onChange={(event) =>
                setBranchForm((current) => ({ ...current, name: event.target.value }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="platform-edit-branch-description">Description</Label>
            <Input
              id="platform-edit-branch-description"
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
            <Button disabled={savingBranch || !editingBranchId} onClick={onSave}>
              {savingBranch ? 'Saving...' : 'Save Branch'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
