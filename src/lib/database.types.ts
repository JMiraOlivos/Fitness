// Hand-authored from supabase/schema.sql and supabase/migrations/*.sql, in the
// shape produced by `supabase gen types typescript`. This environment's network
// policy blocks the Supabase Management API and raw Postgres connections, so this
// could not be generated directly against the live project. Regenerate for real
// with:
//   npx supabase gen types typescript --project-id joyvxekdpekoenkfifqr --schema public > src/lib/database.types.ts
// and diff against this file if the live schema has drifted.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          updated_at: string | null;
          full_name: string | null;
          preferred_unit: string | null;
          training_goal: string | null;
          injury_notes: string | null;
          equipment_available: string | null;
          experience_level: string | null;
          is_admin: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          updated_at?: string | null;
          full_name?: string | null;
          preferred_unit?: string | null;
          training_goal?: string | null;
          injury_notes?: string | null;
          equipment_available?: string | null;
          experience_level?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          updated_at?: string | null;
          full_name?: string | null;
          preferred_unit?: string | null;
          training_goal?: string | null;
          injury_notes?: string | null;
          equipment_available?: string | null;
          experience_level?: string | null;
          is_admin?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          target_muscle: string;
          equipment: string;
          owner_id: string | null;
          canonical_name: string | null;
          aliases: string[];
          movement_pattern: string | null;
          difficulty: string | null;
          is_verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          target_muscle: string;
          equipment: string;
          owner_id?: string | null;
          canonical_name?: string | null;
          aliases?: string[];
          movement_pattern?: string | null;
          difficulty?: string | null;
          is_verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          target_muscle?: string;
          equipment?: string;
          owner_id?: string | null;
          canonical_name?: string | null;
          aliases?: string[];
          movement_pattern?: string | null;
          difficulty?: string | null;
          is_verified?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      routines: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          program_id: string | null;
          week_number: number | null;
          day_of_week: number | null;
          is_deload_week: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          program_id?: string | null;
          week_number?: number | null;
          day_of_week?: number | null;
          is_deload_week?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          program_id?: string | null;
          week_number?: number | null;
          day_of_week?: number | null;
          is_deload_week?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routines_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routines_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "programs";
            referencedColumns: ["id"];
          },
        ];
      };
      programs: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          focus: string | null;
          duration_weeks: number;
          days_per_week: number;
          deload_every_n_weeks: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          focus?: string | null;
          duration_weeks: number;
          days_per_week: number;
          deload_every_n_weeks?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          focus?: string | null;
          duration_weeks?: number;
          days_per_week?: number;
          deload_every_n_weeks?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      routine_exercises: {
        Row: {
          id: string;
          routine_id: string;
          exercise_id: string;
          order_index: number;
          target_sets: number | null;
          target_reps: string | null;
          notes: string | null;
          rest_seconds: number | null;
          target_rpe: number | null;
          target_rir: number | null;
          tempo: string | null;
          movement_pattern: string | null;
          priority: string | null;
          progression_rule: string | null;
          substitution_criteria: string | null;
        };
        Insert: {
          id?: string;
          routine_id: string;
          exercise_id: string;
          order_index: number;
          target_sets?: number | null;
          target_reps?: string | null;
          notes?: string | null;
          rest_seconds?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          tempo?: string | null;
          movement_pattern?: string | null;
          priority?: string | null;
          progression_rule?: string | null;
          substitution_criteria?: string | null;
        };
        Update: {
          id?: string;
          routine_id?: string;
          exercise_id?: string;
          order_index?: number;
          target_sets?: number | null;
          target_reps?: string | null;
          notes?: string | null;
          rest_seconds?: number | null;
          target_rpe?: number | null;
          target_rir?: number | null;
          tempo?: string | null;
          movement_pattern?: string | null;
          priority?: string | null;
          progression_rule?: string | null;
          substitution_criteria?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "routine_exercises_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "routine_exercises_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      workout_logs: {
        Row: {
          id: string;
          user_id: string;
          routine_id: string | null;
          start_time: string;
          end_time: string | null;
          ai_insight: string | null;
          client_operation_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          routine_id?: string | null;
          start_time?: string;
          end_time?: string | null;
          ai_insight?: string | null;
          client_operation_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          routine_id?: string | null;
          start_time?: string;
          end_time?: string | null;
          ai_insight?: string | null;
          client_operation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workout_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "workout_logs_routine_id_fkey";
            columns: ["routine_id"];
            isOneToOne: false;
            referencedRelation: "routines";
            referencedColumns: ["id"];
          },
        ];
      };
      set_logs: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe: number | null;
          is_warmup: boolean;
          created_at: string;
          client_operation_id: string | null;
        };
        Insert: {
          id?: string;
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          weight: number;
          reps: number;
          rpe?: number | null;
          is_warmup?: boolean;
          created_at?: string;
          client_operation_id?: string | null;
        };
        Update: {
          id?: string;
          workout_log_id?: string;
          exercise_id?: string;
          set_number?: number;
          weight?: number;
          reps?: number;
          rpe?: number | null;
          is_warmup?: boolean;
          created_at?: string;
          client_operation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "set_logs_workout_log_id_fkey";
            columns: ["workout_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_logs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "set_logs_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
      body_measurements: {
        Row: {
          id: string;
          user_id: string;
          recorded_at: string;
          weight_kg: number;
          body_fat_percentage: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          recorded_at?: string;
          weight_kg: number;
          body_fat_percentage?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          recorded_at?: string;
          weight_kg?: number;
          body_fat_percentage?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "body_measurements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      readiness_logs: {
        Row: {
          id: string;
          user_id: string;
          workout_log_id: string | null;
          energy: number | null;
          sleep_quality: number | null;
          soreness: number | null;
          joint_pain: boolean;
          available_minutes: number | null;
          notes: string | null;
          created_at: string;
          client_operation_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_log_id?: string | null;
          energy?: number | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          joint_pain?: boolean;
          available_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          client_operation_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_log_id?: string | null;
          energy?: number | null;
          sleep_quality?: number | null;
          soreness?: number | null;
          joint_pain?: boolean;
          available_minutes?: number | null;
          notes?: string | null;
          created_at?: string;
          client_operation_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "readiness_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "readiness_logs_workout_log_id_fkey";
            columns: ["workout_log_id"];
            isOneToOne: false;
            referencedRelation: "workout_logs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_generations: {
        Row: {
          id: string;
          user_id: string | null;
          type: string;
          model: string;
          prompt_version: string;
          schema_version: string;
          input: Json | null;
          output: Json | null;
          latency_ms: number | null;
          success: boolean;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          type: string;
          model: string;
          prompt_version: string;
          schema_version: string;
          input?: Json | null;
          output?: Json | null;
          latency_ms?: number | null;
          success?: boolean;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          type?: string;
          model?: string;
          prompt_version?: string;
          schema_version?: string;
          input?: Json | null;
          output?: Json | null;
          latency_ms?: number | null;
          success?: boolean;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_generations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_exercise_preferences: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          is_favorite: boolean;
          is_avoided: boolean;
          times_used: number;
          last_used_at: string | null;
          created_at: string;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          is_favorite?: boolean;
          is_avoided?: boolean;
          times_used?: number;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          is_favorite?: boolean;
          is_avoided?: boolean;
          times_used?: number;
          last_used_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_exercise_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_exercise_preferences_exercise_id_fkey";
            columns: ["exercise_id"];
            isOneToOne: false;
            referencedRelation: "exercises";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      save_ai_routine: {
        Args: { p_routine: Json };
        Returns: string;
      };
      save_routine_with_exercises: {
        Args: {
          routine_title: string;
          routine_description: string | null;
          exercises_payload: Json;
          p_program_id?: string | null;
          p_week_number?: number | null;
          p_day_of_week?: number | null;
        };
        Returns: string;
      };
      regenerate_routine_day: {
        Args: {
          p_routine_id: string;
          routine_title: string;
          routine_description: string | null;
          exercises_payload: Json;
        };
        Returns: undefined;
      };
      regenerate_ai_routine_day: {
        Args: { p_routine_id: string; p_routine: Json };
        Returns: undefined;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
