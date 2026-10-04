SELECT id, member_id, full_name, membership_status, deleted_at, legacy_source, created_at
FROM members 
WHERE legacy_source = 'legacy_mysql'
ORDER BY created_at DESC
LIMIT 20;