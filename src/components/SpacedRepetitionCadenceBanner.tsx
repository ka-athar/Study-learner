import React, { useState } from 'react';
import { 
  History, 
  Clock, 
  RotateCcw, 
  Calendar, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight, 
  Mail, 
  Send,
  Loader2,
  BookmarkCheck
} from 'lucide-react';
import { Subject, RevisionItem, StudySession, UserProfile } from '../types';
import { sendDailyCompletedWorkEmail } from '../lib/gmailService';
import { getActiveUserEmail } from '../lib/db';

interface SpacedIntervalTopic {
  topicName: string;
  chapterName?: string;
  subjectName: string;
  lastStudiedDate: string;
  daysAgo: number;
  stage: 'day1' | 'day3' | 'day7' | 'overdue' | 'fresh';
  stageLabel: string;
  retentionRecommendation: string;
  urgency: 'critical' | 'high' | 'moderate' | 'optimal';
}

interface SpacedRepetitionCadenceBannerProps {
  subjects: Subject[];
  revisions: RevisionItem[];
  sessions: StudySession[];
  userProfile: UserProfile | null;
  onStartSprintForTopic: (subjectName: string, chapterName: string, topicName: string) => void;
  onOpenCheatSheetForTopic?: (subjectName: string, topicName: string) => void;
}

