
import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Activity, Calendar as CalendarIcon, RefreshCcw, Trash2, Database, X, ArrowRight, ChevronLeft, ChevronRight, Edit2, Clock, Hash, ChevronUp, ChevronDown, GripHorizontal, TrendingUp, AlertCircle, Check } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';
import { addDoc, collection, serverTimestamp, deleteDoc, doc, updateDoc, getFirestore } from 'firebase/firestore';
import { CollapsibleCard, SimpleCircularProgress } from '../components/Common';
import { StatusSelectModal, ManualRecordModal } from '../components/Modals';
import { Task, Session, Settings } from '../types';

interface TasksViewProps {
    tasks: Task[];
    sessions: Session[];
    user: any;
    db: any;
    appId: string;
    activeTask: Task | null;
    setActiveTask: (t: Task | null) => void;
    onSeedData: () => void;
    settings: Settings;
    isCreatingImmediately: boolean;
    setIsCreatingImmediately: (v: boolean) => void;
    focusedTaskId: string | null;
    setFocusedTaskId: (id: string | null) => void;
    onUpdateSettings: (s: Settings) => void;
}

const StudyCalendar = ({ sessions, settings }: { sessions: Session[], settings: Settings }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const dailyGoalMinutes = settings.dailyGoalMinutes || 480; 
    const navigateMonth = (direction: number) => { const newDate = new Date(currentDate); newDate.setMonth(currentDate.getMonth() + direction); setCurrentDate(newDate); };
    const calendarData = useMemo(() => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0); const startingDayOfWeek = firstDay.getDay(); const daysInMonth = lastDay.getDate(); const days = []; for (let i = 0; i < startingDayOfWeek; i++) { days.push(null); } for (let i = 1; i <= daysInMonth; i++) { days.push(new Date(year, month, i)); } const sessionMap: Record<number, number> = {}; sessions.forEach(s => { const d = new Date(s.timestamp); if (d.getFullYear() === year && d.getMonth() === month) { const dayNum = d.getDate(); sessionMap[dayNum] = (sessionMap[dayNum] || 0) + ((s.duration || 0) / 60); } }); return { days, sessionMap, year, month }; }, [currentDate, sessions]);
    const getColorClass = (minutes: number) => { if (!minutes) return 'bg-gray-50 text-gray-400 border border-gray-100'; const percentage = (minutes / dailyGoalMinutes) * 100; if (percentage >= 80) return 'bg-emerald-500 text-white shadow-md shadow-emerald-200'; if (percentage >= 50) return 'bg-yellow-400 text-white shadow-md shadow-yellow-200'; if (percentage >= 25) return 'bg-orange-400 text-white shadow-md shadow-orange-200'; return 'bg-red-400 text-white shadow-md shadow-red-200'; };
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    return (<div className="bg-white rounded-2xl p-2 animate-in fade-in slide-in-from-left duration-300"><div className="flex items-center justify-between mb-4 px-2"><button onClick={(e) => { e.stopPropagation(); navigateMonth(-1); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronLeft size={20} /></button><span className="text-lg font-bold text-gray-800">{calendarData.year}년 {monthNames[calendarData.month]}</span><button onClick={(e) => { e.stopPropagation(); navigateMonth(1); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronRight size={20} /></button></div><div className="grid grid-cols-7 gap-1 mb-2">{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (<div key={d} className={`text-center text-xs font-bold ${i === 0 ? 'text-red-400' : (i === 6 ? 'text-indigo-400' : 'text-gray-400')}`}>{d}</div>))}</div><div className="grid grid-cols-7 gap-1">{calendarData.days.map((date, idx) => { if (!date) return <div key={`empty-${idx}`} className="aspect-square"></div>; const dayNum = date.getDate(); const minutes = calendarData.sessionMap[dayNum] || 0; const colorClass = getColorClass(minutes); const isToday = new Date().toDateString() === date.toDateString(); return (<div key={dayNum} className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all ${colorClass} ${isToday ? 'ring-2 ring-indigo-600 ring-offset-2' : ''}`}><span className={`text-sm font-bold ${!minutes && 'opacity-70'}`}>{dayNum}</span>{minutes > 0 && <span className="text-[9px] font-medium opacity-90">{Math.round(minutes/60 * 10)/10}h</span>}</div>); })}</div><div className="mt-4 flex justify-center gap-3 text-[10px] text-gray-500 font-medium bg-gray-50 p-2 rounded-lg"><div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-red-400"></div><span>부족</span></div><div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-orange-400"></div><span>보통</span></div><div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div><span>양호</span></div><div className="flex items-center gap-1"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span>완벽</span></div></div></div>);
};

interface TaskSpecificCalendarProps {
    sessions: Session[];
    task: Task;
    selectedDate?: Date | null;
    onSelectDate?: (date: Date) => void;
}
const TaskSpecificCalendar: React.FC<TaskSpecificCalendarProps> = ({ sessions, task, selectedDate, onSelectDate }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const dailyGoal = useMemo(() => { if (!task.totalAmount) return 0; let start = new Date(); if (task.startDate) start = new Date(task.startDate); else if (task.createdAt) start = new Date(task.createdAt.seconds * 1000); let end = new Date(); if (task.targetDate) end = new Date(task.targetDate); else end.setDate(start.getDate() + 30); const diffTime = Math.max(1, end.getTime() - start.getTime()); const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); return Math.ceil(task.totalAmount / Math.max(1, diffDays)); }, [task]);
    const navigateMonth = (direction: number) => { const newDate = new Date(currentDate); newDate.setMonth(currentDate.getMonth() + direction); setCurrentDate(newDate); };
    const calendarData = useMemo(() => { const year = currentDate.getFullYear(); const month = currentDate.getMonth(); const firstDay = new Date(year, month, 1); const lastDay = new Date(year, month + 1, 0); const startingDayOfWeek = firstDay.getDay(); const daysInMonth = lastDay.getDate(); const days = []; for (let i = 0; i < startingDayOfWeek; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); const sessionMap: Record<number, number> = {}; sessions.forEach(s => { const d = new Date(s.timestamp); if (d.getFullYear() === year && d.getMonth() === month) { const dayNum = d.getDate(); sessionMap[dayNum] = (sessionMap[dayNum] || 0) + (s.amount || 0); } }); return { days, sessionMap, year, month }; }, [currentDate, sessions]);
    const getColorClass = (amount: number) => { if (!amount) return 'bg-gray-50 text-gray-400 border border-gray-100'; if (dailyGoal > 0) { const percentage = (amount / dailyGoal) * 100; if (percentage >= 100) return 'bg-emerald-500 text-white shadow-md shadow-emerald-200'; if (percentage >= 50) return 'bg-yellow-400 text-white shadow-md shadow-yellow-200'; return 'bg-red-400 text-white shadow-md shadow-red-200'; } return 'bg-emerald-500 text-white shadow-md shadow-emerald-200'; };
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    return (<div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-2"><div className="flex items-center justify-between mb-4"><h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><CalendarIcon size={14} className="text-indigo-600"/> 월간 학습 캘린더</h3><div className="flex items-center gap-2"><button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronLeft size={16} /></button><span className="text-sm font-bold text-gray-800">{calendarData.year}년 {monthNames[calendarData.month]}</span><button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded-full text-gray-500"><ChevronRight size={16} /></button></div></div><div className="grid grid-cols-7 gap-1 mb-2">{['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (<div key={d} className={`text-center text-[10px] font-bold ${i === 0 ? 'text-red-400' : (i === 6 ? 'text-indigo-400' : 'text-gray-400')}`}>{d}</div>))}</div><div className="grid grid-cols-7 gap-1">{calendarData.days.map((date, idx) => { if (!date) return <div key={`empty-${idx}`} className="aspect-square"></div>; const dayNum = date.getDate(); const amount = calendarData.sessionMap[dayNum] || 0; const colorClass = getColorClass(amount); const isToday = new Date().toDateString() === date.toDateString(); const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString(); return (<div key={dayNum} onClick={() => onSelectDate && onSelectDate(date)} className={`aspect-square rounded-lg flex flex-col items-center justify-center relative transition-all cursor-pointer hover:scale-105 active:scale-95 ${colorClass} ${isToday ? 'ring-2 ring-indigo-600 ring-offset-1' : ''} ${isSelected ? 'ring-4 ring-indigo-400 ring-offset-1 z-10' : ''}`}><span className={`text-xs font-bold ${!amount && 'opacity-70'}`}>{dayNum}</span></div>); })}</div><div className="mt-3 flex justify-end gap-3 text-[9px] text-gray-500 font-medium"><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400"></div><span>미흡</span></div><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400"></div><span>보통</span></div><div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span>달성</span></div></div></div>);
};

const CreateTaskView = ({ onCancel, onSave }: { onCancel: () => void, onSave: (data: any) => Promise<void> }) => {
  const [name, setName] = useState(''); const [totalAmount, setTotalAmount] = useState(''); const [unit, setUnit] = useState('페이지'); const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]); const [endDate, setEndDate] = useState(''); const [dayStates, setDayStates] = useState<Record<string, 'learning' | 'supplementary' | 'rest'>>({ '월': 'learning', '화': 'learning', '수': 'learning', '목': 'learning', '금': 'learning', '토': 'learning', '일': 'learning' }); const units = ['페이지', '문제', '강', '회독', '%', '시간']; const days = ['월', '화', '수', '목', '금', '토', '일'];
  const toggleDay = (day: string) => { setDayStates(prev => { const current = prev[day]; let next: 'learning' | 'supplementary' | 'rest'; if (current === 'rest') next = 'learning'; else if (current === 'learning') next = 'supplementary'; else next = 'rest'; return { ...prev, [day]: next }; }); };
  const handleSave = async (e: any) => { if (e && e.preventDefault) e.preventDefault(); if (!name || !totalAmount || !endDate) { alert('필수 정보를 입력해주세요.'); return; } const repeatDays = days.reduce((acc, day) => { const status = dayStates[day]; if (status === 'learning') acc.push(day); else if (status === 'supplementary') acc.push(`${day}(보충)`); return acc; }, [] as string[]); try { await onSave({ name, totalAmount: Number(totalAmount), unit, startDate, targetDate: endDate, repeatDays }); } finally { onCancel(); } };
  return (<div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col w-full max-w-md mx-auto animate-in slide-in-from-bottom-10 duration-300"><div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100 sticky top-0 z-20"><button onClick={onCancel} className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full"><X size={24} /></button><h2 className="text-lg font-bold text-gray-900">새로운 목표 설정</h2><div className="w-10"></div></div><div className="flex-1 overflow-y-auto p-6 space-y-8"><div className="space-y-2"><label className="text-sm font-bold text-gray-500 ml-1">과목 이름</label><input className="w-full text-xl font-bold bg-white border-b-2 border-gray-200 px-2 py-3 focus:outline-none focus:border-indigo-600 placeholder-gray-300" placeholder="예: 수학의 정석" value={name} onChange={e => setName(e.target.value)} autoFocus /></div><div className="space-y-4"><label className="text-sm font-bold text-gray-500 ml-1">목표량 설정</label><div className="flex items-center gap-3"><div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center"><input type="number" className="w-full text-lg font-bold bg-transparent focus:outline-none" placeholder="숫자" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} /></div><div className="w-1/3 bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center"><input type="text" className="w-full text-center text-gray-700 font-bold bg-transparent focus:outline-none placeholder-gray-300" placeholder="단위" value={unit} onChange={(e) => setUnit(e.target.value)} /></div></div><div className="flex flex-wrap gap-2">{units.map(u => (<button key={u} onClick={() => setUnit(u)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${unit === u ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>{u}</button>))}</div></div><div className="space-y-4"><label className="text-sm font-bold text-gray-500 ml-1">기간 설정</label><div className="flex items-center gap-3"><div className="flex-1"><span className="text-xs text-gray-400 block mb-1 ml-1">시작일</span><input type="date" className="w-full bg-white border rounded-xl p-3 text-sm font-medium" value={startDate} onChange={e => setStartDate(e.target.value)} /></div><ArrowRight size={20} className="text-gray-300 mt-5" /><div className="flex-1"><span className="text-xs text-gray-400 block mb-1 ml-1">종료일</span><input type="date" className="w-full bg-white border rounded-xl p-3 text-sm font-medium" value={endDate} onChange={e => setEndDate(e.target.value)} /></div></div></div><div className="space-y-4"><label className="text-sm font-bold text-gray-500 ml-1">학습 요일 설정 <span className="text-xs font-normal text-gray-400 ml-1">(1번:학습, 2번:보충, 3번:휴식)</span></label><div className="flex justify-between">{days.map(day => { const status = dayStates[day]; let btnClass = "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border "; if (status === 'learning') { btnClass += "bg-indigo-600 text-white border-indigo-600"; } else if (status === 'supplementary') { btnClass += "bg-amber-400 text-white border-amber-400"; } else { btnClass += "bg-white text-gray-400 border-gray-200"; } return (<button key={day} onClick={() => toggleDay(day)} className={btnClass}>{day}</button>); })}</div></div></div><div className="p-4 bg-white border-t border-gray-100 flex gap-3"><button onClick={onCancel} className="flex-1 py-4 bg-gray-100 text-gray-500 text-lg font-bold rounded-2xl hover:bg-gray-200 transition-all active:scale-[0.98]">닫기</button><button onClick={handleSave} className="flex-1 py-4 bg-indigo-600 text-white text-lg font-bold rounded-2xl shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]">설정</button></div></div>);
};

const TaskDetailView = ({ task, sessions, onBack, settings, user, appId, db }: { task: Task, sessions: Session[], onBack: () => void, settings: Settings, user: any, appId: string, db: any }) => {
    const [showManualModal, setShowManualModal] = useState(false);
    const [isHeaderCompact, setIsHeaderCompact] = useState(false);
    const [filterMode, setFilterMode] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [filterDate, setFilterDate] = useState(new Date());
    const taskSessions = sessions.filter(s => s.taskId === task.id);
    const totalTime = taskSessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    const progress = task.totalAmount ? Math.min(100, Math.round(((task.currentAmount || 0) / task.totalAmount) * 100)) : 0;
    const getDaysDiff = (targetDate?: string) => { if (!targetDate) return 0; const today = new Date(); today.setHours(0,0,0,0); const target = new Date(targetDate); target.setHours(0,0,0,0); return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)); };
    const daysLeft = getDaysDiff(task.targetDate);
    const navigateFilter = (direction: number) => { const newDate = new Date(filterDate); if (filterMode === 'daily') newDate.setDate(filterDate.getDate() + direction); if (filterMode === 'weekly') newDate.setDate(filterDate.getDate() + (direction * 7)); if (filterMode === 'monthly') newDate.setMonth(filterDate.getMonth() + direction); setFilterDate(newDate); };
    const getFilterTitle = () => { const d = filterDate; if (filterMode === 'daily') { const days = ['일', '월', '화', '수', '목', '금', '토']; return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} (${days[d.getDay()]})`; } if (filterMode === 'weekly') { const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const start = new Date(d); start.setDate(diff); const end = new Date(start); end.setDate(start.getDate() + 6); return `${start.getMonth() + 1}.${start.getDate()} - ${end.getMonth() + 1}.${end.getDate()}`; } if (filterMode === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; return `${d.getFullYear()}년`; };
    const filteredSessions = useMemo(() => { let start = new Date(filterDate); let end = new Date(filterDate); if (filterMode === 'daily') { start.setHours(0,0,0,0); end.setHours(23,59,59,999); } else if (filterMode === 'weekly') { const day = start.getDay(); const diff = start.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); start.setHours(0,0,0,0); end = new Date(start); end.setDate(start.getDate() + 7); } else if (filterMode === 'monthly') { start.setDate(1); start.setHours(0,0,0,0); end = new Date(start); end.setMonth(start.getMonth() + 1); } return taskSessions.filter(s => { const t = new Date(s.timestamp); return t >= start && t < end; }).sort((a,b) => b.timestamp - a.timestamp); }, [taskSessions, filterMode, filterDate]);
    const handleSaveManualSession = async (data: {date: string, startTime: string, endTime: string, amount: number}) => { try { const start = new Date(`${data.date}T${data.startTime}`); const end = new Date(`${data.date}T${data.endTime}`); const durationSeconds = (end.getTime() - start.getTime()) / 1000; if (durationSeconds <= 0) return; await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), { taskId: task.id, duration: durationSeconds, amount: data.amount || 0, mode: 'manual', timestamp: start.getTime(), createdAt: serverTimestamp() }); if (data.amount > 0) { await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', task.id), { currentAmount: (task.currentAmount || 0) + data.amount }); } } catch (e) { console.error("Manual Save Error:", e); } };
    const formatDurationSimple = (seconds: number) => { if (!seconds) return "0분"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); if (h > 0) return `${h}시간 ${m}분`; return `${m}분`; };
    return (<div className="h-full flex flex-col bg-gray-50 overflow-y-auto pb-24 animate-in slide-in-from-right no-scrollbar"><div className="bg-white sticky top-0 z-10 px-4 py-3 flex items-center border-b border-gray-200 shadow-sm"><button onClick={onBack} className="p-2 -ml-2 hover:bg-gray-100 rounded-full mr-2"><ChevronLeft size={24} className="text-gray-600" /></button><div className="flex-1 min-w-0"><h2 className="text-lg font-bold text-gray-800 truncate">{task.name}</h2><p className="text-xs text-gray-500">{task.targetDate ? `${task.targetDate} 까지` : '기한 없음'}</p></div><button onClick={() => setShowManualModal(true)} className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-1.5 rounded-full transition-colors"><Edit2 size={14} /> 기록 수정</button></div><div className="p-6 space-y-6"><div className={`bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl text-white shadow-xl relative overflow-hidden transition-all duration-300 ${isHeaderCompact ? 'p-4' : 'p-6'}`}><div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 pointer-events-none"></div>{isHeaderCompact ? (<div className="flex justify-between items-center relative z-10"><div className="flex items-center gap-3"><div className="flex items-baseline gap-1"><span className="text-2xl font-bold tracking-tight">{progress}%</span><span className="text-xs text-indigo-200 font-bold">달성</span></div><div className="w-px h-4 bg-white/20"></div><span className="text-xs text-indigo-100 font-medium">{task.currentAmount}/{task.totalAmount} {task.unit}</span></div><button onClick={() => setIsHeaderCompact(false)} className="p-1 text-indigo-200 hover:text-white bg-white/10 rounded-full transition-colors"><ChevronDown size={20} /></button></div>) : (<>{/* Header: Label & D-Day */}<div className="flex justify-between items-start mb-2 relative z-10"><h3 className="text-indigo-200 text-sm font-bold">전체 진행률</h3><div className="flex items-center gap-2"><div className="bg-white/20 backdrop-blur-md text-white text-xs font-bold px-3 py-1 rounded-full border border-white/10">D-{daysLeft > 0 ? daysLeft : (daysLeft === 0 ? 'Day' : 'End')}</div><button onClick={() => setIsHeaderCompact(true)} className="p-1 text-indigo-200 hover:text-white bg-white/10 rounded-full transition-colors"><ChevronUp size={20} /></button></div></div>{/* Main Progress Stats */}<div className="flex items-baseline gap-2 mb-3 relative z-10"><span className="text-4xl font-bold tracking-tight">{progress}%</span><span className="text-sm text-indigo-200 font-medium">달성</span></div><div className="w-full bg-black/20 h-2 rounded-full overflow-hidden mb-2 relative z-10"><div className="bg-white h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }}></div></div><p className="text-xs text-indigo-200 font-medium text-right mb-6 relative z-10">{task.currentAmount || 0} / {task.totalAmount} {task.unit}</p>{/* Divider */}<div className="w-full h-px bg-white/10 mb-4 relative z-10"></div>{/* Detailed Stats Grid (Merged) */}<div className="flex justify-between items-center relative z-10 px-2"><div className="flex flex-col items-center flex-1 border-r border-white/10"><div className="flex items-center gap-1.5 text-indigo-200 mb-1"><Clock size={12} /><span className="text-[10px] font-bold">총 투자 시간</span></div><span className="text-lg font-bold">{formatDurationSimple(totalTime)}</span></div><div className="flex flex-col items-center flex-1"><div className="flex items-center gap-1.5 text-indigo-200 mb-1"><Hash size={12} /><span className="text-[10px] font-bold">총 횟수</span></div><span className="text-lg font-bold">{taskSessions.length}회</span></div></div></>)}</div><TaskSpecificCalendar sessions={taskSessions} task={task} selectedDate={filterMode === 'daily' ? filterDate : null} onSelectDate={(date) => { setFilterMode('daily'); setFilterDate(date); }} /><div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"><div className="flex flex-col mb-4"><div className="flex justify-between items-center mb-4"><h5 className="font-bold text-gray-700 text-sm">최근 학습 기록</h5><div className="flex bg-gray-100 p-0.5 rounded-lg">{['daily', 'weekly', 'monthly'].map(m => (<button key={m} onClick={() => setFilterMode(m as any)} className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all ${filterMode === m ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}>{m === 'daily' ? '일간' : (m === 'weekly' ? '주간' : '월간')}</button>))}</div></div><div className="flex items-center justify-center gap-4 bg-gray-50 p-2 rounded-xl mb-2"><button onClick={() => navigateFilter(-1)} className="p-1 text-gray-400 hover:text-gray-600"><ChevronLeft size={16}/></button><span className="text-sm font-bold text-gray-700">{getFilterTitle()}</span><button onClick={() => navigateFilter(1)} className="p-1 text-gray-400 hover:text-gray-600"><ChevronRight size={16}/></button></div><div className="flex justify-center mb-2"><span className="text-[10px] text-gray-400 font-bold bg-gray-50 px-3 py-1 rounded-full border border-gray-100">총 <span className="text-indigo-600">{filteredSessions.length}</span>세션</span></div></div><div className="space-y-0">{filteredSessions.map((s, idx) => { const dateObj = new Date(s.timestamp); const dateStr = `${dateObj.getFullYear()}.${String(dateObj.getMonth()+1).padStart(2,'0')}.${String(dateObj.getDate()).padStart(2,'0')}`; const dayStr = ['일','월','화','수','목','금','토'][dateObj.getDay()]; const startTime = dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}); const endTime = new Date(s.timestamp + (s.duration * 1000)).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}); const durationMin = Math.floor(s.duration / 60); return (<div key={idx} className="py-3 border-b border-gray-50 last:border-0 flex justify-between items-center text-xs"><div className="text-gray-600 font-medium flex items-center gap-1"><span>{dateStr} ({dayStr}) <span className="text-gray-300 mx-1">|</span> {startTime} - {endTime}</span><span className="text-indigo-600 font-bold bg-indigo-50 px-1.5 py-0.5 rounded ml-1">{durationMin}분</span></div><div className="font-bold text-gray-800">{s.amount || 0}{task.unit}</div></div>); })}{filteredSessions.length === 0 && <p className="text-xs text-gray-400 text-center py-4">해당 기간의 기록이 없습니다.</p>}</div></div></div><ManualRecordModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} onSave={handleSaveManualSession} taskName={task.name} unit={task.unit} /></div>);
};

export const TasksView: React.FC<TasksViewProps> = ({ tasks, sessions, user, db, appId, activeTask, setActiveTask, onSeedData, settings, isCreatingImmediately, setIsCreatingImmediately, focusedTaskId, setFocusedTaskId, onUpdateSettings }) => {
    const getDaysDiff = (targetDate?: string) => {
        if (!targetDate) return 0;
        const today = new Date();
        today.setHours(0,0,0,0);
        const target = new Date(targetDate);
        target.setHours(0,0,0,0);
        const diffTime = target.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getTaskHealth = (taskId: string, paceStatus: string) => {
        const taskSessions = sessions.filter(s => s.taskId === taskId).sort((a,b) => b.timestamp - a.timestamp);
        const lastSession = taskSessions[0];
        if (!lastSession) return "bg-red-500"; 
        const now = Date.now();
        const diffHours = (now - lastSession.timestamp) / (1000 * 3600);
        if (paceStatus === 'behind' || diffHours > 168) return "bg-red-500"; 
        if (diffHours > 72) return "bg-amber-500"; 
        return "bg-emerald-500"; 
    };

    const getPaceStatus = (task: Task) => {
        if (!task.targetDate || !task.totalAmount || task.status === 'completed') return null;
        const start = task.startDate ? new Date(task.startDate) : (task.createdAt?.seconds ? new Date(task.createdAt.seconds * 1000) : new Date());
        start.setHours(0,0,0,0);
        const end = new Date(task.targetDate);
        end.setHours(23,59,59,999);
        const today = new Date();
        today.setHours(0,0,0,0);
        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        const elapsedDays = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
        const daysLeft = Math.max(1, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
        const currentAmount = task.currentAmount || 0;
        const remainingAmount = Math.max(0, task.totalAmount - currentAmount);
        const recommendedPace = Number((remainingAmount / daysLeft).toFixed(1));
        const currentPace = Number((currentAmount / elapsedDays).toFixed(1));
        let status: 'ahead' | 'on-track' | 'behind' = 'on-track';
        if (currentPace > recommendedPace * 1.05) status = 'ahead';
        else if (currentPace < recommendedPace * 0.95) status = 'behind';
        const config = {
            'ahead': { label: '앞서감', color: 'bg-emerald-100 text-emerald-700', icon: TrendingUp },
            'on-track': { label: '적정', color: 'bg-indigo-50 text-indigo-600', icon: Activity },
            'behind': { label: '지연', color: 'bg-red-100 text-red-700', icon: AlertCircle }
        };
        return { ...config[status], recommendedPace, currentPace, status };
    };

    const [isCreating, setIsCreating] = useState(isCreatingImmediately);
    const [tab, setTab] = useState('active'); 
    const [statusModalTask, setStatusModalTask] = useState<Task | null>(null); 
    const [detailTask, setDetailTask] = useState<Task | null>(null); 
    const [isCalendarView, setIsCalendarView] = useState(true);
    const [reportPeriod, setReportPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [currentReportDate, setCurrentReportDate] = useState(new Date());
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
    const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
    const onTouchEnd = () => { if (!touchStart || !touchEnd) return; const distance = touchStart - touchEnd; const isLeftSwipe = distance > 50; const isRightSwipe = distance < -50; if (isLeftSwipe) { setIsCalendarView(false); } if (isRightSwipe) { setIsCalendarView(true); } };
    useEffect(() => { if(isCreatingImmediately) { setIsCreating(true); setIsCreatingImmediately(false); } }, [isCreatingImmediately, setIsCreatingImmediately]);
    useEffect(() => { if (focusedTaskId && tasks.length > 0) { const t = tasks.find(task => task.id === focusedTaskId); if (t) { setDetailTask(t); } setFocusedTaskId(null); } }, [focusedTaskId, tasks, setFocusedTaskId]);
    const formatDurationSimple = (seconds: number) => { if (!seconds) return "0분"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); if (h > 0) return `${h}시간 ${m}분`; return `${m}분`; };
    const navigateReportDate = (direction: number) => { const newDate = new Date(currentReportDate); if (reportPeriod === 'daily') newDate.setDate(currentReportDate.getDate() + direction); if (reportPeriod === 'weekly') newDate.setDate(currentReportDate.getDate() + (direction * 7)); if (reportPeriod === 'monthly') newDate.setMonth(currentReportDate.getMonth() + direction); if (reportPeriod === 'yearly') newDate.setFullYear(currentReportDate.getFullYear() + direction); setCurrentReportDate(newDate); };
    const getReportDateTitle = () => { const d = currentReportDate; if (reportPeriod === 'daily') { const days = ['일', '월', '화', '수', '목', '금', '토']; return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`; } if (reportPeriod === 'weekly') { const day = d.getDay(); const diff = d.getDate() - day + (day === 0 ? -6 : 1); const start = new Date(d); start.setDate(diff); const end = new Date(start); end.setDate(start.getDate() + 6); return `${start.getMonth() + 1}.${start.getDate()} - ${end.getMonth() + 1}.${end.getDate()}`; } if (reportPeriod === 'monthly') return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; return `${d.getFullYear()}년`; };

    const summaryStats = useMemo(() => {
        const totalTasks = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const activeTasks = tasks.filter(t => (t.status || 'active') === 'active').length;
        const incompleteTasks = tasks.filter(t => t.status === 'incomplete').length;
        const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const start = new Date(currentReportDate);
        let end = new Date(currentReportDate);
        if (reportPeriod === 'daily') { start.setHours(0,0,0,0); end.setHours(23,59,59,999); } else if (reportPeriod === 'weekly') { const day = start.getDay(); const diff = start.getDate() - day + (day === 0 ? -6 : 1); start.setDate(diff); start.setHours(0,0,0,0); end = new Date(start); end.setDate(start.getDate() + 7); } else if (reportPeriod === 'monthly') { start.setDate(1); start.setHours(0,0,0,0); end = new Date(start); end.setMonth(start.getMonth() + 1); } else if (reportPeriod === 'yearly') { start.setMonth(0, 1); start.setHours(0,0,0,0); end = new Date(start); end.setFullYear(start.getFullYear() + 1); }
        const filteredSessions = sessions.filter(s => { const t = new Date(s.timestamp); return t >= start && t < end; });
        const totalStudyTime = filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0);
        const avgProgress = totalTasks > 0 ? Math.round(tasks.reduce((acc, t) => acc + (t.totalAmount ? (t.currentAmount / t.totalAmount) : 0), 0) / totalTasks * 100) : 0;
        const pieData = [ { name: '진행중', value: activeTasks, color: '#4F46E5' }, { name: '완료', value: completedTasks, color: '#10B981' }, { name: '미완료', value: incompleteTasks, color: '#F43F5E' }, ].filter(d => d.value > 0);
        return { totalTasks, completedTasks, activeTasks, incompleteTasks, completionRate, totalStudyTime, avgProgress, pieData };
    }, [tasks, sessions, reportPeriod, currentReportDate]);

    const handleCreateTask = async (taskData: any) => { const userId = user?.uid || 'guest-user'; try { await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'tasks'), { ...taskData, currentAmount: 0, status: 'active', createdAt: serverTimestamp() }); } catch (error) { console.error("Error creating task:", error); } finally { setIsCreating(false); } };
    if (detailTask) { return <TaskDetailView task={detailTask} sessions={sessions} onBack={() => setDetailTask(null)} settings={settings} user={user} appId={appId} db={db} />; }
    if (isCreating) { return <CreateTaskView onCancel={() => setIsCreating(false)} onSave={handleCreateTask} />; }
    const filteredTasks = tasks.filter(t => { const status = t.status || 'active'; return status === tab; });
    const handleDeleteClick = (e: React.MouseEvent, task: Task) => { e.stopPropagation(); setStatusModalTask(task); };
    const handleStatusChange = async (newStatus: string) => { if (statusModalTask) { const userId = user?.uid || 'guest-user'; try { if (newStatus === 'delete') { if (confirm('정말로 이 과목을 영구 삭제하시겠습니까? (복구 불가)')) { await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'tasks', statusModalTask.id)); } } else { await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'tasks', statusModalTask.id), { status: newStatus }); } } catch (e) { console.error("Error updating status:", e); } setStatusModalTask(null); } };

    const DashboardWidget = (
        <div 
            className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6 transition-all duration-300 relative overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
             <div className="w-full flex justify-between items-center p-5 pb-2">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    {isCalendarView ? <CalendarIcon size={16} className="text-indigo-600" /> : <Activity size={16} className="text-indigo-600" />}
                    {isCalendarView ? '월간 학습 캘린더' : '종합 학습 리포트'}
                </h3>
            </div>
            
            <div className="px-5 pb-5">
                {isCalendarView ? (
                     <StudyCalendar sessions={sessions} settings={settings} />
                ) : (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right duration-300">
                        <div className="flex justify-center mb-0">
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['daily', 'weekly', 'monthly', 'yearly'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={(e) => { e.stopPropagation(); setReportPeriod(p as any); }}
                                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${reportPeriod === p ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                                    >
                                        {p === 'daily' ? '일간' : (p === 'weekly' ? '주간' : (p === 'monthly' ? '월간' : '연간'))}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center justify-center gap-4 mb-1">
                            <button onClick={(e) => { e.stopPropagation(); navigateReportDate(-1); }} className="p-1 text-gray-400 hover:text-gray-600">
                                <ChevronLeft size={16} />
                            </button>
                            <span className="text-sm font-bold text-gray-700">{getReportDateTitle()}</span>
                            <button onClick={(e) => { e.stopPropagation(); navigateReportDate(1); }} className="p-1 text-gray-400 hover:text-gray-600">
                                <ChevronRight size={16} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="w-1/2 h-32 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie 
                                            data={summaryStats.pieData} 
                                            cx="50%" 
                                            cy="50%" 
                                            innerRadius={25} 
                                            outerRadius={40} 
                                            paddingAngle={5} 
                                            dataKey="value"
                                            label={false}
                                            labelLine={false}
                                        >
                                            {summaryStats.pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="none"/>
                                            ))}
                                        </Pie>
                                        <ReTooltip />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <div className="flex flex-col items-center justify-center text-center">
                                            <span className="text-xs font-bold text-gray-600">{summaryStats.totalTasks}개</span>
                                    </div>
                                </div>
                            </div>
                            <div className="w-1/2 grid grid-cols-1 gap-2 text-xs">
                                {summaryStats.pieData.map(d => {
                                    const total = summaryStats.pieData.reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = total > 0 ? Math.round((d.value / total) * 100) : 0;
                                    return (
                                        <div key={d.name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div>
                                                <span className="text-gray-600">{d.name} <span className="text-gray-400">({percent}%)</span></span>
                                            </div>
                                            <span className="font-bold">{d.value}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 p-3 rounded-xl text-center">
                                <p className="text-[10px] text-gray-400 mb-1">총 완료율</p>
                                <p className="text-lg font-bold text-emerald-600">{summaryStats.completionRate}%</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl text-center">
                                <p className="text-[10px] text-gray-400 mb-1">평균 진도율</p>
                                <p className="text-lg font-bold text-indigo-600">{summaryStats.avgProgress}%</p>
                            </div>
                            <div className="bg-gray-50 p-3 rounded-xl text-center col-span-2">
                                <p className="text-[10px] text-gray-400 mb-1">학습 시간 ({reportPeriod === 'daily' ? '오늘' : (reportPeriod === 'weekly' ? '이번주' : (reportPeriod === 'monthly' ? '이번달' : '올해'))})</p>
                                <p className="text-lg font-bold text-gray-800">{formatDurationSimple(summaryStats.totalStudyTime)}</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center px-4 pb-3">
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsCalendarView(true); }}
                    className={`p-1 rounded-full transition-colors ${isCalendarView ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                    disabled={isCalendarView}
                >
                    <ChevronLeft size={20} />
                </button>
                
                <div className="flex gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${isCalendarView ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                    <div className={`w-1.5 h-1.5 rounded-full transition-colors ${!isCalendarView ? 'bg-indigo-600' : 'bg-gray-300'}`}></div>
                </div>

                <button 
                    onClick={(e) => { e.stopPropagation(); setIsCalendarView(false); }}
                    className={`p-1 rounded-full transition-colors ${!isCalendarView ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                    disabled={!isCalendarView}
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );

    const widgetComponents: any = {
        'dashboard': DashboardWidget
    };

    const currentOrder = settings.tasksWidgetOrder || ['dashboard'];

    const handleDragStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('index', index.toString());
        (e.target as HTMLElement).style.opacity = '0.5';
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

    const handleDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('index'));
        (e.target as HTMLElement).style.opacity = '1';
        
        if (dragIndex !== dropIndex) {
            const newOrder = [...currentOrder];
            const [removed] = newOrder.splice(dragIndex, 1);
            newOrder.splice(dropIndex, 0, removed);
            onUpdateSettings({ ...settings, tasksWidgetOrder: newOrder });
        }
    };

    const handleDragEnd = (e: React.DragEvent) => { (e.target as HTMLElement).style.opacity = '1'; };

    return (
      <div className="h-full bg-gray-50 p-6 pb-24 overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">학습 관리</h2>
        </div>

        {currentOrder.map((key, index) => {
            if (!settings.tasksWidgets?.[key as keyof typeof settings.tasksWidgets]) return null;
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
  
        <div className="flex space-x-1 mb-6 bg-gray-200 p-1 rounded-xl">
            {['active', 'completed', 'incomplete'].map(t => (
                <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                        tab === t 
                        ? 'bg-white text-indigo-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                    {t === 'active' ? '진행중' : (t === 'completed' ? '완료' : '미완료')}
                </button>
            ))}
        </div>
  
        <div className="space-y-3">
          {filteredTasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <p className="text-gray-400 text-sm">
                      {tab === 'active' ? '등록된 과목이 없습니다.' : (tab === 'completed' ? '완료된 과목이 없습니다.' : '미완료된 과목이 없습니다.')}
                  </p>
                  {tab === 'active' && tasks.length === 0 && (
                      <button onClick={onSeedData} className="flex items-center gap-2 px-5 py-3 bg-white border border-indigo-100 shadow-sm rounded-xl text-indigo-600 font-bold text-sm hover:bg-indigo-50"><Database size={16} /> 예시 데이터로 시작하기</button>
                  )}
              </div>
          )}
          {filteredTasks.map(task => {
              const progress = task.totalAmount ? Math.round(((task.currentAmount || 0) / task.totalAmount) * 100) : 0;
              const pace = getPaceStatus(task);
              const healthBarColor = getTaskHealth(task.id, pace?.status || 'on-track');
              
              return (
                <div key={task.id} onClick={() => setDetailTask(task)} className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer flex overflow-hidden group">
                  <div className={`w-3 ${healthBarColor} shrink-0 transition-colors duration-500`}></div>
                  
                  <div className="p-5 flex-1">
                      <div className="flex justify-between mb-3">
                          <div>
                            <h3 className="font-bold text-lg text-gray-800 group-hover:text-indigo-600 transition-colors">{task.name}</h3>
                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <CalendarIcon size={12} /> {task.targetDate ? `D-${getDaysDiff(task.targetDate)}` : '기한 없음'} 
                                <span className="mx-1 text-gray-200">|</span>
                                {task.totalAmount}{task.unit}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                              {tab !== 'active' && (
                                <button onClick={(e) => { e.stopPropagation(); setStatusModalTask(task); }} className="text-gray-400 hover:text-indigo-600 p-1 transition-colors">
                                    <RefreshCcw size={18} />
                                </button>
                              )}
                              <button onClick={(e) => handleDeleteClick(e, task)} className="text-gray-300 hover:text-red-500 p-1 transition-colors">
                                <Trash2 size={18} />
                              </button>
                          </div>
                      </div>

                      <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden mb-2">
                          <div className="bg-indigo-500 h-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
                      </div>

                      <div className="flex justify-between items-center text-xs font-medium text-gray-500 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-700">{progress}% 달성</span>
                            {pace && (
                                <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-bold text-[9px] ${pace.color} transition-all animate-in fade-in zoom-in-95`}>
                                    <pace.icon size={10} strokeWidth={3} />
                                    {pace.label}
                                </div>
                            )}
                          </div>
                          <span>{task.currentAmount || 0} / {task.totalAmount}</span>
                      </div>

                      {pace && (
                        <div className="px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-500">
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tight mb-0.5">페이스메이커 수치 가이드</span>
                                <p className="text-[10px] font-bold text-gray-600">
                                    목표 달성까지 하루 평균 <span className="text-indigo-600 font-black">{pace.recommendedPace}{task.unit}</span> 권장
                                    <span className="mx-1.5 text-gray-300">|</span>
                                    현재 <span className={pace.status === 'behind' ? 'text-red-500' : 'text-emerald-600'}>{pace.currentPace}{task.unit}</span> 진행 중 ({pace.label})
                                </p>
                            </div>
                            <div className={`p-1.5 rounded-full ${pace.color} bg-opacity-30`}>
                                <pace.icon size={14} className={pace.status === 'behind' ? 'animate-pulse' : ''} />
                            </div>
                        </div>
                      )}
                  </div>
                </div>
              );
          })}
        </div>
        <StatusSelectModal isOpen={!!statusModalTask} onClose={() => setStatusModalTask(null)} onSelect={handleStatusChange} taskName={statusModalTask?.name} currentStatus={statusModalTask?.status || 'active'} />
        <div className="text-center py-6 text-[10px] text-gray-300 font-black uppercase tracking-[0.4em]">
            StudyFlow v2.5.3
        </div>
      </div>
    );
}
