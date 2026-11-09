-- Attachment rows must be created by the JWT-verified chat-media-verify Edge
-- Function after it has fetched and checked the actual object bytes. Authenticated
-- clients retain their existing text-only insert capability.
drop policy if exists "Participants send messages" on public.messages;
create policy "Participants send messages" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and message_kind = 'user'
    and public.is_conversation_participant(conversation_id, auth.uid())
    and attachment_path is null
    and attachment_name is null
    and attachment_mime is null
    and attachment_size_bytes is null
    and attachment_kind is null
  );
