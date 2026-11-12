-- Optional free-text "what are you reaching out about" (single line, at most 300 characters, cleaned by the Worker).
ALTER TABLE submissions ADD COLUMN message TEXT;
