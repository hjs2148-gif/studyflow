
import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, PieChart as PieChartIcon, Target, BarChart2, Award, BrainCircuit, Clock, TrendingUp, Hexagon, Zap, Trophy, Flag, CheckCircle, Star, Sunrise, Moon, Footprints, Flame, Settings as SettingsIcon, GripHorizontal, Crown, Lock, X, Info, ArrowUpRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, AreaChart, Area, CartesianGrid, XAxis, YAxis, Legend, BarChart, Bar, ScatterChart, Scatter, ZAxis, ReferenceLine, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { CollapsibleCard } from '../components/Common';
import { AIModal, AIMenuModal, LevelAnalysisModal, RPGStatsModal } from '../components/Modals';
import { callGemini } from '../services/geminiService';
import { Task, Session, Settings } from '../types';

interface StatsViewProps {
    tasks: Task[];
    sessions: Session[];
    settings: Settings;
    user?: any;
    db?: any;
    appId?: string;
    onOpenSettings?: () => void;
    onUpdateSettings: (s: Settings) => void;
}

const formatDurationSimple = (seconds: number) => {
    if (!seconds) return "0분";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
};

const formatTime = (seconds: number) => {
    if (seconds === undefined || seconds === null) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h > 0 
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const getStatsData = (
  tasks: Task[],
  sessions: Session[],
  settings: Settings,
  viewMode: 'daily' | 'weekly' | 'monthly',
  currentDate: Date
) => {
  const dailyGoalSeconds = (settings.dailyGoalMinutes || 480) * 60;
  let start: Date, end: Date, title: string;
  const y = currentDate.getFullYear();
  const m = currentDate.getMonth();
  const d = currentDate.getDate();

  if (viewMode === 'daily') {
      start = new Date(y, m, d);
      end = new Date(y, m, d + 1);
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      title = `${y}. ${String(m + 1).padStart(2, '0')}.${String(d).padStart(2, '0')} (${days[new Date(y, m, d).getDay()]})`;
  } else if (viewMode === 'weekly') {
      const day = currentDate.getDay();
      const diff = currentDate.getDate() - day + (day === 0 ? -6 : 1); 
      start = new Date(currentDate); start.setDate(diff); start.setHours(0,0,0,0);
      end = new Date(start); end.setDate(start.getDate() + 7);
      title = `${start.getMonth()+1}.${start.getDate()} - ${end.getMonth()+1}.${end.getDate()}`;
  } else { 
      start = new Date(y, m, 1);
      end = new Date(y, m + 1, 1);
      title = `${y}년 ${m + 1}월`;
  }

  const filteredSessions = sessions.filter(s => { const dt = new Date(s.timestamp); return dt >= start && dt < end; });
  const totalTime = filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
  
  let goalSeconds = dailyGoalSeconds;
  if (viewMode === 'weekly') goalSeconds *= 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  if (viewMode === 'monthly') goalSeconds = dailyGoalSeconds * daysInMonth; 
  
  const achievementRate = goalSeconds > 0 ? Math.min(100, Math.round((totalTime / goalSeconds) * 100)) : 0;
  
  const taskStats: Record<string, { duration: number }> = {};
  filteredSessions.forEach(s => {
      if (!taskStats[s.taskId]) taskStats[s.taskId] = { duration: 0 };
      taskStats[s.taskId].duration += s.duration;
  });

  const pieData = Object.keys(taskStats).map(tid => {
      const t = tasks.find(tk => tk.id === tid);
      const duration = taskStats[tid].duration;
      const percent = totalTime > 0 ? (duration / totalTime) : 0; 
      return { name: t ? t.name : '기타', value: duration, percent: Math.round(percent * 100) / 100, displayPercent: Math.round(percent * 100) };
  }).filter(d => d.value > 0).sort((a, b) => b.value - a.value);

  const top5Data = tasks
      .filter(t => (t.status || 'active') === 'active') 
      .map(t => ({
          name: t.name,
          rate: t.totalAmount ? Math.round((t.currentAmount / t.totalAmount) * 100) : 0
      }))
      .sort((a,b) => b.rate - a.rate)
      .slice(0, 5);

  let bestSubject = "없음";
  let bestDay = "없음";
  let maxSessionTime = 0;
  
  if (filteredSessions.length > 0) {
      let maxDuration = 0;
      let bestTaskId = "";
      Object.keys(taskStats).forEach(tid => {
          if (taskStats[tid].duration > maxDuration) {
              maxDuration = taskStats[tid].duration;
              bestTaskId = tid;
          }
      });
      const bestTask = tasks.find(t => t.id === bestTaskId);
      bestSubject = bestTask ? bestTask.name : "기타";
      
      maxSessionTime = Math.max(...filteredSessions.map(s => s.duration));

      const dayDuration: Record<number, number> = {};
      filteredSessions.forEach(s => {
          const d = new Date(s.timestamp).getDay();
          dayDuration[d] = (dayDuration[d] || 0) + s.duration;
      });
      let maxDayDuration = 0;
      let maxDayIndex = -1;
      Object.keys(dayDuration).forEach(dayIndex => {
           if (dayDuration[Number(dayIndex)] > maxDayDuration) {
               maxDayDuration = dayDuration[Number(dayIndex)];
               maxDayIndex = Number(dayIndex);
           }
      });
      if (maxDayIndex !== -1) {
          bestDay = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][maxDayIndex];
      }
  }

  return { title, totalTime, achievementRate, pieData, top5Data, start, end, bestSubject, bestDay, filteredSessions, maxSessionTime };
};

