/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StudySession, StudyPlan, RevisionItem, MistakeEntry, ExamDate } from '../types';

export interface ChatSpace {
  name: string; // e.g. "spaces/AAAA..."
  displayName?: string;
  type: string; // "SPACE" | "GROUP_CHAT" | "DIRECT_MESSAGE"
  spaceType?: string;
}

export interface StudyAuditData {
  date: string;
  formattedDate: string;
  doneCount: number;
  pendingCount: number;
  completionPercentage: number;
  totalStudyMinutesToday: number;
  completedTasks: Array<{
    subject: string;
    topic: string;
    durationMinutes: number;
  }>;
  pendingTasks: Array<{
    subject: string;
    topic: string;
    reason?: string;
  }>;
  dueRevisions: Array<{
    subject: string;
    topic: string;
    dayInterval: number;
  }>;
  impendingExams: Array<{
    subject: string;
    examName: string;
    date: string;
    daysRemaining: number;
  }>;
  curedMistakesCount: number;
}

export interface ChatDispatchLog {
  id: string;
  timestamp: string;
  type: 'audit' | 'inactivity' | 'test' | 'morning';
  status: 'success' | 'error';
  summary: string;
}

export interface GoogleChatConfig {
  mode: 'oauth' | 'webhook' | 'space_link' | 'google_account';
  connectionMethod?: 'google_account' | 'space_link' | 'webhook' | 'discord';
  isConfigured?: boolean;
  selectedSpaceName?: string;
  selectedSpaceDisplayName?: string;
  webhookUrl?: string; // Optional Incoming webhook (for Workspace or Discord)
  spaceLinkUrl?: string; // Direct Google Chat Space URL (works for any @gmail.com account)
  googleEmailAccount?: string; // Connected Google Account (e.g. atharkhanteambuster@gmail.com)
  autoNotifyMorning: boolean; // 7:30 AM Daily Agenda
  autoNotifyEvening: boolean; // 8:00 PM Done vs Not Done Audit
  autoNotifyInactivity: boolean; // "Why haven't you logged in" AI Nudge
  scheduledTime: string; // e.g. "20:00" (8:00 PM)
  morningScheduledTime: string; // e.g. "07:30"
  inactivityCutoffHour: number; // e.g. 15 (3:00 PM if 0 hours studied)
  lastDispatchedAt?: string;
  lastInactivityAlertAt?: string;
  dispatchHistory: ChatDispatchLog[];
}

const STORAGE_KEY = 'academic_google_chat_config_v1';

export function getGoogleChatConfig(): GoogleChatConfig {
  let webhookUrlFromProfile = '';
  let spaceLinkFromProfile = '';
  let emailFromProfile = '';
  try {
    const cachedProfile = localStorage.getItem('studyflow_user_profile') || localStorage.getItem('prepforge_profile');
    if (cachedProfile) {
      const parsedProf = JSON.parse(cachedProfile);
      webhookUrlFromProfile = parsedProf.googleChatWebhookUrl || '';
      spaceLinkFromProfile = parsedProf.googleChatSpaceLink || '';
      emailFromProfile = parsedProf.email || '';
    }
  } catch (e) {}

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const resolvedWebhook = parsed.webhookUrl || webhookUrlFromProfile || undefined;
      const resolvedSpaceLink = parsed.spaceLinkUrl || spaceLinkFromProfile || undefined;
      const resolvedEmail = parsed.googleEmailAccount || emailFromProfile || 'atharkhanteambuster@gmail.com';
      const resolvedMethod = parsed.connectionMethod || (resolvedWebhook ? 'webhook' : resolvedSpaceLink ? 'space_link' : 'google_account');

      return {
        mode: parsed.mode || 'webhook',
        connectionMethod: resolvedMethod,
        isConfigured: Boolean(resolvedWebhook || resolvedSpaceLink || resolvedEmail),
        selectedSpaceName: parsed.selectedSpaceName,
        selectedSpaceDisplayName: parsed.selectedSpaceDisplayName,
        webhookUrl: resolvedWebhook,
        spaceLinkUrl: resolvedSpaceLink,
        googleEmailAccount: resolvedEmail,
        autoNotifyMorning: parsed.autoNotifyMorning ?? true,
        autoNotifyEvening: parsed.autoNotifyEvening ?? true,
        autoNotifyInactivity: parsed.autoNotifyInactivity ?? true,
        scheduledTime: parsed.scheduledTime || '20:00',
        morningScheduledTime: parsed.morningScheduledTime || '07:30',
        inactivityCutoffHour: parsed.inactivityCutoffHour ?? 15,
        lastDispatchedAt: parsed.lastDispatchedAt,
        lastInactivityAlertAt: parsed.lastInactivityAlertAt,
        dispatchHistory: Array.isArray(parsed.dispatchHistory) ? parsed.dispatchHistory : []
      };
    }
  } catch (err) {
    console.error('Failed to load Google Chat config:', err);
  }
  return {
    mode: 'webhook',
    connectionMethod: webhookUrlFromProfile ? 'webhook' : spaceLinkFromProfile ? 'space_link' : 'google_account',
    isConfigured: true,
    webhookUrl: webhookUrlFromProfile || undefined,
    spaceLinkUrl: spaceLinkFromProfile || undefined,
    googleEmailAccount: emailFromProfile || 'atharkhanteambuster@gmail.com',
    autoNotifyMorning: true,
    autoNotifyEvening: true,
    autoNotifyInactivity: true,
    scheduledTime: '20:00',
    morningScheduledTime: '07:30',
    inactivityCutoffHour: 15,
    dispatchHistory: []
  };
}

