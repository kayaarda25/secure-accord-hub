-- Drop the overly permissive policy that allows any authenticated user to view all recordings
DROP POLICY IF EXISTS "Users can view their recordings" ON storage.objects;

-- Create a secure policy that restricts access to meeting participants, creators, and admins
CREATE POLICY "Users can view authorized recordings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'meeting-recordings' AND (
    -- User uploaded the recording (folder owner)
    auth.uid()::text = (storage.foldername(name))[1]
    -- OR user is admin/management
    OR public.has_any_role(auth.uid(), ARRAY['admin'::public.app_role, 'management'::public.app_role])
    -- OR user participated in the meeting
    OR EXISTS (
      SELECT 1 FROM public.meeting_recordings mr
      JOIN public.scheduled_meetings sm ON mr.meeting_id = sm.id
      LEFT JOIN public.meeting_participants mp ON mp.meeting_id = sm.id
      WHERE mr.file_path = name
      AND (sm.created_by = auth.uid() OR mp.user_id = auth.uid())
    )
  )
);