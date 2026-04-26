import { useState, useEffect, useCallback } from 'react';

const DRAFT_KEY = 'hauliq-load-draft';

export interface LoadDraft {
  title: string;
  description: string;
  pickup_location: string;
  delivery_location: string;
  pickup_date: string;
  pickup_time: string;
  delivery_date: string;
  delivery_time: string;
  price: string;
  weight_lbs: string;
  equipment_type: string;
  load_type: string;
  payment_method: string;
  urgent: string;
}

const emptyDraft: LoadDraft = {
  title: '',
  description: '',
  pickup_location: '',
  delivery_location: '',
  pickup_date: '',
  pickup_time: '',
  delivery_date: '',
  delivery_time: '',
  price: '',
  weight_lbs: '',
  equipment_type: '',
  load_type: 'FTL',
  payment_method: 'cash',
  urgent: 'false',
};

export function useLoadDraft() {
  const [draft, setDraft] = useState<LoadDraft>(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      return saved ? { ...emptyDraft, ...JSON.parse(saved) } : emptyDraft;
    } catch {
      return emptyDraft;
    }
  });

  const [hasDraft, setHasDraft] = useState(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (!saved) return false;
      const parsed = JSON.parse(saved);
      return Object.values(parsed).some((v) => v !== '' && v !== 'FTL' && v !== 'cash');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const hasContent = Object.entries(draft).some(
      ([k, v]) => v !== '' && !(k === 'load_type' && v === 'FTL') && !(k === 'payment_method' && v === 'cash')
    );
    if (hasContent) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      setHasDraft(true);
    }
  }, [draft]);

  const updateField = useCallback((field: keyof LoadDraft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setDraft(emptyDraft);
    setHasDraft(false);
  }, []);

  return { draft, updateField, clearDraft, hasDraft };
}
