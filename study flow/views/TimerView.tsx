
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Play, Pause, StopCircle, ChevronDown, Settings as SettingsIcon, Clock, Hourglass, Timer as TimerIcon, ChevronLeft, ChevronRight, CloudRain, Flame, Volume2, VolumeX, Coffee, Music, Wind } from 'lucide-react';
import { addDoc, collection, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, getFirestore } from 'firebase/firestore';
import { AmountInputModal, PreTimerModal } from '../components/Modals';
import { Task, Settings as SettingsType, Session } from '../types';

interface ActiveTimerScreenProps {
    selectedTask: Task;
    onBack: () => void;
    settings: SettingsType;
    user: any;
    appId: string;
    sessions?: Session[];
    onOpenSettings: () => void;
    onUpdateSettings: (s: SettingsType) => void;
}

// --- Audio Helper ---
const playSimpleTone = (type: 'start' | 'end') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'start') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.5, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            osc.start();
            osc.stop(ctx.currentTime + 0.1);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
            osc.start();
            osc.stop(ctx.currentTime + 2.0);
        }
    } catch (e) {
        console.warn("Audio playback failed", e);
    }
};

const RestGuideTicker = ({ isLightMode }: { isLightMode: boolean }) => {
    const messages = [
        "눈을 감고 깊게 심호흡하세요.",
        "먼 곳을 바라보며 눈의 피로를 푸세요.",
        "물 한 잔을 마시며 수분을 보충하세요.",
        "어깨와 목을 가볍게 스트레칭하세요.",
        "잠시 스마트폰을 내려놓고 멍하니 있으세요."
    ];
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setIdx(prev => (prev + 1) % messages.length), 8000);
        return () => clearInterval(interval);
    }, []);
    
    return (
        <div className="absolute top-24 left-0 right-0 flex justify-center animate-in fade-in duration-1000">
            <div className={`backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 ${isLightMode ? 'bg-gray-100/80 text-gray-600' : 'bg-white/10 text-indigo-100'}`}>
                <Wind size={14} className={`animate-pulse ${isLightMode ? 'text-indigo-500' : 'text-indigo-300'}`} />
                <span className="text-xs font-medium">{messages[idx]}</span>
            </div>
        </div>
    );
};

const RingTimer = ({ seconds, isRunning, mode, formatTime, size = 300, settings }: any) => {
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    let progressPercentage = 0;
    if (mode === 'stopwatch') {
        progressPercentage = (seconds % 60) / 60;
    } else {
        const maxSeconds = mode === 'countdown' 
            ? (settings.countdownMinutes || 60) * 60 
            : (settings.pomoFocus || 25) * 60;
        const elapsed = maxSeconds - seconds;
        progressPercentage = maxSeconds > 0 ? elapsed / maxSeconds : 0;
    }
    progressPercentage = Math.min(1, Math.max(0, progressPercentage));
    const offset = circumference - (progressPercentage * circumference);

    return (
        <div className="relative animate-in fade-in duration-300 flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <defs>
                    <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366F1" />
                        <stop offset="100%" stopColor="#A855F7" />
                    </linearGradient>
                </defs>
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="#f3f4f6" strokeWidth={strokeWidth} fill="transparent" />
                <circle 
                    cx={size / 2} cy={size / 2} r={radius} 
                    stroke="url(#ringGradient)" 
                    strokeWidth={strokeWidth} fill="transparent" 
                    strokeDasharray={circumference} 
                    strokeDashoffset={offset} 
                    strokeLinecap="round" 
                    className="transition-all duration-1000 ease-linear"
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-7xl font-light text-gray-800 font-mono tracking-tighter tabular-nums">
                     {formatTime(seconds)}
                 </span>
                 <span className={`text-sm font-bold mt-3 px-3 py-1 rounded-full transition-all duration-500 ${isRunning ? 'bg-indigo-50 text-indigo-600 opacity-100' : 'bg-gray-50 text-gray-400 opacity-80'}`}>
                     {isRunning ? 'FOCUSING' : 'PAUSED'}
                 </span>
            </div>
        </div>
    );
};

