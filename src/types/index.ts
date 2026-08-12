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
  estimatedMinutes: number | null;
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
  estimatedMinutes?: number | null;
}

export interface TaskUpdate {
  planDate?: DateKey;
  title?: string;
  completed?: boolean;
  sortOrder?: number;
  estimatedMinutes?: number | null;
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

export type CompanionExperienceMode = 'study_together' | 'supporter';
export type CompanionShareLevel = 'none' | 'bloom_only' | 'summary';

export interface CompanionPreferences {
  userId: string;
  primaryCompanionId: string | null;
  experienceMode: CompanionExperienceMode;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionSetting {
  ownerId: string;
  companionId: string;
  shareLevel: CompanionShareLevel;
  createdAt: string;
  updatedAt: string;
}

export interface CompanionDaySummary {
  date: DateKey;
  effectiveStudy: boolean;
  studiedMinutes: number | null;
  completedTasks: number | null;
  totalTasks: number | null;
}

export interface CompanionSummary {
  companionId: string;
  shareLevel: CompanionShareLevel;
  days: CompanionDaySummary[];
}

export interface CompanionEncouragement {
  id: string;
  senderId: string;
  recipientId: string;
  sentOn: DateKey;
  kind: 'flower';
  createdAt: string;
}

export interface CompanionWeeklySummary {
  weekBloomDays: number;
  totalBloomDays: number;
  weekMutualFlowerDays: number;
  milestone: number | null;
  summary: string;
}

export interface FriendNote {
  ownerId: string;
  friendId: string;
  remark: string;
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
  /** 当天有任务且全部完成（旧名 checkedIn，为避免与「地点签到」混淆而改名）。 */
  allCompleted: boolean;
}

export interface MonthlyStatistics {
  startDate: DateKey;
  endDate: DateKey;
  totalTaskCount: number;
  completedTaskCount: number;
  allCompletedDays: number;
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  days: DailyStatistics[];
}

// ---------------------------------------------------------------------------
// Study module: locations, attendance (check-in/out), sessions, segments
// ---------------------------------------------------------------------------

export type StudyMode = 'free' | 'pomodoro';
export type StudySessionStatus = 'running' | 'paused' | 'waiting' | 'completed' | 'cancelled';
export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';
export type SegmentKind = 'free' | 'focus';

export const POMODORO_LIMITS = {
  focusSeconds: { min: 15 * 60, max: 90 * 60, fallback: 25 * 60 },
  shortBreakSeconds: { min: 3 * 60, max: 30 * 60, fallback: 5 * 60 },
  longBreakSeconds: { min: 10 * 60, max: 60 * 60, fallback: 15 * 60 },
  roundsBeforeLongBreak: { min: 2, max: 8, fallback: 4 },
} as const;

export const LOCATION_LIMITS = {
  radiusMinM: 100,
  radiusMaxM: 1000,
  radiusDefaultM: 200,
  accuracyLimitM: 150,
} as const;

export interface StudyLocation {
  id: string;
  userId: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudyLocationInput {
  name: string;
  latitude: number;
  longitude: number;
  radiusM?: number;
}

export interface StudyLocationUpdate {
  name?: string;
  radiusM?: number;
  latitude?: number;
  longitude?: number;
  isActive?: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  locationId: string;
  checkInAt: string;
  checkInAccuracyM: number;
  checkInDistanceM: number;
  checkOutAt: string | null;
  checkOutAccuracyM: number | null;
  checkOutDistanceM: number | null;
  manualClosed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StudySession {
  id: string;
  userId: string;
  taskId: string | null;
  taskTitleSnapshot: string;
  attendanceRecordId: string | null;
  planDate: DateKey;
  mode: StudyMode;
  status: StudySessionStatus;
  startedAt: string;
  endedAt: string | null;
  pomodoroFocusSeconds: number | null;
  pomodoroShortBreakSeconds: number | null;
  pomodoroLongBreakSeconds: number | null;
  pomodoroRoundsBeforeLongBreak: number | null;
  pomodoroCompletedRounds: number;
  currentPhase: PomodoroPhase | null;
  currentRound: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  phaseRemainingSeconds: number | null;
  reflection: string;
  createdAt: string;
  updatedAt: string;
}

export interface StudySessionSegment {
  id: string;
  userId: string;
  sessionId: string;
  segmentKind: SegmentKind;
  /** Database-assigned round number for Pomodoro focus fragments. */
  pomodoroRound: number | null;
  /** Database phase-end time when this round completed normally. */
  pomodoroCompletedAt: string | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface StudyPreferences {
  userId: string;
  defaultMode: StudyMode;
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  roundsBeforeLongBreak: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  dailyGoalEnabled: boolean;
  dailyGoalMinutes: number;
  countdownEnabled: boolean;
  countdownTitle: string;
  countdownDate: DateKey | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudyPreferencesUpdate {
  defaultMode?: StudyMode;
  focusSeconds?: number;
  shortBreakSeconds?: number;
  longBreakSeconds?: number;
  roundsBeforeLongBreak?: number;
  soundEnabled?: boolean;
  vibrationEnabled?: boolean;
  dailyGoalEnabled?: boolean;
  dailyGoalMinutes?: number;
  countdownEnabled?: boolean;
  countdownTitle?: string;
  countdownDate?: DateKey | null;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracyM: number;
}

// ---------------------------------------------------------------------------
// Study statistics (computed client-side from segments)
// ---------------------------------------------------------------------------

export interface DateSecondsRange {
  date: DateKey;
  seconds: number;
}

export interface StudyDailyPoint {
  date: DateKey;
  seconds: number;
  pomodoroRounds: number;
}

export interface StudyTaskPoint {
  taskTitle: string;
  seconds: number;
  pomodoroRounds: number;
}

export interface StudyTimeStatistics {
  totalSeconds: number;
  freeSeconds: number;
  focusSeconds: number;
  sessionCount: number;
  longestSessionSeconds: number;
  completedPomodoroRounds: number;
  activeDays: number;
  averageDailySeconds: number;
  byDay: StudyDailyPoint[];
  byTask: StudyTaskPoint[];
}

export interface StudyTimeSlot {
  key: 'morning' | 'afternoon' | 'evening' | 'night';
  label: string;
  seconds: number;
}

export interface WeeklyStudyReview {
  startDate: DateKey;
  endDate: DateKey;
  totalSeconds: number;
  previousWeekSeconds: number;
  changePercent: number | null;
  topTaskTitle: string | null;
  completedTaskCount: number;
  goalMetDays: number;
  summary: string;
}

export interface TaskStudySummary {
  taskId: string;
  totalSeconds: number;
  sessionCount: number;
  lastStudiedAt: string | null;
}

export interface ExportTask {
  /** Present in version 2 backups so study sessions keep their task link. */
  id?: string;
  planDate: DateKey;
  title: string;
  completed: boolean;
  sortOrder: number;
  /** Optional for compatibility with backups created before V0.5.1. */
  estimatedMinutes?: number | null;
}

export interface ExportPlanDay {
  planDate: DateKey;
  isRestDay: boolean;
  note: string;
}

export interface ExportStudyLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface ExportAttendanceRecord {
  id: string;
  locationId: string;
  checkInAt: string;
  checkInLatitude: number;
  checkInLongitude: number;
  checkInAccuracyM: number;
  checkInDistanceM: number;
  checkOutAt: string | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracyM: number | null;
  checkOutDistanceM: number | null;
  manualClosed: boolean;
}

export interface ExportStudySession {
  id: string;
  taskId: string | null;
  taskTitleSnapshot: string;
  attendanceRecordId: string | null;
  planDate: DateKey;
  mode: StudyMode;
  status: StudySessionStatus;
  startedAt: string;
  endedAt: string | null;
  pomodoroFocusSeconds: number | null;
  pomodoroShortBreakSeconds: number | null;
  pomodoroLongBreakSeconds: number | null;
  pomodoroRoundsBeforeLongBreak: number | null;
  pomodoroCompletedRounds: number;
  currentPhase: PomodoroPhase | null;
  currentRound: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  phaseRemainingSeconds: number | null;
  /** Optional for compatibility with backups created before V0.5.1. */
  reflection?: string;
}

export interface ExportStudySessionSegment {
  id: string;
  sessionId: string;
  segmentKind: SegmentKind;
  /** Optional for compatibility with backups created before V0.4.1. */
  pomodoroRound?: number | null;
  /** Optional for compatibility with backups created before V0.4.1. */
  pomodoroCompletedAt?: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface ExportStudyPreferences {
  defaultMode: StudyMode;
  focusSeconds: number;
  shortBreakSeconds: number;
  longBreakSeconds: number;
  roundsBeforeLongBreak: number;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  /** Optional for compatibility with backups created before V0.6.0. */
  dailyGoalEnabled?: boolean;
  /** Optional for compatibility with backups created before V0.6.0. */
  dailyGoalMinutes?: number;
  /** Optional for compatibility with backups created before V0.7.0. */
  countdownEnabled?: boolean;
  /** Optional for compatibility with backups created before V0.7.0. */
  countdownTitle?: string;
  /** Optional for compatibility with backups created before V0.7.0. */
  countdownDate?: DateKey | null;
}

export interface StudyBloomExportV1 {
  version: 1;
  exportedAt: string;
  tasks: ExportTask[];
  planDays: ExportPlanDay[];
}

export interface StudyBloomExportV2 {
  version: 2;
  exportedAt: string;
  tasks: ExportTask[];
  planDays: ExportPlanDay[];
  studyLocations: ExportStudyLocation[];
  attendanceRecords: ExportAttendanceRecord[];
  studySessions: ExportStudySession[];
  studySessionSegments: ExportStudySessionSegment[];
  studyPreferences: ExportStudyPreferences | null;
}

export type StudyBloomExport = StudyBloomExportV1 | StudyBloomExportV2;

export interface ImportResult {
  taskCount: number;
  planDayCount: number;
  /** Study-module rows restored by a version 2 backup (0 for v1 files). */
  studyRecordCount: number;
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
          estimated_minutes: number | null;
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
          estimated_minutes?: number | null;
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
          estimated_minutes?: number | null;
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
      friend_notes: {
        Row: {
          owner_id: string;
          friend_id: string;
          remark: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          friend_id: string;
          remark: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          friend_id?: string;
          remark?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companion_preferences: {
        Row: {
          user_id: string;
          primary_companion_id: string | null;
          experience_mode: 'study_together' | 'supporter';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          primary_companion_id?: string | null;
          experience_mode?: 'study_together' | 'supporter';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          primary_companion_id?: string | null;
          experience_mode?: 'study_together' | 'supporter';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companion_settings: {
        Row: {
          owner_id: string;
          companion_id: string;
          share_level: 'none' | 'bloom_only' | 'summary';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          owner_id: string;
          companion_id: string;
          share_level?: 'none' | 'bloom_only' | 'summary';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          companion_id?: string;
          share_level?: 'none' | 'bloom_only' | 'summary';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      companion_encouragements: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          sent_on: string;
          kind: 'flower';
          created_at: string;
        };
        Insert: {
          id?: string;
          sender_id: string;
          recipient_id: string;
          sent_on: string;
          kind?: 'flower';
          created_at?: string;
        };
        Update: {
          id?: string;
          sender_id?: string;
          recipient_id?: string;
          sent_on?: string;
          kind?: 'flower';
          created_at?: string;
        };
        Relationships: [];
      };
      study_locations: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          latitude: number;
          longitude: number;
          radius_m: number;
          is_active: boolean;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          latitude: number;
          longitude: number;
          radius_m?: number;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          latitude?: number;
          longitude?: number;
          radius_m?: number;
          is_active?: boolean;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          user_id: string;
          location_id: string;
          check_in_at: string;
          check_in_latitude: number;
          check_in_longitude: number;
          check_in_accuracy_m: number;
          check_in_distance_m: number;
          check_out_at: string | null;
          check_out_latitude: number | null;
          check_out_longitude: number | null;
          check_out_accuracy_m: number | null;
          check_out_distance_m: number | null;
          manual_closed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          location_id: string;
          check_in_at?: string;
          check_in_latitude: number;
          check_in_longitude: number;
          check_in_accuracy_m: number;
          check_in_distance_m: number;
          check_out_at?: string | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_accuracy_m?: number | null;
          check_out_distance_m?: number | null;
          manual_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          location_id?: string;
          check_in_at?: string;
          check_in_latitude?: number;
          check_in_longitude?: number;
          check_in_accuracy_m?: number;
          check_in_distance_m?: number;
          check_out_at?: string | null;
          check_out_latitude?: number | null;
          check_out_longitude?: number | null;
          check_out_accuracy_m?: number | null;
          check_out_distance_m?: number | null;
          manual_closed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          task_title_snapshot: string;
          attendance_record_id: string | null;
          plan_date: string;
          mode: 'free' | 'pomodoro';
          status: 'running' | 'paused' | 'waiting' | 'completed' | 'cancelled';
          started_at: string;
          ended_at: string | null;
          pomodoro_focus_seconds: number | null;
          pomodoro_short_break_seconds: number | null;
          pomodoro_long_break_seconds: number | null;
          pomodoro_rounds_before_long_break: number | null;
          pomodoro_completed_rounds: number;
          current_phase: 'focus' | 'short_break' | 'long_break' | null;
          current_round: number;
          phase_started_at: string | null;
          phase_ends_at: string | null;
          phase_remaining_seconds: number | null;
          reflection: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          task_title_snapshot?: string;
          attendance_record_id?: string | null;
          plan_date: string;
          mode: 'free' | 'pomodoro';
          status?: 'running' | 'paused' | 'waiting' | 'completed' | 'cancelled';
          started_at?: string;
          ended_at?: string | null;
          pomodoro_focus_seconds?: number | null;
          pomodoro_short_break_seconds?: number | null;
          pomodoro_long_break_seconds?: number | null;
          pomodoro_rounds_before_long_break?: number | null;
          pomodoro_completed_rounds?: number;
          current_phase?: 'focus' | 'short_break' | 'long_break' | null;
          current_round?: number;
          phase_started_at?: string | null;
          phase_ends_at?: string | null;
          phase_remaining_seconds?: number | null;
          reflection?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          task_title_snapshot?: string;
          attendance_record_id?: string | null;
          plan_date?: string;
          mode?: 'free' | 'pomodoro';
          status?: 'running' | 'paused' | 'waiting' | 'completed' | 'cancelled';
          started_at?: string;
          ended_at?: string | null;
          pomodoro_focus_seconds?: number | null;
          pomodoro_short_break_seconds?: number | null;
          pomodoro_long_break_seconds?: number | null;
          pomodoro_rounds_before_long_break?: number | null;
          pomodoro_completed_rounds?: number;
          current_phase?: 'focus' | 'short_break' | 'long_break' | null;
          current_round?: number;
          phase_started_at?: string | null;
          phase_ends_at?: string | null;
          phase_remaining_seconds?: number | null;
          reflection?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_session_segments: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          segment_kind: 'free' | 'focus';
          pomodoro_round: number | null;
          pomodoro_completed_at: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          session_id: string;
          segment_kind: 'free' | 'focus';
          pomodoro_round?: number | null;
          pomodoro_completed_at?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string;
          segment_kind?: 'free' | 'focus';
          pomodoro_round?: number | null;
          pomodoro_completed_at?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      study_preferences: {
        Row: {
          user_id: string;
          default_mode: 'free' | 'pomodoro';
          focus_seconds: number;
          short_break_seconds: number;
          long_break_seconds: number;
          rounds_before_long_break: number;
          sound_enabled: boolean;
          vibration_enabled: boolean;
          daily_goal_enabled: boolean;
          daily_goal_minutes: number;
          countdown_enabled: boolean;
          countdown_title: string;
          countdown_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_mode?: 'free' | 'pomodoro';
          focus_seconds?: number;
          short_break_seconds?: number;
          long_break_seconds?: number;
          rounds_before_long_break?: number;
          sound_enabled?: boolean;
          vibration_enabled?: boolean;
          daily_goal_enabled?: boolean;
          daily_goal_minutes?: number;
          countdown_enabled?: boolean;
          countdown_title?: string;
          countdown_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_mode?: 'free' | 'pomodoro';
          focus_seconds?: number;
          short_break_seconds?: number;
          long_break_seconds?: number;
          rounds_before_long_break?: number;
          sound_enabled?: boolean;
          vibration_enabled?: boolean;
          daily_goal_enabled?: boolean;
          daily_goal_minutes?: number;
          countdown_enabled?: boolean;
          countdown_title?: string;
          countdown_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      check_in_at_location: {
        Args: { p_location_id: string; p_latitude: number; p_longitude: number; p_accuracy_m: number };
        Returns: Database['public']['Tables']['attendance_records']['Row'];
      };
      check_out_from_location: {
        Args: { p_latitude: number; p_longitude: number; p_accuracy_m: number };
        Returns: Database['public']['Tables']['attendance_records']['Row'];
      };
      force_close_attendance: {
        Args: Record<string, never>;
        Returns: Database['public']['Tables']['attendance_records']['Row'];
      };
      start_study_session: {
        Args: {
          p_mode: 'free' | 'pomodoro';
          p_task_id?: string | null;
          p_focus_seconds?: number | null;
          p_short_break_seconds?: number | null;
          p_long_break_seconds?: number | null;
          p_rounds_before_long_break?: number | null;
        };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      pause_study_session: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      resume_study_session: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      sync_pomodoro_session: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'] | null;
      };
      start_next_pomodoro_phase: {
        Args: { p_session_id: string; p_phase: 'focus' | 'short_break' | 'long_break' };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      skip_pomodoro_break: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      end_current_focus_round: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      finish_study_session: {
        Args: { p_session_id: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      restore_study_records: {
        Args: { p_attendance: Json; p_sessions: Json; p_segments: Json };
        Returns: number;
      };
      save_study_session_reflection: {
        Args: { p_session_id: string; p_reflection: string };
        Returns: Database['public']['Tables']['study_sessions']['Row'];
      };
      restore_study_reflections: {
        Args: { p_sessions: Json };
        Returns: number;
      };
      get_companion_summary: {
        Args: { p_target_user_id: string; p_start_date: string; p_end_date: string };
        Returns: {
          summary_date: string;
          effective_study: boolean;
          studied_minutes: number | null;
          completed_tasks: number | null;
          total_tasks: number | null;
        }[];
      };
      get_companion_weekly_summary: {
        Args: { p_target_user_id: string };
        Returns: {
          week_bloom_days: number;
          total_bloom_days: number;
          week_mutual_flower_days: number;
          milestone: number | null;
        }[];
      };
      send_companion_flower: {
        Args: { p_recipient_id: string };
        Returns: Database['public']['Tables']['companion_encouragements']['Row'];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
