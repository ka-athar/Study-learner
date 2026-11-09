import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  Brain, 
  Flame, 
  Clock, 
  Calendar, 
  Trophy, 
  Bot, 
  Settings, 
  ShieldAlert, 
  CheckSquare, 
  Layers, 
  Users, 
  Activity, 
  HardDrive, 
  Bell, 
  Swords, 
  Network, 
  ArrowRight, 
  CornerDownLeft,
  X,
  Languages,
  Zap,
  BookmarkCheck,
  FileCheck,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { ActiveTab, Subject } from '../types';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navigation' | 'Academic Retrieval' | 'Exam Prep' | 'Workspace & Settings' | 'Urdu & Language';
  icon: React.ReactNode;
  badge?: string;
  keywords?: string[];
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: ActiveTab) => void;
  subjects: Subject[];
  onSelectSubject?: (subjectId: string) => void;
  onToggleTheme?: () => void;
  onTriggerAutonomousPushTest?: () => void;
  onOpenRevisionBatchTriage?: () => void;
  onOpenMCQAutopsy?: () => void;
  onOpenBlurtingDiff?: () => void;
  onOpenCrossTopicSynthesizer?: () => void;
  onOpenSocraticViva?: () => void;
  onOpenDailyProgressSync?: () => void;
  onOpenPrintableDocket?: () => void;
  onOpenSeniorLocker?: () => void;
  onOpenExternalAIBridge?: () => void;
  onOpenVoiceFeynman?: () => void;
  onOpenKnowledgeTree?: () => void;
  onOpenPredictiveGrades?: () => void;
  onOpenExamAutomationModal?: () => void;
  onOpenWhatsAppModal?: () => void;
  onOpenEmailAgendaModal?: () => void;
  onOpenMaterialImport?: () => void;
  onOpenWorkspaceHub?: () => void;
  onOpenAudioStudy?: () => void;
  onOpenPrintKit?: () => void;
  onOpenQRScanner?: () => void;
  onOpenPreExamTriage?: () => void;
  onOpenGoogleChat?: () => void;
  onOpenNotificationDiagnostics?: () => void;
  onOpenTranscriptionStudio?: () => void;
  onSyncDataBridge?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setActiveTab,
  subjects,
  onSelectSubject,
  onToggleTheme,
  onTriggerAutonomousPushTest,
  onOpenPreExamTriage,
  onOpenRevisionBatchTriage,
  onOpenMCQAutopsy,
  onOpenBlurtingDiff,
  onOpenCrossTopicSynthesizer,
  onOpenSocraticViva,
  onOpenDailyProgressSync,
  onOpenPrintableDocket,
  onOpenSeniorLocker,
  onOpenExternalAIBridge,
  onOpenVoiceFeynman,
  onOpenKnowledgeTree,
  onOpenPredictiveGrades,
  onOpenExamAutomationModal,
  onOpenWhatsAppModal,
  onOpenEmailAgendaModal,
  onOpenGoogleChat,
  onOpenMaterialImport,
  onOpenWorkspaceHub,
  onOpenAudioStudy,
  onOpenPrintKit,
  onOpenQRScanner,
  onOpenNotificationDiagnostics,
  onOpenTranscriptionStudio,
  onSyncDataBridge
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global shortcut listener: Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open
          (window as any).__openCommandPalette?.();
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Build command items
  const commands: CommandItem[] = [
    // High-priority quick actions
    {
      id: 'study_cockpit',
      title: 'Unified Daily Study Cockpit',
      subtitle: 'Complete all-in-one focus loop: topic select, timer, active recall check & sign-off',
      category: 'Navigation',
      icon: <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />,
      badge: 'Unified Cockpit',
      keywords: ['cockpit', 'focus', 'timer', 'sprint', 'recall', 'blurt', 'sign hours'],
      action: () => {
        setActiveTab('study_cockpit');
        onClose();
      }
    },
    {
      id: 'notification_diagnostics',
      title: 'Notification Diagnostics & Alert Fix',
      subtitle: 'Test audio alarm, verify desktop push, and unblock browser permissions',
      category: 'Workspace & Settings',
      icon: <Bell className="w-4 h-4 text-amber-500" />,
      badge: 'Diagnostics',
      keywords: ['notification', 'push', 'alert', 'chime', 'sound', 'fix', 'permission', 'reminders'],
      action: () => {
        if (onOpenNotificationDiagnostics) {
          onOpenNotificationDiagnostics();
        }
        onClose();
      }
    },
    {
      id: 'transcription_studio',
      title: 'Voice & Audio Transcription Studio (Gemini Cook)',
      subtitle: 'Record voice explanations, Feynman viva, or audio files and cook with Gemini AI',
      category: 'Workspace & Settings',
      icon: <Flame className="w-4 h-4 text-orange-500" />,
      badge: '🔥 Gemini Cook',
      keywords: ['transcribe', 'voice', 'audio', 'record', 'cook', 'speech', 'microphone', 'dictation', 'feynman'],
      action: () => {
        if (onOpenTranscriptionStudio) {
          onOpenTranscriptionStudio();
        }
        onClose();
      }
    },
    {
      id: 'screen_link_sync',
      title: 'Link & Sync with Builder App / External Screen',
      subtitle: 'Instantly transfer all study sessions, syllabus edits, and active timer across screens',
      category: 'Workspace & Settings',
      icon: <Zap className="w-4 h-4 text-cyan-500" />,
      badge: 'Live Bridge',
      keywords: ['sync', 'link', 'builder', 'external', 'transfer', 'timer link', 'cross-screen', 'data transfer'],
      action: () => {
        if (onSyncDataBridge) {
          onSyncDataBridge();
        }
        onClose();
      }
    },
    {
      id: 'knowledge_refurbish',
      title: 'Knowledge Refurbishment Mode',
      subtitle: 'Untimed closed-book recall audited against syllabus criteria',
      category: 'Academic Retrieval',
      icon: <Brain className="w-4 h-4 text-amber-500" />,
      badge: 'New Criteria Protocol',
      keywords: ['recall', 'audit', 'refurbish', 'master sheet', 'weakness', 'criteria'],
      action: () => {
        setActiveTab('knowledge_refurbish');
        onClose();
      }
    },
    {
      id: '137_revision',
      title: '1-3-7 Spaced Revision Engine',
      subtitle: 'First-class Day 0, Day 1, Day 3, and Day 7 memory consolidation command center',
      category: 'Academic Retrieval',
      icon: <RotateCcw className="w-4 h-4 text-indigo-500 animate-spin-slow" />,
      badge: 'Core Priority',
      keywords: ['1-3-7', 'spaced repetition', 'ebbinghaus', 'day 1', 'day 3', 'day 7', 'retention', 'overdue revisions'],
      action: () => {
        setActiveTab('137_revision');
        onClose();
      }
    },
    {
      id: 'marks_recovery',
      title: 'Marks Recovery Engine',
      subtitle: 'Targeted recovery on exam weaknesses & historical pitfalls',
      category: 'Academic Retrieval',
      icon: <Flame className="w-4 h-4 text-rose-500" />,
      keywords: ['marks', 'recovery', 'weak topics', 'exam boost'],
      action: () => {
        setActiveTab('marks_recovery');
        onClose();
      }
    },
    {
      id: 'urdu_syllabus_parser',
      title: 'Urdu Syllabus & Subject Engine (اردو نصاب)',
      subtitle: 'Bilingual parser preserving native Urdu terminology and RTL layouts',
      category: 'Urdu & Language',
      icon: <Languages className="w-4 h-4 text-emerald-500" />,
      badge: 'Bilingual RTL',
      keywords: ['urdu', 'اردو', 'pakistan', 'islamiyat', 'bilingual', 'rtl'],
      action: () => {
        setActiveTab('syllabus');
        onClose();
      }
    },
    {
      id: 'autonomous_push_test',
      title: 'Trigger Autonomous Push Notification Test',
      subtitle: 'Verify 24/7 background VAPID push scheduler',
      category: 'Workspace & Settings',
      icon: <Bell className="w-4 h-4 text-indigo-500" />,
      badge: '24/7 VAPID',
      keywords: ['push', 'notification', 'background', 'cron', 'alerts', 'vapid'],
      action: () => {
        if (onTriggerAutonomousPushTest) {
          onTriggerAutonomousPushTest();
        }
        onClose();
      }
    },
    {
      id: 'dashboard',
      title: 'Flight Deck Dashboard',
      subtitle: 'Daily agenda, focus radar, and academic runway metrics',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-blue-500" />,
      keywords: ['home', 'dashboard', 'stats', 'runway'],
      action: () => {
        setActiveTab('dashboard');
        onClose();
      }
    },
    {
      id: 'syllabus',
      title: 'Syllabus Tracker & Board Sync',
      subtitle: 'Complete curriculum matrix, chapters, and topic completion',
      category: 'Navigation',
      icon: <BookOpen className="w-4 h-4 text-blue-500" />,
      keywords: ['curriculum', 'chapters', 'topics', 'status', 'syllabus'],
      action: () => {
        setActiveTab('syllabus');
        onClose();
      }
    },
    {
      id: 'gemini_notebook',
      title: 'Gemini AI Study Notebook',
      subtitle: 'Interactive AI tutor, deep summaries, and concept breakdown',
      category: 'Academic Retrieval',
      icon: <Bot className="w-4 h-4 text-purple-500" />,
      keywords: ['ai', 'gemini', 'notes', 'summaries', 'tutor'],
      action: () => {
        setActiveTab('gemini_notebook');
        onClose();
      }
    },
    {
      id: 'boss_battle',
      title: 'Examiner Boss Battle Arena',
      subtitle: 'Gamified high-stakes mock exam simulations with health bars',
      category: 'Exam Prep',
      icon: <Swords className="w-4 h-4 text-red-500" />,
      keywords: ['boss', 'exam', 'battle', 'game', 'quiz'],
      action: () => {
        setActiveTab('boss_battle');
        onClose();
      }
    },
    {
      id: 'knowledge_graph',
      title: 'Interactive Knowledge Graph',
      subtitle: 'Visual node relationships and inter-chapter prerequisites',
      category: 'Academic Retrieval',
      icon: <Network className="w-4 h-4 text-teal-500" />,
      keywords: ['graph', 'mind map', 'nodes', 'network', 'connections'],
      action: () => {
        setActiveTab('knowledge_graph');
        onClose();
      }
    },
    {
      id: 'examiner_red_pen',
      title: 'Examiner Red Pen Audit',
      subtitle: 'Rigorous critique marking scheme and deductions',
      category: 'Exam Prep',
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
      keywords: ['red pen', 'audit', 'critique', 'examiner', 'marking'],
      action: () => {
        setActiveTab('examiner_red_pen');
        onClose();
      }
    },
    {
      id: 'flashcards',
      title: 'Spaced Repetition Flashcards',
      subtitle: 'Leitner & SM-2 memory retention intervals',
      category: 'Academic Retrieval',
      icon: <Layers className="w-4 h-4 text-amber-500" />,
      keywords: ['flashcards', 'sm2', 'retention', 'leitner', 'cards'],
      action: () => {
        setActiveTab('flashcards');
        onClose();
      }
    },
    {
      id: 'timer',
      title: 'Zen Sprint & Focus Timer',
      subtitle: 'Pomodoro intervals with binaural beats & focus audio',
      category: 'Navigation',
      icon: <Clock className="w-4 h-4 text-emerald-500" />,
      keywords: ['timer', 'pomodoro', 'focus', 'zen', 'sprint'],
      action: () => {
        setActiveTab('timer');
        onClose();
      }
    },
    {
      id: 'personal_bests',
      title: 'Personal Bests & Academic Milestones',
      subtitle: 'Self-comparison metrics across 14 academic dimensions and verified achievements',
      category: 'Exam Prep',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      badge: 'NEW PB',
      keywords: ['personal bests', 'milestones', 'records', 'highest score', 'pb', 'streak', 'achievement'],
      action: () => {
        setActiveTab('personal_bests');
        onClose();
      }
    },
    {
      id: 'things_you_keep_forgetting',
      title: 'Things You Keep Forgetting (Recurring Weaknesses)',
      subtitle: 'Targeted remediation radar for concepts repeatedly missed across tests',
      category: 'Exam Prep',
      icon: <BookmarkCheck className="w-4 h-4 text-rose-500" />,
      badge: 'FIX',
      keywords: ['things i keep forgetting', 'recurring weaknesses', 'blind spots', 'fix weakness', 'traps'],
      action: () => {
        setActiveTab('personal_bests');
        onClose();
      }
    },
    {
      id: 'planner',
      title: 'Study Planner & Timetable',
      subtitle: 'Automated revision schedule and daily targets',
      category: 'Navigation',
      icon: <Calendar className="w-4 h-4 text-sky-500" />,
      keywords: ['plan', 'schedule', 'timetable', 'calendar', 'targets'],
      action: () => {
        setActiveTab('planner');
        onClose();
      }
    },
    {
      id: 'toggle_theme',
      title: 'Toggle Color Theme / Dark Mode',
      subtitle: 'Switch between light paper and eye-comfort dark aesthetics',
      category: 'Workspace & Settings',
      icon: <Zap className="w-4 h-4 text-amber-400" />,
      keywords: ['theme', 'dark', 'light', 'mode', 'color'],
      action: () => {
        if (onToggleTheme) onToggleTheme();
        onClose();
      }
    },
    {
      id: 'emergency_24h_cram_triage',
      title: '🚨 Emergency 24-Hour Pre-Exam Triage Desk & Cram Sheet',
      subtitle: 'High-stakes triage matrix, formula traps from Mistake Vault, and printable 1-page A4 dossier',
      category: 'Exam Prep',
      icon: <Zap className="w-4 h-4 text-rose-500 fill-current" />,
      badge: '24h Triage',
      keywords: ['cram', 'emergency', 'triage', '24h', 'exam', 'cheat sheet', 'formula', 'print', 'a4', 'primer', 'cram desk'],
      action: () => {
        if (onOpenPreExamTriage) onOpenPreExamTriage();
        else setActiveTab('calendar');
        onClose();
      }
    },
    {
      id: 'option_5_batch_triage',
      title: 'Option 5: 1-3-7 Revision Batch Triage',
      subtitle: 'Swipe or rapid-key triage all Day 1, 3, and 7 spaced revision tasks due today',
      category: 'Exam Prep',
      icon: <RotateCcw className="w-4 h-4 text-indigo-500 animate-spin-slow" />,
      badge: 'Option 5',
      keywords: ['option 5', 'batch', 'triage', '137', 'spaced', 'cards', 'rapid'],
      action: () => {
        if (onOpenRevisionBatchTriage) onOpenRevisionBatchTriage();
        else setActiveTab('137_revision');
        onClose();
      }
    },
    {
      id: 'option_10_mcq_autopsy',
      title: 'Option 10: Wrong MCQ Distractor Autopsy',
      subtitle: 'Paste any missed question & analyze trap mechanisms, distractor fallacies, and cognitive failure vectors',
      category: 'Exam Prep',
      icon: <BookmarkCheck className="w-4 h-4 text-rose-500" />,
      badge: 'Option 10',
      keywords: ['option 10', 'mcq', 'autopsy', 'wrong question', 'paste', 'distractor', 'careless', 'trap'],
      action: () => {
        if (onOpenMCQAutopsy) onOpenMCQAutopsy();
        else setActiveTab('mistake_vault');
        onClose();
      }
    },
    {
      id: 'option_15_blurting_diff',
      title: 'Option 15: 3-Minute Blurting & Recall Diff Canvas',
      subtitle: 'Active recall brain-dump with side-by-side rubric diffing and blind-spot detection',
      category: 'Exam Prep',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      badge: 'Option 15',
      keywords: ['option 15', 'blurting', 'diff', 'recall', 'canvas', 'active recall', 'brain dump'],
      action: () => {
        if (onOpenBlurtingDiff) onOpenBlurtingDiff();
        else setActiveTab('blurt_recall');
        onClose();
      }
    },
    {
      id: 'option_18_cross_topic',
      title: 'Option 18: Cross-Topic Mistake Synthesizer',
      subtitle: 'Cross-communicate and bridge compound misconceptions between your top mistake topics',
      category: 'Exam Prep',
      icon: <Network className="w-4 h-4 text-emerald-500" />,
      badge: 'Option 18',
      keywords: ['option 18', 'cross topic', 'mesh', 'synthesizer', 'bridge', 'vault', 'compound'],
      action: () => {
        if (onOpenCrossTopicSynthesizer) onOpenCrossTopicSynthesizer();
        else setActiveTab('mistake_vault');
        onClose();
      }
    },
    {
      id: 'option_28_socratic_viva',
      title: 'Option 28: Interactive Socratic Blind-Spot Viva',
      subtitle: 'Step-by-step viva sandbox: Premise defense, boundary stress-testing & cognitive resilience verdict',
      category: 'Exam Prep',
      icon: <Brain className="w-4 h-4 text-purple-500" />,
      badge: 'Option 28',
      keywords: ['option 28', 'socratic', 'viva', 'blind spot', 'oral', 'sandbox', 'interrogation'],
      action: () => {
        if (onOpenSocraticViva) onOpenSocraticViva();
        else setActiveTab('mistake_vault');
        onClose();
      }
    },
    {
      id: 'daily_progress_sync',
      title: 'Sync Daily Hours & Progress (QR / PIN / Email)',
      subtitle: 'Transfer delivered study time, sessions, and streak across iPad, phone, or laptop without logging in',
      category: 'Workspace & Settings',
      icon: <Clock className="w-4 h-4 text-emerald-500" />,
      badge: 'Sync Hours',
      keywords: ['hours', 'transfer', 'qr', 'pin', 'ipad', 'email', 'progress', 'daily sync'],
      action: () => {
        if (onOpenDailyProgressSync) onOpenDailyProgressSync();
        onClose();
      }
    },
    {
      id: 'printable_docket',
      title: 'Distraction-Free Printable A4 Study Docket',
      subtitle: 'Generate printable offline study docket to study deeply away from screens',
      category: 'Academic Retrieval',
      icon: <BookOpen className="w-4 h-4 text-emerald-600" />,
      badge: 'Offline A4',
      keywords: ['printable', 'a4', 'docket', 'offline', 'paper', 'worksheet'],
      action: () => {
        if (onOpenPrintableDocket) onOpenPrintableDocket();
        onClose();
      }
    },
    {
      id: 'senior_locker',
      title: 'Senior Resource Locker',
      subtitle: 'Access senior topper notes, past exam trap formulas, and annotated high-yield cheat sheets',
      category: 'Academic Retrieval',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      badge: 'Topper Kit',
      keywords: ['senior', 'locker', 'topper', 'notes', 'past paper', 'cheat sheet'],
      action: () => {
        if (onOpenSeniorLocker) onOpenSeniorLocker();
        onClose();
      }
    },
    {
      id: 'external_ai_bridge',
      title: 'External AI Prompt Bridge (Claude, ChatGPT, Gemini)',
      subtitle: 'Option 3: Copy pre-formatted deep academic prompts into free web Claude or ChatGPT',
      category: 'Academic Retrieval',
      icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
      badge: '$0 Free Web',
      keywords: ['claude', 'chatgpt', 'gemini', 'prompts', 'external', 'bridge', 'option 3'],
      action: () => {
        if (onOpenExternalAIBridge) onOpenExternalAIBridge();
        onClose();
      }
    },
    {
      id: 'voice_feynman',
      title: 'Voice Feynman Oral Defense Exam',
      subtitle: 'Verbally articulate concepts against an interactive Socratic examiner',
      category: 'Exam Prep',
      icon: <Brain className="w-4 h-4 text-rose-500" />,
      badge: 'Voice Oral',
      keywords: ['voice', 'feynman', 'oral', 'defense', 'speaking', 'explain'],
      action: () => {
        if (onOpenVoiceFeynman) onOpenVoiceFeynman();
        onClose();
      }
    },
    {
      id: 'knowledge_tree',
      title: 'Visual Knowledge Tree & Mind Map',
      subtitle: 'Interactive prerequisite hierarchy, node mastery, and blind-spot graph',
      category: 'Academic Retrieval',
      icon: <Network className="w-4 h-4 text-teal-500" />,
      badge: 'Mind Map',
      keywords: ['tree', 'mind map', 'nodes', 'prerequisites', 'hierarchy'],
      action: () => {
        if (onOpenKnowledgeTree) onOpenKnowledgeTree();
        onClose();
      }
    },
    {
      id: 'predictive_grades',
      title: 'Predictive Grade Simulator',
      subtitle: 'Forecast final exam marks based on syllabus completion pace and mistake cure rates',
      category: 'Exam Prep',
      icon: <Flame className="w-4 h-4 text-blue-500" />,
      badge: 'Simulator',
      keywords: ['grade', 'predictive', 'simulator', 'forecast', 'marks', 'target'],
      action: () => {
        if (onOpenPredictiveGrades) onOpenPredictiveGrades();
        onClose();
      }
    },
    {
      id: 'exam_automation',
      title: '24/7 Automated Exam Countdown & Alerts',
      subtitle: 'Configure automated background dispatches via email, WhatsApp, and push notifications',
      category: 'Workspace & Settings',
      icon: <Bell className="w-4 h-4 text-rose-500" />,
      badge: '24/7 Alerts',
      keywords: ['alerts', 'countdown', 'automation', 'exam date', 'dispatches'],
      action: () => {
        if (onOpenExamAutomationModal) onOpenExamAutomationModal();
        onClose();
      }
    },
    {
      id: 'whatsapp_coach',
      title: 'WhatsApp Study Companion',
      subtitle: 'Send daily study flight plans to your WhatsApp and chat with study companion',
      category: 'Workspace & Settings',
      icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
      badge: 'WhatsApp',
      keywords: ['whatsapp', 'coach', 'chat', 'mobile alerts'],
      action: () => {
        if (onOpenWhatsAppModal) onOpenWhatsAppModal();
        onClose();
      }
    },
    {
      id: 'email_agenda',
      title: 'Email Daily Study Flight Plan',
      subtitle: 'Schedule automated morning 7:30 AM briefings with today\'s revision queue',
      category: 'Workspace & Settings',
      icon: <Bell className="w-4 h-4 text-blue-500" />,
      badge: 'Morning Briefing',
      keywords: ['email', 'agenda', 'morning', 'briefing', 'flight plan'],
      action: () => {
        if (onOpenEmailAgendaModal) onOpenEmailAgendaModal();
        onClose();
      }
    },
    {
      id: 'google_chat_notifications',
      title: 'Google Chat Study Notifications (Done vs Not Done Audit)',
      subtitle: 'Dispatch structured audit cards of completed topics vs pending goals to your Google Chat space',
      category: 'Workspace & Settings',
      icon: <MessageSquare className="w-4 h-4 text-emerald-500" />,
      badge: 'Google Chat',
      keywords: ['google chat', 'chat', 'notification', 'audit', 'done', 'pending', 'webhook', 'spaces'],
      action: () => {
        if (onOpenGoogleChat) onOpenGoogleChat();
        onClose();
      }
    },
    {
      id: 'study_habits',
      title: 'Study Habits & Analytics Progress',
      subtitle: 'Comprehensive 84-day heatmap, consistency streaks, and hour distributions',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-emerald-500" />,
      keywords: ['habits', 'heatmap', 'analytics', 'hours', 'streak'],
      action: () => {
        setActiveTab('study_habits');
        onClose();
      }
    },
    {
      id: 'missed_work',
      title: 'Missed Work Recovery',
      subtitle: 'Catch up on overdue tasks, assignments, and test preparation deadlines',
      category: 'Navigation',
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
      keywords: ['missed', 'overdue', 'catch up', 'backlog'],
      action: () => {
        setActiveTab('missed_work');
        onClose();
      }
    },
    {
      id: 'assignments',
      title: 'Assignments & Homework Tracker',
      subtitle: 'Manage upcoming homework, coursework, and school deadlines',
      category: 'Navigation',
      icon: <CheckSquare className="w-4 h-4 text-blue-500" />,
      keywords: ['assignments', 'homework', 'projects', 'deadlines'],
      action: () => {
        setActiveTab('assignments');
        onClose();
      }
    },
    {
      id: 'classroom',
      title: 'Google Classroom Hub',
      subtitle: 'Sync course streams, announcements, and course materials',
      category: 'Navigation',
      icon: <Layers className="w-4 h-4 text-emerald-500" />,
      keywords: ['classroom', 'courses', 'stream', 'materials'],
      action: () => {
        setActiveTab('classroom');
        onClose();
      }
    },
    {
      id: 'groups',
      title: 'Collaborative Study Circles',
      subtitle: 'Group study rooms, shared syllabus targets, and AI facilitator',
      category: 'Navigation',
      icon: <Users className="w-4 h-4 text-amber-500" />,
      keywords: ['groups', 'circles', 'peers', 'collaborative'],
      action: () => {
        setActiveTab('groups');
        onClose();
      }
    },
    {
      id: 'tests',
      title: 'Tests & Mock Exam Simulator',
      subtitle: 'Simulate full board examination conditions with strict timers and mark schemes',
      category: 'Exam Prep',
      icon: <FileCheck className="w-4 h-4 text-primary" />,
      keywords: ['tests', 'mocks', 'exam simulator', 'past papers'],
      action: () => {
        setActiveTab('tests');
        onClose();
      }
    },
    {
      id: 'blurt_recall',
      title: 'Blurt Recall Active Arena',
      subtitle: 'Rapid timed closed-book active recall brain dump with instant syllabus audit',
      category: 'Exam Prep',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
      keywords: ['blurt', 'active recall', 'brain dump'],
      action: () => {
        setActiveTab('blurt_recall');
        onClose();
      }
    },
    {
      id: 'paper_auto_forcing',
      title: 'Exam Paper Auto-Forcing Mode',
      subtitle: 'Forced past paper execution schedule with progressive difficulty pacing',
      category: 'Exam Prep',
      icon: <ShieldAlert className="w-4 h-4 text-rose-500" />,
      keywords: ['forcing', 'auto-forcing', 'papers', 'schedule'],
      action: () => {
        setActiveTab('paper_auto_forcing');
        onClose();
      }
    },
    {
      id: 'mistake_vault',
      title: 'Exam Autopsy & Mistake Vault',
      subtitle: 'Track cognitive error classifications, careless slips, and 100% cure rate drills',
      category: 'Exam Prep',
      icon: <BookmarkCheck className="w-4 h-4 text-amber-500" />,
      keywords: ['mistake', 'vault', 'autopsy', 'careless', 'cure rate'],
      action: () => {
        setActiveTab('mistake_vault');
        onClose();
      }
    },
    {
      id: 'vaults',
      title: 'Academic Storage Vaults',
      subtitle: 'Subject resource lockers, past paper files, and formula sheets',
      category: 'Navigation',
      icon: <Layers className="w-4 h-4 text-stone-500" />,
      keywords: ['vaults', 'storage', 'files', 'resources'],
      action: () => {
        setActiveTab('vaults');
        onClose();
      }
    },
    {
      id: 'gamification',
      title: 'RPG Quests & Academic Leveling',
      subtitle: 'Earn study XP, level up academic ranks, and unlock study gear',
      category: 'Navigation',
      icon: <Trophy className="w-4 h-4 text-amber-500" />,
      keywords: ['rpg', 'quests', 'xp', 'level', 'gamification'],
      action: () => {
        setActiveTab('gamification');
        onClose();
      }
    },
    {
      id: 'virtual_room',
      title: 'Virtual Study Room & Lo-Fi Lounge',
      subtitle: 'Distraction-free ambient study room with binaural soundscapes',
      category: 'Navigation',
      icon: <Clock className="w-4 h-4 text-indigo-500" />,
      keywords: ['study room', 'lo-fi', 'ambient', 'virtual'],
      action: () => {
        setActiveTab('virtual_room');
        onClose();
      }
    },
    {
      id: 'progress',
      title: 'Overall Academic Progress & Velocity',
      subtitle: 'Curriculum completion percentages, weekly hours, and exam readiness',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-blue-500" />,
      keywords: ['progress', 'velocity', 'completion', 'analytics'],
      action: () => {
        setActiveTab('progress');
        onClose();
      }
    },
    {
      id: 'tutor',
      title: 'Socratic AI Tutor',
      subtitle: 'Deep conceptual explanations, step-by-step math breakdowns, and exam tips',
      category: 'Navigation',
      icon: <Bot className="w-4 h-4 text-purple-500" />,
      keywords: ['tutor', 'ai tutor', 'socratic', 'explain'],
      action: () => {
        setActiveTab('tutor');
        onClose();
      }
    },
    {
      id: 'activity',
      title: 'Academic Activity & Audit Trail',
      subtitle: 'Historical timeline of completed sessions, test scores, and revisions',
      category: 'Navigation',
      icon: <Activity className="w-4 h-4 text-stone-500" />,
      keywords: ['activity', 'log', 'history', 'timeline'],
      action: () => {
        setActiveTab('activity');
        onClose();
      }
    },
    {
      id: 'data_backup',
      title: 'Data Portability & Encrypted Cloud Backup',
      subtitle: 'Download complete offline encrypted JSON snapshots or restore data',
      category: 'Workspace & Settings',
      icon: <HardDrive className="w-4 h-4 text-emerald-600" />,
      keywords: ['backup', 'restore', 'export', 'data', 'json'],
      action: () => {
        setActiveTab('data_backup');
        onClose();
      }
    },
    {
      id: 'calendar',
      title: 'Unified Academic Calendar',
      subtitle: 'Interactive schedule, exam milestones, and Google Calendar sync',
      category: 'Navigation',
      icon: <Calendar className="w-4 h-4 text-sky-500" />,
      keywords: ['calendar', 'schedule', 'timetable'],
      action: () => {
        setActiveTab('calendar');
        onClose();
      }
    },
    {
      id: 'revision',
      title: 'Revision Ledger & Queue',
      subtitle: 'All scheduled revisions and historical topic retention metrics',
      category: 'Navigation',
      icon: <RotateCcw className="w-4 h-4 text-amber-500" />,
      keywords: ['revision', 'ledger', 'queue'],
      action: () => {
        setActiveTab('revision');
        onClose();
      }
    },
    {
      id: 'settings',
      title: 'Workspace Settings & Notification Profiles',
      subtitle: 'Config 24/7 background email, WhatsApp & push dispatches',
      category: 'Workspace & Settings',
      icon: <Settings className="w-4 h-4 text-stone-500" />,
      keywords: ['settings', 'config', 'profile', 'notifications', 'email'],
      action: () => {
        setActiveTab('settings');
        onClose();
      }
    }
  ];

  // Append user's subjects as direct jump commands
  subjects.forEach(sub => {
    const isUrdu = sub.language === 'ur' || /[\u0600-\u06FF]/.test(sub.name);
    commands.push({
      id: `subject-${sub.id}`,
      title: `Jump to Subject: ${sub.name}`,
      subtitle: `${sub.chapters?.length || 0} chapters • ${isUrdu ? 'اردو نصاب' : 'English Curriculum'}`,
      category: isUrdu ? 'Urdu & Language' : 'Navigation',
      icon: <span className="text-sm">{sub.icon || (isUrdu ? '🇵🇰' : '📚')}</span>,
      badge: isUrdu ? 'اردو' : undefined,
      keywords: [sub.name.toLowerCase(), 'subject', isUrdu ? 'urdu' : 'english'],
      action: () => {
        setActiveTab('syllabus');
        if (onSelectSubject) {
          onSelectSubject(sub.id);
        }
        onClose();
      }
    });
  });

  // Filter commands by query
  const cleanQuery = query.trim().toLowerCase();
  const filtered = cleanQuery === '' 
    ? commands 
    : commands.filter(cmd => {
        const inTitle = cmd.title.toLowerCase().includes(cleanQuery);
        const inSubtitle = cmd.subtitle?.toLowerCase().includes(cleanQuery) || false;
        const inCategory = cmd.category.toLowerCase().includes(cleanQuery);
        const inKeywords = cmd.keywords?.some(k => k.includes(cleanQuery)) || false;
        return inTitle || inSubtitle || inCategory || inKeywords;
      });

  // Clamp selection
  useEffect(() => {
    setSelectedIndex(0);
  }, [cleanQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (filtered.length || 1)) % (filtered.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="command-palette-backdrop"
      className="fixed inset-0 z-500 bg-stone-950/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        id="command-palette-modal"
        className="w-full max-w-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-stone-900 dark:text-stone-100 animate-scale-up"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900/50">
          <Search className="w-5 h-5 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, tool name, or subject... (e.g. Urdu, Refurbish, Boss, Timer)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent border-none text-sm sm:text-base text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-none focus:ring-0"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-mono font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 rounded-md border border-stone-300 dark:border-stone-700">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Command List */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No tools, subjects, or actions found for "{query}"</p>
              <p className="text-xs text-stone-500 mt-1">Try searching for "Refurbish", "Urdu", "Boss", or "Timer"</p>
            </div>
          ) : (
            filtered.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition ${
                    isSelected
                      ? 'bg-amber-500/15 dark:bg-amber-500/20 text-stone-900 dark:text-stone-100'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800/60 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                      isSelected 
                        ? 'bg-amber-500 text-stone-950 border-amber-500' 
                        : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}>
                      {cmd.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs sm:text-sm truncate">
                          {cmd.title}
                        </span>
                        {cmd.badge && (
                          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 whitespace-nowrap">
                            {cmd.badge}
                          </span>
                        )}
                      </div>
                      {cmd.subtitle && (
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {cmd.subtitle}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="hidden md:inline-block text-[10px] uppercase font-mono tracking-wider text-stone-400">
                      {cmd.category}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-100/70 dark:bg-stone-950/60 border-t border-stone-200 dark:border-stone-800 text-[11px] text-stone-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-[10px] font-mono">↵</kbd>
              <span>to open</span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono text-stone-400">
            <span>Global Palette</span>
            <span>•</span>
            <span>28+ Tools</span>
          </div>
        </div>
      </div>
    </div>
  );
};
