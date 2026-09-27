import React, { useState, useMemo } from 'react';
import { 
  RotateCcw, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Search, 
  Filter, 
  ArrowRight, 
  Play, 
  Layers, 
  FileText, 
  Check, 
  AlertCircle, 
  Award, 
  Flame, 
  Compass, 
  Zap, 
  BookOpen, 
  GraduationCap, 
  ShieldCheck, 
  RefreshCw,
  Mail,
  ChevronRight,
  Plus,
  X,
  History,
  Tag
} from 'lucide-react';
import { Subject, StudySession, RevisionItem, TestResult, Assignment, ActiveTab, UserProfile } from '../types';
import { 
  build137RevisionPipeline, 
  Spaced137TopicCard, 
  toLocalDateString, 
  getStudiedTopicsList, 
  calculate137Milestones, 
  StudiedTopicOption 
} from '../lib/spacedRevisionEngine';
import { sendDailyCompletedWorkEmail } from '../lib/gmailService';
import { getActiveUserEmail } from '../lib/db';
import { Revision137DateTransferModal } from './Revision137DateTransferModal';

interface Revision137CenterViewProps {
  subjects: Subject[];
  sessions: StudySession[];
  revisions: RevisionItem[];
  testResults: TestResult[];
  assignments?: Assignment[];
  userProfile?: UserProfile | null;
  onStartTimerForTopic: (subjectName: string, chapterName: string, topicName: string, durationMinutes?: number) => void;
  onMarkRevisionDone: (revisionId: string) => void;
  onAddRevisionTopic?: (item: Omit<RevisionItem, 'id' | 'userId'>) => void;
  onAdd137RevisionCycle?: (params: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    sloCode?: string;
    sloName?: string;
    studyDate?: string;
    timeSpentMinutes?: number;
    notes?: string;
  }) => void;
  onRescheduleRevision?: (
    topicInfo: { id?: string; subjectName: string; topicName: string; chapterName?: string },
    newDueDate: string,
    notes?: string
  ) => Promise<void> | void;
  onTransform137Cycle?: (
    subjectName: string,
    topicName: string,
    newDay0Date: string,
    notes?: string
  ) => Promise<void> | void;
  onBatchTransferRevisions?: (
    items: Array<{ id?: string; subjectName: string; topicName: string; chapterName?: string }>,
    targetDueDate: string,
    transferMode: 'due_date_only' | 'shift_timeline',
    daysShift: number
  ) => Promise<void> | void;
  onNavigateTab?: (tab: ActiveTab) => void;
  onOpenCheatSheetForTopic?: (subjectName: string, topicName: string) => void;
  onAwardXP?: (amount: number, reason?: string) => void;
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: any) => Promise<void>;
}

