export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      members: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name: string
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          member_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          member_id: string
          token: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          member_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: true
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_updates: {
        Row: {
          content: string
          created_at: string | null
          id: string
          posted_by: string
          task_id: string | null
          team_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          posted_by: string
          task_id?: string | null
          team_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          posted_by?: string
          task_id?: string | null
          team_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_updates_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_updates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_assignees: {
        Row: {
          id: string
          task_id: string
          member_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          member_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          member_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_assignees_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_assignees_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      task_views: {
        Row: {
          id: string
          task_id: string
          member_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          task_id: string
          member_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          member_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_views_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_views_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      update_views: {
        Row: {
          id: string
          update_id: string
          member_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          update_id: string
          member_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          update_id?: string
          member_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_views_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "task_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "update_views_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_team_id: string
          claimed_by: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string
          deadline: string | null
          description: string | null
          id: string
          remarks: string | null
          status: string
          title: string
          confirmed: boolean
          started_by: string | null
        }
        Insert: {
          assigned_team_id: string
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          deadline?: string | null
          description?: string | null
          id?: string
          remarks?: string | null
          status?: string
          title: string
          confirmed?: boolean
          started_by?: string | null
        }
        Update: {
          assigned_team_id?: string
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          deadline?: string | null
          description?: string | null
          id?: string
          remarks?: string | null
          status?: string
          title?: string
          confirmed?: boolean
          started_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_team_id_fkey"
            columns: ["assigned_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          member_id: string
          team_id: string
        }
        Insert: {
          id?: string
          member_id: string
          team_id: string
        }
        Update: {
          id?: string
          member_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      team_requests: {
        Row: {
          id: string
          requested_by: string
          team_name: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          requested_by: string
          team_name: string
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          requested_by?: string
          team_name?: string
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      join_requests: {
        Row: {
          id: string
          user_id: string
          team_id: string
          status: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          status?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string
          status?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          id: string
          title: string
          content: string
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          content: string
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          content?: string
          created_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_views: {
        Row: {
          id: string
          notice_id: string
          member_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          notice_id: string
          member_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          notice_id?: string
          member_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_views_notice_id_fkey"
            columns: ["notice_id"]
            isOneToOne: false
            referencedRelation: "notices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notice_views_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
