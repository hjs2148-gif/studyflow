
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, Globe, Flame, Sparkles, UserPlus, Shield, Info, 
  ArrowRight, Heart, MessageCircle, Zap, TrendingUp, Trophy, 
  Smile, User, LogIn, Settings as SettingsIcon, Flag, BrainCircuit,
  Crown, Star, Award, HeartHandshake, Map, Timer, CheckCircle2,
  LayoutGrid, LayoutList, Medal, ChevronRight, Share2
} from 'lucide-react';
import { 
  collection, query, orderBy, limit, onSnapshot, 
  doc, setDoc, updateDoc, arrayUnion, increment, 
  serverTimestamp, where, getCountFromServer, deleteDoc, getDoc
} from 'firebase/firestore';
import { 
  getAuth, GoogleAuthProvider, signInWithPopup, 
  linkWithPopup, updateProfile, AuthProvider 
} from 'firebase/auth';
import { CommunityFeedItem, UserProfile, Settings, Task, Session, LivePresence, ClanChallenge } from '../types';
import { callGemini } from '../services/geminiService';

interface CommunityViewProps {
  user: any;
  db: any;
  appId: string;
  settings: Settings;
  onUpdateSettings: (s: Settings) => void;
  tasks: Task[];
  sessions: Session[];
}

