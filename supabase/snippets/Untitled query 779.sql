SELECT public.initialize_membership_fees(id) 
FROM public.members 
WHERE deleted_at IS NULL 
AND NOT EXISTS (
  SELECT 1 FROM public.membership_fees WHERE member_id = public.members.id
);