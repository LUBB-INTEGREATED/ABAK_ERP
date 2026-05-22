'use client';

/**
 * Per-department pricer assignments on an RFQ + Lead Pricer designation.
 *
 * Added 2026-05-21 per the process correction. Replaces the old
 * "RFQ Engineer + Financial Reviewer + Coordinator" three-user model.
 * Each row represents one department's pricer assignment. Exactly one
 * row across the whole RFQ carries the ⭐ "Lead Pricer" flag — toggling
 * it on one row clears it from the others automatically.
 *
 * Norman notes:
 * - The ⭐ toggle is a strong signifier; the filled state is visually
 *   distinct from the empty state and aria-labeled.
 * - "Add pricer" is constraint-aware: disabled until both dept and user
 *   are chosen.
 * - "Cannot remove the Lead Pricer" error from the API is surfaced as
 *   a toast — Norman: explain the constraint, don't just block silently.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §C "Assign the RFQ".
 */

import { useState } from 'react';
import { Plus, Star, StarOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { UserPicker } from '@/components/ui/user-picker';
import {
  type RfqAssignment,
  useCreateRfqAssignment,
  useDepartments,
  useRemoveRfqAssignment,
  useRfqAssignments,
  useUpdateRfqAssignment,
} from '@/lib/hooks/use-rfq-assignments';

export function PricerAssignments({ rfqId }: { rfqId: string }) {
  const { data: assignments = [], isLoading } = useRfqAssignments(rfqId);
  const { data: departments = [] } = useDepartments();
  const create = useCreateRfqAssignment(rfqId);
  const remove = useRemoveRfqAssignment(rfqId);

  const [newDept, setNewDept] = useState('');
  const [newUser, setNewUser] = useState('');

  const usedDeptIds = new Set(assignments.map((a) => a.departmentId));
  const availableDepts = departments.filter((d) => !usedDeptIds.has(d.id));
  const leadCount = assignments.filter((a) => a.isLeadPricer).length;

  async function addAssignment() {
    if (!newDept || !newUser) return;
    try {
      // First assignment auto-becomes the Lead Pricer to satisfy the invariant.
      const isFirst = assignments.length === 0;
      await create.mutateAsync({
        departmentId: newDept,
        assigneeId: newUser,
        isLeadPricer: isFirst,
      });
      toast.success(
        isFirst
          ? 'Pricer added (auto-designated as Lead Pricer).'
          : 'Pricer added.',
      );
      setNewDept('');
      setNewUser('');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to add pricer.';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  async function removeAssignment(id: string) {
    try {
      await remove.mutateAsync(id);
      toast.success('Pricer removed.');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? 'Failed to remove pricer.';
      toast.error(Array.isArray(message) ? message.join(', ') : message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Pricer assignments per department
          </CardTitle>
          <CardDescription>
            One row per department involved. Designate exactly one engineer as
            the Lead Pricer — they assemble + submit the consolidated quote;
            others fill their own section only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : assignments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No pricers assigned yet. Add the first one below.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => (
                <AssignmentRow
                  key={a.id}
                  rfqId={rfqId}
                  assignment={a}
                  onRemove={() => removeAssignment(a.id)}
                />
              ))}
            </ul>
          )}

          {leadCount === 0 && assignments.length > 0 && (
            <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
              ⚠ No Lead Pricer designated. Pick one (⭐) so the quote can be
              submitted for approval.
            </p>
          )}
          {leadCount > 1 && (
            <p className="mt-3 rounded-md border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
              ⚠ {leadCount} Lead Pricers designated — should be exactly 1.
              Toggle the ⭐ off on the duplicate rows.
            </p>
          )}
        </CardContent>
      </Card>

      {availableDepts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add pricer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3 md:items-end">
            <div>
              <Label>Department</Label>
              <Select value={newDept} onValueChange={setNewDept}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pick a department" />
                </SelectTrigger>
                <SelectContent>
                  {availableDepts.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nameAr ?? d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Engineer / Manager</Label>
              <div className="mt-1">
                <UserPicker value={newUser} onChange={setNewUser} />
              </div>
            </div>
            <Button
              onClick={addAssignment}
              disabled={!newDept || !newUser || create.isPending}
            >
              <Plus className="mr-2 h-4 w-4" />
              {create.isPending ? 'Adding…' : 'Add'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AssignmentRow({
  rfqId,
  assignment,
  onRemove,
}: {
  rfqId: string;
  assignment: RfqAssignment;
  onRemove: () => void;
}) {
  const update = useUpdateRfqAssignment(rfqId, assignment.id);
  const Icon = assignment.isLeadPricer ? Star : StarOff;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border bg-card p-3">
      <button
        type="button"
        title={
          assignment.isLeadPricer
            ? 'Lead Pricer (assembles the quote)'
            : 'Designate as Lead Pricer'
        }
        aria-pressed={assignment.isLeadPricer}
        onClick={() =>
          update
            .mutateAsync({ isLeadPricer: !assignment.isLeadPricer })
            .then(() =>
              toast.success(
                assignment.isLeadPricer
                  ? 'Lead Pricer flag cleared.'
                  : 'Lead Pricer designated.',
              ),
            )
            .catch(() => toast.error('Failed to update.'))
        }
        className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
          assignment.isLeadPricer
            ? 'border-amber-300 bg-amber-50 text-amber-600'
            : 'hover:bg-accent'
        }`}
      >
        <Icon className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">
          {assignment.department.nameAr ?? assignment.department.name}
        </div>
        <div className="text-xs text-muted-foreground">
          Assignee ID:{' '}
          <span className="font-mono">{assignment.assigneeId}</span>
        </div>
      </div>

      <Badge variant="outline" className="text-xs">
        {assignment.status.replace(/_/g, ' ')}
      </Badge>

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-destructive"
        onClick={onRemove}
        title={
          assignment.isLeadPricer
            ? 'Designate another assignee as Lead Pricer first'
            : 'Remove'
        }
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}
