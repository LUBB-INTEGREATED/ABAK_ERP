'use client';

import { useState, use } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserPicker } from '@/components/ui/user-picker';
import { PricerAssignments } from '@/components/rfqs/pricer-assignments';
import {
  RfqPriorityBadge,
  RfqStatusBadge,
} from '@/components/ui/entity-status-badges';
import {
  useAssignContributor,
  useAssignCoordinator,
  useCancelRfq,
  useDispatchRfq,
  useRecordOutcome,
  useRfq,
  useStartPreparation,
  useSubmitForApproval,
} from '@/lib/hooks/use-rfqs';
import type { ConfirmationType, RfqDispatchChannel } from '@/lib/types/rfq';

export default function RfqDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const { data: rfq, isLoading } = useRfq(id);

  const assignCoordinator = useAssignCoordinator(id);
  const assignContributor = useAssignContributor(id);
  const startPreparation = useStartPreparation(id);
  const submitForApproval = useSubmitForApproval(id);
  const dispatchRfq = useDispatchRfq(id);
  const recordOutcome = useRecordOutcome(id);
  const cancelRfq = useCancelRfq(id);

  const [coordinatorId, setCoordinatorId] = useState('');
  const [contributorUserId, setContributorUserId] = useState('');
  const [contributorRole, setContributorRole] = useState<
    'TECHNICAL' | 'FINANCIAL'
  >('TECHNICAL');
  const [dispatchChannel, setDispatchChannel] =
    useState<RfqDispatchChannel>('WHATSAPP');
  const [outcome, setOutcome] = useState<'WON' | 'LOST' | 'POSTPONED'>('WON');
  const [confirmationType, setConfirmationType] =
    useState<ConfirmationType>('PO');
  const [confirmationValue, setConfirmationValue] = useState<number | ''>('');
  const [confirmationAt, setConfirmationAt] = useState('');
  const [lostReason, setLostReason] = useState('');
  const [postponedUntil, setPostponedUntil] = useState('');

  if (isLoading || !rfq) {
    return (
      <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
    );
  }

  async function run<T>(fn: () => Promise<T>, successKey = 'common.success') {
    try {
      await fn();
      toast.success(t(successKey));
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ?? t('errors.generic');
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    }
  }

  const canAssign = rfq.status === 'RECEIVED' || rfq.status === 'ASSIGNED';
  const canStartPrep = rfq.status === 'ASSIGNED';
  const canSubmit = rfq.status === 'IN_PREPARATION' && !!rfq.quoteId;
  const canDispatch = rfq.status === 'APPROVED_READY_FOR_DISPATCH';
  const canRecordOutcome = rfq.status === 'SENT';
  const canCancel = !['WON', 'LOST', 'CANCELLED'].includes(rfq.status);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold text-abak-blue">
            {rfq.rfqNumber}
          </h1>
          <RfqStatusBadge status={rfq.status} size="md" />
          <RfqPriorityBadge priority={rfq.priority} dot />
          <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
            {t(`rfq.sourceLabel.${rfq.requestedByChannel}`)}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {rfq.client?.companyName ?? rfq.client?.contactName}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">{t('rfq.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="team">{t('rfq.tabs.team')}</TabsTrigger>
          <TabsTrigger value="quote">{t('rfq.tabs.quote')}</TabsTrigger>
          <TabsTrigger value="outcome">{t('rfq.tabs.outcome')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('rfq.tabs.overview')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <Info label={t('rfq.serviceType')} value={rfq.serviceType} />
              <Info
                label={t('rfq.priority')}
                value={t(`rfq.priorityLabel.${rfq.priority}`)}
              />
              <Info
                label={t('rfq.source')}
                value={t(`rfq.sourceLabel.${rfq.requestedByChannel}`)}
              />
              {rfq.brokerName && (
                <Info label={t('rfq.broker')} value={rfq.brokerName} />
              )}
              {rfq.brokerPhone && (
                <Info label={t('rfq.brokerPhone')} value={rfq.brokerPhone} />
              )}
              <div className="md:col-span-2">
                <Info label={t('rfq.scope')} value={rfq.projectScope} pre />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-wrap gap-2 py-4">
              {canStartPrep && (
                <Button
                  onClick={() => run(() => startPreparation.mutateAsync())}
                  disabled={startPreparation.isPending}
                >
                  {t('rfq.startPreparation')}
                </Button>
              )}
              {canSubmit && (
                <Button
                  onClick={() => run(() => submitForApproval.mutateAsync())}
                  disabled={submitForApproval.isPending}
                >
                  {t('rfq.submitForApproval')}
                </Button>
              )}
              {canDispatch && (
                <div className="flex items-center gap-2">
                  <select
                    value={dispatchChannel}
                    onChange={(e) =>
                      setDispatchChannel(e.target.value as RfqDispatchChannel)
                    }
                    className="input-base w-36"
                  >
                    <option value="WHATSAPP">
                      {t('rfq.dispatchChannel.WHATSAPP')}
                    </option>
                    <option value="EMAIL">
                      {t('rfq.dispatchChannel.EMAIL')}
                    </option>
                  </select>
                  <Button
                    onClick={() =>
                      run(() =>
                        dispatchRfq.mutateAsync({ channel: dispatchChannel }),
                      )
                    }
                    disabled={dispatchRfq.isPending}
                  >
                    {t('rfq.dispatch')}
                  </Button>
                </div>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  onClick={() => run(() => cancelRfq.mutateAsync())}
                  disabled={cancelRfq.isPending}
                >
                  {t('rfq.cancel')}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {/* New 2026-05-21 model: per-department pricer assignments with
              Lead Pricer designation. Replaces the RFQ Engineer + Financial
              Reviewer split. See docs/CORRECTED_CLIENT_JOURNEY.md §C. */}
          <PricerAssignments rfqId={rfq.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Legacy assignments (pre-2026-05-21)
              </CardTitle>
              <CardDescription>
                The old three-user assignment model. Kept visible for in-flight
                RFQs created under the previous process; new RFQs use the
                per-department Lead Pricer model above.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <PersonInfo
                label={t('rfq.coordinator')}
                person={rfq.coordinator}
              />
              <PersonInfo
                label={t('rfq.technicalContributor')}
                person={rfq.technicalContributor}
              />
              <PersonInfo
                label={t('rfq.financialReviewer')}
                person={rfq.financialReviewer}
              />
              <PersonInfo
                label={t('rfq.originalRep')}
                person={rfq.originalSalesRep}
              />
            </CardContent>
          </Card>

          {canAssign && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('rfq.assignCoordinator')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <div className="w-full max-w-xs">
                  <UserPicker
                    value={coordinatorId}
                    onChange={setCoordinatorId}
                  />
                </div>
                <Button
                  onClick={() =>
                    run(() => assignCoordinator.mutateAsync({ coordinatorId }))
                  }
                  disabled={
                    assignCoordinator.isPending || !coordinatorId.trim()
                  }
                >
                  {t('common.save')}
                </Button>
              </CardContent>
            </Card>
          )}

          {(rfq.status === 'ASSIGNED' || rfq.status === 'IN_PREPARATION') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {t('rfq.technicalContributor')} / {t('rfq.financialReviewer')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-2">
                <select
                  value={contributorRole}
                  onChange={(e) =>
                    setContributorRole(
                      e.target.value as 'TECHNICAL' | 'FINANCIAL',
                    )
                  }
                  className="input-base w-36"
                >
                  <option value="TECHNICAL">
                    {t('rfq.technicalContributor')}
                  </option>
                  <option value="FINANCIAL">
                    {t('rfq.financialReviewer')}
                  </option>
                </select>
                <div className="w-full max-w-xs">
                  <UserPicker
                    value={contributorUserId}
                    onChange={setContributorUserId}
                  />
                </div>
                <Button
                  onClick={() =>
                    run(() =>
                      assignContributor.mutateAsync({
                        role: contributorRole,
                        userId: contributorUserId,
                      }),
                    )
                  }
                  disabled={
                    assignContributor.isPending || !contributorUserId.trim()
                  }
                >
                  {t('common.save')}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="quote" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('rfq.tabs.quote')}</CardTitle>
            </CardHeader>
            <CardContent>
              {rfq.quote ? (
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      {t('nav.quotes')}:
                    </span>{' '}
                    <span className="font-mono">{rfq.quote.quoteNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t('common.statusLabel')}:
                    </span>{' '}
                    {rfq.quote.status}
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {t('units.sar')}:
                    </span>{' '}
                    {rfq.quote.totalAmount.toLocaleString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {t('common.empty')}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outcome" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t('rfq.recordOutcome')}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {!canRecordOutcome &&
                rfq.status !== 'WON' &&
                rfq.status !== 'LOST' && (
                  <div className="md:col-span-2 text-sm text-muted-foreground">
                    {t('rfq.status.SENT')} {t('common.required').toLowerCase()}
                  </div>
                )}

              {canRecordOutcome && (
                <>
                  <label className="text-sm">
                    <span className="mb-1 block font-medium">
                      {t('common.statusLabel')}
                    </span>
                    <select
                      value={outcome}
                      onChange={(e) =>
                        setOutcome(
                          e.target.value as 'WON' | 'LOST' | 'POSTPONED',
                        )
                      }
                      className="input-base"
                    >
                      <option value="WON">{t('rfq.outcome.WON')}</option>
                      <option value="LOST">{t('rfq.outcome.LOST')}</option>
                      <option value="POSTPONED">
                        {t('rfq.outcome.POSTPONED')}
                      </option>
                    </select>
                  </label>

                  {outcome === 'WON' && (
                    <>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">
                          {t('rfq.outcome.confirmationType')}
                        </span>
                        <select
                          value={confirmationType}
                          onChange={(e) =>
                            setConfirmationType(
                              e.target.value as ConfirmationType,
                            )
                          }
                          className="input-base"
                        >
                          <option value="PO">
                            {t('rfq.confirmationType.PO')}
                          </option>
                          <option value="PAYMENT">
                            {t('rfq.confirmationType.PAYMENT')}
                          </option>
                          <option value="CONTRACT">
                            {t('rfq.confirmationType.CONTRACT')}
                          </option>
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">
                          {t('rfq.outcome.confirmationAt')}
                        </span>
                        <input
                          type="date"
                          value={confirmationAt}
                          onChange={(e) => setConfirmationAt(e.target.value)}
                          className="input-base"
                        />
                      </label>
                      <label className="text-sm">
                        <span className="mb-1 block font-medium">
                          {t('rfq.outcome.confirmationValue')} ({t('units.sar')}
                          )
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={confirmationValue}
                          onChange={(e) =>
                            setConfirmationValue(
                              e.target.value === ''
                                ? ''
                                : Number(e.target.value),
                            )
                          }
                          className="input-base"
                        />
                      </label>
                    </>
                  )}

                  {outcome === 'LOST' && (
                    <label className="md:col-span-2 text-sm">
                      <span className="mb-1 block font-medium">
                        {t('rfq.outcome.lostReason')}
                      </span>
                      <textarea
                        rows={3}
                        value={lostReason}
                        onChange={(e) => setLostReason(e.target.value)}
                        className="input-base"
                      />
                    </label>
                  )}

                  {outcome === 'POSTPONED' && (
                    <label className="text-sm">
                      <span className="mb-1 block font-medium">
                        {t('rfq.outcome.postponedUntil')}
                      </span>
                      <input
                        type="date"
                        value={postponedUntil}
                        onChange={(e) => setPostponedUntil(e.target.value)}
                        className="input-base"
                      />
                    </label>
                  )}

                  <div className="md:col-span-2">
                    <Button
                      onClick={() =>
                        run(() =>
                          recordOutcome.mutateAsync({
                            outcome,
                            confirmationType:
                              outcome === 'WON' ? confirmationType : undefined,
                            confirmationAt:
                              outcome === 'WON'
                                ? new Date(confirmationAt).toISOString()
                                : undefined,
                            confirmationValue:
                              outcome === 'WON' &&
                              typeof confirmationValue === 'number'
                                ? confirmationValue
                                : undefined,
                            lostReason:
                              outcome === 'LOST' ? lostReason : undefined,
                            postponedUntil:
                              outcome === 'POSTPONED'
                                ? new Date(postponedUntil).toISOString()
                                : undefined,
                          }),
                        )
                      }
                      disabled={recordOutcome.isPending}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                </>
              )}

              {(rfq.status === 'WON' || rfq.status === 'LOST') && (
                <div className="md:col-span-2 rounded-md border bg-muted/40 p-3 text-sm">
                  {rfq.status === 'WON' && rfq.confirmationType && (
                    <>
                      <div>
                        {t('rfq.outcome.confirmationType')}:{' '}
                        {t(`rfq.confirmationType.${rfq.confirmationType}`)}
                      </div>
                      <div>
                        {t('rfq.outcome.confirmationValue')}:{' '}
                        {rfq.confirmationValue?.toLocaleString()}{' '}
                        {t('units.sar')}
                      </div>
                    </>
                  )}
                  {rfq.status === 'LOST' && rfq.lostReason && (
                    <div>
                      {t('rfq.outcome.lostReason')}: {rfq.lostReason}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Info({
  label,
  value,
  pre,
}: {
  label: string;
  value: string | null | undefined;
  pre?: boolean;
}) {
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={pre ? 'whitespace-pre-wrap' : ''}>{value || '—'}</div>
    </div>
  );
}

function PersonInfo({
  label,
  person,
}: {
  label: string;
  person: {
    firstName: string | null;
    lastName: string | null;
    email?: string;
  } | null;
}) {
  const full = person
    ? `${person.firstName ?? ''} ${person.lastName ?? ''}`.trim()
    : '';
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{full || '—'}</div>
      {person?.email && (
        <div className="text-xs text-muted-foreground">{person.email}</div>
      )}
    </div>
  );
}
