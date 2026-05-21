'use client';

/**
 * Admin → Pricing Policy.
 *
 * Singleton configuration that drives discount + quote approval routing.
 * Added 2026-05-21 per the process correction. The Sales Person can grant
 * discounts up to `salesCeilingPct` without approval; anything above
 * routes through the configured tiered or sequential chain.
 *
 * Norman notes:
 * - "Live preview" panel reads the policy back in plain language as the
 *   admin edits — the conceptual model surface. Updates in real time so
 *   the admin can predict what will happen without running a test.
 * - Mode toggle (tiered / sequential) hides the inactive editor — only
 *   the controls that apply to the current mode are visible.
 * - All discount thresholds are clamped to [0, 100] so a slip can't enter
 *   nonsense.
 *
 * See docs/CORRECTED_CLIENT_JOURNEY.md §6.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  usePricingPolicy,
  useUpdatePricingPolicy,
  type PricingPolicy,
  type PricingPolicyApprover,
  type PricingPolicyMode,
  type PricingPolicySequenceItem,
  type PricingPolicyTier,
} from '@/lib/hooks/use-pricing-policy';

const APPROVER_LABELS: Record<PricingPolicyApprover, string> = {
  SALES_MANAGER: 'Sales Manager',
  CEO: 'CEO',
  TECHNICAL_MANAGER: 'Technical Manager',
  FINANCE_MANAGER: 'Finance Manager',
};

const APPROVER_OPTIONS: PricingPolicyApprover[] = [
  'SALES_MANAGER',
  'TECHNICAL_MANAGER',
  'FINANCE_MANAGER',
  'CEO',
];

export default function PricingPolicyAdminPage() {
  const { data: policy, isLoading } = usePricingPolicy();
  const update = useUpdatePricingPolicy();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Loading…
        </CardContent>
      </Card>
    );
  }
  if (!policy) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Failed to load pricing policy.
        </CardContent>
      </Card>
    );
  }
  return <PolicyEditor key={policy.id} initial={policy} save={update} />;
}

function PolicyEditor({
  initial,
  save,
}: {
  initial: PricingPolicy;
  save: ReturnType<typeof useUpdatePricingPolicy>;
}) {
  const [salesCeilingPct, setSalesCeilingPct] = useState(
    initial.salesCeilingPct,
  );
  const [mode, setMode] = useState<PricingPolicyMode>(initial.mode);
  const [tiers, setTiers] = useState<PricingPolicyTier[]>(initial.tiers ?? []);
  const [sequence, setSequence] = useState<PricingPolicySequenceItem[]>(
    initial.sequence ?? [],
  );
  const [vatPct, setVatPct] = useState(initial.vatPct);
  const [currency, setCurrency] = useState(initial.currency);

  const dirty = useMemo(() => {
    return (
      salesCeilingPct !== initial.salesCeilingPct ||
      mode !== initial.mode ||
      JSON.stringify(tiers) !== JSON.stringify(initial.tiers ?? []) ||
      JSON.stringify(sequence) !== JSON.stringify(initial.sequence ?? []) ||
      vatPct !== initial.vatPct ||
      currency !== initial.currency
    );
  }, [
    salesCeilingPct,
    mode,
    tiers,
    sequence,
    vatPct,
    currency,
    initial.salesCeilingPct,
    initial.mode,
    initial.tiers,
    initial.sequence,
    initial.vatPct,
    initial.currency,
  ]);

  useEffect(() => {
    if (mode === 'TIERED' && tiers.length === 0) {
      setTiers([
        { upToPct: 10, approver: 'SALES_MANAGER' },
        { upToPct: 100, approver: 'CEO' },
      ]);
    }
    if (mode === 'SEQUENTIAL' && sequence.length === 0) {
      setSequence([
        { approver: 'SALES_MANAGER', order: 1 },
        { approver: 'CEO', order: 2 },
      ]);
    }
  }, [mode, tiers.length, sequence.length]);

  async function submit() {
    try {
      await save.mutateAsync({
        salesCeilingPct,
        mode,
        tiers,
        sequence,
        vatPct,
        currency,
      });
      toast.success('Policy saved.');
    } catch {
      toast.error('Failed to save policy.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pricing Policy</h1>
          <p className="text-sm text-muted-foreground">
            Drives discount + quote approval routing. The Sales Person can grant
            discounts up to the ceiling without approval; anything above flows
            through the chain below.
          </p>
        </div>
        <Button onClick={submit} disabled={!dirty || save.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Sales ceiling & currency
              </CardTitle>
              <CardDescription>
                Default discount the Sales Person can grant unilaterally.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="ceiling">Sales ceiling (%)</Label>
                <Input
                  id="ceiling"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={salesCeilingPct}
                  onChange={(e) =>
                    setSalesCeilingPct(clampPct(Number(e.target.value)))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="vat">VAT (%)</Label>
                <Input
                  id="vat"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={vatPct}
                  onChange={(e) => setVatPct(clampPct(Number(e.target.value)))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="currency">Currency</Label>
                <Input
                  id="currency"
                  value={currency}
                  onChange={(e) =>
                    setCurrency(e.target.value.toUpperCase().slice(0, 4))
                  }
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Above-ceiling approval chain
              </CardTitle>
              <CardDescription>
                Pick the routing model. Tiered = different approvers per
                discount band. Sequential = every approver, in order.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ModeToggle mode={mode} setMode={setMode} />

              {mode === 'TIERED' ? (
                <TieredEditor
                  ceiling={salesCeilingPct}
                  tiers={tiers}
                  setTiers={setTiers}
                />
              ) : (
                <SequentialEditor
                  sequence={sequence}
                  setSequence={setSequence}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Policy preview</CardTitle>
            <CardDescription>
              How the system will route requests under the current settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyPreview
              ceiling={salesCeilingPct}
              mode={mode}
              tiers={tiers}
              sequence={sequence}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  setMode,
}: {
  mode: PricingPolicyMode;
  setMode: (m: PricingPolicyMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setMode('TIERED')}
        className={`rounded-md border p-3 text-start text-sm transition-colors ${
          mode === 'TIERED'
            ? 'border-abak-blue bg-abak-blue/10'
            : 'hover:bg-accent'
        }`}
      >
        <div className="font-semibold">Tiered</div>
        <div className="text-xs text-muted-foreground">
          Different approvers per band, e.g. ≤10% → Manager, &gt;10% → CEO.
        </div>
      </button>
      <button
        type="button"
        onClick={() => setMode('SEQUENTIAL')}
        className={`rounded-md border p-3 text-start text-sm transition-colors ${
          mode === 'SEQUENTIAL'
            ? 'border-abak-blue bg-abak-blue/10'
            : 'hover:bg-accent'
        }`}
      >
        <div className="font-semibold">Sequential</div>
        <div className="text-xs text-muted-foreground">
          Each above-ceiling request goes through every approver, in order.
        </div>
      </button>
    </div>
  );
}

function TieredEditor({
  ceiling,
  tiers,
  setTiers,
}: {
  ceiling: number;
  tiers: PricingPolicyTier[];
  setTiers: (t: PricingPolicyTier[]) => void;
}) {
  function update(i: number, patch: Partial<PricingPolicyTier>) {
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function remove(i: number) {
    setTiers(tiers.filter((_, idx) => idx !== i));
  }
  function add() {
    setTiers([
      ...tiers,
      {
        upToPct: Math.min(100, ceiling + 10),
        approver: 'SALES_MANAGER',
      },
    ]);
  }
  const sorted = [...tiers].sort((a, b) => a.upToPct - b.upToPct);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-4">Up to discount %</div>
        <div className="col-span-7">Approver</div>
        <div className="col-span-1" />
      </div>
      {sorted.map((tier, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <Input
            type="number"
            min={ceiling}
            max={100}
            step={0.5}
            value={tier.upToPct}
            onChange={(e) =>
              update(i, { upToPct: clampPct(Number(e.target.value)) })
            }
            className="col-span-4"
          />
          <Select
            value={tier.approver}
            onValueChange={(v) =>
              update(i, { approver: v as PricingPolicyApprover })
            }
          >
            <SelectTrigger className="col-span-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPROVER_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {APPROVER_LABELS[opt]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="col-span-1 h-9 w-9 text-destructive"
            onClick={() => remove(i)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Add tier
      </Button>
    </div>
  );
}

function SequentialEditor({
  sequence,
  setSequence,
}: {
  sequence: PricingPolicySequenceItem[];
  setSequence: (s: PricingPolicySequenceItem[]) => void;
}) {
  function move(i: number, dir: -1 | 1) {
    const target = i + dir;
    if (target < 0 || target >= sequence.length) return;
    const copy = [...sequence];
    [copy[i], copy[target]] = [copy[target], copy[i]];
    setSequence(copy.map((s, idx) => ({ ...s, order: idx + 1 })));
  }
  function remove(i: number) {
    setSequence(
      sequence
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, order: idx + 1 })),
    );
  }
  function update(i: number, approver: PricingPolicyApprover) {
    setSequence(sequence.map((s, idx) => (idx === i ? { ...s, approver } : s)));
  }
  function add() {
    setSequence([
      ...sequence,
      { approver: 'SALES_MANAGER', order: sequence.length + 1 },
    ]);
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
        <div className="col-span-1">#</div>
        <div className="col-span-8">Approver</div>
        <div className="col-span-3 text-end">Reorder</div>
      </div>
      {sequence
        .sort((a, b) => a.order - b.order)
        .map((item, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-1 font-mono text-sm text-muted-foreground">
              {i + 1}
            </div>
            <Select
              value={item.approver}
              onValueChange={(v) => update(i, v as PricingPolicyApprover)}
            >
              <SelectTrigger className="col-span-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPROVER_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {APPROVER_LABELS[opt]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="col-span-3 flex justify-end gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => move(i, -1)}
                disabled={i === 0}
              >
                ↑
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => move(i, 1)}
                disabled={i === sequence.length - 1}
              >
                ↓
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      <Button variant="outline" size="sm" onClick={add}>
        <Plus className="mr-2 h-4 w-4" />
        Add approver
      </Button>
    </div>
  );
}

function PolicyPreview({
  ceiling,
  mode,
  tiers,
  sequence,
}: {
  ceiling: number;
  mode: PricingPolicyMode;
  tiers: PricingPolicyTier[];
  sequence: PricingPolicySequenceItem[];
}) {
  const sorted = [...tiers].sort((a, b) => a.upToPct - b.upToPct);
  return (
    <ol className="space-y-2 text-sm">
      <li className="rounded-md border bg-muted/30 p-2">
        Sales rep grants <strong>≤{ceiling}%</strong> → no approval.
      </li>
      {mode === 'TIERED' ? (
        sorted.map((tier, i) => {
          const lower = i === 0 ? ceiling : sorted[i - 1].upToPct;
          const chain = sorted
            .slice(0, i + 1)
            .map((t) => APPROVER_LABELS[t.approver])
            .join(' then ');
          return (
            <li key={i} className="rounded-md border bg-muted/30 p-2">
              <strong>
                {lower}–{tier.upToPct}%
              </strong>{' '}
              → {chain}.
            </li>
          );
        })
      ) : (
        <li className="rounded-md border bg-muted/30 p-2">
          <strong>&gt;{ceiling}%</strong> →{' '}
          {sequence
            .sort((a, b) => a.order - b.order)
            .map((s) => APPROVER_LABELS[s.approver])
            .join(' then ')}
          .
        </li>
      )}
    </ol>
  );
}

function clampPct(n: number) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
