/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Link2, 
  Copy, 
  Check, 
  Bell, 
  ExternalLink,
  Play,
  RotateCcw,
  Bot,
  Zap,
  Info,
  Flame,
  Mail,
  Share2,
  Globe,
  HelpCircle
} from 'lucide-react';
import { 
  StudySession, 
  StudyPlan, 
  RevisionItem, 
  MistakeEntry, 
  UserProfile 
} from '../types';
import { 
  buildStudyAudit, 
  getGoogleChatConfig, 
  saveGoogleChatConfig, 
  sendNotificationViaWebhook, 
  sendTestPingToChat,
  generateAndSendAccountabilityNudge,
  formatAuditAsChatText,
  formatInactivityNudgeAsChatText,
  GoogleChatConfig
} from '../lib/googleChatService';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface GoogleChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: StudySession[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  mistakes?: MistakeEntry[];
  userProfile?: UserProfile | null;
  onStartTimerForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
  onNavigateToTimer?: () => void;
  onUpdateProfile?: (updates: Partial<UserProfile>) => void;
}

export const GoogleChatSidebar: React.FC<GoogleChatSidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  plans,
  revisions,
  mistakes = [],
  userProfile,
  onStartTimerForTopic,
  onNavigateToTimer,
  onUpdateProfile
}) => {
  const [config, setConfig] = useState<GoogleChatConfig>(() => getGoogleChatConfig());
  
  // Connection Mode Tabs: 'space_link' (Works for all @gmail accounts), 'google_account', 'webhook'
  const [connectionTab, setConnectionTab] = useState<'space_link' | 'google_account' | 'webhook'>(() => {
    if (config.webhookUrl) return 'webhook';
    if (config.spaceLinkUrl) return 'space_link';
    return 'space_link';
  });

  const [spaceLinkInput, setSpaceLinkInput] = useState<string>(() => config.spaceLinkUrl || userProfile?.googleChatSpaceLink || '');
  const [googleEmailInput, setGoogleEmailInput] = useState<string>(() => config.googleEmailAccount || userProfile?.email || 'atharkhanteambuster@gmail.com');
  const [webhookInput, setWebhookInput] = useState<string>(() => config.webhookUrl || userProfile?.googleChatWebhookUrl || '');
  
  const [isTestingPing, setIsTestingPing] = useState<boolean>(false);
  const [isTestingEmail, setIsTestingEmail] = useState<boolean>(false);
  const [isSendingAudit, setIsSendingAudit] = useState<boolean>(false);
  const [isGeneratingNudge, setIsGeneratingNudge] = useState<boolean>(false);
  const [showExplanation, setShowExplanation] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sync config from storage or userProfile
  useEffect(() => {
    if (userProfile?.googleChatWebhookUrl && !config.webhookUrl) {
      const updated = { ...config, webhookUrl: userProfile.googleChatWebhookUrl };
      setConfig(updated);
      setWebhookInput(userProfile.googleChatWebhookUrl);
      saveGoogleChatConfig(updated);
    }
    if (userProfile?.googleChatSpaceLink && !config.spaceLinkUrl) {
      const updated = { ...config, spaceLinkUrl: userProfile.googleChatSpaceLink };
      setConfig(updated);
      setSpaceLinkInput(userProfile.googleChatSpaceLink);
      saveGoogleChatConfig(updated);
    }
  }, [userProfile?.googleChatWebhookUrl, userProfile?.googleChatSpaceLink]);

  // Sync config from storage events
  useEffect(() => {
    const handleUpdated = (e: any) => {
      if (e?.detail) setConfig(e.detail);
    };
    window.addEventListener('study_google_chat_config_updated', handleUpdated);
    return () => window.removeEventListener('study_google_chat_config_updated', handleUpdated);
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];
  const audit = buildStudyAudit({
    sessions,
    plans,
    revisions,
    mistakes,
    examDates: userProfile?.examDates || [],
    targetDateStr: todayStr
  });

  const hasWebhook = Boolean(
    (config.webhookUrl || userProfile?.googleChatWebhookUrl) && 
    (config.webhookUrl || userProfile?.googleChatWebhookUrl)?.startsWith('https://chat.googleapis.com/')
  );
  const hasSpaceLink = Boolean(config.spaceLinkUrl || userProfile?.googleChatSpaceLink);
  const isLinked = hasWebhook || hasSpaceLink || Boolean(config.googleEmailAccount || userProfile?.email);

  // 1. SAVE GOOGLE CHAT SPACE LINK (Works for ALL @gmail.com accounts)
  const handleSaveSpaceLink = () => {
    const cleaned = spaceLinkInput.trim();
    if (!cleaned) {
      const updated = { ...config, spaceLinkUrl: '', connectionMethod: 'space_link' as const };
      setConfig(updated);
      saveGoogleChatConfig(updated);
      if (onUpdateProfile) {
        onUpdateProfile({ googleChatSpaceLink: '' });
      }
      setNotice({ type: 'info', text: 'Google Chat Space link cleared.' });
      return;
    }

    const updated = { ...config, spaceLinkUrl: cleaned, connectionMethod: 'space_link' as const, isConfigured: true };
    setConfig(updated);
    saveGoogleChatConfig(updated);
    if (onUpdateProfile) {
      onUpdateProfile({ 
        googleChatSpaceLink: cleaned, 
        googleChatConnectionMethod: 'space_link',
        googleChatConfig: updated 
      });
    }
    triggerStudyGoalConfetti();
    setNotice({ 
      type: 'success', 
      text: '🎉 Google Chat Space link saved! You can now 1-click launch and paste cards directly.' 
    });
  };

  // 2. SAVE WEBHOOK URL (For Workspace / School domains or Discord)
  const handleSaveWebhook = () => {
    const cleaned = webhookInput.trim();
    if (!cleaned) {
      const updated = { ...config, webhookUrl: '' };
      setConfig(updated);
      saveGoogleChatConfig(updated);
      if (onUpdateProfile) {
        onUpdateProfile({ googleChatWebhookUrl: '' });
      }
      setNotice({ type: 'info', text: 'Webhook unlinked.' });
      return;
    }

    if (!cleaned.startsWith('https://chat.googleapis.com/') && !cleaned.startsWith('https://discord.com/')) {
      setNotice({
        type: 'error',
        text: 'Invalid URL. Google Chat webhooks begin with https://chat.googleapis.com/... or https://discord.com/...'
      });
      return;
    }

    const updated = { ...config, webhookUrl: cleaned, connectionMethod: 'webhook' as const, isConfigured: true };
    setConfig(updated);
    saveGoogleChatConfig(updated);
    if (onUpdateProfile) {
      onUpdateProfile({ googleChatWebhookUrl: cleaned, googleChatConfig: updated });
    }
    triggerStudyGoalConfetti();
    setNotice({ type: 'success', text: 'Google Chat webhook saved & active across all screens!' });
  };

  // 3. SAVE GOOGLE ACCOUNT EMAIL FOR DIRECT DISPATCHES
  const handleSaveGoogleAccount = async () => {
    const email = googleEmailInput.trim() || userProfile?.email || 'atharkhanteambuster@gmail.com';
    const updated = { ...config, googleEmailAccount: email, connectionMethod: 'google_account' as const, isConfigured: true };
    setConfig(updated);
    saveGoogleChatConfig(updated);
    if (onUpdateProfile) {
      onUpdateProfile({ email, googleChatConfig: updated });
    }
    triggerStudyGoalConfetti();
    setNotice({ 
      type: 'success', 
      text: `✓ Linked to Google Account (${email})! Automated flight plans & audits will be sent directly.` 
    });
  };

  // 4. TEST PING (WEBHOOK)
  const handleTestPing = async () => {
    const targetUrl = webhookInput.trim() || config.webhookUrl || userProfile?.googleChatWebhookUrl;
    if (!targetUrl) {
      setNotice({ type: 'error', text: 'Please paste your Google Chat Space Webhook URL first.' });
      return;
    }

    setIsTestingPing(true);
    setNotice(null);
    const res = await sendTestPingToChat(targetUrl);
    setIsTestingPing(false);

    if (res.success) {
      triggerStudyGoalConfetti();
      setNotice({ type: 'success', text: 'Verified connection ping sent! Check your Google Chat Space now.' });
      const updated = { ...config, webhookUrl: targetUrl };
      setConfig(updated);
      saveGoogleChatConfig(updated);
      if (onUpdateProfile) {
        onUpdateProfile({ googleChatWebhookUrl: targetUrl, googleChatConfig: updated });
      }
    } else {
      setNotice({ type: 'error', text: res.message });
    }
  };

  // 5. TEST GOOGLE ACCOUNT EMAIL DISPATCH
  const handleTestEmailDispatch = async () => {
    const email = googleEmailInput.trim() || config.googleEmailAccount || userProfile?.email || 'atharkhanteambuster@gmail.com';
    setIsTestingEmail(true);
    setNotice(null);
    try {
      const res = await fetch('/api/notifications/dispatch-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          appUrl: window.location.origin,
          examDates: userProfile?.examDates || [],
          subjects: [],
          revisionItems: revisions
        })
      });
      const data = await res.json();
      setIsTestingEmail(false);
      if (data.success) {
        triggerStudyGoalConfetti();
        setNotice({ 
          type: 'success', 
          text: `📬 Sent verified study flight plan to your Google Account (${email})!` 
        });
      } else {
        setNotice({ type: 'error', text: data.message || 'Failed to dispatch test notification' });
      }
    } catch (err: any) {
      setIsTestingEmail(false);
      setNotice({ type: 'error', text: err?.message || 'Network error triggering dispatch' });
    }
  };

  // 6. COPY AUDIT & LAUNCH GOOGLE CHAT SPACE
  const handleCopyAuditAndOpenChat = async () => {
    const text = formatAuditAsChatText(audit);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey('audit');
      setTimeout(() => setCopiedKey(null), 3500);
      triggerStudyGoalConfetti();
      setNotice({
        type: 'success',
        text: '📋 Today\'s Study Audit copied to clipboard! Opening Google Chat Space...'
      });
      const targetUrl = spaceLinkInput.trim() || config.spaceLinkUrl || 'https://chat.google.com';
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setNotice({ type: 'error', text: 'Could not copy to clipboard. Please allow clipboard permissions.' });
    }
  };

  // 7. COPY GEMINI REALITY CHECK & LAUNCH GOOGLE CHAT SPACE
  const handleCopyInactivityNudgeAndOpenChat = async () => {
    setIsGeneratingNudge(true);
    setNotice(null);

    const hoursToday = parseFloat((audit.totalStudyMinutesToday / 60).toFixed(1));
    const targetHours = userProfile?.targetHoursPerDay || 3;

    try {
      let aiData: any = null;
      try {
        const res = await fetch('/api/ai/accountability-nudge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentName: userProfile?.displayName || userProfile?.name || 'Student',
            hoursToday,
            targetHours,
            pendingTasks: audit.pendingTasks,
            dueRevisions: audit.dueRevisions,
            upcomingExams: audit.impendingExams,
            lastActiveHoursAgo: hoursToday === 0 ? 10 : 4,
            language: 'en'
          })
        });
        if (res.ok) {
          aiData = await res.json();
        }
      } catch (e) {}

      const text = formatInactivityNudgeAsChatText({
        studentName: userProfile?.displayName || 'Student',
        hoursToday,
        targetHours,
        diagnostic: aiData?.diagnostic,
        whyYouHaventLoggedIn: aiData?.whyYouHaventLoggedIn,
        boardExamRealityCheck: aiData?.boardExamRealityCheck,
        rescueSprintTitle: aiData?.rescueSprintTitle,
        rescueSprintSteps: aiData?.rescueSprintSteps,
        motivationalSignoff: aiData?.motivationalSignoff
      });

      await navigator.clipboard.writeText(text);
      setIsGeneratingNudge(false);
      setCopiedKey('nudge');
      setTimeout(() => setCopiedKey(null), 3500);
      triggerStudyGoalConfetti();
      setNotice({
        type: 'success',
        text: '⚡ Gemini "Why You Haven\'t Logged In" reality check copied! Opening Google Chat Space...'
      });

      const targetUrl = spaceLinkInput.trim() || config.spaceLinkUrl || 'https://chat.google.com';
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    } catch (e: any) {
      setIsGeneratingNudge(false);
      setNotice({ type: 'error', text: e?.message || 'Error generating reality check' });
    }
  };

  // 8. DISPATCH VIA WEBHOOK IF AVAILABLE
  const handleDispatchAuditCard = async () => {
    if (!config.webhookUrl) {
      // Fallback: Copy to clipboard & open space
      handleCopyAuditAndOpenChat();
      return;
    }

    setIsSendingAudit(true);
    setNotice(null);
    const res = await sendNotificationViaWebhook(config.webhookUrl, audit);
    setIsSendingAudit(false);

    if (res.success) {
      triggerStudyGoalConfetti();
      setNotice({ type: 'success', text: 'Daily Done vs Not Done audit card posted to Google Chat!' });
    } else {
      setNotice({ type: 'error', text: res.message });
    }
  };

  const handleSendAccountabilityNudge = async () => {
    if (!config.webhookUrl) {
      // Fallback: Copy to clipboard & open space
      handleCopyInactivityNudgeAndOpenChat();
      return;
    }

    setIsGeneratingNudge(true);
    setNotice(null);

    const hoursToday = parseFloat((audit.totalStudyMinutesToday / 60).toFixed(1));
    const targetHours = userProfile?.targetHoursPerDay || 3;

    const res = await generateAndSendAccountabilityNudge({
      webhookUrl: config.webhookUrl,
      studentName: userProfile?.displayName || 'Student',
      hoursToday,
      targetHours,
      pendingTasks: audit.pendingTasks,
      dueRevisions: audit.dueRevisions,
      upcomingExams: audit.impendingExams,
      lastActiveHoursAgo: hoursToday === 0 ? 10 : 4,
      language: 'en'
    });

    setIsGeneratingNudge(false);

    if (res.success) {
      triggerStudyGoalConfetti();
      setNotice({
        type: 'success',
        text: 'Gemini "Why You Haven\'t Logged In" reality check dispatched to your Google Chat!'
      });
    } else {
      setNotice({ type: 'error', text: res.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in">
      <div 
        className="w-full max-w-md sm:max-w-lg bg-card border-l border-theme h-full flex flex-col shadow-2xl relative overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between bg-surface/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold font-serif text-primary">
                  Google Chat &amp; Study Alerts
                </h3>
                <span className={`px-2 py-0.2 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 border ${
                  isLinked 
                    ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLinked ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>
                    {hasWebhook 
                      ? 'Webhook Active' 
                      : hasSpaceLink 
                      ? 'Space Link Active' 
                      : 'Google Linked'}
                  </span>
                </span>
              </div>
              <p className="text-[11px] text-muted">
                Automatic study dispatches &amp; Gemini accountability reality checks
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Notice Alert */}
        {notice && (
          <div className={`mx-4 mt-3 p-3 rounded-2xl text-xs flex items-center justify-between gap-2 border animate-fade-in shrink-0 ${
            notice.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
              : notice.type === 'info'
              ? 'bg-blue-500/10 text-blue-800 dark:text-blue-300 border-blue-500/30'
              : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
          }`}>
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{notice.text}</span>
            </div>
            <button onClick={() => setNotice(null)} className="text-current opacity-70 hover:opacity-100 font-bold">✕</button>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          {/* WHY CAN'T I ADD A WEBHOOK EXPLANATION CALLOUT */}
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Can&apos;t create a webhook in Google Chat?</span>
              </div>
              <button 
                onClick={() => setShowExplanation(!showExplanation)}
                className="text-[10px] text-amber-800 dark:text-amber-300 font-bold hover:underline shrink-0"
              >
                {showExplanation ? 'Hide' : 'Why does this happen?'}
              </button>
            </div>
            <p className="text-[11px] text-amber-950/80 dark:text-amber-300/90 leading-relaxed">
              Google restricts incoming webhook creation to paid <b>Google Workspace</b> (school/work) domains. For personal <b>@gmail.com</b> accounts, Google intentionally hides the &quot;Manage Webhooks&quot; button.
            </p>
            {showExplanation && (
              <div className="pt-2 border-t border-amber-500/20 text-[11px] text-amber-900 dark:text-amber-200 space-y-1.5 animate-fade-in">
                <p>
                  <b>Don&apos;t worry at all!</b> You don&apos;t need a webhook to connect. Choose either:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li><b>Option 1 (Space Link):</b> In Google Chat, click your space name &gt; <i>Copy link to space</i>, and paste below. PrepForge lets you 1-click launch and post formatted cards with zero friction!</li>
                  <li><b>Option 2 (Google Account):</b> Link your Google email (<code>atharkhanteambuster@gmail.com</code>). Automated morning flight plans &amp; inactivity reality checks are sent directly to your Google account with zero setup!</li>
                </ul>
              </div>
            )}
          </div>

          {/* CONNECTION METHOD TABS */}
          <div className="p-4 rounded-3xl bg-surface/70 border border-theme space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Link2 className="w-4 h-4 text-emerald-600" />
                <span>1. Connect via Google Link</span>
              </h4>
            </div>

            {/* Segmented Tab Control */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-card border border-theme text-xs font-bold">
              <button
                type="button"
                onClick={() => setConnectionTab('space_link')}
                className={`py-2 px-2 rounded-xl transition text-center cursor-pointer ${
                  connectionTab === 'space_link'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                🌐 Space Link
              </button>
              <button
                type="button"
                onClick={() => setConnectionTab('google_account')}
                className={`py-2 px-2 rounded-xl transition text-center cursor-pointer ${
                  connectionTab === 'google_account'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                📧 Google Acc
              </button>
              <button
                type="button"
                onClick={() => setConnectionTab('webhook')}
                className={`py-2 px-2 rounded-xl transition text-center cursor-pointer ${
                  connectionTab === 'webhook'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                🔗 Webhook
              </button>
            </div>

            {/* TAB 1: GOOGLE CHAT SPACE LINK (Works for ALL @gmail.com accounts) */}
            {connectionTab === 'space_link' && (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3 rounded-2xl bg-card border border-theme text-[11px] text-muted space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-primary">How to get your Space Link (Works with any @gmail.com):</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Open <b>Google Chat</b> or Gmail Chat and open your study space.</li>
                    <li>Click the <b>Space title ▾</b> at the top and select <b>&quot;Copy link to space&quot;</b>.</li>
                    <li>Paste the copied link in the box below and click <b>Save Space Link</b>.</li>
                  </ol>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-primary font-mono flex items-center justify-between">
                    <span>Google Chat Space Link / URL:</span>
                    {hasSpaceLink && <span className="text-emerald-600 font-bold">✓ Saved</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://mail.google.com/chat/u/0/#chat/space/... or https://chat.google.com/..."
                      value={spaceLinkInput}
                      onChange={e => setSpaceLinkInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleSaveSpaceLink}
                      className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold transition hover:opacity-90 cursor-pointer shadow-xs shrink-0"
                    >
                      Save Link
                    </button>
                  </div>
                </div>

                {/* 1-Click Launch & Paste Actions */}
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyAuditAndOpenChat}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>{copiedKey === 'audit' ? '✓ Copied to Clipboard!' : '🚀 Copy Today\'s Audit & Open Google Chat'}</span>
                  </button>
                  <p className="text-[10px] text-center text-muted">
                    Copies your formatted Done vs. Not Done card &amp; opens your space in 1 click so you just press <b>Ctrl + V</b>!
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: 1-CLICK GOOGLE ACCOUNT DISPATCHES (Zero Webhooks Needed) */}
            {connectionTab === 'google_account' && (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3.5 rounded-2xl bg-card border border-theme text-[11px] text-muted space-y-1.5 leading-relaxed">
                  <p className="font-semibold text-primary">100% Automated Dispatches via Google Account:</p>
                  <p>
                    No webhooks or space configurations required. Morning agendas, evening study audits, and Gemini inactivity checks are delivered directly to your Google account inbox and notification center!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-primary font-mono flex items-center justify-between">
                    <span>Target Google Email:</span>
                    <span className="text-emerald-600 font-bold">✓ Active</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="email"
                      placeholder="your-email@gmail.com"
                      value={googleEmailInput}
                      onChange={e => setGoogleEmailInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleSaveGoogleAccount}
                      className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold transition hover:opacity-90 cursor-pointer shadow-xs shrink-0"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestEmailDispatch}
                  disabled={isTestingEmail}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Mail className={`w-4 h-4 ${isTestingEmail ? 'animate-pulse' : ''}`} />
                  <span>{isTestingEmail ? 'Delivering Google Alert...' : '🔔 Send Test Google Alert Now'}</span>
                </button>
              </div>
            )}

            {/* TAB 3: INCOMING WEBHOOK (Workspace / School or Discord) */}
            {connectionTab === 'webhook' && (
              <div className="space-y-3 animate-fade-in">
                <div className="p-3 rounded-2xl bg-card border border-theme text-[11px] text-muted space-y-1 leading-relaxed">
                  <p className="font-semibold text-primary">For Google Workspace (School/Company) or Discord:</p>
                  <p>
                    If your school or business account allows webhooks, paste the URL below. Alternatively, Discord webhooks are 100% free with no domain restrictions!
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-primary font-mono flex items-center justify-between">
                    <span>Incoming Webhook URL:</span>
                    {hasWebhook && <span className="text-emerald-600 font-bold">✓ Connected</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://chat.googleapis.com/... or https://discord.com/..."
                      value={webhookInput}
                      onChange={e => setWebhookInput(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-card border border-theme text-xs text-primary font-mono focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={handleSaveWebhook}
                      className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold transition hover:opacity-90 cursor-pointer shadow-xs shrink-0"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={isTestingPing || !webhookInput.trim()}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestingPing ? 'animate-pulse' : ''}`} />
                  <span>{isTestingPing ? 'Pinging Webhook...' : '🔔 Test & Ping Webhook Now'}</span>
                </button>
              </div>
            )}
          </div>

          {/* 2. AUTOMATIC SENDING SETTINGS */}
          <div className="p-4 rounded-3xl bg-surface/70 border border-theme space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                2. Automated Message Delivery
              </h4>
            </div>
            <p className="text-[11px] text-muted">
              Configure automatic background dispatches sent directly to your Google space or inbox.
            </p>

            <div className="space-y-2">
              {/* Toggle 1: Morning Flight Plan */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-card border border-theme cursor-pointer hover:bg-theme-accent/40 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">🌅 Morning Daily Flight Plan</span>
                    <span className="text-[10px] font-mono text-muted">({config.morningScheduledTime || '07:30'})</span>
                  </div>
                  <p className="text-[10px] text-muted">Dispatches today&apos;s planned syllabus queue every morning.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoNotifyMorning}
                  onChange={e => {
                    const updated = { ...config, autoNotifyMorning: e.target.checked };
                    setConfig(updated);
                    saveGoogleChatConfig(updated);
                  }}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              {/* Toggle 2: Evening Done vs Not Done Audit */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-card border border-theme cursor-pointer hover:bg-theme-accent/40 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary">🌙 Evening Done vs. Not Done Audit</span>
                    <span className="text-[10px] font-mono text-muted">({config.scheduledTime || '20:00'})</span>
                  </div>
                  <p className="text-[10px] text-muted">Summarizes completed work vs. untouched pending goals.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoNotifyEvening}
                  onChange={e => {
                    const updated = { ...config, autoNotifyEvening: e.target.checked };
                    setConfig(updated);
                    saveGoogleChatConfig(updated);
                  }}
                  className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                />
              </label>

              {/* Toggle 3: "Why You Haven't Logged In" Inactivity Coach */}
              <label className="flex items-center justify-between p-3 rounded-2xl bg-card border border-rose-500/30 bg-rose-500/5 cursor-pointer hover:bg-rose-500/10 transition">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-200">🚨 Inactivity &amp; &quot;Why You Haven&apos;t Logged In&quot;</span>
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-800 dark:text-rose-300">GEMINI AI</span>
                  </div>
                  <p className="text-[10px] text-muted">Autonomously sends reality checks if you haven&apos;t studied by {config.inactivityCutoffHour || 15}:00.</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.autoNotifyInactivity}
                  onChange={e => {
                    const updated = { ...config, autoNotifyInactivity: e.target.checked };
                    setConfig(updated);
                    saveGoogleChatConfig(updated);
                  }}
                  className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 3. GEMINI "WHY YOU HAVEN'T LOGGED IN" REALITY CHECK */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-rose-500/10 via-amber-500/10 to-surface border border-rose-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-600" />
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                  3. Gemini Inactivity Reality Check
                </h4>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300">
                Gemini AI
              </span>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Triggers a psychological behavioral analysis explaining why you haven&apos;t logged in today, delivers a Board Exam reality check, and gives you a 15-minute emergency rescue sprint.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              {hasWebhook ? (
                <button
                  type="button"
                  onClick={handleSendAccountabilityNudge}
                  disabled={isGeneratingNudge}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Zap className={`w-4 h-4 ${isGeneratingNudge ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingNudge ? 'Generating Diagnostic...' : '⚡ Send Inactivity Reality Check Now'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyInactivityNudgeAndOpenChat}
                  disabled={isGeneratingNudge}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Zap className={`w-4 h-4 ${isGeneratingNudge ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingNudge ? 'Generating Sprint...' : (copiedKey === 'nudge' ? '✓ Copied & Opening Chat...' : '⚡ Copy Reality Check & Open Chat')}</span>
                </button>
              )}
            </div>
          </div>

          {/* 4. TODAY'S AUDIT PREVIEW */}
          <div className="p-4 rounded-3xl bg-surface/70 border border-theme space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                  4. Current Audit Preview
                </h4>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {audit.completionPercentage}% Complete
              </span>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-card border border-theme text-center">
                <div className="text-[10px] text-muted font-mono uppercase">Logged</div>
                <div className="text-sm font-bold text-primary mt-0.5">
                  {(audit.totalStudyMinutesToday / 60).toFixed(1)}h
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono uppercase">Done</div>
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                  {audit.doneCount}
                </div>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                <div className="text-[10px] text-amber-700 dark:text-amber-300 font-mono uppercase">Pending</div>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                  {audit.pendingCount}
                </div>
              </div>
            </div>

            {/* Pending List preview */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-muted uppercase font-mono">Pending Tasks in Card:</div>
              {audit.pendingTasks.length > 0 ? (
                audit.pendingTasks.slice(0, 3).map((item, i) => (
                  <div key={i} className="p-2 rounded-xl bg-card border border-theme text-xs flex items-center justify-between gap-2">
                    <div className="truncate">
                      <span className="font-bold text-primary">{item.subject}: </span>
                      <span className="text-muted">{item.topic}</span>
                    </div>
                    {onStartTimerForTopic && (
                      <button
                        type="button"
                        onClick={() => {
                          onStartTimerForTopic(item.subject, 'Curriculum', item.topic);
                          onClose();
                        }}
                        className="p-1 px-2 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25 transition cursor-pointer shrink-0"
                      >
                        ⏱️ Start
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted italic">All scheduled study tasks completed for today!</div>
              )}
            </div>

            {/* Manual Dispatch / Copy button */}
            <div className="pt-2">
              {hasWebhook ? (
                <button
                  type="button"
                  onClick={handleDispatchAuditCard}
                  disabled={isSendingAudit}
                  className="w-full py-2.5 px-3 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
                >
                  <Send className={`w-4 h-4 ${isSendingAudit ? 'animate-pulse' : ''}`} />
                  <span>{isSendingAudit ? 'Posting Card...' : '📬 Post Done vs Not Done Card Now'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCopyAuditAndOpenChat}
                  className="w-full py-2.5 px-3 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
                >
                  <Copy className="w-4 h-4" />
                  <span>{copiedKey === 'audit' ? '✓ Copied to Clipboard!' : '📋 Copy Today\'s Audit & Open Google Chat'}</span>
                </button>
              )}
            </div>
          </div>

          {/* 5. RECENT DISPATCH LOGS */}
          {config.dispatchHistory && config.dispatchHistory.length > 0 && (
            <div className="p-4 rounded-3xl bg-surface/70 border border-theme space-y-2.5">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider font-mono">
                5. Recent Dispatches
              </h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {config.dispatchHistory.slice(0, 5).map(log => (
                  <div key={log.id} className="p-2 rounded-xl bg-card border border-theme text-[11px] flex items-center justify-between gap-2">
                    <div className="space-y-0.5 truncate">
                      <div className="font-bold text-primary truncate">{log.summary}</div>
                      <div className="text-[10px] text-muted">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.type}
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      log.status === 'success' ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'
                    }`}>
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
