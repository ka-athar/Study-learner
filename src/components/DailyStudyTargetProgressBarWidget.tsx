import React, { useState, useMemo, useCallback } from 'react';
import { 
  Target, 
  Clock, 
  Flame, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Play, 
  Sparkles, 
  Calendar as CalendarIcon, 
  Bell, 
  RotateCcw, 
  Zap, 
  ChevronRight,
  ShieldCheck,
  X,
  BookOpen,
  MessageCircle,
  Mail,
  Volume2,
  Download,
  Smartphone,
  ExternalLink,
  Award
} from 'lucide-react';
import { StudySession, UserProfile, Subject, ActiveTab, StudyPlan } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';
import { downloadCalendarICS } from '../lib/icalendarExportService';

interface DailyStudyTargetProgressBarWidgetProps {
  sessions: StudySession[];
  userProfile: UserProfile | null;
  subjects?: Subject[];
  plans?: StudyPlan[];
  setActiveTab: (tab: ActiveTab) => void;
  onSaveSession?: (session: Omit<StudySession, 'id'>) => Promise<void> | void;
  onOpenGoogleCalendarSync?: () => void;
}

export const DailyStudyTargetProgressBarWidget: React.FC<DailyStudyTargetProgressBarWidgetProps> = ({
  sessions = [],
  userProfile,
  subjects = [],
  plans = [],
  setActiveTab,
  onSaveSession,
  onOpenGoogleCalendarSync
}) => {
  const [isQuickLogModalOpen, setIsQuickLogModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [quickLogSubject, setQuickLogSubject] = useState<string>(subjects[0]?.name || 'General Studies');
  const [quickLogTopic, setQuickLogTopic] = useState<string>('');
  const [quickLogDurationMinutes, setQuickLogDurationMinutes] = useState<number>(45);
  const [quickLogNotes, setQuickLogNotes] = useState<string>('');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  // Compute today's date string in local timezone (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Filter sessions logged today
  const todaySessions = useMemo(() => {
    return sessions.filter(s => {
      if (s.date === todayStr) return true;
      if (s.timestamp) {
        const sDate = new Date(s.timestamp).toISOString().split('T')[0];
        return sDate === todayStr;
      }
      return false;
    });
  }, [sessions, todayStr]);

  // Total study minutes logged today
  const todayMinutes = useMemo(() => {
    return todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  }, [todaySessions]);

  // Target hours from profile or default 4 hours
  const targetHours = userProfile?.targetHoursPerDay || 4;
  const targetMinutes = Math.max(30, targetHours * 60);

  // Computed metrics
  const todayHours = Number((todayMinutes / 60).toFixed(1));
  const progressPercent = Math.min(100, Math.round((todayMinutes / targetMinutes) * 100));
  const remainingMinutes = Math.max(0, targetMinutes - todayMinutes);
  const remainingHours = Number((remainingMinutes / 60).toFixed(1));
  const isZero = todayMinutes === 0;
  const isBehind = todayMinutes < targetMinutes;
  const isGoalMet = todayMinutes >= targetMinutes;
  const bonusHours = isGoalMet ? Number(((todayMinutes - targetMinutes) / 60).toFixed(1)) : 0;

  // Synthesize crisp audio chime via Web Audio API (100% works locally in Safari / iPad)
  const playAccountabilityChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880.00, ctx.currentTime + 0.15); // A5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(440.00, ctx.currentTime); // A4
      osc2.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.18); // E5

      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.65);
      osc2.stop(ctx.currentTime + 0.65);
    } catch (e) {
      console.warn('Web Audio note:', e);
    }
  }, []);

  // 1-Click Fast Instant Log (e.g. +15m, +30m, +45m, +60m)
  const handleDirectQuickLog = async (minutes: number, customSubj?: string) => {
    if (!onSaveSession || minutes <= 0) return;
    setIsSubmittingLog(true);
    try {
      const subjectName = customSubj || (subjects[0]?.name || 'General Studies');
      await onSaveSession({
        userId: userProfile?.uid || 'user_primary',
        subjectName,
        chapterName: 'Core Curriculum',
        topicName: `${subjectName} Focus Session`,
        durationMinutes: minutes,
        date: todayStr,
        timestamp: Date.now(),
        notes: `Logged via 1-Click Dashboard Shortcut (+${minutes}m)`
      });

      playAccountabilityChime();
      setFeedbackNotice(`✓ Added +${minutes}m for ${subjectName}! Daily progress updated to ${(Number(((todayMinutes + minutes) / 60).toFixed(1)))}h.`);
      setTimeout(() => setFeedbackNotice(null), 4000);

      if (todayMinutes + minutes >= targetMinutes) {
        triggerStudyGoalConfetti();
      }
    } catch (err: any) {
      console.error('Fast log error:', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Detailed Modal Session Submission
  const handleQuickLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveSession || quickLogDurationMinutes <= 0) return;

    setIsSubmittingLog(true);
    try {
      const subjectName = quickLogSubject || (subjects[0]?.name || 'General Studies');
      const topicName = quickLogTopic.trim() || `${subjectName} Focus Session`;

      await onSaveSession({
        userId: userProfile?.uid || 'user_primary',
        subjectName,
        chapterName: 'Core Study',
        topicName,
        durationMinutes: quickLogDurationMinutes,
        date: todayStr,
        timestamp: Date.now(),
        notes: quickLogNotes.trim() || 'Logged via Dashboard Daily Target Shortcut'
      });

      playAccountabilityChime();
      setFeedbackNotice(`✓ Logged +${quickLogDurationMinutes}m for ${subjectName}! Progress updated.`);
      setTimeout(() => setFeedbackNotice(null), 4000);

      if (todayMinutes + quickLogDurationMinutes >= targetMinutes) {
        triggerStudyGoalConfetti();
      }

      setIsQuickLogModalOpen(false);
      setQuickLogTopic('');
      setQuickLogNotes('');
    } catch (err: any) {
      console.error('Failed to log session:', err);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Trigger test system notification & audio chime
  const handleTestSystemNotification = async () => {
    playAccountabilityChime();
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('StudyFlow Accountability Alarm ⏰', {
          body: `Daily Target: ${todayHours}h of ${targetHours}h completed. ${remainingHours}h remaining today!`,
          icon: '/favicon.ico'
        });
        setFeedbackNotice('🔔 Accountability alarm chime sounded & desktop notification delivered!');
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification('StudyFlow Accountability Active 🔔', {
            body: `You will now receive alarms when falling behind your ${targetHours}h daily target!`,
            icon: '/favicon.ico'
          });
          setFeedbackNotice('✓ Push notification permissions granted & alarm test sounded!');
        }
      } else {
        setFeedbackNotice('🔔 Audio alarm sounded! (Desktop pop-up banners are disabled in browser settings).');
      }
      setTimeout(() => setFeedbackNotice(null), 5000);
    } else {
      setFeedbackNotice('🔔 Accountability alarm chime sounded!');
      setTimeout(() => setFeedbackNotice(null), 3000);
    }
  };

  // 1-Click .ics export with timed alarms directly from the widget
  const handleExportWidgetICS = () => {
    const ok = downloadCalendarICS({
      plans,
      preferredStartTime: '09:00',
      alarmMinutesBefore: [30, 10]
    });
    if (ok) {
      setFeedbackNotice('✓ Downloaded calendar schedule (.ics)! Tap to import all study sessions with 10m & 30m alarms into your iPad / phone calendar.');
      setTimeout(() => setFeedbackNotice(null), 6000);
    }
  };

  // Safari-safe WhatsApp message builder (NO popup blocking!)
  const waAccountabilityMessage = useMemo(() => {
    return `🚨 *StudyFlow Accountability Check-in* 🚨\nDate: ${todayStr}\nHours Logged: ${todayHours}h / ${targetHours}h\nStatus: ${isZero ? '⚠️ ZERO HOURS LOGGED! Why haven\'t you studied today?' : isBehind ? `Behind target by ${remainingHours}h.` : 'Target reached!'}\nCommitment: Closing distracting apps and returning to desk now!`;
  }, [todayStr, todayHours, targetHours, isZero, isBehind, remainingHours]);

  const waUrl = useMemo(() => {
    return `https://api.whatsapp.com/send?text=${encodeURIComponent(waAccountabilityMessage)}`;
  }, [waAccountabilityMessage]);

  const mailtoUrl = useMemo(() => {
    const subj = `StudyFlow Accountability: ${todayHours}h of ${targetHours}h Logged Today`;
    return `mailto:${encodeURIComponent(userProfile?.email || '')}?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(waAccountabilityMessage)}`;
  }, [userProfile?.email, todayHours, targetHours, waAccountabilityMessage]);

  return (
    <div className="bg-white border border-[#E0DBD0] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4 relative overflow-hidden transition-all text-[#4A4E4D]">
      
      {/* ZERO HOURS LOGGED ACCOUNTABILITY ALERT (If today's time is 0) */}
      {isZero && (
        <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-950 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shrink-0 mt-0.5 shadow-xs">
              <AlertTriangle className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase font-black tracking-wider bg-rose-200 text-rose-900 px-2 py-0.5 rounded-full">
                  Accountability Warning
                </span>
                <span className="text-xs font-mono font-bold text-rose-700">0.0h Logged Today</span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-rose-950 mt-0.5">
                Have you studied today? Log time is zero. Why haven't you logged in?
              </h4>
              <p className="text-xs text-rose-800 leading-relaxed mt-0.5">
                Target is <strong>{targetHours} hours</strong>. Avoid cheap dopamine & social media scrolls. Even a quick 15–30m session protects your streak.
              </p>
            </div>
          </div>

          {/* Instant 1-Click Logging Buttons to break the zero-day */}
          <div className="flex flex-wrap items-center gap-1.5 self-start md:self-auto shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 mr-1 hidden sm:inline">
              1-Tap Log:
            </span>
            <button
              onClick={() => handleDirectQuickLog(15)}
              disabled={isSubmittingLog}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              title="Log 15m quick review session"
            >
              +15m
            </button>
            <button
              onClick={() => handleDirectQuickLog(30)}
              disabled={isSubmittingLog}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
              title="Log 30m core session"
            >
              +30m
            </button>
            <button
              onClick={() => handleDirectQuickLog(45)}
              disabled={isSubmittingLog}
              className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-xs"
              title="Log 45m focus session"
            >
              +45m
            </button>
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-black text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-xs flex items-center gap-1"
              title="Open Daily Review and Check-In dialog"
            >
              <span>Daily Review</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold shadow-xs shrink-0 ${
            isGoalMet 
              ? 'bg-emerald-600 text-white' 
              : progressPercent >= 50 
              ? 'bg-amber-600 text-white' 
              : 'bg-rose-600 text-white'
          }`}>
            {isGoalMet ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#A5A58D]">
                Daily Study Target Widget
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                isGoalMet
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : isZero
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {isGoalMet ? 'Target Hit' : isZero ? 'Zero Hours' : 'Behind Pace'}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-serif italic font-bold text-[#6B705C] flex items-center gap-2">
              <span>{todayHours} hrs</span>
              <span className="text-xs text-[#A5A58D] font-sans not-italic font-normal">
                logged of <strong className="text-[#4A4E4D] font-bold">{targetHours} hrs Target</strong>
              </span>
            </h3>
          </div>
        </div>

        {/* Right CTA Area: Shortcut Buttons */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* LOG SESSION SHORTCUT BUTTON (prominent when behind) */}
          <button
            onClick={() => setIsQuickLogModalOpen(true)}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
              isBehind
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-[#6B705C]/15 hover:bg-[#6B705C]/25 text-[#6B705C]'
            }`}
            title="Log offline study time or completed class session with 1 click"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Log Session</span>
          </button>

          {/* START FOCUS SPRINT */}
          <button
            onClick={() => setActiveTab('timer')}
            className="px-3.5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#585c4c] text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Start live focus timer session"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Start Sprint</span>
          </button>

          {/* DAILY REVIEW & ACCOUNTABILITY BUTTON */}
          <button
            onClick={() => setIsReviewModalOpen(true)}
            className="px-3 py-2 rounded-xl bg-[#F9F7F2] hover:bg-[#F2EFE9] border border-[#E0DBD0] text-[#6B705C] font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
            title="Check daily accountability status, reasons, and commitment"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Review & Alarms</span>
          </button>
        </div>
      </div>

      {/* Visual Progress Bar with Milestones */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span className="text-[#6B705C] flex items-center gap-1.5 font-bold">
            <Target className="w-3.5 h-3.5 text-[#6B705C]" />
            <span>Target Progress</span>
          </span>
          <span className="font-mono font-bold text-[#4A4E4D]">
            {progressPercent}% Complete {isBehind && `(${remainingHours}h remaining)`}
          </span>
        </div>

        {/* The Track Bar */}
        <div className="w-full h-4 bg-[#F2EFE9] rounded-full overflow-hidden p-0.5 border border-[#E0DBD0] relative shadow-inner">
          <div 
            className={`h-full rounded-full transition-all duration-700 ease-out relative ${
              isGoalMet 
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm' 
                : progressPercent >= 50
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 shadow-sm'
                : 'bg-gradient-to-r from-rose-500 to-amber-500 shadow-sm'
            }`}
            style={{ width: `${Math.max(2, progressPercent)}%` }}
          >
            {/* Subtle animated highlight stripe */}
            <div className="absolute inset-0 bg-white/20 opacity-40 animate-pulse rounded-full" />
          </div>

          {/* Milestone markers at 25%, 50%, 75% */}
          <div className="absolute inset-0 flex justify-between pointer-events-none px-0.5 items-center">
            <div className="w-0.5 h-2 bg-[#E0DBD0] ml-[25%]" title="25% Milestone" />
            <div className="w-0.5 h-2 bg-[#E0DBD0] ml-[25%]" title="50% Milestone" />
            <div className="w-0.5 h-2 bg-[#E0DBD0] ml-[25%]" title="75% Milestone" />
          </div>
        </div>

        {/* Milestone Labels */}
        <div className="flex justify-between text-[10px] font-mono text-[#A5A58D] px-1">
          <span>0h (Start)</span>
          <span>{(targetHours * 0.25).toFixed(1)}h</span>
          <span>{(targetHours * 0.5).toFixed(1)}h (Halfway)</span>
          <span>{(targetHours * 0.75).toFixed(1)}h</span>
          <span className="font-bold text-[#6B705C]">{targetHours}h (Goal)</span>
        </div>
      </div>

      {/* Motivational Accountability Status Banner */}
      <div className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        isGoalMet
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
          : isZero
          ? 'bg-rose-50/90 border-rose-200 text-rose-900'
          : 'bg-amber-50/90 border-amber-200 text-amber-900'
      }`}>
        <div className="flex items-center gap-2">
          {isGoalMet ? (
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          )}
          <span className="leading-relaxed">
            {isGoalMet ? (
              <span>
                <strong>Daily Target Achieved!</strong> You've met today's commitment with {todayHours} hours logged.
                {bonusHours > 0 && ` (+${bonusHours}h bonus credit earned today!)`}
              </span>
            ) : isZero ? (
              <span>
                <strong>Zero hours logged today.</strong> Have you studied today? Log even 15 or 30 mins to protect your streak.
              </span>
            ) : (
              <span>
                <strong>Behind Target by {remainingHours} hours.</strong> No cheap dopamine or social media scrolling until today's {targetHours}h target is logged.
              </span>
            )}
          </span>
        </div>

        {/* Accountability & Alarm Tools */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 text-[11px]">
          {/* Direct 1-Click .ics Calendar Alarms Export (Works on Safari & iPad without popups) */}
          <button
            onClick={handleExportWidgetICS}
            className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 font-bold transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Download iCal schedule (.ics) with built-in 10m & 30m buzz alarms for Apple Calendar and Google Calendar"
          >
            <Download className="w-3 h-3 text-emerald-700" />
            <span>iPad / Phone Alarms (.ics)</span>
          </button>

          {/* Sound Alarm Test */}
          <button
            onClick={handleTestSystemNotification}
            className="px-2.5 py-1 rounded-lg bg-white/90 border border-current font-bold hover:bg-white transition cursor-pointer flex items-center gap-1 shadow-2xs"
            title="Play audible chime & trigger browser notification"
          >
            <Volume2 className="w-3 h-3" />
            <span>Test Alarm</span>
          </button>

          {/* Direct WhatsApp Accountability Link (NO window.open / NO blocked popups in Safari) */}
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1 shadow-2xs"
            title="Send accountability report to WhatsApp without popup blockers"
          >
            <MessageCircle className="w-3 h-3" />
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* Temporary Feedback Notification */}
      {feedbackNotice && (
        <div className="p-3 rounded-xl bg-[#6B705C] text-white text-xs font-bold animate-fade-in flex items-center justify-between shadow-xs">
          <span>{feedbackNotice}</span>
          <button onClick={() => setFeedbackNotice(null)} className="opacity-70 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {/* DAILY ACCOUNTABILITY REVIEW MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 relative text-[#4A4E4D] max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-xs ${
                  isZero ? 'bg-rose-600' : isGoalMet ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-serif italic font-bold text-[#6B705C]">
                    Daily Accountability Review
                  </h4>
                  <p className="text-[11px] text-[#A5A58D]">
                    {todayStr} • Target: {targetHours} hrs/day
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="p-1 text-[#A5A58D] hover:text-[#4A4E4D] rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Core Review Questions */}
            <div className="space-y-3.5 text-xs">
              <div className={`p-4 rounded-2xl border space-y-1.5 ${
                isZero 
                  ? 'bg-rose-50 border-rose-200 text-rose-950' 
                  : isGoalMet 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <div className="font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4" />
                  <span>Have you studied today?</span>
                </div>
                <p className="text-xs leading-relaxed">
                  {isZero ? (
                    <span>
                      <strong>Lock time is currently 0.0 hrs!</strong> Why haven't you logged in today? If you studied offline (textbooks, notes, tutoring), log your hours below immediately.
                    </span>
                  ) : isGoalMet ? (
                    <span>
                      <strong>Goal Complete!</strong> You have logged {todayHours}h out of {targetHours}h. Your discipline is paying dividends.
                    </span>
                  ) : (
                    <span>
                      You have logged <strong>{todayHours}h</strong> today. You still need <strong>{remainingHours}h</strong> to meet your daily target.
                    </span>
                  )}
                </p>
              </div>

              {/* 1-Tap Log Shortcuts */}
              <div className="space-y-2 p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
                <div className="font-bold text-[#6B705C] uppercase text-[11px] tracking-wider flex items-center justify-between">
                  <span>Fast Catch-Up Logs</span>
                  <span className="text-[10px] text-[#A5A58D] font-normal">Click to add offline hours</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      onClick={() => {
                        handleDirectQuickLog(mins);
                        setIsReviewModalOpen(false);
                      }}
                      className="py-2 rounded-xl bg-white border border-[#E0DBD0] hover:bg-[#6B705C] hover:text-white hover:border-[#6B705C] font-bold font-mono text-xs transition cursor-pointer shadow-2xs text-[#4A4E4D]"
                    >
                      +{mins} mins
                    </button>
                  ))}
                </div>
              </div>

              {/* External External Dispatches (WhatsApp & Email without blocked popups) */}
              <div className="space-y-2 p-4 rounded-2xl bg-[#F9F7F2] border border-[#E0DBD0]">
                <div className="font-bold text-[#6B705C] uppercase text-[11px] tracking-wider">
                  External Accountability Partners
                </div>
                <p className="text-[11px] text-[#A5A58D]">
                  Keep yourself honest by broadcasting your status to your accountability chat or email:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Send to WhatsApp</span>
                  </a>
                  <a
                    href={mailtoUrl}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Send to Email</span>
                  </a>
                </div>
              </div>

              {/* Calendar Phone Alarms (.ics) */}
              <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 flex items-center justify-between gap-3 text-xs">
                <div>
                  <strong>Arm Phone Buzz Alarms:</strong>
                  <p className="text-[11px] text-blue-800">
                    Get 10m & 30m audible notifications on your iPad and phone before each planned session.
                  </p>
                </div>
                <button
                  onClick={handleExportWidgetICS}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shrink-0 cursor-pointer shadow-xs"
                >
                  Download .ics
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E0DBD0] flex justify-end gap-2">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D]"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setIsReviewModalOpen(false);
                  setActiveTab('timer');
                }}
                className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#585c4c] text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Focus Sprint Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAST DETAILED QUICK-LOG MODAL */}
      {isQuickLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white border border-[#E0DBD0] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 relative text-[#4A4E4D]">
            <div className="flex items-center justify-between border-b border-[#E0DBD0] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-serif italic font-bold text-[#6B705C]">
                    Log Completed Study Session
                  </h4>
                  <p className="text-[11px] text-[#A5A58D]">
                    Quickly add time toward today's {targetHours}h commitment
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuickLogModalOpen(false)}
                className="p-1 text-[#A5A58D] hover:text-[#4A4E4D] rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickLogSubmit} className="space-y-4 text-xs">
              {/* Duration Quick Chips */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider">
                  Session Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 45, 60, 90, 120, 150, 180].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setQuickLogDurationMinutes(mins)}
                      className={`py-2 rounded-xl font-bold font-mono text-xs transition border cursor-pointer ${
                        quickLogDurationMinutes === mins
                          ? 'bg-[#6B705C] text-white border-[#6B705C] shadow-2xs'
                          : 'bg-[#F9F7F2] text-[#4A4E4D] border-[#E0DBD0] hover:bg-[#F2EFE9]'
                      }`}
                    >
                      {mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject Selection */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider">
                  Subject
                </label>
                <select
                  value={quickLogSubject}
                  onChange={e => setQuickLogSubject(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs font-semibold text-[#4A4E4D] focus:outline-none focus:ring-2 focus:ring-[#6B705C]"
                >
                  {subjects.length > 0 ? (
                    subjects.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Physics">Physics</option>
                      <option value="Chemistry">Chemistry</option>
                      <option value="Mathematics">Mathematics</option>
                      <option value="Biology">Biology</option>
                      <option value="General Studies">General Studies</option>
                    </>
                  )}
                </select>
              </div>

              {/* Topic Focus */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider">
                  Focus Topic / Activity (Optional)
                </label>
                <input
                  type="text"
                  value={quickLogTopic}
                  onChange={e => setQuickLogTopic(e.target.value)}
                  placeholder="e.g. Thermodynamics PV cycle practice, past paper review..."
                  className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs text-[#4A4E4D] focus:outline-none focus:ring-2 focus:ring-[#6B705C]"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-[#6B705C] uppercase tracking-wider">
                  Key Learnings / Session Notes
                </label>
                <textarea
                  rows={2}
                  value={quickLogNotes}
                  onChange={e => setQuickLogNotes(e.target.value)}
                  placeholder="What was completed or what questions need revisiting..."
                  className="w-full p-2.5 rounded-xl bg-[#F9F7F2] border border-[#E0DBD0] text-xs text-[#4A4E4D] focus:outline-none focus:ring-2 focus:ring-[#6B705C]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-[#E0DBD0]">
                <button
                  type="button"
                  onClick={() => setIsQuickLogModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-[#A5A58D] hover:text-[#4A4E4D] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingLog}
                  className="px-5 py-2 rounded-xl bg-[#6B705C] hover:bg-[#585c4c] text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log {quickLogDurationMinutes}m Session</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
