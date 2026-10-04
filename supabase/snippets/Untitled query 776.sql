SELECT count(*) as total, 
       count(*) FILTER (WHERE deleted_at IS NULL) as active,
       count(*) FILTER (WHERE legacy_source = 'legacy_mysql') as legacy
FROM members;