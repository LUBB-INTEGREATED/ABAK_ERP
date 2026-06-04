'use client';

import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useAuthStore } from '@/lib/auth';

export interface FileAsset {
  id: string;
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

type ApiEnvelope<T> = { data: T; timestamp: string };

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3011/api/v1';

/**
 * Upload a single file (image or PDF, ≤10 MB) to POST /files/upload.
 *
 * Deliberately uses bare `axios`, NOT the shared `apiClient`: that instance
 * defaults Content-Type to application/json, and axios's request transform
 * (defaults/index.js) JSON.stringifies a FormData body whenever the content
 * type is JSON — which would silently drop the file bytes. Sending through a
 * clean axios with no JSON default lets the browser set the multipart boundary
 * itself. Auth is attached from the same store the interceptor reads.
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File): Promise<FileAsset> => {
      const form = new FormData();
      form.append('file', file);
      const token = useAuthStore.getState().accessToken;
      const { data } = await axios.post<ApiEnvelope<FileAsset>>(
        `${API_BASE}/files/upload`,
        form,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} },
      );
      return data.data;
    },
  });
}
