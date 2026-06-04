'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api-client';

// DOC-3: the price-offer preview. The document HTML comes from the SAME
// server-side renderer that produces the PDF (one renderer, two consumers) via
// GET /quotes/:id/document.html — rendered here in an isolated iframe so its
// print styles don't leak into the app. "Download PDF" streams the server PDF.

export default function QuotePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useTranslations('quotePdf');
  const router = useRouter();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<string>(`/quotes/${id}/document.html`, { responseType: 'text' })
      .then((res) => {
        if (!cancelled) setHtml(res.data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function downloadPdf() {
    setDownloading(true);
    try {
      const res = await apiClient.get<Blob>(`/quotes/${id}/pdf`, {
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quote-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-muted/40">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2 print:hidden">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="me-2 h-4 w-4" /> {t('backToQuote')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => frameRef.current?.contentWindow?.print()}
            disabled={!html}
          >
            <Printer className="me-2 h-4 w-4" /> {t('printOrSave')}
          </Button>
          <Button size="sm" onClick={downloadPdf} disabled={downloading}>
            {downloading ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="me-2 h-4 w-4" />
            )}
            {t('downloadPdf')}
          </Button>
        </div>
      </div>

      {error ? (
        <p className="px-6 py-10 text-sm text-rose-700">{t('loadError')}</p>
      ) : html === null ? (
        <div className="mx-auto my-10 h-[60vh] w-[210mm] max-w-full animate-pulse rounded bg-muted" />
      ) : (
        <iframe
          ref={frameRef}
          title={t('documentType')}
          srcDoc={html}
          className="mx-auto block h-[calc(100vh-48px)] w-full max-w-[230mm] border-0 bg-white"
        />
      )}
    </main>
  );
}