export const SpacedRepetitionCadenceBanner: React.FC<SpacedRepetitionCadenceBannerProps> = ({
  subjects,
  revisions,
  sessions,
  userProfile,
  onStartSprintForTopic,
  onOpenCheatSheetForTopic
}) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Compute 1, 3, and 7-day spaced repetition state across all syllabus topics and study history
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Map of latest study timestamp per topic
  const latestStudyMap = new Map<string, { date: Date; subjectName: string; chapterName?: string }>();

  // 1. Ingest sessions
  sessions.forEach(s => {
    if (!s.topicName) return;
    const sessionDate = new Date(s.date || s.timestamp);
    sessionDate.setHours(0, 0, 0, 0);
    const existing = latestStudyMap.get(s.topicName);
    if (!existing || sessionDate > existing.date) {
      latestStudyMap.set(s.topicName, {
        date: sessionDate,
        subjectName: s.subjectName,
        chapterName: s.chapterName
      });
    }
  });

  // 2. Ingest revisions
  revisions.forEach(r => {
    if (!r.topicName || !r.lastStudied) return;
    const revDate = new Date(r.lastStudied);
    revDate.setHours(0, 0, 0, 0);
    const existing = latestStudyMap.get(r.topicName);
    if (!existing || revDate > existing.date) {
      latestStudyMap.set(r.topicName, {
        date: revDate,
        subjectName: r.subjectName,
        chapterName: r.chapterName
      });
    }
  });

  // 3. Ingest subjects topics that have lastStudiedAt
  subjects.forEach(sub => {
    sub.chapters.forEach(ch => {
      ch.topics.forEach(top => {
        const topName = top.name || (top as any).title;
        if (!topName) return;
        if (top.lastStudiedAt) {
          const tDate = new Date(top.lastStudiedAt);
          tDate.setHours(0, 0, 0, 0);
          const existing = latestStudyMap.get(topName);
          if (!existing || tDate > existing.date) {
            latestStudyMap.set(topName, {
              date: tDate,
              subjectName: sub.name,
              chapterName: ch.name || (ch as any).title
            });
          }
        }
      });
    });
  });

  // Classify topics according to Hermann Ebbinghaus 1-3-7 Rule:
  // - Exactly 1 day ago (24 Hours): Immediate decay reinforcement (Stage 1)
  // - 2-3 days ago: Synaptic consolidation review (Stage 2)
  // - 6-8 days ago: Permanent schema transfer (Stage 3)
  // - >8 days ago: Severe forgetting curve decay (Overdue)
  const dueItems: SpacedIntervalTopic[] = [];

  latestStudyMap.forEach((val, topicName) => {
    const diffTime = today.getTime() - val.date.getTime();
    const daysAgo = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (daysAgo === 1) {
      dueItems.push({
        topicName,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        lastStudiedDate: val.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        daysAgo,
        stage: 'day1',
        stageLabel: 'Day 1 Cadence (24h Window)',
        retentionRecommendation: 'Recall core principles now to stop initial 70% forgetting drop.',
        urgency: 'critical'
      });
    } else if (daysAgo >= 2 && daysAgo <= 4) {
      dueItems.push({
        topicName,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        lastStudiedDate: val.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        daysAgo,
        stage: 'day3',
        stageLabel: `Day 3 Cadence (${daysAgo}d ago)`,
        retentionRecommendation: 'Active recall & problem-solving to strengthen neural pathways.',
        urgency: 'high'
      });
    } else if (daysAgo >= 6 && daysAgo <= 8) {
      dueItems.push({
        topicName,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        lastStudiedDate: val.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        daysAgo,
        stage: 'day7',
        stageLabel: `Day 7 Cadence (${daysAgo}d ago)`,
        retentionRecommendation: 'Final consolidation sprint for long-term semantic memory storage.',
        urgency: 'high'
      });
    } else if (daysAgo > 8 && daysAgo <= 21) {
      dueItems.push({
        topicName,
        chapterName: val.chapterName,
        subjectName: val.subjectName,
        lastStudiedDate: val.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        daysAgo,
        stage: 'overdue',
        stageLabel: `Decay Alert (${daysAgo}d ago)`,
        retentionRecommendation: 'High risk of memory lapse. Run a quick 5-minute refresher drill.',
        urgency: 'moderate'
      });
    }
  });

  // Sort by urgency and then by day-gap
  dueItems.sort((a, b) => {
    const weight = { critical: 1, high: 2, moderate: 3, optimal: 4 };
    return weight[a.urgency] - weight[b.urgency] || a.daysAgo - b.daysAgo;
  });

  const displayList = dueItems.slice(0, 4);

  const handleSendSpacedRepetitionEmail = async () => {
    const targetEmail = userProfile?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setEmailStatus({
        type: 'error',
        message: 'No recipient email configured. Please enter your email in Settings.'
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailStatus(null);

    try {
      const summaryList = dueItems.map(item => ({
        topicName: `${item.topicName} [${item.stageLabel}]`,
        subjectName: item.subjectName,
        duration: 15
      }));

      await sendDailyCompletedWorkEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.displayName || userProfile?.name || 'Scholar',
        completedTopics: summaryList,
        todaySessions: sessions.slice(0, 5),
        totalStudyMinutes: dueItems.length * 15,
        userProfile: userProfile || undefined
      });

      setEmailStatus({
        type: 'success',
        message: `Cadence dispatch sent to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Spaced email send error:', err);
      setEmailStatus({
        type: 'error',
        message: err.message || 'Failed to dispatch email. Check connection or settings.'
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="bg-card border border-theme rounded-3xl p-5 shadow-xs transition-colors space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
            <RotateCcw className="w-4 h-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-theme-accent text-primary border border-theme uppercase tracking-wider font-mono">
                1 • 3 • 7 DAY CADENCE
              </span>
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                Memory Consolidation & Revision Tracker
              </h3>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Strict interval spacing prevents 80% cognitive decay: review 24 hours, 3 days, and 7 days after first study.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSendSpacedRepetitionEmail}
            disabled={isSendingEmail || dueItems.length === 0}
            className="px-3.5 py-1.5 rounded-xl bg-theme-accent hover:border-primary/40 border border-theme text-primary text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
            title="Email me the 1-3-7 day cadence schedule and revision recommendations"
          >
            {isSendingEmail ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
            ) : (
              <Mail className="w-3.5 h-3.5 text-primary" />
            )}
            <span>Email Cadence</span>
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {emailStatus && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
          emailStatus.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
            : 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
        }`}>
          <div className="flex items-center gap-2">
            {emailStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{emailStatus.message}</span>
          </div>
          <button
            onClick={() => setEmailStatus(null)}
            className="text-xs opacity-70 hover:opacity-100 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Topics Content / Empty State */}
      {dueItems.length === 0 ? (
        <div className="py-6 px-4 rounded-2xl bg-theme-accent/40 border border-theme text-center space-y-1.5">
          <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xs font-bold text-primary">All Intervals Synchronized</div>
          <p className="text-[11px] text-muted max-w-md mx-auto">
            You currently have no topics decaying at the 24-hour, 3-day, or 7-day inflection points. Complete study sessions to start automatic interval tracking.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {displayList.map((item, idx) => {
            const badgeColor = 
              item.stage === 'day1'
                ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                : item.stage === 'day3'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30'
                : item.stage === 'day7'
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                : 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30';

            return (
              <div 
                key={idx} 
                className="p-3.5 rounded-2xl bg-surface border border-theme space-y-2.5 flex flex-col justify-between hover:border-primary/40 transition shadow-2xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                      {item.stageLabel}
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      Last: {item.lastStudiedDate}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-primary line-clamp-1" title={item.topicName}>
                      {item.topicName}
                    </h4>
                    <p className="text-[10px] text-muted line-clamp-1">
                      {item.subjectName} {item.chapterName ? `• ${item.chapterName}` : ''}
                    </p>
                  </div>

                  <p className="text-[10.5px] text-muted italic leading-snug">
                    {item.retentionRecommendation}
                  </p>
                </div>

                <div className="pt-2 border-t border-theme flex items-center justify-between gap-2">
                  {onOpenCheatSheetForTopic && (
                    <button
                      onClick={() => onOpenCheatSheetForTopic(item.subjectName, item.topicName)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
                    >
                      Cheat Sheet
                    </button>
                  )}

                  <button
                    onClick={() => onStartSprintForTopic(item.subjectName, item.chapterName || '', item.topicName)}
                    className="px-2.5 py-1 rounded-lg bg-primary hover:opacity-90 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ml-auto"
                  >
                    <span>Consolidate</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
