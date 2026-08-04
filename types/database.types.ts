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
      advance_requests: {
        Row: {
          amount: number
          available_amount_snapshot: number
          created_at: string
          created_by: string | null
          driver_id: string
          id: string
          note: string | null
          payout_date: string
          request_no: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          available_amount_snapshot: number
          created_at?: string
          created_by?: string | null
          driver_id: string
          id?: string
          note?: string | null
          payout_date: string
          request_no: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          available_amount_snapshot?: number
          created_at?: string
          created_by?: string | null
          driver_id?: string
          id?: string
          note?: string | null
          payout_date?: string
          request_no?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "advance_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "advance_requests_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      delivery_districts: {
        Row: {
          active: boolean
          area_id: string | null
          background_color: string
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          area_id?: string | null
          background_color?: string
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          area_id?: string | null
          background_color?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_districts_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
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
          max_files: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_expiring?: boolean
          is_system?: boolean
          label: string
          max_files?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_expiring?: boolean
          is_system?: boolean
          label?: string
          max_files?: number | null
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
      driver_document_files: {
        Row: {
          created_at: string
          driver_document_id: string
          id: string
          original_filename: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          driver_document_id: string
          id?: string
          original_filename: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          driver_document_id?: string
          id?: string
          original_filename?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_document_files_driver_document_id_fkey"
            columns: ["driver_document_id"]
            isOneToOne: false
            referencedRelation: "driver_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_document_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_documents: {
        Row: {
          cali_period_start: string | null
          cali_policyholder_address: string | null
          cali_policyholder_name: string | null
          cali_registration_classification: string | null
          cali_registration_number: string | null
          cali_registration_place: string | null
          cali_registration_usage: string | null
          created_at: string
          document_type_id: string
          driver_id: string
          expires_on: string | null
          id: string
          insurance_coverage_bodily: string | null
          insurance_coverage_cargo: string | null
          insurance_coverage_personal: string | null
          insurance_coverage_property: string | null
          insurance_coverage_vehicle: string | null
          insurance_driver_condition: string | null
          insurance_insured_name: string | null
          insurance_insured_vehicle: string | null
          insurance_period_start: string | null
          insurance_policy_number: string | null
          insurance_vehicle_owner: string | null
          license_address: string | null
          license_birth_date: string | null
          license_conditions: string | null
          license_holder_name: string | null
          license_issued_date: string | null
          license_number: string | null
          updated_at: string
          vehicle_cert_base_location: string | null
          vehicle_cert_chassis_number: string | null
          vehicle_cert_displacement: string | null
          vehicle_cert_max_load: string | null
          vehicle_cert_model_name: string | null
          vehicle_cert_number: string | null
          vehicle_cert_owner_address: string | null
          vehicle_cert_owner_name: string | null
          vehicle_cert_purpose: string | null
          vehicle_cert_type: string | null
          vehicle_cert_usage: string | null
        }
        Insert: {
          cali_period_start?: string | null
          cali_policyholder_address?: string | null
          cali_policyholder_name?: string | null
          cali_registration_classification?: string | null
          cali_registration_number?: string | null
          cali_registration_place?: string | null
          cali_registration_usage?: string | null
          created_at?: string
          document_type_id: string
          driver_id: string
          expires_on?: string | null
          id?: string
          insurance_coverage_bodily?: string | null
          insurance_coverage_cargo?: string | null
          insurance_coverage_personal?: string | null
          insurance_coverage_property?: string | null
          insurance_coverage_vehicle?: string | null
          insurance_driver_condition?: string | null
          insurance_insured_name?: string | null
          insurance_insured_vehicle?: string | null
          insurance_period_start?: string | null
          insurance_policy_number?: string | null
          insurance_vehicle_owner?: string | null
          license_address?: string | null
          license_birth_date?: string | null
          license_conditions?: string | null
          license_holder_name?: string | null
          license_issued_date?: string | null
          license_number?: string | null
          updated_at?: string
          vehicle_cert_base_location?: string | null
          vehicle_cert_chassis_number?: string | null
          vehicle_cert_displacement?: string | null
          vehicle_cert_max_load?: string | null
          vehicle_cert_model_name?: string | null
          vehicle_cert_number?: string | null
          vehicle_cert_owner_address?: string | null
          vehicle_cert_owner_name?: string | null
          vehicle_cert_purpose?: string | null
          vehicle_cert_type?: string | null
          vehicle_cert_usage?: string | null
        }
        Update: {
          cali_period_start?: string | null
          cali_policyholder_address?: string | null
          cali_policyholder_name?: string | null
          cali_registration_classification?: string | null
          cali_registration_number?: string | null
          cali_registration_place?: string | null
          cali_registration_usage?: string | null
          created_at?: string
          document_type_id?: string
          driver_id?: string
          expires_on?: string | null
          id?: string
          insurance_coverage_bodily?: string | null
          insurance_coverage_cargo?: string | null
          insurance_coverage_personal?: string | null
          insurance_coverage_property?: string | null
          insurance_coverage_vehicle?: string | null
          insurance_driver_condition?: string | null
          insurance_insured_name?: string | null
          insurance_insured_vehicle?: string | null
          insurance_period_start?: string | null
          insurance_policy_number?: string | null
          insurance_vehicle_owner?: string | null
          license_address?: string | null
          license_birth_date?: string | null
          license_conditions?: string | null
          license_holder_name?: string | null
          license_issued_date?: string | null
          license_number?: string | null
          updated_at?: string
          vehicle_cert_base_location?: string | null
          vehicle_cert_chassis_number?: string | null
          vehicle_cert_displacement?: string | null
          vehicle_cert_max_load?: string | null
          vehicle_cert_model_name?: string | null
          vehicle_cert_number?: string | null
          vehicle_cert_owner_address?: string | null
          vehicle_cert_owner_name?: string | null
          vehicle_cert_purpose?: string | null
          vehicle_cert_type?: string | null
          vehicle_cert_usage?: string | null
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
        ]
      }
      drivers: {
        Row: {
          active: boolean
          address: string | null
          advance_eligible: boolean
          area_id: string
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch: string | null
          bank_name: string | null
          company_name: string | null
          contract_deadline_date: string | null
          contract_end_date: string | null
          contract_indefinite: boolean
          contract_start_date: string
          contract_type: string
          created_at: string
          driver_role: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relation: string | null
          fixed_cost: number | null
          gas_card_issued_date: string | null
          gas_card_provided: boolean
          gas_card_type: string | null
          id: string
          name: string
          other_conditions: string | null
          pay_type: string
          phone: string | null
          profile_id: string | null
          updated_at: string
          vehicle_inspection_deadline: string | null
          vehicle_insurance_deadline: string | null
          vehicle_lease_cost: number | null
          vehicle_lease_start_date: string | null
          vehicle_number: string | null
          vehicle_ownership: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          advance_eligible?: boolean
          area_id: string
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          company_name?: string | null
          contract_deadline_date?: string | null
          contract_end_date?: string | null
          contract_indefinite?: boolean
          contract_start_date: string
          contract_type: string
          created_at?: string
          driver_role?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          fixed_cost?: number | null
          gas_card_issued_date?: string | null
          gas_card_provided?: boolean
          gas_card_type?: string | null
          id?: string
          name: string
          other_conditions?: string | null
          pay_type: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
          vehicle_inspection_deadline?: string | null
          vehicle_insurance_deadline?: string | null
          vehicle_lease_cost?: number | null
          vehicle_lease_start_date?: string | null
          vehicle_number?: string | null
          vehicle_ownership?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          advance_eligible?: boolean
          area_id?: string
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch?: string | null
          bank_name?: string | null
          company_name?: string | null
          contract_deadline_date?: string | null
          contract_end_date?: string | null
          contract_indefinite?: boolean
          contract_start_date?: string
          contract_type?: string
          created_at?: string
          driver_role?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relation?: string | null
          fixed_cost?: number | null
          gas_card_issued_date?: string | null
          gas_card_provided?: boolean
          gas_card_type?: string | null
          id?: string
          name?: string
          other_conditions?: string | null
          pay_type?: string
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
          vehicle_inspection_deadline?: string | null
          vehicle_insurance_deadline?: string | null
          vehicle_lease_cost?: number | null
          vehicle_lease_start_date?: string | null
          vehicle_number?: string | null
          vehicle_ownership?: string | null
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
      login_lockouts: {
        Row: {
          fail_count: number
          ip: string
          lock_until: string | null
          permanent: boolean
          updated_at: string
        }
        Insert: {
          fail_count?: number
          ip: string
          lock_until?: string | null
          permanent?: boolean
          updated_at?: string
        }
        Update: {
          fail_count?: number
          ip?: string
          lock_until?: string | null
          permanent?: boolean
          updated_at?: string
        }
        Relationships: []
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
      payment_notice_email_sends: {
        Row: {
          id: string
          payment_notice_id: string
          sent_at: string
          sent_by: string | null
          sent_to: string
        }
        Insert: {
          id?: string
          payment_notice_id: string
          sent_at?: string
          sent_by?: string | null
          sent_to: string
        }
        Update: {
          id?: string
          payment_notice_id?: string
          sent_at?: string
          sent_by?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notice_email_sends_payment_notice_id_fkey"
            columns: ["payment_notice_id"]
            isOneToOne: false
            referencedRelation: "payment_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notice_email_sends_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notice_items: {
        Row: {
          amount: number
          category_id: string
          count: number
          id: string
          payment_notice_id: string
          unit_price_snapshot: number
        }
        Insert: {
          amount?: number
          category_id: string
          count?: number
          id?: string
          payment_notice_id: string
          unit_price_snapshot?: number
        }
        Update: {
          amount?: number
          category_id?: string
          count?: number
          id?: string
          payment_notice_id?: string
          unit_price_snapshot?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_notice_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "count_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notice_items_payment_notice_id_fkey"
            columns: ["payment_notice_id"]
            isOneToOne: false
            referencedRelation: "payment_notices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notice_revisions: {
        Row: {
          diff_summary: string | null
          id: string
          new_amount: number
          payment_notice_id: string
          previous_amount: number
          revised_at: string
          revised_by: string | null
        }
        Insert: {
          diff_summary?: string | null
          id?: string
          new_amount: number
          payment_notice_id: string
          previous_amount: number
          revised_at?: string
          revised_by?: string | null
        }
        Update: {
          diff_summary?: string | null
          id?: string
          new_amount?: number
          payment_notice_id?: string
          previous_amount?: number
          revised_at?: string
          revised_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_notice_revisions_payment_notice_id_fkey"
            columns: ["payment_notice_id"]
            isOneToOne: false
            referencedRelation: "payment_notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notice_revisions_revised_by_fkey"
            columns: ["revised_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_notices: {
        Row: {
          amount: number
          area_id: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          driver_acknowledged_at: string | null
          driver_acknowledged_ip: string | null
          driver_id: string
          id: string
          notice_no: string
          pay_type: string
          period_end: string
          period_start: string
          remarks: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          area_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          driver_acknowledged_at?: string | null
          driver_acknowledged_ip?: string | null
          driver_id: string
          id?: string
          notice_no: string
          pay_type: string
          period_end: string
          period_start: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          area_id?: string | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          driver_acknowledged_at?: string | null
          driver_acknowledged_ip?: string | null
          driver_id?: string
          id?: string
          notice_no?: string
          pay_type?: string
          period_end?: string
          period_start?: string
          remarks?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_notices_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notices_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_notices_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
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
      purchase_orders: {
        Row: {
          area_id: string | null
          created_at: string
          district_id: string | null
          driver_approved_at: string | null
          driver_approved_ip: string | null
          driver_id: string
          id: string
          issued_at: string | null
          issued_by: string | null
          order_no: string
          pdf_storage_path: string | null
          period_end: string
          period_start: string
          reissue_count: number
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          area_id?: string | null
          created_at?: string
          district_id?: string | null
          driver_approved_at?: string | null
          driver_approved_ip?: string | null
          driver_id: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          order_no: string
          pdf_storage_path?: string | null
          period_end: string
          period_start: string
          reissue_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          area_id?: string | null
          created_at?: string
          district_id?: string | null
          driver_approved_at?: string | null
          driver_approved_ip?: string | null
          driver_id?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          order_no?: string
          pdf_storage_path?: string | null
          period_end?: string
          period_start?: string
          reissue_count?: number
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      work_schedule_days: {
        Row: {
          created_at: string
          driver_id: string
          id: string
          updated_at: string
          updated_by: string | null
          work_date: string
          worked: boolean
        }
        Insert: {
          created_at?: string
          driver_id: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          work_date: string
          worked?: boolean
        }
        Update: {
          created_at?: string
          driver_id?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
          work_date?: string
          worked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "work_schedule_days_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_schedule_days_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_payment_notice: {
        Args: { p_ip?: string; p_notice_id: string }
        Returns: undefined
      }
      approve_purchase_order: {
        Args: { p_ip?: string; p_order_id: string }
        Returns: undefined
      }
      current_driver_id: { Args: never; Returns: string }
      driver_available_advance: {
        Args: { p_period_month: string }
        Returns: number
      }
      driver_earnings: {
        Args: { p_date_from: string; p_date_to: string; p_driver_id: string }
        Returns: number
      }
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

