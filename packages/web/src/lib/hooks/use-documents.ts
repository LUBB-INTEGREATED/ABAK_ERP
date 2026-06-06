'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import apiClient from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth';

/**
 * WS-D / DOC-A — Document Control (Wave-0) client hooks.
 *
 * Talks to the new /documents backend: upload (multipart), list-by-entity,
 * download (authenticated stream), delete. Access is scope-checked server-side
 * against the OWNING entity, so a 403 here means "no access to this entity".
 */

export type DocumentEntityType =
  | 'PROJECT'
  | 'GOV_TX'
  | 'QUOTE'
  | 'CLIENT'
  | 'LEAD'
  | 'FINANCE';

export type DocumentCategory =
  | 'ARCHITECTURAL'
  | 'STRUCTURAL'
  | 'LICENSE'
  | 'FINANCIAL'
  | 'CONTRACT'
  | 'OTHER';

export interface DocumentRecord {
  id: string;
  fileAssetId: string;
  entityType: DocumentEntityType;
  entityId: string;
  category: DocumentCategory;
  title: string;
  uploadedById: string | null;
  createdAt: string;
  fileAsset: {
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  };
}

type ApiEnvelope<T> = { data: T; timestamp: string };

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011/api/v1';

const documentsKey = (entityType: DocumentEntityType, entityId: string) =>
  ['documents', entityType, entityId] as const;

/** List an entity's documents (scope-checked server-side). */
export function useEntityDocuments(
  entityType: DocumentEntityType,
  entityId: string | undefined,
) {
  return useQuery({
    queryKey: documentsKey(entityType, entityId ?? ''),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<DocumentRecord[]>>(
        '/documents',
        { params: { entityType, entityId } },
      );
      return data.data;
    },
    enabled: Boolean(entityId),
  });
}

/**
 * Upload a document onto an entity. Uses bare `axios` (not the shared
 * apiClient) so the browser sets the multipart boundary itself — the shared
 * instance defaults Content-Type to JSON, which would stringify the FormData
 * and drop the file bytes (same rationale as use-files).
 */
export function useUploadDocument(
  entityType: DocumentEntityType,
  entityId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      file: File;
      category: DocumentCategory;
      title?: string;
    }): Promise<DocumentRecord> => {
      const form = new FormData();
      form.append('file', input.file);
      form.append('entityType', entityType);
      form.append('entityId', entityId);
      form.append('category', input.category);
      if (input.title) form.append('title', input.title);
      const token = useAuthStore.getState().accessToken;
      const { data } = await axios.post<ApiEnvelope<DocumentRecord>>(
        `${API_BASE}/documents`,
        form,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKey(entityType, entityId) });
    },
  });
}

/** Delete a document (scope-checked server-side). */
export function useDeleteDocument(
  entityType: DocumentEntityType,
  entityId: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/documents/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: documentsKey(entityType, entityId) });
    },
  });
}

/**
 * Download a document through the authenticated, scope-checked stream and hand
 * the bytes to the browser as a save/open. We can't use a plain <a href> because
 * the route requires the bearer token; so fetch the blob with auth and trigger
 * an object-URL download.
 */
export async function downloadDocument(doc: DocumentRecord): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  const res = await axios.get<Blob>(`${API_BASE}/documents/${doc.id}/download`, {
    responseType: 'blob',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const url = URL.createObjectURL(res.data);
  const a = window.document.createElement('a');
  a.href = url;
  a.download = doc.fileAsset.originalName || doc.title;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
