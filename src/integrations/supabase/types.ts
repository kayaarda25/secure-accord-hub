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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          table_name: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          table_name?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_jobs: {
        Row: {
          backup_type: string
          completed_at: string | null
          created_at: string
          documents_count: number | null
          error_message: string | null
          file_path: string | null
          file_size: number | null
          id: string
          started_at: string | null
          status: string
          tables_count: number | null
          user_id: string
        }
        Insert: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          documents_count?: number | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          started_at?: string | null
          status?: string
          tables_count?: number | null
          user_id: string
        }
        Update: {
          backup_type?: string
          completed_at?: string | null
          created_at?: string
          documents_count?: number | null
          error_message?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          started_at?: string | null
          status?: string
          tables_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      backup_schedules: {
        Row: {
          created_at: string
          day_of_month: number | null
          day_of_week: number | null
          frequency: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          time_of_day: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          time_of_day?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_month?: number | null
          day_of_week?: number | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          time_of_day?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bexio_tokens: {
        Row: {
          access_token: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          organization_id: string
          refresh_token: string
          scope: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          organization_id: string
          refresh_token: string
          scope?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          organization_id?: string
          refresh_token?: string
          scope?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bexio_tokens_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alerts: {
        Row: {
          cost_center_id: string | null
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          threshold_percent: number | null
        }
        Insert: {
          cost_center_id?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          threshold_percent?: number | null
        }
        Update: {
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          threshold_percent?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_forecasts: {
        Row: {
          actual_amount: number | null
          budget_plan_id: string | null
          created_at: string | null
          created_by: string
          forecast_amount: number
          forecast_date: string
          id: string
          notes: string | null
          variance: number | null
        }
        Insert: {
          actual_amount?: number | null
          budget_plan_id?: string | null
          created_at?: string | null
          created_by: string
          forecast_amount: number
          forecast_date: string
          id?: string
          notes?: string | null
          variance?: number | null
        }
        Update: {
          actual_amount?: number | null
          budget_plan_id?: string | null
          created_at?: string | null
          created_by?: string
          forecast_amount?: number
          forecast_date?: string
          id?: string
          notes?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_forecasts_budget_plan_id_fkey"
            columns: ["budget_plan_id"]
            isOneToOne: false
            referencedRelation: "budget_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_plans: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cost_center_id: string | null
          created_at: string | null
          created_by: string
          fiscal_year: number
          id: string
          notes: string | null
          organization_id: string | null
          planned_amount: number
          q1_amount: number | null
          q2_amount: number | null
          q3_amount: number | null
          q4_amount: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by: string
          fiscal_year: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_amount?: number
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cost_center_id?: string | null
          created_at?: string | null
          created_by?: string
          fiscal_year?: number
          id?: string
          notes?: string | null
          organization_id?: string | null
          planned_amount?: number
          q1_amount?: number | null
          q2_amount?: number | null
          q3_amount?: number | null
          q4_amount?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_plans_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_participants: {
        Row: {
          event_id: string
          id: string
          invited_at: string
          responded_at: string | null
          response_reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          event_id: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          response_reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          event_id?: string
          id?: string
          invited_at?: string
          responded_at?: string | null
          response_reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          is_recurring: boolean | null
          location: string | null
          parent_event_id: string | null
          priority: string
          recurrence_end_date: string | null
          recurrence_type: string | null
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          parent_event_id?: string | null
          priority?: string
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          start_time?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          is_recurring?: boolean | null
          location?: string | null
          parent_event_id?: string | null
          priority?: string
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      carrier_rates: {
        Row: {
          carrier_name: string
          country: string
          created_at: string
          created_by: string
          currency: string
          effective_from: string
          effective_until: string | null
          id: string
          inbound_rate: number
          is_active: boolean
          notes: string | null
          organization_id: string | null
          outbound_rate: number
          updated_at: string
        }
        Insert: {
          carrier_name: string
          country: string
          created_at?: string
          created_by: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          inbound_rate?: number
          is_active?: boolean
          notes?: string | null
          organization_id?: string | null
          outbound_rate?: number
          updated_at?: string
        }
        Update: {
          carrier_name?: string
          country?: string
          created_at?: string
          created_by?: string
          currency?: string
          effective_from?: string
          effective_until?: string | null
          id?: string
          inbound_rate?: number
          is_active?: boolean
          notes?: string | null
          organization_id?: string | null
          outbound_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carrier_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_documents: {
        Row: {
          document_name: string
          document_path: string
          id: string
          message_id: string | null
          protocol_id: string | null
          thread_id: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          document_name: string
          document_path: string
          id?: string
          message_id?: string | null
          protocol_id?: string | null
          thread_id?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          document_name?: string
          document_path?: string
          id?: string
          message_id?: string | null
          protocol_id?: string | null
          thread_id?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_documents_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "communication_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_documents_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "meeting_protocols"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_documents_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_messages: {
        Row: {
          content: string
          created_at: string
          encrypted_content: string | null
          id: string
          is_decision: boolean | null
          priority: Database["public"]["Enums"]["message_priority"] | null
          sender_id: string
          thread_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          encrypted_content?: string | null
          id?: string
          is_decision?: boolean | null
          priority?: Database["public"]["Enums"]["message_priority"] | null
          sender_id: string
          thread_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          encrypted_content?: string | null
          id?: string
          is_decision?: boolean | null
          priority?: Database["public"]["Enums"]["message_priority"] | null
          sender_id?: string
          thread_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      communication_threads: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_archived: boolean | null
          is_official: boolean | null
          organization_id: string | null
          subject: string | null
          type: Database["public"]["Enums"]["communication_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_archived?: boolean | null
          is_official?: boolean | null
          organization_id?: string | null
          subject?: string | null
          type: Database["public"]["Enums"]["communication_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_archived?: boolean | null
          is_official?: boolean | null
          organization_id?: string | null
          subject?: string | null
          type?: Database["public"]["Enums"]["communication_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "communication_threads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string | null
          created_by: string
          email: string | null
          id: string
          is_primary: boolean | null
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          position: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          email?: string | null
          id?: string
          is_primary?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          contract_number: string | null
          created_at: string | null
          created_by: string
          currency: string | null
          document_id: string | null
          end_date: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          contract_number?: string | null
          created_at?: string | null
          created_by: string
          currency?: string | null
          document_id?: string | null
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          contract_number?: string | null
          created_at?: string | null
          created_by?: string
          currency?: string | null
          document_id?: string | null
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          budget_annual: number | null
          budget_used: number | null
          code: string
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          budget_annual?: number | null
          budget_used?: number | null
          code: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          budget_annual?: number | null
          budget_used?: number | null
          code?: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creditor_invoice_approvals: {
        Row: {
          approval_type: string
          approver_id: string
          comment: string | null
          created_at: string
          id: string
          invoice_id: string
        }
        Insert: {
          approval_type: string
          approver_id: string
          comment?: string | null
          created_at?: string
          id?: string
          invoice_id: string
        }
        Update: {
          approval_type?: string
          approver_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creditor_invoice_approvals_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "creditor_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      creditor_invoices: {
        Row: {
          ai_confidence_score: number | null
          ai_extracted_data: Json | null
          amount: number
          bexio_creditor_id: string | null
          bexio_invoice_id: string | null
          bexio_synced_at: string | null
          cost_center_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          document_name: string | null
          document_path: string | null
          due_date: string | null
          extraction_status: string | null
          first_approved_at: string | null
          first_approver_comment: string | null
          first_approver_id: string | null
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          organization_id: string | null
          original_email_from: string | null
          original_email_subject: string | null
          paid_at: string | null
          payment_reference: string | null
          payment_status: string | null
          received_at: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          second_approved_at: string | null
          second_approver_comment: string | null
          second_approver_id: string | null
          status: string
          updated_at: string
          vat_amount: number | null
          vat_rate: number | null
          vendor_address: string | null
          vendor_iban: string | null
          vendor_name: string
          vendor_vat_number: string | null
        }
        Insert: {
          ai_confidence_score?: number | null
          ai_extracted_data?: Json | null
          amount: number
          bexio_creditor_id?: string | null
          bexio_invoice_id?: string | null
          bexio_synced_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          document_name?: string | null
          document_path?: string | null
          due_date?: string | null
          extraction_status?: string | null
          first_approved_at?: string | null
          first_approver_comment?: string | null
          first_approver_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string | null
          original_email_from?: string | null
          original_email_subject?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          received_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          second_approved_at?: string | null
          second_approver_comment?: string | null
          second_approver_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_address?: string | null
          vendor_iban?: string | null
          vendor_name: string
          vendor_vat_number?: string | null
        }
        Update: {
          ai_confidence_score?: number | null
          ai_extracted_data?: Json | null
          amount?: number
          bexio_creditor_id?: string | null
          bexio_invoice_id?: string | null
          bexio_synced_at?: string | null
          cost_center_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          document_name?: string | null
          document_path?: string | null
          due_date?: string | null
          extraction_status?: string | null
          first_approved_at?: string | null
          first_approver_comment?: string | null
          first_approver_id?: string | null
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          organization_id?: string | null
          original_email_from?: string | null
          original_email_subject?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          received_at?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          second_approved_at?: string | null
          second_approver_comment?: string | null
          second_approver_id?: string | null
          status?: string
          updated_at?: string
          vat_amount?: number | null
          vat_rate?: number | null
          vendor_address?: string | null
          vendor_iban?: string | null
          vendor_name?: string
          vendor_vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creditor_invoices_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creditor_invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      declarations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          country: string
          created_at: string
          declaration_number: string
          declaration_type: string
          finance_comment: string | null
          gia_incoming_cost: Json | null
          gia_outgoing_revenue: Json | null
          grx_fiscalization: number | null
          id: string
          margin_held: number | null
          margin_split_infosi: number | null
          margin_split_mgi: number | null
          mgi_incoming_revenue: Json | null
          mgi_outgoing_cost: Json | null
          network_management_system: number | null
          notes: string | null
          opex_gia: number | null
          opex_mgi: number | null
          period_end: string
          period_start: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: string
          submitted_at: string
          submitted_by: string
          supervisor_approved_at: string | null
          supervisor_comment: string | null
          supervisor_id: string | null
          total_gia_balance: number | null
          total_mgi_balance: number | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          country: string
          created_at?: string
          declaration_number: string
          declaration_type: string
          finance_comment?: string | null
          gia_incoming_cost?: Json | null
          gia_outgoing_revenue?: Json | null
          grx_fiscalization?: number | null
          id?: string
          margin_held?: number | null
          margin_split_infosi?: number | null
          margin_split_mgi?: number | null
          mgi_incoming_revenue?: Json | null
          mgi_outgoing_cost?: Json | null
          network_management_system?: number | null
          notes?: string | null
          opex_gia?: number | null
          opex_mgi?: number | null
          period_end: string
          period_start: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by: string
          supervisor_approved_at?: string | null
          supervisor_comment?: string | null
          supervisor_id?: string | null
          total_gia_balance?: number | null
          total_mgi_balance?: number | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          country?: string
          created_at?: string
          declaration_number?: string
          declaration_type?: string
          finance_comment?: string | null
          gia_incoming_cost?: Json | null
          gia_outgoing_revenue?: Json | null
          grx_fiscalization?: number | null
          id?: string
          margin_held?: number | null
          margin_split_infosi?: number | null
          margin_split_mgi?: number | null
          mgi_incoming_revenue?: Json | null
          mgi_outgoing_cost?: Json | null
          network_management_system?: number | null
          notes?: string | null
          opex_gia?: number | null
          opex_mgi?: number | null
          period_end?: string
          period_start?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string
          supervisor_approved_at?: string | null
          supervisor_comment?: string | null
          supervisor_id?: string | null
          total_gia_balance?: number | null
          total_mgi_balance?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      document_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          document_id: string
          id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          document_id: string
          id?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          document_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_activity_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_folders: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          icon: string | null
          id: string
          is_shared: boolean | null
          name: string
          organization_id: string | null
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          icon?: string | null
          id?: string
          is_shared?: boolean | null
          name: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          icon?: string | null
          id?: string
          is_shared?: boolean | null
          name?: string
          organization_id?: string | null
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      document_shares: {
        Row: {
          created_at: string | null
          document_id: string
          id: string
          shared_by: string
          shared_with_organization_id: string | null
          shared_with_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          document_id: string
          id?: string
          shared_by: string
          shared_with_organization_id?: string | null
          shared_with_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string
          id?: string
          shared_by?: string
          shared_with_organization_id?: string | null
          shared_with_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_shares_shared_with_organization_id_fkey"
            columns: ["shared_with_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_signatures: {
        Row: {
          created_at: string
          document_id: string
          id: string
          rejected_at: string | null
          rejection_reason: string | null
          requested_by: string
          signature_comment: string | null
          signature_image: string | null
          signature_position: string | null
          signed_at: string | null
          signer_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_by: string
          signature_comment?: string | null
          signature_image?: string | null
          signature_position?: string | null
          signed_at?: string | null
          signer_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          requested_by?: string
          signature_comment?: string | null
          signature_image?: string | null
          signature_position?: string | null
          signed_at?: string | null
          signer_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_signatures_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tag_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          document_id: string
          id: string
          tag_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          document_id: string
          id?: string
          tag_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          document_id?: string
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_tag_assignments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "document_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      document_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          category: string
          content: Json
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_global: boolean | null
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          content?: Json
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_global?: boolean | null
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_global?: boolean | null
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          file_path: string
          file_size: number | null
          folder_id: string | null
          id: string
          last_modified_by: string | null
          mime_type: string | null
          name: string
          organization_id: string | null
          shared_with_organizations: string[] | null
          type: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          file_path: string
          file_size?: number | null
          folder_id?: string | null
          id?: string
          last_modified_by?: string | null
          mime_type?: string | null
          name: string
          organization_id?: string | null
          shared_with_organizations?: string[] | null
          type?: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          file_path?: string
          file_size?: number | null
          folder_id?: string | null
          id?: string
          last_modified_by?: string | null
          mime_type?: string | null
          name?: string
          organization_id?: string | null
          shared_with_organizations?: string[] | null
          type?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      folder_shares: {
        Row: {
          created_at: string
          folder_id: string
          id: string
          shared_by: string
          shared_with_organization_id: string
        }
        Insert: {
          created_at?: string
          folder_id: string
          id?: string
          shared_by: string
          shared_with_organization_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string
          id?: string
          shared_by?: string
          shared_with_organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folder_shares_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "document_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folder_shares_shared_with_organization_id_fkey"
            columns: ["shared_with_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      letterhead_settings: {
        Row: {
          address: string | null
          company_name: string
          created_at: string
          footer_text: string | null
          id: string
          is_default: boolean | null
          layout_data: Json | null
          logo_url: string | null
          preset_name: string
          primary_color: string | null
          show_logo: boolean | null
          subtitle: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          created_at?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean | null
          layout_data?: Json | null
          logo_url?: string | null
          preset_name?: string
          primary_color?: string | null
          show_logo?: boolean | null
          subtitle?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string
          created_at?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean | null
          layout_data?: Json | null
          logo_url?: string | null
          preset_name?: string
          primary_color?: string | null
          show_logo?: boolean | null
          subtitle?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      meeting_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          room_code: string
          sender_id: string
          sender_name: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          room_code: string
          sender_id: string
          sender_name: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          room_code?: string
          sender_id?: string
          sender_name?: string
        }
        Relationships: []
      }
      meeting_participants: {
        Row: {
          email: string
          id: string
          invited_at: string
          meeting_id: string
          responded_at: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          meeting_id: string
          responded_at?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          meeting_id?: string
          responded_at?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_participants_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "scheduled_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_protocols: {
        Row: {
          action_items: Json | null
          agenda: string | null
          attendees: string[] | null
          created_at: string
          created_by: string
          decisions: string | null
          id: string
          location: string | null
          meeting_date: string
          minutes: string | null
          shared_with_organizations: string[] | null
          thread_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_items?: Json | null
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by: string
          decisions?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          minutes?: string | null
          shared_with_organizations?: string[] | null
          thread_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_items?: Json | null
          agenda?: string | null
          attendees?: string[] | null
          created_at?: string
          created_by?: string
          decisions?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          minutes?: string | null
          shared_with_organizations?: string[] | null
          thread_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_protocols_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_recordings: {
        Row: {
          duration_seconds: number | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          meeting_id: string | null
          protocol_id: string | null
          recorded_at: string
          recorded_by: string
          room_code: string
        }
        Insert: {
          duration_seconds?: number | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          protocol_id?: string | null
          recorded_at?: string
          recorded_by: string
          room_code: string
        }
        Update: {
          duration_seconds?: number | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          meeting_id?: string | null
          protocol_id?: string | null
          recorded_at?: string
          recorded_by?: string
          room_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_recordings_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "scheduled_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_recordings_protocol_id_fkey"
            columns: ["protocol_id"]
            isOneToOne: false
            referencedRelation: "meeting_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          approval_notifications: boolean | null
          budget_notifications: boolean | null
          calendar_notifications: boolean | null
          created_at: string | null
          document_notifications: boolean | null
          email_enabled: boolean | null
          expense_notifications: boolean | null
          id: string
          push_enabled: boolean | null
          task_notifications: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approval_notifications?: boolean | null
          budget_notifications?: boolean | null
          calendar_notifications?: boolean | null
          created_at?: string | null
          document_notifications?: boolean | null
          email_enabled?: boolean | null
          expense_notifications?: boolean | null
          id?: string
          push_enabled?: boolean | null
          task_notifications?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approval_notifications?: boolean | null
          budget_notifications?: boolean | null
          calendar_notifications?: boolean | null
          created_at?: string | null
          document_notifications?: boolean | null
          email_enabled?: boolean | null
          expense_notifications?: boolean | null
          id?: string
          push_enabled?: boolean | null
          task_notifications?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      opex_expense_notes: {
        Row: {
          content: string
          created_at: string
          expense_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          expense_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          expense_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opex_expense_notes_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "opex_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      opex_expenses: {
        Row: {
          amount: number
          category: string | null
          cost_center_id: string
          created_at: string
          currency: string
          description: string | null
          expense_date: string
          expense_number: string
          finance_approved_at: string | null
          finance_approver_id: string | null
          finance_comment: string | null
          id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          status: Database["public"]["Enums"]["approval_status"]
          submitted_at: string
          submitted_by: string
          supervisor_approved_at: string | null
          supervisor_comment: string | null
          supervisor_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          cost_center_id: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          expense_number: string
          finance_approved_at?: string | null
          finance_approver_id?: string | null
          finance_comment?: string | null
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitted_by: string
          supervisor_approved_at?: string | null
          supervisor_comment?: string | null
          supervisor_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          cost_center_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          expense_date?: string
          expense_number?: string
          finance_approved_at?: string | null
          finance_approver_id?: string | null
          finance_comment?: string | null
          id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["approval_status"]
          submitted_at?: string
          submitted_by?: string
          supervisor_approved_at?: string | null
          supervisor_comment?: string | null
          supervisor_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "opex_expenses_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
        ]
      }
      opex_receipts: {
        Row: {
          expense_id: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          uploaded_at: string
          uploaded_by: string
        }
        Insert: {
          expense_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by: string
        }
        Update: {
          expense_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          uploaded_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "opex_receipts_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "opex_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_permissions: {
        Row: {
          can_create_budget: boolean
          can_create_declarations: boolean
          can_create_invoices: boolean
          can_create_opex: boolean
          can_view_budget: boolean
          can_view_declarations: boolean
          can_view_invoices: boolean
          can_view_opex: boolean
          created_at: string | null
          id: string
          org_type: Database["public"]["Enums"]["organization_type"]
          updated_at: string | null
        }
        Insert: {
          can_create_budget?: boolean
          can_create_declarations?: boolean
          can_create_invoices?: boolean
          can_create_opex?: boolean
          can_view_budget?: boolean
          can_view_declarations?: boolean
          can_view_invoices?: boolean
          can_view_opex?: boolean
          created_at?: string | null
          id?: string
          org_type: Database["public"]["Enums"]["organization_type"]
          updated_at?: string | null
        }
        Update: {
          can_create_budget?: boolean
          can_create_declarations?: boolean
          can_create_invoices?: boolean
          can_create_opex?: boolean
          can_view_budget?: boolean
          can_view_declarations?: boolean
          can_view_invoices?: boolean
          can_view_opex?: boolean
          created_at?: string | null
          id?: string
          org_type?: Database["public"]["Enums"]["organization_type"]
          updated_at?: string | null
        }
        Relationships: []
      }
      organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          name: string
          org_type: Database["public"]["Enums"]["organization_type"] | null
          status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name: string
          org_type?: Database["public"]["Enums"]["organization_type"] | null
          status?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          org_type?: Database["public"]["Enums"]["organization_type"] | null
          status?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          email: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          organization_id: string | null
          phone: string | null
          position: string | null
          signature_data: string | null
          signature_initials: string | null
          signature_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          signature_data?: string | null
          signature_initials?: string | null
          signature_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          email?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          position?: string | null
          signature_data?: string | null
          signature_initials?: string | null
          signature_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          added_at: string
          id: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          project_id: string
          role?: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          priority: string
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          priority?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          priority?: string
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      receipt_upload_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          image_path: string | null
          session_code: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          image_path?: string | null
          session_code: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          image_path?: string | null
          session_code?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_addresses: {
        Row: {
          country: string | null
          created_at: string
          full_address: string
          id: string
          label: string
          name: string
          street: string | null
          updated_at: string
          user_id: string
          zip_city: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          full_address: string
          id?: string
          label: string
          name: string
          street?: string | null
          updated_at?: string
          user_id: string
          zip_city?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string
          full_address?: string
          id?: string
          label?: string
          name?: string
          street?: string | null
          updated_at?: string
          user_id?: string
          zip_city?: string | null
        }
        Relationships: []
      }
      scheduled_meetings: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          duration_minutes: number | null
          id: string
          organization_id: string | null
          room_code: string
          scheduled_date: string
          status: string | null
          title: string
          updated_at: string
          zoom_join_url: string | null
          zoom_meeting_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          room_code: string
          scheduled_date: string
          status?: string | null
          title: string
          updated_at?: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          organization_id?: string | null
          room_code?: string
          scheduled_date?: string
          status?: string | null
          title?: string
          updated_at?: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_meetings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_reports: {
        Row: {
          created_at: string | null
          created_by: string
          filters: Json | null
          format: string | null
          frequency: string
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          next_run_at: string | null
          recipients: string[]
          report_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          filters?: Json | null
          format?: string | null
          frequency: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          recipients: string[]
          report_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          filters?: Json | null
          format?: string | null
          frequency?: string
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          recipients?: string[]
          report_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      security_settings: {
        Row: {
          allowed_ips: string[] | null
          backup_codes: string[] | null
          id: string
          session_timeout_minutes: number | null
          two_factor_enabled: boolean | null
          two_factor_secret: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          allowed_ips?: string[] | null
          backup_codes?: string[] | null
          id?: string
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          allowed_ips?: string[] | null
          backup_codes?: string[] | null
          id?: string
          session_timeout_minutes?: number | null
          two_factor_enabled?: boolean | null
          two_factor_secret?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_insurance_records: {
        Row: {
          ahv_iv_eo_employee: number
          ahv_iv_eo_employer: number
          alv_employee: number
          alv_employer: number
          bvg_employee: number
          bvg_employer: number
          created_at: string
          created_by: string
          gross_salary: number
          id: string
          ktg: number
          month: number
          notes: string | null
          updated_at: string
          user_id: string
          uvg_bu: number
          uvg_nbu: number
          year: number
        }
        Insert: {
          ahv_iv_eo_employee?: number
          ahv_iv_eo_employer?: number
          alv_employee?: number
          alv_employer?: number
          bvg_employee?: number
          bvg_employer?: number
          created_at?: string
          created_by: string
          gross_salary?: number
          id?: string
          ktg?: number
          month: number
          notes?: string | null
          updated_at?: string
          user_id: string
          uvg_bu?: number
          uvg_nbu?: number
          year: number
        }
        Update: {
          ahv_iv_eo_employee?: number
          ahv_iv_eo_employer?: number
          alv_employee?: number
          alv_employer?: number
          bvg_employee?: number
          bvg_employer?: number
          created_at?: string
          created_by?: string
          gross_salary?: number
          id?: string
          ktg?: number
          month?: number
          notes?: string | null
          updated_at?: string
          user_id?: string
          uvg_bu?: number
          uvg_nbu?: number
          year?: number
        }
        Relationships: []
      }
      task_participants: {
        Row: {
          id: string
          invited_at: string
          responded_at: string | null
          status: string
          task_id: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
          task_id: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string
          responded_at?: string | null
          status?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_participants_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean | null
          parent_task_id: string | null
          priority: string
          project_id: string | null
          recurrence_end_date: string | null
          recurrence_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_task_id?: string | null
          priority?: string
          project_id?: string | null
          recurrence_end_date?: string | null
          recurrence_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      thread_participants: {
        Row: {
          added_at: string
          added_by: string
          id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          id?: string
          thread_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "thread_participants_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "communication_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string | null
          id: string
          layout: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          layout?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          layout?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          department: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string | null
          position: string | null
          roles: Database["public"]["Enums"]["app_role"][] | null
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          department?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id?: string | null
          position?: string | null
          roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          department?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string | null
          position?: string | null
          roles?: Database["public"]["Enums"]["app_role"][] | null
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_public_keys: {
        Row: {
          created_at: string
          id: string
          public_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          public_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          public_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          is_current: boolean | null
          last_active_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_current?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          is_current?: boolean | null
          last_active_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vacation_entitlements: {
        Row: {
          carried_over: number
          created_at: string
          id: string
          total_days: number
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          carried_over?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id: string
          year: number
        }
        Update: {
          carried_over?: number
          created_at?: string
          id?: string
          total_days?: number
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      vacation_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          days_count: number
          end_date: string
          id: string
          reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count: number
          end_date: string
          id?: string
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          days_count?: number
          end_date?: string
          id?: string
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_task: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_thread: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      can_perform_action: {
        Args: { _action: string; _user_id: string }
        Returns: boolean
      }
      get_login_attempts_for_admin: {
        Args: never
        Returns: {
          attempted_at: string
          email: string
          id: string
          ip_address: string
          success: boolean
          user_agent: string
        }[]
      }
      get_organization_users_for_sharing: {
        Args: { org_id: string }
        Returns: {
          email: string
          first_name: string
          last_name: string
          organization_id: string
          user_id: string
        }[]
      }
      get_user_meeting_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_org_type: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["organization_type"]
      }
      get_user_organization: { Args: { _user_id: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id: string }; Returns: string }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_calendar_event_creator: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_calendar_event_participant: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_login_blocked: {
        Args: {
          _email: string
          _ip_address?: string
          _lockout_minutes?: number
          _max_attempts?: number
        }
        Returns: boolean
      }
      is_meeting_creator: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_meeting_participant: {
        Args: { _meeting_id: string; _user_id: string }
        Returns: boolean
      }
      is_mgi_organization: { Args: { _org_id: string }; Returns: boolean }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_task_creator: {
        Args: { _task_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_creator: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      is_thread_participant: {
        Args: { _thread_id: string; _user_id: string }
        Returns: boolean
      }
      log_login_attempt: {
        Args: {
          _email: string
          _ip_address?: string
          _success?: boolean
          _user_agent?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "state" | "management" | "finance" | "partner" | "admin"
      approval_status:
        | "pending"
        | "approved_supervisor"
        | "approved_finance"
        | "rejected"
      communication_type: "partner" | "authority" | "internal" | "direct"
      document_status: "valid" | "expiring" | "expired" | "draft"
      message_priority: "normal" | "important" | "urgent"
      organization_type: "mgi_media" | "mgi_communications" | "gateway"
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
  public: {
    Enums: {
      app_role: ["state", "management", "finance", "partner", "admin"],
      approval_status: [
        "pending",
        "approved_supervisor",
        "approved_finance",
        "rejected",
      ],
      communication_type: ["partner", "authority", "internal", "direct"],
      document_status: ["valid", "expiring", "expired", "draft"],
      message_priority: ["normal", "important", "urgent"],
      organization_type: ["mgi_media", "mgi_communications", "gateway"],
    },
  },
} as const
