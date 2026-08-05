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

export interface Profile {
  id: string;
  displayName: string;
  friendCode: string;
  avatarUrl: string | null;
  allowRequests: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Friendship {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: FriendshipStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface CalendarShare {
  id: string;
  ownerId: string;
  viewerId: string;
  canView: boolean;
  createdAt: string;
  updatedAt: string;
}

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
      profiles: {
        Row: {
          id: string;
          display_name: string;
          friend_code: string;
          avatar_url: string | null;
          allow_requests: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          friend_code: string;
          avatar_url?: string | null;
          allow_requests?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          friend_code?: string;
          avatar_url?: string | null;
          allow_requests?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: {
          id: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'rejected' | 'blocked';
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          addressee_id: string;
          status: 'pending' | 'accepted' | 'rejected' | 'blocked';
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          id?: string;
          requester_id?: string;
          addressee_id?: string;
          status?: 'pending' | 'accepted' | 'rejected' | 'blocked';
          created_at?: string;
          responded_at?: string | null;
        };
        Relationships: [];
      };
      calendar_shares: {
        Row: {
          id: string;
          owner_id: string;
          viewer_id: string;
          can_view: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          viewer_id: string;
          can_view?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          viewer_id?: string;
          can_view?: boolean;
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