const MinimalTimer = ({ seconds, isRunning, formatTime }: any) => {
    const [bgPulse, setBgPulse] = useState(false);
    useEffect(() => {
        if(isRunning) {
            const interval = setInterval(() => setBgPulse(prev => !prev), 4000); 
            return () => clearInterval(interval);
        }
    }, [isRunning]);
    return (
        <div className={`flex flex-col items-center justify-center w-full h-full transition-all duration-[4000ms] ${isRunning ? (bgPulse ? 'bg-indigo-900/5' : 'bg-indigo-900/10') : 'bg-transparent'}`}>
            <RestGuideTicker isLightMode={!isRunning} />
            <div className={`text-[100px] leading-none font-bold tracking-tighter transition-colors duration-500 ${isRunning ? 'text-indigo-900' : 'text-gray-300'}`}>
                {formatTime(seconds)}
            </div>
            <p className={`mt-4 text-sm font-medium tracking-[0.2em] uppercase transition-opacity duration-500 ${isRunning ? 'text-indigo-400 opacity-60 animate-pulse' : 'text-gray-300'}`}>
                {isRunning ? 'Deep Work' : 'Ready'}
            </p>
        </div>
    );
};

const FlipTimer = ({ seconds, isRunning, formatTime }: any) => {
    const [activeSound, setActiveSound] = useState<string | null>(null);
    const sounds = [
        { id: 'rain', icon: CloudRain, label: 'Rain' },
        { id: 'fire', icon: Flame, label: 'Fire' },
        { id: 'cafe', icon: Coffee, label: 'Cafe' },
    ];
    const timeStr = formatTime(seconds);
    const parts = timeStr.split(':');
    return (
        <div className="flex flex-col items-center justify-center w-full gap-8 animate-in zoom-in-95 duration-300">
             <RestGuideTicker isLightMode={true} />
             <div className="flex items-center gap-2 sm:gap-4">
                 {parts.map((part: string, idx: number) => (
                     <React.Fragment key={idx}>
                         <div className="bg-gray-800 rounded-xl p-4 sm:p-6 min-w-[80px] sm:min-w-[100px] flex items-center justify-center shadow-2xl border-b-4 border-gray-950 relative overflow-hidden group">
                             <div className="absolute top-0 left-0 w-full h-1/2 bg-white/5 z-10 border-b border-white/5"></div>
                             <span key={part} className="text-5xl sm:text-6xl font-bold text-gray-100 font-mono z-0 animate-in slide-in-from-top-2 duration-300">
                                 {part}
                             </span>
                         </div>
                         {idx < parts.length - 1 && (
                             <div className="flex flex-col gap-2">
                                 <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                 <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                             </div>
                         )}
                     </React.Fragment>
                 ))}
             </div>
             <div className="bg-gray-100 p-2 rounded-2xl flex items-center gap-2 shadow-inner">
                 {sounds.map((sound) => (
                     <button
                        key={sound.id}
                        onClick={() => setActiveSound(activeSound === sound.id ? null : sound.id)}
                        className={`p-3 rounded-xl flex flex-col items-center gap-1 min-w-[60px] transition-all ${activeSound === sound.id ? 'bg-white shadow-sm text-indigo-600 scale-105' : 'text-gray-400 hover:text-gray-600'}`}
                     >
                         <sound.icon size={20} fill={activeSound === sound.id ? "currentColor" : "none"} />
                         <span className="text-[9px] font-bold uppercase">{sound.label}</span>
                     </button>
                 ))}
                 <div className="w-px h-8 bg-gray-200 mx-1"></div>
                 <div className="p-3 text-gray-300">
                    {activeSound ? <Volume2 size={20} className="text-indigo-400 animate-pulse"/> : <VolumeX size={20}/>}
                 </div>
             </div>
        </div>
    );
};

