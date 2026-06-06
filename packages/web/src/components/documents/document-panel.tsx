'use client';

/**
 * WS-D / DOC-A — <DocumentPanel> (Wave-0).
 *
 * A single reusable document surface embedded per business entity (project /
 * gov-tx / quote / client / lead / finance). It provides:
 *   - drag-drop + browse upload (PDF / DWG / ZIP / images, ≤25MB) with a
 *     category picker;
 *   - a list with a category filter and per-row download / delete;
 *   - a warm empty state with a primary "رفع وثيقة" action;
 *   - a 403 no-access state (when the caller can't see the owning entity).
 *
 * Access is enforced server-side against the owning entity; this component just
 * surfaces it. Wave-0 = basic document management — NO versioning / Rev /
 * stamps / diff (deferred DOC-B wave). en + ar, RTL-safe (logical spacing).
 */

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Download, FileText, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NoAccess } from '@/components/auth/no-access';
import { isForbiddenError } from '@/lib/api-client';
import {
  downloadDocument,
  useDeleteDocument,
  useEntityDocuments,
  useUploadDocument,
  type DocumentCategory,
  type DocumentEntityType,
  type DocumentRecord,
} from '@/lib/hooks/use-documents';

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPT = '.pdf,.dwg,.zip,.png,.jpg,.jpeg,.webp,.gif';
const CATEGORIES: DocumentCategory[] = [
  'ARCHITECTURAL',
  'STRUCTURAL',
  'LICENSE',
  'FINANCIAL',
  'CONTRACT',
  'OTHER',
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentPanel({
  entityType,
  entityId,
  className,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  className?: string;
}) {
  const t = useTranslations('documents');
  const tEnum = useTranslations('documents.category');
  const [filter, setFilter] = useState<DocumentCategory | 'ALL'>('ALL');
  const [uploadOpen, setUploadOpen] = useState(false);

  const list = useEntityDocuments(entityType, entityId);
  const del = useDeleteDocument(entityType, entityId);

  // A 403 on the list means no access to the owning entity → show NoAccess
  // (FE-4 pattern) instead of a misleading empty state.
  if (isForbiddenError(list.error)) {
    return <NoAccess variant="inline" className={className} />;
  }

  const docs = list.data ?? [];
  const filtered =
    filter === 'ALL' ? docs : docs.filter((d) => d.category === filter);

  async function onDownload(doc: DocumentRecord) {
    try {
      await downloadDocument(doc);
    } catch {
      toast.error(t('downloadError'));
    }
  }

  async function onDelete(doc: DocumentRecord) {
    try {
      await del.mutateAsync(doc.id);
      toast.success(t('deleted'));
    } catch {
      toast.error(t('deleteError'));
    }
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{t('heading')}</CardTitle>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="me-1.5 h-3.5 w-3.5" />
          {t('upload')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category filter */}
        {docs.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('filter')}</span>
            <Select
              value={filter}
              onValueChange={(v) => setFilter(v as DocumentCategory | 'ALL')}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allCategories')}</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {tEnum(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {list.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('loading')}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            hasAny={docs.length > 0}
            onUpload={() => setUploadOpen(true)}
          />
        ) : (
          <ul className="space-y-2">
            {filtered.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-md border bg-white p-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <div className="truncate font-medium text-dark-text">
                      {doc.title}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">
                        {tEnum(doc.category)}
                      </span>
                      <span>{formatSize(doc.fileAsset.sizeBytes)}</span>
                      <span>{doc.createdAt.slice(0, 10)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title={t('download')}
                    aria-label={t('download')}
                    onClick={() => onDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    title={t('delete')}
                    aria-label={t('delete')}
                    disabled={del.isPending}
                    onClick={() => onDelete(doc)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        entityType={entityType}
        entityId={entityId}
      />
    </Card>
  );
}

function EmptyState({
  hasAny,
  onUpload,
}: {
  hasAny: boolean;
  onUpload: () => void;
}) {
  const t = useTranslations('documents');
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-abak-blue/10 text-abak-blue">
        <FileText className="h-6 w-6" aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-dark-text">
        {hasAny ? t('emptyFilteredTitle') : t('emptyTitle')}
      </h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
        {hasAny ? t('emptyFilteredHint') : t('emptyHint')}
      </p>
      {!hasAny && (
        <Button size="sm" className="mt-4" onClick={onUpload}>
          <Upload className="me-1.5 h-3.5 w-3.5" />
          {t('upload')}
        </Button>
      )}
    </div>
  );
}

function UploadDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entityType: DocumentEntityType;
  entityId: string;
}) {
  const t = useTranslations('documents');
  const tEnum = useTranslations('documents.category');
  const upload = useUploadDocument(entityType, entityId);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('OTHER');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setTitle('');
    setCategory('OTHER');
    setDragging(false);
  }, []);

  const pick = useCallback(
    (f: File | null | undefined) => {
      if (!f) return;
      if (f.size > MAX_BYTES) {
        toast.error(t('tooLarge'));
        return;
      }
      setFile(f);
      if (!title) setTitle(f.name);
    },
    [t, title],
  );

  async function submit() {
    if (!file) return;
    try {
      await upload.mutateAsync({
        file,
        category,
        title: title.trim() || undefined,
      });
      toast.success(t('uploaded'));
      onOpenChange(false);
      reset();
    } catch {
      toast.error(t('uploadError'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('upload')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Drag-drop zone */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pick(e.dataTransfer.files?.[0]);
            }}
            className={
              'flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors ' +
              (dragging
                ? 'border-abak-blue bg-abak-blue/5'
                : 'border-muted-foreground/25 hover:border-abak-blue/50')
            }
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden />
            <span className="mt-2 text-sm font-medium text-dark-text">
              {file ? file.name : t('dropzone')}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              {t('dropzoneHint')}
            </span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </button>

          <div className="space-y-1.5">
            <Label htmlFor="doc-title">{t('docTitle')}</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('docTitlePlaceholder')}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('docCategory')}</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as DocumentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {tEnum(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button disabled={!file || upload.isPending} onClick={submit}>
            {upload.isPending ? t('uploading') : t('upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
