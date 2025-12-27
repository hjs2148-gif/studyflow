
import React, { useState, useRef, useEffect } from 'react';
import { Home as HomeIcon, List, PieChart as PieChartIcon, ChevronDown, ChevronUp, Users } from 'lucide-react';

// --- Circular Progress ---
interface SimpleCircularProgressProps {
  percentage: number;
  text: string;
  subText?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  textSize?: string;
  subTextSize?: string;
  textColor?: string;
  subTextColor?: string;
}

export const SimpleCircularProgress: React.FC<SimpleCircularProgressProps> = ({ 
  percentage, text, subText, size = 220, strokeWidth = 12, color = "#4F46E5", 
  textSize = "text-4xl", subTextSize = "text-xs", textColor = "text-gray-800", subTextColor = "text-gray-400" 
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const visualPercentage = Math.min(100, Math.max(0, percentage || 0));
  const offset = circumference - (visualPercentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" className="text-gray-200 opacity-30" strokeWidth={strokeWidth} fill="transparent" />
        <circle 
          cx={size / 2} cy={size / 2} r={radius} 
          stroke={color} strokeWidth={strokeWidth} fill="transparent" 
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" 
          className="transition-all duration-1000 ease-out" 
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className={`${textSize} font-bold ${textColor} tracking-tight`}>{text}</span>
        {subText && <span className={`${subTextSize} ${subTextColor} mt-1 font-medium`}>{subText}</span>}
      </div>
    </div>
  );
};

// --- Mini Donut ---
interface MiniDonutProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export const MiniDonut: React.FC<MiniDonutProps> = ({ percentage, size = 40, strokeWidth = 3, color = "#4F46E5" }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    // Visual circle caps at 100% to prevent drawing issues, but text can show higher
    const visualPercentage = Math.min(100, Math.max(0, percentage || 0));
    const offset = circumference - (visualPercentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="transform -rotate-90">
                <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" className="text-gray-200 opacity-20" strokeWidth={strokeWidth} fill="transparent" />
                <circle 
                    cx={size / 2} cy={size / 2} r={radius} 
                    stroke={color} strokeWidth={strokeWidth} fill="transparent" 
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" 
                    className="transition-all duration-1000 ease-out" 
                />
            </svg>
            <div className="absolute flex items-center justify-center">
                <span className="text-[10px] font-bold text-gray-600">{Math.round(percentage || 0)}%</span>
            </div>
        </div>
    );
};

// --- Collapsible Card ---
interface CollapsibleCardProps {
  title: string | null;
  icon: React.ElementType;
  color: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, icon: Icon, color, children, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (contentRef.current) {
            contentRef.current.style.maxHeight = isOpen ? '1000px' : '0'; 
        }
    }, [isOpen]);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 transition-all duration-300">
            {title ? (
            <button 
                className="w-full flex justify-between items-center p-5 focus:outline-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <Icon size={16} className={color} /> {title}
                </h3>
                <span className="text-gray-400 transition-transform duration-300 transform">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
            </button>
            ) : null}
            <div
                ref={contentRef}
                style={{
                    maxHeight: isOpen ? '1000px' : '0',
                    overflow: 'hidden',
                    transition: 'max-height 0.4s ease-in-out',
                }}
            >
                <div className={`${title ? 'px-5 pb-5 pt-0' : 'p-5'}`}>
                    {children}
                </div>
            </div>
        </div>
    );
};

// --- Bottom Nav ---
interface BottomNavProps {
  currentView: string;
  setView: (view: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentView, setView }) => {
  const navItems = [
    { id: 'today', label: '투데이', icon: HomeIcon }, 
    { id: 'tasks', label: '학습관리', icon: List },
    { id: 'stats', label: '리포트', icon: PieChartIcon },
    { id: 'community', label: '커뮤니티', icon: Users },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex justify-around items-center h-16 safe-pb z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] w-full max-w-md mx-auto">
      {navItems.map((item) => (
        <button key={item.id} onClick={() => setView(item.id)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-all duration-300 ${currentView === item.id ? 'text-indigo-600 scale-105' : 'text-gray-300 hover:text-gray-500'}`}>
          <item.icon size={22} strokeWidth={currentView === item.id ? 2.5 : 2} />
          <span className="text-[10px] font-medium">{item.label}</span>
        </button>
      ))}
    </div>
  );
};