export const CommunityView: React.FC<CommunityViewProps> = ({ 
  user, db, appId, settings, onUpdateSettings, tasks, sessions 
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'league' | 'feed'>('all');
  const [feed, setFeed] = useState<CommunityFeedItem[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [livePeers, setLivePeers] = useState<LivePresence[]>([]);
  const [clanChallenge, setClanChallenge] = useState<ClanChallenge | null>(null);
  const [liveUserCount, setLiveUserCount] = useState(0);
  const [aiInsight, setAiInsight] = useState("");
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const isAnonymous = user?.isAnonymous;

  // 1. Fetch Data & Presence
  useEffect(() => {
    if (!user) return;
    
    // Live User Count
    const interval = setInterval(() => {
      setLiveUserCount(Math.floor(1200 + Math.random() * 300));
    }, 10000);
    setLiveUserCount(1342);

    // Profile listener
    const profUnsub = onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), (snap) => {
      if (snap.exists()) {
        setUserProfile(snap.data() as UserProfile);
      } else {
        const initialProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || '무명 학습자',
          photoURL: user.photoURL || '',
          level: 1,
          title: '입문자',
          autoShare: settings.autoShareAchievements ?? true,
          tier: 'bronze',
          weeklyExp: 0
        };
        setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), initialProfile);
        setUserProfile(initialProfile);
      }
    });

    // Presence listener (Live Peers)
    const presenceUnsub = onSnapshot(collection(db, 'artifacts', appId, 'presence'), (snap) => {
      const peers = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as LivePresence))
        .filter(p => p.uid !== user.uid);
      setLivePeers(peers);
    });

    // Global Feed listener
    const feedQuery = query(
      collection(db, 'artifacts', appId, 'community_feed'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    const feedUnsub = onSnapshot(feedQuery, (snap) => {
      setFeed(snap.docs.map(d => ({ id: d.id, ...d.data() } as CommunityFeedItem)));
      setLoading(false);
    });

    return () => {
      clearInterval(interval);
      profUnsub();
      presenceUnsub();
      feedUnsub();
    };
  }, [user]);

  // 2. AI Features
  useEffect(() => {
    const fetchAICommunityInsights = async () => {
      if (feed.length === 0) return;
      const recentTopics = feed.slice(0, 5).map(f => f.content).join(", ");
      const prompt = `커뮤니티 최근 활동 키워드: [${recentTopics}]. 학습자들에게 에너지를 주는 한 줄 요약과 응원을 짧고 강력하게 작성해줘. 이모지도 사용해.`;
      const result = await callGemini(prompt);
      setAiInsight(result);
    };

    const fetchClanChallenge = async () => {
      if (tasks.length === 0) return;
      const currentSubjects = tasks.filter(t => t.status === 'active').map(t => t.name).join(", ");
      const prompt = `사용자의 학습 과목 [${currentSubjects}]을 보고, 함께 도전할만한 '오늘의 클랜 챌린지' 이름과 목표 시간을 하나 정해줘. (예: { "name": "노동법 격파단", "target": 180 }) JSON 형식으로만 응답해.`;
      const result = await callGemini(prompt);
      try {
        const parsed = JSON.parse(result.replace(/```json|```/g, ''));
        setClanChallenge({
          id: 'ai-clan',
          name: parsed.name,
          goalType: 'time',
          targetValue: parsed.target,
          currentValue: Math.floor(Math.random() * (parsed.target * 0.8)),
          participants: ['user1', 'user2', 'user3', 'user4'],
          expiresAt: null
        });
      } catch (e) {}
    };

    fetchAICommunityInsights();
    fetchClanChallenge();
  }, [feed.length, tasks]);

  // 3. Auth Actions
  const handleGoogleSignIn = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    try {
      let credentialUser;
      if (isAnonymous) {
        const linkResult = await linkWithPopup(auth.currentUser!, provider);
        credentialUser = linkResult.user;
      } else {
        const loginResult = await signInWithPopup(auth, provider);
        credentialUser = loginResult.user;
      }
      if (credentialUser) {
        const profileRef = doc(db, 'artifacts', appId, 'users', credentialUser.uid, 'settings', 'profile');
        const snap = await getDoc(profileRef);
        const profileUpdate = {
          displayName: credentialUser.displayName || '학습 동료',
          photoURL: credentialUser.photoURL || '',
          lastActive: serverTimestamp()
        };
        if (snap.exists()) {
          await updateDoc(profileRef, profileUpdate);
        } else {
          await setDoc(profileRef, {
            ...profileUpdate,
            uid: credentialUser.uid,
            level: 1,
            title: '입문자',
            autoShare: true,
            tier: 'bronze',
            weeklyExp: 0
          });
        }
      }
    } catch (e: any) {
      console.error(e);
      alert(e.code === 'auth/credential-already-in-use' ? "이미 연동된 계정입니다." : "연동 오류가 발생했습니다.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleBoost = async (peerUid: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'presence', peerUid), {
      boosts: increment(1),
      boostedBy: arrayUnion(user.uid)
    });
  };

  const handleFire = async (feedId: string) => {
    if (!user) return;
    await updateDoc(doc(db, 'artifacts', appId, 'community_feed', feedId), {
      fires: increment(1),
      firedBy: arrayUnion(user.uid)
    });
  };

  const toggleAutoShare = (val: boolean) => {
    onUpdateSettings({ ...settings, autoShareAchievements: val });
  };

  const leagueRanks = useMemo(() => [
    { name: '공부왕 김노무', exp: 1420, tier: 'gold', me: false },
    { name: userProfile?.displayName || '나', exp: 980, tier: 'gold', me: true },
    { name: '민법 천재', exp: 890, tier: 'gold', me: false },
    { name: '판례 요정', exp: 820, tier: 'gold', me: false },
    { name: '노동법 마스터', exp: 710, tier: 'gold', me: false },
  ].sort((a,b) => b.exp - a.exp), [userProfile]);

  const tierProgress = useMemo(() => {
    return userProfile?.weeklyExp ? Math.min(100, (userProfile.weeklyExp % 1000) / 10) : 65;
  }, [userProfile]);

  return (
    <div className="h-full bg-[#F8F9FD] flex flex-col overflow-hidden animate-in fade-in duration-500 relative">
      
      {/* v2.5.3 Fixed Header Section (Pinned) */}
      <div className="flex-none bg-white/95 backdrop-blur-md px-5 pt-[calc(2.5rem+env(safe-area-inset-top,0px))] pb-6 border-b border-gray-100 z-40 relative shadow-sm">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/40 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-50/30 rounded-full blur-2xl -ml-10 -mb-10 pointer-events-none"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl animate-ping opacity-30"></div>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-white flex items-center justify-center border-2 ${userProfile?.photoURL ? 'border-indigo-400' : 'border-indigo-100'} overflow-hidden shadow-md relative z-10 transition-all duration-300 group-hover:scale-105 active:scale-95`}>
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} className="w-full h-full object-cover" alt="Profile" />
                    ) : (
                      <User size={32} className="text-indigo-200" />
                    )}
                </div>
                {!isAnonymous && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-blue-500 rounded-full border-2 border-white p-1 shadow-lg z-20">
                    <CheckCircle2 size={12} className="text-white" fill="currentColor" />
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-black text-gray-900 leading-tight">
                    {userProfile?.displayName || '학습자'}
                  </h2>
                  <div className="flex items-center gap-1 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                    <Star size={10} fill="currentColor" /> Lv.{userProfile?.level || 1}
                  </div>
                </div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  {userProfile?.title || 'Learning Adventure'}
                  <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                  <span className="text-indigo-500">{liveUserCount}명 열공 중</span>
                </p>
              </div>
            </div>
            
            <button 
              onClick={isAnonymous ? handleGoogleSignIn : () => {}} 
              className={`p-2 rounded-2xl transition-all shadow-sm active:scale-95 ${isAnonymous ? 'bg-indigo-600 text-white shadow-indigo-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}
            >
              {isAnonymous ? <LogIn size={20} /> : <Share2 size={20} />}
            </button>
          </div>

          <div className="bg-gray-50/80 backdrop-blur-md rounded-2xl p-4 border border-gray-100 shadow-sm mb-6 transition-all hover:bg-white">
            <div className="flex justify-between items-center mb-2.5">
              <div className="flex items-center gap-2">
                <Medal size={16} className="text-amber-500" />
                <span className="text-[11px] font-black text-gray-700 uppercase tracking-tighter">Gold League Rank</span>
              </div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter bg-indigo-50 px-1.5 py-0.5 rounded-lg">Next: Platinum</span>
            </div>
            <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner flex">
              <div className="h-full bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(79,70,229,0.3)]" style={{ width: `${tierProgress}%` }}></div>
            </div>
            <div className="flex justify-between mt-2 px-0.5">
              <span className="text-[9px] font-bold text-gray-400">현재 {leagueRanks.findIndex(r => r.me) + 1}위 (누적 {userProfile?.weeklyExp || 980} EXP)</span>
              <span className="text-[9px] font-black text-indigo-400 uppercase">Top 15%</span>
            </div>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-2xl relative">
            {[
                { id: 'all', label: '종합', icon: LayoutGrid },
                { id: 'league', label: '리그', icon: Medal },
                { id: 'feed', label: '피드', icon: LayoutList }
            ].map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-black transition-all duration-300 ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md scale-[1.02]' : 'text-gray-400 hover:text-gray-500'}`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
          </div>
        </div>
      </div>

      {/* v2.5.3 Scrollable Feed Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 relative">
        <div className="px-5 py-6 space-y-10">
          {(activeTab === 'all' || activeTab === 'league') && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  {activeTab === 'all' && (
                      <div className="bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6] rounded-[2.5rem] p-6 text-white shadow-xl shadow-indigo-100 relative overflow-hidden group">
                          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-125 transition-transform duration-1000 pointer-events-none">
                              <Sparkles size={120} />
                          </div>
                          <div className="flex items-center gap-2 mb-3 relative z-10">
                              <div className="bg-white/20 p-1.5 rounded-lg"><Zap size={14} className="text-amber-300" fill="currentColor" /></div>
                              <span className="text-[10px] font-black text-indigo-100 uppercase tracking-widest">Global Community Insight</span>
                          </div>
                          <p className="text-base font-bold leading-relaxed mb-4 relative z-10">
                              {aiInsight || "커뮤니티의 학습 열기를 분석하고 있습니다..."}
                          </p>
                          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-2xl border border-white/10 w-fit">
                              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
                              <span className="text-[11px] font-black tracking-wider uppercase">Live Tracking Active</span>
                          </div>
                      </div>
                  )}

                  {activeTab === 'all' && (
                      <div className="space-y-4">
                          <div className="flex justify-between items-end px-1">
                              <div>
                              <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                                  <Flame size={18} className="text-orange-500" /> 실시간 부스트
                              </h3>
                              <p className="text-[10px] text-gray-400 font-bold mt-0.5">지금 열공 중인 동료들에게 불꽃을 보내세요!</p>
                              </div>
                          </div>
                          
                          <div className="flex gap-4 overflow-x-auto no-scrollbar py-2">
                              {livePeers.length === 0 ? (
                              <div className="w-full bg-white rounded-[2rem] p-8 border border-dashed border-gray-200 text-center flex flex-col items-center gap-3">
                                  <div className="p-3 bg-gray-50 rounded-full"><Timer size={24} className="text-gray-300" /></div>
                                  <p className="text-xs font-black text-gray-400 leading-tight">현재 공부 중인 동료를<br/>찾고 있습니다.</p>
                              </div>
                              ) : (
                              livePeers.map(peer => (
                                  <div key={peer.uid} className="bg-white min-w-[150px] rounded-[2.5rem] p-5 border border-gray-100 shadow-sm flex flex-col items-center text-center gap-3 animate-in zoom-in-95 group hover:shadow-md transition-all">
                                    <div className="relative">
                                      <div className="w-16 h-16 rounded-2xl bg-gray-50 overflow-hidden shadow-inner border border-indigo-50 transition-transform group-hover:scale-105">
                                        {peer.photoURL ? <img src={peer.photoURL} className="w-full h-full object-cover" /> : <User size={28} className="text-indigo-200 m-auto mt-4" />}
                                      </div>
                                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                      </div>
                                    </div>
                                    <div className="w-full">
                                      <h4 className="text-[12px] font-black text-gray-800 truncate mb-1 leading-tight">{peer.displayName}</h4>
                                      <div className="px-2 py-1 bg-indigo-50 rounded-xl inline-block max-w-full">
                                        <p className="text-[10px] text-indigo-600 font-black truncate">{peer.taskName}</p>
                                      </div>
                                    </div>
                                    <button onClick={() => handleBoost(peer.uid)} className="w-full py-2.5 bg-orange-50 text-orange-600 rounded-[1.2rem] text-[11px] font-black hover:bg-orange-100 active:scale-95 transition-all flex items-center justify-center gap-1 border border-orange-100/50">
                                      <Flame size={14} fill="currentColor" /> {peer.boosts > 0 ? peer.boosts : '부스트'}
                                    </button>
                                  </div>
                              ))
                              )}
                          </div>
                      </div>
                  )}

                  <div className="bg-white rounded-[2.5rem] p-6 border border-gray-100 shadow-sm relative overflow-hidden">
                      <div className="flex justify-between items-center mb-6 px-1">
                          <div>
                          <h3 className="text-base font-black text-gray-800 flex items-center gap-2">
                              <Crown size={18} className="text-amber-500" /> 스터디 리그
                          </h3>
                          <p className="text-[10px] text-gray-400 font-bold mt-0.5">상위 10%는 플래티넘 리그로 승급합니다</p>
                          </div>
                          <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-sm"><Award size={20} /></div>
                      </div>
                      
                      <div className="space-y-2">
                          {leagueRanks.map((rank, idx) => (
                              <div key={idx} className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${rank.me ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100 scale-[1.02] z-10' : 'bg-[#F9FAFB] border-transparent text-gray-700'}`}>
                              <div className="flex items-center gap-3">
                                  <span className={`text-[11px] font-black ${rank.me ? 'text-indigo-200' : 'text-gray-400'} w-4`}>{idx + 1}</span>
                                  <div className={`w-9 h-9 rounded-xl overflow-hidden shadow-inner ${rank.me ? 'bg-white/20' : 'bg-white border border-gray-100'}`}>
                                      <User size={18} className={`m-auto mt-2.5 ${rank.me ? 'text-white' : 'text-gray-300'}`} />
                                  </div>
                                  <span className="text-xs font-black truncate max-w-[100px]">{rank.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                  <span className={`text-[11px] font-black ${rank.me ? 'text-white' : 'text-gray-900'}`}>{rank.exp.toLocaleString()}</span>
                                  <span className={`text-[9px] font-bold ${rank.me ? 'text-indigo-200' : 'text-gray-400'} uppercase`}>exp</span>
                              </div>
                              </div>
                          ))}
                      </div>
                      <button className="w-full mt-4 py-3 text-[11px] font-black text-gray-400 hover:text-indigo-600 transition-colors uppercase tracking-widest">View Full Ranking</button>
                  </div>

                  {clanChallenge && (activeTab === 'all') && (
                  <div className="bg-white rounded-[3rem] p-7 border border-indigo-100 shadow-sm relative overflow-hidden">
                      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-indigo-50/50 rounded-full blur-3xl pointer-events-none"></div>
                      <div className="flex justify-between items-start mb-6 relative z-10">
                          <div>
                              <div className="flex items-center gap-2 mb-2">
                                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-lg uppercase tracking-wider">AI Clan Mission</span>
                                  <div className="flex items-center gap-1">
                                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black text-orange-500">Live Mission</span>
                                  </div>
                              </div>
                              <h3 className="text-2xl font-black text-gray-900 leading-tight">AI {clanChallenge.name}</h3>
                          </div>
                          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner flex items-center justify-center"><HeartHandshake size={28} /></div>
                      </div>
                      
                      <div className="space-y-6 relative z-10">
                          <div className="bg-gray-50/50 p-4 rounded-[2rem] border border-gray-100">
                            <div className="flex justify-between items-end mb-3">
                                <span className="text-[11px] font-black text-gray-400 uppercase">Clan Progress</span>
                                <span className="text-lg font-black text-indigo-600">{Math.round((clanChallenge.currentValue / clanChallenge.targetValue) * 100)}%</span>
                            </div>
                            <div className="w-full h-4 bg-gray-200/50 rounded-full overflow-hidden shadow-inner">
                                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 rounded-full transition-all duration-1000 shadow-[0_0_12px_rgba(79,70,229,0.2)]" style={{ width: `${(clanChallenge.currentValue / clanChallenge.targetValue) * 100}%` }}></div>
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black text-gray-400 mt-3 px-1">
                                <span>{clanChallenge.currentValue}분 달성</span>
                                <span>목표 {clanChallenge.targetValue}분</span>
                            </div>
                          </div>
                          <button className="w-full mt-4 py-4 bg-indigo-600 text-white rounded-[1.8rem] font-black text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                            <Map size={18} /> 챌린지 즉시 참여
                          </button>
                      </div>
                  </div>
                  )}
              </div>
          )}

          {(activeTab === 'all' || activeTab === 'feed') && (
              <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex justify-between items-center px-1">
                      <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                      <Globe size={20} className="text-indigo-600" /> 활동 피드
                      </h3>
                      <div className="flex items-center gap-2 bg-white border border-gray-100 rounded-2xl px-4 py-2 shadow-sm">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Auto Sync</span>
                          <button 
                              onClick={() => toggleAutoShare(!(settings.autoShareAchievements ?? true))}
                              className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-300 ${ (settings.autoShareAchievements ?? true) ? 'bg-indigo-600' : 'bg-gray-200' }`}
                          >
                              <div className={`bg-white w-4 h-4 rounded-full shadow-sm transition-transform duration-300 ${ (settings.autoShareAchievements ?? true) ? 'translate-x-4' : 'translate-x-0' }`}></div>
                          </button>
                      </div>
                  </div>

                  <div className="space-y-8">
                      {feed.length === 0 && !loading && (
                      <div className="text-center py-16 bg-white rounded-[2.5rem] border border-dashed border-gray-200">
                          <Info size={32} className="mx-auto text-gray-200 mb-3" />
                          <p className="text-xs font-black text-gray-400">아직 새로운 소식이 없습니다.</p>
                          <p className="text-[10px] text-gray-300 mt-1">학습을 시작하고 첫 주인공이 되어보세요!</p>
                      </div>
                      )}
                      
                      {feed.map((item) => {
                          const isAchievement = item.type === 'achievement' || item.type === 'goal_reached';
                          const metricMatch = item.content.match(/\d+분|\d+시간|\d+페이지|\d+회/);
                          const metric = metricMatch ? metricMatch[0] : null;
                          const cleanContent = metric ? item.content.replace(metric, '').replace('동안 ', '').trim() : item.content;

                          return (
                              <div key={item.id} className="relative group">
                                <div className={`absolute -left-3 -top-3 w-12 h-12 rounded-full blur-2xl opacity-20 pointer-events-none transition-transform group-hover:scale-150 duration-1000 ${isAchievement ? 'bg-amber-400' : 'bg-indigo-400'}`}></div>
                                
                                <div className={`bg-white rounded-[3rem] overflow-hidden border border-gray-100 shadow-sm transition-all active:scale-[0.99] relative z-10 group-hover:shadow-xl`}>
                                  {isAchievement && (
                                      <div className="absolute -right-6 -bottom-6 p-10 opacity-[0.05] pointer-events-none group-hover:rotate-12 group-hover:scale-110 transition-transform duration-700">
                                          <Trophy size={160} />
                                      </div>
                                  )}
                                  
                                  <div className="p-7">
                                      <div className="flex justify-between items-start mb-6">
                                          <div className="flex items-center gap-4">
                                              <div className="relative">
                                                  <div className="w-14 h-14 rounded-[1.8rem] bg-gray-50 overflow-hidden shadow-inner border border-gray-100">
                                                      {item.userPhoto ? <img src={item.userPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 font-black text-xl">{item.userName[0]}</div>}
                                                  </div>
                                                  <div className="absolute -bottom-2 -right-2 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-lg border-2 border-white shadow-md">
                                                      Lv.{item.userLevel}
                                                  </div>
                                              </div>
                                              <div>
                                                  <h4 className="text-[16px] font-black text-gray-800 leading-none mb-1.5 flex items-center gap-1">
                                                      {item.userName}
                                                      {isAchievement && <Crown size={14} className="text-amber-500" />}
                                                  </h4>
                                                  <p className="text-[11px] text-indigo-600 font-black uppercase tracking-widest opacity-60">
                                                      {item.userTitle}
                                                  </p>
                                              </div>
                                          </div>
                                          <div className={`p-4 rounded-2xl shadow-sm ${isAchievement ? 'bg-amber-50 text-amber-500' : 'bg-indigo-50 text-indigo-500'}`}>
                                              {isAchievement ? <Trophy size={20} /> : <Zap size={20} fill="currentColor" />}
                                          </div>
                                      </div>

                                      <div className={`rounded-[2.5rem] p-7 mb-6 border border-gray-50 flex flex-col gap-2 relative overflow-hidden group/card ${isAchievement ? 'bg-amber-50/40' : 'bg-[#F9FAFB]'}`}>
                                          {metric && (
                                              <div className="flex items-baseline gap-2">
                                                <span className={`text-4xl font-black tracking-tighter transition-transform group-hover/card:scale-105 duration-500 ${isAchievement ? 'text-amber-600' : 'text-indigo-600'}`}>
                                                    {metric}
                                                </span>
                                                <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Achieved</span>
                                              </div>
                                          )}
                                          <p className="text-[15px] font-bold text-gray-700 leading-relaxed italic">
                                              "{cleanContent}"
                                          </p>
                                      </div>

                                      <div className="flex justify-between items-center">
                                          <div className="flex items-center gap-3">
                                              <button 
                                                  onClick={() => handleFire(item.id)}
                                                  className={`flex items-center gap-2 px-5 py-3 rounded-[1.5rem] font-black text-xs transition-all ${item.firedBy?.includes(user?.uid) ? 'bg-orange-500 text-white shadow-lg shadow-orange-100 scale-105' : 'bg-gray-50 text-gray-400 hover:bg-orange-50 hover:text-orange-500 border border-gray-100'}`}
                                              >
                                                  <Flame size={16} fill={item.firedBy?.includes(user?.uid) ? "white" : "none"} strokeWidth={3} />
                                                  {item.fires || 0}
                                              </button>
                                              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold uppercase tracking-tighter">
                                                  <Timer size={12} />
                                                  {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '방금 전'}
                                              </div>
                                          </div>
                                          <button className="w-12 h-12 flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all bg-gray-50 rounded-full border border-gray-100 active:scale-90">
                                              <ArrowRight size={20} />
                                          </button>
                                      </div>
                                  </div>
                                </div>
                              </div>
                          );
                      })}
                  </div>
              </div>
          )}

          <div className="text-center py-12 opacity-30">
            <div className="flex justify-center items-center gap-3 mb-2">
               <div className="w-12 h-px bg-gray-300"></div>
               <Users size={14} className="text-gray-400" />
               <div className="w-12 h-px bg-gray-300"></div>
            </div>
            <p className="text-[11px] text-gray-400 font-black uppercase tracking-[0.3em]">StudyFlow Community v2.5.3</p>
          </div>
        </div>
      </div>
    </div>
  );
};
