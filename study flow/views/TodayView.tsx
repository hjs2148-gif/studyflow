
import React, { useMemo, useState, useEffect } from 'react';
import { Plus, Settings, Activity, Zap, ArrowRight, Play, ChevronUp, ChevronDown, Calendar, BookOpen, Crown, Footprints, BrainCircuit, Trophy, Star, GripHorizontal, Clock } from 'lucide-react';
import { SimpleCircularProgress, CollapsibleCard, MiniDonut } from '../components/Common';
import { Task, Session, Settings as SettingsType } from '../types';

interface TodayViewProps {
    tasks: Task[];
    sessions: Session[];
    settings: SettingsType;
    onOpenSettings: () => void;
    setView: (view: string) => void;
    onNavigateToCreateTask: () => void;
    setActiveTask: (task: Task) => void;
    onViewTaskDetails: (task: Task) => void;
    onUpdateSettings: (s: SettingsType) => void;
}

const formatDurationSimple = (seconds: number) => {
  if (!seconds) return "0분";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
};

const getDaysDiff = (targetDate?: string) => {
  if (!targetDate) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(targetDate); 
  target.setHours(0,0,0,0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

export const TodayView: React.FC<TodayViewProps> = ({ tasks, sessions, settings, onOpenSettings, setView, onNavigateToCreateTask, setActiveTask, onViewTaskDetails, onUpdateSettings }) => {
    const isCompactMode = settings.displayMode === 'compact';
    const [isHeaderCompact, setIsHeaderCompact] = useState(isCompactMode);
    const [isCompact, setIsCompact] = useState(isCompactMode);
    const [isStreakCompact, setIsStreakCompact] = useState(isCompactMode);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        if (!isHeaderCompact) {
            const timer = setInterval(() => setNow(new Date()), 1000);
            return () => clearInterval(timer);
        }
    }, [isHeaderCompact]);

    const getTimeRemaining = () => {
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        const diff = end.getTime() - now.getTime();
        
        if (diff < 0) return "00:00:00";
        
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);
        
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    const today = new Date();
    const daysLeft = getDaysDiff(settings.examDate);
    const dailyGoalSeconds = (settings.dailyGoalMinutes || 480) * 60;

    const todayStats = useMemo(() => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todaySessions = sessions.filter(s => s.timestamp >= startOfDay.getTime());
        const totalTime = todaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
        return { totalTime, sessionCount: todaySessions.length, todaySessions };
    }, [sessions]);

    // Calculate Today's Balance Bar
    const balanceData = useMemo(() => {
        const { todaySessions, totalTime } = todayStats;
        if (totalTime === 0) return [];
        
        const taskDurations: Record<string, number> = {};
        todaySessions.forEach(s => {
            taskDurations[s.taskId] = (taskDurations[s.taskId] || 0) + s.duration;
        });

        return Object.entries(taskDurations)
            .map(([taskId, duration]) => {
                const task = tasks.find(t => t.id === taskId);
                return {
                    name: task ? task.name : '기타',
                    value: (duration / totalTime) * 100,
                    duration
                };
            })
            .sort((a,b) => b.value - a.value);
    }, [todayStats, tasks]);

    const rpgData = useMemo(() => {
        const system = settings.levelSystem || 'cumulative'; 
        let totalTimeForLevel = 0;
        let level = 1;
        let progressToNext = 0;

        if (system === 'cumulative') {
            totalTimeForLevel = sessions.reduce((acc, s) => acc + (s.duration || 0), 0);
            const totalHours = totalTimeForLevel / 3600;
            const targetHours = settings.targetExamHours || 3000;
            const rawLevel = (totalHours / targetHours) * 98 + 1;
            level = Math.min(99, Math.floor(rawLevel));
            progressToNext = (rawLevel - Math.floor(rawLevel)) * 100;
            if (level >= 99) progressToNext = 100;
        } else {
            const now = new Date();
            const thirtyDaysAgo = new Date(now);
            thirtyDaysAgo.setDate(now.getDate() - 30);
            const recentSessions = sessions.filter(s => new Date(s.timestamp) >= thirtyDaysAgo);
            totalTimeForLevel = recentSessions.reduce((acc, s) => acc + s.duration, 0);
            const totalHours = totalTimeForLevel / 3600;
            level = Math.min(99, Math.floor(totalHours / 5) + 1); 
            progressToNext = ((totalHours % 5) / 5) * 100;
        }

        let title = "초보 모험가";
        if (level >= 90) title = "전설적인 대현자";
        else if (level >= 70) title = "마스터 학습자";
        else if (level >= 40) title = "엘리트 수석";
        else if (level >= 20) title = "숙련된 전문가";
        else if (level >= 10) title = "성실한 노력파";
        else if (level >= 2) title = "떠오르는 유망주";

        return { level, title, progressToNext, system };
    }, [sessions, settings.levelSystem, settings.targetExamHours]);

    const dailyBadges = useMemo(() => {
        const { todaySessions, totalTime } = todayStats;
        const badges = [
            { id: 'start', name: '시작', icon: Footprints, active: false, color: 'text-emerald-500 bg-emerald-100', bg: 'bg-emerald-50' },
            { id: 'focus', name: '몰입', icon: BrainCircuit, active: false, color: 'text-indigo-500 bg-indigo-100', bg: 'bg-indigo-50' },
            { id: 'goal', name: '완주', icon: Trophy, active: false, color: 'text-amber-500 bg-amber-100', bg: 'bg-amber-50' },
            { id: 'bonus', name: '보너스', icon: Star, active: false, color: 'text-violet-500 bg-violet-100', bg: 'bg-violet-50' }
        ];

        if (todaySessions.length > 0) badges[0].active = true; 
        if (todaySessions.some(s => s.duration >= 3000)) badges[1].active = true; 
        if (dailyGoalSeconds > 0 && totalTime >= dailyGoalSeconds) badges[2].active = true; 
        
        const hasEarlyBird = todaySessions.some(s => { const h = new Date(s.timestamp).getHours(); return h >= 5 && h < 8; });
        const hasNightOwl = todaySessions.some(s => { const h = new Date(s.timestamp).getHours(); return h >= 22 || h < 2; });
        if (hasEarlyBird || hasNightOwl) badges[3].active = true;

        return badges;
    }, [todayStats, dailyGoalSeconds]);

    const timePercentage = dailyGoalSeconds > 0 ? Math.min(100, Math.round((todayStats.totalTime / dailyGoalSeconds) * 100)) : 0;
    const activeTasks = tasks.filter(t => (t.status || 'active') === 'active');
    
    const aggregatePercentage = useMemo(() => {
        if (activeTasks.length === 0) return 0;
        let totalProgressRatio = 0;
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);

        activeTasks.forEach(task => {
            const taskTodaySessions = sessions.filter(s => s.taskId === task.id && s.timestamp >= startOfToday.getTime());
            const todayAmount = taskTodaySessions.reduce((acc, s) => acc + (s.amount || 0), 0);
            let taskDailyGoal = 0;
            let ratio = 0;

            if (task.targetDate && task.totalAmount) {
                const targetDate = new Date(task.targetDate);
                targetDate.setHours(0,0,0,0);
                const diffTime = targetDate.getTime() - startOfToday.getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                
                const amountDoneBeforeToday = Math.max(0, (task.currentAmount || 0) - todayAmount);
                const amountRemainingTotal = task.totalAmount - amountDoneBeforeToday;
                const effectiveDays = Math.max(1, daysLeft);
                
                taskDailyGoal = Math.ceil(Math.max(0, amountRemainingTotal) / effectiveDays);
                
                if (taskDailyGoal > 0) {
                    ratio = Math.min(1, todayAmount / taskDailyGoal);
                } else {
                     if (task.currentAmount && task.currentAmount >= task.totalAmount) ratio = 1;
                     else ratio = 1; 
                }
            } else {
                ratio = task.totalAmount ? ((task.currentAmount || 0) / task.totalAmount) : 0;
            }
            totalProgressRatio += ratio;
        });

        return Math.round((totalProgressRatio / activeTasks.length) * 100);
    }, [activeTasks, sessions]);

    const streakStats = useMemo(() => {
        const sessionDates = new Set();
        sessions.forEach(s => {
            const d = new Date(s.timestamp);
            d.setHours(0,0,0,0);
            sessionDates.add(d.getTime());
        });

        let currentStreak = 0;
        const d = new Date();
        d.setHours(0,0,0,0);
        
        if (sessionDates.has(d.getTime())) {
            currentStreak = 1;
            d.setDate(d.getDate() - 1);
            while (sessionDates.has(d.getTime())) {
                currentStreak++;
                d.setDate(d.getDate() - 1);
            }
        } else {
            d.setDate(d.getDate() - 1);
            if (sessionDates.has(d.getTime())) {
                currentStreak = 1;
                d.setDate(d.getDate() - 1);
                while (sessionDates.has(d.getTime())) {
                    currentStreak++;
                    d.setDate(d.getDate() - 1);
                }
            }
        }

        const history = [];
        for (let i = 9; i >= 0; i--) { 
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0,0,0,0);
            const hasSession = sessionDates.has(date.getTime());
            history.push({ 
                day: date.getDate(), 
                label: ['일','월','화','수','목','금','토'][date.getDay()],
                hasSession, 
                fullDate: date 
            });
        }

        return { currentStreak, history };
    }, [sessions]);

    const getProgressColor = (rate: number) => {
        if (rate >= 100) return "#4F46E5"; 
        if (rate >= 80) return "#22C55E";  
        if (rate >= 50) return "#EAB308";  
        if (rate >= 25) return "#F97316"; 
        return "#EF4444";                 
    };

    const timeChartColor = getProgressColor(timePercentage);
    const taskChartColor = getProgressColor(aggregatePercentage);

    const getMotivationMessage = (streak: number) => {
        if (streak === 0) return "시작이 반입니다!";
        if (streak < 3) return "좋은 출발입니다!";
        if (streak < 7) return "불태우는 중!";
        if (streak < 14) return "습관 형성 중!";
        return "전설이 되어가는 중!";
    };

    const getBlockColor = (index: number, hasSession: boolean) => {
        if (!hasSession) return 'bg-gray-100 text-gray-300 border-gray-100';
        if (index < 3) return 'bg-emerald-100 text-emerald-600 border-emerald-200';
        if (index < 6) return 'bg-emerald-200 text-emerald-700 border-emerald-300';
        if (index < 9) return 'bg-emerald-400 text-white border-emerald-400';
        return 'bg-emerald-500 text-white border-emerald-500 shadow-sm shadow-emerald-200';
    };

    // --- Components ---
    const HeaderWidget = (
        <div className="bg-white p-6 pb-6 rounded-b-[2.5rem] shadow-lg shadow-gray-100/50 z-10 border-b border-gray-50 transition-all">
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-lg shadow-indigo-200 p-4">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl transition-opacity"></div>
                <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-24 h-24 bg-black opacity-10 rounded-full blur-2xl transition-opacity"></div>
                <div className="relative z-10">
                    {isHeaderCompact ? (
                        <div className="flex justify-between items-center h-6">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <span className="text-sm font-bold text-white whitespace-nowrap">
                                    {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, '0')}.{String(today.getDate()).padStart(2, '0')} ({['일', '월', '화', '수', '목', '금', '토'][today.getDay()]})
                                </span>
                                {settings.examName && (
                                    <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                                        <span className="text-xs font-bold text-indigo-100 truncate max-w-[80px] sm:max-w-[120px]">{settings.examName}</span>
                                        <span className="bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0">D-{daysLeft !== null && daysLeft > 0 ? daysLeft : (daysLeft === 0 ? 'Day' : 'End')}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                <button onClick={() => setIsHeaderCompact(false)} className="text-white/70 hover:text-white p-1"><ChevronDown size={18} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onOpenSettings(); }} className="text-white/70 hover:text-white p-1"><Settings size={18} /></button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3 py-2 animate-in fade-in slide-in-from-top-1">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col">
                                    <span className="text-indigo-200 text-[10px] font-bold mb-0.5 uppercase tracking-wider">Today & Time Left</span>
                                    <div className="flex wrap items-baseline gap-x-3 gap-y-1">
                                        <span className="text-xl font-bold text-white opacity-95">
                                            {today.getFullYear()}.{String(today.getMonth() + 1).padStart(2, '0')}.{String(today.getDate()).padStart(2, '0')} ({['일', '월', '화', '수', '목', '금', '토'][today.getDay()]})
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-sm text-indigo-300">|</span>
                                            <span className="text-2xl font-mono font-bold text-amber-300 shadow-sm">{getTimeRemaining()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setIsHeaderCompact(true)} className="text-white/70 hover:text-white p-1 bg-white/10 rounded-full"><ChevronUp size={20} /></button>
                                    <button onClick={(e) => { e.stopPropagation(); onOpenSettings(); }} className="text-white/70 hover:text-white p-1 bg-white/10 rounded-full"><Settings size={20} /></button>
                                </div>
                            </div>
                            <div className="w-full h-px bg-white/10 my-1"></div>
                            <div className="flex justify-between items-end">
                                <div className="flex flex-col min-w-0 pr-4">
                                    <span className="text-indigo-200 text-[10px] font-bold mb-1 uppercase tracking-wider">Goal</span>
                                    {settings.examName ? (
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold text-white transition-all duration-300 ${settings.examName.length > 20 ? 'text-sm' : (settings.examName.length > 12 ? 'text-base' : 'text-lg')}`}>
                                              {settings.examName}
                                            </span>
                                            <span className="bg-white/20 backdrop-blur-md px-2 py-0.5 rounded text-xs font-bold text-indigo-50 shrink-0">D-{daysLeft !== null && daysLeft > 0 ? daysLeft : (daysLeft === 0 ? 'Day' : 'End')}</span>
                                        </div>
                                    ) : (
                                        <button onClick={(e) => { e.stopPropagation(); onOpenSettings(); }} className="flex items-center gap-1 text-sm font-bold text-white/90 hover:text-white transition-colors"><Plus size={14}/> 목표 설정하기</button>
                                    )}
                                </div>
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="text-indigo-200 text-[10px] font-bold mb-1 uppercase tracking-wider">{rpgData.system === 'cumulative' ? 'Total Mastery' : 'Current Status'}</span>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-base font-bold text-white">{rpgData.title}</span>
                                        <div className="bg-amber-400 text-indigo-900 text-[10px] font-bold px-1.5 py-0.5 rounded shadow-sm">Lv.{rpgData.level}</div>
                                    </div>
                                    <div className="w-24 h-1.5 bg-black/20 rounded-full overflow-hidden relative">
                                        <div className="h-full bg-amber-400 rounded-full transition-all duration-1000" style={{width: `${rpgData.progressToNext}%`}}></div>
                                    </div>
                                    {rpgData.system === 'cumulative' && <span className="text-[9px] text-indigo-200 mt-0.5">합격권까지 {Math.round(100 - (rpgData.level/99*100))}% 남음</span>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    const StatsWidget = (
        <div className={`bg-white border border-gray-100 rounded-2xl shadow-sm mb-4 transition-all duration-300 ${isCompact ? 'p-3' : 'p-5'}`}>
            <div className={`flex justify-between items-center transition-all duration-300 ${isCompact ? 'mb-2' : 'mb-4'}`}>
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md"><Activity size={16} /></div> 오늘의 학습 현황
                </h3>
                <button onClick={() => setIsCompact(!isCompact)} className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full p-1 transition-colors">{isCompact ? <ChevronDown size={20} /> : <ChevronUp size={20} />}</button>
            </div>
            {isCompact ? (
                <div className="flex items-center justify-around animate-in fade-in slide-in-from-top-2 py-0">
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400 font-bold mb-0.5">총 학습 시간</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-gray-800 tracking-tight leading-none">{formatDurationSimple(todayStats.totalTime)}</span>
                            <span className="text-[10px] font-bold leading-none" style={{color: timeChartColor}}>({timePercentage}%)</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-gray-100 mx-2"></div>
                    <div className="flex flex-col items-center">
                        <span className="text-xs text-gray-400 font-bold mb-0.5">목표 달성률</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-bold text-gray-800 tracking-tight leading-none">{aggregatePercentage}%</span>
                            <span className="text-[10px] font-bold text-indigo-400 leading-none">(목표)</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-2">
                            <div className="mb-2"><SimpleCircularProgress percentage={timePercentage} text={formatDurationSimple(todayStats.totalTime)} size={110} strokeWidth={8} textSize="text-xl" subTextSize="text-[10px]" color={timeChartColor}/></div>
                            <span className="text-sm text-gray-400 font-bold">총 학습 시간</span>
                        </div>
                        <div className="flex flex-col items-center justify-center p-2">
                            <div className="mb-2"><SimpleCircularProgress percentage={aggregatePercentage} text={`${aggregatePercentage}%`} size={110} strokeWidth={8} textSize="text-xl" subTextSize="text-[10px]" color={taskChartColor}/></div>
                            <span className="text-sm text-gray-400 font-bold">목표 달성률</span>
                        </div>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                        <div className="flex justify-between items-end mb-2"><span className="text-xs font-bold text-gray-500">오늘의 학습 밸런스</span>{todayStats.totalTime > 0 && <span className="text-[10px] text-gray-400 font-medium">과목별 비중</span>}</div>
                        {balanceData.length > 0 ? (<div className="flex w-full h-3 rounded-full overflow-hidden">{balanceData.map((item, idx) => (<div key={idx} style={{width: `${item.value}%`, backgroundColor: COLORS[idx % COLORS.length]}} className="h-full" title={`${item.name}: ${Math.round(item.value)}%`}></div>))}</div>) : (<div className="w-full h-3 bg-gray-200 rounded-full"></div>)}
                        {balanceData.length > 0 && (<div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar">{balanceData.slice(0, 3).map((item, idx) => (<div key={idx} className="flex items-center gap-1 shrink-0"><div className="w-1.5 h-1.5 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}} shadow-sm></div><span className="text-[10px] text-gray-500 font-bold truncate max-w-[60px]">{item.name}</span></div>))}</div>)}
                    </div>
                </div>
            )}
        </div>
    );

    const StreakWidget = (
        <div className={`bg-white border border-gray-100 shadow-sm relative overflow-hidden group transition-all duration-300 ${isStreakCompact ? 'p-4 rounded-2xl' : 'p-5 rounded-2xl'} mb-4`}>
            <div className={`flex justify-between items-center ${isStreakCompact ? '' : 'mb-5'}`}>
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isStreakCompact ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'}`}><Zap size={18} fill={isStreakCompact ? "currentColor" : "none"} /></div>
                    <div><h3 className="font-bold text-gray-800 text-sm">연속 학습 & 배지</h3>{!isStreakCompact && <p className="text-[10px] text-gray-400 font-medium">매일매일 꾸준히!</p>}</div>
                </div>
                <div className="flex items-center gap-2">
                    {!isStreakCompact && (<button onClick={() => setView('stats')} className="text-xs font-bold text-gray-400 hover:text-indigo-600 flex items-center transition-colors">리포트 <ArrowRight size={12} className="ml-1" /></button>)}
                    <button onClick={() => setIsStreakCompact(!isStreakCompact)} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-50 transition-colors">{isStreakCompact ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
                </div>
            </div>
            {!isStreakCompact ? (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-end justify-between mb-6 px-1"><div><span className="text-3xl font-bold text-gray-800 tracking-tight">{streakStats.currentStreak}</span><span className="text-lg font-bold text-gray-400 ml-1">일째</span></div><div className="bg-indigo-50 px-3 py-1.5 rounded-lg"><span className="text-xs font-bold text-indigo-600">{getMotivationMessage(streakStats.currentStreak)}</span></div></div>
                    <div className="flex justify-between gap-1 mb-6">{streakStats.history.map((day, idx) => { const isToday = idx === 9; return (<div key={idx} className="flex flex-col items-center gap-2 flex-1 min-w-0"><span className={`text-[10px] font-bold truncate w-full text-center ${isToday ? 'text-indigo-600' : 'text-gray-300'}`}>{day.label}</span><div className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold border transition-all ${getBlockColor(idx, day.hasSession)} ${isToday ? 'ring-2 ring-indigo-500 ring-offset-2 scale-105 shadow-md' : ''}`}>{day.day}</div></div>) })}</div>
                    <div className="border-t border-gray-100 pt-4"><p className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">Daily Quests <span className="text-[10px] font-normal text-gray-400">(오늘의 배지)</span></p><div className="flex justify-between gap-2">{dailyBadges.map((badge) => (<div key={badge.id} className="flex flex-col items-center gap-1 flex-1"><div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${badge.active ? `${badge.color} border-transparent shadow-md transform scale-105` : 'bg-gray-50 border-dashed border-gray-200 text-gray-300'}`}><badge.icon size={20} fill={badge.active ? "currentColor" : "none"} strokeWidth={2} /></div><span className={`text-[10px] font-bold ${badge.active ? 'text-gray-700' : 'text-gray-300'}`}>{badge.name}</span></div>))}</div></div>
                </div>
            ) : (<div className="mt-2 flex items-center justify-between bg-gray-50 p-3 rounded-xl"><span className="text-xs font-bold text-gray-500">현재 기록</span><span className="text-sm font-bold text-emerald-600 flex items-center gap-1">🔥 {streakStats.currentStreak}일</span></div>)}
        </div>
    );

    const TasksWidget = (
        <div className="mt-4 mx-1.5 bg-gray-100/70 p-4 rounded-[2rem] border border-gray-100/50 mb-8 shadow-inner animate-in fade-in duration-500">
            <div className="flex justify-between items-center mb-5 px-1">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-600" /> 오늘의 학습 과목
                </h3>
                <button onClick={() => setView('tasks')} className="text-xs font-bold text-gray-400 hover:text-indigo-600 transition-colors">전체보기</button>
            </div>
            {activeTasks.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center border border-dashed border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                    <p className="text-gray-400 text-sm mb-4 font-medium">등록된 학습 목표가 없습니다.</p>
                    <button onClick={onNavigateToCreateTask} className="px-5 py-2.5 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors shadow-sm border border-indigo-100">+ 목표 추가하기</button>
                </div>
            ) : (
                <div className="flex flex-col gap-3 pb-2">
                    {activeTasks.map((task, index) => {
                        const todayDayName = ['일', '월', '화', '수', '목', '금', '토'][today.getDay()];
                        const startOfToday = new Date(); startOfToday.setHours(0,0,0,0);
                        const taskTodaySessions = sessions.filter(s => s.taskId === task.id && s.timestamp >= startOfToday.getTime());
                        const todayAmount = taskTodaySessions.reduce((acc, s) => acc + (s.amount || 0), 0);
                        
                        let status: 'learning' | 'supplementary' | 'rest' = 'rest';
                        if (task.repeatDays && task.repeatDays.length > 0) {
                            if (task.repeatDays.includes(todayDayName)) status = 'learning';
                            else if (task.repeatDays.includes(`${todayDayName}(보충)`)) status = 'supplementary';
                        } else {
                            status = 'learning'; 
                        }

                        const taskTotalSeconds = taskTodaySessions.reduce((acc, s) => acc + (s.duration || 0), 0);
                        
                        const formatTaskTimeDigit = (sec: number) => {
                            const h = Math.floor(sec / 3600);
                            const m = Math.floor((sec % 3600) / 60);
                            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                        };

                        const statusConfig = {
                            learning: { badge: 'bg-indigo-100 text-indigo-700', label: '오늘 학습' },
                            supplementary: { badge: 'bg-amber-100 text-amber-700', label: '보충 필요' },
                            rest: { badge: 'bg-emerald-50 text-emerald-600', label: '휴식일' }
                        };
                        const currentStatusConfig = statusConfig[status];

                        let theme = { bg: '', text: '', bar: '', barFill: '', icon: '', border: '' };
                        if (status === 'learning') {
                            theme = {
                                bg: 'bg-white',
                                text: 'text-indigo-600',
                                bar: 'bg-indigo-50',
                                barFill: 'bg-indigo-600',
                                icon: 'bg-indigo-50 text-indigo-600',
                                border: 'border-indigo-100'
                            };
                        } else if (status === 'supplementary') {
                            theme = {
                                bg: 'bg-white',
                                text: 'text-amber-700',
                                bar: 'bg-amber-50',
                                barFill: 'bg-amber-500',
                                icon: 'bg-amber-50 text-amber-600',
                                border: 'border-amber-200'
                            };
                        } else { 
                            theme = {
                                bg: 'bg-white',
                                text: 'text-slate-400',
                                bar: 'bg-slate-50',
                                barFill: 'bg-slate-400',
                                icon: 'bg-slate-50 text-slate-400',
                                border: 'border-slate-100'
                            };
                        }
                        
                        let displayPercentage = 0; 
                        let displayText = "";
                        
                        if (task.targetDate && task.totalAmount) {
                            const targetDate = new Date(task.targetDate); targetDate.setHours(0,0,0,0);
                            const diffTime = targetDate.getTime() - startOfToday.getTime(); const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            const amountDoneBeforeToday = Math.max(0, (task.currentAmount || 0) - todayAmount); const amountRemainingTotal = task.totalAmount - amountDoneBeforeToday;
                            const effectiveDays = Math.max(1, daysLeft); const dailyGoal = Math.ceil(Math.max(0, amountRemainingTotal) / effectiveDays);
                            if (dailyGoal > 0) { displayPercentage = Math.round((todayAmount / dailyGoal) * 100); displayText = `${todayAmount}/${dailyGoal} ${task.unit}`; } else { if (task.currentAmount && task.currentAmount >= task.totalAmount) { displayPercentage = 100; displayText = "완료!"; } else { displayPercentage = 100; displayText = `완료`; } }
                        } else { displayPercentage = task.totalAmount ? Math.round(((task.currentAmount || 0) / task.totalAmount) * 100) : 0; displayText = `${task.currentAmount}/${task.totalAmount} ${task.unit}`; }
                        
                        return (
                            <div 
                                key={task.id} 
                                onClick={() => onViewTaskDetails(task)} 
                                className={`relative flex flex-row rounded-3xl transition-all shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer bg-white border border-gray-100 overflow-hidden min-h-[105px]`}
                            >
                                <div className={`w-1.5 h-full ${theme.barFill} shrink-0`} />

                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    <div className="flex justify-between items-start w-full">
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h4 className="font-bold text-gray-800 text-base leading-tight truncate max-w-[160px] sm:max-w-[220px]">
                                                    {task.name}
                                                </h4>
                                                <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${currentStatusConfig.badge} whitespace-nowrap`}>
                                                    {currentStatusConfig.label}
                                                </div>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setActiveTask(task); }}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${theme.icon} hover:scale-110 active:scale-95 shrink-0`}
                                        >
                                            <Play size={14} fill="currentColor" className="ml-0.5" />
                                        </button>
                                    </div>

                                    <div className="my-1.5">
                                        <div className={`w-full h-1.5 rounded-full ${theme.bar}`}>
                                            <div className={`h-full rounded-full transition-all duration-1000 ${theme.barFill}`} style={{ width: `${Math.min(100, displayPercentage)}%` }}></div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className={`text-xl font-black ${theme.text} leading-none flex items-baseline`}>
                                            {displayPercentage}<span className="text-[10px] font-bold opacity-50 ml-0.5">%</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gray-50/80 border border-gray-100 shadow-sm">
                                            <span className="text-[11px] font-bold text-gray-700 truncate max-w-[100px]">{displayText}</span>
                                            <div className="w-px h-2.5 bg-black/10"></div>
                                            <div className="flex items-center gap-1">
                                                <Clock size={11} strokeWidth={2.5} className="text-gray-500" />
                                                <span className="text-[11px] font-extrabold font-mono tracking-tight text-gray-800">{formatTaskTimeDigit(taskTotalSeconds)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onNavigateToCreateTask(); }} 
                        className="flex items-center justify-center p-4 rounded-3xl border-2 border-dashed border-gray-200 bg-white/50 hover:border-indigo-300 hover:bg-white transition-all text-gray-400 hover:text-indigo-500 group w-full min-h-[60px]"
                    >
                        <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-indigo-50 flex items-center justify-center mr-3 transition-colors">
                            <Plus size={18} />
                        </div>
                        <span className="text-sm font-bold">새 과목 추가하기</span>
                    </button>
                </div>
            )}
        </div>
    );

    const widgetComponents: any = {
        'header': HeaderWidget,
        'stats': StatsWidget,
        'streak': StreakWidget,
        'tasks': TasksWidget
    };

    const currentOrder = settings.todayWidgetOrder || ['header', 'stats', 'streak', 'tasks'];

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('index', index.toString());
        (e.target as HTMLElement).style.opacity = '0.5';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('index'));
        (e.target as HTMLElement).style.opacity = '1'; 
        
        if (dragIndex !== dropIndex) {
            const newOrder = [...currentOrder];
            const [removed] = newOrder.splice(dragIndex, 1);
            newOrder.splice(dropIndex, 0, removed);
            onUpdateSettings({ ...settings, todayWidgetOrder: newOrder });
        }
    };

    const handleDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).style.opacity = '1';
    };

    return (
        <div className="h-full bg-gray-50 flex flex-col overflow-y-auto pb-24 no-scrollbar">
            {currentOrder.map((key, index) => {
                if (!settings.todayWidgets?.[key as keyof typeof settings.todayWidgets]) return null;
                return (
                    <div 
                        key={key}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        className="relative group transition-transform duration-200 ease-out"
                    >
                        <div className="absolute top-2 left-2 z-20 p-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing bg-white/50 backdrop-blur-sm rounded-md">
                            <GripHorizontal size={16} />
                        </div>
                        {widgetComponents[key]}
                    </div>
                );
            })}

            <div className="text-center py-6 text-xs text-gray-300 font-bold uppercase tracking-[0.3em]">
                StudyFlow v2.5.3 Cloud Sync
            </div>
        </div>
    );
}
