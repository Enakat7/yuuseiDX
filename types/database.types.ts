export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      areas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      count_categories: {
        Row: {
          created_at: string
          delivery_type_id: string | null
          id: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivery_type_id?: string | null
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivery_type_id?: string | null
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_categories_delivery_type_id_fkey"
            columns: ["delivery_type_id"]
            isOneToOne: false
            referencedRelation: "delivery_types"
            referencedColumns: ["id"]
          },
        ]
      }
      count_entries: {
        Row: {
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          category_id: string
          count: number
          created_at: string
          driver_id: string
          entered_by: string | null
          id: string
          updated_at: string
          work_date: string
        }
        Insert: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category_id: string
          count?: number
          created_at?: string
          driver_id: string
          entered_by?: string | null
          id?: string
          updated_at?: string
          work_date: string
        }
        Update: {
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          category_id?: string
          count?: number
          created_at?: string
          driver_id?: string
          entered_by?: string | null
          id?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "count_entries_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "count_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_entries_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "count_entries_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_amounts: {
        Row: {
          amount: number
          created_at: string
          deduction_item_id: string
          entered_by: string | null
          id: string
          period_month: string
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deduction_item_id: string
          entered_by?: string | null
          id?: string
          period_month: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          deduction_item_id?: string
          entered_by?: string | null
          id?: string
          period_month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deduction_amounts_deduction_item_id_fkey"
            columns: ["deduction_item_id"]
            isOneToOne: false
            referencedRelation: "deduction_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deduction_amounts_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deduction_item_defaults: {
        Row: {
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      deduction_items: {
        Row: {
          active: boolean
          created_at: string
          driver_id: string
          id: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          driver_id: string
          id?: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          driver_id?: string
          id?: string
          label?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "deduction_items_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          price_master_target: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          price_master_target?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          price_master_target?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      districts: {
        Row: {
          active: boolean
          area_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "districts_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      document_types: {
        Row: {
          created_at: string
          id: string
          is_expiring: boolean
          is_system: boolean
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_expiring?: boolean
          is_system?: boolean
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_expiring?: boolean
          is_system?: boolean
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_districts: {
        Row: {
          district_id: string
          driver_id: string
        }
        Insert: {
          district_id: string
          driver_id: string
        }
        Update: {
          district_id?: string
          driver_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_districts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_districts_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          created_at: string
          document_type_id: string
          driver_id: string
          expires_on: string | null
          id: string
          original_filename: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type_id: string
          driver_id: string
          expires_on?: string | null
          id?: string
          original_filename: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type_id?: string
          driver_id?: string
          expires_on?: string | null
          id?: string
          original_filename?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_documents_document_type_id_fkey"
            columns: ["document_type_id"]
            isOneToOne: false
            referencedRelation: "document_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          active: boolean
          area_id: string
          contract_start_date: string
          contract_type: string
          created_at: string
          email: string | null
          id: string
          name: string
          pay_type: string
          phone: string | null
          profile_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id: string
          contract_start_date: string
          contract_type: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          pay_type: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string
          contract_start_date?: string
          contract_type?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          pay_type?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_role: Database["public"]["Enums"]["user_role"]
          created_at: string
          id: number
          params: Json
          screen_name: string
          source: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_role: Database["public"]["Enums"]["user_role"]
          created_at?: string
          id?: never
          params?: Json
          screen_name: string
          source: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_role?: Database["public"]["Enums"]["user_role"]
          created_at?: string
          id?: never
          params?: Json
          screen_name?: string
          source?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operation_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operation_page_permissions: {
        Row: {
          can_access: boolean
          created_at: string
          id: string
          page_key: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string
          id?: string
          page_key: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          can_access?: boolean
          created_at?: string
          id?: string
          page_key?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "operation_page_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          name: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      unit_prices: {
        Row: {
          area_id: string
          created_at: string
          created_by: string | null
          delivery_type_id: string
          effective_from: string
          id: string
          price_kind: string
          price_yen: number
        }
        Insert: {
          area_id: string
          created_at?: string
          created_by?: string | null
          delivery_type_id: string
          effective_from: string
          id?: string
          price_kind: string
          price_yen: number
        }
        Update: {
          area_id?: string
          created_at?: string
          created_by?: string | null
          delivery_type_id?: string
          effective_from?: string
          id?: string
          price_kind?: string
          price_yen?: number
        }
        Relationships: [
          {
            foreignKeyName: "unit_prices_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_prices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unit_prices_delivery_type_id_fkey"
            columns: ["delivery_type_id"]
            isOneToOne: false
            referencedRelation: "delivery_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_driver_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_staff_or_admin: { Args: never; Returns: boolean }
      log_operation: {
        Args: {
          p_action: string
          p_params?: Json
          p_screen_name: string
          p_target_id?: string
          p_target_table?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "管理者" | "スタッフ" | "ドライバー"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: ["管理者", "スタッフ", "ドライバー"],
    },
  },
} as const

