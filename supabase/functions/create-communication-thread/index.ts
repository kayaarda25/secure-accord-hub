import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CommunicationType = "partner" | "authority" | "internal" | "direct";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeMembers(raw: unknown, currentUserId: string): string[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<string>();
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (!id) continue;
    if (id === currentUserId) continue;
    unique.add(id);
  }
  return Array.from(unique);
}

async function requireAuthUser(supabaseUrl: string, authHeader: string) {
  const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) return { user: null, error: error ?? new Error("Unauthorized") };
  return { user, error: null };
}

async function getUserRoles(supabaseAdmin: any, userId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) {
    console.error("create-communication-thread: role lookup error", error);
    return new Set();
  }

  return new Set((data || []).map((r: any) => String(r.role)));
}

function hasAnyRole(userRoles: Set<string>, required: string[]) {
  for (const r of required) {
    if (userRoles.has(r)) return true;
  }
  return false;
}

async function canCreateThreadType(supabaseAdmin: any, userId: string, type: CommunicationType) {
  if (type === "internal" || type === "direct") return true;
  const roles = await getUserRoles(supabaseAdmin, userId);

  if (type === "partner") return hasAnyRole(roles, ["admin", "management", "partner"]);
  // authority
  return hasAnyRole(roles, ["admin", "management", "state"]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Nicht autorisiert" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { user: requestingUser, error: userError } = await requireAuthUser(supabaseUrl, authHeader);
    if (userError || !requestingUser) return jsonResponse({ error: "Nicht autorisiert" }, 401);

    const body = await req.json().catch(() => ({}));
    const subject = typeof body.subject === "string" ? body.subject : null;
    const type = body.type as CommunicationType;
    const is_official = Boolean(body.is_official);
    const selectedMembers = normalizeMembers(body.selectedMembers, requestingUser.id);

    if (!type || !["partner", "authority", "internal", "direct"].includes(type)) {
      return jsonResponse({ error: "Ungültiger Thread-Typ" }, 400);
    }

    if (type !== "direct" && (!subject || subject.trim().length === 0)) {
      return jsonResponse({ error: "Betreff ist erforderlich" }, 400);
    }

    const allowed = await canCreateThreadType(supabaseAdmin, requestingUser.id, type);
    if (!allowed) {
      return jsonResponse({ error: "Keine Berechtigung" }, 403);
    }

    const { data: thread, error: threadError } = await supabaseAdmin
      .from("communication_threads")
      .insert({
        subject: type === "direct" ? null : subject,
        type,
        is_official,
        created_by: requestingUser.id,
      })
      .select("*")
      .single();

    if (threadError || !thread) {
      console.error("create-communication-thread: insert thread error", threadError);
      return jsonResponse({ error: "Fehler beim Erstellen des Chats" }, 500);
    }

    const participants = [
      { thread_id: thread.id, user_id: requestingUser.id, added_by: requestingUser.id },
      ...selectedMembers.map((userId) => ({
        thread_id: thread.id,
        user_id: userId,
        added_by: requestingUser.id,
      })),
    ];

    const { error: participantsError } = await supabaseAdmin
      .from("thread_participants")
      .insert(participants);

    if (participantsError) {
      console.error("create-communication-thread: insert participants error", participantsError);
      // Roll back the thread to avoid orphan threads.
      await supabaseAdmin.from("communication_threads").delete().eq("id", thread.id);
      return jsonResponse({ error: "Teilnehmer konnten nicht hinzugefügt werden" }, 500);
    }

    return jsonResponse({ thread });
  } catch (error) {
    console.error("create-communication-thread: unhandled", error);
    return jsonResponse({ error: "Interner Serverfehler" }, 500);
  }
});
