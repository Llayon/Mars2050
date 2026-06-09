-- Add pending_events to Realtime publication for live processing updates
ALTER PUBLICATION supabase_realtime ADD TABLE pending_events;
