import React, { useState, useEffect } from 'react';
import { 
  BookmarkCheck, 
  Sparkles, 
  Search, 
  Filter, 
  Plus, 
  CheckCircle2, 
  RotateCcw, 
  Trash2, 
  AlertCircle, 
  TrendingUp, 
  BookOpen, 
  Play, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  Flame, 
  Trophy,
  Activity,
  Award,
  Zap,
  Tag,
  PenTool,
  FileCheck,
  GitMerge,
  Brain,
  HelpCircle
} from 'lucide-react';
import { MistakeEntry, CognitiveErrorCategory, Subject, TestResult } from '../types';
import { RetestMistakesModal } from './RetestMistakesModal';
import { WrongMCQAutopsyModal } from './WrongMCQAutopsyModal';
import { CrossTopicMistakeSynthesizerModal } from './CrossTopicMistakeSynthesizerModal';
import { BlurtingDiffCanvasModal } from './BlurtingDiffCanvasModal';
import { ThingsIKeepForgettingCard } from './ThingsIKeepForgettingCard';
import { detectRecurringWeaknesses } from '../lib/academicMasteryEngine';
import { 
  loadMistakes, 
  saveMistakes, 
  addMistake, 
  recordMistakeAttempt, 
  deleteMistake, 
  subscribeMistakes, 
  calculateMistakeStats,
  ERROR_CATEGORY_METADATA 
} from '../lib/mistakeVaultStorage';

interface MistakeVaultViewProps {
  subjects: Subject[];
  onNavigateToRedPen?: () => void;
  onOpenRetentionGraph?: () => void;
  onOpenMorningWarmup?: () => void;
  onStartDrill?: (mistakeId?: string, subjectName?: string, topicName?: string) => void;
  onAwardXP?: (xp: number, reason: string) => void;
  onSaveTestResult?: (test: Omit<TestResult, 'id'>) => void;
  onAddTo137Cycle?: (params: { subjectName: string; chapterName?: string; topicName: string; notes?: string }) => void;
  onOpenExternalAIBridge?: (subjectId?: string, topicName?: string, mistake?: any) => void;
  onNavigateToSyllabusTopic?: (subjectName: string, topicName: string) => void;
  onStartBlurtForTopic?: (subjectName: string, chapterName: string, topicName: string) => void;
}

