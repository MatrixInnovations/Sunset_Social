-- Staff can read orders that need a person. Read only. Applied after 20261122160000.
-- Guests still see only their own orders. Door and admin roles see status = review.

drop policy if exists orders_select_review_staff on public.orders;
create policy orders_select_review_staff on public.orders
  for select to authenticated
  using (
    status = 'review'
    and exists (
      select 1 from public.staff_roles s
      where s.profile_id = auth.uid()
        and s.role in ('admin', 'door')
    )
  );
