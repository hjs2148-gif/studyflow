
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Settings, Clock, Hourglass, Timer as TimerIcon, PlayCircle, CheckCircle, XCircle, ArrowRight, Sparkles, Calendar, Edit2, Target, Database, Download, Upload, Trash2, Save, FileText, ChevronLeft, ChevronRight, Crown, Award, BrainCircuit, Activity, Zap, Check, Trophy, AlertCircle, BarChart2, Star, Footprints, LayoutDashboard, Grid, List, Flag, RefreshCcw, Smile, Meh, Frown, ThumbsUp, TrendingUp, Map, Compass, Hexagon, GripVertical, UserCheck, Volume2, Shield, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, BarChart, Bar, CartesianGrid, XAxis, YAxis, ScatterChart, Scatter, ZAxis, ReferenceLine, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { writeBatch, collection, getDocs, query, limit, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, linkWithPopup } from 'firebase/auth';
import { Settings as SettingsType, Session, Task } from '../types';
import { callGemini } from '../services/geminiService';

// --- Confirmation Modal ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ 
  isOpen, onClose, onConfirm, title, message, confirmText = "확인", cancelText = "취소", isDangerous = false 
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95">
        <h3 className={`text-lg font-bold mb-2 ${isDangerous ? 'text-red-600' : 'text-gray-900'}`}>{title}</h3>
        <p className="text-sm text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors">
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors shadow-lg ${isDangerous ? 'bg-red-500 hover:bg-red-600 shadow-red-200' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper components
const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <button onClick={(e) => { e.stopPropagation(); onChange(!checked); }} className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${checked ? 'bg-indigo-600' : 'bg-gray-300'}`}>
      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`}></div>
    </button>
);

interface WidgetReorderItemProps {
    label: string;
    checked: boolean;
    onToggle: () => void;
    onDragStart: (e: React.DragEvent) => void;
    onDragOver: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onDragEnd: (e: React.DragEvent) => void;
}

const WidgetReorderItem: React.FC<WidgetReorderItemProps> = ({ 
    label, 
    checked, 
    onToggle, 
    onDragStart, 
    onDragOver, 
    onDrop, 
    onDragEnd 
}) => (
    <div 
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        className="flex justify-between items-center p-3 bg-white border border-gray-100 rounded-xl hover:bg-gray-50 transition-all cursor-grab active:cursor-grabbing group select-none"
    >
        <div className="flex items-center gap-3 flex-1">
            <div className="text-gray-300 group-hover:text-indigo-500 transition-colors p-1 cursor-grab">
                <GripVertical size={20} />
            </div>
            <span className="text-sm font-bold text-gray-700">{label}</span>
        </div>
        <div onPointerDown={(e) => e.stopPropagation()} className="pl-4 border-l border-gray-100">
            <Toggle checked={checked} onChange={onToggle} />
        </div>
    </div>
);

