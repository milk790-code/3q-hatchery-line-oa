-- 007: external link goes in the FIRST COMMENT, not the post body (FB algorithm).
-- content_queue.link_url is posted as a comment right after the post publishes.
ALTER TABLE content_queue ADD COLUMN link_url TEXT;
