-- Fix trigger functions to allow service-side inserts (auth.uid() can be NULL)
-- while still enforcing correct ownership for normal authenticated requests.

CREATE OR REPLACE FUNCTION public.set_communication_thread_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If called in an authenticated user context, enforce created_by from JWT
  IF auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  -- For service-side inserts (no auth.uid()), require created_by to be provided
  IF NEW.created_by IS NULL THEN
    RAISE EXCEPTION 'created_by is required';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_thread_participant_added_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If called in an authenticated user context, enforce added_by from JWT
  IF auth.uid() IS NOT NULL THEN
    NEW.added_by := auth.uid();
  END IF;

  -- For service-side inserts (no auth.uid()), require added_by to be provided
  IF NEW.added_by IS NULL THEN
    RAISE EXCEPTION 'added_by is required';
  END IF;

  RETURN NEW;
END;
$$;
