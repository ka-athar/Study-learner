/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  MessageSquare, 
  ChevronRight, 
  PenTool, 
  Bell, 
  Flame, 
  Layers, 
  Zap, 
  Check, 
  X,
  Send,
  Calendar,
  BookOpen,
  Tv,
  Columns
} from 'lucide-react';
import { pipTimer } from '../lib/pipTimerService';
import { 
  StudySession, 
  StudyPlan, 
  RevisionItem, 
  UserProfile, 
  Subject 
} from '../types';
import { getGoogleChatConfig, saveGoogleChatConfig, sendNotificationViaWebhook, buildStudyAudit } from '../lib/googleChatService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface FrontFacingStudyDockProps {
  sessions: StudySession[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  userProfile: UserProfile | null;
  subjects: Subject[];
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string, durationMinutes?: number) => void;
  onOpenGoogleChatSidebar: () => void;
  onNavigateTab: (tab: any) => void;
  onOpenSplitScreen?: () => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

export const FrontFacingStudyDock: React.FC<FrontFacingStudyDockProps> = ({
  sessions,
  plans,
  revisions,
  userProfile,
  subjects,
  onStartTimerForTopic,
  onOpenGoogleChatSidebar,
  onNavigateTab,
  onOpenSplitScreen,
  onUpdateProfile
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPlan = plans.find(p => p.date === todayStr) || plans[0] || null;

  // Active / Written Sprint Focus state
  const [writtenSprintTopic, setWrittenSprintTopic] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('studyflow_written_sprint_topic');
      if (saved) return saved;
    } catch (e) {}
    const firstPending = todayPlan?.topics?.find(t => !t.completed);
    return firstPending ? `${firstPending.subjectName}: ${firstPending.topicName}` : 'Physics: Electromagnetic Induction';
  });
  const [isEditingSprint, setIsEditingSprint] = useState<boolean>(false);
  const [tempSprintTopic, setTempSprintTopic] = useState<string>(writtenSprintTopic);

  // Sign Hours State
  const [isSignHoursModalOpen, setIsSignHoursModalOpen] = useState<boolean>(false);
  const [signedHoursRecord, setSignedHoursRecord] = useState<{
    date: string;
    hours: number;
    signedBy: string;
    signedAt: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem(`studyflow_signed_hours_${todayStr}`);
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Google Chat Config state
  const [chatConfig, setChatConfig] = useState(() => getGoogleChatConfig());
  const effectiveWebhook = chatConfig.webhookUrl || userProfile?.googleChatWebhookUrl || '';
  const effectiveSpaceLink = chatConfig.spaceLinkUrl || userProfile?.googleChatSpaceLink || '';
  const isChatLinked = Boolean(
    (effectiveWebhook && (effectiveWebhook.startsWith('https://chat.googleapis.com/') || effectiveWebhook.startsWith('https://discord.com/'))) ||
    Boolean(effectiveSpaceLink && (effectiveSpaceLink.includes('google.com') || effectiveSpaceLink.includes('http'))) ||
    chatConfig.connectionMethod === 'google_account' ||
    userProfile?.googleChatConnectionMethod === 'email'
  );

  useEffect(() => {
    if (userProfile?.googleChatWebhookUrl && !chatConfig.webhookUrl) {
      const cfg = getGoogleChatConfig();
      cfg.webhookUrl = userProfile.googleChatWebhookUrl;
      cfg.isConfigured = true;
      saveGoogleChatConfig(cfg);
      setChatConfig(cfg);
    }
  }, [userProfile?.googleChatWebhookUrl]);

  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e?.detail) setChatConfig(e.detail);
    };
    window.addEventListener('study_google_chat_config_updated', handleUpdated);
    return () => window.removeEventListener('study_google_chat_config_updated', handleUpdated);
  }, []);

  // Compute Today's Total Study Minutes & Hours
  const todaySessions = sessions.filter(s => s.date === todayStr || (s.timestamp && Date.now() - s.timestamp <= 24 * 60 * 60 * 1000));
  const totalMinutesToday = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
  const hoursToday = (totalMinutesToday / 60).toFixed(1);
  const targetHours = userProfile?.targetHoursPerDay || 3;
  const targetPercent = Math.min(100, Math.round((totalMinutesToday / (targetHours * 60)) * 100));

  // Compute Impending Exams & Notices
  const upcomingExams = (userProfile?.examDates || []).map(e => {
    const examMs = new Date(e.date + 'T12:00:00').getTime();
    const diffDays = Math.ceil((examMs - Date.now()) / (1000 * 60 * 60 * 24));
    return { ...e, daysRemaining: diffDays };
  }).filter(e => e.daysRemaining >= 0 && e.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const dueRevisions = revisions.filter(r => r.status !== 'Completed' && (r.dueDate === todayStr || r.dueDate < todayStr));
  const pendingPlanTopics = todayPlan?.topics?.filter(t => !t.completed) || [];

  const handleSaveSprint = () => {
    const clean = tempSprintTopic.trim();
    if (clean) {
      setWrittenSprintTopic(clean);
      try {
        localStorage.setItem('studyflow_written_sprint_topic', clean);
      } catch (e) {}
    }
    setIsEditingSprint(false);
  };

  const handleStartSprint = (durationMinutes: number = 25) => {
    // Parse subject and topic from written sprint if formatted as "Subject: Topic"
    let subject = 'General';
    let topic = writtenSprintTopic;
    if (writtenSprintTopic.includes(':')) {
      const parts = writtenSprintTopic.split(':');
      subject = parts[0].trim();
      topic = parts.slice(1).join(':').trim();
    }
    onStartTimerForTopic(subject, 'Curriculum Sprint', topic, durationMinutes);
  };

  const handleSignHours = (signatureName: string) => {
    const record = {
      date: todayStr,
      hours: parseFloat(hoursToday),
      signedBy: signatureName || userProfile?.displayName || 'Student',
      signedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setSignedHoursRecord(record);
    try {
      localStorage.setItem(`studyflow_signed_hours_${todayStr}`, JSON.stringify(record));
    } catch (e) {}
    setIsSignHoursModalOpen(false);
    triggerStudyGoalConfetti();
  };

  return (
    <>
      {/* FRONT-FACING DOCK CONTAINER */}
      <section 
        aria-label="Front-Facing Study Dock"
        className="w-full mb-6 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-surface via-card to-surface-raised border border-theme shadow-md transition-all relative overflow-hidden"
      >
        {/* Subtle decorative background bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500 opacity-80" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* SECTION 1: WRITTEN SPRINT FOCUS */}
          <div className="flex-1 min-w-0 pr-0 lg:pr-4 border-b lg:border-b-0 lg:border-r border-theme pb-4 lg:pb-0">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Written Sprint Focus
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTempSprintTopic(writtenSprintTopic);
                  setIsEditingSprint(!isEditingSprint);
                }}
                className="text-[11px] font-bold text-muted hover:text-primary transition cursor-pointer"
              >
                {isEditingSprint ? 'Cancel' : '✍️ Edit Focus'}
              </button>
            </div>

            {isEditingSprint ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={tempSprintTopic}
                  onChange={e => setTempSprintTopic(e.target.value)}
                  placeholder="e.g. Physics: Electromagnetic Induction"
                  className="flex-1 px-3 py-1.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleSaveSprint}
                  className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold transition hover:opacity-90 cursor-pointer"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <div 
                  onClick={() => {
                    setTempSprintTopic(writtenSprintTopic);
                    setIsEditingSprint(true);
                  }}
                  className="font-bold text-sm sm:text-base text-primary truncate hover:text-emerald-700 dark:hover:text-emerald-300 transition cursor-pointer flex items-center gap-1.5 group"
                  title="Click to edit current written sprint focus"
                >
                  <span>{writtenSprintTopic}</span>
                  <PenTool className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleStartSprint(25)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    <span>Start 25m Sprint</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartSprint(50)}
                    className="px-3 py-1.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span>50m Deep Block</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 2: SIGN HOURS (DAILY STUDY ATTESTATION) */}
          <div className="flex-1 min-w-0 px-0 lg:px-4 border-b lg:border-b-0 lg:border-r border-theme pb-4 lg:pb-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted">
                Daily Study Sign-Off
              </span>
              <span className="text-[10px] font-mono text-muted">
                Target: {targetHours}h / day
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl sm:text-2xl font-serif font-bold text-primary">
                    {hoursToday} <span className="text-xs font-sans font-normal text-muted">hours</span>
                  </span>
                  <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                    ({targetPercent}% of Goal)
                  </span>
                </div>
                <div className="text-[11px] text-muted truncate mt-0.5">
                  {signedHoursRecord ? (
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Signed by {signedHoursRecord.signedBy} at {signedHoursRecord.signedAt}</span>
                    </span>
                  ) : (
                    <span>{todaySessions.length} focus sessions logged today</span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSignHoursModalOpen(true)}
                className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 active:scale-95 ${
                  signedHoursRecord
                    ? 'bg-emerald-500/15 text-emerald-900 dark:text-emerald-200 border border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-[#6B705C] hover:bg-[#5a5f4e] text-white'
                }`}
                title="Sign and certify today's completed study hours"
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{signedHoursRecord ? 'Re-Sign Hours' : '✍️ Sign Hours'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 3: DOCK NOTICES */}
          <div className="flex-1 min-w-0 px-0 lg:px-4 border-b lg:border-b-0 lg:border-r border-theme pb-4 lg:pb-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                <Bell className="w-3 h-3" />
                <span>Dock Notices</span>
              </span>
              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-theme-accent text-primary">
                {upcomingExams.length + (dueRevisions.length > 0 ? 1 : 0) + (pendingPlanTopics.length > 0 ? 1 : 0)} Active
              </span>
            </div>

            <div className="space-y-1 text-xs">
              {upcomingExams[0] ? (
                <div 
                  onClick={() => onNavigateTab('calendar')}
                  className="p-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-950 dark:text-rose-200 flex items-center justify-between gap-2 cursor-pointer hover:bg-rose-500/15 transition truncate"
                  title="Click to view exam schedule"
                >
                  <span className="font-bold truncate">🚨 {upcomingExams[0].subject}: {upcomingExams[0].examName}</span>
                  <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300 shrink-0">
                    {upcomingExams[0].daysRemaining === 0 ? 'TODAY' : `${upcomingExams[0].daysRemaining}d left`}
                  </span>
                </div>
              ) : dueRevisions.length > 0 ? (
                <div 
                  onClick={() => onNavigateTab('137_revision')}
                  className="p-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-950 dark:text-indigo-200 flex items-center justify-between gap-2 cursor-pointer hover:bg-indigo-500/15 transition truncate"
                >
                  <span className="font-bold truncate">📚 {dueRevisions.length} Spaced 1-3-7 Revisions Due</span>
                  <span className="text-[10px] font-mono text-indigo-600 shrink-0">Review Now</span>
                </div>
              ) : (
                <div className="p-1.5 rounded-xl bg-surface border border-theme text-muted flex items-center justify-between text-[11px]">
                  <span>✨ All critical board deadlines on track!</span>
                  <span className="text-emerald-600 font-bold">100% OK</span>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4: COCKPIT & GOOGLE CHAT */}
          <div className="shrink-0 flex flex-wrap items-center gap-2 pl-0 lg:pl-2">
            <button
              type="button"
              onClick={() => onNavigateTab('study_cockpit')}
              className="px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 bg-[#6B705C] hover:bg-[#585C4B] text-white"
              title="Open Unified Daily Study Cockpit"
            >
              <Zap className="w-4 h-4 fill-current text-amber-400" />
              <span>Study Cockpit</span>
            </button>

            <button
              type="button"
              onClick={() => pipTimer.togglePip()}
              className="p-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 bg-surface hover:bg-theme-accent border border-theme text-primary"
              title="Pop out floating Picture-in-Picture window over all screens"
            >
              <Tv className="w-4 h-4 text-amber-500" />
            </button>

            {onOpenSplitScreen && (
              <button
                type="button"
                onClick={onOpenSplitScreen}
                className="p-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 bg-surface hover:bg-theme-accent border border-theme text-primary"
                title="Open Split-Screen PDF & Notes Companion"
              >
                <Columns className="w-4 h-4 text-indigo-500" />
              </button>
            )}

            <button
              type="button"
              onClick={onOpenGoogleChatSidebar}
              className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 ${
                isChatLinked
                  ? 'bg-teal-700 hover:bg-teal-800 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
              title="Open dedicated Google Chat sidebar with automated messaging controls and Gemini accountability coach"
            >
              <MessageSquare className="w-4 h-4" />
              <span className="hidden xl:inline">{isChatLinked ? 'Google Chat' : 'Link Chat'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* SIGN HOURS POP-UP MODAL */}
      {isSignHoursModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-card border border-theme rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <PenTool className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-primary font-serif">Sign &amp; Attest Study Hours</h3>
                  <p className="text-xs text-muted">Daily academic commitment certification</p>
                </div>
              </div>
              <button 
                onClick={() => setIsSignHoursModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted">Today&apos;s Date:</span>
                <span className="font-bold text-primary">{todayStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Completed Focus Sessions:</span>
                <span className="font-bold text-primary">{todaySessions.length} sessions</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Total Verified Study Hours:</span>
                <span className="font-bold text-emerald-600 text-sm">{hoursToday} hours</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Daily Target Hours:</span>
                <span className="font-bold text-primary">{targetHours} hours ({targetPercent}%)</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-primary font-mono">
                Student Signature (Your Name):
              </label>
              <input
                type="text"
                defaultValue={userProfile?.displayName || 'Student'}
                id="signature_name_input"
                className="w-full px-3.5 py-2 rounded-xl bg-surface border border-theme text-xs font-bold text-primary focus:outline-none focus:ring-1 focus:ring-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsSignHoursModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-semibold text-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const input = document.getElementById('signature_name_input') as HTMLInputElement;
                  handleSignHours(input?.value || userProfile?.displayName || 'Student');
                }}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Sign &amp; Certify Today&apos;s Hours</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