export function saveGoogleChatConfig(config: GoogleChatConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    try {
      const cachedProfile = localStorage.getItem('studyflow_user_profile');
      if (cachedProfile) {
        const p = JSON.parse(cachedProfile);
        p.googleChatWebhookUrl = config.webhookUrl;
        p.googleChatSpaceLink = config.spaceLinkUrl;
        p.googleChatConnectionMethod = config.connectionMethod;
        p.googleChatConfig = config;
        localStorage.setItem('studyflow_user_profile', JSON.stringify(p));
      }
    } catch (e) {}
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('study_google_chat_config_updated', { detail: config }));
    }
  } catch (err) {
    console.error('Failed to save Google Chat config:', err);
  }
}

/**
 * Formats a clean, readable text summary of the daily study audit
 * optimized for Google Chat spaces and clipboard sharing.
 */
export function formatAuditAsChatText(audit: StudyAuditData): string {
  const hours = (audit.totalStudyMinutesToday / 60).toFixed(1);
  const baseUrl = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://prepforge.app';

  const lines: string[] = [
    `📊 PrepForge Study Notification & Audit — ${audit.formattedDate}`,
    `⏱️ Progress: ${hours} hrs logged • ${audit.completionPercentage}% complete (${audit.doneCount} done, ${audit.pendingCount} pending)`,
    ''
  ];

  lines.push('✅ WHAT I HAVE DONE TODAY:');
  if (audit.completedTasks.length > 0) {
    audit.completedTasks.forEach(t => {
      lines.push(`• ${t.subject}: ${t.topic} (${t.durationMinutes}m logged)`);
    });
  } else {
    lines.push('• No topics marked complete yet today.');
  }
  lines.push('');

  lines.push('⏳ WHAT I HAVE NOT DONE / PENDING:');
  if (audit.pendingTasks.length > 0) {
    audit.pendingTasks.forEach(t => {
      lines.push(`• ${t.subject}: ${t.topic} — ${t.reason || 'Pending'}`);
    });
  }
  if (audit.dueRevisions.length > 0) {
    audit.dueRevisions.forEach(r => {
      lines.push(`• ${r.subject}: ${r.topic} (Due Day ${r.dayInterval} spaced revision)`);
    });
  }
  if (audit.pendingTasks.length === 0 && audit.dueRevisions.length === 0) {
    lines.push('• All scheduled tasks completed for today! 🎉');
  }
  lines.push('');

  if (audit.impendingExams.length > 0) {
    lines.push('🚨 IMPENDING EXAM COUNTDOWNS:');
    audit.impendingExams.slice(0, 3).forEach(e => {
      lines.push(`• ${e.subject} (${e.examName}): ${e.daysRemaining === 0 ? 'TODAY!' : `in ${e.daysRemaining} days`} (${e.date})`);
    });
    lines.push('');
  }

  lines.push(`⏱️ Start Focus Session: ${baseUrl}?action=start_timer&duration=25`);
  return lines.join('\n');
}

/**
 * Formats a clean text summary of the Gemini AI Inactivity Coach
 * for pasting directly into Google Chat or emailing.
 */
export function formatInactivityNudgeAsChatText(data: {
  studentName?: string;
  hoursToday?: number;
  targetHours?: number;
  diagnostic?: string;
  whyYouHaventLoggedIn?: string[];
  boardExamRealityCheck?: string;
  rescueSprintTitle?: string;
  rescueSprintSteps?: string[];
  motivationalSignoff?: string;
}): string {
  const baseUrl = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://prepforge.app';

  const lines: string[] = [
    `⚠️ PrepForge Academic Reality Check: Why You Haven't Logged In Today`,
    `Student: ${data.studentName || 'Student'} • ${data.hoursToday || 0} hrs logged vs. ${data.targetHours || 3} hrs daily goal`,
    '',
    `🧠 Psychological Diagnostic:`,
    `${data.diagnostic || 'Starting is the hardest part. Once you break the inertia for 3 minutes, flow takes over.'}`,
    ''
  ];

  if (data.whyYouHaventLoggedIn && data.whyYouHaventLoggedIn.length > 0) {
    lines.push(`🔍 Common Friction Traps:`);
    data.whyYouHaventLoggedIn.forEach(point => {
      lines.push(`• ${point}`);
    });
    lines.push('');
  }

  if (data.boardExamRealityCheck) {
    lines.push(`🚨 Board Exam Reality Check:`);
    lines.push(`${data.boardExamRealityCheck}`);
    lines.push('');
  }

  lines.push(`⚡ ${(data.rescueSprintTitle || '15-Minute Activation Sprint').toUpperCase()}:`);
  if (data.rescueSprintSteps && data.rescueSprintSteps.length > 0) {
    data.rescueSprintSteps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
  } else {
    lines.push('1. Open a 15-minute timer (zero phones/distractions)');
    lines.push('2. Review 1 core formula sheet or concept definition');
    lines.push('3. Log the 15m session to preserve your streak');
  }
  lines.push('');

  if (data.motivationalSignoff) {
    lines.push(`"${data.motivationalSignoff}"`);
    lines.push('');
  }

  lines.push(`⏱️ Start 15m Rescue Timer: ${baseUrl}?action=start_timer&duration=15`);
  return lines.join('\n');
}