export const ActiveTimerScreen: React.FC<ActiveTimerScreenProps> = ({ selectedTask, onBack, settings, user, appId, sessions = [], onOpenSettings, onUpdateSettings }) => {
    const [seconds, setSeconds] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const [showAmountModal, setShowAmountModal] = useState(false);
    const [showPreModal, setShowPreModal] = useState(false);
    const [predictedFocus, setPredictedFocus] = useState<number | null>(null);
    const [showStrictToast, setShowStrictToast] = useState(false);
    const [theme, setTheme] = useState<'minimal' | 'ring' | 'flip'>(settings.timerTheme || 'ring');
    const mode = settings.timerMode || 'stopwatch';
    const db = getFirestore();
    
    // --- Live Presence Heartbeat ---
    useEffect(() => {
        if (!user || !isRunning) {
            // Remove presence if not studying
            if (user) deleteDoc(doc(db, 'artifacts', appId, 'presence', user.uid)).catch(() => {});
            return;
        }

        const updatePresence = async () => {
            await setDoc(doc(db, 'artifacts', appId, 'presence', user.uid), {
                uid: user.uid,
                displayName: user.displayName || '학습자',
                photoURL: user.photoURL || '',
                taskName: selectedTask.name,
                startedAt: Date.now() - (seconds * 1000),
                lastHeartbeat: serverTimestamp(),
                boosts: 0
            }, { merge: true });
        };

        updatePresence();
        const heartbeat = setInterval(updatePresence, 30000); // Every 30s
        return () => {
            clearInterval(heartbeat);
            deleteDoc(doc(db, 'artifacts', appId, 'presence', user.uid)).catch(() => {});
        };
    }, [isRunning, user, selectedTask.name, appId]);

    const formatTime = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return h > 0 
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const dailyStats = useMemo(() => {
        const startOfToday = new Date();
        startOfToday.setHours(0,0,0,0);
        const todaySessions = sessions.filter(s => s.taskId === selectedTask.id && s.timestamp >= startOfToday.getTime());
        const todayAmount = todaySessions.reduce((acc, s) => acc + (s.amount || 0), 0);
        let dailyGoal = 0;
        if (selectedTask.targetDate && selectedTask.totalAmount) {
            const targetDate = new Date(selectedTask.targetDate);
            targetDate.setHours(0,0,0,0);
            const diffTime = targetDate.getTime() - startOfToday.getTime();
            const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
            const amountDoneBeforeToday = Math.max(0, (selectedTask.currentAmount || 0) - todayAmount);
            const amountRemainingTotal = selectedTask.totalAmount - amountDoneBeforeToday;
            const effectiveDays = Math.max(1, daysLeft);
            dailyGoal = Math.ceil(Math.max(0, amountRemainingTotal) / effectiveDays);
        }
        return { todayAmount, dailyGoal };
    }, [selectedTask, sessions]);

    useEffect(() => {
        let interval: any = null;
        if (isRunning) {
            interval = setInterval(() => {
                setSeconds(s => {
                    if (mode === 'countdown' || mode === 'pomodoro') {
                        if (s <= 1) {
                            setIsRunning(false);
                            if (settings.timerSound) playSimpleTone('end');
                            setShowAmountModal(true);
                            return 0;
                        }
                        return s - 1;
                    }
                    return s + 1;
                });
            }, 1000);
        } else {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [isRunning, mode, settings.timerSound]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && isRunning && settings.timerStrictFocus) {
                setIsRunning(false);
                setShowStrictToast(true);
                setTimeout(() => setShowStrictToast(false), 4000);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isRunning, settings.timerStrictFocus]);

    useEffect(() => {
        if (!isRunning && seconds === 0) {
            if (mode === 'countdown') {
                setSeconds((settings.countdownMinutes || 60) * 60);
            } else if (mode === 'pomodoro') {
                setSeconds((settings.pomoFocus || 25) * 60);
            }
        }
    }, [mode, settings.countdownMinutes, settings.pomoFocus]);

    const handleTogglePlay = () => {
        if (!isRunning) {
            if (predictedFocus === null) {
                setShowPreModal(true);
            } else {
                if (settings.timerSound) playSimpleTone('start');
                setIsRunning(true);
            }
        } else {
            setIsRunning(false);
        }
    };

    const handlePreModalConfirm = (focus: number) => {
        setPredictedFocus(focus);
        setShowPreModal(false);
        if (settings.timerSound) playSimpleTone('start');
        setIsRunning(true);
    };

    const handleStop = () => {
        setIsRunning(false);
        let shouldSave = false;
        if (mode === 'stopwatch') {
            shouldSave = seconds > 0;
        } else {
            const maxSeconds = mode === 'countdown' 
                ? (settings.countdownMinutes || 60) * 60 
                : (settings.pomoFocus || 25) * 60;
            shouldSave = seconds < maxSeconds;
        }
        if (shouldSave) {
             if (settings.timerSound) playSimpleTone('end');
             setShowAmountModal(true);
        } else {
            onBack();
        }
    };

    const handleSaveSession = (amount: number, actualFocus: number, keyword?: string) => {
        setShowAmountModal(false);
        onBack();
        const saveProcess = async () => {
            try {
                let duration = seconds;
                if (mode === 'countdown') {
                    duration = ((settings.countdownMinutes || 60) * 60) - seconds;
                } else if (mode === 'pomodoro') {
                    duration = ((settings.pomoFocus || 25) * 60) - seconds;
                }
                await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'sessions'), {
                    taskId: selectedTask.id,
                    duration: duration,
                    amount: amount || 0,
                    mode: mode,
                    timestamp: Date.now(),
                    createdAt: serverTimestamp(),
                    predictedFocus: predictedFocus || 5, 
                    actualFocus: actualFocus || 5,
                    keyword: keyword || '' 
                });
                if (amount > 0) {
                    const taskRef = doc(db, 'artifacts', appId, 'users', user.uid, 'tasks', selectedTask.id);
                    const currentAmount = selectedTask.currentAmount || 0;
                    await updateDoc(taskRef, { currentAmount: currentAmount + amount });
                }
            } catch (e) {
                console.error("Session Save Error:", e);
            }
        };
        saveProcess();
    };

    const handleChangeMode = (newMode: 'stopwatch' | 'countdown' | 'pomodoro') => {
        setIsRunning(false);
        setPredictedFocus(null); 
        if (newMode === 'stopwatch') {
            setSeconds(0);
        } else if (newMode === 'countdown') {
            setSeconds((settings.countdownMinutes || 60) * 60);
        } else if (newMode === 'pomodoro') {
            setSeconds((settings.pomoFocus || 25) * 60);
        }
        onUpdateSettings({ ...settings, timerMode: newMode });
    };

    const handleSwitchTheme = (direction: 'next' | 'prev') => {
        const themes: ('minimal' | 'ring' | 'flip')[] = ['minimal', 'ring', 'flip'];
        const currentIdx = themes.indexOf(theme);
        let nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx >= themes.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = themes.length - 1;
        const newTheme = themes[nextIdx];
        setTheme(newTheme);
        onUpdateSettings({ ...settings, timerTheme: newTheme });
    };

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const onTouchStart = (e: React.TouchEvent) => { setTouchEnd(null); setTouchStart(e.targetTouches[0].clientX); };
    const onTouchMove = (e: React.TouchEvent) => { setTouchEnd(e.targetTouches[0].clientX); };
    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50) handleSwitchTheme('next');
        if (distance < -50) handleSwitchTheme('prev');
    };

    const isSessionStarted = ((mode === 'stopwatch' && seconds > 0) || ((mode === 'countdown' || mode === 'pomodoro') && seconds < ((mode === 'countdown' ? settings.countdownMinutes || 60 : settings.pomoFocus || 25) * 60)));

    return (
        <div 
            className={`h-full flex flex-col transition-colors duration-500 ${theme === 'minimal' && isRunning ? 'bg-indigo-950 text-white' : 'bg-white text-gray-900'}`}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
            <div className={`flex justify-between items-center p-6 transition-opacity duration-500 ${theme === 'minimal' && isRunning ? 'opacity-0 hover:opacity-100' : 'opacity-100'}`}>
                <button onClick={onBack} className={`p-2 rounded-full transition-colors ${theme === 'minimal' && isRunning ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <ChevronDown size={24} />
                </button>
                <div className="flex flex-col items-center">
                    <span className={`font-bold ${theme === 'minimal' && isRunning ? 'text-white' : 'text-gray-800'}`}>{selectedTask.name}</span>
                    <span className={`text-xs uppercase tracking-wider font-bold ${theme === 'minimal' && isRunning ? 'text-indigo-300' : 'text-gray-500'}`}>
                        {mode === 'stopwatch' ? 'Stopwatch' : (mode === 'countdown' ? 'Goal Timer' : 'Pomodoro')}
                    </span>
                </div>
                <button onClick={onOpenSettings} className={`p-2 rounded-full transition-colors ${theme === 'minimal' && isRunning ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-600'}`}>
                    <SettingsIcon size={24} />
                </button>
            </div>
            {showStrictToast && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full shadow-lg z-50 animate-in slide-in-from-top-2 fade-in">
                    <span className="text-xs font-bold flex items-center gap-1"><Pause size={12}/> 엄격 모드: 타이머 일시정지됨</span>
                </div>
            )}
            <div className="flex-1 flex flex-col items-center justify-center relative p-4">
                <div className={`absolute inset-x-4 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none transition-opacity duration-500 ${theme === 'minimal' && isRunning ? 'opacity-0' : 'opacity-100'}`}>
                    <button onClick={() => handleSwitchTheme('prev')} className="pointer-events-auto p-2 rounded-full text-gray-300 hover:text-indigo-500 hover:bg-gray-100 transition-all transform hover:scale-110"><ChevronLeft size={32}/></button>
                    <button onClick={() => handleSwitchTheme('next')} className="pointer-events-auto p-2 rounded-full text-gray-300 hover:text-indigo-500 hover:bg-gray-100 transition-all transform hover:scale-110"><ChevronRight size={32}/></button>
                </div>
                <div className="w-full h-full flex items-center justify-center">
                    {theme === 'ring' && <RingTimer seconds={seconds} isRunning={isRunning} mode={mode} formatTime={formatTime} settings={settings} size={250} />}
                    {theme === 'minimal' && <MinimalTimer seconds={seconds} isRunning={isRunning} formatTime={formatTime} />}
                    {theme === 'flip' && <FlipTimer seconds={seconds} isRunning={isRunning} formatTime={formatTime} />}
                </div>
                <div className={`absolute bottom-4 flex gap-2 transition-opacity duration-500 ${theme === 'minimal' && isRunning ? 'opacity-0' : 'opacity-100'}`}>
                    <div className={`w-2 h-2 rounded-full transition-all ${theme === 'minimal' ? 'bg-indigo-600 scale-125' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full transition-all ${theme === 'ring' ? 'bg-indigo-600 scale-125' : 'bg-gray-300'}`}></div>
                    <div className={`w-2 h-2 rounded-full transition-all ${theme === 'flip' ? 'bg-indigo-600 scale-125' : 'bg-gray-300'}`}></div>
                </div>
            </div>
            <div className={`p-6 pb-12 transition-all duration-500 flex flex-col items-center gap-6 ${theme === 'minimal' && isRunning ? 'opacity-0 hover:opacity-100 translate-y-4 hover:translate-y-0' : 'opacity-100 translate-y-0'}`}>
                 <div className="flex justify-center mb-0">
                     <div className={`flex items-center gap-1 p-1 rounded-2xl transition-all duration-500 ${theme === 'minimal' && isRunning ? 'bg-white/20' : 'bg-gray-100'}`}>
                        {[ { id: 'stopwatch', label: '스톱워치', icon: Clock }, { id: 'countdown', label: '목표', icon: Hourglass }, { id: 'pomodoro', label: '뽀모', icon: TimerIcon } ].map((m) => (
                             <button 
                                key={m.id}
                                onClick={() => handleChangeMode(m.id as any)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${mode === m.id ? (theme === 'minimal' && isRunning ? 'bg-white text-indigo-900 shadow-sm' : 'bg-white text-indigo-600 shadow-sm') : (theme === 'minimal' && isRunning ? 'text-white/70 hover:text-white' : 'text-gray-400 hover:text-gray-600')}`}
                             >
                                <m.icon size={14} /> {m.label}
                             </button>
                        ))}
                     </div>
                 </div>
                <div className="w-full max-w-[340px] h-20 relative flex items-end justify-center">
                    {!isSessionStarted ? (
                        <button 
                            onClick={handleTogglePlay}
                            className="w-full h-16 bg-indigo-600 text-white rounded-full font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                        >
                            <div className="p-1 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                                <Play size={20} fill="currentColor" className="ml-0.5"/>
                            </div>
                            START FOCUS
                        </button>
                    ) : (
                        <div className="w-full flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
                            <button 
                                onClick={handleTogglePlay}
                                className={`flex-1 h-16 rounded-full font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                                    isRunning 
                                        ? (theme === 'minimal' ? 'bg-white/10 text-white border border-white/20 backdrop-blur-md' : 'bg-amber-50 text-amber-600 border-2 border-amber-100 hover:bg-amber-100')
                                        : 'bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700'
                                }`}
                            >
                                {isRunning ? (
                                    <>
                                        <Pause size={20} fill="currentColor" />
                                        <span className="tracking-wide">PAUSE</span>
                                    </>
                                ) : (
                                    <>
                                        <Play size={20} fill="currentColor" className="ml-0.5"/>
                                        <span className="tracking-wide">RESUME</span>
                                    </>
                                )}
                            </button>
                            <button 
                                onClick={handleStop}
                                className={`flex-1 h-16 rounded-full flex items-center justify-center shadow-sm transition-all active:scale-95 ${
                                    theme === 'minimal' && isRunning
                                        ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-red-500/20 hover:text-white hover:border-red-500/30'
                                        : 'bg-gray-100 text-gray-400 border-2 border-transparent hover:bg-red-50 hover:text-red-500 hover:border-red-100'
                                }`}
                            >
                                <StopCircle size={24} fill="currentColor" className="opacity-80" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
             <AmountInputModal isOpen={showAmountModal} onClose={() => setShowAmountModal(false)} onSave={handleSaveSession} taskName={selectedTask.name} unit={selectedTask.unit} dailyGoal={dailyStats.dailyGoal} todayAmount={dailyStats.todayAmount} />
            <PreTimerModal isOpen={showPreModal} onClose={() => setShowPreModal(false)} onConfirm={handlePreModalConfirm} taskName={selectedTask.name} />
        </div>
    );
};
