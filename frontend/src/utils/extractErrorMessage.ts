/**
 * Cross-cutting utility for extracting clean error messages from API responses.
 * Handles both wrapped schema ({ error: { message } }) from AllExceptionsFilter
 * and legacy flat schema ({ message }), as well as array messages from class-validator.
 */
export const extractErrorMessage = (err: any, fallback = 'Something went wrong'): string => {
  const raw =
    err?.response?.data?.error?.message ??
    err?.response?.data?.message ??
    err?.response?.data?.error ??
    err?.message;

  if (Array.isArray(raw)) {
    return raw.filter(Boolean).join(', ') || fallback;
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  if (typeof raw === 'object' && raw !== null && raw.message) {
    return Array.isArray(raw.message) ? raw.message.join(', ') : String(raw.message);
  }
  return fallback;
};