export const Revision137CenterView: React.FC<Revision137CenterViewProps> = ({
  subjects,
  sessions,
  revisions,
  testResults,
  assignments = [],
  userProfile,
  onStartTimerForTopic,
  onMarkRevisionDone,
  onAddRevisionTopic,
  onAdd137RevisionCycle,
  onRescheduleRevision,
  onTransform137Cycle,
  onBatchTransferRevisions,
  onNavigateTab,
  onOpenCheatSheetForTopic,
  onAwardXP,
  onUpdateTopicStatus
}) => {
  const [activeStageFilter, setActiveStageFilter] = useState<'all' | 'due_today' | 'due_tomorrow' | 'day1' | 'day3' | 'day7' | 'overdue' | 'completed'>('due_today');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [xpNotification, setXpNotification] = useState<string | null>(null);

  // Modal State for Date Transfer and Cadence Recalibration
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedCardForTransfer, setSelectedCardForTransfer] = useState<Spaced137TopicCard | null>(null);

  // Modal State for Enrolling Studied Topics into 1-3-7
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [enrollSearch, setEnrollSearch] = useState('');
  const [enrollSubjectFilter, setEnrollSubjectFilter] = useState('all');
  const [selectedTopicKey, setSelectedTopicKey] = useState<string>('');
  const [customDay0Date, setCustomDay0Date] = useState<string>(toLocalDateString(new Date()));
  const [enrollNotes, setEnrollNotes] = useState<string>('');

  // Eligible Studied Topics: Strictly includes only topics with real study/revision records!
  const studiedTopics = useMemo(() => {
    return getStudiedTopicsList(subjects, sessions, revisions);
  }, [subjects, sessions, revisions]);

  const filteredStudiedTopics = useMemo(() => {
    return studiedTopics.filter(t => {
      if (enrollSubjectFilter !== 'all' && t.subjectName.toLowerCase() !== enrollSubjectFilter.toLowerCase()) {
        return false;
      }
      if (enrollSearch.trim()) {
        const q = enrollSearch.toLowerCase();
        const matches = t.topicName.toLowerCase().includes(q) ||
          t.subjectName.toLowerCase().includes(q) ||
          t.chapterName.toLowerCase().includes(q) ||
          (t.sloName && t.sloName.toLowerCase().includes(q)) ||
          (t.sloCode && t.sloCode.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [studiedTopics, enrollSubjectFilter, enrollSearch]);

  const selectedStudiedTopic = useMemo(() => {
    return studiedTopics.find(t => `${t.subjectName.toLowerCase()}:::${t.topicName.toLowerCase()}` === selectedTopicKey.toLowerCase());
  }, [studiedTopics, selectedTopicKey]);

  const previewMilestones = useMemo(() => {
    return calculate137Milestones(customDay0Date || toLocalDateString(new Date()));
  }, [customDay0Date]);

  // Handle enrolling the studied topic into 1-3-7 schedule
  const handleEnrollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudiedTopic) return;

    if (onAdd137RevisionCycle) {
      onAdd137RevisionCycle({
        subjectName: selectedStudiedTopic.subjectName,
        chapterName: selectedStudiedTopic.chapterName,
        topicName: selectedStudiedTopic.topicName,
        sloCode: selectedStudiedTopic.sloCode,
        sloName: selectedStudiedTopic.sloName,
        studyDate: customDay0Date,
        timeSpentMinutes: selectedStudiedTopic.totalTimeMinutes,
        notes: enrollNotes
      });
    } else if (onAddRevisionTopic) {
      const milestones = calculate137Milestones(customDay0Date);
      onAddRevisionTopic({
        subjectName: selectedStudiedTopic.subjectName,
        chapterName: selectedStudiedTopic.chapterName,
        topicName: selectedStudiedTopic.topicName,
        lastStudied: customDay0Date,
        dueDate: milestones.day1,
        priority: 'High',
        status: 'Pending',
        reason: `1-3-7 Spaced Cycle: Initial Study on ${customDay0Date}.${enrollNotes ? ` Notes: ${enrollNotes}` : ''}`,
        timeSpentMinutes: selectedStudiedTopic.totalTimeMinutes,
        totalTimeSpentMinutes: selectedStudiedTopic.totalTimeMinutes,
        sessionsCount: selectedStudiedTopic.sessionsCount,
        cycleStage: 'day1',
        initialStudyDate: customDay0Date,
        linkedSloIds: selectedStudiedTopic.sloCode ? [selectedStudiedTopic.sloCode] : undefined,
        linkedSloNames: selectedStudiedTopic.sloName ? [selectedStudiedTopic.sloName] : undefined
      });
    }

    setIsEnrollModalOpen(false);
    setEnrollNotes('');
  };

  // Compute live 1-3-7 pipeline
  const pipeline = useMemo(() => {
    return build137RevisionPipeline(subjects, sessions, revisions, testResults, assignments);
  }, [subjects, sessions, revisions, testResults, assignments]);

  // Aggregate metrics
  const dueTodayCount = pipeline.filter(p => p.dueStatus === 'due_today').length;
  const dueTomorrowCount = pipeline.filter(p => p.dueStatus === 'due_tomorrow').length;
  const overdueCount = pipeline.filter(p => p.dueStatus === 'overdue').length;
  const completedCount = pipeline.filter(p => p.dueStatus === 'completed').length;
  const day1Count = pipeline.filter(p => p.currentStage === 'day1').length;
  const day3Count = pipeline.filter(p => p.currentStage === 'day3').length;
  const day7Count = pipeline.filter(p => p.currentStage === 'day7').length;

  // Filtered cards
  const filteredCards = useMemo(() => {
    return pipeline.filter(item => {
      // Subject filter
      if (selectedSubject !== 'all' && item.subjectName.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.topicName.toLowerCase().includes(q) || 
                            item.subjectName.toLowerCase().includes(q) || 
                            (item.sloName && item.sloName.toLowerCase().includes(q)) ||
                            (item.sloCode && item.sloCode.toLowerCase().includes(q));
        if (!matchesName) return false;
      }
      // Stage / Due filter
      if (activeStageFilter === 'due_today') return item.dueStatus === 'due_today';
      if (activeStageFilter === 'due_tomorrow') return item.dueStatus === 'due_tomorrow';
      if (activeStageFilter === 'overdue') return item.dueStatus === 'overdue';
      if (activeStageFilter === 'completed') return item.dueStatus === 'completed';
      if (activeStageFilter === 'day1') return item.currentStage === 'day1';
      if (activeStageFilter === 'day3') return item.currentStage === 'day3';
      if (activeStageFilter === 'day7') return item.currentStage === 'day7';
      return true;
    });
  }, [pipeline, selectedSubject, searchQuery, activeStageFilter]);

  // Handle Mark Done & Day 7 Graduation to Mastered (Option C)
  const handleMarkComplete = async (item: Spaced137TopicCard) => {
    // If existing revision item exists, mark/progress it via onMarkRevisionDone
    const existing = revisions.find(r => 
      r.subjectName.toLowerCase() === item.subjectName.toLowerCase() &&
      r.topicName.toLowerCase() === item.topicName.toLowerCase()
    );
    if (existing) {
      onMarkRevisionDone(existing.id);
    } else if (onAddRevisionTopic) {
      const milestones = calculate137Milestones(item.initialStudyDate);
      if (item.currentStage === 'day1') {
        onAddRevisionTopic({
          subjectName: item.subjectName,
          chapterName: item.chapterName,
          topicName: item.topicName,
          lastStudied: toLocalDateString(new Date()),
          dueDate: milestones.day3,
          priority: item.priority,
          status: 'Pending',
          cycleStage: 'day3',
          completedStages: ['day1'],
          initialStudyDate: item.initialStudyDate
        });
      } else if (item.currentStage === 'day3') {
        onAddRevisionTopic({
          subjectName: item.subjectName,
          chapterName: item.chapterName,
          topicName: item.topicName,
          lastStudied: toLocalDateString(new Date()),
          dueDate: milestones.day7,
          priority: item.priority,
          status: 'Pending',
          cycleStage: 'day7',
          completedStages: ['day1', 'day3'],
          initialStudyDate: item.initialStudyDate
        });
      } else {
        onAddRevisionTopic({
          subjectName: item.subjectName,
          chapterName: item.chapterName,
          topicName: item.topicName,
          lastStudied: toLocalDateString(new Date()),
          dueDate: milestones.day7,
          priority: item.priority,
          status: 'Completed',
          completedAt: new Date().toISOString(),
          cycleStage: 'day7',
          isGraduated: true,
          completedStages: ['day1', 'day3', 'day7'],
          initialStudyDate: item.initialStudyDate
        });
      }
    }

    // When completing Day 7 or graduating, award +150 Mastery XP and mark syllabus status as Mastered!
    if (item.currentStage === 'day7' || item.currentStage === 'graduated') {
      if (onAwardXP) {
        onAwardXP(150, `1-3-7 Spaced Revision: ${item.topicName} Day 7 Mastered & Completed`);
      }
      if (onUpdateTopicStatus) {
        await onUpdateTopicStatus(item.subjectName, item.topicName, 'Mastered');
      }
      setXpNotification(`🏆 "${item.topicName}" has completed its Day 7 cycle and graduated into Mastered! (+150 XP & 10 Gems)`);
      setTimeout(() => setXpNotification(null), 6000);
    } else {
      if (onAwardXP) {
        onAwardXP(50, `1-3-7 Revision: ${item.topicName} (${item.currentStage.toUpperCase()})`);
      }
      const nextStage = item.currentStage === 'day1' ? 'Day 3' : 'Day 7';
      setXpNotification(`✨ "${item.topicName}" ${item.currentStage.toUpperCase()} completed! Scheduled for ${nextStage} review (+50 XP).`);
      setTimeout(() => setXpNotification(null), 4000);
    }
  };

  // Dispatch Email Briefing
  const handleEmailRevisionDigest = async () => {
    setIsSendingEmail(true);
    setEmailStatus(null);
    try {
      const email = userProfile?.email || getActiveUserEmail();
      const dueList = pipeline.filter(p => p.dueStatus === 'due_today' || p.dueStatus === 'overdue');
      
      const summaryList = dueList.map(item => ({
        subjectName: item.subjectName,
        topicName: `${item.topicName} [${item.currentStage.toUpperCase()}${item.sloCode ? ` | ${item.sloCode}` : ''}]`,
        duration: 30
      }));

      const res = await sendDailyCompletedWorkEmail({
        recipientEmail: email,
        recipientName: userProfile?.displayName || userProfile?.name || 'Scholar',
        completedTopics: summaryList,
        todaySessions: sessions.slice(0, 5),
        totalStudyMinutes: dueList.length * 30,
        userProfile: userProfile || undefined
      });

      if (res.success) {
        setEmailStatus({ type: 'success', message: `✅ 1-3-7 Spaced Agenda sent to ${email}!` });
      } else {
        setEmailStatus({ type: 'error', message: 'Failed to dispatch email.' });
      }
    } catch (e: any) {
      setEmailStatus({ type: 'error', message: e.message || 'Error sending digest.' });
    } finally {
      setIsSendingEmail(false);
      setTimeout(() => setEmailStatus(null), 5000);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-surface to-surface-raised border border-indigo-500/20 p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider border border-indigo-500/30">
              <RotateCcw className="w-3.5 h-3.5 animate-spin-slow text-indigo-400" />
              <span>Core Retention Command Center</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-primary flex items-center gap-3">
              <span>1-3-7 Spaced Revision Engine</span>
              <span className="text-sm font-normal px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-theme">
                Ebbinghaus Cadence
              </span>
            </h1>
            <p className="text-sm text-muted max-w-2xl leading-relaxed">
              Every topic you study is anchored at <strong>Day 0</strong> and automatically scheduled for retention boosts at <strong>Day 1</strong> (+24h), <strong>Day 3</strong> (+72h), and <strong>Day 7</strong> (+168h). Each revision stays linked to your <strong>Subject → Chapter → Topic → SLO</strong> hierarchy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setSelectedCardForTransfer(null);
                setIsTransferModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
              title="Transfer overdue or today's revision tasks to another date"
            >
              <RotateCcw className="w-4 h-4" />
              <span>⚡ Date Transfer & Transformer</span>
              {overdueCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {overdueCount} Overdue
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setIsEnrollModalOpen(true);
                const firstAvailable = studiedTopics.find(t => !t.isAlreadyIn137) || studiedTopics[0];
                if (firstAvailable) {
                  setSelectedTopicKey(`${firstAvailable.subjectName.toLowerCase()}:::${firstAvailable.topicName.toLowerCase()}`);
                  setCustomDay0Date(firstAvailable.firstStudiedDate);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg transition active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Enroll Studied Topic</span>
            </button>

            <button
              onClick={handleEmailRevisionDigest}
              disabled={isSendingEmail}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSendingEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  <span>Email Today's 1-3-7 Plan</span>
                </>
              )}
            </button>

            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('calendar')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-primary" />
                <span>Calendar View</span>
              </button>
            )}
          </div>
        </div>

        {/* Overdue Items Quick Transfer Banner */}
        {overdueCount > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-rose-700 dark:text-rose-300 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>You have {overdueCount} overdue revision topic{overdueCount > 1 ? 's' : ''}! Transfer them to today or tomorrow to restore retention momentum.</span>
            </div>
            <button
              onClick={() => {
                setSelectedCardForTransfer(null);
                setIsTransferModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <span>Batch Transfer Overdue ({overdueCount})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {emailStatus && (
          <div className={`mt-4 p-3 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            emailStatus.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 border border-emerald-500/30' 
              : 'bg-rose-500/10 text-rose-800 dark:text-rose-200 border border-rose-500/30'
          }`}>
            <AlertCircle className="w-4 h-4" />
            <span>{emailStatus.message}</span>
          </div>
        )}

        {/* Vintage Illuminated Manuscript & Calligraphic Cursive XP Toast Banner */}
        {xpNotification && (
          <div className="mt-4 p-4 rounded-3xl flex items-center justify-between gap-3 bg-gradient-to-r from-[#F7F3E9] via-[#FCFBF8] to-[#EFE9DC] dark:from-[#29241C] dark:via-[#332D24] dark:to-[#262018] text-[#3D3325] dark:text-[#E8DFC9] border-2 border-[#C5A880]/70 dark:border-[#C5A880]/40 shadow-lg relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-[#C5A880]/10 blur-xl pointer-events-none" />
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#C5A880]/20 border border-[#C5A880]/50 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 shadow-inner">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-[#8A7550] dark:text-[#C5A880] block">
                  ⚜ Academic Mastery & Spaced Retention
                </span>
                <span className="text-sm font-calligraphic italic font-semibold tracking-wide block truncate">
                  {xpNotification}
                </span>
              </div>
            </div>
            <button
              onClick={() => setXpNotification(null)}
              className="p-1.5 rounded-xl hover:bg-[#C5A880]/20 text-[#8A7550] dark:text-[#C5A880] transition cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Milestone Quick Cadence Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3 mt-6 pt-6 border-t border-theme/40 text-center">
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-muted block">Due Today</span>
            <span className={`text-xl font-extrabold ${dueTodayCount > 0 ? 'text-amber-500' : 'text-primary'}`}>
              {dueTodayCount}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-muted block">Due Tomorrow</span>
            <span className="text-xl font-extrabold text-primary">
              {dueTomorrowCount}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-rose-500 block">Missed / Overdue</span>
            <span className={`text-xl font-extrabold ${overdueCount > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
              {overdueCount}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-indigo-400 block">Day 1 (+24h)</span>
            <span className="text-xl font-extrabold text-indigo-400">
              {day1Count}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-cyan-400 block">Day 3 (+72h)</span>
            <span className="text-xl font-extrabold text-cyan-400">
              {day3Count}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-emerald-400 block">Day 7 (+168h)</span>
            <span className="text-xl font-extrabold text-emerald-400">
              {day7Count}
            </span>
          </div>
          <div className="p-3 rounded-2xl bg-surface border border-theme">
            <span className="text-[10px] font-bold uppercase text-emerald-500 block">Completed</span>
            <span className="text-xl font-extrabold text-emerald-500">
              {completedCount}
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="p-4 rounded-2xl bg-surface border border-theme flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Stage Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'due_today', label: `🔥 Due Today (${dueTodayCount})` },
            { id: 'due_tomorrow', label: `Tomorrow (${dueTomorrowCount})` },
            { id: 'overdue', label: `⚠️ Overdue (${overdueCount})` },
            { id: 'day1', label: `Day 1 (${day1Count})` },
            { id: 'day3', label: `Day 3 (${day3Count})` },
            { id: 'day7', label: `Day 7 (${day7Count})` },
            { id: 'completed', label: `Done (${completedCount})` },
            { id: 'all', label: `All Pipeline (${pipeline.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveStageFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                activeStageFilter === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-raised border border-theme text-muted hover:text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Subject Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Search topic or SLO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-raised border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-52"
            />
          </div>

          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="all">All Subjects</option>
            {subjects.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 1-3-7 Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCards.map((card) => {
          const isOverdue = card.dueStatus === 'overdue';
          const isDueToday = card.dueStatus === 'due_today';
          const isCompleted = card.dueStatus === 'completed';

          return (
            <div
              key={card.id}
              className={`p-5 rounded-3xl border transition duration-200 flex flex-col justify-between shadow-sm hover:shadow-md relative overflow-hidden ${
                isOverdue
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : isDueToday
                  ? 'bg-amber-500/5 border-amber-500/40'
                  : isCompleted
                  ? 'bg-emerald-500/5 border-emerald-500/30 opacity-75'
                  : 'bg-surface border-theme'
              }`}
            >
              {/* Top Meta: Hierarchy & Urgency */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                      <span>{card.subjectName}</span>
                      {card.chapterName && (
                        <>
                          <ChevronRight className="w-3 h-3 text-muted/60" />
                          <span>{card.chapterName}</span>
                        </>
                      )}
                    </span>
                    <h3 className="font-extrabold text-base text-primary leading-snug">
                      {card.topicName}
                    </h3>
                  </div>

                  {/* Stage and Due Urgency Pills */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isOverdue
                        ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 animate-pulse'
                        : isDueToday
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : isCompleted
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                        : 'bg-theme-accent/60 text-muted border-theme'
                    }`}>
                      {isOverdue ? '🔴 Overdue' : isDueToday ? '🟡 Due Today' : (card.currentStage === 'graduated' || isCompleted) ? '⭐ Mastered' : '🟢 Upcoming'}
                    </span>

                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      card.currentStage === 'day1'
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
                        : card.currentStage === 'day3'
                        ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20'
                        : card.currentStage === 'day7'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                        : card.currentStage === 'graduated'
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                    }`}>
                      {card.currentStage === 'graduated' ? 'DAY 7 GRADUATED' : card.currentStage.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* SLO Tag (Student Learning Objective) */}
                {card.sloName && (
                  <div className="p-2 rounded-xl bg-surface-raised border border-theme/60 text-[11px] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {card.sloCode || 'SLO'}:
                      </span>
                      <span className="text-primary truncate">{card.sloName}</span>
                    </div>
                  </div>
                )}

                {/* Cadence Visual Timeline: Day 0 -> Day 1 -> Day 3 -> Day 7 */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px] text-muted font-bold">
                    <span>Day 0 (Learned)</span>
                    <span>Day 1</span>
                    <span>Day 3</span>
                    <span>Day 7</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 flex-1 rounded-full bg-indigo-500" title="Day 0 Completed" />
                    <div className={`h-1.5 flex-1 rounded-full ${card.daysSinceInitialStudy >= 1 ? 'bg-indigo-500' : 'bg-surface-raised border border-theme'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${card.daysSinceInitialStudy >= 3 ? 'bg-indigo-500' : 'bg-surface-raised border border-theme'}`} />
                    <div className={`h-1.5 flex-1 rounded-full ${card.daysSinceInitialStudy >= 7 ? 'bg-indigo-500' : 'bg-surface-raised border border-theme'}`} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>{card.initialStudyDate}</span>
                    <span className="font-mono">Due: {card.dueDate}</span>
                  </div>
                </div>

                {/* Transferred Date Badge */}
                {card.isTransferredDate && (
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                      <span>Transferred Date: {card.dueDate}</span>
                    </span>
                    {card.originalCadenceDate && (
                      <span className="text-[9px] font-mono text-muted">
                        Cadence: {card.originalCadenceDate}
                      </span>
                    )}
                  </div>
                )}

                {/* Upcoming Exam or Uncured Mistake Badges */}
                <div className="space-y-1.5 pt-1">
                  {card.relatedTest && (
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 text-[10px] font-bold flex items-center justify-between">
                      <div className="flex items-center gap-1.5 truncate">
                        <AlertTriangle className="w-3 h-3 text-purple-400 shrink-0" />
                        <span className="truncate">Exam: {card.relatedTest.testTitle}</span>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20">
                        In {card.relatedTest.daysUntilTest}d
                      </span>
                    </div>
                  )}

                  {card.uncuredMistakesCount > 0 && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-900 dark:text-rose-200 text-[10px] font-bold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Flame className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>{card.uncuredMistakesCount} Uncured Exam Mistakes</span>
                      </span>
                      <span className="text-[9px] uppercase tracking-wider text-rose-600 dark:text-rose-400">High Risk</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-4 mt-4 border-t border-theme/40 flex items-center justify-between gap-2">
                <button
                  onClick={() => onStartTimerForTopic(card.subjectName, card.chapterName, card.topicName)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Drill</span>
                </button>

                <button
                  onClick={() => {
                    onStartTimerForTopic(card.subjectName, card.chapterName, card.topicName, 5);
                    if (onNavigateTab) onNavigateTab('timer');
                  }}
                  title="Launch rapid 5-minute active retrieval drill"
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold transition active:scale-95 cursor-pointer shrink-0"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>5m Recall</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedCardForTransfer(card);
                    setIsTransferModalOpen(true);
                  }}
                  title="Transfer revision date or transform timeline"
                  className="p-2 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-muted hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                </button>

                {onOpenCheatSheetForTopic && (
                  <button
                    onClick={() => onOpenCheatSheetForTopic(card.subjectName, card.topicName)}
                    title="Open 1-Page AI Cheat Sheet"
                    className="p-2 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-muted hover:text-primary transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => handleMarkComplete(card)}
                  title={isCompleted ? 'Marked Complete' : 'Mark 1-3-7 Revision Complete'}
                  className={`p-2 rounded-xl border transition cursor-pointer ${
                    isCompleted
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-600'
                      : 'bg-surface-raised hover:bg-emerald-500/10 hover:border-emerald-500/30 text-muted hover:text-emerald-600 border-theme'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCards.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-surface border border-theme space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-extrabold text-lg text-primary">All Clear on This Cadence!</h3>
          <p className="text-xs text-muted max-w-md mx-auto">
            No revision topics are currently pending in this category. Complete new study sessions or add syllabus topics to trigger their automated Day 1, Day 3, and Day 7 cycles.
          </p>
        </div>
      )}

      {/* Enroll Studied Topic Modal */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface border border-theme rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-theme flex items-start justify-between gap-4 bg-surface-raised/40">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Authentic Study-Linked Repetition</span>
                </div>
                <h2 className="text-xl font-extrabold text-primary flex items-center gap-2">
                  <span>Enroll Studied Topic in 1-3-7 Spaced Revision</span>
                </h2>
                <p className="text-xs text-muted max-w-2xl leading-relaxed">
                  Only topics with logged focus sessions or verified syllabus study time appear here. Unstudied syllabus topics are strictly filtered out to preserve genuine retention cadences.
                </p>
              </div>
              <button
                onClick={() => setIsEnrollModalOpen(false)}
                className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-raised border border-theme transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            {studiedTopics.length === 0 ? (
              <div className="p-10 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto border border-amber-500/20">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h3 className="font-extrabold text-base text-primary">No Studied Topics Recorded Yet</h3>
                  <p className="text-xs text-muted leading-relaxed">
                    The 1-3-7 Revision Engine schedules retention reviews starting from Day 0 (the day you first study a topic). Complete a session in the Study Timer or log progress in your Syllabus to begin!
                  </p>
                </div>
                <div className="flex items-center justify-center gap-3 pt-2">
                  {onNavigateTab && (
                    <button
                      onClick={() => {
                        setIsEnrollModalOpen(false);
                        onNavigateTab('timer');
                      }}
                      className="px-4 py-2.5 rounded-2xl bg-primary text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md hover:opacity-95"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Open Study Timer</span>
                    </button>
                  )}
                  <button
                    onClick={() => setIsEnrollModalOpen(false)}
                    className="px-4 py-2.5 rounded-2xl bg-surface-raised border border-theme text-primary font-bold text-xs cursor-pointer hover:bg-theme-accent"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEnrollSubmit} className="flex-1 overflow-hidden flex flex-col md:flex-row">
                {/* Left: Studied Topics List */}
                <div className="w-full md:w-1/2 p-5 border-b md:border-b-0 md:border-r border-theme flex flex-col max-h-[50vh] md:max-h-[60vh]">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                      <input
                        type="text"
                        placeholder="Search studied topics or SLO..."
                        value={enrollSearch}
                        onChange={(e) => setEnrollSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-surface-raised border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <select
                      value={enrollSubjectFilter}
                      onChange={(e) => setEnrollSubjectFilter(e.target.value)}
                      className="px-2.5 py-1.5 text-xs rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer shrink-0"
                    >
                      <option value="all">All Subjects</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[11px] font-bold text-muted mb-2 flex items-center justify-between">
                    <span>Eligible Studied Topics ({filteredStudiedTopics.length})</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Verified Study History</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {filteredStudiedTopics.map((topic) => {
                      const key = `${topic.subjectName.toLowerCase()}:::${topic.topicName.toLowerCase()}`;
                      const isSelected = selectedTopicKey.toLowerCase() === key;

                      return (
                        <div
                          key={key}
                          onClick={() => {
                            setSelectedTopicKey(key);
                            setCustomDay0Date(topic.firstStudiedDate);
                          }}
                          className={`p-3 rounded-2xl border transition cursor-pointer text-left ${
                            isSelected
                              ? 'bg-indigo-500/10 border-indigo-500 text-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-raised border-theme'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted font-bold">
                                <span>{topic.subjectName}</span>
                                {topic.chapterName && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate max-w-[120px]">{topic.chapterName}</span>
                                  </>
                                )}
                              </div>
                              <h4 className="font-bold text-xs text-primary mt-0.5">
                                {topic.topicName}
                              </h4>
                            </div>

                            {topic.isAlreadyIn137 && (
                              <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold">
                                In 1-3-7
                              </span>
                            )}
                          </div>

                          {topic.sloName && (
                            <div className="mt-1.5 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 truncate">
                              {topic.sloCode ? `${topic.sloCode}: ` : ''}{topic.sloName}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-3 text-[10px] text-muted border-t border-theme/40 pt-1.5">
                            <span>⏱️ {topic.totalTimeMinutes}m total</span>
                            <span>📖 {topic.sessionsCount} session{topic.sessionsCount !== 1 ? 's' : ''}</span>
                            <span>📅 Day 0: {topic.firstStudiedDate}</span>
                          </div>
                        </div>
                      );
                    })}

                    {filteredStudiedTopics.length === 0 && (
                      <div className="p-8 text-center text-xs text-muted border border-dashed border-theme rounded-2xl">
                        No studied topics matched your filter.
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: 1-3-7 Cadence Configuration */}
                <div className="w-full md:w-1/2 p-6 flex flex-col justify-between max-h-[50vh] md:max-h-[60vh] overflow-y-auto">
                  {selectedStudiedTopic ? (
                    <div className="space-y-4">
                      {/* Topic Header */}
                      <div className="p-3.5 rounded-2xl bg-surface-raised border border-theme space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                          {selectedStudiedTopic.subjectName} • {selectedStudiedTopic.chapterName}
                        </span>
                        <h3 className="font-extrabold text-base text-primary">
                          {selectedStudiedTopic.topicName}
                        </h3>
                        {selectedStudiedTopic.sloName && (
                          <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                            <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{selectedStudiedTopic.sloCode ? `[${selectedStudiedTopic.sloCode}] ` : ''}{selectedStudiedTopic.sloName}</span>
                          </div>
                        )}
                      </div>

                      {/* Day 0 Anchor Date Picker */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-primary flex items-center justify-between">
                          <span>Day 0 Anchor (Initial Study Date):</span>
                          <span className="text-[10px] text-muted">Original: {selectedStudiedTopic.firstStudiedDate}</span>
                        </label>
                        <input
                          type="date"
                          value={customDay0Date}
                          onChange={(e) => setCustomDay0Date(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {/* Dynamic 1-3-7 Milestone Previews */}
                      <div className="space-y-2">
                        <span className="text-xs font-bold text-primary block">Calculated Retention Cadence:</span>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                            <span className="text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-400 block">Day 1 (+24h)</span>
                            <span className="text-xs font-mono font-bold text-primary">{previewMilestones.day1}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                            <span className="text-[10px] font-bold uppercase text-cyan-600 dark:text-cyan-400 block">Day 3 (+72h)</span>
                            <span className="text-xs font-mono font-bold text-primary">{previewMilestones.day3}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block">Day 7 (+168h)</span>
                            <span className="text-xs font-mono font-bold text-primary">{previewMilestones.day7}</span>
                          </div>
                        </div>
                      </div>

                      {/* Notes / Focus Area */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-primary">Revision Focus / Notes (Optional):</label>
                        <input
                          type="text"
                          placeholder="e.g. Focus on mechanism diagrams & formulas..."
                          value={enrollNotes}
                          onChange={(e) => setEnrollNotes(e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-surface-raised border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {selectedStudiedTopic.isAlreadyIn137 && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-800 dark:text-amber-200 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-500" />
                          <span>This topic is already in your 1-3-7 schedule. Enrolling will refresh its cadence anchored to Day 0.</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-10 text-center text-xs text-muted flex flex-col items-center justify-center h-full">
                      <Compass className="w-8 h-8 text-muted/60 mb-2" />
                      <span>Select a studied topic on the left to configure its 1-3-7 spaced revision schedule.</span>
                    </div>
                  )}

                  {/* Submit Action */}
                  <div className="pt-4 border-t border-theme flex items-center justify-end gap-2 mt-4">
                    <button
                      type="button"
                      onClick={() => setIsEnrollModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-surface-raised border border-theme text-primary font-bold text-xs hover:bg-theme-accent cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!selectedStudiedTopic}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      Enroll in 1-3-7 Cycle
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Date Transfer & Workload Transformer Modal */}
      {isTransferModalOpen && (
        <Revision137DateTransferModal
          isOpen={isTransferModalOpen}
          onClose={() => {
            setIsTransferModalOpen(false);
            setSelectedCardForTransfer(null);
          }}
          initialTopicCard={selectedCardForTransfer}
          allCards={pipeline}
          subjects={subjects}
          revisions={revisions}
          onRescheduleRevision={onRescheduleRevision || (async (topicInfo, newDueDate, notes) => {
            if (onAddRevisionTopic) {
              onAddRevisionTopic({
                subjectName: topicInfo.subjectName,
                chapterName: topicInfo.chapterName || '',
                topicName: topicInfo.topicName,
                lastStudied: toLocalDateString(new Date()),
                dueDate: newDueDate,
                priority: 'High',
                status: 'Pending',
                reason: notes || `Transferred to ${newDueDate}`
              });
            }
          })}
          onTransform137Cycle={onTransform137Cycle || (async (subjectName, topicName, newDay0, notes) => {
            const milestones = calculate137Milestones(newDay0);
            if (onAddRevisionTopic) {
              onAddRevisionTopic({
                subjectName,
                chapterName: '',
                topicName,
                lastStudied: newDay0,
                dueDate: milestones.day1,
                priority: 'High',
                status: 'Pending',
                reason: `1-3-7 Spaced Cycle: Re-anchored to Day 0 (${newDay0}).${notes ? ` ${notes}` : ''}`,
                cycleStage: 'day1',
                initialStudyDate: newDay0
              });
            }
          })}
          onBatchTransferRevisions={onBatchTransferRevisions || (async (items, targetDate, _mode, _shift) => {
            if (onAddRevisionTopic) {
              items.forEach(it => {
                onAddRevisionTopic({
                  subjectName: it.subjectName,
                  chapterName: it.chapterName || '',
                  topicName: it.topicName,
                  lastStudied: toLocalDateString(new Date()),
                  dueDate: targetDate,
                  priority: 'High',
                  status: 'Pending',
                  reason: `Batch transferred to ${targetDate}`
                });
              });
            }
          })}
        />
      )}
    </div>
  );
};
