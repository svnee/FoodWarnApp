const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export interface Recall {
  id: number;
  source: string;
  source_url: string;
  title: string;
  description: string;
  reason: string;
  published_date: string;
  brand: string | null;
  product_name: string;
  lot_numbers: string | null;
  expiry_dates: string | null;
  image_url: string | null;
  is_infant_formula: boolean;
  status: string;
  barcodes: Array<{
    id: number;
    barcode: string;
    source: string;
    confidence: number;
  }>;
}

export interface RecallListResponse {
  data: Recall[];
  total: number;
  limit: number;
  offset: number;
}

export interface BarcodeCheckResult {
  found: boolean;
  product: {
    barcode: string;
    product_name: string | null;
    brand: string | null;
    categories: string | null;
    image_url: string | null;
  } | null;
  recalls: Recall[];
}

export interface Stats {
  total_recalls: number;
  active_recalls: number;
  infant_formula_recalls: number;
  tracked_barcodes: number;
}

export const api = {
  getRecalls(params?: {
    limit?: number;
    offset?: number;
    search?: string;
    status?: string;
  }): Promise<RecallListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.search) query.set('search', params.search);
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    return request(`/recalls${qs ? `?${qs}` : ''}`);
  },

  getInfantFormulaRecalls(params?: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<RecallListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    if (params?.search) query.set('search', params.search);
    const qs = query.toString();
    return request(`/recalls/infant-formula${qs ? `?${qs}` : ''}`);
  },

  getRecall(id: number): Promise<Recall> {
    return request(`/recalls/${id}`);
  },

  checkBarcode(barcode: string): Promise<BarcodeCheckResult> {
    return request(`/recalls/barcode/${barcode}`);
  },

  reportBarcode(recallId: number, barcode: string): Promise<{ success: boolean }> {
    return request(`/recalls/${recallId}/barcodes`, {
      method: 'POST',
      body: JSON.stringify({ barcode }),
    });
  },

  getStats(): Promise<Stats> {
    return request('/stats');
  },
};
