drop policy if exists "Members read own reveal consents" on public.face_reveal_consents;
create policy "Participants read reveal consents" on public.face_reveal_consents for select to authenticated using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = face_reveal_consents.conversation_id and cp.user_id = auth.uid()));
