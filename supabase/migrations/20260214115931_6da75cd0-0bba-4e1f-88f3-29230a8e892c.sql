
-- Backup schedules: user-configurable backup frequency
CREATE TABLE public.backup_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly, manual
  time_of_day TIME NOT NULL DEFAULT '03:00',
  day_of_week INTEGER, -- 0=Sunday, 1=Monday, etc. (for weekly)
  day_of_month INTEGER, -- 1-28 (for monthly)
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Backup jobs: history of all backup runs
CREATE TABLE public.backup_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
  backup_type TEXT NOT NULL DEFAULT 'full', -- full, manual
  file_path TEXT, -- path in backups storage bucket
  file_size BIGINT, -- size in bytes
  tables_count INTEGER,
  documents_count INTEGER,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;

-- RLS: Users can manage their own schedules
CREATE POLICY "Users can manage own backup schedules"
  ON public.backup_schedules FOR ALL
  USING (user_id = auth.uid());

-- RLS: Users can view their own backup jobs
CREATE POLICY "Users can view own backup jobs"
  ON public.backup_jobs FOR SELECT
  USING (user_id = auth.uid());

-- RLS: System inserts backup jobs (via edge function with service role)
CREATE POLICY "Users can create own backup jobs"
  ON public.backup_jobs FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can see all backups
CREATE POLICY "Admins can manage all backup schedules"
  ON public.backup_schedules FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage all backup jobs"
  ON public.backup_jobs FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_backup_schedules_updated_at
  BEFORE UPDATE ON public.backup_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
