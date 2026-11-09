/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Link2, 
  Radio, 
  Copy, 
  Check, 
  Calendar, 
  Bell, 
  ShieldCheck, 
  RotateCcw,
  ExternalLink,
  BookOpen,
  Play
} from 'lucide-react';
import { 
  StudySession, 
  StudyPlan, 
  RevisionItem, 
  MistakeEntry, 
  ExamDate,
  UserProfile 
} from '../types';
import { 
  buildStudyAudit, 
  getGoogleChatConfig, 
  saveGoogleChatConfig, 
  sendNotificationViaWebhook, 
  sendNotificationToChatSpace, 
  listGoogleChatSpaces, 
  ChatSpace, 
  GoogleChatConfig,
  StudyAuditData
} from '../lib/googleChatService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface GoogleChatNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: StudySession[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  mistakes?: MistakeEntry[];
  userProfile?: UserProfile | null;
  googleAccessToken?: string | null;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onNavigateToTimer?: () => void;
}

export const GoogleChatNotificationModal: React.FC<GoogleChatNotificationModalProps> = ({
  isOpen,
  onClose,
  sessions,
  plans,
  revisions,
  mistakes = [],
  userProfile,
  googleAccessToken,
  onStartTimerForTopic,
  onNavigateToTimer
}) => {
  const [config, setConfig] = useState<GoogleChatConfig>(() => getGoogleChatConfig());
  const [spaces, setSpaces] = useState<ChatSpace[]>([]);
  const [isLoadingSpaces, setIsLoadingSpaces] = useState<boolean>(false);
  const [spacesError, setSpacesError] = useState<string | null>(null);
  const [isAppNotConfigured, setIsAppNotConfigured] = useState<boolean>(false);

  // Dispatch state
  const [isSending, setIsSending] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);

  // Tab
  const [activeTab, setActiveTab] = useState<'preview' | 'connection' | 'schedule'>('preview');

  // Compute live study audit
  const audit: StudyAuditData = useMemo(() => {
    return buildStudyAudit({
      sessions,
      plans,
      revisions,
      mistakes,
      examDates: userProfile?.examDates || []
    });
  }, [sessions, plans, revisions, mistakes, userProfile?.examDates]);

  // Load spaces if OAuth mode and access token available
  useEffect(() => {
    if (!isOpen) return;

    if (googleAccessToken && config.mode === 'oauth') {
      setIsLoadingSpaces(true);
      setSpacesError(null);
      setIsAppNotConfigured(false);

      listGoogleChatSpaces(googleAccessToken).then(res => {
        setIsLoadingSpaces(false);
        if (res.error) {
          setSpacesError(res.error);
          if (res.isAppNotConfigured) {
            setIsAppNotConfigured(true);
          }
        } else {
          setSpaces(res.spaces);
          if (res.spaces.length > 0 && !config.selectedSpaceName) {
            const updated = {
              ...config,
              selectedSpaceName: res.spaces[0].name,
              selectedSpaceDisplayName: res.spaces[0].displayName || res.spaces[0].name
            };
            setConfig(updated);
            saveGoogleChatConfig(updated);
          }
        }
      });
    }
  }, [isOpen, googleAccessToken, config.mode]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveGoogleChatConfig(config);
    setFeedbackNotice({
      type: 'success',
      message: 'Google Chat notification preferences saved.'
    });
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  const handleDispatchNotification = async () => {
    setIsSending(true);
    setFeedbackNotice(null);

    let res: { success: boolean; message: string };

    if (config.mode === 'webhook') {
      if (!config.webhookUrl) {
        setFeedbackNotice({
          type: 'error',
          message: 'Please paste your Google Chat Space Webhook URL first in the Connection Settings tab.'
        });
        setIsSending(false);
        setActiveTab('connection');
        return;
      }
      res = await sendNotificationViaWebhook(config.webhookUrl, audit);
    } else {
      if (!googleAccessToken) {
        setFeedbackNotice({
          type: 'error',
          message: 'Google sign-in token is missing. Please sign in with your Google account first, or use an Incoming Space Webhook URL.'
        });
        setIsSending(false);
        return;
      }
      if (!config.selectedSpaceName) {
        setFeedbackNotice({
          type: 'error',
          message: 'Please select a Google Chat space to receive notifications.'
        });
        setIsSending(false);
        setActiveTab('connection');
        return;
      }
      res = await sendNotificationToChatSpace(config.selectedSpaceName, googleAccessToken, audit);
    }

    setIsSending(false);
    setFeedbackNotice({
      type: res.success ? 'success' : 'error',
      message: res.message
    });

    if (res.success) {
      triggerStudyGoalConfetti();
      setConfig(prev => ({ ...prev, lastDispatchedAt: new Date().toISOString() }));
    }
  };

  const handleCopySummaryText = () => {
    const summary = `📚 ACADEMIC DAILY STUDY NOTIFICATION (${audit.formattedDate})\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📊 Progress: ${audit.completionPercentage}% Complete · ${(audit.totalStudyMinutesToday / 60).toFixed(1)} hrs logged\n\n` +
      `✅ WHAT I HAVE DONE TODAY (${audit.completedTasks.length}):\n` +
      (audit.completedTasks.length > 0 
        ? audit.completedTasks.map(t => `  • [${t.subject}] ${t.topic} (${t.durationMinutes}m)`).join('\n')
        : '  • None yet') + '\n\n' +
      `⏳ WHAT I HAVE NOT DONE / PENDING (${audit.pendingTasks.length + audit.dueRevisions.length}):\n` +
      (audit.pendingTasks.length > 0 
        ? audit.pendingTasks.map(t => `  • [${t.subject}] ${t.topic} (${t.reason || 'Pending'})`).join('\n')
        : '') +
      (audit.dueRevisions.length > 0 
        ? '\n' + audit.dueRevisions.map(r => `  • [${r.subject}] ${r.topic} (Day ${r.dayInterval} Re-test)`).join('\n')
        : '') +
      (audit.impendingExams.length > 0 
        ? `\n\n🚨 IMPENDING EXAMS:\n` + audit.impendingExams.map(e => `  • ${e.subject}: ${e.examName} in ${e.daysRemaining} days (${e.date})`).join('\n')
        : '');

    navigator.clipboard.writeText(summary);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div 
        className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold font-serif text-primary">
                  Google Chat Study Notification & Audit Center
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-300 border border-teal-500/30">
                  Notification Only
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Delivers structured daily digests of what you have done vs. what is pending without conversational message spam.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Quiet Policy Notice */}
        <div className="px-6 py-2.5 bg-surface/80 border-b border-theme flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Zero DM Clutter: The app only broadcasts card digests to your chosen space with your explicit consent.
            </span>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-theme text-xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'preview' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              Audit Card
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('connection')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'connection' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              Connection & Space
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('schedule')}
              className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                activeTab === 'schedule' ? 'bg-[#6B705C] text-white shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              Schedule
            </button>
          </div>
        </div>

        {/* Feedback alert banner */}
        {feedbackNotice && (
          <div className={`mx-6 mt-4 p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in ${
            feedbackNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedbackNotice(null)}
              className="text-xs hover:opacity-75 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* TAB 1: AUDIT CARD PREVIEW */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-theme pb-2">
                <div>
                  <h4 className="text-xs font-bold font-serif text-primary">
                    Today&apos;s Academic Audit Card ({audit.formattedDate})
                  </h4>
                  <p className="text-[11px] text-muted">
                    This formatted card will be dispatched to your Google Chat space to keep you accountable.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {onNavigateToTimer && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToTimer();
                        onClose();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-xs font-bold text-emerald-800 dark:text-emerald-300 transition cursor-pointer active:scale-95 shadow-2xs"
                      title="Open Focus Timer"
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Open Timer</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopySummaryText}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-xs font-medium text-primary transition cursor-pointer shadow-2xs"
                    title="Copy audit card text"
                  >
                    {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedText ? 'Copied' : 'Copy Text'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDispatchNotification}
                    disabled={isSending}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50 active:scale-95"
                  >
                    <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-pulse' : ''}`} />
                    <span>{isSending ? 'Dispatching...' : 'Dispatch Card to Chat'}</span>
                  </button>
                </div>
              </div>

              {/* Dedicated Focus Timer Quick Sprint Banner */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-2xs">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">Dedicated Study Timer</span>
                      <span className="px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-mono text-[10px] font-bold">
                        25m Pomodoro
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      {audit.pendingTasks[0] 
                        ? `Launch focus session for pending goal: "${audit.pendingTasks[0].topic}" (${audit.pendingTasks[0].subject})`
                        : 'Ready to study? Launch a distraction-free Pomodoro session anytime.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {audit.pendingTasks[0] && onStartTimerForTopic && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartTimerForTopic(audit.pendingTasks[0].subject, '', audit.pendingTasks[0].topic);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                      title={`Launch 25m timer for ${audit.pendingTasks[0].topic}`}
                    >
                      <Play className="w-3.5 h-3.5 fill-white" />
                      <span>Start: {audit.pendingTasks[0].topic.slice(0, 18)}...</span>
                    </button>
                  )}
                  {onNavigateToTimer && (
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateToTimer();
                        onClose();
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-card hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                      title="Open Zen Sprint Focus Timer"
                    >
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Open Timer</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-surface border border-theme">
                  <span className="text-[10px] font-mono text-muted uppercase">Completion Rate</span>
                  <div className="text-lg font-bold font-mono text-teal-700 dark:text-teal-300 mt-0.5">
                    {audit.completionPercentage}%
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-surface border border-theme">
                  <span className="text-[10px] font-mono text-muted uppercase">Focus Time Today</span>
                  <div className="text-lg font-bold font-mono text-primary mt-0.5">
                    {(audit.totalStudyMinutesToday / 60).toFixed(1)} hrs
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-surface border border-theme">
                  <span className="text-[10px] font-mono text-muted uppercase">Tasks Completed</span>
                  <div className="text-lg font-bold font-mono text-emerald-600 mt-0.5">
                    {audit.doneCount}
                  </div>
                </div>
                <div className="p-3 rounded-2xl bg-surface border border-theme">
                  <span className="text-[10px] font-mono text-muted uppercase">Pending Items</span>
                  <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">
                    {audit.pendingCount}
                  </div>
                </div>
              </div>

              {/* Dual-Column Split: WHAT I HAVE DONE vs WHAT IS PENDING */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SECTION 1: WHAT I HAVE DONE TODAY */}
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 font-mono uppercase flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>1. What I Have Done Today ({audit.completedTasks.length})</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Logged Work
                    </span>
                  </div>

                  {audit.completedTasks.length > 0 ? (
                    <div className="space-y-2">
                      {audit.completedTasks.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-card border border-emerald-500/20 text-xs space-y-0.5">
                          <div className="flex items-center justify-between font-bold text-primary">
                            <span>{item.topic}</span>
                            <span className="text-[10px] font-mono text-muted font-normal">
                              {item.durationMinutes}m
                            </span>
                          </div>
                          <span className="text-[10px] text-muted font-mono">{item.subject}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted italic bg-card/60 rounded-xl border border-emerald-500/20">
                      No study sessions completed today yet. Start a focus timer or complete a study plan topic!
                    </div>
                  )}

                  {audit.curedMistakesCount > 0 && (
                    <div className="p-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-[11px] text-emerald-950 dark:text-emerald-200 font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{audit.curedMistakesCount} mistake trap(s) verified & cured today!</span>
                    </div>
                  )}
                </div>

                {/* SECTION 2: WHAT I HAVE NOT DONE / PENDING */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                    <span className="text-xs font-bold text-amber-950 dark:text-amber-200 font-mono uppercase flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>2. What Is Pending Today ({audit.pendingTasks.length + audit.dueRevisions.length})</span>
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      Action Items
                    </span>
                  </div>

                  {audit.pendingTasks.length > 0 || audit.dueRevisions.length > 0 ? (
                    <div className="space-y-2">
                      {audit.pendingTasks.map((item, idx) => (
                        <div key={idx} className="p-2.5 rounded-xl bg-card border border-amber-500/20 text-xs flex items-center justify-between gap-2.5">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary truncate">{item.topic}</span>
                              <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 font-bold shrink-0">
                                Pending
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted font-mono truncate">
                              <span>{item.subject}</span>
                              <span>•</span>
                              <span>{item.reason || 'Scheduled today'}</span>
                            </div>
                          </div>
                          {onStartTimerForTopic && (
                            <button
                              type="button"
                              onClick={() => {
                                onStartTimerForTopic(item.subject, '', item.topic);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
                              title={`Start timer for ${item.topic}`}
                            >
                              <Play className="w-2.5 h-2.5 fill-white" />
                              <span>Timer</span>
                            </button>
                          )}
                        </div>
                      ))}

                      {audit.dueRevisions.map((rev, idx) => (
                        <div key={`rev-${idx}`} className="p-2.5 rounded-xl bg-card border border-indigo-500/20 text-xs flex items-center justify-between gap-2.5">
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-primary truncate">{rev.topic}</span>
                              <span className="text-[10px] font-mono text-indigo-600 font-bold shrink-0">
                                Day {rev.dayInterval} Re-test
                              </span>
                            </div>
                            <span className="text-[10px] text-muted font-mono">{rev.subject}</span>
                          </div>
                          {onStartTimerForTopic && (
                            <button
                              type="button"
                              onClick={() => {
                                onStartTimerForTopic(rev.subject, '', rev.topic);
                                onClose();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 transition shadow-2xs cursor-pointer active:scale-95"
                              title={`Start revision timer for ${rev.topic}`}
                            >
                              <Play className="w-2.5 h-2.5 fill-white" />
                              <span>Revise</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-muted italic bg-card/60 rounded-xl border border-amber-500/20">
                      🎉 All scheduled goals and revisions are completed for today!
                    </div>
                  )}

                  {/* Impending Exam Countdowns */}
                  {audit.impendingExams.length > 0 && (
                    <div className="pt-2 border-t border-amber-500/30 space-y-1.5">
                      <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1 font-mono uppercase">
                        🚨 Impending Board Exams:
                      </span>
                      {audit.impendingExams.slice(0, 2).map((ex, idx) => (
                        <div key={idx} className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs flex items-center justify-between">
                          <span className="font-bold text-rose-950 dark:text-rose-200">{ex.subject}: {ex.examName}</span>
                          <span className="text-[10px] font-mono font-bold text-rose-700 dark:text-rose-300">
                            {ex.daysRemaining === 0 ? 'TODAY' : `${ex.daysRemaining}d away`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Google Chat Card Interactive Button Bar Preview */}
              <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Included in Google Chat Card: 1-Click Study Actions</span>
                  </span>
                  <span className="text-[10px] text-muted font-mono">Interactive Deep Links</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToTimer) onNavigateToTimer();
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>⏱️ Start 25m Focus Timer</span>
                  </button>
                  {audit.pendingTasks[0] && onStartTimerForTopic && (
                    <button
                      type="button"
                      onClick={() => {
                        onStartTimerForTopic(audit.pendingTasks[0].subject, '', audit.pendingTasks[0].topic);
                        onClose();
                      }}
                      className="px-3.5 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                      <span>🎯 Timer: {audit.pendingTasks[0].topic.slice(0, 24)}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (onNavigateToTimer) onNavigateToTimer();
                      onClose();
                    }}
                    className="px-3.5 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                  >
                    <span>⚡ 50m Deep Sprint</span>
                  </button>
                </div>
              </div>

              {config.lastDispatchedAt && (
                <div className="text-[11px] font-mono text-muted text-right">
                  Last card dispatched: {new Date(config.lastDispatchedAt).toLocaleString()}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONNECTION & SPACE SETTINGS */}
          {activeTab === 'connection' && (
            <div className="space-y-5">
              <div className="border-b border-theme pb-2">
                <h4 className="text-xs font-bold font-serif text-primary">
                  Google Chat Delivery Channel
                </h4>
                <p className="text-[11px] text-muted">
                  Choose how the notification card is delivered to your designated Google Chat space.
                </p>
              </div>

              {/* Delivery Channel Radio Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label 
                  onClick={() => setConfig(prev => ({ ...prev, mode: 'webhook' }))}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                    config.mode === 'webhook'
                      ? 'bg-teal-500/10 border-teal-500/40 shadow-xs'
                      : 'bg-surface border-theme hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Link2 className="w-4 h-4 text-teal-600" />
                      <span>Incoming Space Webhook (Recommended)</span>
                    </span>
                    <input 
                      type="radio" 
                      name="chat_mode" 
                      checked={config.mode === 'webhook'} 
                      onChange={() => setConfig(prev => ({ ...prev, mode: 'webhook' }))}
                      className="text-teal-600" 
                    />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Zero Google Cloud bot configuration required. Paste the webhook URL from any Google Chat Space to immediately receive cards.
                  </p>
                </label>

                <label 
                  onClick={() => setConfig(prev => ({ ...prev, mode: 'oauth' }))}
                  className={`p-4 rounded-2xl border cursor-pointer transition flex flex-col justify-between space-y-2 ${
                    config.mode === 'oauth'
                      ? 'bg-teal-500/10 border-teal-500/40 shadow-xs'
                      : 'bg-surface border-theme hover:bg-surface-raised'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Radio className="w-4 h-4 text-teal-600" />
                      <span>Google Chat Spaces (OAuth)</span>
                    </span>
                    <input 
                      type="radio" 
                      name="chat_mode" 
                      checked={config.mode === 'oauth'} 
                      onChange={() => setConfig(prev => ({ ...prev, mode: 'oauth' }))}
                      className="text-teal-600" 
                    />
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Selects from your accessible Google Chat Spaces using your authenticated Google Workspace credentials.
                  </p>
                </label>
              </div>

              {/* Mode 1: Webhook URL Input */}
              {config.mode === 'webhook' && (
                <div className="p-4 rounded-2xl bg-surface/70 border border-theme space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-primary flex items-center gap-1">
                      <span>Google Chat Space Webhook URL</span>
                      <span className="text-[10px] text-teal-600 font-mono">(Direct Notification)</span>
                    </label>
                    <input 
                      type="url"
                      value={config.webhookUrl || ''}
                      onChange={e => setConfig(prev => ({ ...prev, webhookUrl: e.target.value }))}
                      placeholder="https://chat.googleapis.com/v1/spaces/AAAA.../messages?key=...&token=..."
                      className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-mono text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-theme/60 text-[11px] text-muted space-y-1.5">
                    <strong>How to get your Google Chat webhook URL in 30 seconds:</strong>
                    <ol className="list-decimal pl-4 space-y-0.5">
                      <li>Open <a href="https://chat.google.com" target="_blank" rel="noreferrer" className="text-teal-600 underline">Google Chat</a> and create or open your study space (e.g., <i>My Daily Study Audit</i>).</li>
                      <li>Click the Space name at the top &gt; <b>Apps &amp; integrations</b>.</li>
                      <li>Click <b>Add webhooks</b> &gt; Name it <i>PrepForge Academic Bot</i> &gt; Click <b>Save</b>.</li>
                      <li>Copy the generated Webhook URL and paste it into the box above.</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Mode 2: OAuth Spaces Selector */}
              {config.mode === 'oauth' && (
                <div className="p-4 rounded-2xl bg-surface/70 border border-theme space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-primary">
                        Select Target Google Chat Space
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (googleAccessToken) {
                            setIsLoadingSpaces(true);
                            listGoogleChatSpaces(googleAccessToken).then(res => {
                              setIsLoadingSpaces(false);
                              if (!res.error) setSpaces(res.spaces);
                            });
                          }
                        }}
                        className="text-[11px] text-teal-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Refresh Spaces</span>
                      </button>
                    </div>

                    {isLoadingSpaces ? (
                      <div className="p-3 text-xs text-muted font-mono animate-pulse">
                        Loading your Google Chat spaces...
                      </div>
                    ) : spaces.length > 0 ? (
                      <select
                        value={config.selectedSpaceName || ''}
                        onChange={e => {
                          const s = spaces.find(sp => sp.name === e.target.value);
                          setConfig(prev => ({
                            ...prev,
                            selectedSpaceName: e.target.value,
                            selectedSpaceDisplayName: s?.displayName || e.target.value
                          }));
                        }}
                        className="w-full px-3 py-2 rounded-xl bg-card border border-theme text-xs font-medium text-primary focus:outline-none focus:ring-1 focus:ring-teal-600"
                      >
                        {spaces.map(s => (
                          <option key={s.name} value={s.name}>
                            {s.displayName || s.name} ({s.type})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="p-3 rounded-xl bg-card border border-theme text-xs text-muted space-y-2">
                        <p>No Google Chat spaces found for this account.</p>
                        {spacesError && (
                          <p className="text-amber-700 dark:text-amber-300 font-mono text-[10px]">
                            {spacesError}
                          </p>
                        )}
                        {isAppNotConfigured && (
                          <p className="text-xs text-primary">
                            💡 <i>Quickest Solution</i>: Switch to the <b>Incoming Space Webhook</b> option above. It works instantly without needing Cloud Console configuration!
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Connection Settings
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: SCHEDULE & DISPATCH SETTINGS */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <div className="border-b border-theme pb-2">
                <h4 className="text-xs font-bold font-serif text-primary">
                  Automated Daily Study Audit Dispatch
                </h4>
                <p className="text-[11px] text-muted">
                  Configure the app to automatically post your &quot;Done vs. Not Done&quot; study audit card at the end of each study day.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface/70 border border-theme space-y-4">
                <label className="flex items-center justify-between p-3 rounded-xl bg-card border border-theme cursor-pointer">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-teal-600" />
                      <span>Automatic Evening Study Dispatch</span>
                    </span>
                    <p className="text-[11px] text-muted">
                      Dispatches the summary card when your study day concludes.
                    </p>
                  </div>
                  <input 
                    type="checkbox"
                    checked={config.autoNotifyEvening}
                    onChange={e => setConfig(prev => ({ ...prev, autoNotifyEvening: e.target.checked }))}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                </label>

                {config.autoNotifyEvening && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-primary font-mono">
                      Target Evening Dispatch Time:
                    </label>
                    <input 
                      type="time"
                      value={config.scheduledTime}
                      onChange={e => setConfig(prev => ({ ...prev, scheduledTime: e.target.value }))}
                      className="px-3 py-1.5 rounded-xl bg-card border border-theme text-xs font-mono text-primary focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDispatchNotification}
                  disabled={isSending}
                  className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Test Audit Card Now</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveConfig}
                  className="px-4 py-2 rounded-xl bg-[#6B705C] hover:bg-[#5a5f4e] text-white text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