export const MistakeVaultView: React.FC<MistakeVaultViewProps> = ({
  subjects,
  onNavigateToRedPen,
  onOpenRetentionGraph,
  onOpenMorningWarmup,
  onStartDrill,
  onAwardXP,
  onSaveTestResult,
  onAddTo137Cycle,
  onOpenExternalAIBridge,
  onNavigateToSyllabusTopic,
  onStartBlurtForTopic
}) => {
  const [activeVaultTab, setActiveVaultTab] = useState<'ledger' | 'recurring' | 'cross_mesh' | 'subject_patterns' | 'blind_spot_radar'>('ledger');
  const [isWrongMCQModalOpen, setIsWrongMCQModalOpen] = useState(false);
  const [isCrossTopicModalOpen, setIsCrossTopicModalOpen] = useState(false);
  const [crossTopicInitialA, setCrossTopicInitialA] = useState<string | undefined>(undefined);
  const [crossTopicInitialB, setCrossTopicInitialB] = useState<string | undefined>(undefined);
  const [isBlurtingModalOpen, setIsBlurtingModalOpen] = useState(false);
  const [blurtInitialSubject, setBlurtInitialSubject] = useState<string | undefined>(undefined);
  const [blurtInitialTopic, setBlurtInitialTopic] = useState<string | undefined>(undefined);
  const [mistakes, setMistakes] = useState<MistakeEntry[]>(() => loadMistakes());

  const recurringWeaknesses = React.useMemo(() => {
    return detectRecurringWeaknesses(mistakes, [], [], [], subjects);
  }, [mistakes, subjects]);
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'curing' | 'cured'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCureWorkoutActive, setIsCureWorkoutActive] = useState(false);
  const [activeWorkoutIndex, setActiveWorkoutIndex] = useState(0);
  const [showWorkoutAnswer, setShowWorkoutAnswer] = useState(false);
  const [workoutFinished, setWorkoutFinished] = useState(false);
  const [expandedMistakeIds, setExpandedMistakeIds] = useState<Record<string, boolean>>({});
  const [isRetestModalOpen, setIsRetestModalOpen] = useState(false);

  // New Mistake Form State
  const [formSubject, setFormSubject] = useState(subjects[0]?.name || 'Physics');
  const [formTopic, setFormTopic] = useState('');
  const [formQuestion, setFormQuestion] = useState('');
  const [formAttempt, setFormAttempt] = useState('');
  const [formCorrectAnswer, setFormCorrectAnswer] = useState('');
  const [formCategory, setFormCategory] = useState<CognitiveErrorCategory>('careless_calc');
  const [formThoughtProcess, setFormThoughtProcess] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    const unsub = subscribeMistakes((updated) => {
      setMistakes(updated);
    });
    return () => unsub();
  }, []);

  const stats = calculateMistakeStats(mistakes);

  // Filtered List
  const filteredMistakes = mistakes.filter(m => {
    if (selectedSubject !== 'all' && m.subjectName !== selectedSubject) return false;
    if (selectedCategory !== 'all' && m.errorCategory !== selectedCategory) return false;
    if (selectedStatus !== 'all' && m.cureStatus !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchQuestion = m.question.toLowerCase().includes(q);
      const matchTopic = (m.topicName || '').toLowerCase().includes(q);
      const matchNotes = (m.notes || '').toLowerCase().includes(q);
      if (!matchQuestion && !matchTopic && !matchNotes) return false;
    }
    return true;
  });

  const activeCureCandidates = mistakes.filter(m => m.cureStatus !== 'cured');

  // 1. Subject Categorization & Commonized Patterns
  const distinctSubjectNames = Array.from(new Set([
    ...subjects.map(s => s.name),
    ...mistakes.map(m => m.subjectName)
  ])).filter(Boolean);

  const subjectBreakdowns = distinctSubjectNames.map(subjName => {
    const subjMistakes = mistakes.filter(m => m.subjectName.toLowerCase() === subjName.toLowerCase());
    const total = subjMistakes.length;
    const cured = subjMistakes.filter(m => m.cureStatus === 'cured').length;
    const active = total - cured;
    const cureRate = total > 0 ? Math.round((cured / total) * 100) : 100;

    const categoryCounts: Record<CognitiveErrorCategory, number> = {
      careless_calc: 0,
      concept_gap: 0,
      misread_question: 0,
      formula_confusion: 0,
      time_pressure: 0,
      english_comprehension: 0,
      missing_question: 0
    };
    subjMistakes.forEach(m => {
      if (categoryCounts[m.errorCategory] !== undefined) {
        categoryCounts[m.errorCategory]++;
      }
    });

    // Group commonized mistake patterns per subject
    const trapClusters: Array<{ topic: string; count: number; category: CognitiveErrorCategory; sampleQuestion: string; isCured: boolean }> = [];
    const topicGroupMap: Record<string, MistakeEntry[]> = {};
    subjMistakes.forEach(m => {
      const topKey = m.topicName?.trim() || 'General Core Trap';
      if (!topicGroupMap[topKey]) topicGroupMap[topKey] = [];
      topicGroupMap[topKey].push(m);
    });

    Object.entries(topicGroupMap).forEach(([top, list]) => {
      const allCured = list.every(item => item.cureStatus === 'cured');
      trapClusters.push({
        topic: top,
        count: list.length,
        category: list[0].errorCategory,
        sampleQuestion: list[0].question,
        isCured: allCured
      });
    });

    return {
      subjectName: subjName,
      total,
      cured,
      active,
      cureRate,
      categoryCounts,
      trapClusters
    };
  });

  // 2. Blind Spot Radar Diagnostics
  const blindSpotRadarItems: Array<{
    subjectName: string;
    chapterName?: string;
    topicName: string;
    uncuredMistakes: number;
    riskScore: number;
    riskTier: 'critical' | 'moderate' | 'safe';
    status: string;
  }> = [];

  subjects.forEach(s => {
    (s.chapters || []).forEach(ch => {
      (ch.topics || []).forEach(tp => {
        const matchingMistakes = mistakes.filter(m => 
          m.subjectName.toLowerCase() === s.name.toLowerCase() &&
          (m.topicName.toLowerCase().includes(tp.name.toLowerCase()) || tp.name.toLowerCase().includes(m.topicName.toLowerCase()))
        );
        const uncuredCount = matchingMistakes.filter(m => m.cureStatus !== 'cured').length;
        
        let riskScore = 15;
        let riskTier: 'critical' | 'moderate' | 'safe' = 'safe';

        if (uncuredCount >= 2) {
          riskScore = Math.min(100, 70 + uncuredCount * 10);
          riskTier = 'critical';
        } else if (uncuredCount === 1) {
          riskScore = 65;
          riskTier = 'moderate';
        } else if (tp.status === 'Needs Review') {
          riskScore = 55;
          riskTier = 'moderate';
        } else if (tp.status === 'Completed') {
          riskScore = 20;
          riskTier = 'safe';
        } else {
          riskScore = 40;
          riskTier = 'moderate';
        }

        blindSpotRadarItems.push({
          subjectName: s.name,
          chapterName: ch.name,
          topicName: tp.name,
          uncuredMistakes: uncuredCount,
          riskScore,
          riskTier,
          status: tp.status || 'Not Started'
        });
      });
    });
  });

  blindSpotRadarItems.sort((a, b) => b.riskScore - a.riskScore);

  // 3. Top Topic Blunder Clusters (Syllabus Cross-Communication)
  const topTopicClusters = React.useMemo(() => {
    const topicMap: Record<string, {
      topicName: string;
      subjectName: string;
      chapterName?: string;
      mistakes: MistakeEntry[];
      curedCount: number;
      activeCount: number;
      dominantCategory: CognitiveErrorCategory;
    }> = {};

    mistakes.forEach(m => {
      const key = `${m.subjectName}:::${m.topicName}`;
      if (!topicMap[key]) {
        const subj = subjects.find(s => s.name.toLowerCase() === m.subjectName.toLowerCase());
        const ch = subj?.chapters.find(c => c.topics.some(t => t.name.toLowerCase() === m.topicName.toLowerCase()));
        topicMap[key] = {
          topicName: m.topicName,
          subjectName: m.subjectName,
          chapterName: ch?.name,
          mistakes: [],
          curedCount: 0,
          activeCount: 0,
          dominantCategory: m.errorCategory
        };
      }
      topicMap[key].mistakes.push(m);
      if (m.cureStatus === 'cured') topicMap[key].curedCount++;
      else topicMap[key].activeCount++;
    });

    return Object.values(topicMap).sort((a, b) => b.mistakes.length - a.mistakes.length);
  }, [mistakes, subjects]);

  const handleCreateMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formQuestion.trim() || !formCorrectAnswer.trim()) return;

    addMistake({
      subjectName: formSubject,
      topicName: formTopic.trim() || 'Core Topic',
      question: formQuestion.trim(),
      userAttempt: formAttempt.trim(),
      correctAnswer: formCorrectAnswer.trim(),
      errorCategory: formCategory,
      studentThoughtProcess: formThoughtProcess.trim() || undefined,
      notes: formNotes.trim(),
      source: 'manual'
    });

    // Reset Form
    setFormQuestion('');
    setFormAttempt('');
    setFormCorrectAnswer('');
    setFormThoughtProcess('');
    setFormNotes('');
    setIsAddModalOpen(false);

    if (onAwardXP) {
      onAwardXP(20, 'Logged new mistake to Exam Autopsy Vault');
    }
  };

  const handleStartWorkout = () => {
    if (activeCureCandidates.length === 0) return;
    setActiveWorkoutIndex(0);
    setShowWorkoutAnswer(false);
    setWorkoutFinished(false);
    setIsCureWorkoutActive(true);
  };

  const handleWorkoutAnswer = (wasCorrect: boolean) => {
    const currentMistake = activeCureCandidates[activeWorkoutIndex];
    if (!currentMistake) return;

    const { justCured } = recordMistakeAttempt(currentMistake.id, wasCorrect);

    if (wasCorrect && onAwardXP) {
      onAwardXP(justCured ? 50 : 20, justCured ? `Cured mistake in ${currentMistake.subjectName}!` : 'Successful mistake recall drill');
    }

    if (activeWorkoutIndex + 1 < activeCureCandidates.length) {
      setActiveWorkoutIndex(prev => prev + 1);
      setShowWorkoutAnswer(false);
    } else {
      setWorkoutFinished(true);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedMistakeIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="p-6 rounded-3xl bg-surface border border-theme shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <BookmarkCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-primary">The Exam Autopsy & Mistake Vault</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-400/40 text-[10px] font-bold uppercase tracking-wider">
                Anti-Careless Engine
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-2xl leading-relaxed">
              Top rankers don't study more hours — they obsess over their mistakes. Log tricky past paper traps and careless slips here, and drill them until they have a 100% cure rate.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {onOpenRetentionGraph && (
            <button
              onClick={onOpenRetentionGraph}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition shadow-2xs cursor-pointer"
              title="View Ebbinghaus memory stability & forgetting curvature across all topics"
            >
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Cognitive Graph</span>
            </button>
          )}

          {onOpenMorningWarmup && (
            <button
              onClick={onOpenMorningWarmup}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 text-xs font-semibold transition shadow-2xs cursor-pointer"
              title="Launch daily 3-question spaced mistake review workout"
            >
              <Zap className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              <span>Morning Warmup</span>
            </button>
          )}

          {onNavigateToRedPen && (
            <button
              onClick={onNavigateToRedPen}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer"
            >
              <PenTool className="w-4 h-4 text-rose-500" />
              <span>Red Pen Grader</span>
            </button>
          )}

          <button
            onClick={() => setIsRetestModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Generate a custom timed re-test quiz from your active uncured mistakes"
          >
            <FileCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Re-Test Uncured Traps</span>
          </button>

          <button
            onClick={() => setIsWrongMCQModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Upload or paste wrong MCQ to dissect distractor traps and generate counter-drills"
          >
            <HelpCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <span>Dissect Wrong MCQ (Option 10)</span>
          </button>

          <button
            onClick={() => {
              setCrossTopicInitialA(undefined);
              setCrossTopicInitialB(undefined);
              setIsCrossTopicModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="Cross-communicate between related topics in the vault to heal compound misconceptions (Option 18)"
          >
            <GitMerge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <span>Cross-Topic Mesh (Option 18)</span>
          </button>

          <button
            onClick={() => {
              setBlurtInitialSubject(undefined);
              setBlurtInitialTopic(undefined);
              setIsBlurtingModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition shadow-2xs cursor-pointer"
            title="3-Minute Feynman Active Recall Blurting & Syllabus Diff Canvas (Option 15)"
          >
            <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Blurt Diff (Option 15)</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Log Mistake</span>
          </button>
        </div>
      </div>

      {/* Autopsy Diagnostics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Total Errors Tracked</span>
          <div className="text-2xl font-serif font-bold text-primary mt-1">{stats.total}</div>
          <span className="text-[10px] text-muted">{stats.active} active • {stats.curing} in progress</span>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Cured Errors (3/3 Streak)</span>
          <div className="text-2xl font-serif font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {stats.cured}
          </div>
          <div className="w-full bg-theme-accent rounded-full h-1.5 mt-1.5 overflow-hidden">
            <div 
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${stats.cureRate}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
          <span className="text-[11px] font-semibold text-muted">Vault Cure Rate</span>
          <div className="text-2xl font-serif font-bold text-primary mt-1">{stats.cureRate}%</div>
          <span className="text-[10px] text-muted">Goal: 90%+ before final exams</span>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-surface to-surface border border-amber-500/30 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Cure Workout</span>
            </span>
            <p className="text-[11px] text-muted mt-0.5">
              {activeCureCandidates.length} uncured traps waiting
            </p>
          </div>
          <button
            onClick={handleStartWorkout}
            disabled={activeCureCandidates.length === 0}
            className="mt-2 w-full py-1.5 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-white" />
            <span>Start Drill</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Ledger | Subject Patterns | Blind Spot Radar */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-surface border border-theme text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveVaultTab('ledger')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            activeVaultTab === 'ledger' ? 'bg-card text-primary shadow-xs border border-theme/60' : 'text-muted hover:text-primary'
          }`}
        >
          <BookmarkCheck className="w-4 h-4 text-amber-500" />
          <span>Mistake Ledger & Drills</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveVaultTab('recurring')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            activeVaultTab === 'recurring' ? 'bg-card text-primary shadow-xs border border-theme/60' : 'text-muted hover:text-primary'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-500" />
          <span>Things You Keep Forgetting ({recurringWeaknesses.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveVaultTab('cross_mesh')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            activeVaultTab === 'cross_mesh' ? 'bg-card text-primary shadow-xs border border-theme/60' : 'text-muted hover:text-primary'
          }`}
        >
          <GitMerge className="w-4 h-4 text-purple-500" />
          <span>Cross-Topic Mesh (Option 18)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveVaultTab('subject_patterns')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            activeVaultTab === 'subject_patterns' ? 'bg-card text-primary shadow-xs border border-theme/60' : 'text-muted hover:text-primary'
          }`}
        >
          <Tag className="w-4 h-4 text-primary" />
          <span>Subject Categorization & Patterns</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveVaultTab('blind_spot_radar')}
          className={`flex-1 py-2 px-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            activeVaultTab === 'blind_spot_radar' ? 'bg-card text-primary shadow-xs border border-theme/60' : 'text-muted hover:text-primary'
          }`}
        >
          <Activity className="w-4 h-4 text-rose-500" />
          <span>Blind Spot Radar</span>
        </button>
      </div>

      {/* VIEW RECURRING WEAKNESSES: THINGS YOU KEEP FORGETTING */}
      {activeVaultTab === 'recurring' && (
        <div className="space-y-6 animate-fade-in">
          <ThingsIKeepForgettingCard
            weaknesses={recurringWeaknesses}
            onStartRemediation={(weakness) => {
              if (onStartDrill) {
                onStartDrill(weakness.representativeMistakeId, weakness.subjectName, weakness.conceptName);
              }
            }}
            compact={false}
          />
        </div>
      )}

      {/* VIEW 0: CROSS-TOPIC CONCEPTUAL MESH NETWORK (Option 18) */}
      {activeVaultTab === 'cross_mesh' && (
        <div className="space-y-6 animate-fade-in">
          <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-500/10 via-surface to-indigo-500/10 border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary flex items-center gap-2">
                  <GitMerge className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span>Cross-Topic Conceptual Mesh Network</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Option 18 Active
                </span>
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl leading-relaxed">
                Connects recurring errors across related syllabus topics. Instead of studying topics in isolation, heal compound cognitive traps and master multi-topic transfer questions.
              </p>
            </div>

            <button
              onClick={() => {
                setCrossTopicInitialA(undefined);
                setCrossTopicInitialB(undefined);
                setIsCrossTopicModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
            >
              <Sparkles className="w-4 h-4" />
              <span>Open Synthesizer Modal</span>
            </button>
          </div>

          {/* Cross-Topic Resonant Pairs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pair 1: Mechanics Core */}
            <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-primary">Newtonian Dynamics ⨁ Work & Energy</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold">
                  High Resonance
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                <strong>Shared Failure Vector:</strong> Overlooking non-conservative friction work while setting up mechanical energy conservation equations.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted">
                  Affects 3+ logged errors in vault
                </span>
                <button
                  onClick={() => {
                    setCrossTopicInitialA('Newtonian Mechanics');
                    setCrossTopicInitialB('Work, Energy & Power');
                    setIsCrossTopicModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
                >
                  Synthesize Bridge →
                </button>
              </div>
            </div>

            {/* Pair 2: Rotational Dynamics */}
            <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-primary">Linear Momentum ⨁ Rotational Dynamics</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold">
                  Core Board Trap
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                <strong>Shared Failure Vector:</strong> Forgetting pivot reaction forces when conserving linear vs angular momentum about fixed axes.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted">
                  Board Exam Casualty Rate: 72%
                </span>
                <button
                  onClick={() => {
                    setCrossTopicInitialA('Conservation of Momentum');
                    setCrossTopicInitialB('Rotational Dynamics');
                    setIsCrossTopicModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
                >
                  Synthesize Bridge →
                </button>
              </div>
            </div>

            {/* Pair 3: Electromagnetism */}
            <div className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-serif font-bold text-sm text-primary">Electric Fields ⨁ Magnetic Fields</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 font-bold">
                  Lorentz Superposition
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                <strong>Shared Failure Vector:</strong> Right-hand rule vector sign error in cross product v × B and velocity selector balance.
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted">
                  Zero Work on Magnetic Field Trap
                </span>
                <button
                  onClick={() => {
                    setCrossTopicInitialA('Electrostatics');
                    setCrossTopicInitialB('Magnetic Effects of Current');
                    setIsCrossTopicModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
                >
                  Synthesize Bridge →
                </button>
              </div>
            </div>

            {/* Pair 4: Custom Synthesis Launcher */}
            <div className="p-5 rounded-3xl bg-surface/60 border border-dashed border-theme flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <GitMerge className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-primary">Select Custom Topics from Vault</h4>
                <p className="text-xs text-muted max-w-xs mt-0.5">
                  Pick any two topics from your {mistakes.length} mistakes to generate an immediate synthesis mesh.
                </p>
              </div>
              <button
                onClick={() => setIsCrossTopicModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              >
                Synthesize Any 2 Topics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: SUBJECT CATEGORIZATION & COMMONIZED PATTERNS */}
      {activeVaultTab === 'subject_patterns' && (
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-surface border border-theme flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-primary flex items-center gap-2">
                <Tag className="w-4 h-4 text-primary" />
                <span>Subject-Wise Mistake Categorization & Commonized Traps</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Mistakes grouped and categorized for each subject to reveal recurring cognitive patterns.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-primary">
              {subjectBreakdowns.length} Subjects Analyzed
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {subjectBreakdowns.map((sb) => (
              <div key={sb.subjectName} className="p-5 rounded-3xl bg-surface border border-theme shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-serif font-bold text-base text-primary">{sb.subjectName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-mono font-bold">
                      {sb.total} total
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {sb.cureRate}% Cured
                    </span>
                    <span className="text-[10px] text-muted block">{sb.active} active traps</span>
                  </div>
                </div>

                {/* Category breakdown bar for this subject */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                    Cognitive Root Causes:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                    {(Object.keys(sb.categoryCounts) as CognitiveErrorCategory[]).map(cat => {
                      const count = sb.categoryCounts[cat];
                      const meta = ERROR_CATEGORY_METADATA[cat];
                      return (
                        <div
                          key={cat}
                          className={`p-1.5 rounded-lg border flex items-center justify-between gap-1.5 ${
                            count > 0 ? `${meta.bgColor} ${meta.borderColor} ${meta.color}` : 'bg-surface-raised border-theme/40 text-muted opacity-60'
                          }`}
                        >
                          <span className="truncate text-[10px] font-medium">{meta.label}</span>
                          <span className="font-mono font-bold text-[10px]">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Commonized Recurring Traps */}
                <div className="space-y-2 pt-2 border-t border-theme/60">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-wider flex items-center justify-between">
                    <span>Commonized Traps & Pitfalls</span>
                    <span className="text-muted font-normal">Clustered patterns</span>
                  </span>

                  {sb.trapClusters.length > 0 ? (
                    <div className="space-y-2">
                      {sb.trapClusters.map((tc, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-card border border-theme text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <strong className="text-primary text-[11px] font-bold flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              <span>{tc.topic}</span>
                            </strong>
                            <span className="px-2 py-0.5 rounded-lg bg-theme-accent text-[10px] font-mono font-bold text-muted">
                              {tc.count} {tc.count === 1 ? 'question' : 'questions'}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted italic line-clamp-1">
                            "{tc.sampleQuestion}"
                          </p>
                          <div className="flex items-center justify-between pt-1 text-[10px]">
                            <span className={tc.isCured ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                              {tc.isCured ? '✓ Trap Mastered' : '⚠️ Recurring Vulnerability'}
                            </span>
                            {onStartDrill && (
                              <button
                                type="button"
                                onClick={() => onStartDrill(undefined, sb.subjectName, tc.topic)}
                                className="text-primary hover:underline font-bold cursor-pointer"
                              >
                                Drill this Trap →
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center text-xs text-emerald-800 dark:text-emerald-300">
                      Zero recurring mistake traps for {sb.subjectName}. Excellent consistency!
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 2: BLIND SPOT RADAR */}
      {activeVaultTab === 'blind_spot_radar' && (
        <div className="space-y-6">
          <div className="p-5 rounded-3xl bg-surface border border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-primary flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-500" />
                  <span>Blind Spot Radar Diagnostic</span>
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30 text-[10px] font-bold uppercase tracking-wider">
                  Risk Matrix
                </span>
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Topics prioritized by risk: combining uncured mistakes, syllabus progress, and test struggles to ensure zero blind spots remain before exam day.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-center p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 min-w-[70px]">
                <span className="text-[10px] text-rose-700 dark:text-rose-300 font-bold uppercase block">Critical</span>
                <span className="font-mono font-bold text-sm text-rose-700 dark:text-rose-300">
                  {blindSpotRadarItems.filter(b => b.riskTier === 'critical').length}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 min-w-[70px]">
                <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold uppercase block">Moderate</span>
                <span className="font-mono font-bold text-sm text-amber-700 dark:text-amber-300">
                  {blindSpotRadarItems.filter(b => b.riskTier === 'moderate').length}
                </span>
              </div>
              <div className="text-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 min-w-[70px]">
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase block">Safe</span>
                <span className="font-mono font-bold text-sm text-emerald-700 dark:text-emerald-300">
                  {blindSpotRadarItems.filter(b => b.riskTier === 'safe').length}
                </span>
              </div>
            </div>
          </div>

          {/* Blind Spot Topic Radar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blindSpotRadarItems.map((item, idx) => {
              const isCrit = item.riskTier === 'critical';
              const isMod = item.riskTier === 'moderate';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 flex flex-col justify-between ${
                    isCrit 
                      ? 'bg-rose-500/5 border-rose-500/40' 
                      : isMod 
                        ? 'bg-surface border-theme' 
                        : 'bg-emerald-500/5 border-emerald-500/30'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-2 py-0.5 rounded-lg bg-theme-accent text-primary font-mono text-[10px] font-bold">
                        {item.subjectName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isCrit 
                          ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30' 
                          : isMod 
                            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30' 
                            : 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {isCrit ? '🚨 Critical Blind Spot' : isMod ? '⚠️ Latent Risk' : '🟢 Safe Zone'}
                      </span>
                    </div>

                    <h4 className="font-serif font-bold text-sm text-primary leading-tight">
                      {item.topicName}
                    </h4>
                    {item.chapterName && (
                      <p className="text-[11px] text-muted truncate">
                        {item.chapterName}
                      </p>
                    )}

                    {/* Risk Meter */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                        <span>Risk Index</span>
                        <span className="font-bold text-primary">{item.riskScore}%</span>
                      </div>
                      <div className="w-full bg-theme-accent rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isCrit ? 'bg-rose-600' : isMod ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.riskScore}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted pt-1">
                      <span>Uncured Mistakes: <strong className="text-primary">{item.uncuredMistakes}</strong></span>
                      <span>Status: <strong className="text-primary">{item.status}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-theme/60 text-xs">
                    {onAddTo137Cycle && (
                      <button
                        type="button"
                        onClick={() => onAddTo137Cycle({
                          subjectName: item.subjectName,
                          chapterName: item.chapterName,
                          topicName: item.topicName,
                          notes: `Added from Blind Spot Radar (${item.riskScore}% Risk Index)`
                        })}
                        className="flex-1 py-1.5 px-2 rounded-xl bg-theme-accent hover:bg-surface border border-theme text-primary text-[10px] font-bold transition text-center cursor-pointer"
                        title="Add to 1-3-7 Spaced Revision"
                      >
                        + 1-3-7 Spaced Review
                      </button>
                    )}

                    {onStartDrill && (
                      <button
                        type="button"
                        onClick={() => onStartDrill(undefined, item.subjectName, item.topicName)}
                        className="py-1.5 px-3 rounded-xl bg-primary text-primary-content hover:opacity-90 text-[10px] font-bold transition text-center cursor-pointer"
                        title="Start active question drill"
                      >
                        Drill
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: CLASSIC MISTAKE LEDGER */}
      {activeVaultTab === 'ledger' && (
        <>
          {/* Cognitive Error Breakdown Pills */}
          <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <span>Root Cause Diagnostics (Why Marks Were Lost)</span>
              </span>
              <span className="text-[10px] text-muted">Select to filter</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              {(Object.keys(ERROR_CATEGORY_METADATA) as CognitiveErrorCategory[]).map((cat) => {
                const meta = ERROR_CATEGORY_METADATA[cat];
                const count = stats.categoryCounts[cat] || 0;
                const isSelected = selectedCategory === cat;

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(isSelected ? 'all' : cat)}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                      isSelected 
                        ? `${meta.bgColor} ${meta.borderColor} ring-2 ring-primary/20`
                        : 'bg-surface-raised hover:bg-theme-accent/50 border-theme/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base">{meta.iconText}</span>
                      <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-surface text-primary border border-theme/40">
                        {count}
                      </span>
                    </div>
                    <p className="font-bold text-[11px] text-primary mt-1 line-clamp-1">{meta.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search & Filter Strip */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search questions, traps, or notes..."
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-surface border border-theme text-primary text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="px-3 py-2 rounded-xl bg-surface border border-theme text-primary text-xs font-medium focus:outline-none"
              >
                <option value="all">All Subjects</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-surface border border-theme text-primary text-xs font-medium focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Traps</option>
                <option value="curing">In Progress (1-2 Streak)</option>
                <option value="cured">Cured (3/3 Streak)</option>
              </select>
            </div>
          </div>
        </>
      )}

      {/* Mistake Cards Ledger */}
      {activeVaultTab === 'ledger' && (
        <div className="space-y-3">
          {filteredMistakes.map((m) => {
          const meta = ERROR_CATEGORY_METADATA[m.errorCategory] || ERROR_CATEGORY_METADATA.careless_calc;
          const isExpanded = expandedMistakeIds[m.id];

          return (
            <div
              key={m.id}
              className={`p-4 sm:p-5 rounded-2xl bg-surface border transition shadow-2xs ${
                m.cureStatus === 'cured'
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-theme'
              }`}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-theme/60 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-theme-accent text-primary font-bold text-[11px] border border-theme/40">
                    {m.subjectName}
                  </span>
                  {m.topicName && (
                    <span className="text-[11px] text-muted">
                      {m.topicName}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border flex items-center gap-1 ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                    <span>{meta.iconText}</span>
                    <span>{meta.label}</span>
                  </span>
                </div>

                {/* Consecutive Streak Badges */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted uppercase font-bold">Cure Streak:</span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((idx) => {
                      const isFilled = idx < m.consecutiveCorrect;
                      return (
                        <div
                          key={idx}
                          className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                            isFilled
                              ? 'bg-emerald-500 border-emerald-600 text-white'
                              : 'bg-theme-accent border-theme text-transparent'
                          }`}
                        >
                          {isFilled && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      );
                    })}
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    m.cureStatus === 'cured'
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : m.cureStatus === 'curing'
                      ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                  }`}>
                    {m.cureStatus}
                  </span>
                </div>
              </div>

              {/* Question Statement */}
              <div className="pt-3">
                <p className="text-xs sm:text-sm font-semibold text-primary leading-relaxed font-serif">
                  {m.question}
                </p>

                {/* What I Did Wrong Callout */}
                {m.userAttempt && (
                  <div className="mt-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-900 dark:text-rose-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400">
                      What I Did Wrong (Previous Trap):
                    </span>
                    <p className="mt-0.5 font-sans leading-relaxed">{m.userAttempt}</p>
                  </div>
                )}

                {/* What I Was Thinking At That Moment */}
                {m.studentThoughtProcess && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      💭 My Thought Process At That Moment:
                    </span>
                    <p className="mt-0.5 font-sans italic leading-relaxed">"{m.studentThoughtProcess}"</p>
                  </div>
                )}

                {/* Collapsible Correct Solution */}
                {isExpanded ? (
                  <div className="mt-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-950 dark:text-emerald-200 space-y-1.5 animate-in fade-in duration-200">
                    <span className="font-bold block text-[10px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Official Correct Solution & Method:
                    </span>
                    <p className="font-sans leading-relaxed whitespace-pre-line">{m.correctAnswer}</p>
                    {m.notes && (
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pt-1 border-t border-emerald-500/20">
                        💡 <strong>Autopsy Takeaway:</strong> {m.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => toggleExpand(m.id)}
                    className="mt-2 text-xs font-bold text-primary/80 hover:text-primary flex items-center gap-1 cursor-pointer"
                  >
                    <span>Reveal Correct Solution & Takeaway</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="mt-3 pt-2 border-t border-theme/40 flex items-center justify-between text-xs text-muted">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted">Source:</span>
                  <span className="px-2 py-0.5 rounded-md bg-surface-raised border border-theme text-[10px] font-bold text-primary capitalize flex items-center gap-1">
                    {m.source === 'red_pen' ? '🖊️ Examiner Red Pen' :
                     m.source === 'past_paper' ? '📝 Mock Exam Paper' :
                     m.source === 'quiz' ? '⚡ Active Quiz' :
                     m.source === 'blurt' ? '🧠 Blurt Active Retrieval' :
                     m.source === 'socratic' ? '🎙️ Socratic Oral' :
                     m.source === 'timer' ? '⏱️ Study Sprint Autopsy' :
                     '📌 ' + (m.source || 'Manual')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBlurtInitialSubject(m.subjectName);
                      setBlurtInitialTopic(m.topicName);
                      setIsBlurtingModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold transition cursor-pointer text-[11px]"
                    title="Option 15: 3-Minute Active Recall Blurt & Diff Canvas"
                  >
                    <Brain className="w-3 h-3 text-amber-500" />
                    <span>Blurt</span>
                  </button>

                  <button
                    onClick={() => {
                      setCrossTopicInitialA(m.topicName);
                      setIsCrossTopicModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-semibold transition cursor-pointer text-[11px]"
                    title="Option 18: Cross-Topic Interconnection Mesh"
                  >
                    <GitMerge className="w-3 h-3 text-purple-500" />
                    <span>Cross-Mesh</span>
                  </button>

                  {onOpenExternalAIBridge && (
                    <button
                      onClick={() => onOpenExternalAIBridge(undefined, m.topicName, m)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-semibold transition cursor-pointer text-[11px]"
                      title="Option 3: External AI Autopsy in Claude or ChatGPT ($0 Cost)"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>AI Autopsy</span>
                    </button>
                  )}
                  {onStartDrill && (
                    <button
                      onClick={() => onStartDrill(m.id, m.subjectName, m.topicName)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold transition cursor-pointer text-[11px]"
                      title="Launch targeted 2-minute remediation drill for this specific concept"
                    >
                      <Zap className="w-3 h-3 text-amber-500" />
                      <span>2-Min Drill</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const { justCured } = recordMistakeAttempt(m.id, true);
                      if (onAwardXP) onAwardXP(justCured ? 50 : 20, 'Drill passed');
                    }}
                    className="px-2.5 py-1 rounded-lg bg-theme-accent hover:bg-emerald-500/20 hover:text-emerald-600 font-semibold transition cursor-pointer text-[11px]"
                  >
                    +1 Streak (Correct)
                  </button>
                  <button
                    onClick={() => deleteMistake(m.id)}
                    className="p-1.5 rounded-lg text-muted hover:text-rose-600 transition cursor-pointer"
                    title="Delete mistake"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filteredMistakes.length === 0 && (
          <div className="p-12 rounded-3xl bg-surface border border-theme text-center space-y-3">
            <BookmarkCheck className="w-8 h-8 mx-auto text-muted" />
            <h3 className="text-sm font-bold text-primary">No mistakes found</h3>
            <p className="text-xs text-muted max-w-sm mx-auto">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try clearing your active filters.'
                : 'Your mistake vault is clean! Use the Examiner Red Pen or log offline errors to track cognitive traps.'}
            </p>
          </div>
        )}
        </div>
      )}

      {/* MODAL 1: ADD MISTAKE MANUALLY */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-lg rounded-3xl bg-surface border border-theme shadow-2xl overflow-hidden p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-theme pb-3">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-5 h-5 text-amber-500" />
                <h3 className="text-base font-bold text-primary">Log Mistake to Exam Autopsy</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-theme-accent text-muted hover:text-primary transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateMistake} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-muted mb-1">Subject</label>
                  <select
                    value={formSubject}
                    onChange={(e) => setFormSubject(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    {subjects.length === 0 && <option value="Physics">Physics</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-muted mb-1">Topic Name</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    placeholder="e.g. Thermodynamics, Calculus"
                    className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Cognitive Error Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as CognitiveErrorCategory)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none font-semibold"
                >
                  <option value="careless_calc">🔢 Careless Calculation (Arithmetic / Units)</option>
                  <option value="misread_question">👓 Misread Question (Skipped word / condition)</option>
                  <option value="formula_confusion">📐 Formula Confusion (Wrong equation / signs)</option>
                  <option value="concept_gap">🧠 Conceptual Hole (Didn't understand rule)</option>
                  <option value="time_pressure">⏱️ Time Pressure Rush (Sloppy final steps)</option>
                  <option value="english_comprehension">📖 English / Language Comprehension Trap</option>
                  <option value="missing_question">❓ Missing / Skipped Question</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">The Question</label>
                <textarea
                  value={formQuestion}
                  onChange={(e) => setFormQuestion(e.target.value)}
                  placeholder="Paste or write the question that tripped you up..."
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-rose-700 dark:text-rose-400 mb-1">
                  💭 What Was I Thinking At That Moment? (Why did you take this step?)
                </label>
                <input
                  type="text"
                  value={formThoughtProcess}
                  onChange={(e) => setFormThoughtProcess(e.target.value)}
                  placeholder="e.g. I assumed pressure was constant and rushed into formula P1V1=P2V2..."
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-rose-300 dark:border-rose-900 text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">What You Did Wrong (Your Mistake)</label>
                <textarea
                  value={formAttempt}
                  onChange={(e) => setFormAttempt(e.target.value)}
                  placeholder="What was your incorrect step or misconception? (e.g. Forgot to convert to Kelvin)"
                  rows={2}
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div>
                <label className="block font-semibold text-muted mb-1">Correct Answer & Method</label>
                <textarea
                  value={formCorrectAnswer}
                  onChange={(e) => setFormCorrectAnswer(e.target.value)}
                  placeholder="What is the flawless correct answer and formula?"
                  rows={2}
                  required
                  className="w-full p-2.5 rounded-xl bg-surface-raised border border-theme text-primary focus:outline-none leading-relaxed"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-muted hover:text-primary font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary hover:opacity-90 text-white font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  Save to Mistake Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: INTERACTIVE CURE WORKOUT */}
      {isCureWorkoutActive && activeCureCandidates.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="w-full max-w-xl rounded-3xl bg-surface border border-theme shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            {workoutFinished ? (
              <div className="text-center py-6 space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 mx-auto">
                  <Trophy className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-primary">Cure Workout Finished!</h3>
                <p className="text-xs text-muted max-w-sm mx-auto">
                  You drilled all your active traps. Consistent daily re-testing permanently rewires your cognitive recall so you never make these mistakes on exam day!
                </p>
                <button
                  onClick={() => setIsCureWorkoutActive(false)}
                  className="px-6 py-2.5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Return to Mistake Vault
                </button>
              </div>
            ) : (
              <>
                {/* Workout Header */}
                <div className="flex items-center justify-between border-b border-theme pb-3 text-xs">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span className="font-bold text-primary">
                      Cure Drill: {activeWorkoutIndex + 1} of {activeCureCandidates.length}
                    </span>
                  </div>
                  <button
                    onClick={() => setIsCureWorkoutActive(false)}
                    className="p-1 rounded-lg hover:bg-theme-accent text-muted transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Current Item */}
                {(() => {
                  const current = activeCureCandidates[activeWorkoutIndex];
                  const meta = ERROR_CATEGORY_METADATA[current.errorCategory];

                  return (
                    <div className="space-y-4 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md bg-theme-accent text-primary font-bold text-[11px]">
                          {current.subjectName}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${meta.bgColor} ${meta.color} ${meta.borderColor}`}>
                          {meta.iconText} {meta.label}
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-surface-raised border border-theme">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                          Solve this question mentally or on rough paper:
                        </span>
                        <p className="text-sm font-serif font-bold text-primary leading-relaxed">
                          {current.question}
                        </p>
                      </div>

                      {showWorkoutAnswer ? (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-1">
                            <span className="font-bold text-[10px] uppercase text-emerald-700 dark:text-emerald-400 block">
                              Correct Solution:
                            </span>
                            <p className="font-sans leading-relaxed whitespace-pre-line">{current.correctAnswer}</p>
                            {current.notes && (
                              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pt-1 border-t border-emerald-500/20">
                                💡 {current.notes}
                              </p>
                            )}
                          </div>

                          <div className="pt-2 text-center">
                            <span className="text-xs font-semibold text-muted block mb-2">
                              Did you successfully avoid the previous trap?
                            </span>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleWorkoutAnswer(false)}
                                className="py-2.5 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-800 dark:text-rose-300 border border-rose-500/30 font-bold transition cursor-pointer active:scale-95"
                              >
                                Still Tripped Up (Reset Streak)
                              </button>
                              <button
                                onClick={() => handleWorkoutAnswer(true)}
                                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition shadow-sm cursor-pointer active:scale-95"
                              >
                                Solved Perfectly! (+1 Streak)
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-2">
                          <button
                            onClick={() => setShowWorkoutAnswer(true)}
                            className="w-full py-3 rounded-2xl bg-primary hover:opacity-90 text-white font-bold transition shadow-xs cursor-pointer active:scale-95 text-center"
                          >
                            Check Correct Solution
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      )}

      {/* Retest Mistakes Modal */}
      <RetestMistakesModal
        isOpen={isRetestModalOpen}
        onClose={() => setIsRetestModalOpen(false)}
        mistakes={mistakes}
        subjects={subjects}
        onSaveTestResult={onSaveTestResult}
        onCureMistakeSuccess={(mistakeId) => {
          recordMistakeAttempt(mistakeId, true);
        }}
      />

      {/* Wrong MCQ Deep Autopsy Modal (Option 10) */}
      <WrongMCQAutopsyModal
        isOpen={isWrongMCQModalOpen}
        onClose={() => setIsWrongMCQModalOpen(false)}
        subjects={subjects}
        onSaveMistakeSuccess={() => {
          // Handled via subscribeMistakes
        }}
        onAwardXP={onAwardXP}
      />

      {/* Cross-Topic Mistake Synthesizer Modal (Option 18) */}
      <CrossTopicMistakeSynthesizerModal
        isOpen={isCrossTopicModalOpen}
        onClose={() => setIsCrossTopicModalOpen(false)}
        mistakes={mistakes}
        subjects={subjects}
        initialTopicA={crossTopicInitialA}
        initialTopicB={crossTopicInitialB}
        onAddTo137Cycle={onAddTo137Cycle}
        onOpenExternalAIBridge={onOpenExternalAIBridge}
        onAwardXP={onAwardXP}
        onCureMistakesForTopics={(topicNames) => {
          // Mark attempts for mistakes in these topics
          const matching = mistakes.filter(m => 
            topicNames.some(tn => (m.topicName || '').trim().toLowerCase() === tn.trim().toLowerCase())
          );
          matching.forEach(m => recordMistakeAttempt(m.id, true));
        }}
      />

      {/* 3-Minute Active Recall Blurting & Diff Canvas Modal (Option 15) */}
      <BlurtingDiffCanvasModal
        isOpen={isBlurtingModalOpen}
        onClose={() => setIsBlurtingModalOpen(false)}
        subjects={subjects}
        initialSubjectName={blurtInitialSubject}
        initialTopicName={blurtInitialTopic}
        onAdd137RevisionCycle={onAddTo137Cycle}
        onAwardXP={onAwardXP}
      />
    </div>
  );
};