// --- Settings Modal ---
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SettingsType;
  onUpdateSettings: (s: SettingsType) => void;
  user: any;
  db: any;
  appId: string;
  initialTab?: 'dday' | 'goal' | 'timer' | 'data' | 'widgets';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onUpdateSettings, user, db, appId, initialTab = 'dday' }) => {
  if (!isOpen) return null;
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);
  const [activeTab, setActiveTab] = useState<'dday' | 'goal' | 'timer' | 'data' | 'widgets'>('dday');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Google Drive Integration States
  const [driveToken, setDriveToken] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [lastDriveBackup, setLastDriveBackup] = useState<string | null>(null);

  useEffect(() => {
      if (isOpen) {
          setLocalSettings(settings);
          setActiveTab(initialTab);
      }
  }, [isOpen, settings, initialTab]);

  const handleChange = (field: keyof SettingsType, value: any) => {
    setLocalSettings(prev => ({ ...prev, [field]: value }));
  };
  
  const toggleWidget = (category: 'report' | 'today' | 'tasks', key: string) => {
      const fieldName = `${category}Widgets` as keyof SettingsType;
      setLocalSettings(prev => ({
          ...prev,
          [fieldName]: {
              ...(prev[fieldName] as object || {}),
              [key]: !((prev[fieldName] as any)?.[key] ?? true)
          }
      }));
  };

  const handleDragSort = (category: 'report' | 'today' | 'tasks', fromIndex: number, toIndex: number) => {
      const fieldName = `${category}WidgetOrder` as keyof SettingsType;
      const list = [...(localSettings[fieldName] as string[] || [])];
      const [movedItem] = list.splice(fromIndex, 1);
      list.splice(toIndex, 0, movedItem);
      setLocalSettings(prev => ({ ...prev, [fieldName]: list }));
  };

  const handleNumberChange = (field: keyof SettingsType, value: string) => {
    if (value === '') {
      setLocalSettings(prev => ({ ...prev, [field]: '' as any }));
    } else {
      setLocalSettings(prev => ({ ...prev, [field]: Number(value) }));
    }
  };

  const handleSave = () => {
    const safeSettings = { ...localSettings };
    if (!safeSettings.dailyGoalMinutes) safeSettings.dailyGoalMinutes = 480;
    if (safeSettings.levelSystem === 'cumulative' && !safeSettings.targetExamHours) {
        safeSettings.targetExamHours = 3000;
    }
    if (!safeSettings.todayWidgetOrder) safeSettings.todayWidgetOrder = ['header', 'stats', 'streak', 'tasks'];
    if (!safeSettings.reportWidgetOrder) safeSettings.reportWidgetOrder = ['time', 'wins', 'goals', 'trends', 'top5', 'rpg'];
    if (!safeSettings.tasksWidgetOrder) safeSettings.tasksWidgetOrder = ['dashboard'];

    onUpdateSettings(safeSettings);
    onClose();
  };

  // --- Google Drive Logic ---
  const connectGoogleDrive = async () => {
      setDriveLoading(true);
      const auth = getAuth();
      const provider = new GoogleAuthProvider();
      provider.addScope('https://www.googleapis.com/auth/drive.file');
      
      try {
          let result;
          if (user?.isAnonymous) {
              result = await linkWithPopup(auth.currentUser!, provider);
          } else {
              result = await signInWithPopup(auth, provider);
          }
          const credential = GoogleAuthProvider.credentialFromResult(result);
          if (credential?.accessToken) {
              setDriveToken(credential.accessToken);
              alert("구글 드라이브 연결 성공!");
          }
      } catch (e) {
          console.error(e);
          alert("연동에 실패했습니다.");
      } finally {
          setDriveLoading(false);
      }
  };

  const fetchFullBackupData = async () => {
      if (!user || !db || !appId) return null;
      const userId = user.uid;
      const tasksSnap = await getDocs(collection(db, 'artifacts', appId, 'users', userId, 'tasks'));
      const sessionsSnap = await getDocs(collection(db, 'artifacts', appId, 'users', userId, 'sessions'));
      const tasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const sessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { tasks, sessions, settings: localSettings, backupDate: new Date().toISOString() };
  };

  const handleDriveBackup = async () => {
      if (!driveToken) { connectGoogleDrive(); return; }
      setDriveLoading(true);
      try {
          const data = await fetchFullBackupData();
          if (!data) return;

          const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='studyflow_backup.json' and trashed=false`, {
              headers: { Authorization: `Bearer ${driveToken}` }
          });
          const searchJson = await searchRes.json();
          const existingFile = searchJson.files?.[0];

          const metadata = { name: 'studyflow_backup.json', mimeType: 'application/json' };
          const body = JSON.stringify(data);
          
          let uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
          let method = 'POST';

          if (existingFile) {
              uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
              method = 'PATCH';
          } else {
              const createMetaRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify(metadata)
              });
              const metaJson = await createMetaRes.json();
              uploadUrl = `https://www.googleapis.com/upload/drive/v3/files/${metaJson.id}?uploadType=media`;
              method = 'PATCH';
          }

          const uploadRes = await fetch(uploadUrl, {
              method,
              headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
              body
          });

          if (uploadRes.ok) {
              setLastDriveBackup(new Date().toLocaleString());
              alert("클라우드 백업 완료!");
          } else {
              throw new Error("Upload failed");
          }
      } catch (e) {
          console.error(e);
          alert("백업 중 오류가 발생했습니다. 다시 로그인 해주세요.");
          setDriveToken(null);
      } finally {
          setDriveLoading(false);
      }
  };

  const handleDriveRestore = async () => {
      if (!driveToken) { connectGoogleDrive(); return; }
      if (!confirm("클라우드 데이터를 가져오면 현재 기기의 데이터가 모두 삭제됩니다. 계속하시겠습니까?")) return;
      
      setDriveLoading(true);
      try {
          const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=name='studyflow_backup.json' and trashed=false`, {
              headers: { Authorization: `Bearer ${driveToken}` }
          });
          const searchJson = await searchRes.json();
          const existingFile = searchJson.files?.[0];

          if (!existingFile) {
              alert("드라이브에서 백업 파일을 찾을 수 없습니다.");
              return;
          }

          const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${existingFile.id}?alt=media`, {
              headers: { Authorization: `Bearer ${driveToken}` }
          });
          const data = await downloadRes.json();

          const userId = user.uid;
          const deleteCollection = async (collectionName: string) => {
              const ref = collection(db, 'artifacts', appId, 'users', userId, collectionName);
              while (true) {
                  const q = query(ref, limit(100));
                  const snapshot = await getDocs(q);
                  if (snapshot.empty) break;
                  const batch = writeBatch(db);
                  snapshot.docs.forEach((d) => batch.delete(d.ref));
                  await batch.commit();
              }
          };
          await deleteCollection('tasks');
          await deleteCollection('sessions');

          const allItems = [
              ...(data.tasks || []).map((t: any) => ({ type: 'task', data: t })),
              ...(data.sessions || []).map((s: any) => ({ type: 'session', data: s }))
          ];
          
          const chunkSize = 400;
          for (let i = 0; i < allItems.length; i += chunkSize) {
              const chunk = allItems.slice(i, i + chunkSize);
              const currentBatch = writeBatch(db);
              if (i === 0 && data.settings) {
                   currentBatch.set(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config'), data.settings, { merge: true });
              }
              chunk.forEach((item: any) => {
                  const ref = doc(db, 'artifacts', appId, 'users', userId, item.type === 'task' ? 'tasks' : 'sessions', item.data.id);
                  const payload = { ...item.data };
                  delete payload.id; 
                  currentBatch.set(ref, payload);
              });
              await currentBatch.commit();
          }
          alert("데이터 복원 성공! 앱을 새로고침합니다.");
          window.location.reload();
      } catch (e) {
          console.error(e);
          alert("복원 실패. 권한이 만료되었거나 파일이 손상되었습니다.");
          setDriveToken(null);
      } finally {
          setDriveLoading(false);
      }
  };

  const handleBackup = () => {
      const fetchAndDownload = async () => {
          if (!user || !db || !appId) return;
          try {
             const data = await fetchFullBackupData();
             if (!data) return;
             const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
             const url = URL.createObjectURL(blob);
             const link = document.createElement('a');
             link.href = url;
             link.download = `study-backup-${new Date().toISOString().split('T')[0]}.json`;
             link.click();
          } catch(e) { console.error(e); alert("백업 오류"); }
      };
      fetchAndDownload();
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const fileInput = e.target;
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const json = event.target?.result as string;
              const data = JSON.parse(json);
              const userId = user.uid;
              const deleteCollection = async (collectionName: string) => {
                  const ref = collection(db, 'artifacts', appId, 'users', userId, collectionName);
                  while (true) {
                      const q = query(ref, limit(100));
                      const snapshot = await getDocs(q);
                      if (snapshot.empty) break;
                      const batch = writeBatch(db);
                      snapshot.docs.forEach((ds) => batch.delete(ds.ref));
                      await batch.commit();
                  }
              };
              await deleteCollection('tasks');
              await deleteCollection('sessions');
              const allItems = [...(data.tasks || []).map((t: any) => ({ type: 'task', data: t })), ...(data.sessions || []).map((s: any) => ({ type: 'session', data: s }))];
              const chunkSize = 400;
              for (let i = 0; i < allItems.length; i += chunkSize) {
                  const chunk = allItems.slice(i, i + chunkSize);
                  const currentBatch = writeBatch(db);
                  if (i === 0 && data.settings) {
                       currentBatch.set(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config'), data.settings, { merge: true });
                  }
                  chunk.forEach((item: any) => {
                      const ref = doc(db, 'artifacts', appId, 'users', userId, item.type === 'task' ? 'tasks' : 'sessions', item.data.id);
                      const p = { ...item.data }; delete p.id; currentBatch.set(ref, p);
                  });
                  await currentBatch.commit();
              }
              alert("복원 완료! 앱을 새로고침합니다.");
              window.location.reload();
          } catch (err) { alert("복원 실패"); } 
          finally { fileInput.value = ''; }
      };
      reader.readAsText(file);
  };

  const performReset = async () => {
      if (!user || !db || !appId) return;
      try {
          const userId = user.uid;
          const deleteCollection = async (collectionName: string) => {
              const ref = collection(db, 'artifacts', appId, 'users', userId, collectionName);
              while (true) {
                  const q = query(ref, limit(100));
                  const snapshot = await getDocs(q);
                  if (snapshot.empty) break;
                  const batch = writeBatch(db);
                  snapshot.docs.forEach((d) => batch.delete(d.ref));
                  await batch.commit();
              }
          };
          await deleteCollection('tasks');
          await deleteCollection('sessions');
          try { await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'config')); } catch(e){}
          alert("초기화 완료");
          window.location.reload();
      } catch (e) { alert("오류 발생"); }
  };

  return (
    <>
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl h-[80vh] shadow-2xl overflow-hidden flex flex-col sm:flex-row">
        
        <div className="w-full sm:w-[140px] bg-gray-50 border-r border-gray-100 flex flex-row sm:flex-col overflow-x-auto sm:overflow-visible shrink-0 no-scrollbar">
             <div className="p-4 sm:mb-2 hidden sm:block">
                 <h3 className="font-bold text-gray-400 text-xs uppercase tracking-wider">Settings</h3>
             </div>
             
             <button onClick={() => setActiveTab('dday')} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:gap-3 p-3 sm:px-4 sm:py-4 transition-all ${activeTab === 'dday' ? 'bg-white text-indigo-600 border-b-2 sm:border-b-0 sm:border-r-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-b-2 sm:border-b-0 border-transparent'}`}>
                <Calendar size={20} />
                <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">D-Day</span>
             </button>
             <button onClick={() => setActiveTab('goal')} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:gap-3 p-3 sm:px-4 sm:py-4 transition-all ${activeTab === 'goal' ? 'bg-white text-indigo-600 border-b-2 sm:border-b-0 sm:border-r-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-b-2 sm:border-b-0 border-transparent'}`}>
                <Target size={20} />
                <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">목표설정</span>
             </button>
             <button onClick={() => setActiveTab('timer')} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:gap-3 p-3 sm:px-4 sm:py-4 transition-all ${activeTab === 'timer' ? 'bg-white text-indigo-600 border-b-2 sm:border-b-0 sm:border-r-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-b-2 sm:border-b-0 border-transparent'}`}>
                <Clock size={20} />
                <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">타이머</span>
             </button>
             <button onClick={() => setActiveTab('widgets')} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:gap-3 p-3 sm:px-4 sm:py-4 transition-all ${activeTab === 'widgets' ? 'bg-white text-indigo-600 border-b-2 sm:border-b-0 sm:border-r-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-b-2 sm:border-b-0 border-transparent'}`}>
                <LayoutDashboard size={20} />
                <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">화면 구성</span>
             </button>
             <button onClick={() => setActiveTab('data')} className={`flex-1 sm:flex-none flex flex-col sm:flex-row items-center justify-center sm:justify-start sm:gap-3 p-3 sm:px-4 sm:py-4 transition-all ${activeTab === 'data' ? 'bg-white text-indigo-600 border-b-2 sm:border-b-0 sm:border-r-2 border-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-100 border-b-2 sm:border-b-0 border-transparent'}`}>
                <Database size={20} />
                <span className="text-[10px] sm:text-xs font-bold mt-1 sm:mt-0">데이터</span>
             </button>
        </div>

        <div className="flex-1 flex flex-col h-full bg-white relative">
            <div className="flex justify-between items-center p-5 border-b border-gray-50">
                <h3 className="text-lg font-bold text-gray-800">
                    {activeTab === 'dday' && '시험 D-Day 설정'}
                    {activeTab === 'goal' && '학습 목표 및 레벨 시스템'}
                    {activeTab === 'timer' && '타이머 모드 설정'}
                    {activeTab === 'widgets' && '위젯 & 화면 구성'}
                    {activeTab === 'data' && '데이터 관리'}
                </h3>
                <button onClick={onClose} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'dday' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                        <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase">시험 이름</label><input type="text" value={localSettings.examName || ''} onChange={(e) => handleChange('examName', e.target.value)} placeholder="예: 중간고사" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition-all font-medium" /></div>
                        <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase">시험 날짜</label><input type="date" value={localSettings.examDate || ''} onChange={(e) => handleChange('examDate', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:border-indigo-500 transition-all font-medium" /></div>
                    </div>
                )}
                {activeTab === 'goal' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-3 pb-4 border-b border-gray-50"><h4 className="font-bold text-gray-800 text-sm">레벨 시스템 설정</h4><div className="flex gap-2"><button onClick={() => handleChange('levelSystem', 'cumulative')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${(!localSettings.levelSystem || localSettings.levelSystem === 'cumulative') ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:bg-gray-50 text-gray-500'}`}><Flag size={20} className="mb-1" /><span className="text-xs font-bold">합격 도전 모드</span></button><button onClick={() => handleChange('levelSystem', 'monthly')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${localSettings.levelSystem === 'monthly' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:bg-gray-50 text-gray-500'}`}><Footprints size={20} className="mb-1" /><span className="text-xs font-bold">성실성 모드</span></button></div></div>
                        <div><label className="block text-xs font-bold text-gray-400 mb-1 uppercase">일일 목표 (분)</label><div className="relative"><input type="number" value={localSettings.dailyGoalMinutes} onChange={(e) => handleNumberChange('dailyGoalMinutes', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-4 pr-12 font-bold text-xl focus:outline-none focus:border-indigo-500 transition-all" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">분</span></div></div>
                    </div>
                )}
                {activeTab === 'timer' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100"><div className="flex flex-col"><span className="text-sm font-bold text-gray-800 flex items-center gap-1"><Shield size={14}/> 엄격한 집중 모드</span><span className="text-[10px] text-gray-400">앱 이탈 시 자동 일시정지</span></div><Toggle checked={localSettings.timerStrictFocus || false} onChange={(v) => handleChange('timerStrictFocus', v)} /></div>
                        <div className="grid grid-cols-3 gap-2">{[ { id: 'stopwatch', label: '스톱워치', icon: Clock }, { id: 'countdown', label: '목표 타이머', icon: Hourglass }, { id: 'pomodoro', label: '뽀모도로', icon: TimerIcon } ].map(mode => (<button key={mode.id} onClick={() => handleChange('timerMode', mode.id as any)} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${localSettings.timerMode === mode.id ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:bg-gray-50'}`}><mode.icon size={20} className="mb-1" /><span className="text-[10px] font-bold">{mode.label}</span></button>)) }</div>
                    </div>
                )}
                {activeTab === 'widgets' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm mb-4"><h4 className="font-bold text-gray-800 text-sm mb-3">기본 보기 모드</h4><div className="flex gap-2"><button onClick={() => handleChange('displayMode', 'detail')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${(!localSettings.displayMode || localSettings.displayMode === 'detail') ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:bg-gray-50'}`}><List size={20} className="mb-1" /><span className="text-xs font-bold">상세 모드</span></button><button onClick={() => handleChange('displayMode', 'compact')} className={`flex-1 flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${localSettings.displayMode === 'compact' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 hover:bg-gray-50'}`}><Grid size={20} className="mb-1" /><span className="text-xs font-bold">단축 모드</span></button></div></div>
                    </div>
                )}
                {activeTab === 'data' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm">
                            <div className="flex items-center gap-2 mb-4">
                                <Cloud className="text-indigo-600" size={20} />
                                <h4 className="text-sm font-black text-indigo-900 uppercase">Google Drive Cloud Sync</h4>
                            </div>
                            
                            {!driveToken ? (
                                <button 
                                    onClick={connectGoogleDrive}
                                    disabled={driveLoading}
                                    className="w-full py-3 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white shadow-sm transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {driveLoading ? <RefreshCw size={18} className="animate-spin" /> : <CloudOff size={18} />}
                                    구글 드라이브 연동하기
                                </button>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider flex items-center gap-1"><Check size={12}/> Connected</span>
                                        {lastDriveBackup && <span className="text-[10px] font-bold text-gray-400">최근: {lastDriveBackup}</span>}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={handleDriveBackup}
                                            disabled={driveLoading}
                                            className="py-3 bg-indigo-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-700 shadow-md transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {driveLoading ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                            클라우드 백업
                                        </button>
                                        <button 
                                            onClick={handleDriveRestore}
                                            disabled={driveLoading}
                                            className="py-3 bg-white border border-indigo-600 text-indigo-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {driveLoading ? <RefreshCw size={16} className="animate-spin" /> : <Download size={16} />}
                                            클라우드 복원
                                        </button>
                                    </div>
                                    <button onClick={() => setDriveToken(null)} className="w-full text-center text-[10px] text-gray-400 font-bold hover:underline">연동 해제</button>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                             <div className="flex flex-col gap-3">
                                <button onClick={handleBackup} className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"><Download size={16} /> 로컬 파일로 저장 (.json)</button>
                                <label className="w-full py-3 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors cursor-pointer shadow-sm"><Upload size={16} /> 로컬 파일에서 복원<input type="file" accept=".json" onChange={handleRestore} className="hidden" /></label>
                                <hr className="border-gray-200 my-1"/>
                                <button onClick={() => setShowResetConfirm(true)} className="w-full py-3 bg-red-50 text-red-600 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors shadow-sm border border-red-100"><Trash2 size={16} /> 모든 데이터 초기화</button>
                             </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-4 border-t border-gray-50 bg-gray-50/50">
                <button onClick={handleSave} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                    <Save size={18} /> 설정 저장하기
                </button>
                <div className="mt-3 text-center">
                    <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">StudyFlow v2.5.3</span>
                </div>
            </div>
        </div>
      </div>
      <ConfirmationModal isOpen={showResetConfirm} onClose={() => setShowResetConfirm(false)} onConfirm={performReset} title="데이터 초기화" message={`정말로 모든 데이터를 초기화하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`} confirmText="예, 초기화합니다" cancelText="닫기" isDangerous={true} />
    </div>
    </>
  );
};

interface AmountInputModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (amount: number, actualFocus: number, keyword?: string) => void;
    taskName: string;
    unit: string;
    dailyGoal?: number;
    todayAmount?: number;
}
export const AmountInputModal: React.FC<AmountInputModalProps> = ({ isOpen, onClose, onSave, taskName, unit, dailyGoal, todayAmount }) => {
    const [amount, setAmount] = useState('');
    const [focus, setFocus] = useState(5);
    const [keyword, setKeyword] = useState('');
    useEffect(() => { if (isOpen) { setAmount(''); setFocus(5); setKeyword(''); } }, [isOpen]);
    const handleSave = () => { const val = parseFloat(amount); if (isNaN(val) || val < 0) { alert("올바른 학습량을 입력해주세요."); return; } onSave(val, focus, keyword); };
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-gray-800 mb-1">학습 기록 저장</h3>
                <p className="text-sm text-indigo-600 font-medium mb-6">{taskName}</p>
                <div className="mb-4"><label className="block text-xs font-bold text-gray-500 mb-2">얼마나 학습했나요? ({unit})</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-xl font-bold focus:outline-none focus:border-indigo-500 transition-all text-center" placeholder="0" autoFocus /></div>
                <div className="mb-6"><label className="block text-xs font-bold text-gray-500 mb-2">집중도는 어땠나요? ({focus}점)</label><input type="range" min="1" max="10" value={focus} onChange={(e) => setFocus(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" /></div>
                <div className="mb-8"><label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-1"><BrainCircuit size={12} className="text-indigo-500"/> 오늘의 핵심 키워드 (인출 연습)</label><input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} className="w-full bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-all placeholder-indigo-300" placeholder="배운 내용 한 줄 요약..." /></div>
                <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors">취소</button><button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors">저장하기</button></div>
            </div>
        </div>
    );
};

interface PreTimerModalProps { isOpen: boolean; onClose: () => void; onConfirm: (focus: number) => void; taskName: string; }
export const PreTimerModal: React.FC<PreTimerModalProps> = ({ isOpen, onClose, onConfirm, taskName }) => { const [focus, setFocus] = useState(5); if (!isOpen) return null; return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95"> <div className="flex flex-col items-center mb-6"> <div className="w-12 h-12 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mb-3"> <BrainCircuit size={24} /> </div> <h3 className="text-lg font-bold text-gray-800">메타인지 예측</h3> <p className="text-sm text-gray-500 text-center mt-1"><span className="font-bold text-indigo-600">{taskName}</span> 학습,<br/>어느 정도 집중할 수 있을 것 같나요?</p> </div> <div className="mb-8 px-2"> <div className="flex justify-center mb-4"><span className="text-4xl font-bold text-amber-500">{focus}</span><span className="text-sm text-gray-400 font-bold mt-4 ml-1">점</span></div> <input type="range" min="1" max="10" value={focus} onChange={(e) => setFocus(Number(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500" /> <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-medium"><span>자신없음</span><span>최고컨디션</span></div> </div> <button onClick={() => onConfirm(focus)} className="w-full py-3.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg shadow-amber-200 transition-colors flex items-center justify-center gap-2">학습 시작하기 <ArrowRight size={18} /></button> </div> </div> ); };

interface StatusSelectModalProps { isOpen: boolean; onClose: () => void; onSelect: (status: string) => void; taskName?: string; currentStatus: string; }
export const StatusSelectModal: React.FC<StatusSelectModalProps> = ({ isOpen, onClose, onSelect, taskName, currentStatus }) => { if (!isOpen) return null; const options = [ { id: 'active', label: '진행중 (Active)', icon: PlayCircle, color: 'text-indigo-600', bg: 'bg-indigo-50' }, { id: 'completed', label: '완료됨 (Completed)', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' }, { id: 'incomplete', label: '보류/중단 (Incomplete)', icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100' }, ]; return ( <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-2xl scale-100 animate-in slide-in-from-bottom-10 sm:zoom-in-95"> <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-50"><div><h3 className="font-bold text-gray-800">상태 변경</h3><p className="text-xs text-gray-400">{taskName}</p></div><button onClick={onClose} className="p-1 bg-gray-50 rounded-full text-gray-400 hover:text-gray-600"><X size={18}/></button></div> <div className="space-y-2 mb-4">{options.map((opt) => (<button key={opt.id} onClick={() => onSelect(opt.id)} className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all ${currentStatus === opt.id ? 'bg-gray-50 border-2 border-gray-200' : 'hover:bg-gray-50 border border-transparent'}`}><div className={`p-2 rounded-full ${opt.bg} ${opt.color}`}><opt.icon size={18} /></div><span className={`font-bold text-sm ${currentStatus === opt.id ? 'text-gray-900' : 'text-gray-600'}`}>{opt.label}</span>{currentStatus === opt.id && <Check size={16} className="ml-auto text-indigo-600" />}</button>))}</div> <button onClick={() => onSelect('delete')} className="w-full p-3 rounded-xl flex items-center justify-center gap-2 text-red-500 font-bold text-sm hover:bg-red-50 transition-colors border border-red-100"><Trash2 size={16} /> 과목 영구 삭제</button> </div> </div> ); };

interface ManualRecordModalProps { isOpen: boolean; onClose: () => void; onSave: (data: { date: string; startTime: string; endTime: string; amount: number }) => void; taskName: string; unit: string; }
export const ManualRecordModal: React.FC<ManualRecordModalProps> = ({ isOpen, onClose, onSave, taskName, unit }) => { const [date, setDate] = useState(new Date().toISOString().split('T')[0]); const [startTime, setStartTime] = useState('09:00'); const [endTime, setEndTime] = useState('10:00'); const [amount, setAmount] = useState(''); const handleSave = () => { if (!date || !startTime || !endTime) return; onSave({ date, startTime, endTime, amount: Number(amount) }); onClose(); }; if (!isOpen) return null; return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95"> <h3 className="font-bold text-gray-800 text-lg mb-1">학습 기록 직접 추가</h3><p className="text-xs text-gray-500 mb-6">{taskName}</p> <div className="space-y-4 mb-6"> <div><label className="block text-xs font-bold text-gray-400 mb-1">날짜</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500" /></div> <div className="flex gap-3"><div className="flex-1"><label className="block text-xs font-bold text-gray-400 mb-1">시작 시간</label><input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500" /></div><div className="flex-1"><label className="block text-xs font-bold text-gray-400 mb-1">종료 시간</label><input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500" /></div></div> <div><label className="block text-xs font-bold text-gray-400 mb-1">학습량 ({unit})</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500" /></div> </div> <div className="flex gap-3"><button onClick={onClose} className="flex-1 py-3 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors">취소</button><button onClick={handleSave} className="flex-1 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-colors">기록하기</button></div> </div> </div> ); };

interface AIModalProps { isOpen: boolean; onClose: () => void; title: string; content: string; isLoading: boolean; }
export const AIModal: React.FC<AIModalProps> = ({ isOpen, onClose, title, content, isLoading }) => { if (!isOpen) return null; return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl scale-100 animate-in zoom-in-95"> <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-indigo-600 rounded-t-2xl"><h3 className="font-bold text-white flex items-center gap-2"><Sparkles size={18} /> {title}</h3><button onClick={onClose} className="text-white/70 hover:text-white"><X size={20} /></button></div> <div className="flex-1 overflow-y-auto p-6">{isLoading ? (<div className="flex flex-col items-center justify-center py-10 space-y-4"><div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div><p className="text-sm font-bold text-indigo-600 animate-pulse">AI 분석 중...</p></div>) : (<div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</div>)}</div> <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl"><button onClick={onClose} className="w-full py-3 bg-white border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-100 transition-colors">닫기</button></div> </div> </div> ); };

interface LevelAnalysisModalProps { isOpen: boolean; onClose: () => void; settings: SettingsType; sessions: Session[]; }
export const LevelAnalysisModal: React.FC<LevelAnalysisModalProps> = ({ isOpen, onClose, settings, sessions }) => { if (!isOpen) return null; const totalHours = sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / 3600; const targetHours = settings.targetExamHours || 3000; const progress = Math.min(100, (totalHours / targetHours) * 100); const level = Math.min(99, Math.floor((totalHours / targetHours) * 98 + 1)); return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 relative overflow-hidden"> <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-100 rounded-full blur-3xl -mr-10 -mt-10"></div> <div className="flex justify-between items-start mb-6 relative z-10"><div><h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Map size={20} className="text-indigo-600"/> 학습 전략 분석실</h3><p className="text-xs text-gray-500 mt-1">현재 학습 레벨 분석</p></div><button onClick={onClose} className="p-1 bg-gray-50 rounded-full hover:bg-gray-100 text-gray-500"><X size={18} /></button></div> <div className="flex flex-col items-center mb-8 relative z-10"><div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200 mb-3 border-4 border-indigo-100"><span className="text-3xl font-black text-white">Lv.{level}</span></div><p className="font-bold text-gray-800 text-sm">합격 도전 모드 (Cumulative)</p><p className="text-xs text-gray-500 mt-1">목표 {targetHours}시간 중 {Math.floor(totalHours)}시간 달성</p></div> <div className="mb-6 relative z-10"><div className="flex justify-between text-xs font-bold text-gray-500 mb-2"><span>진행률</span><span>{progress.toFixed(1)}%</span></div><div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full transition-all duration-1000" style={{width: `${progress}%`}}></div></div></div> <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 relative z-10"><p className="text-xs text-indigo-800 font-medium leading-relaxed">현재 페이스라면 목표 달성까지 꾸준한 노력이 필요합니다. 레벨이 오를수록 합격 확률도 높아집니다!</p></div> </div> </div> ); };

interface RPGStatsModalProps { isOpen: boolean; onClose: () => void; settings: SettingsType; sessions: Session[]; tasks: Task[]; }
export const RPGStatsModal: React.FC<RPGStatsModalProps> = ({ isOpen, onClose, settings, sessions, tasks }) => { if (!isOpen) return null; const dailyGoalSeconds = (settings.dailyGoalMinutes || 480) * 60; const rpgStats = useMemo(() => { const now = new Date(); const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(now.getDate() - 30); const filteredSessions = settings.levelSystem === 'monthly' ? sessions.filter(s => new Date(s.timestamp) >= thirtyDaysAgo) : sessions; const totalTime = filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0); let periodGoalSeconds = dailyGoalSeconds; if (settings.levelSystem === 'cumulative') { periodGoalSeconds = (settings.targetExamHours || 3000) * 3600; } else { periodGoalSeconds = dailyGoalSeconds * 30; } const stamina = periodGoalSeconds > 0 ? Math.min(100, (totalTime / periodGoalSeconds) * 100) : 0; const avgSessionDuration = filteredSessions.length > 0 ? filteredSessions.reduce((acc, s) => acc + (s.duration || 0), 0) / filteredSessions.length : 0; const focus = Math.min(100, (avgSessionDuration / (50 * 60)) * 100); let totalDays = 30; if (settings.levelSystem === 'cumulative' && filteredSessions.length > 0) { const firstSession = new Date(Math.min(...filteredSessions.map(s => s.timestamp))); const diffTime = Math.abs(now.getTime() - firstSession.getTime()); totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))); } const consistency = Math.min(100, Math.round((filteredSessions.length / Math.max(1, totalDays)) * 100)); const uniqueTasks = new Set(filteredSessions.map(s => s.taskId)).size; const intelligence = Math.min(100, uniqueTasks * 20); const willpower = Math.min(100, (filteredSessions.filter(s => { const h = new Date(s.timestamp).getHours(); return h < 7 || h >= 22; }).length * 5)); return [ { subject: '지구력', A: stamina, fullMark: 100 }, { subject: '집중력', A: focus, fullMark: 100 }, { subject: '꾸준함', A: consistency, fullMark: 100 }, { subject: '지능', A: intelligence, fullMark: 100 }, { subject: '의지력', A: willpower, fullMark: 100 }, ]; }, [sessions, settings, dailyGoalSeconds]); return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 relative"> <div className="flex justify-between items-center mb-6"> <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"> <Hexagon size={20} className="text-rose-500"/> 나의 학습 능력치 </h3> <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-400"> <X size={20}/> </button> </div> <div className="h-64 w-full relative"> <ResponsiveContainer width="100%" height="100%"> <RadarChart cx="50%" cy="50%" outerRadius="80%" data={rpgStats}> <PolarGrid stroke="#e5e7eb" /> <PolarAngleAxis dataKey="subject" tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 'bold' }} /> <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} /> <Radar name="My Stats" dataKey="A" stroke="#f43f5e" strokeWidth={3} fill="#f43f5e" fillOpacity={0.4} /> </RadarChart> </ResponsiveContainer> <div className="absolute inset-0 flex items-center justify-center pointer-events-none"> <div className="bg-white/80 backdrop-blur-sm px-2 py-1 rounded-full border border-rose-100 shadow-sm"> <span className="text-xs font-bold text-rose-600">Avg: {Math.round(rpgStats.reduce((a, b) => a + b.A, 0) / 5)}</span> </div> </div> </div> </div> </div> ); };

interface AIMenuModalProps { isOpen: boolean; onClose: () => void; onSelectReport: (period: 'daily' | 'weekly' | 'monthly', date?: Date) => void; onSelectJourney: (period: 'daily' | 'weekly' | 'monthly') => Promise<any>; onSelectPattern: (type: 'focus' | 'time', period: 'daily' | 'weekly' | 'monthly') => Promise<any>; onSelectLevelAnalysis: () => void; onSelectRPG: () => void; metacognitionData?: any; metacognitionInsight?: string; }
export const AIMenuModal: React.FC<AIMenuModalProps> = ({ isOpen, onClose, onSelectReport, onSelectJourney, onSelectPattern, onSelectLevelAnalysis, onSelectRPG, metacognitionData, metacognitionInsight }) => { const [loading, setLoading] = useState(false); const [result, setResult] = useState<any>(null); const [resultType, setResultType] = useState<'journey' | 'pattern' | null>(null); const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]); useEffect(() => { if (isOpen) { setResult(null); setResultType(null); setLoading(false); setTargetDate(new Date().toISOString().split('T')[0]); } }, [isOpen]); const handleJourney = async () => { setLoading(true); try { const res = await onSelectJourney('monthly'); setResult(res); setResultType('journey'); } catch (e) { console.error(e); } setLoading(false); }; const handlePattern = async (type: 'focus' | 'time') => { setLoading(true); try { const res = await onSelectPattern(type, 'monthly'); setResult(res); setResultType('pattern'); } catch (e) { console.error(e); } setLoading(false); }; if (!isOpen) return null; if (result) { return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95 max-h-[80vh] overflow-y-auto"> <div className="flex justify-between items-center mb-4"> <h3 className="font-bold text-lg text-gray-800">AI 분석 결과</h3> <button onClick={() => setResult(null)} className="p-1 hover:bg-gray-100 rounded-full"><X size={20}/></button> </div> {resultType === 'journey' && ( <div className="space-y-4"> <div className="text-center"> <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">이달의 칭호</span> <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mt-1">{result.title}</h2> </div> <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap"> {result.narrative} </div> <div className="grid grid-cols-2 gap-3 text-xs"> <div className="bg-gray-50 p-2 rounded-lg text-center"><span className="block text-gray-400 mb-1">최애 과목</span><span className="font-bold text-gray-800">{result.bestSubject}</span></div> <div className="bg-gray-50 p-2 rounded-lg text-center"><span className="block text-gray-400 mb-1">버닝 요일</span><span className="font-bold text-gray-800">{result.bestDay}</span></div> </div> </div> )} {resultType === 'pattern' && ( <div className="space-y-4"> <h4 className="font-bold text-gray-800">{result.type === 'focus' ? '집중도 패턴' : '시간대별 패턴'}</h4> <div className="bg-gray-50 p-3 rounded-xl text-sm text-gray-600 leading-relaxed"> {result.insight} </div> {result.type === 'focus' && result.data && ( <div className="space-y-2"> {result.data.map((d: any, i: number) => ( <div key={i} className="flex items-center justify-between text-xs"> <div className="flex items-center gap-2"> <div className="w-2 h-2 rounded-full" style={{backgroundColor: d.color}}></div> <span>{d.name}</span> </div> <span className="font-bold">{d.value}회</span> </div> ))} </div> )} </div> )} <button onClick={() => setResult(null)} className="w-full mt-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">돌아가기</button> </div> </div> ); } return ( <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in"> <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl scale-100 animate-in zoom-in-95"> <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white relative overflow-hidden"> <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div> <h3 className="text-xl font-bold flex items-center gap-2 relative z-10"><Sparkles size={20} /> AI Learning Lab</h3> <p className="text-indigo-100 text-xs mt-1 relative z-10">학습 데이터를 다각도로 분석해보세요.</p> <button onClick={onClose} className="absolute top-4 right-4 p-1 text-white/70 hover:text-white bg-white/10 rounded-full"><X size={20}/></button> </div> <div className="p-4 grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto"> <div className="col-span-2 bg-gradient-to-r from-indigo-50 to-white border border-indigo-100 rounded-2xl p-4"> <div className="flex justify-between items-center mb-3"> <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wide flex items-center gap-1"> <UserCheck size={14} /> AI 학습 코치 </h4> <div className="flex items-center gap-1 bg-white border border-indigo-100 rounded-lg px-2 py-1"> <Calendar size={12} className="text-indigo-400" /> <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="text-[10px] font-bold text-gray-600 bg-transparent focus:outline-none" /> </div> </div> <div className="flex gap-2"> {['daily', 'weekly', 'monthly'].map(p => ( <button key={p} onClick={() => onSelectReport(p as any, new Date(targetDate))} className="flex-1 py-2.5 bg-white border border-indigo-100 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all shadow-sm flex flex-col items-center justify-center gap-0.5" > <span>{p === 'daily' ? '일간' : (p === 'weekly' ? '주간' : '월간')} 분석</span> </button> ))} </div> </div> <button onClick={handleJourney} disabled={loading} className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 rounded-2xl transition-all group"> <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-violet-500 mb-2 group-hover:scale-110 transition-transform"><Map size={20}/></div> <span className="text-xs font-bold text-gray-700 group-hover:text-violet-700">나의 여정</span> </button> <button onClick={() => handlePattern('focus')} disabled={loading} className="flex flex-col items-center justify-center p-4 bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 rounded-2xl transition-all group"> <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-emerald-500 mb-2 group-hover:scale-110 transition-transform"><BrainCircuit size={20}/></div> <span className="text-xs font-bold text-gray-700 group-hover:text-emerald-700">집중도 패턴</span> </button> </div> </div> </div> ); };
