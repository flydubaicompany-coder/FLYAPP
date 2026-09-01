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
      accommodation_guests: {
        Row: {
          accommodation_id: string
          created_at: string
          room_number: string | null
          room_released_at: string | null
          user_id: string
        }
        Insert: {
          accommodation_id: string
          created_at?: string
          room_number?: string | null
          room_released_at?: string | null
          user_id: string
        }
        Update: {
          accommodation_id?: string
          created_at?: string
          room_number?: string | null
          room_released_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodation_guests_accommodation_id_fkey"
            columns: ["accommodation_id"]
            isOneToOne: false
            referencedRelation: "accommodations"
            referencedColumns: ["id"]
          },
        ]
      }
      accommodations: {
        Row: {
          address: string | null
          checkin_at: string | null
          checkout_at: string | null
          created_at: string
          id: string
          map_url: string | null
          name: string
          phone: string | null
          policy: string | null
          timezone: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string
          id?: string
          map_url?: string | null
          name: string
          phone?: string | null
          policy?: string | null
          timezone: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          checkin_at?: string | null
          checkout_at?: string | null
          created_at?: string
          id?: string
          map_url?: string | null
          name?: string
          phone?: string | null
          policy?: string | null
          timezone?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          change_note: string | null
          changed_at: string | null
          created_at: string
          departure_at: string | null
          description: string | null
          dress_code: string | null
          ends_at: string | null
          id: string
          image_path: string | null
          instructions: string | null
          meeting_map_url: string | null
          meeting_point: string | null
          requires_ack: boolean
          responsible_name: string | null
          sort_order: number
          starts_at: string | null
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          trip_day_id: string
          updated_at: string
          what_to_bring: string | null
        }
        Insert: {
          change_note?: string | null
          changed_at?: string | null
          created_at?: string
          departure_at?: string | null
          description?: string | null
          dress_code?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          meeting_map_url?: string | null
          meeting_point?: string | null
          requires_ack?: boolean
          responsible_name?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          trip_day_id: string
          updated_at?: string
          what_to_bring?: string | null
        }
        Update: {
          change_note?: string | null
          changed_at?: string | null
          created_at?: string
          departure_at?: string | null
          description?: string | null
          dress_code?: string | null
          ends_at?: string | null
          id?: string
          image_path?: string | null
          instructions?: string | null
          meeting_map_url?: string | null
          meeting_point?: string | null
          requires_ack?: boolean
          responsible_name?: string | null
          sort_order?: number
          starts_at?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          trip_day_id?: string
          updated_at?: string
          what_to_bring?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_trip_day_id_fkey"
            columns: ["trip_day_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_acks: {
        Row: {
          acknowledged_at: string
          activity_id: string
          changed_at: string
          id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          activity_id: string
          changed_at: string
          id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          activity_id?: string
          changed_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_acks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_checkins: {
        Row: {
          activity_id: string
          checked_in_at: string
          checked_in_by: string | null
          id: string
          justification: string | null
          method: string
          user_id: string
        }
        Insert: {
          activity_id: string
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          justification?: string | null
          method: string
          user_id: string
        }
        Update: {
          activity_id?: string
          checked_in_at?: string
          checked_in_by?: string | null
          id?: string
          justification?: string | null
          method?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_checkins_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_participants: {
        Row: {
          activity_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_participants_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      app_config: {
        Row: {
          description: string | null
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: Database["public"]["Enums"]["fly_role"] | null
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
          occurred_at: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["fly_role"] | null
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: Database["public"]["Enums"]["fly_role"] | null
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
          occurred_at?: string
        }
        Relationships: []
      }
      benefit_redemptions: {
        Row: {
          benefit_id: string
          code: string
          id: string
          ledger_entry_id: string
          points_spent: number
          redeemed_at: string
          user_id: string
        }
        Insert: {
          benefit_id: string
          code: string
          id?: string
          ledger_entry_id: string
          points_spent: number
          redeemed_at?: string
          user_id: string
        }
        Update: {
          benefit_id?: string
          code?: string
          id?: string
          ledger_entry_id?: string
          points_spent?: number
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "benefit_redemptions_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "benefit_redemptions_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "points_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      benefits: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          min_level: string | null
          min_package: Database["public"]["Enums"]["fly_package"] | null
          points_cost: number
          sort_order: number
          stock: number | null
          title: string
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          min_level?: string | null
          min_package?: Database["public"]["Enums"]["fly_package"] | null
          points_cost: number
          sort_order?: number
          stock?: number | null
          title: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          min_level?: string | null
          min_package?: Database["public"]["Enums"]["fly_package"] | null
          points_cost?: number
          sort_order?: number
          stock?: number | null
          title?: string
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      cancellation_policies: {
        Row: {
          created_at: string
          description: string
          id: string
          key: string
          label: string
          rules: Json
          version: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          key: string
          label: string
          rules?: Json
          version: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          key?: string
          label?: string
          rules?: Json
          version?: number
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          currency_snapshot: string
          hold_expires_at: string
          id: string
          people: number
          price_cents_snapshot: number
          slot_id: string
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          currency_snapshot: string
          hold_expires_at: string
          id?: string
          people: number
          price_cents_snapshot: number
          slot_id: string
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          currency_snapshot?: string
          hold_expires_at?: string
          id?: string
          people?: number
          price_cents_snapshot?: number
          slot_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "tour_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "tour_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companionships: {
        Row: {
          authorized_at: string
          authorized_by: string | null
          dependent_id: string
          id: string
          kind: Database["public"]["Enums"]["companionship_kind"]
          responsible_id: string
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          authorized_at?: string
          authorized_by?: string | null
          dependent_id: string
          id?: string
          kind: Database["public"]["Enums"]["companionship_kind"]
          responsible_id: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          authorized_at?: string
          authorized_by?: string | null
          dependent_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["companionship_kind"]
          responsible_id?: string
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      consent_purposes: {
        Row: {
          current_version: number
          description: string
          is_required: boolean
          is_sensitive: boolean
          key: string
          label: string
        }
        Insert: {
          current_version?: number
          description: string
          is_required?: boolean
          is_sensitive?: boolean
          key: string
          label: string
        }
        Update: {
          current_version?: number
          description?: string
          is_required?: boolean
          is_sensitive?: boolean
          key?: string
          label?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          granted: boolean
          id: number
          purpose_key: string
          recorded_at: string
          source: string
          user_id: string
          version: number
        }
        Insert: {
          granted: boolean
          id?: never
          purpose_key: string
          recorded_at?: string
          source?: string
          user_id: string
          version: number
        }
        Update: {
          granted?: boolean
          id?: never
          purpose_key?: string
          recorded_at?: string
          source?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consents_purpose_key_fkey"
            columns: ["purpose_key"]
            isOneToOne: false
            referencedRelation: "consent_purposes"
            referencedColumns: ["key"]
          },
        ]
      }
      coupons: {
        Row: {
          amount_off_cents: number | null
          code: string
          created_at: string
          currency: string | null
          is_active: boolean
          label: string
          max_redemptions: number | null
          percent_off: number | null
          redemptions: number
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          amount_off_cents?: number | null
          code: string
          created_at?: string
          currency?: string | null
          is_active?: boolean
          label: string
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          amount_off_cents?: number | null
          code?: string
          created_at?: string
          currency?: string | null
          is_active?: boolean
          label?: string
          max_redemptions?: number | null
          percent_off?: number | null
          redemptions?: number
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      customer_packages: {
        Row: {
          granted_at: string
          granted_by: string | null
          note: string | null
          package: Database["public"]["Enums"]["fly_package"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          package: Database["public"]["Enums"]["fly_package"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          note?: string | null
          package?: Database["public"]["Enums"]["fly_package"]
          user_id?: string
        }
        Relationships: []
      }
      customer_preferences: {
        Row: {
          communication_channel: string
          image_authorization: boolean
          locale: string
          ranking_opt_in: boolean
          surprise_opt_in: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          communication_channel?: string
          image_authorization?: boolean
          locale?: string
          ranking_opt_in?: boolean
          surprise_opt_in?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          communication_channel?: string
          image_authorization?: boolean
          locale?: string
          ranking_opt_in?: boolean
          surprise_opt_in?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      customer_vouchers: {
        Row: {
          coupon_code: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          used_at: string | null
          used_order_id: string | null
          user_id: string
        }
        Insert: {
          coupon_code: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_order_id?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          used_at?: string | null
          used_order_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_vouchers_coupon_code_fkey"
            columns: ["coupon_code"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "customer_vouchers_used_order_id_fkey"
            columns: ["used_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          country: string
          created_at: string
          id: string
          name: string
          slug: string
          timezone: string
        }
        Insert: {
          country: string
          created_at?: string
          id?: string
          name: string
          slug: string
          timezone: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      devices: {
        Row: {
          app_version: string | null
          biometric_enabled: boolean
          created_at: string
          id: string
          last_seen_at: string
          model: string | null
          platform: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          biometric_enabled?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          model?: string | null
          platform: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          biometric_enabled?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string
          model?: string | null
          platform?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_access_log: {
        Row: {
          accessed_at: string
          accessed_by: string
          document_id: string
          id: number
          ip: unknown
          via: string
        }
        Insert: {
          accessed_at?: string
          accessed_by: string
          document_id: string
          id?: never
          ip?: unknown
          via: string
        }
        Update: {
          accessed_at?: string
          accessed_by?: string
          document_id?: string
          id?: never
          ip?: unknown
          via?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_grants: {
        Row: {
          document_id: string
          expires_at: string | null
          granted_at: string
          granted_by: string | null
          grantee_id: string
          id: string
          reason: string
          revoked_at: string | null
        }
        Insert: {
          document_id: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          grantee_id: string
          id?: string
          reason: string
          revoked_at?: string | null
        }
        Update: {
          document_id?: string
          expires_at?: string | null
          granted_at?: string
          granted_by?: string | null
          grantee_id?: string
          id?: string
          reason?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_grants_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          cacheable_offline: boolean
          created_at: string
          expires_at: string | null
          extracted: Json | null
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type: string | null
          owner_id: string
          requires_biometric: boolean
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          storage_path: string
          title: string
          trip_id: string | null
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          cacheable_offline?: boolean
          created_at?: string
          expires_at?: string | null
          extracted?: Json | null
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          owner_id: string
          requires_biometric?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path: string
          title: string
          trip_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          cacheable_offline?: boolean
          created_at?: string
          expires_at?: string | null
          extracted?: Json | null
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          mime_type?: string | null
          owner_id?: string
          requires_biometric?: boolean
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          storage_path?: string
          title?: string
          trip_id?: string | null
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relationship: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relationship?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relationship?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      event_ctas: {
        Row: {
          event_id: string
          id: string
          kind: Database["public"]["Enums"]["event_cta_kind"]
          label: string
          sort_order: number
          target_url: string | null
        }
        Insert: {
          event_id: string
          id?: string
          kind: Database["public"]["Enums"]["event_cta_kind"]
          label: string
          sort_order?: number
          target_url?: string | null
        }
        Update: {
          event_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["event_cta_kind"]
          label?: string
          sort_order?: number
          target_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_ctas_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_interests: {
        Row: {
          created_at: string
          event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_interests_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          event_id: string
          id: string
          kind: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          event_id: string
          id?: string
          kind?: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          event_id?: string
          id?: string
          kind?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          avatar_path: string | null
          event_id: string
          id: string
          name: string
          role: string | null
          sort_order: number
        }
        Insert: {
          avatar_path?: string | null
          event_id: string
          id?: string
          name: string
          role?: string | null
          sort_order?: number
        }
        Update: {
          avatar_path?: string | null
          event_id?: string
          id?: string
          name?: string
          role?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category_key: string
          city: string | null
          country: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          fly_benefit: string | null
          home_order: number | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          summary: string | null
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          category_key: string
          city?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fly_benefit?: string | null
          home_order?: number | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          category_key?: string
          city?: string | null
          country?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string | null
          fly_benefit?: string | null
          home_order?: number | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          summary?: string | null
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "event_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      feature_flags: {
        Row: {
          description: string | null
          is_enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          is_enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          is_enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      flight_passengers: {
        Row: {
          created_at: string
          document_id: string | null
          flight_id: string
          seat: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          flight_id: string
          seat?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string | null
          flight_id?: string
          seat?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_passengers_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          airline: string
          arrives_at: string
          baggage_allowance: string | null
          created_at: string
          departs_at: string
          destination_iata: string
          destination_timezone: string
          flight_number: string
          fly_base_instructions: string | null
          gate: string | null
          id: string
          leave_by_at: string | null
          origin_iata: string
          origin_timezone: string
          status: string | null
          terminal: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          airline: string
          arrives_at: string
          baggage_allowance?: string | null
          created_at?: string
          departs_at: string
          destination_iata: string
          destination_timezone: string
          flight_number: string
          fly_base_instructions?: string | null
          gate?: string | null
          id?: string
          leave_by_at?: string | null
          origin_iata: string
          origin_timezone: string
          status?: string | null
          terminal?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          airline?: string
          arrives_at?: string
          baggage_allowance?: string | null
          created_at?: string
          departs_at?: string
          destination_iata?: string
          destination_timezone?: string
          flight_number?: string
          fly_base_instructions?: string | null
          gate?: string | null
          id?: string
          leave_by_at?: string | null
          origin_iata?: string
          origin_timezone?: string
          status?: string | null
          terminal?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string
          expires_at: string
          key: string
          request_fingerprint: string
          response: Json | null
          scope: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          key: string
          request_fingerprint: string
          response?: Json | null
          scope: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          key?: string
          request_fingerprint?: string
          response?: Json | null
          scope?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          invited_by: string | null
          phone: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["fly_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at: string
          id?: string
          invited_by?: string | null
          phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["fly_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          invited_by?: string | null
          phone?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["fly_role"]
          token_hash?: string
        }
        Relationships: []
      }
      itinerary_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          destination_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_templates_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_categories: {
        Row: {
          description: string
          is_critical: boolean
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          description: string
          is_critical?: boolean
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          description?: string
          is_critical?: boolean
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category_key: string
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          category_key: string
          is_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          category_key?: string
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          category_key: string
          created_at: string
          dedupe_key: string | null
          deep_link: string | null
          expires_at: string | null
          id: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category_key: string
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category_key?: string
          created_at?: string
          dedupe_key?: string | null
          deep_link?: string | null
          expires_at?: string | null
          id?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "notification_categories"
            referencedColumns: ["key"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          currency: string
          id: string
          line_total_cents: number
          order_id: string
          people: number
          slot_id: string | null
          starts_at: string | null
          timezone: string | null
          tour_id: string | null
          tour_title: string
          unit_price_cents: number
          variant_id: string | null
          variant_label: string
        }
        Insert: {
          created_at?: string
          currency: string
          id?: string
          line_total_cents: number
          order_id: string
          people: number
          slot_id?: string | null
          starts_at?: string | null
          timezone?: string | null
          tour_id?: string | null
          tour_title: string
          unit_price_cents: number
          variant_id?: string | null
          variant_label: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          line_total_cents?: number
          order_id?: string
          people?: number
          slot_id?: string | null
          starts_at?: string | null
          timezone?: string | null
          tour_id?: string | null
          tour_title?: string
          unit_price_cents?: number
          variant_id?: string | null
          variant_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "tour_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "tour_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_participants: {
        Row: {
          full_name: string
          id: string
          notes: string | null
          order_item_id: string
          user_id: string | null
        }
        Insert: {
          full_name: string
          id?: string
          notes?: string | null
          order_item_id: string
          user_id?: string | null
        }
        Update: {
          full_name?: string
          id?: string
          notes?: string | null
          order_item_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_participants_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancellation_policy_id: string | null
          cancellation_policy_label: string | null
          cancellation_policy_rules: Json | null
          cancellation_policy_text: string | null
          cancellation_policy_version: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          confirmed_at: string | null
          coupon_code: string | null
          created_at: string
          currency: string
          discount_cents: number
          id: string
          placed_at: string
          reference: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_policy_id?: string | null
          cancellation_policy_label?: string | null
          cancellation_policy_rules?: Json | null
          cancellation_policy_text?: string | null
          cancellation_policy_version?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency: string
          discount_cents?: number
          id?: string
          placed_at?: string
          reference: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_policy_id?: string | null
          cancellation_policy_label?: string | null
          cancellation_policy_rules?: Json | null
          cancellation_policy_text?: string | null
          cancellation_policy_version?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          confirmed_at?: string | null
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          id?: string
          placed_at?: string
          reference?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_coupon_code_fkey"
            columns: ["coupon_code"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      passports: {
        Row: {
          birth_date: string | null
          created_at: string
          expires_on: string
          full_name: string
          id: string
          issued_on: string | null
          issuing_country: string
          nationality: string | null
          number: string
          updated_at: string
          user_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          expires_on: string
          full_name: string
          id?: string
          issued_on?: string | null
          issuing_country: string
          nationality?: string | null
          number: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          expires_on?: string
          full_name?: string
          id?: string
          issued_on?: string | null
          issuing_country?: string
          nationality?: string | null
          number?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          event_type: string
          id: number
          payload: Json
          payment_id: string | null
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          signature_valid: boolean
          skipped_reason: string | null
        }
        Insert: {
          event_type: string
          id?: never
          payload: Json
          payment_id?: string | null
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          signature_valid: boolean
          skipped_reason?: string | null
        }
        Update: {
          event_type?: string
          id?: never
          payload?: Json
          payment_id?: string | null
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          signature_valid?: boolean
          skipped_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          card_brand: string | null
          card_last4: string | null
          created_at: string
          currency: string
          id: string
          order_id: string
          provider: string
          provider_ref: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency: string
          id?: string
          order_id: string
          provider: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          provider?: string
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      points_ledger: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          expires_on: string | null
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["points_entry_kind"]
          occurred_at: string
          reason: string | null
          reference: string | null
          reverses_id: string | null
          rule_version: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["points_entry_kind"]
          occurred_at?: string
          reason?: string | null
          reference?: string | null
          reverses_id?: string | null
          rule_version?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          expires_on?: string | null
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["points_entry_kind"]
          occurred_at?: string
          reason?: string | null
          reference?: string | null
          reverses_id?: string | null
          rule_version?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "points_ledger_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "points_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      preference_items: {
        Row: {
          id: string
          is_sensitive: boolean
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          is_sensitive?: boolean
          key: string
          updated_at?: string
          user_id: string
          value: Json
        }
        Update: {
          id?: string
          is_sensitive?: boolean
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          is_minor: boolean
          locale: string
          onboarding_completed_at: string | null
          onboarding_step: string
          phone: string | null
          preferred_name: string | null
          public_id: string
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id: string
          is_minor?: boolean
          locale?: string
          onboarding_completed_at?: string | null
          onboarding_step?: string
          phone?: string | null
          preferred_name?: string | null
          public_id?: string
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          birth_date?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string | null
          id?: string
          is_minor?: boolean
          locale?: string
          onboarding_completed_at?: string | null
          onboarding_step?: string
          phone?: string | null
          preferred_name?: string | null
          public_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      proposal_requests: {
        Row: {
          created_at: string
          desired_date: string | null
          id: string
          message: string | null
          people: number | null
          quoted_at: string | null
          quoted_by: string | null
          quoted_currency: string | null
          quoted_notes: string | null
          quoted_price_cents: number | null
          status: Database["public"]["Enums"]["proposal_status"]
          tour_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          desired_date?: string | null
          id?: string
          message?: string | null
          people?: number | null
          quoted_at?: string | null
          quoted_by?: string | null
          quoted_currency?: string | null
          quoted_notes?: string | null
          quoted_price_cents?: number | null
          status?: Database["public"]["Enums"]["proposal_status"]
          tour_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          desired_date?: string | null
          id?: string
          message?: string | null
          people?: number | null
          quoted_at?: string | null
          quoted_by?: string | null
          quoted_currency?: string | null
          quoted_notes?: string | null
          quoted_price_cents?: number | null
          status?: Database["public"]["Enums"]["proposal_status"]
          tour_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_requests_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_id: string
          id: string
          revoked_at: string | null
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          revoked_at?: string | null
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          revoked_at?: string | null
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          id: number
          note: string | null
          result: Database["public"]["Enums"]["qr_scan_result"]
          scanned_at: string
          scanned_by: string | null
          token_id: string | null
        }
        Insert: {
          id?: never
          note?: string | null
          result: Database["public"]["Enums"]["qr_scan_result"]
          scanned_at?: string
          scanned_by?: string | null
          token_id?: string | null
        }
        Update: {
          id?: never
          note?: string | null
          result?: Database["public"]["Enums"]["qr_scan_result"]
          scanned_at?: string
          scanned_by?: string | null
          token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "qr_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_tokens: {
        Row: {
          activity_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          kind: Database["public"]["Enums"]["qr_kind"]
          max_uses: number | null
          revoked_at: string | null
          revoked_by: string | null
          scope: string | null
          token: string
          trip_id: string | null
          user_id: string | null
          uses: number
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          kind: Database["public"]["Enums"]["qr_kind"]
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string | null
          token: string
          trip_id?: string | null
          user_id?: string | null
          uses?: number
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          kind?: Database["public"]["Enums"]["qr_kind"]
          max_uses?: number | null
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string | null
          token?: string
          trip_id?: string | null
          user_id?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "qr_tokens_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_tokens_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_periods: {
        Row: {
          basis: Database["public"]["Enums"]["ranking_basis"]
          computed_at: string | null
          created_at: string
          criteria_note: string | null
          dimension: string
          ends_on: string
          finalists_published_at: string | null
          id: string
          is_published: boolean
          key: string
          label: string
          starts_on: string
        }
        Insert: {
          basis?: Database["public"]["Enums"]["ranking_basis"]
          computed_at?: string | null
          created_at?: string
          criteria_note?: string | null
          dimension: string
          ends_on: string
          finalists_published_at?: string | null
          id?: string
          is_published?: boolean
          key: string
          label: string
          starts_on: string
        }
        Update: {
          basis?: Database["public"]["Enums"]["ranking_basis"]
          computed_at?: string | null
          created_at?: string
          criteria_note?: string | null
          dimension?: string
          ends_on?: string
          finalists_published_at?: string | null
          id?: string
          is_published?: boolean
          key?: string
          label?: string
          starts_on?: string
        }
        Relationships: []
      }
      ranking_prizes: {
        Row: {
          benefit_id: string | null
          created_at: string
          description: string | null
          id: string
          label: string
          period_id: string
          position_from: number
          position_to: number
          sort_order: number
        }
        Insert: {
          benefit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          label: string
          period_id: string
          position_from: number
          position_to: number
          sort_order?: number
        }
        Update: {
          benefit_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          period_id?: string
          position_from?: number
          position_to?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "ranking_prizes_benefit_id_fkey"
            columns: ["benefit_id"]
            isOneToOne: false
            referencedRelation: "benefits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranking_prizes_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "ranking_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_scores: {
        Row: {
          computed_at: string
          period_id: string
          position: number
          public_name: string | null
          public_score: number
          user_id: string
        }
        Insert: {
          computed_at?: string
          period_id: string
          position: number
          public_name?: string | null
          public_score: number
          user_id: string
        }
        Update: {
          computed_at?: string
          period_id?: string
          position?: number
          public_name?: string | null
          public_score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_scores_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "ranking_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      ready_check_responses: {
        Row: {
          note: string | null
          ready_check_id: string
          responded_at: string
          state: Database["public"]["Enums"]["ready_state"]
          user_id: string
        }
        Insert: {
          note?: string | null
          ready_check_id: string
          responded_at?: string
          state: Database["public"]["Enums"]["ready_state"]
          user_id: string
        }
        Update: {
          note?: string | null
          ready_check_id?: string
          responded_at?: string
          state?: Database["public"]["Enums"]["ready_state"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ready_check_responses_ready_check_id_fkey"
            columns: ["ready_check_id"]
            isOneToOne: false
            referencedRelation: "ready_checks"
            referencedColumns: ["id"]
          },
        ]
      }
      ready_checks: {
        Row: {
          activity_id: string
          closed_at: string | null
          closes_at: string | null
          id: string
          opened_at: string
          opened_by: string | null
        }
        Insert: {
          activity_id: string
          closed_at?: string | null
          closes_at?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
        }
        Update: {
          activity_id?: string
          closed_at?: string | null
          closes_at?: string | null
          id?: string
          opened_at?: string
          opened_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ready_checks_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_cents: number | null
          created_at: string
          currency: string | null
          duplicate_of: string | null
          id: string
          issued_on: string | null
          merchant: string | null
          mime_type: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number | null
          status: Database["public"]["Enums"]["receipt_status"]
          storage_path: string
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          duplicate_of?: string | null
          id?: string
          issued_on?: string | null
          merchant?: string | null
          mime_type?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["receipt_status"]
          storage_path: string
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          currency?: string | null
          duplicate_of?: string | null
          id?: string
          issued_on?: string | null
          merchant?: string | null
          mime_type?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number | null
          status?: Database["public"]["Enums"]["receipt_status"]
          storage_path?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          order_id: string
          payment_id: string | null
          provider_ref: string | null
          reason: string
          requested_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency: string
          id?: string
          order_id: string
          payment_id?: string | null
          provider_ref?: string | null
          reason: string
          requested_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          order_id?: string
          payment_id?: string | null
          provider_ref?: string | null
          reason?: string
          requested_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["fly_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          role: Database["public"]["Enums"]["fly_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["fly_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_assignments_trip_fk"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      template_activities: {
        Row: {
          day_number: number
          description: string | null
          dress_code: string | null
          ends_at_time: string | null
          id: string
          meeting_point: string | null
          sort_order: number
          starts_at_time: string | null
          template_id: string
          title: string
          what_to_bring: string | null
        }
        Insert: {
          day_number: number
          description?: string | null
          dress_code?: string | null
          ends_at_time?: string | null
          id?: string
          meeting_point?: string | null
          sort_order?: number
          starts_at_time?: string | null
          template_id: string
          title: string
          what_to_bring?: string | null
        }
        Update: {
          day_number?: number
          description?: string | null
          dress_code?: string | null
          ends_at_time?: string | null
          id?: string
          meeting_point?: string | null
          sort_order?: number
          starts_at_time?: string | null
          template_id?: string
          title?: string
          what_to_bring?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_activities_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "itinerary_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_categories: {
        Row: {
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      tour_favorites: {
        Row: {
          created_at: string
          tour_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tour_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tour_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_favorites_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_media: {
        Row: {
          alt_text: string | null
          id: string
          kind: string
          sort_order: number
          storage_path: string
          tour_id: string
        }
        Insert: {
          alt_text?: string | null
          id?: string
          kind?: string
          sort_order?: number
          storage_path: string
          tour_id: string
        }
        Update: {
          alt_text?: string | null
          id?: string
          kind?: string
          sort_order?: number
          storage_path?: string
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_media_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_section_items: {
        Row: {
          section_key: string
          sort_order: number
          tour_id: string
        }
        Insert: {
          section_key: string
          sort_order?: number
          tour_id: string
        }
        Update: {
          section_key?: string
          sort_order?: number
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_section_items_section_key_fkey"
            columns: ["section_key"]
            isOneToOne: false
            referencedRelation: "tour_sections"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tour_section_items_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_sections: {
        Row: {
          badge: Database["public"]["Enums"]["tour_badge"] | null
          created_at: string
          is_published: boolean
          key: string
          label: string
          max_items: number
          sort_order: number
          source: Database["public"]["Enums"]["tour_section_source"]
          subtitle: string | null
          updated_at: string
        }
        Insert: {
          badge?: Database["public"]["Enums"]["tour_badge"] | null
          created_at?: string
          is_published?: boolean
          key: string
          label: string
          max_items?: number
          sort_order?: number
          source: Database["public"]["Enums"]["tour_section_source"]
          subtitle?: string | null
          updated_at?: string
        }
        Update: {
          badge?: Database["public"]["Enums"]["tour_badge"] | null
          created_at?: string
          is_published?: boolean
          key?: string
          label?: string
          max_items?: number
          sort_order?: number
          source?: Database["public"]["Enums"]["tour_section_source"]
          subtitle?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tour_slots: {
        Row: {
          capacity: number
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          sold: number
          starts_at: string
          timezone: string
          updated_at: string
          variant_id: string
        }
        Insert: {
          capacity: number
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          sold?: number
          starts_at: string
          timezone: string
          updated_at?: string
          variant_id: string
        }
        Update: {
          capacity?: number
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          sold?: number
          starts_at?: string
          timezone?: string
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_slots_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "tour_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_suppliers: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tour_variants: {
        Row: {
          covers_people: number
          created_at: string
          currency: string
          description: string | null
          id: string
          is_active: boolean
          label: string
          max_people: number | null
          min_people: number
          price_cents: number
          sort_order: number
          tour_id: string
          updated_at: string
        }
        Insert: {
          covers_people?: number
          created_at?: string
          currency: string
          description?: string | null
          id?: string
          is_active?: boolean
          label: string
          max_people?: number | null
          min_people?: number
          price_cents: number
          sort_order?: number
          tour_id: string
          updated_at?: string
        }
        Update: {
          covers_people?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_active?: boolean
          label?: string
          max_people?: number | null
          min_people?: number
          price_cents?: number
          sort_order?: number
          tour_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_variants_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          accessibility_notes: string | null
          audiences: Database["public"]["Enums"]["tour_audience"][]
          badge: Database["public"]["Enums"]["tour_badge"] | null
          cancellation_policy_id: string | null
          category_key: string
          city: string | null
          created_at: string
          description: string | null
          destination_id: string | null
          dress_code: string | null
          duration_minutes: number | null
          fly_note: string | null
          health_notes: string | null
          id: string
          included: string | null
          is_quote_only: boolean
          meeting_map_url: string | null
          meeting_point: string | null
          min_age: number | null
          not_included: string | null
          points_awarded: number | null
          safety_notes: string | null
          slug: string
          sort_order: number
          status: Database["public"]["Enums"]["tour_status"]
          summary: string | null
          supplier_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accessibility_notes?: string | null
          audiences?: Database["public"]["Enums"]["tour_audience"][]
          badge?: Database["public"]["Enums"]["tour_badge"] | null
          cancellation_policy_id?: string | null
          category_key: string
          city?: string | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          dress_code?: string | null
          duration_minutes?: number | null
          fly_note?: string | null
          health_notes?: string | null
          id?: string
          included?: string | null
          is_quote_only?: boolean
          meeting_map_url?: string | null
          meeting_point?: string | null
          min_age?: number | null
          not_included?: string | null
          points_awarded?: number | null
          safety_notes?: string | null
          slug: string
          sort_order?: number
          status?: Database["public"]["Enums"]["tour_status"]
          summary?: string | null
          supplier_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accessibility_notes?: string | null
          audiences?: Database["public"]["Enums"]["tour_audience"][]
          badge?: Database["public"]["Enums"]["tour_badge"] | null
          cancellation_policy_id?: string | null
          category_key?: string
          city?: string | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          dress_code?: string | null
          duration_minutes?: number | null
          fly_note?: string | null
          health_notes?: string | null
          id?: string
          included?: string | null
          is_quote_only?: boolean
          meeting_map_url?: string | null
          meeting_point?: string | null
          min_age?: number | null
          not_included?: string | null
          points_awarded?: number | null
          safety_notes?: string | null
          slug?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["tour_status"]
          summary?: string | null
          supplier_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tours_cancellation_policy_id_fkey"
            columns: ["cancellation_policy_id"]
            isOneToOne: false
            referencedRelation: "cancellation_policies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_category_key_fkey"
            columns: ["category_key"]
            isOneToOne: false
            referencedRelation: "tour_categories"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "tours_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tours_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "tour_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_passengers: {
        Row: {
          boarded_at: string | null
          created_at: string
          transfer_id: string
          user_id: string
        }
        Insert: {
          boarded_at?: string | null
          created_at?: string
          transfer_id: string
          user_id: string
        }
        Update: {
          boarded_at?: string | null
          created_at?: string
          transfer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_passengers_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      transfers: {
        Row: {
          created_at: string
          driver_name: string | null
          dropoff_point: string | null
          id: string
          pickup_at: string
          pickup_point: string
          status: Database["public"]["Enums"]["transfer_status"]
          title: string
          tracking_url: string | null
          trip_id: string
          updated_at: string
          vehicle_description: string | null
          vehicle_plate: string | null
        }
        Insert: {
          created_at?: string
          driver_name?: string | null
          dropoff_point?: string | null
          id?: string
          pickup_at: string
          pickup_point: string
          status?: Database["public"]["Enums"]["transfer_status"]
          title: string
          tracking_url?: string | null
          trip_id: string
          updated_at?: string
          vehicle_description?: string | null
          vehicle_plate?: string | null
        }
        Update: {
          created_at?: string
          driver_name?: string | null
          dropoff_point?: string | null
          id?: string
          pickup_at?: string
          pickup_point?: string
          status?: Database["public"]["Enums"]["transfer_status"]
          title?: string
          tracking_url?: string | null
          trip_id?: string
          updated_at?: string
          vehicle_description?: string | null
          vehicle_plate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          created_at: string
          day_date: string
          day_number: number
          id: string
          summary: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_date: string
          day_number: number
          id?: string
          summary?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_date?: string
          day_number?: number
          id?: string
          summary?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_inclusions: {
        Row: {
          category: Database["public"]["Enums"]["inclusion_category"]
          created_at: string
          details: string | null
          id: string
          is_optional: boolean
          rules: string | null
          sort_order: number
          status: Database["public"]["Enums"]["inclusion_status"]
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inclusion_category"]
          created_at?: string
          details?: string | null
          id?: string
          is_optional?: boolean
          rules?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["inclusion_status"]
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inclusion_category"]
          created_at?: string
          details?: string | null
          id?: string
          is_optional?: boolean
          rules?: string | null
          sort_order?: number
          status?: Database["public"]["Enums"]["inclusion_status"]
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_inclusions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          joined_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          destination_id: string
          ends_on: string
          id: string
          name: string
          starts_on: string
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_id: string
          ends_on: string
          id?: string
          name: string
          starts_on: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_id?: string
          ends_on?: string
          id?: string
          name?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["fly_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["fly_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["fly_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_entries: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["wallet_entry_kind"]
          occurred_at: string
          reason: string | null
          reference: string | null
          reverses_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency: string
          id?: string
          idempotency_key: string
          kind: Database["public"]["Enums"]["wallet_entry_kind"]
          occurred_at?: string
          reason?: string | null
          reference?: string | null
          reverses_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          idempotency_key?: string
          kind?: Database["public"]["Enums"]["wallet_entry_kind"]
          occurred_at?: string
          reason?: string | null
          reference?: string | null
          reverses_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_entries_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "wallet_entries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_consents: {
        Row: {
          granted: boolean | null
          purpose_key: string | null
          recorded_at: string | null
          user_id: string | null
          version: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_purpose_key_fkey"
            columns: ["purpose_key"]
            isOneToOne: false
            referencedRelation: "consent_purposes"
            referencedColumns: ["key"]
          },
        ]
      }
      points_balance: {
        Row: {
          balance: number | null
          earned: number | null
          last_entry_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
      wallet_balance: {
        Row: {
          balance_cents: number | null
          currency: string | null
          last_entry_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      abrir_documento: {
        Args: { p_id: string }
        Returns: {
          kind: Database["public"]["Enums"]["document_kind"]
          permitido: boolean
          requires_biometric: boolean
          storage_path: string
        }[]
      }
      advance_onboarding: {
        Args: { p_to: string }
        Returns: {
          avatar_path: string | null
          birth_date: string | null
          created_at: string
          deleted_at: string | null
          display_name: string | null
          id: string
          is_minor: boolean
          locale: string
          onboarding_completed_at: string | null
          onboarding_step: string
          phone: string | null
          preferred_name: string | null
          public_id: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aplicar_template: {
        Args: { p_template: string; p_trip: string }
        Returns: number
      }
      cancelar_pedido: {
        Args: { p_order: string; p_reason?: string }
        Returns: {
          motivo: string
          ok: boolean
          politica: string
        }[]
      }
      conferir_passaporte: {
        Args: { p_confere?: boolean; p_id: string }
        Returns: undefined
      }
      create_invitation: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["fly_role"]
          p_valid_days?: number
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      criar_pedido: {
        Args: { p_coupon?: string; p_idempotency_key: string; p_trip?: string }
        Returns: {
          currency: unknown
          motivo: string
          ok: boolean
          order_id: string
          reference: string
          total_cents: number
        }[]
      }
      definir_participantes: {
        Args: { p_nomes: string[]; p_order_item: string }
        Returns: {
          gravados: number
          motivo: string
          ok: boolean
        }[]
      }
      emitir_qr: {
        Args: {
          p_activity?: string
          p_kind: Database["public"]["Enums"]["qr_kind"]
          p_max_uses?: number
          p_scope?: string
          p_trip?: string
          p_valid_minutes?: number
        }
        Returns: {
          expires_at: string
          token: string
        }[]
      }
      home_events: {
        Args: { p_limit?: number }
        Returns: {
          category_key: string
          city: string | null
          country: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          ends_at: string | null
          fly_benefit: string | null
          home_order: number | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          summary: string | null
          timezone: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      home_state: {
        Args: never
        Returns: {
          day_number: number
          days_since: number
          days_until: number
          destination_name: string
          destination_timezone: string
          ends_on: string
          starts_on: string
          state: string
          total_days: number
          trip_id: string
          trip_name: string
        }[]
      }
      incluir_pedido_na_viagem: {
        Args: { p_order: string; p_trip?: string }
        Returns: {
          motivo: string
          ok: boolean
        }[]
      }
      iniciar_pagamento: {
        Args: { p_order: string; p_provider: string; p_provider_ref: string }
        Returns: {
          motivo: string
          ok: boolean
          payment_id: string
        }[]
      }
      ler_qr: {
        Args: {
          p_expected_kind?: Database["public"]["Enums"]["qr_kind"]
          p_note?: string
          p_token: string
        }
        Returns: {
          atividade: string
          kind: Database["public"]["Enums"]["qr_kind"]
          limite: number
          pessoa: string
          resultado: Database["public"]["Enums"]["qr_scan_result"]
          usos: number
        }[]
      }
      passaporte_para_viagem: {
        Args: { p_trip: string }
        Returns: {
          dias_de_folga: number
          expires_on: string
          full_name: string
          id: string
          issuing_country: string
          number: string
          vence_antes_do_fim: boolean
          verified_at: string
        }[]
      }
      publicar_finalistas: {
        Args: { p_period: string }
        Returns: {
          finalistas: number
          motivo: string
          ok: boolean
        }[]
      }
      recalcular_ranking: {
        Args: { p_period: string }
        Returns: {
          motivo: string
          ok: boolean
          participantes: number
        }[]
      }
      reembolsar_pedido: {
        Args: { p_amount_cents: number; p_order: string; p_reason: string }
        Returns: {
          motivo: string
          ok: boolean
          status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      registrar_evento_pagamento: {
        Args: {
          p_event_id: string
          p_event_type: string
          p_payload: Json
          p_provider: string
          p_signature_valid: boolean
        }
        Returns: {
          order_id: string
          order_status: Database["public"]["Enums"]["order_status"]
          resultado: string
        }[]
      }
      reservar_no_carrinho: {
        Args: { p_people: number; p_slot: string }
        Returns: {
          expira_em: string
          motivo: string
          ok: boolean
          vagas: number
        }[]
      }
      resgatar_beneficio: {
        Args: { p_benefit: string }
        Returns: {
          codigo: string
          motivo: string
          ok: boolean
          saldo_final: number
        }[]
      }
      revogar_qr: { Args: { p_id: string }; Returns: undefined }
      revoke_invitation: { Args: { p_id: string }; Returns: undefined }
      unaccent_imutavel: { Args: { p: string }; Returns: string }
      vagas_livres: {
        Args: { p_ignorar_carrinho?: string; p_slot: string }
        Returns: number
      }
      vencer_pontos: {
        Args: { p_ate?: string }
        Returns: {
          lotes: number
          ok: boolean
          pontos: number
        }[]
      }
      ver_passaporte: {
        Args: { p_id: string }
        Returns: {
          birth_date: string
          expires_on: string
          full_name: string
          id: string
          issued_on: string
          issuing_country: string
          nationality: string
          number: string
          permitido: boolean
          user_id: string
          verified_at: string
        }[]
      }
      viagem_atual: {
        Args: never
        Returns: {
          agora_comeca: string
          agora_id: string
          agora_titulo: string
          alteracoes_sem_confirmacao: number
          day_number: number
          destination_name: string
          ends_on: string
          proximo_comeca: string
          proximo_id: string
          proximo_ponto: string
          proximo_saida: string
          proximo_titulo: string
          starts_on: string
          timezone: string
          total_days: number
          trip_id: string
          trip_name: string
        }[]
      }
      vitrine_de_passeios: {
        Args: never
        Returns: {
          section_key: string
          section_label: string
          section_sort: number
          section_subtitle: string
          tour_id: string
          tour_sort: number
        }[]
      }
    }
    Enums: {
      activity_status:
        | "scheduled"
        | "confirmed"
        | "in_progress"
        | "done"
        | "changed"
        | "cancelled"
      companionship_kind: "family_lead" | "companion" | "guardian"
      document_kind:
        | "passport"
        | "ticket"
        | "hotel_reservation"
        | "insurance"
        | "voucher"
        | "authorization"
        | "other"
      event_cta_kind:
        | "view_event"
        | "buy_ticket"
        | "join_list"
        | "watch"
        | "view_results"
        | "open_fly_cup"
        | "want_dubai"
      event_status: "announced" | "registration_open" | "happening" | "finished"
      fly_package: "standard" | "black" | "billionaire"
      fly_role:
        | "customer"
        | "family_lead"
        | "creator"
        | "guide"
        | "base"
        | "media"
        | "experience"
        | "support"
        | "finance"
        | "trip_manager"
        | "admin"
      inclusion_category:
        | "air"
        | "lodging"
        | "food"
        | "transport"
        | "tours"
        | "insurance"
        | "benefits"
        | "press_kit"
        | "special"
      inclusion_status: "included" | "optional" | "purchased" | "unavailable"
      order_status:
        | "pending_payment"
        | "paid"
        | "confirmed"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
        | "failed"
      payment_status:
        | "created"
        | "authorized"
        | "captured"
        | "failed"
        | "cancelled"
        | "refunded"
      points_entry_kind: "earn" | "redeem" | "expire" | "adjust" | "reverse"
      proposal_status:
        | "requested"
        | "in_review"
        | "quoted"
        | "accepted"
        | "declined"
        | "expired"
      qr_kind:
        | "fly_id"
        | "activity_checkin"
        | "ticket"
        | "benefit"
        | "wristband"
        | "album"
        | "city_point"
        | "press_kit"
        | "manual_fallback"
      qr_scan_result:
        | "ok"
        | "expired"
        | "revoked"
        | "already_used"
        | "wrong_scope"
        | "unknown"
      ranking_basis: "manual" | "points_earned"
      ready_state: "ready" | "late" | "lost" | "needs_help"
      receipt_status:
        | "received"
        | "in_review"
        | "approved"
        | "rejected"
        | "duplicate"
      tour_audience:
        | "family"
        | "couple"
        | "adventure"
        | "luxury"
        | "business"
        | "creator"
      tour_badge: "included" | "addon" | "exclusive" | "trending"
      tour_section_source: "selo" | "curada" | "destino_da_viagem"
      tour_status: "draft" | "published" | "paused" | "archived"
      transfer_status:
        | "scheduled"
        | "driver_assigned"
        | "en_route"
        | "arrived"
        | "boarded"
        | "completed"
        | "cancelled"
      trip_status: "draft" | "published" | "ongoing" | "finished" | "cancelled"
      wallet_entry_kind:
        | "credit"
        | "topup"
        | "debit"
        | "refund"
        | "adjust"
        | "reverse"
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
      activity_status: [
        "scheduled",
        "confirmed",
        "in_progress",
        "done",
        "changed",
        "cancelled",
      ],
      companionship_kind: ["family_lead", "companion", "guardian"],
      document_kind: [
        "passport",
        "ticket",
        "hotel_reservation",
        "insurance",
        "voucher",
        "authorization",
        "other",
      ],
      event_cta_kind: [
        "view_event",
        "buy_ticket",
        "join_list",
        "watch",
        "view_results",
        "open_fly_cup",
        "want_dubai",
      ],
      event_status: ["announced", "registration_open", "happening", "finished"],
      fly_package: ["standard", "black", "billionaire"],
      fly_role: [
        "customer",
        "family_lead",
        "creator",
        "guide",
        "base",
        "media",
        "experience",
        "support",
        "finance",
        "trip_manager",
        "admin",
      ],
      inclusion_category: [
        "air",
        "lodging",
        "food",
        "transport",
        "tours",
        "insurance",
        "benefits",
        "press_kit",
        "special",
      ],
      inclusion_status: ["included", "optional", "purchased", "unavailable"],
      order_status: [
        "pending_payment",
        "paid",
        "confirmed",
        "cancelled",
        "refunded",
        "partially_refunded",
        "failed",
      ],
      payment_status: [
        "created",
        "authorized",
        "captured",
        "failed",
        "cancelled",
        "refunded",
      ],
      points_entry_kind: ["earn", "redeem", "expire", "adjust", "reverse"],
      proposal_status: [
        "requested",
        "in_review",
        "quoted",
        "accepted",
        "declined",
        "expired",
      ],
      qr_kind: [
        "fly_id",
        "activity_checkin",
        "ticket",
        "benefit",
        "wristband",
        "album",
        "city_point",
        "press_kit",
        "manual_fallback",
      ],
      qr_scan_result: [
        "ok",
        "expired",
        "revoked",
        "already_used",
        "wrong_scope",
        "unknown",
      ],
      ranking_basis: ["manual", "points_earned"],
      ready_state: ["ready", "late", "lost", "needs_help"],
      receipt_status: [
        "received",
        "in_review",
        "approved",
        "rejected",
        "duplicate",
      ],
      tour_audience: [
        "family",
        "couple",
        "adventure",
        "luxury",
        "business",
        "creator",
      ],
      tour_badge: ["included", "addon", "exclusive", "trending"],
      tour_section_source: ["selo", "curada", "destino_da_viagem"],
      tour_status: ["draft", "published", "paused", "archived"],
      transfer_status: [
        "scheduled",
        "driver_assigned",
        "en_route",
        "arrived",
        "boarded",
        "completed",
        "cancelled",
      ],
      trip_status: ["draft", "published", "ongoing", "finished", "cancelled"],
      wallet_entry_kind: [
        "credit",
        "topup",
        "debit",
        "refund",
        "adjust",
        "reverse",
      ],
    },
  },
} as const
