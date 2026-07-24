import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "empleado" | "administrador";

export interface AuthState {
  user: User | null;
  loading: boolean;
  roles: Role[];
  isAdmin: boolean;
  profileComplete: boolean | null;
}

export function useAuth(): AuthState & { refresh: () => Promise<void> } {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  const loadMeta = async (u: User | null) => {
    if (!u) {
      setRoles([]);
      setProfileComplete(null);
      return;
    }
    const [{ data: rolesData }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", u.id),
      supabase.from("profiles").select("perfil_completo").eq("id", u.id).maybeSingle(),
    ]);
    setRoles((rolesData?.map((r) => r.role as Role)) ?? []);
    setProfileComplete(profile?.perfil_completo ?? false);
  };

  const refresh = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
    await loadMeta(data.user);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
      setTimeout(() => {
        loadMeta(session?.user ?? null);
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      loadMeta(data.session?.user ?? null).finally(() => setLoading(false));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return {
    user,
    loading,
    roles,
    isAdmin: roles.includes("administrador"),
    profileComplete,
    refresh,
  };
}