/**
 * Compiles a comprehensive "What I Have Done & What I Have Not Done" audit for the student.
 */
export function buildStudyAudit({
  sessions = [],
  plans = [],
  revisions = [],
  mistakes = [],
  examDates = [],
  targetDateStr
}: {
  sessions: StudySession[];
  plans: StudyPlan[];
  revisions: RevisionItem[];
  mistakes: MistakeEntry[];
  examDates: ExamDate[];
  targetDateStr?: string;
}): StudyAuditData {
  const targetDate = targetDateStr || new Date().toISOString().split('T')[0];
  const targetDayObj = new Date(targetDate + 'T12:00:00');
  const formattedDate = targetDayObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  // 1. Completed work today from sessions & study plans
  const daySessions = sessions.filter(s => s.date === targetDate);
  const totalMinutes = daySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

  const completedTasks: Array<{ subject: string; topic: string; durationMinutes: number }> = [];
  const pendingTasks: Array<{ subject: string; topic: string; reason?: string }> = [];

  // Inspect study plans for today
  const dayPlans = plans.filter(p => p.date === targetDate);
  dayPlans.forEach(plan => {
    (plan.topics || []).forEach(t => {
      if (t.completed) {
        completedTasks.push({
          subject: t.subjectName || 'General',
          topic: t.topicName,
          durationMinutes: t.estimatedMinutes || 45
        });
      } else {
        pendingTasks.push({
          subject: t.subjectName || 'General',
          topic: t.topicName,
          reason: t.deadline ? `Target by ${t.deadline}` : 'Scheduled today'
        });
      }
    });
  });

  // Also include any sessions completed today not explicitly in day plans
  daySessions.forEach(s => {
    const alreadyListed = completedTasks.some(
      ct => ct.topic.toLowerCase() === s.topicName.toLowerCase()
    );
    if (!alreadyListed) {
      completedTasks.push({
        subject: s.subjectName,
        topic: s.topicName,
        durationMinutes: s.durationMinutes || 30
      });
    }
  });

  // 2. Due spaced revisions
  const dueRevisions: Array<{ subject: string; topic: string; dayInterval: number }> = [];
  revisions.forEach(r => {
    if (r.status !== 'Completed' && (r.dueDate === targetDate || r.dueDate < targetDate)) {
      const interval = r.cycleStage === 'day7' ? 7 : r.cycleStage === 'day3' ? 3 : 1;
      dueRevisions.push({
        subject: r.subjectName,
        topic: r.topicName || 'Revision Session',
        dayInterval: interval
      });
    }
  });

  // 3. Upcoming exams (within next 14 days)
  const nowMs = targetDayObj.getTime();
  const impendingExams: Array<{ subject: string; examName: string; date: string; daysRemaining: number }> = [];
  examDates.forEach(e => {
    const examMs = new Date(e.date + 'T12:00:00').getTime();
    const diffDays = Math.ceil((examMs - nowMs) / (1000 * 60 * 60 * 24));
    if (diffDays >= 0 && diffDays <= 14) {
      impendingExams.push({
        subject: e.subjectName,
        examName: e.examName,
        date: e.date,
        daysRemaining: diffDays
      });
    }
  });
  impendingExams.sort((a, b) => a.daysRemaining - b.daysRemaining);

  // 4. Mistakes cured today
  const curedToday = mistakes.filter(m => {
    if (m.cureStatus !== 'cured') return false;
    const updatedDate = m.updatedAt ? m.updatedAt.split('T')[0] : '';
    return updatedDate === targetDate;
  }).length;

  const totalActionItems = completedTasks.length + pendingTasks.length + dueRevisions.length;
  const completionPercentage = totalActionItems > 0
    ? Math.round((completedTasks.length / totalActionItems) * 100)
    : (completedTasks.length > 0 ? 100 : 0);

  return {
    date: targetDate,
    formattedDate,
    doneCount: completedTasks.length,
    pendingCount: pendingTasks.length + dueRevisions.length,
    completionPercentage,
    totalStudyMinutesToday: totalMinutes,
    completedTasks,
    pendingTasks,
    dueRevisions,
    impendingExams,
    curedMistakesCount: curedToday
  };
}

/**
 * Formats a Google Chat card payload representing the study audit.
 */
