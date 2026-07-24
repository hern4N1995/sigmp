import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // Ensure profile completeness (except on the profile route itself)
    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil_completo")
      .eq("id", data.user.id)
      .maybeSingle();
    return { user: data.user, profileComplete: profile?.perfil_completo ?? false };
  },
  component: () => <Outlet />,
});
