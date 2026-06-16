-- 009: platform_post_id — returned post/media ID stored after successful publish
-- Used by backfill-links to identify which published posts still need a first comment.
ALTER TABLE content_queue ADD COLUMN platform_post_id TEXT;
