'use client';

import { use, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Landmark,
  MapPin,
  Plus,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  useGovTransaction,
  useLogGovComment,
  useLogGovVisit,
  useRespondToGovComment,
  useUploadGovDocument,
  useWeeklyStatusUpdate,
} from '@/lib/hooks/use-gov';
import type { GovComment } from '@/lib/types/gov';
import { StatusPill } from '@/components/projects/status-dot';
import { GOV_TONE } from '@/components/projects/gov-status-tone';
import { UserAvatar } from '@/components/ui/user-avatar';
import { cn } from '@/lib/utils';

async function runWithToast<T>(t: (k: string) => string, fn: () => Promise<T>) {
  try {
    await fn();
    toast.success(t('common.success'));
    return true;
  } catch (err) {
    const msg =
      (err as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message ?? t('errors.generic');
    toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    return false;
  }
}

export default function GovDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations();
  const { data: tx, isLoading } = useGovTransaction(id);
  const weekly = useWeeklyStatusUpdate(id);

  const [visitOpen, setVisitOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  if (isLoading || !tx) {
    return (
      <div className="space-y-4">
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {tx.transactionNumber}
                </span>
                <StatusPill
                  tone={GOV_TONE[tx.status]}
                  label={t(`gov.status.${tx.status}`)}
                />
                <span className="rounded-full border px-2 py-0.5 text-[11px]">
                  {t(`gov.category.${tx.authorityCategory}`)}
                </span>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-abak-blue">
                {tx.transactionType}
              </h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Landmark className="h-4 w-4" />
                {tx.authorityName}
              </p>
            </div>
          </div>

          <div className="grid gap-4 border-t pt-4 md:grid-cols-4">
            <Meta
              label={t('gov.project')}
              value={`${tx.project.projectNumber} — ${tx.project.title}`}
            />
            <Meta
              label={t('gov.referenceNumber')}
              value={tx.referenceNumber ?? '—'}
            />
            <Meta
              label={t('gov.submittedAt')}
              value={tx.submittedAt?.slice(0, 10) ?? '—'}
            />
            <Meta
              label={t('gov.expectedResponseAt')}
              value={tx.expectedResponseAt?.slice(0, 10) ?? '—'}
            />
            {tx.assignedPro && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('gov.pro')}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                  <UserAvatar
                    firstName={tx.assignedPro.firstName}
                    lastName={tx.assignedPro.lastName}
                    size="sm"
                  />
                  {`${tx.assignedPro.firstName ?? ''} ${tx.assignedPro.lastName ?? ''}`.trim()}
                </div>
              </div>
            )}
            {tx.assignedEngineer && (
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t('gov.engineer')}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-sm font-medium">
                  <UserAvatar
                    firstName={tx.assignedEngineer.firstName}
                    lastName={tx.assignedEngineer.lastName}
                    size="sm"
                  />
                  {`${tx.assignedEngineer.firstName ?? ''} ${tx.assignedEngineer.lastName ?? ''}`.trim()}
                </div>
              </div>
            )}
            {tx.fees != null && (
              <Meta
                label={t('gov.fees')}
                value={`${tx.fees.toLocaleString()} ${t('units.sar')}`}
              />
            )}
            {tx.weeklyStatusLastAt && (
              <Meta
                label={t('gov.weeklyStatus.lastUpdated')}
                value={tx.weeklyStatusLastAt.slice(0, 10)}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              size="sm"
              variant="outline"
              onClick={() => runWithToast(t, () => weekly.mutateAsync({}))}
              disabled={weekly.isPending}
            >
              <CalendarClock className="me-2 h-4 w-4" />
              {t('gov.weeklyStatus.markUpdated')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="visits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits">
            {t('gov.tabs.visits')} · {tx.visits.length}
          </TabsTrigger>
          <TabsTrigger value="comments">
            {t('gov.tabs.comments')} · {tx.comments.length}
          </TabsTrigger>
          <TabsTrigger value="documents">
            {t('gov.tabs.documents')} · {tx.documents.length}
          </TabsTrigger>
        </TabsList>

        {/* Visits */}
        <TabsContent value="visits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t('gov.visit.heading')}
              </CardTitle>
              <Button size="sm" onClick={() => setVisitOpen(true)}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t('gov.visit.newVisit')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {tx.visits.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('gov.visit.empty')}
                </div>
              ) : (
                tx.visits.map((v) => (
                  <div
                    key={v.id}
                    className="rounded-md border bg-white p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <UserAvatar
                        firstName={v.visitedBy.firstName}
                        lastName={v.visitedBy.lastName}
                        size="xs"
                      />
                      <span>
                        {`${v.visitedBy.firstName ?? ''} ${v.visitedBy.lastName ?? ''}`.trim()}
                      </span>
                      <span>·</span>
                      <span>{v.visitedAt.slice(0, 10)}</span>
                      {v.latitude != null && v.longitude != null && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {v.latitude.toFixed(4)}, {v.longitude.toFixed(4)}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 font-medium">{v.purpose}</div>
                    {v.outcome && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {v.outcome}
                      </div>
                    )}
                    {v.nextAction && (
                      <div className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs text-amber-800">
                        → {v.nextAction}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comments */}
        <TabsContent value="comments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t('gov.comment.heading')}
              </CardTitle>
              <Button size="sm" onClick={() => setCommentOpen(true)}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t('gov.comment.newComment')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {tx.comments.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('gov.comment.empty')}
                </div>
              ) : (
                tx.comments.map((c) => (
                  <CommentRow key={c.id} comment={c} transactionId={id} />
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {t('gov.document.heading')}
              </CardTitle>
              <Button size="sm" onClick={() => setDocOpen(true)}>
                <Plus className="me-1 h-3.5 w-3.5" />
                {t('gov.document.newDocument')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {tx.documents.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  {t('gov.document.empty')}
                </div>
              ) : (
                tx.documents.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-md border bg-white p-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={d.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-abak-blue hover:underline"
                      >
                        {d.title}
                      </a>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {d.uploadedAt.slice(0, 10)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <LogVisitDialog
        open={visitOpen}
        onOpenChange={setVisitOpen}
        transactionId={id}
      />
      <LogCommentDialog
        open={commentOpen}
        onOpenChange={setCommentOpen}
        transactionId={id}
      />
      <UploadDocDialog
        open={docOpen}
        onOpenChange={setDocOpen}
        transactionId={id}
      />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function CommentRow({
  comment,
  transactionId,
}: {
  comment: GovComment;
  transactionId: string;
}) {
  const t = useTranslations();
  const respond = useRespondToGovComment(transactionId);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  return (
    <div
      className={cn(
        'rounded-md border p-3 text-sm',
        comment.respondedAt ? 'bg-emerald-50/40' : 'bg-amber-50/30',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{comment.issuedAt.slice(0, 10)}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-medium',
            comment.respondedAt
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-amber-100 text-amber-800',
          )}
        >
          {comment.respondedAt
            ? t('gov.comment.respondedBadge')
            : t('gov.comment.pendingBadge')}
        </span>
      </div>
      <div className="mt-1">{comment.commentText}</div>
      {comment.respondedAt && comment.responseText && (
        <div className="mt-2 border-s-2 border-emerald-400 bg-white/70 ps-3 py-1 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
            {comment.respondedAt.slice(0, 10)}
          </div>
          <div className="mt-0.5">{comment.responseText}</div>
        </div>
      )}
      {!comment.respondedAt && (
        <div className="mt-2 space-y-2">
          {!open ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
              {t('gov.comment.respond')}
            </Button>
          ) : (
            <>
              <Textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('gov.comment.responseText')}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    const ok = await runWithToast(t, () =>
                      respond.mutateAsync({
                        commentId: comment.id,
                        responseText: text.trim(),
                      }),
                    );
                    if (ok) {
                      setOpen(false);
                      setText('');
                    }
                  }}
                  disabled={text.trim().length < 3 || respond.isPending}
                >
                  {t('common.save')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function LogVisitDialog({
  open,
  onOpenChange,
  transactionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactionId: string;
}) {
  const t = useTranslations();
  const log = useLogGovVisit(transactionId);
  const [purpose, setPurpose] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextAction, setNextAction] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('gov.visit.newVisit')}</DialogTitle>
          <DialogDescription>{t('gov.visit.sameDay')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="purpose">{t('gov.visit.purpose')}</Label>
            <Input
              id="purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="outcome">{t('gov.visit.outcome')}</Label>
            <Textarea
              id="outcome"
              rows={2}
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nextAction">{t('gov.visit.nextAction')}</Label>
            <Input
              id="nextAction"
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={purpose.trim().length < 3 || log.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                log.mutateAsync({
                  visitedAt: new Date().toISOString(),
                  purpose: purpose.trim(),
                  outcome: outcome.trim() || undefined,
                  nextAction: nextAction.trim() || undefined,
                }),
              );
              if (ok) {
                onOpenChange(false);
                setPurpose('');
                setOutcome('');
                setNextAction('');
              }
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LogCommentDialog({
  open,
  onOpenChange,
  transactionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactionId: string;
}) {
  const t = useTranslations();
  const log = useLogGovComment(transactionId);
  const [commentText, setCommentText] = useState('');
  const [issuedAt, setIssuedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('gov.comment.newComment')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-text">{t('gov.comment.commentText')}</Label>
            <Textarea
              id="c-text"
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-date">{t('gov.comment.issuedAt')}</Label>
            <Input
              id="c-date"
              type="date"
              value={issuedAt}
              onChange={(e) => setIssuedAt(e.target.value)}
              className="max-w-[12rem]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={commentText.trim().length < 3 || log.isPending}
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                log.mutateAsync({
                  commentText: commentText.trim(),
                  issuedAt: new Date(issuedAt).toISOString(),
                }),
              );
              if (ok) {
                onOpenChange(false);
                setCommentText('');
              }
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UploadDocDialog({
  open,
  onOpenChange,
  transactionId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  transactionId: string;
}) {
  const t = useTranslations();
  const upload = useUploadGovDocument(transactionId);
  const [title, setTitle] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('gov.document.newDocument')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="d-title">{t('gov.document.docTitle')}</Label>
            <Input
              id="d-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-url">{t('gov.document.fileUrl')}</Label>
            <Input
              id="d-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={
              title.trim().length < 2 ||
              fileUrl.trim().length < 3 ||
              upload.isPending
            }
            onClick={async () => {
              const ok = await runWithToast(t, () =>
                upload.mutateAsync({
                  title: title.trim(),
                  fileUrl: fileUrl.trim(),
                }),
              );
              if (ok) {
                onOpenChange(false);
                setTitle('');
                setFileUrl('');
              }
            }}
          >
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
