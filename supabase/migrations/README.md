# Migration inventory

`202608310000_cloud_public_baseline.sql` is a schema-only, read-only export of
the existing Cloud `public` schema. It contains tables, constraints, functions,
grants, triggers, and RLS policies but no production rows or Auth users.

Later migrations add the holiday-template feature and local `gym-media`
Storage configuration that were not part of that public-schema export.

When Cloud schema changes intentionally, generate a new migration rather than
editing the applied baseline or copying production data.
