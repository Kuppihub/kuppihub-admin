-- Migration: Add email domain-based access control for videos
-- This allows restricting video access to specific email domains

-- Add allowed_domains column to videos table
-- NULL = public (everyone can see)
-- ['@uom.lk'] = only users with @uom.lk emails can see
-- ['@cse.mrt.ac.lk', '@uom.lk'] = users with either domain can see
ALTER TABLE public.videos 
ADD COLUMN IF NOT EXISTS allowed_domains text[] DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.videos.allowed_domains IS 
'Array of allowed email domains (e.g., @uom.lk, @cse.mrt.ac.lk). NULL means public access for everyone.';

-- Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_videos_allowed_domains ON public.videos USING GIN (allowed_domains);

-- Function to check if a user can access a video based on their email domain
CREATE OR REPLACE FUNCTION public.can_access_video(
    p_video_id INTEGER,
    p_user_email TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_allowed_domains text[];
    v_user_domain text;
BEGIN
    -- Get the allowed domains for the video
    SELECT allowed_domains INTO v_allowed_domains
    FROM public.videos
    WHERE id = p_video_id;

    -- If allowed_domains is NULL, video is public
    IF v_allowed_domains IS NULL THEN
        RETURN TRUE;
    END IF;

    -- If user email is NULL, they can't access restricted content
    IF p_user_email IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Extract domain from email (e.g., 'user@uom.lk' -> '@uom.lk')
    v_user_domain := '@' || split_part(p_user_email, '@', 2);

    -- Check if user's domain is in the allowed list
    RETURN v_user_domain = ANY(v_allowed_domains);
END;
$$;

-- Function to get videos filtered by user's email access
CREATE OR REPLACE FUNCTION public.get_accessible_videos(
    p_module_id INTEGER,
    p_user_email TEXT DEFAULT NULL
) RETURNS TABLE (
    id INTEGER,
    module_id INTEGER,
    title VARCHAR,
    youtube_links JSONB,
    telegram_links JSONB,
    material_urls JSONB,
    onedrive_cloud_video_urls JSONB,
    gdrive_cloud_video_urls JSONB,
    is_kuppi BOOLEAN,
    description TEXT,
    language_code VARCHAR,
    created_at TIMESTAMP,
    student_id INTEGER,
    added_by_user_id INTEGER,
    is_hidden BOOLEAN,
    is_approved BOOLEAN,
    allowed_domains TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_domain text;
BEGIN
    -- Extract domain from email if provided
    IF p_user_email IS NOT NULL THEN
        v_user_domain := '@' || split_part(p_user_email, '@', 2);
    END IF;

    RETURN QUERY
    SELECT 
        v.id,
        v.module_id,
        v.title,
        v.youtube_links,
        v.telegram_links,
        v.material_urls,
        v.onedrive_cloud_video_urls,
        v.gdrive_cloud_video_urls,
        v.is_kuppi,
        v.description,
        v.language_code,
        v.created_at,
        v.student_id,
        v.added_by_user_id,
        v.is_hidden,
        v.is_approved,
        v.allowed_domains
    FROM public.videos v
    WHERE v.module_id = p_module_id
      AND v.is_hidden = FALSE
      AND v.is_approved = TRUE
      AND (
          -- Public videos (no domain restriction)
          v.allowed_domains IS NULL
          OR
          -- User's domain matches one of the allowed domains
          (p_user_email IS NOT NULL AND v_user_domain = ANY(v.allowed_domains))
      )
    ORDER BY v.created_at DESC;
END;
$$;

-- Example usage:
-- 
-- Make a video public (default):
-- UPDATE videos SET allowed_domains = NULL WHERE id = 1;
--
-- Restrict to UoM emails only:
-- UPDATE videos SET allowed_domains = ARRAY['@uom.lk'] WHERE id = 1;
--
-- Restrict to CSE and UoM emails:
-- UPDATE videos SET allowed_domains = ARRAY['@cse.mrt.ac.lk', '@uom.lk'] WHERE id = 1;
--
-- Check if user can access:
-- SELECT can_access_video(1, 'student@uom.lk');
--
-- Get all accessible videos for a user:
-- SELECT * FROM get_accessible_videos(5, 'student@cse.mrt.ac.lk');
