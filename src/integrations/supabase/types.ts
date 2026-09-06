export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      card_price_latest: {
        Row: {
          card_id: string
          change_24h: number | null
          change_30d: number | null
          change_7d: number | null
          created_at: string
          currency: string
          price: number
          source: string
          updated_at: string
        }
        Insert: {
          card_id: string
          change_24h?: number | null
          change_30d?: number | null
          change_7d?: number | null
          created_at?: string
          currency?: string
          price: number
          source: string
          updated_at?: string
        }
        Update: {
          card_id?: string
          change_24h?: number | null
          change_30d?: number | null
          change_7d?: number | null
          created_at?: string
          currency?: string
          price?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_price_latest_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "tcg_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      card_price_points: {
        Row: {
          captured_on: string
          card_id: string
          condition: string
          created_at: string
          currency: string
          id: string
          price: number
          source: string
        }
        Insert: {
          captured_on?: string
          card_id: string
          condition?: string
          created_at?: string
          currency?: string
          id?: string
          price: number
          source: string
        }
        Update: {
          captured_on?: string
          card_id?: string
          condition?: string
          created_at?: string
          currency?: string
          id?: string
          price?: number
          source?: string
        }
        Relationships: []
      }
      card_sales: {
        Row: {
          card_id: string
          condition: string | null
          created_at: string
          currency: string
          external_id: string
          id: string
          price: number
          price_usd: number | null
          sold_at: string
          source: string
          title: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          card_id: string
          condition?: string | null
          created_at?: string
          currency?: string
          external_id: string
          id?: string
          price: number
          price_usd?: number | null
          sold_at: string
          source: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          card_id?: string
          condition?: string | null
          created_at?: string
          currency?: string
          external_id?: string
          id?: string
          price?: number
          price_usd?: number | null
          sold_at?: string
          source?: string
          title?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: []
      }
      catalog_sync_runs: {
        Row: {
          cards_upserted: number
          detail: string | null
          finished_at: string | null
          id: string
          sets_upserted: number
          source: string
          started_at: string
          status: string
        }
        Insert: {
          cards_upserted?: number
          detail?: string | null
          finished_at?: string | null
          id?: string
          sets_upserted?: number
          source: string
          started_at?: string
          status: string
        }
        Update: {
          cards_upserted?: number
          detail?: string | null
          finished_at?: string | null
          id?: string
          sets_upserted?: number
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      ebay_call_budget: {
        Row: {
          calls: number
          day: string
          updated_at: string
        }
        Insert: {
          calls?: number
          day: string
          updated_at?: string
        }
        Update: {
          calls?: number
          day?: string
          updated_at?: string
        }
        Relationships: []
      }
      ebay_probe_log: {
        Row: {
          card_id: string
          matched: boolean
          probed_at: string
        }
        Insert: {
          card_id: string
          matched?: boolean
          probed_at?: string
        }
        Update: {
          card_id?: string
          matched?: boolean
          probed_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          currency: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          currency?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tcg_cards: {
        Row: {
          artist: string | null
          english_name: string | null
          english_set_name: string | null
          game: string
          hp: number | null
          id: string
          image_large: string | null
          image_small: string | null
          is_promo: boolean
          language: string
          market_price: number | null
          name: string
          native_name: string | null
          number: string
          rarity: string | null
          release_date: string | null
          search_text: string | null
          set_code: string | null
          set_id: string | null
          set_name: string
          subtypes: string[] | null
          supertype: string | null
          types: string[] | null
          updated_at: string
        }
        Insert: {
          artist?: string | null
          english_name?: string | null
          english_set_name?: string | null
          game?: string
          hp?: number | null
          id: string
          image_large?: string | null
          image_small?: string | null
          is_promo?: boolean
          language: string
          market_price?: number | null
          name: string
          native_name?: string | null
          number: string
          rarity?: string | null
          release_date?: string | null
          search_text?: string | null
          set_code?: string | null
          set_id?: string | null
          set_name: string
          subtypes?: string[] | null
          supertype?: string | null
          types?: string[] | null
          updated_at?: string
        }
        Update: {
          artist?: string | null
          english_name?: string | null
          english_set_name?: string | null
          game?: string
          hp?: number | null
          id?: string
          image_large?: string | null
          image_small?: string | null
          is_promo?: boolean
          language?: string
          market_price?: number | null
          name?: string
          native_name?: string | null
          number?: string
          rarity?: string | null
          release_date?: string | null
          search_text?: string | null
          set_code?: string | null
          set_id?: string | null
          set_name?: string
          subtypes?: string[] | null
          supertype?: string | null
          types?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tcg_cards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "tcg_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      tcg_sets: {
        Row: {
          code: string | null
          created_at: string
          english_name: string | null
          game: string
          id: string
          language: string
          logo_url: string | null
          name: string
          printed_total: number | null
          release_date: string | null
          series: string | null
          symbol_url: string | null
          sync_attempts: number
          synced_at: string | null
          total: number | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          english_name?: string | null
          game?: string
          id: string
          language: string
          logo_url?: string | null
          name: string
          printed_total?: number | null
          release_date?: string | null
          series?: string | null
          symbol_url?: string | null
          sync_attempts?: number
          synced_at?: string | null
          total?: number | null
        }
        Update: {
          code?: string | null
          created_at?: string
          english_name?: string | null
          game?: string
          id?: string
          language?: string
          logo_url?: string | null
          name?: string
          printed_total?: number | null
          release_date?: string | null
          series?: string | null
          symbol_url?: string | null
          sync_attempts?: number
          synced_at?: string | null
          total?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      card_trend: {
        Args: { _card_id: string }
        Returns: {
          from_date: string
          from_price: number
          pct: number
          to_price: number
          window_days: number
        }[]
      }
      ebay_reserve_calls: {
        Args: { _cap?: number; _want: number }
        Returns: number
      }
      ebay_sync_candidates: {
        Args: { _language: string; _limit: number; _strategy: string }
        Returns: {
          english_name: string
          id: string
          language: string
          name: string
          number: string
          set_code: string
          set_name: string
        }[]
      }
      refresh_price_changes: { Args: never; Returns: number }
      set_card_counts: {
        Args: { lang: string }
        Returns: {
          n: number
          set_id: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
