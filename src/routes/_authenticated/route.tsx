import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("perfil_completo")
      .eq("id", data.user.id)
      .maybeSingle();
    const complete = profile?.perfil_completo ?? false;
    if (!complete && location.pathname !== "/completar-perfil") {
      throw redirect({ to: "/completar-perfil" });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});
