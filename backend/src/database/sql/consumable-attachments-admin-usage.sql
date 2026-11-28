-- Admin-only SQL snippet (not auto-run) to report total consumable attachment storage used.
SELECT
  COUNT(*) AS total_files,
  COALESCE(SUM(original_size_bytes), 0) AS total_original_bytes,
  COALESCE(SUM(stored_size_bytes), 0) AS total_stored_bytes,
  ROUND(COALESCE(SUM(stored_size_bytes), 0) / 1048576.0, 2) AS total_stored_mb
FROM public.consumable_line_attachments;
