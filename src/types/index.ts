/** Shared domain types for StudyBloom. Dates are always YYYY-MM-DD keys. */

export type DateKey = string;

export interface User {
  id: string;
  email?: string;
  displayName?: string;
}

export interface Task {
  id: string;
  userId: string;
  planDate: DateKey;
  title: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanDay {
  id: string;
  userId: string;
  planDate: DateKey;
  isRestDay: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskInput {
  planDate: DateKey;
  title: string;
  completed?: boolean;
  sortOrder?: number;
}

export interface TaskUpdate {
  planDate?: DateKey;
  title?: string;
  completed?: boolean;
  sortOrder?: number;
}

export interface PlanDayInput {
  planDate: DateKey;
  isRestDay?: boolean;
  note?: string;
}

export interface PlanDayUpdate {
  isRestDay?: boolean;
  note?: string;
}

export type CopyMode = 'overwrite' | 'append';

export interface CopyPlanOptions {
  sourceDate: DateKey;
  targetDate: DateKey;
  mode?: CopyMode;
}

export interface DateRange {
  startDate: DateKey;
  endDate: DateKey;
}

export interface DailyStatistics {
  date: DateKey;
  isRestDay: boolean;
  taskCount: number;
  completedTaskCount: number;
  checkedIn: boolean;
}

export interface MonthlyStatistics {
  startDate: DateKey;
  endDate: DateKey;
  totalTaskCount: number;
  completedTaskCount: number;
  checkInDays: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  days: DailyStatistics[];
}

export interface ExportTask {
  planDate: DateKey;
  title: string;
  completed: boolean;
  sortOrder: number;
}

export interface ExportPlanDay {
  planDate: DateKey;
  isRestDay: boolean;
  note: string;
}

export interface StudyBloomExport {
  version: 1;
  exportedAt: string;
  tasks: ExportTask[];
  planDays: ExportPlanDay[];
}

export interface ImportResult {
  taskCount: number;
  planDayCount: number;
}

export interface AuthResult {
  user: User | null;
  session: unknown | null;
}

/** Minimal Supabase generated-style schema used by the typed client. */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      tasks: {
        Row: {
          id: string;
          user_id: string;
          plan_date: string;
          title: string;
          completed: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_date: string;
          title: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_date?: string;
          title?: string;
          completed?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      plan_days: {
        Row: {
          id: string;
          user_id: string;
          plan_date: string;
          is_rest_day: boolean;
          note: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_date: string;
          is_rest_day?: boolean;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_date?: string;
          is_rest_day?: boolean;
          note?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

