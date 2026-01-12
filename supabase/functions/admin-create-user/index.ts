import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Create regular client to verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the requesting user
    const { data: { user: requestingUser }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Nicht autorisiert" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin using the database function
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUser.id,
      _role: "admin",
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Nur Administratoren können Benutzer erstellen" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { email, password, firstName, lastName, department, position, organizationId, roles } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "E-Mail und Passwort sind erforderlich" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create the user with admin client
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with additional data
    if (department || position || organizationId) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({
          department,
          position,
          organization_id: organizationId,
        })
        .eq("user_id", newUser.user.id);

      if (profileError) {
        console.error("Error updating profile:", profileError);
      }
    }

    // Assign roles
    if (roles && roles.length > 0) {
      const roleInserts = roles.map((role: string) => ({
        user_id: newUser.user.id,
        role,
        granted_by: requestingUser.id,
      }));

      const { error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .insert(roleInserts);

      if (rolesError) {
        console.error("Error assigning roles:", rolesError);
      }
    }

    return new Response(
      JSON.stringify({ userId: newUser.user.id, message: "Benutzer erfolgreich erstellt" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Interner Serverfehler" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