export function buildGoogleChatCardPayload(audit: StudyAuditData): Record<string, any> {
  const hours = (audit.totalStudyMinutesToday / 60).toFixed(1);
  const baseUrl = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://prepforge.app';

  const doneWidgets: any[] = [];
  if (audit.completedTasks.length > 0) {
    audit.completedTasks.slice(0, 6).forEach(t => {
      doneWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'DESCRIPTION' },
          topLabel: t.subject,
          text: `<b>${t.topic}</b> (${t.durationMinutes}m logged)`
        }
      });
    });
    if (audit.completedTasks.length > 6) {
      doneWidgets.push({
        textParagraph: { text: `<i>+${audit.completedTasks.length - 6} more completed topics</i>` }
      });
    }
  } else {
    doneWidgets.push({
      textParagraph: { text: '<i>No study topics checked off yet for today.</i>' }
    });
  }

  const pendingWidgets: any[] = [];
  if (audit.pendingTasks.length > 0) {
    audit.pendingTasks.slice(0, 5).forEach(t => {
      const timerUrl = `${baseUrl}?action=start_timer&subject=${encodeURIComponent(t.subject)}&topic=${encodeURIComponent(t.topic)}&duration=25`;
      pendingWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'CLOCK' },
          topLabel: t.subject,
          text: `<b>${t.topic}</b> — <font color="#d97706">${t.reason || 'Pending'}</font>`,
          button: {
            text: '⏱️ Start Timer',
            onClick: {
              openLink: {
                url: timerUrl
              }
            }
          }
        }
      });
    });
  }

  if (audit.dueRevisions.length > 0) {
    audit.dueRevisions.slice(0, 3).forEach(r => {
      const revTimerUrl = `${baseUrl}?action=start_timer&subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}&duration=25`;
      pendingWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'BOOKMARK' },
          topLabel: `${r.subject} (Day ${r.dayInterval} Spaced Revision)`,
          text: `<b>${r.topic}</b>`,
          button: {
            text: '⏱️ Revise (25m)',
            onClick: {
              openLink: {
                url: revTimerUrl
              }
            }
          }
        }
      });
    });
  }

  if (pendingWidgets.length === 0) {
    pendingWidgets.push({
      textParagraph: { text: '<b>🎉 All scheduled study goals completed for today!</b>' }
    });
  }

  const examWidgets: any[] = [];
  if (audit.impendingExams.length > 0) {
    audit.impendingExams.forEach(e => {
      examWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'STAR' },
          topLabel: `${e.subject} Board Exam`,
          text: `<b>${e.examName}</b>`,
          bottomLabel: e.daysRemaining === 0 ? '🚨 TODAY' : e.daysRemaining === 1 ? '🚨 TOMORROW' : `In ${e.daysRemaining} days (${e.date})`
        }
      });
    });
  }

  const firstPending = audit.pendingTasks[0] || (audit.dueRevisions[0] ? { subject: audit.dueRevisions[0].subject, topic: audit.dueRevisions[0].topic } : null);

  const sections: any[] = [
    {
      header: `📊 Study Metric Summary (${hours} hrs)`,
      widgets: [
        {
          textParagraph: {
            text: `<b>Progress:</b> ${audit.completionPercentage}% Complete · <b>${audit.doneCount}</b> tasks done · <b>${audit.pendingCount}</b> remaining · <b>${audit.curedMistakesCount}</b> mistakes cured`
          }
        }
      ]
    },
    {
      header: '✅ WHAT I HAVE DONE TODAY',
      collapsible: false,
      widgets: doneWidgets
    },
    {
      header: '⏳ WHAT I HAVE NOT DONE / PENDING',
      collapsible: false,
      widgets: pendingWidgets
    },
    {
      header: '⏱️ DEDICATED STUDY TIMER ACTIONS',
      collapsible: false,
      widgets: [
        {
          textParagraph: {
            text: 'Launch an immediate focus session or target your next pending academic goal with 1 click:'
          }
        },
        {
          buttonList: {
            buttons: [
              {
                text: '⏱️ Start 25m Focus Timer',
                onClick: {
                  openLink: {
                    url: `${baseUrl}?action=start_timer&duration=25`
                  }
                }
              },
              ...(firstPending ? [{
                text: `🎯 Timer: ${firstPending.topic.slice(0, 24)}`,
                onClick: {
                  openLink: {
                    url: `${baseUrl}?action=start_timer&subject=${encodeURIComponent(firstPending.subject)}&topic=${encodeURIComponent(firstPending.topic)}&duration=25`
                  }
                }
              }] : []),
              {
                text: '⚡ 50m Deep Sprint',
                onClick: {
                  openLink: {
                    url: `${baseUrl}?action=start_timer&duration=50`
                  }
                }
              },
              {
                text: '📊 Open Web App',
                onClick: {
                  openLink: {
                    url: `${baseUrl}`
                  }
                }
              }
            ]
          }
        }
      ]
    }
  ];

  if (examWidgets.length > 0) {
    sections.push({
      header: '🚨 IMPENDING EXAM COUNTDOWNS',
      collapsible: false,
      widgets: examWidgets
    });
  }

  return {
    cardsV2: [
      {
        cardId: `study_audit_${audit.date}`,
        card: {
          header: {
            title: 'Academic Daily Study Notification & Audit',
            subtitle: `${audit.formattedDate} · Notification Digest`,
            imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/school/default/48px.svg',
            imageType: 'SQUARE'
          },
          sections
        }
      }
    ]
  };
}

/**
 * List all Google Chat spaces accessible with the current user OAuth access token.
 */
