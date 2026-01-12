-- Table for scheduled meetings
CREATE TABLE public.scheduled_meetings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  room_code TEXT NOT NULL,
  created_by UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for meeting participants/invitations
CREATE TABLE public.meeting_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.scheduled_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  status TEXT DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'declined', 'attended')),
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE
);

-- Table for meeting recordings
CREATE TABLE public.meeting_recordings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID REFERENCES public.scheduled_meetings(id),
  protocol_id UUID REFERENCES public.meeting_protocols(id),
  room_code TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  duration_seconds INTEGER,
  recorded_by UUID NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for meeting chat messages
CREATE TABLE public.meeting_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code TEXT NOT NULL,
  sender_id UUID NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_meetings
CREATE POLICY "Users can view meetings they created or are invited to"
ON public.scheduled_meetings FOR SELECT
USING (
  created_by = auth.uid() OR
  id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can create meetings"
ON public.scheduled_meetings FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their meetings"
ON public.scheduled_meetings FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Creators can delete their meetings"
ON public.scheduled_meetings FOR DELETE
USING (created_by = auth.uid());

-- RLS Policies for meeting_participants
CREATE POLICY "Users can view participants of their meetings"
ON public.meeting_participants FOR SELECT
USING (
  user_id = auth.uid() OR
  meeting_id IN (SELECT id FROM public.scheduled_meetings WHERE created_by = auth.uid())
);

CREATE POLICY "Meeting creators can manage participants"
ON public.meeting_participants FOR INSERT
WITH CHECK (
  meeting_id IN (SELECT id FROM public.scheduled_meetings WHERE created_by = auth.uid())
);

CREATE POLICY "Participants can update their own status"
ON public.meeting_participants FOR UPDATE
USING (user_id = auth.uid());

-- RLS Policies for meeting_recordings
CREATE POLICY "Users can view recordings of their meetings"
ON public.meeting_recordings FOR SELECT
USING (
  recorded_by = auth.uid() OR
  meeting_id IN (SELECT id FROM public.scheduled_meetings WHERE created_by = auth.uid()) OR
  meeting_id IN (SELECT meeting_id FROM public.meeting_participants WHERE user_id = auth.uid())
);

CREATE POLICY "Users can upload recordings"
ON public.meeting_recordings FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- RLS Policies for meeting_chat_messages
CREATE POLICY "Anyone authenticated can view chat messages"
ON public.meeting_chat_messages FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Anyone authenticated can send chat messages"
ON public.meeting_chat_messages FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.meeting_chat_messages;

-- Create storage bucket for recordings
INSERT INTO storage.buckets (id, name, public) VALUES ('meeting-recordings', 'meeting-recordings', false);

-- Storage policies for recordings
CREATE POLICY "Users can upload recordings"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view their recordings"
ON storage.objects FOR SELECT
USING (bucket_id = 'meeting-recordings' AND auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_scheduled_meetings_updated_at
BEFORE UPDATE ON public.scheduled_meetings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();