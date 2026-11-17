-- Phase 1 Verification SQL: Email Notification Management Module
-- Read-only verification queries for validating database schema and seeded configuration.

-- 1. Verify 16 Configurable Notification Events
SELECT 
  COUNT(*) AS total_configurable_events,
  COUNT(*) = 16 AS is_valid_count
FROM notification_events
WHERE is_configurable = true;

-- Detailed inventory of seeded notification events
SELECT 
  code, 
  label, 
  category, 
  is_configurable, 
  created_at
FROM notification_events
ORDER BY category, code;

-- 2. Verify 96 Role Email Settings (6 Roles x 16 Events)
SELECT 
  COUNT(*) AS total_role_email_settings,
  COUNT(*) = 96 AS is_valid_count
FROM role_email_settings;

-- 3. Verify Exactly 23 Enabled Cells Across All Roles
SELECT 
  COUNT(*) AS total_enabled_cells,
  COUNT(*) = 23 AS is_valid_count
FROM role_email_settings
WHERE enabled = true;

-- 4. Verify Per-Role Enabled Count Breakdown
-- Expected: STORES: 14, PRODUCTION: 3, ADMIN: 3, SENIOR_MANAGER: 2, GENERAL_MANAGER: 1, DESIGNER: 0 (Total: 23 enabled cells)
-- Active Today Events (12 events): STORES: 10, PRODUCTION: 2, ADMIN: 2 (Overlap on CONSUMABLE_PARTIALLY_ISSUED_OVERDUE: STORES, PRODUCTION, ADMIN) -> Total 15 active cells
-- Future Events (4 events): STORES: 4, PRODUCTION: 0, ADMIN: 1, SENIOR_MANAGER: 2, GENERAL_MANAGER: 1, DESIGNER: 0 -> Total 8 future cells
SELECT 
  r.name AS role_name,
  COUNT(res.id) AS total_events,
  COUNT(CASE WHEN res.enabled = true THEN 1 END) AS enabled_events,
  COUNT(CASE WHEN res.enabled = false THEN 1 END) AS disabled_events,
  COUNT(CASE WHEN res.enabled = true AND res.event_code IN (
    'RM_SUBMITTED', 'MATERIAL_ISSUED', 'ADDITIONAL_REQUEST', 'MATERIAL_RETURNED',
    'EXTRA_MATERIAL_ISSUED', 'MSL_LOW_STOCK', 'MSL_CRITICAL', 'MSL_OUT_OF_STOCK',
    'DC_APPROACHING_SLA', 'DC_OVERDUE', 'CONSUMABLE_RECEIPT_OVERDUE', 'CONSUMABLE_PARTIALLY_ISSUED_OVERDUE'
  ) THEN 1 END) AS active_today_enabled,
  COUNT(CASE WHEN res.enabled = true AND res.event_code IN (
    'MATERIAL_ISSUE_OVERDUE_24H', 'DC_PENDING_2_DAYS', 'DC_QC_PENDING_24H', 'CONSUMABLE_PENDING_2_DAYS'
  ) THEN 1 END) AS future_events_enabled
FROM roles r
LEFT JOIN role_email_settings res ON res.role_id = r.id
WHERE r.name IN ('ADMIN', 'DESIGNER', 'STORES', 'PRODUCTION', 'SENIOR_MANAGER', 'GENERAL_MANAGER')
GROUP BY r.name
ORDER BY enabled_events DESC, r.name ASC;

-- Detailed list of the 23 enabled role settings
SELECT 
  r.name AS role_name,
  res.event_code,
  ne.label,
  ne.category,
  res.enabled
FROM role_email_settings res
JOIN roles r ON r.id = res.role_id
JOIN notification_events ne ON ne.code = res.event_code
WHERE res.enabled = true
ORDER BY r.name, res.event_code;

-- 5. Verify User Overrides Count
-- Expected: (users with workflow_email_enabled = false in user_notification_preferences) * 16
SELECT 
  (SELECT COUNT(*) FROM user_notification_preferences WHERE workflow_email_enabled = false) AS disabled_pref_users,
  (SELECT COUNT(*) FROM user_notification_preferences WHERE workflow_email_enabled = false) * 16 AS expected_overrides_count,
  (SELECT COUNT(*) FROM user_email_overrides WHERE state = 'OFF') AS actual_overrides_count,
  (SELECT COUNT(*) FROM user_email_overrides WHERE state = 'OFF') = 
    ((SELECT COUNT(*) FROM user_notification_preferences WHERE workflow_email_enabled = false) * 16) AS is_override_count_matching;

-- 6. Verify User Email Overrides Table Structure and Distinct States
SELECT 
  state,
  COUNT(*) AS count
FROM user_email_overrides
GROUP BY state;

-- 7. Verify Audit Table Is Empty and Ready
SELECT 
  COUNT(*) AS total_audit_entries
FROM email_setting_audit;
