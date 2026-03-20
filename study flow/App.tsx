
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken,
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  onSnapshot, 
  setDoc,
  getDoc,
  addDoc,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { TodayView } from './views/TodayView';
import { TasksView } from './views/TasksView';
import { StatsView } from './views/StatsView';
import { CommunityView } from './views/CommunityView';
import { ActiveTimerScreen } from './views/TimerView';
import { BottomNav } from './components/Common';
import { SettingsModal } from './components/Modals';
import { Task, Session, Settings } from './types';

// Initialize Firebase
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'dev-app-id';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('today');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'dday' | 'goal' | 'timer' | 'data' | 'widgets'>('dday');
  
  const defaultTodayOrder = ['header', 'stats', 'streak', 'tasks'];
  const defaultReportOrder = ['time', 'wins', 'goals', 'trends', 'top5', 'rpg'];
  const defaultTasksOrder = ['dashboard'];

  const [settings, setSettings] = useState<Settings>({ 
      dailyGoalMinutes: 480, 
      timerMode: 'stopwatch', 
      timerTheme: 'ring',
      timerStrictFocus: false,
      timerSound: true,
      examName: '', 
      examDate: '', 
      levelSystem: 'cumulative',
      targetExamHours: 3000, 
      countdownMinutes: 60, 
      pomoFocus: 25, 
      pomoShortBreak: 5, 
      pomoLongBreak: 30, 
      pomoInterval: 4, 
      pomoAutoStartBreak: false, 
      pomoAutoStartPomodoro: false,
      displayMode: 'detail',
      reportWidgets: {
        rpg: true, wins: true, time: true, goals: true, trends: true, top5: true
      },
      reportWidgetOrder: defaultReportOrder,
      todayWidgets: {
        header: true, stats: true, streak: true, tasks: true
      },
      todayWidgetOrder: defaultTodayOrder,
      tasksWidgets: {
        dashboard: true
      },
      tasksWidgetOrder: defaultTasksOrder,
      autoShareAchievements: true
  });
  const [isCreatingImmediately, setIsCreatingImmediately] = useState(false);

  // Watch for new high-focus or long sessions to auto-share to community
  useEffect(() => {
    if (!user || !settings.autoShareAchievements) return;
    if (sessions.length === 0) return;

    const latest = sessions[0];
    const now = Date.now();
    // Only consider sessions created in the last 10 seconds (avoid sharing old ones on load)
    if (now - latest.timestamp > 10000) return;

    const task = tasks.find(t => t.id === latest.taskId);
    if (!task) return;

    // Logic: share if session duration > 30 mins OR focus score >= 8
    if (latest.duration >= 1800 || (latest.actualFocus && latest.actualFocus >= 8)) {
      const shareToCommunity = async () => {
        const profileSnap = await getDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'));
        const profile = profileSnap.exists() ? profileSnap.data() : { level: 1, title: '학습자' };
        
        await addDoc(collection(db, 'artifacts', appId, 'community_feed'), {
          userId: user.uid,
          userName: user.displayName || '익명 학습자',
          userPhoto: user.photoURL || '',
          userLevel: profile.level || 1,
          userTitle: profile.title || '입문자',
          type: 'session_complete',
          content: `${task.name} 과목에서 ${Math.round(latest.duration/60)}분 동안 고도의 집중력을 발휘했습니다!`,
          fires: 0,
          firedBy: [],
          timestamp: serverTimestamp()
        });
      };
      shareToCommunity().catch(e => console.error("Auto-share error:", e));
    }
  }, [sessions, user, tasks, settings.autoShareAchievements]);

  useEffect(() => {
    let isMounted = true;
    const initAuth = async () => {
      const authInstance = getAuth(app);
      if (firebaseConfig.apiKey === 'mock-api-key' || !firebaseConfig.apiKey) {
        if (isMounted) {
            setUser({ uid: 'mock-user', isAnonymous: true } as User);
            setLoading(false);
        }
        return;
      }
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(authInstance, __initial_auth_token);
        } else {
          await signInAnonymously(authInstance);
        }
      } catch (e) {
        if (isMounted) {
            setUser({ uid: 'guest-user', isAnonymous: true } as User);
            setLoading(false);
        }
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
        if (isMounted) {
          setUser(u || ({ uid: 'guest-user', isAnonymous: true } as User)); 
          setLoading(false); 
        }
    });
    return () => { isMounted = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;
    const settingsUnsub = onSnapshot(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config'), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            setSettings(prev => ({ ...prev, ...data as Settings }));
        }
    });
    const taskUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'tasks'), s => {
        const newTasks = s.docs.map(d => ({id:d.id, ...d.data()} as Task)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
        setTasks(newTasks);
    });
    const sessionUnsub = onSnapshot(collection(db, 'artifacts', appId, 'users', userId, 'sessions'), s => {
        const newSessions = s.docs.map(d => ({id:d.id, ...d.data()} as Session)).sort((a,b)=>(b.timestamp||0)-(a.timestamp||0));
        setSessions(newSessions);
    });
    return () => { settingsUnsub(); taskUnsub(); sessionUnsub(); };
  }, [user]);

  useEffect(() => {
      if (activeTask) {
          const exists = tasks.find(t => t.id === activeTask.id);
          if (!exists && tasks.length > 0 && !loading) {
              setActiveTask(null);
          }
      }
  }, [tasks, activeTask, loading]);

  const handleUpdateSettings = async (newSettings: Settings) => { 
      setSettings(newSettings); 
      if(user) {
          try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'config'), newSettings); } 
          catch (e) { console.error("Settings Save Error:", e); }
      } 
  };
  
  const handleSeedData = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    const userId = user.uid;
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const getRelDate = (offset: number) => { const d = new Date(today); d.setDate(today.getDate() + offset); return formatDate(d); };

    // 1. Optimized Settings for Labor Attorney Candidate
    const demoSettings: Settings = { 
        ...settings, 
        examName: '2026 공인노무사 동차 합격', 
        examDate: '2026-05-23', 
        dailyGoalMinutes: 600, // 10 hours goal
        levelSystem: 'cumulative', 
        targetExamHours: 3000,
        timerMode: 'pomodoro',
        timerTheme: 'ring'
    };
    setSettings(demoSettings);
    batch.set(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config'), demoSettings);
    
    // 2. Realistic Tasks (Diverse Scenarios)
    const subjectData = [
        { id: 't1', name: '노동법 1 (판례 심화)', total: 600, current: 210, start: getRelDate(-30), target: getRelDate(60), status: 'active' as const, repeat: ['월', '수', '금', '일'] },
        { id: 't2', name: '민법 (채권총론 지연중)', total: 500, current: 45, start: getRelDate(-20), target: getRelDate(15), status: 'active' as const, repeat: ['화', '목', '토'] },
        { id: 't3', name: '행정쟁송법 (리드중)', total: 400, current: 280, start: getRelDate(-40), target: getRelDate(90), status: 'active' as const, repeat: ['월', '화', '수', '목', '금'] },
        { id: 't4', name: '인사노무관리론 (입문 완료)', total: 200, current: 200, start: getRelDate(-60), target: getRelDate(-5), status: 'completed' as const, repeat: [] },
        { id: 't5', name: '사회보험법 (암기 위주)', total: 300, current: 10, start: getRelDate(-5), target: getRelDate(120), status: 'incomplete' as const, repeat: ['토', '일'] }
    ];

    // Fix: Access property 'start' directly from the data source instead of nonexistent 'startDate'
    subjectData.forEach((s) => {
        const taskRef = doc(db, 'artifacts', appId, 'users', userId, 'tasks', s.id);
        batch.set(taskRef, { 
            id: s.id, 
            name: s.name, 
            totalAmount: s.total, 
            currentAmount: s.current, 
            unit: 'p', 
            status: s.status, 
            createdAt: serverTimestamp(), 
            targetDate: s.target, 
            startDate: s.start,
            repeatDays: s.repeat
        });
    });

    // 3. Realistic Sessions (History for Charts & RPG)
    // Generate sessions for the last 14 days to create a streak and trend
    const studyHoursPerDay = [8, 9, 10, 7, 11, 10, 6, 9, 12, 10, 9, 11, 5, 10]; // last 14 days
    const subjects = ['t1', 't2', 't3'];
    
    studyHoursPerDay.forEach((hours, dayIdx) => {
        const date = new Date(today);
        date.setDate(today.getDate() - (13 - dayIdx));
        
        // 2-3 sessions per day
        for(let i=0; i<3; i++) {
            const taskId = subjects[Math.floor(Math.random() * subjects.length)];
            const duration = (hours / 3) * 3600;
            const amount = Math.floor(Math.random() * 15) + 5;
            const pred = Math.floor(Math.random() * 5) + 5;
            const act = Math.min(10, pred + (Math.random() > 0.5 ? 1 : -1));
            
            const sessionRef = doc(collection(db, 'artifacts', appId, 'users', userId, 'sessions'));
            batch.set(sessionRef, {
                taskId,
                duration,
                amount,
                mode: 'pomodoro',
                timestamp: date.getTime() + (i * 4 * 3600 * 1000), // Spaced out
                createdAt: serverTimestamp(),
                predictedFocus: pred,
                actualFocus: act,
                keyword: i === 0 ? '판례 암기 구조화' : '기출 오답 정리'
            });
        }
    });

    try { 
        await batch.commit(); 
        alert("노무사 합격 대비 맞춤 예시 데이터가 생성되었습니다!");
    } catch (e) {
        console.error("Seed Error:", e);
    }
  };

  const handleNavigateToCreateTask = () => { setActiveTask(null); setView('tasks'); setIsCreatingImmediately(true); };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;

  if (activeTask) {
      return (
          <div className="bg-gray-100 h-screen w-full max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col relative font-sans text-gray-900">
              <ActiveTimerScreen selectedTask={activeTask} onBack={() => setActiveTask(null)} settings={settings} user={user} appId={appId} sessions={sessions} onOpenSettings={() => { setSettingsTab('timer'); setShowSettings(true); }} onUpdateSettings={handleUpdateSettings} />
              <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={handleUpdateSettings} user={user} db={db} appId={appId} initialTab={settingsTab} />
          </div>
      );
  }

  return (
    <div className="bg-gray-100 h-screen w-full max-w-md mx-auto shadow-2xl overflow-hidden flex flex-col relative font-sans text-gray-900">
      <main className="flex-1 overflow-hidden relative">
        <div className={view === 'today' ? 'h-full' : 'hidden'}>
             <TodayView tasks={tasks} sessions={sessions} settings={settings} onOpenSettings={() => { setSettingsTab('dday'); setShowSettings(true); }} setView={setView} onNavigateToCreateTask={handleNavigateToCreateTask} setActiveTask={setActiveTask} onViewTaskDetails={(task) => { setFocusedTaskId(task.id); setView('tasks'); }} onUpdateSettings={handleUpdateSettings} />
        </div>
        {view === 'tasks' && <TasksView 
            tasks={tasks} sessions={sessions} user={user} db={db} appId={appId} activeTask={activeTask} setActiveTask={setActiveTask} onSeedData={handleSeedData} settings={settings} isCreatingImmediately={isCreatingImmediately} setIsCreatingImmediately={setIsCreatingImmediately} focusedTaskId={focusedTaskId} setFocusedTaskId={setFocusedTaskId} onUpdateSettings={handleUpdateSettings}
        />}
        {view === 'stats' && <StatsView tasks={tasks} sessions={sessions} settings={settings} user={user} db={db} appId={appId} onOpenSettings={() => { setSettingsTab('widgets'); setShowSettings(true); }} onUpdateSettings={handleUpdateSettings} />}
        {view === 'community' && <CommunityView user={user} db={db} appId={appId} settings={settings} onUpdateSettings={handleUpdateSettings} tasks={tasks} sessions={sessions} />}
      </main>
      <BottomNav currentView={view} setView={setView} />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} settings={settings} onUpdateSettings={handleUpdateSettings} user={user} db={db} appId={appId} initialTab={settingsTab} />
    </div>
  );
}
