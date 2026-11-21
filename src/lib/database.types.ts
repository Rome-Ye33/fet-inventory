// 由 Supabase 生成（项目 FET AUTO Inventory）。表、视图或函数改了以后重新生成。
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18'
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          full_name: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      catalog_options: {
        Row: { list: string; sort: number; value: string }
        Insert: { list: string; sort?: number; value: string }
        Update: { list?: string; sort?: number; value?: string }
        Relationships: []
      }
      locations: {
        Row: { active: boolean; created_at: string; id: number; kind: string; name: string }
        Insert: { active?: boolean; created_at?: string; id?: never; kind?: string; name: string }
        Update: { active?: boolean; created_at?: string; id?: never; kind?: string; name?: string }
        Relationships: []
      }
      movements: {
        Row: {
          action: string
          created_by: string | null
          customer: string | null
          customs_status: string | null
          from_location: string | null
          input_time: string
          op_date: string
          outbound_no: string | null
          qty: number
          remark: string | null
          seq: number
          status: string
          to_location: string | null
          vehicle_id: number
          void_reason: string | null
          voided_at: string | null
        }
        Insert: {
          action: string
          created_by?: string | null
          customer?: string | null
          customs_status?: string | null
          from_location?: string | null
          input_time?: string
          op_date?: string
          outbound_no?: string | null
          qty?: number
          remark?: string | null
          seq?: number
          status?: string
          to_location?: string | null
          vehicle_id: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Update: {
          action?: string
          created_by?: string | null
          customer?: string | null
          customs_status?: string | null
          from_location?: string | null
          input_time?: string
          op_date?: string
          outbound_no?: string | null
          qty?: number
          remark?: string | null
          seq?: number
          status?: string
          to_location?: string | null
          vehicle_id?: number
          void_reason?: string | null
          voided_at?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string
          category: string
          code: string
          color: string
          created_at: string
          price_usd: number | null
          product_name: string
        }
        Insert: {
          brand: string
          category: string
          code: string
          color: string
          created_at?: string
          price_usd?: number | null
          product_name: string
        }
        Update: {
          brand?: string
          category?: string
          code?: string
          color?: string
          created_at?: string
          price_usd?: number | null
          product_name?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          boe_no: string | null
          brand: string | null
          color: string | null
          created_at: string
          customs_status: string | null
          excluded: boolean
          id: number
          inbound_date: string | null
          initial_location: string | null
          initial_qty: number
          model: string | null
          product_code: string
          product_name: string | null
          remark: string | null
          review_note: string | null
          updated_at: string
          vin: string
        }
        Insert: {
          boe_no?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          customs_status?: string | null
          excluded?: boolean
          id?: never
          inbound_date?: string | null
          initial_location?: string | null
          initial_qty?: number
          model?: string | null
          product_code: string
          product_name?: string | null
          remark?: string | null
          review_note?: string | null
          updated_at?: string
          vin: string
        }
        Update: {
          boe_no?: string | null
          brand?: string | null
          color?: string | null
          created_at?: string
          customs_status?: string | null
          excluded?: boolean
          id?: never
          inbound_date?: string | null
          initial_location?: string | null
          initial_qty?: number
          model?: string | null
          product_code?: string
          product_name?: string | null
          remark?: string | null
          review_note?: string | null
          updated_at?: string
          vin?: string
        }
        Relationships: []
      }
    }
    Views: {
      customer_names: {
        Row: { last_date: string | null; name: string | null; times: number | null }
        Relationships: []
      }
      movement_log: {
        Row: {
          action: string | null
          brand: string | null
          category: string | null
          color: string | null
          created_by: string | null
          created_by_name: string | null
          customer: string | null
          customs_status: string | null
          from_location: string | null
          input_time: string | null
          model: string | null
          op_date: string | null
          outbound_no: string | null
          product_code: string | null
          product_name: string | null
          qty: number | null
          remark: string | null
          seq: number | null
          status: string | null
          to_location: string | null
          vin: string | null
          void_reason: string | null
          voided_at: string | null
        }
        Relationships: []
      }
      stock_by_location: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          current_location: string | null
          model: string | null
          product_code: string | null
          product_name: string | null
          qty: number | null
        }
        Relationships: []
      }
      stock_report: {
        Row: {
          brand: string | null
          category: string | null
          color: string | null
          model: string | null
          price_usd: number | null
          product_code: string | null
          product_name: string | null
          total_qty: number | null
        }
        Relationships: []
      }
      vehicle_stock: {
        Row: {
          boe_no: string | null
          brand: string | null
          category: string | null
          color: string | null
          current_location: string | null
          current_qty: number | null
          customs_status: string | null
          excluded: boolean | null
          inbound_date: string | null
          initial_location: string | null
          initial_qty: number | null
          last_sold_date: string | null
          model: string | null
          price_usd: number | null
          product_code: string | null
          product_name: string | null
          remark: string | null
          review_note: string | null
          sold_qty: number | null
          stock_status: string | null
          vehicle_id: number | null
          vin: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_catalog_option: { Args: { p_list: string; p_value: string }; Returns: undefined }
      list_invites: {
        Args: never
        Returns: { active: boolean; created_at: string; email: string; registered: boolean; role: string }[]
      }
      norm_vin: { Args: { p: string }; Returns: string }
      set_product_price: { Args: { p_code: string; p_price_usd: number }; Returns: undefined }
      set_user_access: { Args: { p_active?: boolean; p_email: string; p_role?: string }; Returns: undefined }
      submit_inbound: {
        Args: {
          p_boe_no?: string
          p_brand: string
          p_category: string
          p_color: string
          p_customs_status?: string
          p_location: string
          p_model: string
          p_op_date?: string
          p_product_code?: string
          p_product_name: string
          p_qty?: number
          p_remark?: string
          p_vin: string
        }
        Returns: number
      }
      submit_sale: {
        Args: {
          p_customer: string
          p_from_location?: string
          p_op_date?: string
          p_qty?: number
          p_remark?: string
          p_vin: string
        }
        Returns: number
      }
      submit_transfer: {
        Args: {
          p_from_location?: string
          p_op_date?: string
          p_qty?: number
          p_remark?: string
          p_to_location: string
          p_vin: string
        }
        Returns: number
      }
      suggest_product_code: {
        Args: { p_brand: string; p_category: string; p_color: string; p_product_name: string }
        Returns: string
      }
      update_vehicle: {
        Args: {
          p_boe_no?: string
          p_customs_status?: string
          p_excluded?: boolean
          p_model?: string
          p_remark?: string
          p_review_note?: string
          p_vin: string
        }
        Returns: undefined
      }
      upsert_location: { Args: { p_active?: boolean; p_kind?: string; p_name: string }; Returns: undefined }
      vehicle_has_active_inbound: { Args: { p_vehicle_id: number }; Returns: boolean }
      void_movement: { Args: { p_reason?: string; p_seq: number }; Returns: number }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
