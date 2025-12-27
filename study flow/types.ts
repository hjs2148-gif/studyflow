
export interface Task {
  id: string;
  name: string;
  totalAmount: number;
  currentAmount: number;
  unit: string;
  status: 'active' | 'completed' | 'incomplete';
  targetDate?: string;
  startDate?: string;
  repeatDays?: string[];
  createdAt?: any;
}

export interface Session {
  id: string;
  taskId: string;
  duration: number;
  amount?: number;
  mode: string;
  timestamp: number;
  createdAt?: any;
  predictedFocus?: number; // 1-10 Scale (Metacognition: Prediction)
  actualFocus?: number;    // 1-10 Scale (Metacognition: Actual)
  keyword?: string;        // New: Retrieval Practice Keyword
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  level: number;
  title: string;
  lastActive?: any;
  autoShare: boolean;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  weeklyExp?: number;
}

export interface CommunityFeedItem {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  userLevel: number;
  userTitle: string;
  type: 'achievement' | 'goal_reached' | 'streak' | 'session_complete';
  content: string;
  fires: number;
  timestamp: any;
  firedBy?: string[]; // Array of UIDs who liked
}

export interface LivePresence {
  uid: string;
  displayName: string;
  photoURL?: string;
  taskName: string;
  startedAt: number;
  lastHeartbeat: any;
  boosts: number;
  boostedBy?: string[];
}

export interface ClanChallenge {
  id: string;
  name: string;
  goalType: 'time' | 'amount';
  targetValue: number;
  currentValue: number;
  participants: string[];
  expiresAt: any;
}

export interface Settings {
  dailyGoalMinutes: number;
  timerMode: 'stopwatch' | 'countdown' | 'pomodoro';
  timerTheme?: 'minimal' | 'ring' | 'flip';
  timerStrictFocus?: boolean; // New: Pause on background
  timerSound?: boolean;       // New: Sound Effects
  examName?: string;
  examDate?: string;
  
  levelSystem?: 'monthly' | 'cumulative';
  targetExamHours?: number;

  countdownMinutes?: number;
  pomoFocus?: number;
  pomoShortBreak?: number;
  pomoLongBreak?: number;
  pomoInterval?: number;
  pomoAutoStartBreak?: boolean;
  pomoAutoStartPomodoro?: boolean;
  
  displayMode?: 'compact' | 'detail';

  reportWidgets?: {
    rpg?: boolean;
    wins?: boolean;
    time?: boolean;
    goals?: boolean;
    trends?: boolean;
    top5?: boolean;
  };
  reportWidgetOrder?: string[];

  todayWidgets?: {
    header?: boolean;
    stats?: boolean;
    streak?: boolean;
    tasks?: boolean;
  };
  todayWidgetOrder?: string[];

  tasksWidgets?: {
    dashboard?: boolean;
  };
  tasksWidgetOrder?: string[];
  
  autoShareAchievements?: boolean;
}

declare global {
  var __firebase_config: string;
  var __app_id: string;
  var __initial_auth_token: string;
}
