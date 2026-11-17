-- Allow an admitted member to read the open room row needed by token issuance
-- and the room directory. Preserve host access to their own closed rooms.
drop policy if exists audio_rooms_read_open on public.audio_rooms;
create policy audio_rooms_read_open on public.audio_rooms
for select to authenticated
using (
  host_user_id = auth.uid()
  or (status = 'open' and visibility = 'public')
  or (
    status = 'open'
    and exists (
      select 1
      from public.audio_room_members member
      where member.room_id = audio_rooms.id
        and member.user_id = auth.uid()
        and member.removed_at is null
    )
  )
);
