-- ── BUCKETS ──────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'avatars',
    'avatars',
    true,
    5242880,   -- 5 MB
    ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
  ),
  (
    'product-images',
    'product-images',
    true,
    10485760,  -- 10 MB
    ARRAY['image/jpeg','image/jpg','image/png','image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- ── AVATAR POLICIES ───────────────────────────────────────────────────────────
-- Public read
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated user can upload only to their own folder ({user_id}/...)
CREATE POLICY "avatars_user_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- User can replace their own files
CREATE POLICY "avatars_user_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- User can delete their own files
CREATE POLICY "avatars_user_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── PRODUCT-IMAGE POLICIES ────────────────────────────────────────────────────
-- Public read
CREATE POLICY "product_images_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Any authenticated user can upload (product ownership enforced at DB layer)
CREATE POLICY "product_images_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'product-images'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "product_images_auth_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-images'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "product_images_auth_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-images'
    AND auth.uid() IS NOT NULL
  );
