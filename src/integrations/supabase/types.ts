export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      calificaciones: {
        Row: {
          comentario: string | null;
          creada_en: string;
          omitida: boolean;
          puntaje: number | null;
          solicitud_id: string;
        };
        Insert: {
          comentario?: string | null;
          creada_en?: string;
          omitida?: boolean;
          puntaje?: number | null;
          solicitud_id: string;
        };
        Update: {
          comentario?: string | null;
          creada_en?: string;
          omitida?: boolean;
          puntaje?: number | null;
          solicitud_id?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          apellido: string | null;
          created_at: string;
          dni: string | null;
          email: string | null;
          es_jefe: boolean;
          id: string;
          nombre: string | null;
          perfil_completo: boolean;
          solicitud_jefe: "pendiente" | "rechazada" | null;
          unidad_id: string | null;
          updated_at: string;
        };
        Insert: {
          apellido?: string | null;
          created_at?: string;
          dni?: string | null;
          email?: string | null;
          es_jefe?: boolean;
          id: string;
          nombre?: string | null;
          perfil_completo?: boolean;
          solicitud_jefe?: "pendiente" | "rechazada" | null;
          unidad_id?: string | null;
          updated_at?: string;
        };
        Update: {
          apellido?: string | null;
          created_at?: string;
          dni?: string | null;
          email?: string | null;
          es_jefe?: boolean;
          id?: string;
          nombre?: string | null;
          perfil_completo?: boolean;
          solicitud_jefe?: "pendiente" | "rechazada" | null;
          unidad_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_unidad_id_fkey";
            columns: ["unidad_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      unidades: {
        Row: {
          activo: boolean;
          cargo_jefe: string;
          created_at: string;
          id: string;
          nombre: string;
          orden: number;
          padre_id: string | null;
          tipo: string;
          updated_at: string;
        };
        Insert: {
          activo?: boolean;
          cargo_jefe: string;
          created_at?: string;
          id?: string;
          nombre: string;
          orden?: number;
          padre_id?: string | null;
          tipo: string;
          updated_at?: string;
        };
        Update: {
          activo?: boolean;
          cargo_jefe?: string;
          created_at?: string;
          id?: string;
          nombre?: string;
          orden?: number;
          padre_id?: string | null;
          tipo?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "unidades_padre_id_fkey";
            columns: ["padre_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
        ];
      };
      solicitudes: {
        Row: {
          asignado_a: string | null;
          colaborador_id: string | null;
          descripcion: string;
          estado: Database["public"]["Enums"]["estado_solicitud"];
          fecha_creacion: string;
          fecha_finalizacion: string | null;
          id: string;
          motivo: string;
          motivo_cancelacion: string | null;
          motivo_pausa_detalle: string | null;
          motivo_pausa_id: string | null;
          resolucion: string | null;
          revisada_en: string | null;
          revisada_por: string | null;
          solicitante_email: string | null;
          solicitante_nombre: string | null;
          unidad_id: string | null;
          unidad_nombre_snapshot: string | null;
          urgencia: Database["public"]["Enums"]["urgencia"];
          usuario_id: string | null;
        };
        Insert: {
          asignado_a?: string | null;
          colaborador_id?: string | null;
          descripcion: string;
          estado?: Database["public"]["Enums"]["estado_solicitud"];
          fecha_creacion?: string;
          fecha_finalizacion?: string | null;
          id?: string;
          motivo: string;
          motivo_cancelacion?: string | null;
          motivo_pausa_detalle?: string | null;
          motivo_pausa_id?: string | null;
          resolucion?: string | null;
          revisada_en?: string | null;
          revisada_por?: string | null;
          solicitante_email?: string | null;
          solicitante_nombre?: string | null;
          unidad_id?: string | null;
          unidad_nombre_snapshot?: string | null;
          urgencia?: Database["public"]["Enums"]["urgencia"];
          usuario_id?: string | null;
        };
        Update: {
          asignado_a?: string | null;
          colaborador_id?: string | null;
          descripcion?: string;
          estado?: Database["public"]["Enums"]["estado_solicitud"];
          fecha_creacion?: string;
          fecha_finalizacion?: string | null;
          id?: string;
          motivo?: string;
          motivo_cancelacion?: string | null;
          motivo_pausa_detalle?: string | null;
          motivo_pausa_id?: string | null;
          resolucion?: string | null;
          revisada_en?: string | null;
          revisada_por?: string | null;
          solicitante_email?: string | null;
          solicitante_nombre?: string | null;
          unidad_id?: string | null;
          unidad_nombre_snapshot?: string | null;
          urgencia?: Database["public"]["Enums"]["urgencia"];
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "solicitudes_asignado_a_fkey";
            columns: ["asignado_a"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_colaborador_id_fkey";
            columns: ["colaborador_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_unidad_id_fkey";
            columns: ["unidad_id"];
            isOneToOne: false;
            referencedRelation: "unidades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitudes_motivo_pausa_id_fkey";
            columns: ["motivo_pausa_id"];
            isOneToOne: false;
            referencedRelation: "motivos_pausa";
            referencedColumns: ["id"];
          },
        ];
      };
      motivos_pausa: {
        Row: {
          descripcion: string;
          id: string;
          orden: number;
        };
        Insert: {
          descripcion: string;
          id?: string;
          orden: number;
        };
        Update: {
          descripcion?: string;
          id?: string;
          orden?: number;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      unidades_arbol: {
        Row: {
          activo: boolean;
          cargo_jefe: string;
          codigo: string;
          id: string;
          nivel: number;
          nombre: string;
          orden: number;
          padre_id: string | null;
          ruta: string;
          tipo: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      calificar_solicitud: {
        Args: {
          _comentario: string | null;
          _omitir: boolean;
          _puntaje: number | null;
          _solicitud_id: string;
        };
        Returns: undefined;
      };
      solicitudes_por_calificar: {
        Args: Record<PropertyKey, never>;
        Returns: {
          fecha_finalizacion: string;
          id: string;
          motivo: string;
          responsable_nombre: string | null;
        }[];
      };
      eliminar_usuario: {
        Args: {
          _user_id: string;
        };
        Returns: undefined;
      };
      marcar_solicitud_revisada: {
        Args: {
          _solicitud_id: string;
        };
        Returns: undefined;
      };
      resolver_solicitud_jefatura: {
        Args: {
          _aprobar: boolean;
          _profile_id: string;
        };
        Returns: undefined;
      };
      resumen_unidades: {
        Args: Record<PropertyKey, never>;
        Returns: {
          tickets: number;
          unidad_id: string;
          usuarios: number;
        }[];
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "empleado" | "administrador";
      estado_solicitud:
        "en_espera" | "en_proceso" | "finalizado" | "cancelado" | "visto" | "pausado";
      urgencia: "urgente" | "normal";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["empleado", "administrador"],
      estado_solicitud: ["en_espera", "en_proceso", "finalizado", "cancelado", "visto", "pausado"],
      urgencia: ["urgente", "normal"],
    },
  },
} as const;
