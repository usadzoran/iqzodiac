-- Increase the Reel duration limit from 60 seconds to 6 minutes.
alter table public.reels drop constraint if exists reels_duration_seconds_check;
alter table public.reels
  add constraint reels_duration_seconds_check
  check (duration_seconds > 0 and duration_seconds <= 360);