export async function listGoogleChatSpaces(accessToken: string): Promise<{
  spaces: ChatSpace[];
  error?: string;
  isAppNotConfigured?: boolean;
}> {
  try {
    const res = await fetch('https://chat.googleapis.com/v1/spaces', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (res.status === 404) {
      return {
        spaces: [],
        isAppNotConfigured: true,
        error: 'Google Chat app configuration is required in Google Cloud Console before listing spaces via OAuth. You can use an Incoming Space Webhook URL directly for instant 0-config notifications!'
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        spaces: [],
        error: `Google Chat API returned ${res.status}: ${errText.slice(0, 200)}`
      };
    }

    const data = await res.json();
    return {
      spaces: data.spaces || []
    };
  } catch (err: any) {
    return {
      spaces: [],
      error: err.message || 'Failed to connect to Google Chat'
    };
  }
}

/**
 * Sends a notification card directly to a Google Chat Space via OAuth.
 */
export async function sendNotificationToChatSpace(
  spaceName: string,
  accessToken: string,
  audit: StudyAuditData
): Promise<{ success: boolean; message: string }> {
  try {
    const payload = buildGoogleChatCardPayload(audit);
    const cleanSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
    const url = `https://chat.googleapis.com/v1/${cleanSpace}/messages`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 404) {
      return {
        success: false,
        message: 'Google Chat Space or Chat App not found in Cloud Console. Tip: Use an Incoming Space Webhook URL for instant delivery!'
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        message: `Failed to post to Google Chat (${res.status}): ${errText.slice(0, 150)}`
      };
    }

    // Save timestamp
    const config = getGoogleChatConfig();
    config.lastDispatchedAt = new Date().toISOString();
    saveGoogleChatConfig(config);

    return {
      success: true,
      message: 'Study notification card dispatched to Google Chat Space successfully!'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Network error while dispatching to Google Chat'
    };
  }
}

/**
 * Sends a formatted study notification card to any Google Chat space using an Incoming Webhook URL.
 * Works with 100% reliability with zero Google Cloud Bot verification needed.
 */
export async function sendNotificationViaWebhook(
  webhookUrl: string,
  audit: StudyAuditData
): Promise<{ success: boolean; message: string }> {
  const payload = buildGoogleChatCardPayload(audit);
  return await dispatchRawPayloadViaWebhook(
    webhookUrl,
    payload,
    'audit',
    `Dispatched daily study audit (${audit.completionPercentage}% complete, ${audit.doneCount} done)`
  );
}

/**
 * Record a dispatch event in local history.
 */
function recordDispatchLog(type: 'audit' | 'inactivity' | 'test' | 'morning', status: 'success' | 'error', summary: string) {
  try {
    const config = getGoogleChatConfig();
    const newLog: ChatDispatchLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      type,
      status,
      summary
    };
    config.dispatchHistory = [newLog, ...(config.dispatchHistory || [])].slice(0, 20);
    config.lastDispatchedAt = new Date().toISOString();
    saveGoogleChatConfig(config);
  } catch (e) {
    console.warn('Failed to record dispatch log:', e);
  }
}

/**
 * Builds Google Chat Cards v2 for the Gemini AI "Why You Haven't Logged In" Accountability Check.
 */
