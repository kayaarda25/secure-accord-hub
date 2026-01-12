-- Create calendar_events table
CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  event_type TEXT NOT NULL DEFAULT 'meeting',
  priority TEXT NOT NULL DEFAULT 'normal',
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  recurrence_end_date DATE,
  parent_event_id UUID REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  
  -- Ownership
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create calendar_event_participants table for sharing
CREATE TABLE public.calendar_event_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  responded_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tasks table
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  status TEXT NOT NULL DEFAULT 'todo', -- 'todo', 'in_progress', 'done'
  
  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_type TEXT, -- 'daily', 'weekly', 'monthly'
  recurrence_end_date DATE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  
  -- Ownership
  created_by UUID NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create task_participants table for sharing tasks
CREATE TABLE public.task_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  responded_at TIMESTAMP WITH TIME ZONE,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create triggers for updated_at
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_participants ENABLE ROW LEVEL SECURITY;

-- Calendar Events Policies
CREATE POLICY "Users can create their own events"
  ON public.calendar_events
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view own events or shared events"
  ON public.calendar_events
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.calendar_event_participants
      WHERE event_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own events"
  ON public.calendar_events
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own events"
  ON public.calendar_events
  FOR DELETE
  USING (created_by = auth.uid());

-- Calendar Event Participants Policies
CREATE POLICY "Event creators can manage participants"
  ON public.calendar_event_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view participants of their events"
  ON public.calendar_event_participants
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Participants can update their own status"
  ON public.calendar_event_participants
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Event creators can delete participants"
  ON public.calendar_event_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events
      WHERE id = event_id AND created_by = auth.uid()
    )
  );

-- Tasks Policies
CREATE POLICY "Users can create their own tasks"
  ON public.tasks
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can view own tasks or shared tasks"
  ON public.tasks
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.task_participants
      WHERE task_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own tasks"
  ON public.tasks
  FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON public.tasks
  FOR DELETE
  USING (created_by = auth.uid());

-- Task Participants Policies
CREATE POLICY "Task creators can manage participants"
  ON public.task_participants
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view participants of their tasks"
  ON public.task_participants
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Participants can update their own status"
  ON public.task_participants
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Task creators can delete participants"
  ON public.task_participants
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE id = task_id AND created_by = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_calendar_events_created_by ON public.calendar_events(created_by);
CREATE INDEX idx_calendar_events_event_date ON public.calendar_events(event_date);
CREATE INDEX idx_calendar_event_participants_event ON public.calendar_event_participants(event_id);
CREATE INDEX idx_calendar_event_participants_user ON public.calendar_event_participants(user_id);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_task_participants_task ON public.task_participants(task_id);
CREATE INDEX idx_task_participants_user ON public.task_participants(user_id);