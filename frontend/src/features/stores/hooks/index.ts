import { useState, useCallback } from 'react';
import { materialIssueService } from '../services';
import type {
  IssueMaterialPayload,
  MaterialIssueResult,
  StoresAvailabilityStatus,
} from '../types';

export function useMaterialIssue() {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MaterialIssueResult | null>(null);
  const [availability, setAvailability] = useState<StoresAvailabilityStatus | null>(null);

  const fetchAvailability = useCallback(async (targetSc: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await materialIssueService.getAvailability(targetSc);
      setAvailability(data);
      return data;
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch material availability');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const issueMaterials = useCallback(async (payload: IssueMaterialPayload) => {
    setLoading(true);
    setError(null);
    try {
      const res = await materialIssueService.submitMaterialIssue(payload);
      setResult(res);
      return res;
    } catch (err: any) {
      setError(err?.message || 'Failed to submit material issue');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    result,
    availability,
    fetchAvailability,
    issueMaterials,
  };
}

export const useStores = useMaterialIssue;
