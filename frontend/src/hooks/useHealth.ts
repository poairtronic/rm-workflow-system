import { useState, useEffect } from 'react';
import { HealthService } from '../services/health.service';
import type { HealthCheckResponse } from '../types/api';

export function useHealth() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string>('');

  const refetch = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await HealthService.checkHealth();
      setHealth(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
  }, []);

  return { health, loading, error, lastChecked, refetch };
}