export function buildInactivityNudgeCardPayload({
  studentName = 'Student',
  hoursToday = 0,
  targetHours = 3,
  pendingTasks = [],
  dueRevisions = [],
  upcomingExams = [],
  diagnostic = 'Starting is the hardest part. Once you break the inertia for 3 minutes, flow takes over.',
  whyYouHaventLoggedIn = [
    'The cognitive load of starting feels overwhelming, triggering avoidance scrolling.',
    'Relying on tomorrow to do double study creates compounded stress.'
  ],
  boardExamRealityCheck = 'Board exams reward steady daily consolidation. Today cannot be recovered through cramming.',
  rescueSprintTitle = '15-Minute Activation Sprint',
  rescueSprintSteps = [
    'Set a 15-minute timer (zero tabs/phones)',
    'Review 1 core formula sheet or read 3 syllabus definitions',
    'Log your 15m focus session to preserve your streak'
  ],
  motivationalSignoff = 'Action creates motivation. Open the timer now.'
}: {
  studentName?: string;
  hoursToday?: number;
  targetHours?: number;
  pendingTasks?: Array<{ subject: string; topic: string }>;
  dueRevisions?: Array<{ subject: string; topic: string }>;
  upcomingExams?: Array<{ subject: string; examName: string; daysRemaining: number }>;
  diagnostic?: string;
  whyYouHaventLoggedIn?: string[];
  boardExamRealityCheck?: string;
  rescueSprintTitle?: string;
  rescueSprintSteps?: string[];
  motivationalSignoff?: string;
}): Record<string, any> {
  const baseUrl = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://prepforge.app';

  const firstPending = pendingTasks[0] || dueRevisions[0] || { subject: 'Physics', topic: 'Core Concepts' };
  const firstExam = upcomingExams[0];

  const pendingListWidgets: any[] = [];
  if (pendingTasks.length > 0) {
    pendingTasks.slice(0, 4).forEach(t => {
      pendingListWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'CLOCK' },
          topLabel: t.subject,
          text: `<b>${t.topic}</b> — <font color="#d97706">Untouched Today</font>`,
          button: {
            text: '⏱️ Rescue 15m',
            onClick: {
              openLink: {
                url: `${baseUrl}?action=start_timer&subject=${encodeURIComponent(t.subject)}&topic=${encodeURIComponent(t.topic)}&duration=15`
              }
            }
          }
        }
      });
    });
  }

  if (dueRevisions.length > 0) {
    dueRevisions.slice(0, 2).forEach(r => {
      pendingListWidgets.push({
        decoratedText: {
          startIcon: { knownIcon: 'BOOKMARK' },
          topLabel: `${r.subject} (Due 1-3-7 Revision)`,
          text: `<b>${r.topic}</b>`,
          button: {
            text: '⏱️ Revise 15m',
            onClick: {
              openLink: {
                url: `${baseUrl}?action=start_timer&subject=${encodeURIComponent(r.subject)}&topic=${encodeURIComponent(r.topic)}&duration=15`
              }
            }
          }
        }
      });
    });
  }

  if (pendingListWidgets.length === 0) {
    pendingListWidgets.push({
      textParagraph: {
        text: '<i>No formal daily plan set, but zero study hours have been signed today.</i>'
      }
    });
  }

  const sections: any[] = [
    {
      header: '⚠️ WHY YOU HAVEN\'T LOGGED IN TODAY (GEMINI AI DIAGNOSTIC)',
      collapsible: false,
      widgets: [
        {
          textParagraph: {
            text: `<b>Reality Check for ${studentName}:</b> ${hoursToday} hrs logged today vs. ${targetHours} hrs daily commitment.`
          }
        },
        {
          textParagraph: {
            text: `<b>Psychological Block:</b> ${diagnostic}`
          }
        },
        ...(whyYouHaventLoggedIn.map(point => ({
          decoratedText: {
            startIcon: { knownIcon: 'STAR' },
            text: point
          }
        }))),
        {
          textParagraph: {
            text: `<font color="#b91c1c"><b>🚨 Board Exam Reality Check:</b></font> ${boardExamRealityCheck}`
          }
        }
      ]
    },
    {
      header: '⏳ UNTOUCHED WORK WAITING FOR YOU',
      collapsible: false,
      widgets: pendingListWidgets
    },
    {
      header: `⚡ ${rescueSprintTitle.toUpperCase()}`,
      collapsible: false,
      widgets: [
        {
          textParagraph: {
            text: '<b>Break inertia in 3 minutes:</b> Commit only to 15 minutes. No full chapters, just this rescue sequence:'
          }
        },
        ...(rescueSprintSteps.map((step, idx) => ({
          decoratedText: {
            topLabel: `Step ${idx + 1}`,
            text: `<b>${step}</b>`
          }
        }))),
        {
          textParagraph: {
            text: `<i>"${motivationalSignoff}"</i>`
          }
        },
        {
          buttonList: {
            buttons: [
              {
                text: '⏱️ Launch 15m Rescue Timer',
                onClick: {
                  openLink: {
                    url: `${baseUrl}?action=start_timer&subject=${encodeURIComponent(firstPending.subject)}&topic=${encodeURIComponent(firstPending.topic)}&duration=15`
                  }
                }
              },
              {
                text: '✍️ Sign In & Open Dashboard',
                onClick: {
                  openLink: {
                    url: `${baseUrl}`
                  }
                }
              }
            ]
          }
        }
      ]
    }
  ];

  return {
    cardsV2: [
      {
        cardId: `accountability_nudge_${Date.now()}`,
        card: {
          header: {
            title: '🚨 PrepForge Accountability Coach',
            subtitle: `Inactivity Check · Why You Haven't Logged In Today`,
            imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/warning/default/48px.svg',
            imageType: 'SQUARE'
          },
          sections
        }
      }
    ]
  };
}

/**
 * Builds Google Chat Cards v2 for verified connection test ping.
 */