export const StatsView: React.FC<StatsViewProps> = ({ tasks, sessions, settings, user, db, appId, onOpenSettings, onUpdateSettings }) => {
    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');  
    const [currentDate, setCurrentDate] = useState(new Date());
    const [aiLoading, setAiLoading] = useState(false);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showAIMenu, setShowAIMenu] = useState(false);
    const [aiContent, setAiContent] = useState("");
    const [showLevelAnalysis, setShowLevelAnalysis] = useState(false); 
    const [showRPGModal, setShowRPGModal] = useState(false);
    const [selectedBadge, setSelectedBadge] = useState<any>(null);
  
    const navigateDate = (direction: number) => {
      const newDate = new Date(currentDate);
      if (viewMode === 'daily') newDate.setDate(currentDate.getDate() + direction);
      if (viewMode === 'weekly') newDate.setDate(currentDate.getDate() + (direction * 7));
      if (viewMode === 'monthly') newDate.setMonth(currentDate.getMonth() + direction);
      setCurrentDate(newDate);
    };
  
    const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];
    const GRADIENTS = [
        ['#6366f1', '#4f46e5'],
        ['#34d399', '#10b981'],
        ['#fbbf24', '#f59e0b'],
        ['#f87171', '#ef4444'],
        ['#a78bfa', '#8b5cf6'],
    ];

    const dailyGoalSeconds = useMemo(() => (settings.dailyGoalMinutes || 480) * 60, [settings.dailyGoalMinutes]);
  
    const statsData = useMemo(() => getStatsData(tasks, sessions, settings, viewMode, currentDate), [tasks, sessions, settings, viewMode, currentDate]);
    
    // v2.4.9 Smart Grouping Logic
    const processedPieData = useMemo(() => {
        const raw = statsData.pieData;
        if (raw.length <= 5) return raw;
        const top4 = raw.slice(0, 4);
        const othersValue = raw.slice(4).reduce((acc, curr) => acc + curr.value, 0);
        const othersPercent = raw.slice(4).reduce((acc, curr) => acc + curr.percent, 0);
        const othersDisplayPercent = raw.slice(4).reduce((acc, curr) => acc + curr.displayPercent, 0);
        return [...top4, { name: '기타 과목', value: othersValue, percent: othersPercent, displayPercent: othersDisplayPercent, isOthers: true }];
    }, [statsData.pieData]);

    const metacognitionData = useMemo(() => { return sessions.filter(s => s.predictedFocus !== undefined && s.actualFocus !== undefined).map(s => ({ x: s.predictedFocus, y: s.actualFocus, z: 1 })); }, [sessions]);
    const metacognitionInsight = useMemo(() => { if (metacognitionData.length < 3) return "데이터가 더 필요합니다."; let sumDiff = 0; metacognitionData.forEach(d => { sumDiff += (d.x! - d.y!); }); const avgDiff = sumDiff / metacognitionData.length; if (avgDiff > 1) return "자신의 집중력을 과대평가하는 경향이 있습니다. (학습 착각 주의)"; if (avgDiff < -1) return "자신을 과소평가하고 있습니다. 더 자신감을 가지세요!"; return "예측과 실제가 거의 일치합니다. 훌륭한 메타인지 능력입니다!"; }, [metacognitionData]);
    
    const bentoBadges = useMemo(() => {
        const { filteredSessions } = statsData;
        const hasStarted = filteredSessions.length > 0;
        const hasEarlyBird = filteredSessions.some(s => { const h = new Date(s.timestamp).getHours(); return h >= 5 && h < 8; });
        const hasNightOwl = filteredSessions.some(s => { const h = new Date(s.timestamp).getHours(); return h >= 22 || h < 2; });
        const hasDeepWork = filteredSessions.some(s => s.duration >= 3000); 
        const hasConsistency = filteredSessions.length >= 3; 
        const isGoalAchieved = statsData.achievementRate >= 100;

        return [
            { id: 'start', label: '시작이 반', description: '기간 내에 최소 1회 이상 학습을 기록했습니다.', icon: Footprints, unlocked: hasStarted, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
            { id: 'morning', label: '미라클 모닝', description: '오전 5시 ~ 8시 사이에 학습을 진행했습니다.', icon: Sunrise, unlocked: hasEarlyBird, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' },
            { id: 'night', label: '새벽 몰입', description: '밤 10시 ~ 새벽 2시 사이에 학습을 진행했습니다.', icon: Moon, unlocked: hasNightOwl, color: 'text-violet-500', bg: 'bg-violet-50', border: 'border-violet-100' },
            { id: 'focus', label: '딥 워크', description: '한 번의 세션에서 50분 이상 끊김 없이 집중했습니다.', icon: BrainCircuit, unlocked: hasDeepWork, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
            { id: 'consistent', label: '꾸준함', description: '기간 내에 3회 이상의 학습 세션을 완료했습니다.', icon: Zap, unlocked: hasConsistency, color: 'text-blue-500', bg: 'bg-blue-50', border: 'border-blue-100' },
            { id: 'goal', label: '목표 달성', description: '설정된 목표 학습 시간을 100% 달성했습니다.', icon: Trophy, unlocked: isGoalAchieved, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
        ];
    }, [statsData]);

    const progressComparisonData = useMemo(() => { const { start, end } = statsData; let comparisonData = []; let cumulativeActualTime = 0; let cumulativeIdealTime = 0; const todayEnd = new Date().setHours(23, 59, 59, 999); let totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)); const periodGoalSeconds = totalDays * dailyGoalSeconds; for (let i = 0; i < totalDays; i++) { const day = new Date(start); day.setDate(start.getDate() + i); const dayStart = day.setHours(0, 0, 0, 0); let actualTimeForDay = 0; sessions.filter(s => new Date(s.timestamp).setHours(0, 0, 0, 0) === dayStart).forEach(s => { actualTimeForDay += (s.duration || 0); }); cumulativeActualTime += actualTimeForDay; if (dayStart <= todayEnd) { cumulativeIdealTime += dailyGoalSeconds; } const actualRate = periodGoalSeconds > 0 ? Math.min(100, Math.round((cumulativeActualTime / periodGoalSeconds) * 100)) : 0; const idealRate = periodGoalSeconds > 0 ? Math.min(100, Math.round((cumulativeIdealTime / periodGoalSeconds) * 100)) : 0; comparisonData.push({ name: viewMode === 'monthly' ? `${day.getMonth() + 1}/${day.getDate()}` : ['일','월','화','수','목','금','토'][day.getDay()], actual: actualRate, ideal: idealRate, }); } return comparisonData; }, [statsData, dailyGoalSeconds, sessions, viewMode]);
    const chartData = useMemo(() => { const data = []; if (viewMode === 'daily') { const base = new Date(currentDate); for(let i=6; i>=0; i--) { const d = new Date(base); d.setDate(base.getDate() - i); d.setHours(0,0,0,0); let timeVal = 0; sessions.forEach(s => { const sd = new Date(s.timestamp); sd.setHours(0,0,0,0); if(sd.getTime() === d.getTime()) timeVal += (s.duration || 0); }); const rate = dailyGoalSeconds > 0 ? Math.min(200, Math.round((timeVal / dailyGoalSeconds) * 100)) : 0; data.push({ name: ['일','월','화','수','목','금','토'][d.getDay()], rate }); } } else if (viewMode === 'weekly') { const targetWeekEnd = new Date(statsData.end); const weeklyGoal = dailyGoalSeconds * 7; for(let i=3; i>=0; i--) { const weekEnd = new Date(targetWeekEnd); weekEnd.setDate(targetWeekEnd.getDate() - (i * 7)); const weekStart = new Date(weekEnd); weekStart.setDate(weekStart.getDate() - 7); let timeVal = 0; sessions.forEach(s => { const sd = new Date(s.timestamp); if (sd >= weekStart && sd < weekEnd) timeVal += (s.duration || 0); }); const rate = weeklyGoal > 0 ? Math.min(200, Math.round((timeVal / weeklyGoal) * 100)) : 0; const label = i === 0 ? "이번주" : `${i}주전`; data.push({ name: label, rate }); } } else { const base = new Date(currentDate); const startMonth = new Date(base.getFullYear(), base.getMonth() - 5, 1); for (let i = 0; i < 6; i++) { const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1); const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1); const daysInMonth = d.getFullYear() ? new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() : 30; const monthlyGoal = dailyGoalSeconds * daysInMonth; let timeVal = 0; sessions.forEach(s => { const sd = new Date(s.timestamp); if (sd >= d && sd < nextMonth) timeVal += (s.duration || 0); }); const rate = monthlyGoal > 0 ? Math.min(200, Math.round((timeVal / monthlyGoal) * 100)) : 0; data.push({ name: `${d.getMonth() + 1}월`, rate }); } } return data; }, [sessions, currentDate, viewMode, dailyGoalSeconds, statsData]); 
    
    const handleAnalyze = async (period: 'daily' | 'weekly' | 'monthly', targetDate?: Date) => { 
        setShowAIMenu(false); setAiLoading(true); setShowAIModal(true); 
        const dateToUse = targetDate || currentDate; 
        const data = getStatsData(tasks, sessions, settings, period, dateToUse); 
        const topSubjects = [...data.pieData].sort((a, b) => b.value - a.value).slice(0, 3).map(d => `${d.name}(${formatDurationSimple(d.value)})`).join(', '); 
        const prompt = `당신은 AI 코치입니다. 기간:${data.title}, 시간:${formatDurationSimple(data.totalTime)}, 과목:${topSubjects}. 데이터 분석과 칭찬, 솔루션을 마크다운으로 짧게 적어줘.`; 
        const result = await callGemini(prompt); setAiContent(result); setAiLoading(false); 
    };

    const handleGenerateJourney = async (period: 'daily' | 'weekly' | 'monthly', targetDate?: Date) => { const dateToUse = targetDate || currentDate; const data = getStatsData(tasks, sessions, settings, period, dateToUse); const prompt = `기간:${data.title}, 시간:${formatDurationSimple(data.totalTime)}, 최애:${data.bestSubject}. 칭호와 따뜻한 한마디를 칭호: [칭호] 내용: [내용] 형식으로 줘.`; const result = await callGemini(prompt); const titleMatch = result.match(/칭호:\s*(.*)/); const narrativeMatch = result.replace(/칭호:.*\n?/, '').replace(/내용:\s*/, '').trim(); return { title: titleMatch ? titleMatch[1] : "열정 학습자", narrative: narrativeMatch || result, bestSubject: data.bestSubject, bestDay: data.bestDay, periodTitle: data.title }; };
    const handleAnalyzePattern = async (type: 'focus' | 'time', period: 'daily' | 'weekly' | 'monthly', targetDate?: Date) => { const dateToUse = targetDate || currentDate; const data = getStatsData(tasks, sessions, settings, period, dateToUse); const { filteredSessions } = data; if (type === 'focus') { let deep = 0, norm = 0, brief = 0; filteredSessions.forEach(s => { const mins = s.duration / 60; if (mins >= 30) deep++; else if (mins >= 10) norm++; else brief++; }); const chartData = [ { name: '깊은 몰입', value: deep, color: '#4F46E5' }, { name: '일반', value: norm, color: '#10B981' }, { name: '짧은 집중', value: brief, color: '#F59E0B' } ].filter(d => d.value > 0); return { type, data: chartData, insight: "호흡이 안정적입니다.", periodTitle: data.title }; } else { const hours = Array(24).fill(0).map((_, i) => ({ hour: i, duration: 0 })); filteredSessions.forEach(s => { const h = new Date(s.timestamp).getHours(); hours[h].duration += (s.duration / 60); }); return { type, data: hours, insight: "집중 시간대 분석 완료.", periodTitle: data.title, bestHour: 10 }; } };

    // v2.5.3 Enhanced Custom Label Component (Multi-line Support)
    const renderCustomizedLabel = (props: any) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, percent, value, name, fill } = props;
        
        // 5% threshold optimization
        if (percent < 0.05) return null;

        const RADIAN = Math.PI / 180;
        const sin = Math.sin(-RADIAN * midAngle);
        const cos = Math.cos(-RADIAN * midAngle);
        
        // Points for the line path
        const sx = cx + (outerRadius + 2) * cos;
        const sy = cy + (outerRadius + 2) * sin;
        const mx = cx + (outerRadius + 22) * cos;
        const my = cy + (outerRadius + 22) * sin;
        const ex = mx + (cos >= 0 ? 1 : -1) * 16;
        const ey = my;
        
        const textAnchor = cos >= 0 ? 'start' : 'end';

        // Time Formatting (HH시간 MM분)
        const hours = Math.floor(value / 3600);
        const mins = Math.floor((value % 3600) / 60);
        const timeStr = hours > 0 ? `${hours}시간 ${mins}분` : `${mins}분`;
        const displayPercent = Math.round(percent * 100);

        // Smart name splitting logic (7 characters max per line)
        const nameLine1 = name.length > 7 ? name.slice(0, 7) : name;
        const nameLine2 = name.length > 7 ? name.slice(7) : "";
        const isTwoLine = nameLine2.length > 0;

        return (
            <g>
                {/* Connector Path */}
                <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} strokeWidth={1.5} fill="none" />
                {/* End point dot */}
                <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
                
                {/* Subject Name Line 1 */}
                <text 
                    x={ex + (cos >= 0 ? 1 : -1) * 6} 
                    y={ey} 
                    dy={isTwoLine ? -14 : -4} 
                    textAnchor={textAnchor} 
                    fill="#1F2937" 
                    style={{ fontSize: '11px', fontWeight: 900 }}
                >
                    {nameLine1}
                </text>
                
                {/* Subject Name Line 2 (If exists) */}
                {isTwoLine && (
                    <text 
                        x={ex + (cos >= 0 ? 1 : -1) * 6} 
                        y={ey} 
                        dy={-2} 
                        textAnchor={textAnchor} 
                        fill="#1F2937" 
                        style={{ fontSize: '11px', fontWeight: 900 }}
                    >
                        {nameLine2}
                    </text>
                )}
                
                {/* Stats row */}
                <text 
                    x={ex + (cos >= 0 ? 1 : -1) * 6} 
                    y={ey} 
                    dy={isTwoLine ? 14 : 12} 
                    textAnchor={textAnchor} 
                    fill="#4B5563" 
                    style={{ fontSize: '9px', fontWeight: 700 }}
                >
                    {`${timeStr} (${displayPercent}%)`}
                </text>
            </g>
        );
    };

    const widgetComponents: any = {
        'time': (
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm mb-4 relative overflow-hidden">
                 <div className="p-7 pb-2 flex justify-between items-center">
                    <h3 className="font-black text-gray-800 text-sm flex items-center gap-2">
                        <PieChartIcon size={16} className="text-indigo-500" /> 오늘 나의 지식 궤도
                    </h3>
                    <div className="bg-indigo-50 px-2 py-1 rounded-lg">
                        <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Dynamic Balance</span>
                    </div>
                 </div>
                 <div className="px-7 pb-8">
                    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
                        
                        {/* 1. Interactive Glowing Donut Area */}
                        <div className="h-72 relative flex items-center justify-center mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <defs>
                                        {GRADIENTS.map((g, i) => (
                                            <linearGradient key={`grad-${i}`} id={`grad-${i}`} x1="0" y1="0" x2="1" y2="1">
                                                <stop offset="0%" stopColor={g[0]} />
                                                <stop offset="100%" stopColor={g[1]} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <Pie 
                                        data={processedPieData.length > 0 ? processedPieData : [{name:'-', value:1, percent: 1}]} 
                                        cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} 
                                        dataKey="value" startAngle={90} endAngle={-270}
                                        stroke="none"
                                        label={renderCustomizedLabel}
                                        labelLine={false}
                                        animationBegin={0} animationDuration={1200} animationEasing="ease-out"
                                    >
                                        {processedPieData.length > 0 ? processedPieData.map((e, i) => (
                                            <Cell key={i} fill={`url(#grad-${i % GRADIENTS.length})`} style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.05))' }} />
                                        )) : <Cell fill="#F3F4F6" />}
                                    </Pie>
                                    <ReTooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-xl border border-gray-100 animate-in zoom-in-95">
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-tighter mb-0.5">{payload[0].name}</p>
                                                        <p className="text-sm font-black text-indigo-600">{formatDurationSimple(Number(payload[0].value))}</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center animate-in fade-in duration-1000 delay-500">
                                {processedPieData.length > 0 ? (
                                    <>
                                        <div className="bg-indigo-50 p-2 rounded-full mb-1">
                                            <Clock size={16} className="text-indigo-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Total Effort</span>
                                            <span className="text-xl font-black text-gray-900 leading-tight">
                                                {formatDurationSimple(statsData.totalTime)}
                                            </span>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center opacity-30">
                                        <BrainCircuit size={32} className="text-gray-300 mb-2"/>
                                        <span className="text-[10px] font-black text-gray-400 uppercase">Awaiting Data</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. Insight Text Badge */}
                        <div className="bg-gray-50/80 border border-gray-100 px-5 py-4 rounded-[1.5rem] flex flex-col gap-1.5 transition-all hover:bg-white shadow-inner">
                            <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-indigo-500" />
                                <span className="text-[11px] font-black text-gray-700 uppercase tracking-tighter">AI Quick Analysis</span>
                            </div>
                            <p className="text-xs font-bold text-gray-500 leading-relaxed">
                                {processedPieData.length > 0 
                                    ? (processedPieData[0].displayPercent > 50 
                                        ? `현재 ${statsData.bestSubject} 과목에 놀라운 집중력을 보여주고 계시네요! 다른 과목과의 밸런스도 체크해보세요.` 
                                        : "여러 과목을 아주 균형 있게 학습하고 있습니다. 지금의 흐름을 유지하는 것이 중요합니다.") 
                                    : "오늘의 학습을 시작하고 나만의 오빗을 완성해보세요!"}
                            </p>
                        </div>

                        {/* 3. Detailed Orbit Legend List */}
                        <div className="space-y-2">
                            {processedPieData.length === 0 ? (
                                <p className="text-center text-xs text-gray-400 py-4 font-bold opacity-50">기록된 학습 궤도가 없습니다.</p>
                            ) : (
                                processedPieData.map((e, i) => (
                                    <div key={i} className="flex items-center justify-between bg-white px-5 py-4 rounded-[1.5rem] border border-gray-50 group hover:border-indigo-200 transition-all shadow-sm hover:shadow-md active:scale-[0.98]">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-4 h-4 rounded-full shrink-0 shadow-sm" style={{backgroundColor: COLORS[i % COLORS.length]}}></div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-black text-gray-800 truncate">{e.name}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold text-gray-400">{formatDurationSimple(e.value)}</span>
                                                    {!e.isOthers && (
                                                        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-indigo-50 text-indigo-500 rounded-md">
                                                            <ArrowUpRight size={8} strokeWidth={3} />
                                                            <span className="text-[8px] font-black uppercase">Rising</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <div className="bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200 shadow-inner group-hover:bg-indigo-600 group-hover:border-indigo-500 transition-colors">
                                                <span className="text-[10px] font-black text-gray-500 group-hover:text-white">{e.displayPercent}%</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                 </div>
            </div>
        ),
        'wins': (<CollapsibleCard title="작은 승리의 수집" icon={Star} color="text-amber-500"><div className="grid grid-cols-3 gap-2">{bentoBadges.map(b => (<div key={b.id} onClick={() => setSelectedBadge(b)} className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${b.unlocked ? `bg-white shadow-sm border ${b.border}` : 'bg-gray-50 grayscale opacity-40'}`}><div className={`p-2 rounded-full ${b.unlocked ? `${b.bg} ${b.color}` : 'bg-gray-200'}`}><b.icon size={20} /></div><span className="text-[10px] font-bold text-gray-700">{b.label}</span></div>))}</div></CollapsibleCard>),
        'goals': (<CollapsibleCard title="목표 달성 추이" icon={Target} color="text-emerald-500"><div className="h-48 w-full"><ResponsiveContainer><AreaChart data={progressComparisonData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6"/><XAxis dataKey="name" tick={{fontSize:10}}/><YAxis hide domain={[0,100]}/><Area type="monotone" dataKey="ideal" stroke="#10B981" fill="#10B981" fillOpacity={0.1}/><Area type="monotone" dataKey="actual" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.3}/></AreaChart></ResponsiveContainer></div></CollapsibleCard>),
        'trends': (<CollapsibleCard title="학습 추이" icon={BarChart2} color="text-indigo-500"><div className="h-40 w-full"><ResponsiveContainer><BarChart data={chartData}><XAxis dataKey="name" tick={{fontSize:10}}/><Bar dataKey="rate" fill="#6366F1" radius={[4,4,0,0]} barSize={20}/></BarChart></ResponsiveContainer></div></CollapsibleCard>),
        'top5': (<CollapsibleCard title="성취율 TOP 5" icon={Award} color="text-amber-500"><div className="space-y-2">{statsData.top5Data.map((e, i) => (<div key={i} className="flex items-center justify-between text-xs"><span className="truncate flex-1">{i+1}. {e.name}</span><div className="w-24 h-1.5 bg-gray-100 rounded-full mx-2 overflow-hidden"><div className="h-full bg-indigo-500" style={{width:`${e.rate}%`}}></div></div><span className="font-bold w-8 text-right">{e.rate}%</span></div>))}</div></CollapsibleCard>)
    };

    const currentOrder = settings.reportWidgetOrder || ['time', 'wins', 'goals', 'trends', 'top5'];
    
    const handleDragStart = (e: React.DragEvent, index: number) => { 
        e.dataTransfer.setData('index', index.toString()); 
        (e.target as HTMLElement).style.opacity = '0.5'; 
    };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => { 
        const dragIndex = parseInt(e.dataTransfer.getData('index')); 
        if (dragIndex !== dropIndex) { 
            const newOrder = [...currentOrder]; 
            const [moved] = newOrder.splice(dragIndex, 1); 
            newOrder.splice(dropIndex, 0, moved); 
            onUpdateSettings({ ...settings, reportWidgetOrder: newOrder }); 
        } 
        (e.target as HTMLElement).style.opacity = '1'; 
    };

    return (
      <div className="p-4 pb-24 h-full overflow-y-auto bg-gray-50 no-scrollbar">
        <div className="flex flex-col items-center mb-6">
          <div className="flex justify-between w-full items-center mb-4"><h2 className="text-xl font-bold text-gray-900">리포트</h2><button onClick={onOpenSettings} className="p-2 bg-white text-gray-500 rounded-full shadow-sm"><SettingsIcon size={18} /></button></div>
          <div className="flex bg-gray-200 p-1 rounded-xl mb-4 w-full">{['daily', 'weekly', 'monthly'].map(m => (<button key={m} onClick={() => setViewMode(m as any)} className={`flex-1 py-1.5 text-xs font-bold rounded-lg ${viewMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>{m === 'daily' ? '일간' : (m === 'weekly' ? '주간' : '월간')}</button>))}</div>
          <div className="flex items-center gap-4"><button onClick={() => navigateDate(-1)} className="text-gray-400"><ChevronLeft /></button><h2 className="text-lg font-bold text-gray-800">{statsData.title}</h2><button onClick={() => navigateDate(1)} className="text-gray-400"><ChevronRight /></button></div>
        </div>

        <button onClick={() => setShowAIMenu(true)} className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] p-5 text-white flex justify-between items-center mb-6 shadow-xl active:scale-95 transition-all"><div className="flex items-center gap-3"><Sparkles size={24} /><div className="text-left"><h3 className="font-black text-sm uppercase tracking-wide">AI Learning Core</h3><p className="text-[10px] opacity-90 font-bold">Deep analytical insights for your growth.</p></div></div><ChevronRight size={18} /></button>
        
        {currentOrder.map((key, index) => (
            <div key={key} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, index)} className="relative group">
                <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-300"><GripHorizontal size={16} /></div>
                {widgetComponents[key]}
            </div>
        ))}

        {selectedBadge && (<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setSelectedBadge(null)}><div className="bg-white rounded-2xl w-full max-w-xs p-6 relative" onClick={e => e.stopPropagation()}><button onClick={() => setSelectedBadge(null)} className="absolute top-4 right-4 text-gray-400"><X size={20}/></button><div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${selectedBadge.unlocked ? selectedBadge.bg + ' ' + selectedBadge.color : 'bg-gray-100'}`}><selectedBadge.icon size={32} /></div><div className="text-center"><h3 className="text-lg font-bold mb-1">{selectedBadge.label}</h3><p className="text-sm text-gray-500">{selectedBadge.description}</p></div></div></div>)}

        <AIModal isOpen={showAIModal} onClose={() => setShowAIModal(false)} title="AI 학습 코치" content={aiContent} isLoading={aiLoading} />
        <AIMenuModal isOpen={showAIMenu} onClose={() => setShowAIMenu(false)} onSelectReport={handleAnalyze} onSelectJourney={handleGenerateJourney} onSelectPattern={handleAnalyzePattern} onSelectLevelAnalysis={() => { setShowAIMenu(false); setShowLevelAnalysis(true); }} onSelectRPG={() => { setShowAIMenu(false); setShowRPGModal(true); }} metacognitionInsight={metacognitionInsight} />
        <LevelAnalysisModal isOpen={showLevelAnalysis} onClose={() => setShowLevelAnalysis(false)} settings={settings} sessions={sessions} />
        <RPGStatsModal isOpen={showRPGModal} onClose={() => setShowRPGModal(false)} settings={settings} sessions={sessions} tasks={tasks} />
        
        <div className="text-center py-6 text-[10px] text-gray-300 font-black uppercase tracking-[0.4em]">StudyFlow v2.5.3</div>
      </div>
    );
}
