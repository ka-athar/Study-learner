import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  X, 
  Maximize2, 
  Minimize2,
  Zap, 
  CheckCircle2, 
  Tv, 
  Columns, 
  Bell, 
  RotateCcw, 
  Plus, 
  Move,
  ChevronUp,
  Sparkles,
  Flame
} from 'lucide-react';
import { 
  GlobalTimerSession, 
  getPersistedTimer, 
  persistRunningTimer, 
  clearRunningTimer,
  pauseGlobalTimerSession,
  resumeGlobalTimerSession,
  addMinutesToGlobalTimer,
  scheduleImmediateReminder
} from '../lib/globalTimerService';
import { pipTimer } from '../lib/pipTimerService';
import { requestPushPermission, isPushNotificationSupported } from '../lib/pushNotificationManager';
import { ActiveTab } from '../types';

interface GlobalTimerPillProps {
  currentTab: ActiveTab;
  onNavigateToTimer: () => void;
  onNavigateToCockpit?: () => void;
  onToggleSplitScreen?: () => void;
  onSaveCompletedSession?: (subject: string, topic: string, minutes: number) => void;
  onOpenTranscriptionStudio?: () => void;
}

export const GlobalTimerPill: React.FC<GlobalTimerPillProps> = ({
  currentTab,
  onNavigateToTimer,
  onNavigateToCockpit,
  onToggleSplitScreen,
  onSaveCompletedSession,
  onOpenTranscriptionStudio
}) => {
  const [timer, setTimer] = useState<GlobalTimerSession | null>(() => getPersistedTimer());
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isPipActive, setIsPipActive] = useState<boolean>(() => pipTimer.isActive());
  const [showReminderMenu, setShowReminderMenu] = useState<boolean>(false);
  const [reminderToast, setReminderToast] = useState<string | null>(null);

  // Dragging state
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('studyflow_mini_pill_position');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { x: -1, y: -1 }; // -1 indicates default bottom-right
  });

  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Listen for timer events
  useEffect(() => {
    const handleUpdate = (e: any) => {
      setTimer(e.detail || getPersistedTimer());
    };
    const handlePipChange = (e: any) => {
      setIsPipActive(Boolean(e.detail?.active));
    };

    window.addEventListener('studyplanner:timer-update', handleUpdate);
    window.addEventListener('studyplanner:pip-change', handlePipChange);
    return () => {
      window.removeEventListener('studyplanner:timer-update', handleUpdate);
      window.removeEventListener('studyplanner:pip-change', handlePipChange);
    };
  }, []);

  // Interval sync check
  useEffect(() => {
    const interval = setInterval(() => {
      const latest = getPersistedTimer();
      setTimer(latest);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Dragging event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    isDraggingRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : window.innerWidth - 300;
    const currentY = rect ? rect.top : window.innerHeight - 100;

    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: currentX,
      startY: currentY
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.mouseX;
      const deltaY = moveEvent.clientY - dragStartRef.current.mouseY;

      const newX = Math.max(12, Math.min(window.innerWidth - 280, dragStartRef.current.startX + deltaX));
      const newY = Math.max(12, Math.min(window.innerHeight - 120, dragStartRef.current.startY + deltaY));

      const newPos = { x: newX, y: newY };
      setPosition(newPos);
      try {
        localStorage.setItem('studyflow_mini_pill_position', JSON.stringify(newPos));
      } catch (err) {}
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTogglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!timer) return;
    if (timer.isRunning && !timer.isPaused) {
      pauseGlobalTimerSession();
    } else {
      resumeGlobalTimerSession();
    }
  };

  const handleAddFiveMinutes = (e: React.MouseEvent) => {
    e.stopPropagation();
    addMinutesToGlobalTimer(5);
  };

  const handleTogglePip = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await pipTimer.togglePip();
  };

  const handleScheduleReminder = async (minutes: number) => {
    if (isPushNotificationSupported() && Notification.permission !== 'granted') {
      await requestPushPermission();
    }
    const topic = timer?.topicName || 'Daily Study Sprint';
    scheduleImmediateReminder(`Study Sprint Check-In (${minutes}m)`, topic, minutes);
    setShowReminderMenu(false);
    setReminderToast(`Reminder set for ${minutes} min!`);
    setTimeout(() => setReminderToast(null), 3000);
  };

  const handleCompleteAndLog = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!timer) return;
    const minutes = Math.max(1, Math.round((timer.targetSeconds - timer.secondsLeft) / 60));
    if (onSaveCompletedSession) {
      onSaveCompletedSession(timer.subjectName, timer.topicName, minutes);
    }
    clearRunningTimer();
  };

  // If user is directly inside the dedicated timer view or cockpit, hide floating mini widget to prevent clutter
  if (currentTab === 'timer' && !isExpanded) {
    return null;
  }

  // If timer is not active at all, don't show floating mini widget
  if (!timer || (!timer.isRunning && timer.secondsLeft === timer.targetSeconds)) {
    return null;
  }

  const seconds = timer.secondsLeft;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeFormatted = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  const isFinished = seconds === 0;
  const isUrgent = seconds <= 120 && seconds > 0;
  const isPaused = timer.isPaused || !timer.isRunning;

  const stylePos: React.CSSProperties = position.x >= 0 && position.y >= 0
    ? { position: 'fixed', left: `${position.x}px`, top: `${position.y}px`, zIndex: 9999 }
    : { position: 'fixed', right: '24px', bottom: '24px', zIndex: 9999 };

  return (
    <div
      ref={containerRef}
      style={stylePos}
      onMouseDown={handleMouseDown}
      className="select-none animate-fade-in group cursor-grab active:cursor-grabbing"
    >
      {/* Toast Notification */}
      {reminderToast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-lg flex items-center gap-1.5 whitespace-nowrap animate-bounce-short">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{reminderToast}</span>
        </div>
      )}

      {/* COMPACT MINI FLOATING PILL */}
      {!isExpanded ? (
        <div className={`p-2.5 sm:p-3 rounded-2xl sm:rounded-3xl shadow-2xl border flex items-center gap-2.5 backdrop-blur-md transition-all ${
          isFinished
            ? 'bg-emerald-950/95 text-white border-emerald-600 ring-2 ring-emerald-500'
            : isUrgent
            ? 'bg-rose-950/95 text-white border-rose-600 animate-pulse'
            : 'bg-[#1C1D1A]/95 text-white border-white/20 hover:border-white/35'
        }`}>
          {/* Pulsing clock icon */}
          <button 
            type="button"
            onClick={handleTogglePlayPause}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer ${
              isPaused ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-white/10 text-emerald-400 hover:bg-white/20'
            }`}
            title={isPaused ? 'Resume Sprint' : 'Pause Sprint'}
          >
            {isPaused ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <Pause className="w-4 h-4 fill-current" />}
          </button>

          {/* Time & Topic Display */}
          <div 
            onClick={() => {
              if (onNavigateToCockpit) onNavigateToCockpit();
              else onNavigateToTimer();
            }}
            className="cursor-pointer"
            title="Click to open Study Cockpit"
          >
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg font-black font-mono tracking-tight leading-none text-white">
                {timeFormatted}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/15 text-stone-200 uppercase font-bold">
                {timer.subjectName || 'Study'}
              </span>
            </div>
            <div className="text-[11px] text-stone-300 max-w-[130px] sm:max-w-[160px] truncate leading-tight mt-0.5">
              {timer.topicName || 'Focus Sprint'}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1 pl-1 border-l border-white/15">
            <button
              type="button"
              onClick={handleTogglePip}
              className={`p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition cursor-pointer ${
                isPipActive ? 'text-amber-400 bg-amber-500/20' : ''
              }`}
              title="Picture-in-Picture (Always on top of all windows & PDFs)"
            >
              <Tv className="w-3.5 h-3.5" />
            </button>

            {onToggleSplitScreen && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSplitScreen();
                }}
                className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Toggle Split-Screen Companion"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(true);
              }}
              className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
              title="Expand Floating Study Window"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED MINI FLOATING STUDY WINDOW */
        <div className="w-72 sm:w-80 bg-[#1C1D1A]/95 text-white rounded-3xl p-4 shadow-2xl border border-white/20 backdrop-blur-md space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <Zap className="w-4 h-4 fill-current" />
              <span>Study Cockpit Widget</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                title="Minimize to Pill"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleCompleteAndLog}
                className="p-1 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
                title="Stop & Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Main Timer Display */}
          <div className="text-center py-1">
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-wider text-white">
              {timeFormatted}
            </div>
            <div className="text-xs font-semibold text-stone-200 mt-1 truncate">
              {timer.subjectName}: {timer.topicName}
            </div>
            <div className="text-[10px] font-mono text-stone-400 mt-0.5">
              {isPaused ? '⏸️ Sprint Paused' : '🟢 Accurate Wall-Clock Running'}
            </div>
          </div>

          {/* Core Controls */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={handleTogglePlayPause}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                isPaused
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-amber-600 hover:bg-amber-500 text-white'
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
              <span>{isPaused ? 'Resume' : 'Pause'}</span>
            </button>

            <button
              type="button"
              onClick={handleAddFiveMinutes}
              className="py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white flex items-center justify-center gap-1 transition cursor-pointer"
              title="Add 5 minutes"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+5m</span>
            </button>

            <button
              type="button"
              onClick={handleTogglePip}
              className={`py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer ${
                isPipActive
                  ? 'bg-amber-500 text-black font-black'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
              title="Native Picture-in-Picture window over all screens"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>{isPipActive ? 'PiP Active' : 'Float PiP'}</span>
            </button>
          </div>

          {/* Immediate Reminders Section */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono uppercase text-stone-400 font-bold flex items-center gap-1">
                <Bell className="w-3 h-3 text-amber-400" />
                <span>Immediate Reminders</span>
              </span>
              <button
                type="button"
                onClick={() => setShowReminderMenu(!showReminderMenu)}
                className="text-[10px] font-bold text-amber-400 hover:underline cursor-pointer"
              >
                {showReminderMenu ? 'Hide' : '+ Set Alert'}
              </button>
            </div>

            {showReminderMenu ? (
              <div className="grid grid-cols-3 gap-1.5 mt-2 animate-fade-in">
                <button
                  type="button"
                  onClick={() => handleScheduleReminder(5)}
                  className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-amber-500/20 hover:text-amber-300 text-[11px] font-bold transition text-center cursor-pointer"
                >
                  🔔 In 5m
                </button>
                <button
                  type="button"
                  onClick={() => handleScheduleReminder(15)}
                  className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-amber-500/20 hover:text-amber-300 text-[11px] font-bold transition text-center cursor-pointer"
                >
                  🔔 In 15m
                </button>
                <button
                  type="button"
                  onClick={() => handleScheduleReminder(30)}
                  className="py-1.5 px-2 rounded-lg bg-white/10 hover:bg-amber-500/20 hover:text-amber-300 text-[11px] font-bold transition text-center cursor-pointer"
                >
                  🔔 In 30m
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-[11px] text-stone-300">
                <span>Push alerts fire even when tab is closed</span>
                <span className="text-emerald-400 font-mono font-bold">Enabled</span>
              </div>
            )}
          </div>

          {/* Voice Transcription Studio (Cook Notes) */}
          {onOpenTranscriptionStudio && (
            <button
              type="button"
              onClick={() => {
                onOpenTranscriptionStudio();
                setIsExpanded(false);
              }}
              className="w-full py-2 px-3 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 border border-orange-500/30 text-[11px] font-bold flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              <span>Voice Studio (Gemini Cook) 🔥</span>
            </button>
          )}

          {/* Split Screen & Navigation Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            {onToggleSplitScreen && (
              <button
                type="button"
                onClick={() => {
                  onToggleSplitScreen();
                  setIsExpanded(false);
                }}
                className="flex-1 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-stone-200 flex items-center justify-center gap-1.5 transition cursor-pointer"
              >
                <Columns className="w-3 h-3" />
                <span>Split Screen</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (onNavigateToCockpit) onNavigateToCockpit();
                else onNavigateToTimer();
                setIsExpanded(false);
              }}
              className="flex-1 py-1.5 rounded-xl bg-[#6B705C] hover:bg-[#585C4B] text-[11px] font-bold text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Zap className="w-3 h-3" />
              <span>Full Cockpit</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