export function buildTestPingCardPayload(appName = 'PrepForge'): Record<string, any> {
  const baseUrl = typeof window !== 'undefined' && window.location?.origin 
    ? window.location.origin 
    : 'https://prepforge.app';

  return {
    cardsV2: [
      {
        cardId: `ping_${Date.now()}`,
        card: {
          header: {
            title: `🟢 ${appName} Linked to Google Chat!`,
            subtitle: 'Verified Connection Ping · Automated Study Alerts Active',
            imageUrl: 'https://fonts.gstatic.com/s/i/short-term/release/googlesymbols/check_circle/default/48px.svg',
            imageType: 'SQUARE'
          },
          sections: [
            {
              header: '✅ CONNECTION STATUS: 100% OPERATIONAL',
              widgets: [
                {
                  textParagraph: {
                    text: '<b>Success!</b> Your Google Chat Space is now linked to receive automated study flight plans, daily Done vs. Not Done audits, and Gemini accountability nudges.'
                  }
                },
                {
                  decoratedText: {
                    startIcon: { knownIcon: 'CLOCK' },
                    topLabel: 'Automated Dispatches Active',
                    text: 'Morning Flight Plan (7:30 AM) & Evening Audit (8:00 PM)'
                  }
                },
                {
                  buttonList: {
                    buttons: [
                      {
                        text: '⏱️ Open Focus Timer',
                        onClick: {
                          openLink: {
                            url: `${baseUrl}?action=start_timer&duration=25`
                          }
                        }
                      },
                      {
                        text: '📊 Go to Study Workstation',
                        onClick: {
                          openLink: {
                            url: `${baseUrl}`
                          }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      }
    ]
  };
}

/**
 * Resiliently dispatches any payload to Google Chat via backend proxy first, falling back to direct fetch.
 */
export async function dispatchRawPayloadViaWebhook(
  webhookUrl: string,
  payload: Record<string, any>,
  logType: 'audit' | 'inactivity' | 'test' | 'morning' = 'audit',
  summaryText = 'Google Chat notification dispatched'
): Promise<{ success: boolean; message: string }> {
  if (!webhookUrl || !webhookUrl.startsWith('https://chat.googleapis.com/')) {
    return {
      success: false,
      message: 'Invalid Google Chat webhook URL. It must begin with https://chat.googleapis.com/...'
    };
  }

  // 1. Try server-side proxy route first (bypasses browser ad-blockers and CORS)
  try {
    const proxyRes = await fetch('/api/google-chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ webhookUrl, cardPayload: payload })
    });

    if (proxyRes.ok) {
      recordDispatchLog(logType, 'success', summaryText);
      return {
        success: true,
        message: 'Dispatched successfully to your Google Chat space!'
      };
    }
  } catch (proxyErr) {
    console.warn('Backend proxy dispatch failed, attempting direct browser fetch:', proxyErr);
  }

  // 2. Direct browser fetch fallback
  try {
    const directRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(payload)
    });

    if (!directRes.ok) {
      const errText = await directRes.text();
      recordDispatchLog(logType, 'error', `HTTP ${directRes.status}: ${errText.slice(0, 80)}`);
      return {
        success: false,
        message: `Google Chat returned HTTP ${directRes.status}: ${errText.slice(0, 150)}`
      };
    }

    recordDispatchLog(logType, 'success', summaryText);
    return {
      success: true,
      message: 'Dispatched successfully to your Google Chat space!'
    };
  } catch (err: any) {
    recordDispatchLog(logType, 'error', err?.message || 'Network error');
    return {
      success: false,
      message: err?.message || 'Network error sending to Google Chat'
    };
  }
}

/**
 * Sends a verified connection test ping to Google Chat.
 */
export async function sendTestPingToChat(webhookUrl: string): Promise<{ success: boolean; message: string }> {
  const payload = buildTestPingCardPayload();
  return await dispatchRawPayloadViaWebhook(
    webhookUrl,
    payload,
    'test',
    'Verified Google Chat connection test ping'
  );
}

/**
 * Generates an AI "Why You Haven't Logged In" Accountability Check and sends it to Google Chat.
 */
export async function generateAndSendAccountabilityNudge({
  webhookUrl,
  studentName = 'Student',
  hoursToday = 0,
  targetHours = 3,
  pendingTasks = [],
  dueRevisions = [],
  upcomingExams = [],
  lastActiveHoursAgo = 6,
  language = 'en'
}: {
  webhookUrl: string;
  studentName?: string;
  hoursToday?: number;
  targetHours?: number;
  pendingTasks?: Array<{ subject: string; topic: string }>;
  dueRevisions?: Array<{ subject: string; topic: string }>;
  upcomingExams?: Array<{ subject: string; examName: string; daysRemaining: number }>;
  lastActiveHoursAgo?: number;
  language?: string;
}): Promise<{ success: boolean; message: string; aiAnalysis?: any }> {
  try {
    // 1. Request Gemini AI analysis
    let aiData: any = null;
    try {
      const res = await fetch('/api/ai/accountability-nudge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName,
          hoursToday,
          targetHours,
          pendingTasks,
          dueRevisions,
          upcomingExams,
          lastActiveHoursAgo,
          language
        })
      });
      if (res.ok) {
        aiData = await res.json();
      }
    } catch (e) {
      console.warn('AI analysis API error, using intelligent client fallback:', e);
    }

    const payload = buildInactivityNudgeCardPayload({
      studentName,
      hoursToday,
      targetHours,
      pendingTasks,
      dueRevisions,
      upcomingExams,
      diagnostic: aiData?.diagnostic,
      whyYouHaventLoggedIn: aiData?.whyYouHaventLoggedIn,
      boardExamRealityCheck: aiData?.boardExamRealityCheck,
      rescueSprintTitle: aiData?.rescueSprintTitle,
      rescueSprintSteps: aiData?.rescueSprintSteps,
      motivationalSignoff: aiData?.motivationalSignoff
    });

    const dispatchResult = await dispatchRawPayloadViaWebhook(
      webhookUrl,
      payload,
      'inactivity',
      `Gemini Accountability Check sent (${pendingTasks.length} pending tasks, ${hoursToday} hrs logged)`
    );

    if (dispatchResult.success) {
      const config = getGoogleChatConfig();
      config.lastInactivityAlertAt = new Date().toISOString();
      saveGoogleChatConfig(config);
    }

    return {
      success: dispatchResult.success,
      message: dispatchResult.message,
      aiAnalysis: aiData
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Error generating accountability check'
    };
  }
}

/**
 * Autonomous background checker called periodically by the study system.
 * Evaluates configured scheduled times for Morning Flight Plan, Evening Done vs Not Done,
 * and Gemini AI Inactivity reality checks.
 */
export async function checkAndTriggerGoogleChatAutomatedDispatches({
  sessions,
  plans,
  revisions,
  userProfile,
  subjects,
  mistakes = []
}: {
  sessions: any[];
  plans: any[];
  revisions: any[];
  userProfile: any | null;
  subjects: any[];
  mistakes?: any[];
}): Promise<{ triggered: boolean; type?: string; message?: string }> {
  try {
    const config = getGoogleChatConfig();
    const targetWebhook = config.webhookUrl || userProfile?.googleChatWebhookUrl;
    if (!targetWebhook) {
      return { triggered: false };
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    const lastInactivityDate = config.lastInactivityAlertAt ? config.lastInactivityAlertAt.split('T')[0] : '';

    // 1. Morning Flight Plan (e.g. 07:30 - within active minute window)
    if (config.autoNotifyMorning) {
      const targetMorning = config.morningScheduledTime || '07:30';
      const [mH, mM] = targetMorning.split(':').map(Number);
      const isMorningTime = currentHours === mH && Math.abs(currentMinutes - mM) <= 1;
      const morningAlreadySentToday = (config.dispatchHistory || []).some(
        l => l.type === 'morning' && l.timestamp.startsWith(todayStr) && l.status === 'success'
      );

      if (isMorningTime && !morningAlreadySentToday) {
        const audit = buildStudyAudit({
          sessions,
          plans,
          revisions,
          mistakes,
          examDates: userProfile?.examDates || [],
          targetDateStr: todayStr
        });
        const payload = buildGoogleChatCardPayload(audit);
        const res = await dispatchRawPayloadViaWebhook(
          targetWebhook, 
          payload, 
          'morning', 
          `Automated Morning Flight Plan dispatched (${audit.pendingCount} pending items)`
        );
        return { triggered: true, type: 'morning', message: res.message };
      }
    }

    // 2. Evening Done vs Not Done Audit (e.g. 20:00 - within active minute window)
    if (config.autoNotifyEvening) {
      const targetEvening = config.scheduledTime || '20:00';
      const [eH, eM] = targetEvening.split(':').map(Number);
      const isEveningTime = currentHours === eH && Math.abs(currentMinutes - eM) <= 1;
      const eveningAlreadySentToday = (config.dispatchHistory || []).some(
        l => l.type === 'audit' && l.timestamp.startsWith(todayStr) && l.status === 'success'
      );

      if (isEveningTime && !eveningAlreadySentToday) {
        const audit = buildStudyAudit({
          sessions,
          plans,
          revisions,
          mistakes,
          examDates: userProfile?.examDates || [],
          targetDateStr: todayStr
        });
        const payload = buildGoogleChatCardPayload(audit);
        const res = await dispatchRawPayloadViaWebhook(
          targetWebhook, 
          payload, 
          'audit', 
          `Automated Evening Done vs Not Done Audit (${audit.doneCount} done, ${audit.pendingCount} pending)`
        );
        return { triggered: true, type: 'evening', message: res.message };
      }
    }

    // 3. Gemini Inactivity Reality Check ("Why You Haven't Logged In Today")
    if (config.autoNotifyInactivity !== false) {
      const cutoffHour = config.inactivityCutoffHour || 15; // default 3:00 PM
      const todaySessions = sessions.filter(s => s.date === todayStr);
      const totalMinutesToday = todaySessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
      const hoursToday = Number((totalMinutesToday / 60).toFixed(1));

      // Trigger if current hour >= cutoffHour, zero study hours signed today, and haven't alerted today
      if (currentHours >= cutoffHour && hoursToday === 0 && lastInactivityDate !== todayStr) {
        const todayPlan = plans.find(p => p.date === todayStr) || plans[0] || null;
        const pendingTasks = todayPlan 
          ? todayPlan.topics.filter((t: any) => !t.completed).map((t: any) => ({ subject: t.subjectName, topic: t.topicName })) 
          : [];
        const dueRevisions = revisions
          .filter((r: any) => r.status !== 'Completed' && r.dueDate <= todayStr)
          .map((r: any) => ({ subject: r.subjectName, topic: r.topicName || 'Revision' }));
        const upcomingExams = (userProfile?.examDates || []).map((e: any) => {
          const diff = Math.ceil((new Date(e.date + 'T12:00:00').getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return { subject: e.subjectName, examName: e.examName, daysRemaining: diff };
        }).filter((e: any) => e.daysRemaining >= 0 && e.daysRemaining <= 14);

        const res = await generateAndSendAccountabilityNudge({
          webhookUrl: targetWebhook,
          studentName: userProfile?.displayName || userProfile?.name || 'Student',
          hoursToday: 0,
          targetHours: userProfile?.targetHoursPerDay || 3,
          pendingTasks,
          dueRevisions,
          upcomingExams,
          lastActiveHoursAgo: Math.max(2, currentHours - 8),
          language: 'en'
        });
        return { triggered: true, type: 'inactivity', message: res.message };
      }
    }

    return { triggered: false };
  } catch (err: any) {
    console.warn('Error during Google Chat automated check:', err);
    return { triggered: false };
  }
}

