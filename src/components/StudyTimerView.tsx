import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Square, 
  Clock, 
  BookOpen, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  X, 
  Headphones, 
  Eye, 
  EyeOff, 
  Mail, 
  Send, 
  Check, 
  Loader2, 
  Calendar,
  AlertCircle,
  Timer,
  Upload,
  Camera,
  FileText,
  Zap,
  ArrowRight,
  Maximize2,
  Minimize2,
  Trash2,
  Award,
  Layers,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  CheckCheck,
  Bell,
  Coffee,
  Mic,
  MicOff,
  Languages,
  Palette,
  MessageSquare,
  Edit3,
  Target,
  AlertTriangle,
  Flame,
  Plus,
  CheckSquare,
  Printer
} from 'lucide-react';
import { 
  Subject, 
  StudySession, 
  StudyPlan,
  UserProfile, 
  UserNote, 
  ActivityLog, 
  RevisionItem, 
  TopicStatus, 
  BlurtRecallEvaluation,
  CognitiveErrorCategory
} from '../types';
import { openStudyKitPrintWindow } from '../lib/studyKitExportService';
import { apiGenerateBlurtPrompt, apiEvaluateBlurtRecall } from '../lib/aiApi';
import { compressImageFile } from '../lib/base64Utils';
import { addMistake } from '../lib/mistakeVaultStorage';
import { recordTopicRecallOutcome } from '../lib/retentionGraphStorage';
import { generateCompletedWorkWhatsAppMessage, buildWhatsAppDirectUrl } from '../lib/whatsappHelper';
import { calculate137Milestones } from '../lib/spacedRevisionEngine';
import { TargetedRemediationDrillModal } from './TargetedRemediationDrillModal';
import { 
  sendStudySessionEmail, 
  sendDailyCompletedWorkEmail, 
  getOrRequestGmailToken, 
  getCachedGmailToken 
} from '../lib/gmailService';
import { getActiveUserEmail } from '../lib/db';
import { transferSingleTaskToGoogleTasks, isItemTransferredToGoogleTasks } from '../lib/googleTasksService';
import { SbbmAnswerSheetModal } from './SbbmAnswerSheetModal';
import { SBBMCrest } from './SBBMCrest';
import { persistRunningTimer, getPersistedTimer, clearRunningTimer } from '../lib/globalTimerService';

interface StudyTimerViewProps {
  subjects: Subject[];
  initialSubject?: string;
  initialChapter?: string;
  initialTopic?: string;
  initialDurationMinutes?: number;
  onSaveSession: (session: Omit<StudySession, 'id'>) => void;
  onAddTo137Cycle?: (params: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    sloCode?: string;
    sloName?: string;
    studyDate?: string;
    timeSpentMinutes?: number;
    notes?: string;
  }) => void;
  userProfile?: UserProfile | null;
  sessions?: StudySession[];
  user?: any;
  notes?: UserNote[];
  onLogActivity?: (log: Omit<ActivityLog, 'id' | 'userId'>) => Promise<void>;
  onSaveRevision?: (rev: Omit<RevisionItem, 'id' | 'userId'>) => Promise<void>;
  onUpdateTopicStatus?: (subjectName: string, topicName: string, status: TopicStatus) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
  onOpenZenSprint?: (subjectName: string, topicName: string) => void;
  onOpenCheatSheet?: (subjectName: string, topicName: string) => void;
  plans?: StudyPlan[];
}

// Subtle entrance animation variants for immersive focus experience
const timerEntranceContainerVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.995 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.45,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.07,
      delayChildren: 0.03
    }
  }
};

const timerEntranceItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.16, 1, 0.3, 1]
    }
  }
};

export const StudyTimerView: React.FC<StudyTimerViewProps> = ({
  subjects,
  initialSubject,
  initialChapter,
  initialTopic,
  initialDurationMinutes,
  onSaveSession,
  onAddTo137Cycle,
  userProfile = null,
  sessions = [],
  plans = [],
  user = null,
  notes = [],
  onLogActivity,
  onSaveRevision,
  onUpdateTopicStatus,
  onNavigateTab,
  onOpenZenSprint,
  onOpenCheatSheet
}) => {
  // Mode toggle: 4 Engine Options (MCQ Pacer, Chapter Sprint, Blurt Studio, Rupex Locker) vs Focus Timer
  const [activeMode, setActiveMode] = useState<'timer' | 'chapter_sprint' | 'blurt' | 'mcq_pacer' | 'rupex_locker'>('mcq_pacer');
  const [isFullscreenFocus, setIsFullscreenFocus] = useState<boolean>(false);

  // Overall Board Exam Pressure Pacing Timer State (Option 1)
  const [examPressureType, setExamPressureType] = useState<'mcq' | 'short_question' | 'long_question' | 'mixed_board'>('mcq');

  // MCQ Exam Pressure Pacing Timer State
  const [mcqTotalCount, setMcqTotalCount] = useState<number>(1);
  const [mcqSecondsPerQuestion, setMcqSecondsPerQuestion] = useState<number>(21.5); // 21.5s benchmark as requested
  const [mcqBufferSeconds, setMcqBufferSeconds] = useState<number>(2); // 1, 2, or 3s buffer (strictly max 3s)
  const [mcqCurrentIndex, setMcqCurrentIndex] = useState<number>(1);
  const [mcqQuestionSecondsLeft, setMcqQuestionSecondsLeft] = useState<number>(21.5);
  const [mcqIsActive, setMcqIsActive] = useState<boolean>(false);
  const [mcqIsPaused, setMcqIsPaused] = useState<boolean>(false);
  const [mcqIsBufferActive, setMcqIsBufferActive] = useState<boolean>(false);
  const [mcqBufferSecondsLeft, setMcqBufferSecondsLeft] = useState<number>(2);
  const [mcqAnswers, setMcqAnswers] = useState<Record<number, string>>({});
  const [mcqQuestionTimes, setMcqQuestionTimes] = useState<Record<number, number>>({});
  const [mcqIsFinished, setMcqIsFinished] = useState<boolean>(false);
  const [mcqTotalElapsedSeconds, setMcqTotalElapsedSeconds] = useState<number>(0);
  const [mcqAudioChimeEnabled, setMcqAudioChimeEnabled] = useState<boolean>(true);
  const [mcqSelectedSubject, setMcqSelectedSubject] = useState<string>(initialSubject || subjects[0]?.name || '');
  const [mcqSelectedChapter, setMcqSelectedChapter] = useState<string>(initialChapter || subjects[0]?.chapters[0]?.name || '');

  // Short Question (SQ) Exam Pressure Pacer State
  const [sqTotalCount, setSqTotalCount] = useState<number>(5);
  const [sqMinutesPerQuestion, setSqMinutesPerQuestion] = useState<number>(2); // 2m quick mode preset as requested!
  const [sqCurrentIndex, setSqCurrentIndex] = useState<number>(1);
  const [sqSecondsLeft, setSqSecondsLeft] = useState<number>(120); // 2 mins = 120s
  const [sqAnswersText, setSqAnswersText] = useState<Record<number, string>>({});
  const [sqAudioRecordings, setSqAudioRecordings] = useState<Record<number, { isRecorded: boolean; duration: number }>>({});

  // Long Question (LQ) Exam Pressure Pacer State
  const [lqTotalCount, setLqTotalCount] = useState<number>(2);
  const [lqMinutesPerQuestion, setLqMinutesPerQuestion] = useState<number>(15); // 15m quick mode preset as requested!
  const [lqCurrentIndex, setLqCurrentIndex] = useState<number>(1);
  const [lqSecondsLeft, setLqSecondsLeft] = useState<number>(900); // 15 mins = 900s
  const [lqAnswersText, setLqAnswersText] = useState<Record<number, string>>({});
  const [lqAudioRecordings, setLqAudioRecordings] = useState<Record<number, { isRecorded: boolean; duration: number }>>({});
  const [lqMilestones, setLqMilestones] = useState<Record<number, { intro: boolean; derivation: boolean; diagram: boolean; units: boolean }>>({});

  // Live Voice Recording State for Verbal Answers
  const [isExamAudioRecording, setIsExamAudioRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  // SBBM Answer Sheet Modal State
  const [isAnswerSheetModalOpen, setIsAnswerSheetModalOpen] = useState<boolean>(false);

  // Rupex Rubric Locker & Saved Schemes (Option 4)
  const [savedRupexList, setSavedRupexList] = useState<Array<{
    id: string;
    name: string;
    subjectName: string;
    chapterName?: string;
    base64: string;
    mimeType: string;
    previewUrl: string;
    sizeFormatted: string;
    uploadedAt: string;
  }>>(() => {
    try {
      const raw = localStorage.getItem('studyflow_rupex_vault_v1');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [isRupexLockerOpen, setIsRupexLockerOpen] = useState<boolean>(false);

  // Chapter & Multi-Chapter Sprint state
  const [chapterScope, setChapterScope] = useState<'single' | 'multi'>('single');
  const [selectedChapterSprintSubject, setSelectedChapterSprintSubject] = useState<string>(
    initialSubject || subjects[0]?.name || ''
  );
  const selectedSprintSubject = subjects.find(s => s.name === selectedChapterSprintSubject) || subjects[0];
  const [selectedSingleChapterName, setSelectedSingleChapterName] = useState<string>(
    initialChapter || selectedSprintSubject?.chapters[0]?.name || ''
  );
  const [selectedMultiChapterNames, setSelectedMultiChapterNames] = useState<string[]>(() => {
    const firstSub = subjects.find(s => s.name === (initialSubject || subjects[0]?.name));
    return firstSub?.chapters.slice(0, 2).map(c => c.name) || [];
  });
  const [chapterSprintGoal, setChapterSprintGoal] = useState<'test' | 'revision' | 'past_papers' | 'deep_study'>('revision');

  // Rupex / Rubric upload state for AI Blender
  const [rubricFile, setRubricFile] = useState<{
    id: string;
    name: string;
    base64: string;
    mimeType: string;
    previewUrl: string;
    sizeFormatted: string;
  } | null>(null);
  const rubricInputRef = useRef<HTMLInputElement>(null);

  // Topic selection state
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>(
    initialSubject || subjects[0]?.name || ''
  );
  const selectedSubject = subjects.find(s => s.name === selectedSubjectName) || subjects[0];

  const [selectedChapterName, setSelectedChapterName] = useState<string>(
    initialChapter || selectedSubject?.chapters[0]?.name || ''
  );
  const selectedChapter = selectedSubject?.chapters.find(c => c.name === selectedChapterName) || selectedSubject?.chapters[0];

  const [selectedTopicName, setSelectedTopicName] = useState<string>(
    initialTopic || selectedChapter?.topics[0]?.name || ''
  );
  const selectedTopic = selectedChapter?.topics.find(t => t.name === selectedTopicName) || selectedChapter?.topics[0];

  const [selectedSloCode, setSelectedSloCode] = useState<string>(
    selectedTopic?.subtopics?.[0]?.sloCode || ''
  );

  // 1-3-7 Spaced Cycle opt-in on session completion (Method 1)
  const [addTo137OnFinish, setAddTo137OnFinish] = useState<boolean>(true);

  // Focus Mode & Ambient Audio state
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [isSimpleTimerMode, setIsSimpleTimerMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studyflow_simple_timer_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [isAmbientSoundOn, setIsAmbientSoundOn] = useState<boolean>(true);
  const [ambientSoundType, setAmbientSoundType] = useState<'white' | 'pink' | 'rain'>('white');
  const [ambientVolume, setAmbientVolume] = useState<number>(0.15); // 15% volume
  const [autoStartBreak, setAutoStartBreak] = useState<boolean>(() => {
    try {
      return localStorage.getItem('studyflow_auto_start_break') === 'true';
    } catch {
      return false;
    }
  });
  const ambientAudioRef = useRef<{
    audioCtx: AudioContext;
    gainNode: GainNode;
    sourceNode: AudioBufferSourceNode;
    filterNode: BiquadFilterNode;
  } | null>(null);

  // AI Blurt / Active Retrieval & Notes Upload state
  const [blurtPrompt, setBlurtPrompt] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [blurtRecallText, setBlurtRecallText] = useState<string>('');
  const [attachedImage, setAttachedImage] = useState<{
    base64: string;
    mimeType: string;
    dataUrl: string;
    fileName: string;
    fileSizeBytes: number;
  } | null>(null);
  const [attachedImages, setAttachedImages] = useState<Array<{
    id: string;
    base64: string;
    mimeType: string;
    dataUrl: string;
    fileName: string;
    fileSizeBytes: number;
  }>>([]);
  const [isProcessingImage, setIsProcessingImage] = useState<boolean>(false);
  const [isEvaluatingBlurt, setIsEvaluatingBlurt] = useState<boolean>(false);
  const [blurtEvaluation, setBlurtEvaluation] = useState<BlurtRecallEvaluation | null>(null);
  const [blurtError, setBlurtError] = useState<string | null>(null);
  const [blurtSuccessMsg, setBlurtSuccessMsg] = useState<string | null>(null);
  const [isUpdatingSyllabus, setIsUpdatingSyllabus] = useState<boolean>(false);
  const [isAddingToRevision, setIsAddingToRevision] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer Color Theme (Restoring previous/original sage palette requested by user)
  const [timerColorTheme, setTimerColorTheme] = useState<'original_sage' | 'emerald' | 'amber' | 'classic'>(() => {
    try {
      return (localStorage.getItem('studyflow_timer_color_theme') as any) || 'original_sage';
    } catch {
      return 'original_sage';
    }
  });

  // Vintage Calligraphic & Cursive Numerals Typography Style
  const [timerFontStyle, setTimerFontStyle] = useState<'calligraphic' | 'cursive' | 'serif'>(() => {
    try {
      return (localStorage.getItem('studyflow_timer_font_style') as any) || 'calligraphic';
    } catch {
      return 'calligraphic';
    }
  });

  // Bilingual Voice-to-Text Dictation (English / اردو)
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechLang, setSpeechLang] = useState<'en-US' | 'ur-PK'>('en-US');
  const recognitionRef = useRef<any>(null);

  // Socratic Oral Exam & Mistake Vault integration
  const [activeBlurtTab, setActiveBlurtTab] = useState<'written' | 'socratic'>('written');
  const [socraticQuestion, setSocraticQuestion] = useState<string>('');
  const [socraticAnswer, setSocraticAnswer] = useState<string>('');
  const [isEvaluatingSocratic, setIsEvaluatingSocratic] = useState<boolean>(false);
  const [socraticFeedback, setSocraticFeedback] = useState<{
    score: number;
    praise: string;
    misconception?: string;
    correctUnderstanding?: string;
    errorCategory?: CognitiveErrorCategory;
  } | null>(null);
  const [socraticMistakeLogged, setSocraticMistakeLogged] = useState<boolean>(false);
  const [loggedMistakeGaps, setLoggedMistakeGaps] = useState<Record<number, boolean>>({});
  const [isDrillModalOpen, setIsDrillModalOpen] = useState<boolean>(false);

  // Study Session Quality Score & Deep Work Metrics
  const [distractionCount, setDistractionCount] = useState<number>(0);
  const [difficultyRating, setDifficultyRating] = useState<'Introductory' | 'Standard' | 'Rigorous' | 'Past Paper Level'>('Standard');
  const [activeRecallScore, setActiveRecallScore] = useState<number>(85); // 0-100%
  const [outputSummary, setOutputSummary] = useState<string>('');

  // Update chapter/topic dropdowns when subject/chapter/topic props change
  useEffect(() => {
    if (initialSubject && subjects.some(s => s.name === initialSubject)) {
      setSelectedSubjectName(initialSubject);
    }
    if (initialChapter) {
      setSelectedChapterName(initialChapter);
    }
    if (initialTopic) {
      setSelectedTopicName(initialTopic);
    }
    if (initialDurationMinutes && initialDurationMinutes > 0) {
      setTargetMinutes(initialDurationMinutes);
      setSecondsLeft(initialDurationMinutes * 60);
      setIsActive(false);
      setIsPaused(false);
    }
  }, [initialSubject, initialChapter, initialTopic, initialDurationMinutes, subjects]);

  useEffect(() => {
    if (selectedSubject) {
      if (!selectedSubject.chapters.some(c => c.name === selectedChapterName)) {
        setSelectedChapterName(selectedSubject.chapters[0]?.name || '');
      }
    }
  }, [selectedSubjectName, selectedSubject, selectedChapterName]);

  useEffect(() => {
    if (selectedChapter) {
      if (!selectedChapter.topics.some(t => t.name === selectedTopicName)) {
        setSelectedTopicName(selectedChapter.topics[0]?.name || '');
      }
    }
  }, [selectedChapterName, selectedChapter, selectedTopicName]);

  useEffect(() => {
    if (selectedTopic && selectedTopic.subtopics && selectedTopic.subtopics.length > 0) {
      if (!selectedTopic.subtopics.some(sub => sub.sloCode === selectedSloCode)) {
        setSelectedSloCode(selectedTopic.subtopics[0].sloCode || '');
      }
    } else {
      setSelectedSloCode('');
    }
  }, [selectedTopic, selectedTopicName]);

  // Compute accumulated saved study time for this specific topic
  const topicSavedStats = useMemo(() => {
    let minutes = 0;
    let count = 0;
    if (selectedSubject && selectedChapter) {
      const topicObj = selectedChapter.topics.find(t => t.name === selectedTopicName);
      if (topicObj) {
        minutes = topicObj.timeSpentMinutes || 0;
        count = topicObj.sessionsCount || 0;
      }
    }
    // Also cross-reference with study sessions
    const matchingSessions = (sessions || []).filter(
      s => s.subjectName.trim().toLowerCase() === selectedSubjectName.trim().toLowerCase() &&
           s.topicName.trim().toLowerCase() === selectedTopicName.trim().toLowerCase()
    );
    const sessionMins = matchingSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    minutes = Math.max(minutes, sessionMins);
    count = Math.max(count, matchingSessions.length);
    return { minutes, count };
  }, [selectedSubject, selectedChapter, selectedTopicName, selectedSubjectName, sessions]);

  // Timer mode & state
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [customMinutes, setCustomMinutes] = useState<number>(30);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const sessionQualityScore = useMemo(() => {
    // 1. Focus consistency: deduction per distraction
    const focusFactor = Math.max(20, 100 - (distractionCount * 12));
    
    // 2. Duration factor: optimal deep work plateau between 25 and 90 minutes
    const elapsedMinutes = Math.max(1, Math.round(((targetMinutes * 60) - secondsLeft) / 60));
    const durationFactor = Math.min(100, Math.max(40, Math.round((elapsedMinutes / 35) * 100)));

    // 3. Difficulty rating
    const difficultyMap: Record<string, number> = {
      'Introductory': 70,
      'Standard': 85,
      'Rigorous': 95,
      'Past Paper Level': 100
    };
    const diffScore = difficultyMap[difficultyRating] || 85;

    // 4. Active recall score
    const recallFactor = Math.min(100, Math.max(0, activeRecallScore));

    // Weighted combination: Focus 35%, Duration 20%, Difficulty 20%, Active Recall 25%
    const score = Math.round(
      (focusFactor * 0.35) + 
      (durationFactor * 0.20) + 
      (diffScore * 0.20) + 
      (recallFactor * 0.25)
    );
    return Math.min(100, Math.max(10, score));
  }, [distractionCount, targetMinutes, secondsLeft, difficultyRating, activeRecallScore]);

  const deepWorkRating = useMemo<'Deep Work' | 'Moderate Focus' | 'Fragmented' | 'Shallow'>(() => {
    if (sessionQualityScore >= 85) return 'Deep Work';
    if (sessionQualityScore >= 70) return 'Moderate Focus';
    if (sessionQualityScore >= 50) return 'Fragmented';
    return 'Shallow';
  }, [sessionQualityScore]);

  // Dynamic Theme Colors for Timer (Sage/Classic/Emerald/Amber)
  const timerThemeClasses = useMemo(() => {
    switch (timerColorTheme) {
      case 'original_sage':
        return {
          text: 'text-[#6B705C] dark:text-[#B5C2A5]',
          bar: 'bg-[#6B705C] dark:bg-[#A5B396]',
          glow: 'bg-[#6B705C]/15 dark:bg-[#A5B396]/20',
          accent: 'border-[#6B705C]/40 text-[#6B705C] dark:text-[#B5C2A5]'
        };
      case 'emerald':
        return {
          text: 'text-emerald-700 dark:text-emerald-400',
          bar: 'bg-emerald-600 dark:bg-emerald-500',
          glow: 'bg-emerald-500/15',
          accent: 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
        };
      case 'amber':
        return {
          text: 'text-amber-700 dark:text-amber-400',
          bar: 'bg-amber-600 dark:bg-amber-500',
          glow: 'bg-amber-500/15',
          accent: 'border-amber-500/40 text-amber-700 dark:text-amber-400'
        };
      case 'classic':
      default:
        return {
          text: 'text-primary',
          bar: 'bg-primary',
          glow: 'bg-primary/10',
          accent: 'border-primary/40 text-primary'
        };
    }
  }, [timerColorTheme]);

  // Session metadata timestamps
  const startTimeRef = useRef<string>('');
  const startTimestampRef = useRef<number>(0);

  // Completion modal state
  const [isFinishModalOpen, setIsFinishModalOpen] = useState<boolean>(false);
  const [sessionNotes, setSessionNotes] = useState<string>('');
  const [feynmanBlurt, setFeynmanBlurt] = useState<string>('');
  const [sessionLoggedMinutes, setSessionLoggedMinutes] = useState<number>(25);
  const [selectedResult, setSelectedResult] = useState<'Completed' | 'Partially completed' | 'Not completed'>('Completed');
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);
  const [emailNotification, setEmailNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [lastSavedSession, setLastSavedSession] = useState<{
    subjectName: string;
    chapterName: string;
    topicName: string;
    durationMinutes: number;
    startTime: string;
    endTime: string;
    result: string;
    notes?: string;
    date: string;
    sloCode?: string;
    sloName?: string;
    addedTo137?: boolean;
  } | null>(null);

  // Multi-Channel Delivery State (Email + WhatsApp simultaneous or selective)
  const [sendEmailOnFinish, setSendEmailOnFinish] = useState<boolean>(true);
  const [sendWhatsAppOnFinish, setSendWhatsAppOnFinish] = useState<boolean>(() => !!(userProfile?.whatsappNumber));
  const [recipientPhoneInput, setRecipientPhoneInput] = useState<string>(() => userProfile?.whatsappNumber || '');

  // 1-Time Google Tasks Transfer State
  const [isTransferringToGoogleTasks, setIsTransferringToGoogleTasks] = useState<boolean>(false);
  const [isGoogleTasksTransferredSession, setIsGoogleTasksTransferredSession] = useState<boolean>(false);

  // Transfer ONLY this single study session to Google Tasks (1-Time rule)
  const handleTransferCurrentSessionToGoogleTasks = async (sessionToTransfer: any) => {
    if (!sessionToTransfer) return;
    setIsTransferringToGoogleTasks(true);
    try {
      const sessionId = `session-${sessionToTransfer.date}-${sessionToTransfer.startTime}-${sessionToTransfer.topicName}`.replace(/[^a-zA-Z0-9-]/g, '_');
      const res = await transferSingleTaskToGoogleTasks({
        id: sessionId,
        type: 'session',
        title: `⚡ [${sessionToTransfer.subjectName}] ${sessionToTransfer.topicName} (${sessionToTransfer.durationMinutes}m)`,
        notes: `Chapter: ${sessionToTransfer.chapterName}\nFinished at: ${sessionToTransfer.endTime}\nDate: ${sessionToTransfer.date}\nNotes: ${sessionToTransfer.notes || 'None'}`,
        dueDate: sessionToTransfer.date,
        completed: true
      });
      setIsGoogleTasksTransferredSession(true);
      if (res.status === 'already_transferred') {
        setEmailNotification({
          type: 'info',
          text: `Google Tasks: ${res.message}`
        });
      } else {
        setEmailNotification({
          type: 'success',
          text: `Google Tasks: ${res.message}`
        });
      }
    } catch (err: any) {
      setEmailNotification({
        type: 'error',
        text: err.message || 'Could not transfer session to Google Tasks.'
      });
    } finally {
      setIsTransferringToGoogleTasks(false);
    }
  };

  // Relevant subject notes to pass into AI evaluation
  const relevantNotes = useMemo(() => {
    if (!notes || notes.length === 0) return '';
    const matched = notes.filter(n =>
      n.subjectName.toLowerCase() === selectedSubjectName.toLowerCase() ||
      n.title.toLowerCase().includes(selectedTopicName.toLowerCase())
    );
    return matched.map(m => `${m.title}: ${m.content}`).join('\n\n');
  }, [notes, selectedSubjectName, selectedTopicName]);

  // Generate AI Prompt for the current topic
  const handleGenerateBlurtPrompt = async () => {
    if (!selectedTopicName) return;
    setIsGeneratingPrompt(true);
    setBlurtError(null);
    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const res = await apiGenerateBlurtPrompt({
        topicName: selectedTopicName,
        subjectName: selectedSubjectName,
        chapterName: selectedChapterName,
        subtopics: activeTopicObj?.subtopics,
        weakNotes: activeTopicObj?.weakNotes
      });
      if (res && res.prompt) {
        setBlurtPrompt(res.prompt);
      } else {
        setBlurtPrompt(`Explain the core principles, key definitions, equations, and main examiner pitfalls for ${selectedTopicName}.`);
      }
    } catch (err: any) {
      console.warn('Could not generate AI prompt, using standard prompt:', err);
      setBlurtPrompt(`Explain the core principles, key definitions, equations, and main examiner pitfalls for ${selectedTopicName}.`);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Handle Rupex / Rubric upload for AI Blender
  const handleUploadRubric = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      const sizeKb = Math.round(file.size / 1024);
      setRubricFile({
        id: `rubric-${Date.now()}`,
        name: file.name,
        base64,
        mimeType: file.type || 'image/png',
        previewUrl: dataUrl,
        sizeFormatted: sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`
      });
      setBlurtSuccessMsg(`Rupex / Marking Rubric "${file.name}" uploaded successfully! AI will grade recall against these criteria.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCurrentRupexToLocker = () => {
    if (!rubricFile) return;
    const newItem = {
      ...rubricFile,
      subjectName: selectedSubjectName,
      chapterName: selectedChapterName,
      uploadedAt: new Date().toISOString()
    };
    const updated = [newItem, ...savedRupexList.filter(r => r.name !== rubricFile.name)];
    setSavedRupexList(updated);
    try {
      localStorage.setItem('studyflow_rupex_vault_v1', JSON.stringify(updated));
      setBlurtSuccessMsg(`✓ Rupex "${rubricFile.name}" saved to your permanent Rupex Locker!`);
    } catch (e) {
      console.warn('Locker save note:', e);
    }
  };

  const handleDeleteRupexFromLocker = (id: string) => {
    const updated = savedRupexList.filter(r => r.id !== id);
    setSavedRupexList(updated);
    try {
      localStorage.setItem('studyflow_rupex_vault_v1', JSON.stringify(updated));
    } catch (e) {}
  };

  const handleSelectRupexFromLocker = (item: any) => {
    setRubricFile(item);
    setIsRupexLockerOpen(false);
    setBlurtSuccessMsg(`✓ Rupex "${item.name}" loaded from locker and attached to AI Blender!`);
  };

  // 1-Click Preset High-Yield Questions (No typing needed)
  const handleSelectPresetQuestion = (type: 'definitions' | 'formulas' | 'traps' | 'numerical' | 'summary' | 'questions5') => {
    const topic = selectedTopicName || 'this topic';
    const ch = selectedChapterName || 'this chapter';
    switch (type) {
      case 'definitions':
        setBlurtPrompt(`Explain the primary definitions, fundamental physical laws, and exact examiner keyword requirements for ${topic}.`);
        break;
      case 'formulas':
        setBlurtPrompt(`State and derive all governing equations, SI units, and step-by-step working derivations for ${topic}.`);
        break;
      case 'traps':
        setBlurtPrompt(`List the top 3 examiner misconceptions, sign convention mistakes, and common past paper calculation traps for ${topic}.`);
        break;
      case 'numerical':
        setBlurtPrompt(`Solve a standard 5-mark past paper examination problem on ${topic}, showing all given data, formulas, steps, and final units.`);
        break;
      case 'summary':
        setBlurtPrompt(`Provide a complete synoptic active recall summary of ${ch} — connecting core concepts, formulas, and real-world exam applications.`);
        break;
      case 'questions5':
        setBlurtPrompt(`Answer the following 5 high-yield questions on ${topic}:\n1. State the fundamental definition / principle.\n2. Write down the primary formula and define each variable.\n3. What is the standard SI unit and dimensional formula?\n4. What happens when key variables increase or decrease?\n5. State two real-world applications or past-paper exam traps.`);
        break;
    }
  };

  // Process uploaded image files (supports multiple photos of handwritten notes or diagrams)
  const handleProcessImageFiles = async (files: FileList | File[] | (File | Blob)[]) => {
    const fileList = Array.from(files);
    const validFiles = fileList.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      setBlurtError('Please select valid image files (PNG, JPG, JPEG, WEBP).');
      return;
    }
    setIsProcessingImage(true);
    setBlurtError(null);
    try {
      const processedList: Array<{
        id: string;
        base64: string;
        mimeType: string;
        dataUrl: string;
        fileName: string;
        fileSizeBytes: number;
      }> = [];

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const processed = await compressImageFile(file, 1400, 0.85);
        processedList.push({
          id: `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          base64: processed.base64,
          mimeType: processed.mimeType,
          dataUrl: processed.dataUrl,
          fileName: file instanceof File ? file.name : `page_${i + 1}.jpg`,
          fileSizeBytes: processed.fileSizeBytes
        });
      }

      setAttachedImages(prev => {
        const updated = [...prev, ...processedList];
        if (updated.length > 0) {
          setAttachedImage(updated[0]);
        }
        return updated;
      });
      setBlurtSuccessMsg(`${processedList.length} photo(s) added and optimized for AI analysis!`);
    } catch (err: any) {
      console.error('Error processing images:', err);
      setBlurtError('Could not process some images. Please try again.');
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleRemovePhoto = (id: string) => {
    setAttachedImages(prev => {
      const updated = prev.filter(p => p.id !== id);
      setAttachedImage(updated.length > 0 ? updated[0] : null);
      return updated;
    });
  };

  // Toggle Bilingual Voice-to-Text Speech Recognition (English / اردو)
  const handleToggleVoiceDictation = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is supported natively in Chrome, Edge, and Safari. Please use a supported browser or type your recall.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLang;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          if (activeBlurtTab === 'socratic') {
            setSocraticAnswer(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
          } else {
            setBlurtRecallText(prev => prev ? `${prev} ${finalTranscript}` : finalTranscript);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition status:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Socratic Oral Exam Question Generator
  const handleGenerateSocraticQuestion = async () => {
    setIsEvaluatingSocratic(true);
    setSocraticFeedback(null);
    setSocraticMistakeLogged(false);
    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const subtopicsText = activeTopicObj?.subtopics?.map(s => typeof s === 'string' ? s : s.name).join(', ') || '';

      const res = await fetch('/api/ai/ask-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubjectName,
          chapter: selectedChapterName,
          topic: selectedTopicName,
          userPrompt: `Generate ONE concise, probing Socratic oral exam question for a high-school / FBISE student testing their conceptual depth and common misconceptions in "${selectedTopicName}" (Subtopics: ${subtopicsText}). Ask a question that forces them to explain "why" or "what happens if", not just recite a definition.`
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          setSocraticQuestion(data.reply.trim());
          setSocraticAnswer('');
          return;
        }
      }
      setSocraticQuestion(`In ${selectedTopicName}: How would you explain the underlying mechanism to someone who doubts it? What is the most critical condition or formula, and what mistake do students commonly make when applying it?`);
      setSocraticAnswer('');
    } catch {
      setSocraticQuestion(`In ${selectedTopicName}: How would you explain the underlying mechanism to someone who doubts it? What is the most critical condition or formula, and what mistake do students commonly make when applying it?`);
    } finally {
      setIsEvaluatingSocratic(false);
    }
  };

  // Socratic Oral Exam Answer Evaluator
  const handleEvaluateSocraticAnswer = async () => {
    if (!socraticAnswer.trim()) {
      setBlurtError('Please speak or write your oral response first.');
      return;
    }
    setIsEvaluatingSocratic(true);
    setBlurtError(null);
    try {
      const res = await fetch('/api/ai/ask-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: selectedSubjectName,
          chapter: selectedChapterName,
          topic: selectedTopicName,
          userPrompt: `Evaluate the student's oral exam answer to the question: "${socraticQuestion}"
Student Answer: "${socraticAnswer}"
Please evaluate strictly on FBISE / Mark Scheme conceptual rigor.
Return JSON formatted with:
{
  "score": 85,
  "praise": "Specific sentence on what was logically solid",
  "misconception": "Exact misconception or missing condition (empty string if flawless)",
  "correctUnderstanding": "Concise mark-scheme correct answer",
  "errorCategory": "conceptual_misconception"
}`
        })
      });

      if (res.ok) {
        const data = await res.json();
        let parsed: any = null;
        try {
          const clean = data.reply.replace(/```json/g, '').replace(/```/g, '').trim();
          parsed = JSON.parse(clean);
        } catch {
          parsed = {
            score: 75,
            praise: data.reply.slice(0, 160),
            misconception: "Review full mathematical or physical conditions for complete marks.",
            correctUnderstanding: data.reply,
            errorCategory: "conceptual_misconception"
          };
        }
        setSocraticFeedback(parsed);
      }
    } catch (err: any) {
      setSocraticFeedback({
        score: 70,
        praise: "Good core attempt covering the foundational points.",
        misconception: "Ensure variables and boundary conditions are stated explicitly.",
        correctUnderstanding: "Refer to textbook definitions and key formulas.",
        errorCategory: "conceptual_misconception"
      });
    } finally {
      setIsEvaluatingSocratic(false);
    }
  };

  // 1-Click Send Misconception to Mistake Vault
  const handleLogSocraticMistake = () => {
    if (!socraticFeedback?.misconception && !socraticFeedback?.correctUnderstanding) return;
    addMistake({
      subject: selectedSubjectName,
      chapter: selectedChapterName,
      topic: selectedTopicName,
      question: socraticQuestion,
      studentAnswer: socraticAnswer,
      correctAnswer: socraticFeedback.correctUnderstanding || 'Standard mark scheme formulation',
      category: socraticFeedback.errorCategory || 'conceptual_misconception',
      studentThoughtProcess: socraticFeedback.misconception || 'Identified as conceptual gap during Socratic oral exam',
      tags: ['SocraticOralExam', selectedSubjectName]
    });
    setSocraticMistakeLogged(true);
    setBlurtSuccessMsg('Misconception successfully recorded in Mistake Vault for spaced autopsy practice!');
  };

  // Evaluate Blurt with Gemini AI
  const handleEvaluateBlurt = async () => {
    const wordCount = blurtRecallText.trim().split(/\s+/).filter(Boolean).length;
    if (!blurtRecallText.trim() && !attachedImage) {
      setBlurtError('Please write your recall explanation or upload a photo of your handwritten work/diagram.');
      return;
    }
    if (!attachedImage && wordCount < 5) {
      setBlurtError('Please write at least a few sentences (5+ words) or upload an image of your work for accurate AI evaluation.');
      return;
    }

    setIsEvaluatingBlurt(true);
    setBlurtError(null);
    setBlurtSuccessMsg(null);

    try {
      const activeTopicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
      const result = await apiEvaluateBlurtRecall({
        topicName: selectedTopicName,
        subjectName: selectedSubjectName,
        chapterName: selectedChapterName,
        subtopics: activeTopicObj?.subtopics,
        syllabusNotes: activeTopicObj?.weakNotes || '',
        userNotes: relevantNotes,
        blurtText: blurtRecallText.trim(),
        imageBase64: attachedImage ? attachedImage.base64 : undefined,
        imageMimeType: attachedImage ? attachedImage.mimeType : undefined,
        promptUsed: blurtPrompt || `Explain the core concepts of ${selectedTopicName}`,
        durationSeconds: targetMinutes * 60 - secondsLeft > 0 ? targetMinutes * 60 - secondsLeft : 300
      });

      if (result && result.evaluation) {
        const evalData: BlurtRecallEvaluation = {
          ...result.evaluation,
          imageUrl: attachedImage ? attachedImage.dataUrl : (result.evaluation.imageUrl || undefined),
          extractedText: result.extractedText || result.evaluation.extractedText || undefined,
          diagramNotes: result.diagramNotes || result.evaluation.diagramNotes || undefined
        };
        setBlurtEvaluation(evalData);

        // Record Ebbinghaus retention outcome
        recordTopicRecallOutcome(
          evalData.subjectName,
          evalData.topicName,
          evalData.recallScore,
          evalData.knowledgeGaps.length
        );

        // Automatically log activity to history
        if (onLogActivity) {
          const spentMins = Math.max(1, Math.round((evalData.durationSeconds || 180) / 60));
          await onLogActivity({
            date: evalData.date,
            timestamp: evalData.timestamp,
            subjectName: evalData.subjectName,
            chapterName: evalData.chapterName,
            topicName: evalData.topicName,
            action: 'Blurt Recall',
            details: `AI Blurt Recall on "${evalData.topicName}": ${evalData.recallScore}% recall score ${attachedImage ? '(Photo Work Analyzed)' : ''} — ${evalData.knowledgeGaps.length} gaps identified (${evalData.recalledConcepts.length} concepts recalled)`,
            result: `${evalData.recallScore}% • ${evalData.retentionLevel}`,
            durationMinutes: spentMins,
            scorePercentage: evalData.recallScore,
            blurtRecall: evalData
          });
        }
        setBlurtSuccessMsg(`Recall evaluation complete: ${evalData.recallScore}% score recorded!`);
      } else {
        throw new Error('Could not parse AI evaluation response.');
      }
    } catch (err: any) {
      console.error('Error evaluating blurt:', err);
      setBlurtError(err?.message || 'Failed to complete AI comparison. Please try again.');
    } finally {
      setIsEvaluatingBlurt(false);
    }
  };

  // Mark topic status in syllabus
  const handleUpdateSyllabusStatus = async (status: TopicStatus) => {
    if (!onUpdateTopicStatus || !selectedSubjectName || !selectedTopicName) return;
    setIsUpdatingSyllabus(true);
    try {
      await onUpdateTopicStatus(selectedSubjectName, selectedTopicName, status);
      setBlurtSuccessMsg(`Syllabus updated! "${selectedTopicName}" is now marked as ${status}.`);
    } catch (e: any) {
      setBlurtError('Failed to update syllabus status.');
    } finally {
      setIsUpdatingSyllabus(false);
    }
  };

  // Add gaps to revision queue
  const handleAddGapsToRevisionQueue = async () => {
    if (!blurtEvaluation || !onSaveRevision) return;
    setIsAddingToRevision(true);
    try {
      const gapBulletPoints = blurtEvaluation.knowledgeGaps
        .map(g => `• ${g.concept}: ${g.explanation}`)
        .join('\n');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      await onSaveRevision({
        subjectName: blurtEvaluation.subjectName,
        chapterName: blurtEvaluation.chapterName || 'General',
        topicName: blurtEvaluation.topicName,
        lastStudied: new Date().toISOString().split('T')[0],
        dueDate: tomorrowStr,
        priority: blurtEvaluation.recallScore < 65 ? 'High' : 'Medium',
        status: 'Pending',
        reason: `AI Blurt gaps (${blurtEvaluation.recallScore}% score):\n${gapBulletPoints}`,
        timeSpentMinutes: Math.round(blurtEvaluation.durationSeconds / 60)
      });
      setBlurtSuccessMsg('Knowledge gaps queued into your Revision Manager for tomorrow!');
    } catch (e: any) {
      setBlurtError('Failed to add to revision queue.');
    } finally {
      setIsAddingToRevision(false);
    }
  };

  // Audio effect context for timer chime
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.2);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.warn("Audio play error:", e);
    }
  };

  // Ambient Noise Web Audio Synthesizer
  const stopAmbientNoise = () => {
    if (ambientAudioRef.current) {
      try {
        const { audioCtx, gainNode, sourceNode } = ambientAudioRef.current;
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
        setTimeout(() => {
          try {
            sourceNode.stop();
            audioCtx.close();
          } catch (e) {}
        }, 220);
      } catch (e) {}
      ambientAudioRef.current = null;
    }
  };

  const startAmbientNoise = (type: 'white' | 'pink' | 'rain', volume: number) => {
    stopAmbientNoise();
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();

      const bufferSize = audioCtx.sampleRate * 2;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);

      if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      } else if (type === 'rain') {
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.2;
        }
      } else {
        // Soft White noise
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }

      const noiseSource = audioCtx.createBufferSource();
      noiseSource.buffer = buffer;
      noiseSource.loop = true;

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = type === 'rain' ? 450 : (type === 'pink' ? 650 : 800);

      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), audioCtx.currentTime + 0.3);

      noiseSource.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);

      noiseSource.start();
      ambientAudioRef.current = { audioCtx, gainNode: gain, sourceNode: noiseSource, filterNode: filter };
    } catch (e) {
      console.warn("Ambient noise error:", e);
    }
  };

  // Manage ambient sound playback when timer state or Focus Mode changes
  useEffect(() => {
    if (isActive && !isPaused && isFocusMode && isAmbientSoundOn) {
      startAmbientNoise(ambientSoundType, ambientVolume);
    } else {
      stopAmbientNoise();
    }
    return () => {
      stopAmbientNoise();
    };
  }, [isActive, isPaused, isFocusMode, isAmbientSoundOn, ambientSoundType]);

  // Adjust volume dynamically if changed while playing
  useEffect(() => {
    if (ambientAudioRef.current) {
      try {
        const { audioCtx, gainNode } = ambientAudioRef.current;
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(Math.max(0.001, ambientVolume), audioCtx.currentTime + 0.1);
      } catch (e) {}
    }
  }, [ambientVolume]);

  // Keyboard shortcuts (Space to toggle, F for Fullscreen Zen, Escape to exit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (isActive) {
          if (isPaused) {
            setIsPaused(false);
          } else {
            setIsPaused(true);
          }
        } else {
          if (selectedTopicName) {
            const now = new Date();
            startTimeRef.current = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            startTimestampRef.current = Date.now();
            setIsActive(true);
            setIsPaused(false);
          }
        }
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        setIsFullscreenFocus(prev => !prev);
      } else if (e.key === 'Escape') {
        if (isFullscreenFocus) {
          setIsFullscreenFocus(false);
        }
        if (isFocusMode) {
          setIsFocusMode(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive, isPaused, isFullscreenFocus, isFocusMode, selectedTopicName]);

  // Synchronize timer state with global background persistence for seamless tab switching
  useEffect(() => {
    if (isActive) {
      persistRunningTimer({
        isRunning: true,
        isPaused: isPaused,
        mode: 'focus',
        subjectName: selectedSubjectName || 'Study Session',
        topicName: selectedTopicName || '',
        targetSeconds: targetMinutes * 60,
        secondsLeft: secondsLeft,
        startedAtTimestamp: Date.now(),
        targetEndTimestamp: Date.now() + (secondsLeft * 1000),
        lastTickTimestamp: Date.now()
      });
    } else if (secondsLeft === targetMinutes * 60) {
      clearRunningTimer();
    }
  }, [isActive, isPaused, secondsLeft, targetMinutes, selectedSubjectName, selectedTopicName]);

  // Read persisted timer on mount and listen to cross-screen / builder app timer sync events
  useEffect(() => {
    const handleRemoteTimerSync = (e?: any) => {
      const persisted = e?.detail !== undefined ? e.detail : getPersistedTimer();
      if (persisted && persisted.isRunning && persisted.secondsLeft > 0) {
        setSecondsLeft(persisted.secondsLeft);
        setTargetMinutes(Math.max(1, Math.round(persisted.targetSeconds / 60)));
        setIsActive(true);
        setIsPaused(persisted.isPaused);
        if (persisted.topicName) setSelectedTopicName(persisted.topicName);
        if (persisted.subjectName) setSelectedSubjectName(persisted.subjectName);
      } else if (persisted === null) {
        setIsActive(false);
        setIsPaused(false);
      }
    };

    handleRemoteTimerSync();
    window.addEventListener('studyplanner:timer-update', handleRemoteTimerSync);
    return () => window.removeEventListener('studyplanner:timer-update', handleRemoteTimerSync);
  }, []);

  // Timer interval tick
  useEffect(() => {
    let interval: any = null;
    if (isActive && !isPaused) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setIsActive(false);
            setIsPaused(false);
            playChime();
            setSessionLoggedMinutes(targetMinutes);
            setSelectedResult('Completed');
            setIsFinishModalOpen(true);

            if (autoStartBreak) {
              setTimeout(() => {
                setSelectedTopicName('Rest Break (5 min)');
                setTargetMinutes(5);
                setSecondsLeft(5 * 60);
                setIsActive(true);
                setIsPaused(false);
              }, 1200);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused, targetMinutes, autoStartBreak]);

  // Web Audio Exam Pressure Alert Chime (2 or 3 short crisp rings)
  const playExamChime = (rings: number = 3) => {
    if (!mcqAudioChimeEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      for (let i = 0; i < rings; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const freq = i === 0 ? 880 : i === 1 ? 1174 : 1760;
        const startT = now + i * 0.18;
        osc.frequency.setValueAtTime(freq, startT);
        gain.gain.setValueAtTime(0.28, startT);
        gain.gain.exponentialRampToValueAtTime(0.001, startT + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startT);
        osc.stop(startT + 0.16);
      }
    } catch (e) {
      console.warn('Audio chime warning:', e);
    }
  };

  // Printable Academic Monthly Wall Calendar Generator with Physical Check-Off Boxes
  const handlePrintWallCalendar = () => {
    try {
      openStudyKitPrintWindow({
        format: 'monthly_wall_calendar',
        selectedSubjectNames: subjects ? subjects.map(s => s.name) : [],
        includeFormulas: true,
        includeMnemonics: true,
        includeFlashcards: false,
        includeExams: true,
        columns: 2,
        fontSize: 'standard',
        title: `Academic Monthly Wall Calendar — ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        notes: 'Monthly physical study calendar: check off daily boxes for study hours, active recall, MCQ blitz, and done ✓.'
      }, {
        subjects: subjects || [],
        flashcardDecks: [],
        plans: plans || [],
        userProfile: userProfile || null,
        revisions: []
      });
      setEmailNotification({
        type: 'success',
        text: '✓ Printable Monthly Academic Wall Calendar with mark-off boxes opened in print preview!'
      });
    } catch (e: any) {
      setEmailNotification({
        type: 'error',
        text: `Wall calendar print failed: ${e.message}`
      });
    }
  };

  // Exam Audio Recording Timer Interval
  useEffect(() => {
    let recTimer: any = null;
    if (isExamAudioRecording) {
      recTimer = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);
    }
    return () => clearInterval(recTimer);
  }, [isExamAudioRecording]);

  const toggleExamAudioRecording = (qIndex: number, type: 'short' | 'long') => {
    if (isExamAudioRecording) {
      setIsExamAudioRecording(false);
      const duration = recordingSeconds;
      if (type === 'short') {
        setSqAudioRecordings(prev => ({
          ...prev,
          [qIndex]: { isRecorded: true, duration }
        }));
      } else {
        setLqAudioRecordings(prev => ({
          ...prev,
          [qIndex]: { isRecorded: true, duration }
        }));
      }
      playExamChime(1);
    } else {
      setRecordingSeconds(0);
      setIsExamAudioRecording(true);
    }
  };

  // Exam Pressure Pacing Timer Interval (High-Precision 100ms countdown for MCQ, Short & Long Questions)
  useEffect(() => {
    let timer: any = null;
    if (mcqIsActive && !mcqIsPaused && !mcqIsFinished) {
      timer = setInterval(() => {
        setMcqTotalElapsedSeconds(t => Number((t + 0.1).toFixed(1)));

        if (mcqIsBufferActive) {
          setMcqBufferSecondsLeft(prev => {
            const next = Number((prev - 0.1).toFixed(1));
            if (next <= 0.05) {
              setMcqIsBufferActive(false);

              if (examPressureType === 'mcq') {
                setMcqCurrentIndex(idx => {
                  const nextIdx = idx + 1;
                  if (nextIdx > mcqTotalCount) {
                    setMcqIsActive(false);
                    setMcqIsFinished(true);
                    playExamChime(2);
                    return idx;
                  }
                  setMcqQuestionSecondsLeft(mcqSecondsPerQuestion);
                  return nextIdx;
                });
              } else if (examPressureType === 'short_question') {
                setSqCurrentIndex(idx => {
                  const nextIdx = idx + 1;
                  if (nextIdx > sqTotalCount) {
                    setMcqIsActive(false);
                    setMcqIsFinished(true);
                    playExamChime(2);
                    return idx;
                  }
                  setSqSecondsLeft(sqMinutesPerQuestion * 60);
                  return nextIdx;
                });
              } else if (examPressureType === 'long_question') {
                setLqCurrentIndex(idx => {
                  const nextIdx = idx + 1;
                  if (nextIdx > lqTotalCount) {
                    setMcqIsActive(false);
                    setMcqIsFinished(true);
                    playExamChime(2);
                    return idx;
                  }
                  setLqSecondsLeft(lqMinutesPerQuestion * 60);
                  return nextIdx;
                });
              }
              return 0;
            }
            return next;
          });
        } else {
          // ACTIVE QUESTION COUNTDOWN
          if (examPressureType === 'mcq') {
            setMcqQuestionSecondsLeft(prev => {
              const next = Number((prev - 0.1).toFixed(1));
              if (next <= 0.05) {
                // 3 rings audio chime as requested!
                playExamChime(3);

                setMcqAnswers(old => {
                  if (!old[mcqCurrentIndex]) {
                    return { ...old, [mcqCurrentIndex]: 'OVERTIME' };
                  }
                  return old;
                });

                setMcqQuestionTimes(old => ({
                  ...old,
                  [mcqCurrentIndex]: mcqSecondsPerQuestion
                }));

                if (mcqCurrentIndex >= mcqTotalCount) {
                  setMcqIsActive(false);
                  setMcqIsFinished(true);
                  return 0;
                }

                // Enter 1 to 3 seconds buffer before moving to next question (strictly max 3s)
                setMcqIsBufferActive(true);
                setMcqBufferSecondsLeft(mcqBufferSeconds);
                return 0;
              }
              return next;
            });
          } else if (examPressureType === 'short_question') {
            setSqSecondsLeft(prev => {
              const next = Number((prev - 0.1).toFixed(1));
              // 30-second warning bell
              if (Math.abs(next - 30.0) < 0.05) {
                playExamChime(1);
              }
              if (next <= 0.05) {
                playExamChime(3);
                if (isExamAudioRecording) {
                  setIsExamAudioRecording(false);
                  setSqAudioRecordings(r => ({ ...r, [sqCurrentIndex]: { isRecorded: true, duration: recordingSeconds } }));
                }
                if (sqCurrentIndex >= sqTotalCount) {
                  setMcqIsActive(false);
                  setMcqIsFinished(true);
                  return 0;
                }
                setMcqIsBufferActive(true);
                setMcqBufferSecondsLeft(mcqBufferSeconds);
                return 0;
              }
              return next;
            });
          } else if (examPressureType === 'long_question') {
            setLqSecondsLeft(prev => {
              const next = Number((prev - 0.1).toFixed(1));
              const halfTime = (lqMinutesPerQuestion * 60) / 2;
              if (Math.abs(next - halfTime) < 0.05) {
                playExamChime(1);
              }
              if (Math.abs(next - 120.0) < 0.05) {
                playExamChime(2);
              }
              if (next <= 0.05) {
                playExamChime(3);
                if (isExamAudioRecording) {
                  setIsExamAudioRecording(false);
                  setLqAudioRecordings(r => ({ ...r, [lqCurrentIndex]: { isRecorded: true, duration: recordingSeconds } }));
                }
                if (lqCurrentIndex >= lqTotalCount) {
                  setMcqIsActive(false);
                  setMcqIsFinished(true);
                  return 0;
                }
                setMcqIsBufferActive(true);
                setMcqBufferSecondsLeft(mcqBufferSeconds);
                return 0;
              }
              return next;
            });
          }
        }
      }, 100);
    }
    return () => clearInterval(timer);
  }, [
    mcqIsActive,
    mcqIsPaused,
    mcqIsFinished,
    mcqIsBufferActive,
    mcqCurrentIndex,
    mcqTotalCount,
    mcqSecondsPerQuestion,
    mcqBufferSeconds,
    mcqAudioChimeEnabled,
    examPressureType,
    sqCurrentIndex,
    sqTotalCount,
    sqMinutesPerQuestion,
    lqCurrentIndex,
    lqTotalCount,
    lqMinutesPerQuestion,
    isExamAudioRecording,
    recordingSeconds
  ]);

  const handleStartExamPressureSprint = () => {
    setMcqTotalElapsedSeconds(0);
    setMcqIsFinished(false);
    setMcqIsBufferActive(false);
    setMcqIsActive(true);
    setMcqIsPaused(false);
    setIsExamAudioRecording(false);
    setRecordingSeconds(0);

    if (examPressureType === 'mcq') {
      setMcqCurrentIndex(1);
      setMcqQuestionSecondsLeft(mcqSecondsPerQuestion);
      setMcqAnswers({});
      setMcqQuestionTimes({});
    } else if (examPressureType === 'short_question') {
      setSqCurrentIndex(1);
      setSqSecondsLeft(sqMinutesPerQuestion * 60);
      setSqAnswersText({});
      setSqAudioRecordings({});
    } else if (examPressureType === 'long_question') {
      setLqCurrentIndex(1);
      setLqSecondsLeft(lqMinutesPerQuestion * 60);
      setLqAnswersText({});
      setLqAudioRecordings({});
      setLqMilestones({});
    } else if (examPressureType === 'mixed_board') {
      setMcqCurrentIndex(1);
      setMcqQuestionSecondsLeft(45);
      setMcqAnswers({});
    }
  };

  const handleSelectShortQuestionNext = () => {
    if (isExamAudioRecording) {
      setIsExamAudioRecording(false);
      setSqAudioRecordings(r => ({ ...r, [sqCurrentIndex]: { isRecorded: true, duration: recordingSeconds } }));
    }
    if (sqCurrentIndex < sqTotalCount) {
      setSqCurrentIndex(prev => prev + 1);
      setSqSecondsLeft(sqMinutesPerQuestion * 60);
    } else {
      setMcqIsActive(false);
      setMcqIsFinished(true);
      playExamChime(2);
    }
  };

  const handleSelectLongQuestionNext = () => {
    if (isExamAudioRecording) {
      setIsExamAudioRecording(false);
      setLqAudioRecordings(r => ({ ...r, [lqCurrentIndex]: { isRecorded: true, duration: recordingSeconds } }));
    }
    if (lqCurrentIndex < lqTotalCount) {
      setLqCurrentIndex(prev => prev + 1);
      setLqSecondsLeft(lqMinutesPerQuestion * 60);
    } else {
      setMcqIsActive(false);
      setMcqIsFinished(true);
      playExamChime(2);
    }
  };

  const handleToggleLqMilestone = (qIdx: number, stage: 'intro' | 'derivation' | 'diagram' | 'units') => {
    setLqMilestones(prev => {
      const curr = prev[qIdx] || { intro: false, derivation: false, diagram: false, units: false };
      return {
        ...prev,
        [qIdx]: {
          ...curr,
          [stage]: !curr[stage]
        }
      };
    });
  };

  const handleSelectMcqAnswer = (ans: string) => {
    setMcqAnswers(prev => ({ ...prev, [mcqCurrentIndex]: ans }));
    const timeSpent = mcqSecondsPerQuestion - mcqQuestionSecondsLeft;
    setMcqQuestionTimes(prev => ({ ...prev, [mcqCurrentIndex]: Math.max(1, timeSpent) }));

    // Instant advance if student solved question early
    if (mcqCurrentIndex < mcqTotalCount) {
      setMcqCurrentIndex(prev => prev + 1);
      setMcqQuestionSecondsLeft(mcqSecondsPerQuestion);
    } else {
      setMcqIsActive(false);
      setMcqIsFinished(true);
      playExamChime(2);
    }
  };

  const handleSkipMcqQuestion = () => {
    setMcqAnswers(prev => ({ ...prev, [mcqCurrentIndex]: 'SKIPPED' }));
    if (mcqCurrentIndex < mcqTotalCount) {
      setMcqCurrentIndex(prev => prev + 1);
      setMcqQuestionSecondsLeft(mcqSecondsPerQuestion);
    } else {
      setMcqIsActive(false);
      setMcqIsFinished(true);
      playExamChime(2);
    }
  };

  const handleFlagMcqQuestion = () => {
    setMcqAnswers(prev => ({
      ...prev,
      [mcqCurrentIndex]: prev[mcqCurrentIndex] ? `${prev[mcqCurrentIndex]} (FLAGGED)` : 'FLAGGED'
    }));
  };

  const handleSaveMcqAsMockTest = () => {
    const elapsedMins = Math.max(1, Math.round(mcqTotalElapsedSeconds / 60));
    const todayStr = new Date().toISOString().split('T')[0];
    const subName = mcqSelectedSubject || selectedSubjectName;
    const chapName = mcqSelectedChapter || selectedChapterName;

    onSaveSession({
      subjectName: subName,
      chapterName: chapName,
      topicName: `MCQ Exam Pacer Sprint (${mcqTotalCount} Questions)`,
      durationMinutes: elapsedMins,
      startTime: new Date(Date.now() - mcqTotalElapsedSeconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      endTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: todayStr,
      notes: `Attempted ${mcqTotalCount} MCQs at benchmark ${mcqSecondsPerQuestion}s/question. Total time: ${elapsedMins} mins.`
    });

    setEmailNotification({
      type: 'success',
      text: `✓ MCQ Exam Pacer session (${elapsedMins} mins) saved to Study Vault and Revision history!`
    });
  };

  const handleSetPreset = (mins: number) => {
    if (isActive) return;
    setTargetMinutes(mins);
    setSecondsLeft(mins * 60);
  };

  const handleStartTimer = () => {
    if (!selectedTopicName) {
      alert("Please select a subject, chapter, and topic before starting.");
      return;
    }
    const now = new Date();
    startTimeRef.current = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    startTimestampRef.current = Date.now();

    setIsActive(true);
    setIsPaused(false);
  };

  const handlePauseTimer = () => {
    setIsPaused(true);
  };

  const handleResumeTimer = () => {
    setIsPaused(false);
  };

  const handleStopTimer = () => {
    if (!isActive && secondsLeft === targetMinutes * 60) return;
    setIsActive(false);
    setIsPaused(false);
    const elapsedSeconds = targetMinutes * 60 - secondsLeft;
    const actualDurationMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
    setSessionLoggedMinutes(actualDurationMinutes);
    setSelectedResult('Completed');
    setIsFinishModalOpen(true);
  };

  const handleResetTimer = () => {
    setIsActive(false);
    setIsPaused(false);
    setSecondsLeft(targetMinutes * 60);
  };

  /**
   * Adds more time on the fly without resetting progress
   */
  const handleExtendTimer = (additionalMinutes: number) => {
    setTargetMinutes(prev => prev + additionalMinutes);
    setSecondsLeft(prev => prev + additionalMinutes * 60);
    setSessionLoggedMinutes(prev => prev + additionalMinutes);
    if (!isActive) {
      setIsActive(true);
      setIsPaused(false);
    }
    playChime();
    setEmailNotification({
      type: 'info',
      text: `⏱️ Extended session by +${additionalMinutes}m! New focus target: ${targetMinutes + additionalMinutes} mins.`
    });
  };

  /**
   * Dispatches WhatsApp study session debrief via direct link
   */
  const handleWhatsAppSession = (sessionData: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    result?: string;
    notes?: string;
    date?: string;
    sloCode?: string;
    sloName?: string;
    addedTo137?: boolean;
  }) => {
    const todayStr = sessionData.date || new Date().toISOString().split('T')[0];
    const todayTotal = (sessions || [])
      .filter(s => s.date === todayStr)
      .reduce((sum, s) => sum + (s.durationMinutes || 0), 0) + sessionData.durationMinutes;

    const milestones = calculate137Milestones(todayStr);

    const msg = generateCompletedWorkWhatsAppMessage({
      studentName: userProfile?.name || user?.displayName || 'Student',
      subjectName: sessionData.subjectName,
      chapterName: sessionData.chapterName,
      topicName: sessionData.topicName,
      sloCode: sessionData.sloCode,
      sloName: sessionData.sloName,
      durationMinutes: sessionData.durationMinutes,
      todayTotalMinutes: todayTotal,
      streak: userProfile?.studyStreak || 1,
      status: sessionData.result || 'Completed',
      notes: sessionData.notes,
      addedTo137: sessionData.addedTo137,
      cycleDates: sessionData.addedTo137 ? {
        day1: milestones.day1,
        day3: milestones.day3,
        day7: milestones.day7
      } : undefined
    });

    const targetPhone = recipientPhoneInput.trim() || userProfile?.whatsappNumber || '';
    const url = buildWhatsAppDirectUrl(targetPhone, msg);

    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setEmailNotification({
      type: 'success',
      text: `📲 WhatsApp debrief link prepared and opened!`
    });
  };

  const handleEmailSession = async (sessionData: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    durationMinutes: number;
    startTime?: string;
    endTime?: string;
    result: string;
    notes?: string;
  }) => {
    const targetEmail = userProfile?.email || user?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setEmailNotification({
        type: 'error',
        text: 'No email found in your user profile. Please specify your email in Settings.'
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailNotification(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todayTotal = (sessions || [])
        .filter(s => s.date === todayStr)
        .reduce((sum, s) => sum + (s.durationMinutes || 0), 0) + sessionData.durationMinutes;

      await sendStudySessionEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.name || user?.displayName || 'Student',
        subjectName: sessionData.subjectName,
        chapterName: sessionData.chapterName,
        topicName: sessionData.topicName,
        durationMinutes: sessionData.durationMinutes,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        result: sessionData.result,
        notes: sessionData.notes,
        todayTotalMinutes: todayTotal
      });

      setEmailNotification({
        type: 'success',
        text: `Study session record successfully emailed to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Session email error:', err);
      setEmailNotification({
        type: 'error',
        text: err?.message?.includes('popup')
          ? 'Browser pop-up was blocked. Please allow pop-ups for this tab to authenticate Gmail.'
          : `Failed to email session: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleEmailTodayTotal = async () => {
    const targetEmail = userProfile?.email || user?.email || getActiveUserEmail() || '';
    if (!targetEmail) {
      setEmailNotification({
        type: 'error',
        text: 'No email address found in profile. Please update Settings.'
      });
      return;
    }

    setIsSendingEmail(true);
    setEmailNotification(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const todaySessions = (sessions || []).filter(s => s.date === todayStr);
      const totalMins = todaySessions.reduce((sum, s) => sum + (s.durationMinutes || 0), 0);

      const completedTopics = todaySessions
        .filter(s => s.result === 'Completed')
        .map(s => ({
          topicName: s.topicName,
          subjectName: s.subjectName,
          duration: s.durationMinutes
        }));

      await sendDailyCompletedWorkEmail({
        recipientEmail: targetEmail,
        recipientName: userProfile?.name || user?.displayName || 'Student',
        completedTopics,
        todaySessions,
        totalStudyMinutes: totalMins,
        userProfile
      });

      setEmailNotification({
        type: 'success',
        text: `Today's complete study summary (${totalMins}m across ${todaySessions.length} sessions) emailed to ${targetEmail}!`
      });
    } catch (err: any) {
      console.error('Today total email error:', err);
      setEmailNotification({
        type: 'error',
        text: err?.message?.includes('popup')
          ? 'Browser pop-up was blocked. Please allow pop-ups for this tab to authenticate Gmail.'
          : `Failed to email daily summary: ${err?.message || 'Unknown error'}`
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSaveResult = async (options?: { sendEmail?: boolean; sendWhatsApp?: boolean }) => {
    const shouldEmail = options?.sendEmail !== undefined ? options.sendEmail : sendEmailOnFinish;
    const shouldWhatsApp = options?.sendWhatsApp !== undefined ? options.sendWhatsApp : sendWhatsAppOnFinish;

    const endNow = new Date();
    const endTimeStr = endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = endNow.toISOString().split('T')[0];
    const startTimeStr = startTimeRef.current || endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const finalDuration = Math.max(1, sessionLoggedMinutes);

    const isChapterSprint = activeMode === 'chapter_sprint';
    const subName = isChapterSprint ? selectedChapterSprintSubject : selectedSubjectName;
    const chapName = isChapterSprint
      ? (chapterScope === 'multi' ? (selectedMultiChapterNames.join(', ') || 'Multi-Chapter') : selectedSingleChapterName)
      : selectedChapterName;
    const goalTitle = chapterSprintGoal === 'test' ? 'Mock Test'
      : chapterSprintGoal === 'past_papers' ? 'Past Papers'
      : chapterSprintGoal === 'deep_study' ? 'Deep Study'
      : 'Comprehensive Revision';
    const topName = isChapterSprint
      ? (chapterScope === 'multi'
          ? `Multi-Chapter Sprint [${goalTitle}]: ${selectedMultiChapterNames.length} Chapters`
          : `Full Chapter Sprint [${goalTitle}]: ${selectedSingleChapterName}`)
      : selectedTopicName;

    const sprintNotePrefix = isChapterSprint
      ? `[${goalTitle}] ${chapterScope === 'multi' ? `Multi-Chapter: ${selectedMultiChapterNames.join(', ')}` : `Chapter: ${selectedSingleChapterName}`}. `
      : '';

    const combinedNotes = feynmanBlurt.trim()
      ? `${sprintNotePrefix}Feynman Blurt: "${feynmanBlurt.trim()}". ${sessionNotes ? `Notes: ${sessionNotes}` : ''}`
      : `${sprintNotePrefix}${sessionNotes}`.trim();

    const sloObj = isChapterSprint ? undefined : selectedTopic?.subtopics?.find(s => s.sloCode === selectedSloCode);

    const sessionPayload: Omit<StudySession, 'id'> = {
      userId: '',
      date: todayStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: finalDuration,
      subjectName: subName,
      chapterName: chapName,
      topicName: topName,
      sloCode: sloObj?.sloCode || undefined,
      sloName: sloObj?.name || undefined,
      addedTo137: addTo137OnFinish,
      result: selectedResult,
      notes: combinedNotes,
      timestamp: startTimestampRef.current || Date.now(),
      qualityScore: sessionQualityScore,
      deepWorkRating,
      focusPercentage: Math.max(20, 100 - (distractionCount * 12)),
      distractionCount,
      difficultyRating,
      activeRecallScore,
      outputSummary: outputSummary.trim() || undefined
    };

    onSaveSession(sessionPayload);
    setLastSavedSession({
      ...sessionPayload,
      date: todayStr
    });

    if (addTo137OnFinish && onAddTo137Cycle) {
      if (isChapterSprint) {
        const curSub = subjects.find(s => s.name === subName);
        if (chapterScope === 'single') {
          const chObj = curSub?.chapters.find(c => c.name === selectedSingleChapterName);
          if (chObj && chObj.topics.length > 0) {
            chObj.topics.forEach(t => {
              onAddTo137Cycle({
                subjectName: subName,
                chapterName: selectedSingleChapterName,
                topicName: t.name,
                studyDate: todayStr,
                timeSpentMinutes: Math.max(1, Math.round(finalDuration / chObj.topics.length)),
                notes: combinedNotes
              });
            });
          } else {
            onAddTo137Cycle({
              subjectName: subName,
              chapterName: chapName,
              topicName: topName,
              studyDate: todayStr,
              timeSpentMinutes: finalDuration,
              notes: combinedNotes
            });
          }
        } else {
          selectedMultiChapterNames.forEach(cn => {
            const chObj = curSub?.chapters.find(c => c.name === cn);
            if (chObj && chObj.topics.length > 0) {
              chObj.topics.forEach(t => {
                onAddTo137Cycle({
                  subjectName: subName,
                  chapterName: cn,
                  topicName: t.name,
                  studyDate: todayStr,
                  timeSpentMinutes: Math.max(1, Math.round(finalDuration / (selectedMultiChapterNames.length * chObj.topics.length))),
                  notes: combinedNotes
                });
              });
            } else {
              onAddTo137Cycle({
                subjectName: subName,
                chapterName: cn,
                topicName: `Chapter Revision: ${cn}`,
                studyDate: todayStr,
                timeSpentMinutes: Math.max(1, Math.round(finalDuration / selectedMultiChapterNames.length)),
                notes: combinedNotes
              });
            }
          });
        }
      } else {
        onAddTo137Cycle({
          subjectName: selectedSubjectName,
          chapterName: selectedChapterName,
          topicName: selectedTopicName,
          sloCode: selectedSloCode || undefined,
          sloName: sloObj?.name || undefined,
          studyDate: todayStr,
          timeSpentMinutes: finalDuration,
          notes: combinedNotes
        });
      }
    }

    setIsFinishModalOpen(false);
    setSessionNotes('');
    setFeynmanBlurt('');
    setSecondsLeft(targetMinutes * 60);

    // Multi-channel dispatch: Send to Email, WhatsApp, or BOTH
    if (shouldEmail && shouldWhatsApp) {
      await handleEmailSession(sessionPayload);
      handleWhatsAppSession(sessionPayload);
    } else if (shouldEmail) {
      await handleEmailSession(sessionPayload);
    } else if (shouldWhatsApp) {
      handleWhatsAppSession(sessionPayload);
    } else {
      setEmailNotification({
        type: 'info',
        text: `Session saved! (${finalDuration}m on ${topName})${addTo137OnFinish ? ' + Added to 1-3-7 Spaced Revision' : ''}.`
      });
    }
  };

  const handleSaveAndStartBlurt = async () => {
    const endNow = new Date();
    const endTimeStr = endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = endNow.toISOString().split('T')[0];
    const startTimeStr = startTimeRef.current || endNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const finalDuration = Math.max(1, sessionLoggedMinutes);

    const isChapterSprint = activeMode === 'chapter_sprint';
    const subName = isChapterSprint ? selectedChapterSprintSubject : selectedSubjectName;
    const chapName = isChapterSprint
      ? (chapterScope === 'multi' ? (selectedMultiChapterNames.join(', ') || 'Multi-Chapter') : selectedSingleChapterName)
      : selectedChapterName;
    const goalTitle = chapterSprintGoal === 'test' ? 'Mock Test'
      : chapterSprintGoal === 'past_papers' ? 'Past Papers'
      : chapterSprintGoal === 'deep_study' ? 'Deep Study'
      : 'Comprehensive Revision';
    const topName = isChapterSprint
      ? (chapterScope === 'multi'
          ? `Multi-Chapter Sprint [${goalTitle}]: ${selectedMultiChapterNames.length} Chapters`
          : `Full Chapter Sprint [${goalTitle}]: ${selectedSingleChapterName}`)
      : selectedTopicName;

    const sprintNotePrefix = isChapterSprint
      ? `[${goalTitle}] ${chapterScope === 'multi' ? `Multi-Chapter: ${selectedMultiChapterNames.join(', ')}` : `Chapter: ${selectedSingleChapterName}`}. `
      : '';

    const combinedNotes = feynmanBlurt.trim()
      ? `${sprintNotePrefix}Feynman Blurt: "${feynmanBlurt.trim()}". ${sessionNotes ? `Notes: ${sessionNotes}` : ''}`
      : `${sprintNotePrefix}${sessionNotes}`.trim();

    const sloObj = isChapterSprint ? undefined : selectedTopic?.subtopics?.find(s => s.sloCode === selectedSloCode);

    const sessionPayload: Omit<StudySession, 'id'> = {
      userId: '',
      date: todayStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMinutes: finalDuration,
      subjectName: subName,
      chapterName: chapName,
      topicName: topName,
      sloCode: sloObj?.sloCode || undefined,
      sloName: sloObj?.name || undefined,
      addedTo137: addTo137OnFinish,
      result: selectedResult,
      notes: combinedNotes,
      timestamp: startTimestampRef.current || Date.now(),
      qualityScore: sessionQualityScore,
      deepWorkRating,
      focusPercentage: Math.max(20, 100 - (distractionCount * 12)),
      distractionCount,
      difficultyRating,
      activeRecallScore,
      outputSummary: outputSummary.trim() || undefined
    };

    onSaveSession(sessionPayload);
    setLastSavedSession({
      ...sessionPayload,
      date: todayStr
    });

    if (addTo137OnFinish && onAddTo137Cycle) {
      if (isChapterSprint) {
        onAddTo137Cycle({
          subjectName: subName,
          chapterName: chapName,
          topicName: topName,
          studyDate: todayStr,
          timeSpentMinutes: finalDuration,
          notes: combinedNotes
        });
      } else {
        onAddTo137Cycle({
          subjectName: selectedSubjectName,
          chapterName: selectedChapterName,
          topicName: selectedTopicName,
          sloCode: selectedSloCode || undefined,
          sloName: sloObj?.name || undefined,
          studyDate: todayStr,
          timeSpentMinutes: finalDuration,
          notes: combinedNotes
        });
      }
    }

    setIsFinishModalOpen(false);
    if (feynmanBlurt.trim()) {
      setBlurtRecallText(feynmanBlurt.trim());
    }
    setSessionNotes('');
    setFeynmanBlurt('');
    setSecondsLeft(targetMinutes * 60);

    // Switch directly to AI Blurt & Notes Upload studio for this topic
    setActiveMode('blurt');
    handleGenerateBlurtPrompt();
  };

  // Format Minutes & Seconds for Vintage Calligraphic representation
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const minsFormatted = String(mins).padStart(2, '0');
  const secsFormatted = String(secs).padStart(2, '0');
  const formattedTime = `${minsFormatted}.${secsFormatted}`;

  const progressPercent = Math.min(
    100,
    ((targetMinutes * 60 - secondsLeft) / (targetMinutes * 60)) * 100
  );

  return (
    <motion.div
      variants={timerEntranceContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5 sm:space-y-6 max-w-4xl mx-auto relative px-1 sm:px-0"
    >
      {/* Header */}
      <motion.div
        variants={timerEntranceItemVariants}
        className="bg-card border border-theme rounded-3xl p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors"
      >
        <div>
          <h2 className="text-lg sm:text-xl font-serif italic font-bold text-primary flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span>Interactive Study Timer</span>
          </h2>
          <p className="text-xs text-muted mt-1">
            Focus timer automatically logs sessions to Firestore and tracks completed vs partial topics.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
          {/* Simple Timer Toggle */}
          <button
            onClick={() => {
              const next = !isSimpleTimerMode;
              setIsSimpleTimerMode(next);
              try { localStorage.setItem('studyflow_simple_timer_mode', String(next)); } catch (e) {}
            }}
            className={`px-3 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs border min-h-[44px] ${
              isSimpleTimerMode
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 ring-1 ring-amber-500/30'
                : 'bg-theme-accent text-primary border-theme hover:opacity-85'
            }`}
            title="Toggle Simple Timer: Minimalist stopwatch view without distraction widgets"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="whitespace-nowrap">{isSimpleTimerMode ? 'Simple Timer' : 'Timer Mode'}</span>
          </button>

          {/* Log Offline Study Button */}
          <button
            onClick={() => {
              setIsActive(false);
              setSessionLoggedMinutes(targetMinutes || 45);
              setIsFinishModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs bg-primary text-primary-content hover:opacity-90 min-h-[44px] active:scale-95"
            title="Log offline study session when studying without phone/iPad nearby"
          >
            <Edit3 className="w-4 h-4" />
            <span className="whitespace-nowrap">Log Offline Study</span>
          </button>

          {/* Printable Wall Calendar with Check-Off Boxes */}
          <button
            type="button"
            onClick={handlePrintWallCalendar}
            className="px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] active:scale-95"
            title="Print Monthly Academic Wall Calendar with daily check-off boxes"
          >
            <Printer className="w-4 h-4" />
            <span className="whitespace-nowrap">Print Wall Calendar</span>
          </button>

          {/* Email Today's Total Button */}
          <button
            onClick={handleEmailTodayTotal}
            disabled={isSendingEmail}
            className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs border bg-theme-accent text-primary border-theme hover:opacity-85 disabled:opacity-50 min-h-[44px]"
            title="Email today's total study session log to your Gmail"
          >
            {isSendingEmail ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Mail className="w-4 h-4 text-primary" />}
            <span className="whitespace-nowrap">Email Today</span>
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={() => setIsFocusMode(!isFocusMode)}
            className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs border min-h-[44px] active:scale-95 ${
              isFocusMode
                ? 'bg-primary text-white border-primary'
                : 'bg-theme-accent text-primary border-theme hover:opacity-85'
            }`}
          >
            {isFocusMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="whitespace-nowrap">{isFocusMode ? 'Focus Active' : 'Focus Mode'}</span>
          </button>
        </div>
      </motion.div>

      {/* Email Notification Alert Banner */}
      <AnimatePresence>
        {emailNotification && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`p-3.5 sm:p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              emailNotification.type === 'success' ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30' :
              emailNotification.type === 'error' ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30' :
              'bg-theme-accent text-primary border-theme'
            }`}
          >
            <div className="flex items-center gap-2">
              {emailNotification.type === 'success' ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Mail className="w-4 h-4 text-primary shrink-0" />
              )}
              <span className="leading-snug">{emailNotification.text}</span>
            </div>
            <button onClick={() => setEmailNotification(null)} className="text-current opacity-70 hover:opacity-100 cursor-pointer p-1">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Saved Session Banner with Instant 'Email Me' Action */}
      {lastSavedSession && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="p-4 rounded-2xl bg-card border border-theme shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-primary truncate">
                Session Saved: {lastSavedSession.subjectName} — {lastSavedSession.topicName}
              </div>
              <div className="text-[11px] text-muted flex flex-wrap items-center gap-1.5 sm:gap-2 mt-0.5">
                <span>{lastSavedSession.durationMinutes} mins saved</span>
                <span>•</span>
                <span className="text-emerald-700 dark:text-emerald-300 font-semibold">Saved to Revision & Progress</span>
                <span>•</span>
                <span>Finished at {lastSavedSession.endTime}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {onNavigateTab && (
              <>
                <button
                  type="button"
                  onClick={() => onNavigateTab('revision')}
                  className="px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold hover:opacity-85 transition cursor-pointer shrink-0 flex items-center gap-1 min-h-[38px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>View in Revision</span>
                </button>
                <button
                  type="button"
                  onClick={() => onNavigateTab('progress')}
                  className="px-3 py-2 rounded-xl bg-theme-accent text-primary border border-theme text-xs font-bold hover:opacity-85 transition cursor-pointer shrink-0 min-h-[38px]"
                >
                  View in Progress
                </button>
              </>
            )}
            <button
              onClick={() => handleEmailSession(lastSavedSession)}
              disabled={isSendingEmail}
              className="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer shrink-0 shadow-xs disabled:opacity-50 min-h-[38px]"
            >
              {isSendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              <span>Email Session</span>
            </button>
            <button
              type="button"
              onClick={() => handleWhatsAppSession(lastSavedSession)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs min-h-[38px]"
              title="Share this study session debrief via WhatsApp"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode('blurt');
                if (!blurtRecallText && lastSavedSession.notes) {
                  setBlurtRecallText(lastSavedSession.notes.replace(/^Feynman Blurt: "/, '').replace(/"\.\s*Notes:.*$/, ''));
                }
                handleGenerateBlurtPrompt();
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs min-h-[38px]"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Blurt & Notes</span>
            </button>
            <button
              type="button"
              onClick={() => handleTransferCurrentSessionToGoogleTasks(lastSavedSession)}
              disabled={isTransferringToGoogleTasks}
              className="px-3.5 py-2 rounded-xl bg-theme-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-xs min-h-[38px] disabled:opacity-50"
              title="Transfer ONLY this single study session to Google Tasks (1-Time, duplicates prevented)"
            >
              {isTransferringToGoogleTasks ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : isGoogleTasksTransferredSession ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
              ) : (
                <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span>{isGoogleTasksTransferredSession ? 'Google Tasks (Transferred ✓)' : 'Transfer to Google Tasks (1-Time)'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Mode Switcher: 4 Academic Engine Options + Focus Timer */}
      <motion.div variants={timerEntranceItemVariants} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-surface border border-theme rounded-2xl w-full sm:w-auto shadow-2xs overflow-x-auto">
          {/* Option 1: Board Exam Pressure Pacer */}
          <button
            type="button"
            onClick={() => setActiveMode('mcq_pacer')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeMode === 'mcq_pacer'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Target className="w-4 h-4 text-rose-300" />
            <span>Option 1: Exam Pressure</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-rose-500/20 text-current font-mono font-bold">
              {examPressureType === 'mcq'
                ? `${mcqSecondsPerQuestion}s MCQ`
                : examPressureType === 'short_question'
                ? `${sqMinutesPerQuestion}m SQ`
                : examPressureType === 'long_question'
                ? `${lqMinutesPerQuestion}m LQ`
                : 'Board Sim'}
            </span>
          </button>

          {/* Option 2: Full Chapter & Multi-Chapter Sprint */}
          <button
            type="button"
            onClick={() => setActiveMode('chapter_sprint')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeMode === 'chapter_sprint'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-300" />
            <span>Option 2: Chapter Sprint</span>
          </button>

          {/* Option 3: AI Blurt & Notes Studio */}
          <button
            type="button"
            onClick={() => {
              setActiveMode('blurt');
              if (!blurtPrompt) {
                handleGenerateBlurtPrompt();
              }
            }}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeMode === 'blurt'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>Option 3: AI Blurt</span>
          </button>

          {/* Option 4: Rupex Rubric Locker & Saved Schemes */}
          <button
            type="button"
            onClick={() => setActiveMode('rupex_locker')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeMode === 'rupex_locker'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Award className="w-4 h-4 text-indigo-300" />
            <span>Option 4: Rupex Locker</span>
          </button>

          {/* Classic Focus Timer */}
          <button
            type="button"
            onClick={() => setActiveMode('timer')}
            className={`flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] whitespace-nowrap ${
              activeMode === 'timer'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-primary'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Topic Focus</span>
          </button>
        </div>

        {/* Quick Topic / Chapter Indicator */}
        <div className="text-[11px] font-mono text-muted flex items-center gap-2">
          <span>{activeMode === 'mcq_pacer' ? 'Pacer Goal:' : activeMode === 'chapter_sprint' ? 'Sprint Target:' : activeMode === 'rupex_locker' ? 'Rupex Schemes:' : 'Target Topic:'}</span>
          <span className="font-bold text-primary truncate max-w-[220px]">
            {activeMode === 'mcq_pacer'
              ? `${mcqTotalCount} MCQ${mcqTotalCount === 1 ? '' : 's'} (${mcqSecondsPerQuestion}s/Q)`
              : activeMode === 'chapter_sprint'
              ? (chapterScope === 'multi' ? `${selectedMultiChapterNames.length} Chapters (${selectedMultiChapterNames.join(', ') || 'None'})` : selectedSingleChapterName)
              : activeMode === 'rupex_locker'
              ? (rubricFile ? rubricFile.name : `${savedRupexList.length} Rubrics Saved`)
              : selectedTopicName}
          </span>
        </div>
      </motion.div>

      {/* VIEW 1: TIMER MODE */}
      {activeMode === 'timer' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 sm:space-y-8 relative overflow-hidden transition-colors"
        >
          {/* Subtle background glow when active */}
          {isActive && !isPaused && (
            <div className="absolute inset-0 bg-primary/5 pointer-events-none animate-pulse"></div>
          )}

          {/* Simple Timer Mode / Minimalist Mode */}
          {isSimpleTimerMode && !isFocusMode ? (
            <div className="space-y-6 text-center py-4 sm:py-6">
              <div className="flex items-center justify-between border-b border-theme/60 pb-3">
                <div className="text-left">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Simple Timer Mode</span>
                  </span>
                  <span className="text-[11px] text-muted">Minimalist stopwatch & countdown without distraction widgets</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSimpleTimerMode(false);
                    try { localStorage.setItem('studyflow_simple_timer_mode', 'false'); } catch (e) {}
                  }}
                  className="text-xs text-primary hover:underline font-bold cursor-pointer"
                >
                  Switch to Full Timer →
                </button>
              </div>

              {/* Minimalist Subject & Topic Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 max-w-2xl mx-auto text-left text-xs">
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Subject</label>
                  <select
                    disabled={isActive}
                    value={selectedSubjectName}
                    onChange={(e) => setSelectedSubjectName(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-theme rounded-xl font-bold text-primary focus:outline-none"
                  >
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Chapter</label>
                  <select
                    disabled={isActive}
                    value={selectedChapterName}
                    onChange={(e) => setSelectedChapterName(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-theme rounded-xl font-bold text-primary focus:outline-none"
                  >
                    {selectedSubject?.chapters.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted uppercase block mb-1">Topic</label>
                  <select
                    disabled={isActive}
                    value={selectedTopicName}
                    onChange={(e) => setSelectedTopicName(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-theme rounded-xl font-bold text-primary focus:outline-none"
                  >
                    {selectedChapter?.topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Giant Digits */}
              <div className="py-6">
                <div className={`text-8xl sm:text-9xl md:text-[10rem] font-light tracking-tight ${timerThemeClasses.text} flex items-center justify-center font-calligraphic italic select-none`}>
                  <span>{minsFormatted}</span>
                  <span className="opacity-30 mx-1">:</span>
                  <span>{secsFormatted}</span>
                </div>
                <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted mt-2">
                  {isActive ? (isPaused ? '⏸ Paused' : '⚡ Deep Focus Active') : 'Ready to Focus'}
                </p>
              </div>

              {/* Preset Durations */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[15, 25, 45, 60, 90].map(m => (
                  <button
                    key={m}
                    type="button"
                    disabled={isActive}
                    onClick={() => {
                      setTargetMinutes(m);
                      setSecondsLeft(m * 60);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                      targetMinutes === m
                        ? 'bg-primary text-white shadow-xs'
                        : 'bg-surface border border-theme text-muted hover:text-primary'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              {/* Primary Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
                {!isActive && !isPaused && (
                  <button
                    onClick={handleStartTimer}
                    className="px-10 py-3.5 rounded-full bg-primary hover:opacity-90 text-white font-bold text-sm tracking-wider uppercase transition shadow-md flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Start Timer</span>
                  </button>
                )}

                {isActive && !isPaused && (
                  <button
                    onClick={handlePauseTimer}
                    className="px-8 py-3.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm tracking-wider uppercase transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Pause className="w-5 h-5 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {isActive && isPaused && (
                  <button
                    onClick={handleResumeTimer}
                    className="px-8 py-3.5 rounded-full bg-primary hover:opacity-90 text-white font-bold text-sm tracking-wider uppercase transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(isActive || secondsLeft < targetMinutes * 60) && (
                  <button
                    onClick={handleStopTimer}
                    className="px-8 py-3.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm tracking-wider uppercase transition shadow-xs flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish & Save</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-3 rounded-full bg-surface hover:bg-theme-accent text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : isFocusMode ? (
            <div className="space-y-6 text-center py-2 sm:py-4">
              {/* Focus Mode Header Bar */}
              <div className="flex items-center justify-between gap-3 border-b border-theme/40 pb-4">
                <div className="flex items-center gap-2 text-left min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-primary block truncate">Distraction-Free Focus Mode</span>
                    <span className="text-[11px] text-muted block truncate">{selectedSubjectName} &bull; {selectedTopicName}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsFullscreenFocus(true)}
                    className="p-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[38px]"
                    title="Toggle Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">Fullscreen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsFocusMode(false)}
                    className="px-3 py-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1 cursor-pointer min-h-[38px]"
                    title="Exit Focus Mode"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Exit</span>
                  </button>
                </div>
              </div>

              {/* Monumental Clock with Subtle Ambient Aura */}
              <div className="relative inline-block my-2 sm:my-4">
                {isActive && !isPaused && (
                  <div className={`absolute -inset-6 sm:-inset-10 ${timerThemeClasses.glow} rounded-full blur-2xl pointer-events-none animate-pulse`}></div>
                )}
                <div className={`text-7xl sm:text-9xl md:text-[9.5rem] tracking-tight ${timerThemeClasses.text} relative select-none transition-all flex items-baseline justify-center font-normal ${
                  timerFontStyle === 'cursive' 
                    ? 'font-vintage-cursive italic' 
                    : timerFontStyle === 'serif'
                    ? 'font-serif'
                    : 'font-calligraphic italic'
                }`}>
                  <span className="font-light">{minsFormatted}</span>
                  <span className="opacity-40 mx-1 sm:mx-1.5 text-[0.65em] font-light select-none">.</span>
                  <span className="font-light text-[0.88em] opacity-90">{secsFormatted}</span>
                </div>
              </div>

              {/* Status Label */}
              <div className="space-y-1">
                <p className={`text-xs font-mono font-bold tracking-widest ${timerThemeClasses.text} uppercase`}>
                  {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ DEEP FOCUS IN PROGRESS') : 'READY TO FOCUS'}
                </p>
                {isActive && !isPaused && isAmbientSoundOn && (
                  <p className="text-[11px] text-muted flex items-center justify-center gap-1.5 font-mono">
                    <Headphones className="w-3.5 h-3.5 text-primary animate-pulse" />
                    <span>Subtle ambient {ambientSoundType} soundscape</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-lg mx-auto bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme shadow-2xs">
                <div
                  className={`${timerThemeClasses.bar} h-full rounded-full transition-all duration-300`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Audio Controls Pill & Chime Preview */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <div className="inline-flex items-center justify-center gap-2 bg-theme-accent/70 border border-theme rounded-full px-4 py-1.5 text-xs text-primary shadow-2xs">
                  <button
                    onClick={() => setIsAmbientSoundOn(!isAmbientSoundOn)}
                    className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition cursor-pointer min-h-[32px]"
                  >
                    {isAmbientSoundOn ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                    <span className="text-[11px] font-mono">{isAmbientSoundOn ? 'Sound On' : 'Muted'}</span>
                  </button>
                  {isAmbientSoundOn && (
                    <>
                      <div className="h-3 w-px bg-theme"></div>
                      <select
                        value={ambientSoundType}
                        onChange={(e) => setAmbientSoundType(e.target.value as any)}
                        className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="white" className="bg-card text-primary">White Noise</option>
                        <option value="pink" className="bg-card text-primary">Pink Noise</option>
                        <option value="rain" className="bg-card text-primary">Soft Rain</option>
                      </select>
                      <input
                        type="range"
                        min={0.02}
                        max={0.4}
                        step={0.02}
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-12 sm:w-16 accent-current cursor-pointer"
                        title={`Volume: ${Math.round(ambientVolume * 100)}%`}
                      />
                    </>
                  )}
                </div>

                {/* Test Sound Chime Button */}
                <button
                  onClick={playChime}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent/80 hover:bg-theme-accent text-primary border border-theme text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs min-h-[36px]"
                  title="Play sample chime to test audio volume"
                >
                  <Bell className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[11px]">Test Sound</span>
                </button>

                {/* Auto-Start 5m Break Toggle */}
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent/80 hover:bg-theme-accent text-primary border border-theme text-xs font-semibold cursor-pointer select-none transition shadow-2xs min-h-[36px]">
                  <input
                    type="checkbox"
                    checked={autoStartBreak}
                    onChange={(e) => {
                      setAutoStartBreak(e.target.checked);
                      try {
                        localStorage.setItem('studyflow_auto_start_break', String(e.target.checked));
                      } catch {}
                    }}
                    className="w-3.5 h-3.5 accent-current rounded cursor-pointer"
                  />
                  <Coffee className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-mono text-[11px]">Auto-start 5m break</span>
                </label>
              </div>

              {/* Focus Controls */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                {!isActive && !isPaused && (
                  <button
                    onClick={handleStartTimer}
                    className="px-8 sm:px-12 py-3.5 sm:py-4 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer min-h-[46px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Begin Deep Focus</span>
                  </button>
                )}

                {isActive && !isPaused && (
                  <button
                    onClick={handlePauseTimer}
                    className="px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {isActive && isPaused && (
                  <button
                    onClick={handleResumeTimer}
                    className="px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(isActive || secondsLeft < targetMinutes * 60) && (
                  <button
                    onClick={handleStopTimer}
                    className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish Session</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-3 rounded-full bg-theme-accent hover:opacity-85 text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Add More Time Pills */}
              <div className="w-full flex items-center justify-center gap-1.5 pt-1 flex-wrap">
                <span className="text-[11px] font-bold text-muted mr-1 flex items-center gap-1">
                  <Plus className="w-3 h-3 text-primary" />
                  <span>Add Time:</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(5)}
                  className="px-2.5 py-1 rounded-full bg-theme-accent hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 border border-theme text-xs font-bold text-primary transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Add 5 minutes to current timer"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(10)}
                  className="px-2.5 py-1 rounded-full bg-theme-accent hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 border border-theme text-xs font-bold text-primary transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Add 10 minutes to current timer"
                >
                  +10m
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(15)}
                  className="px-2.5 py-1 rounded-full bg-theme-accent hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 border border-theme text-xs font-bold text-primary transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Add 15 minutes to current timer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(25)}
                  className="px-2.5 py-1 rounded-full bg-theme-accent hover:bg-emerald-500/15 hover:text-emerald-700 dark:hover:text-emerald-300 border border-theme text-xs font-bold text-primary transition cursor-pointer active:scale-95 shadow-2xs"
                  title="Add 25 minutes to current timer"
                >
                  +25m
                </button>
              </div>

              {/* Keyboard Hotkeys Hint */}
              <div className="w-full flex items-center justify-center gap-3 pt-2 text-[11px] font-mono text-muted select-none flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">Space</kbd>
                  <span>{isActive ? (isPaused ? 'Resume' : 'Pause') : 'Start'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">F</kbd>
                  <span>Zen Fullscreen</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-theme text-[10px] text-primary font-bold shadow-2xs">Esc</kbd>
                  <span>Exit Focus</span>
                </span>
              </div>
            </div>
          ) : (
            /* Standard Configurable Timer View */
            <>
              {/* Study Session Quality Score & Deep Work Dashboard */}
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/60 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      sessionQualityScore >= 85 ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' :
                      sessionQualityScore >= 70 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' :
                      'bg-stone-500/20 text-stone-700 dark:text-stone-300'
                    }`}>
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-primary">
                          Study Session Quality Score
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          deepWorkRating === 'Deep Work' ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40' :
                          deepWorkRating === 'Moderate Focus' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40' :
                          deepWorkRating === 'Fragmented' ? 'bg-amber-500/10 text-amber-800 border border-amber-300' :
                          'bg-rose-500/10 text-rose-800 border border-rose-300'
                        }`}>
                          {deepWorkRating}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted">
                        Deep work evaluation: focus consistency, content rigor, active retention & tangible output
                      </p>
                    </div>
                  </div>

                  {/* Live Score Counter */}
                  <div className="flex items-baseline gap-1 self-start sm:self-auto bg-theme-accent/60 px-3.5 py-1.5 rounded-xl border border-theme">
                    <span className="text-xl font-bold font-mono text-primary">{sessionQualityScore}</span>
                    <span className="text-xs text-muted font-mono">/100</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                  {/* 1. Distraction Interruptions */}
                  <div className="p-3 rounded-xl bg-card border border-theme space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Distractions</span>
                      <span className="text-xs font-mono font-bold text-primary">{distractionCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDistractionCount(prev => prev + 1)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-[11px] font-bold transition cursor-pointer"
                      >
                        + Log Distraction
                      </button>
                      {distractionCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDistractionCount(prev => Math.max(0, prev - 1))}
                          className="px-2 py-1.5 rounded-lg bg-theme-accent hover:opacity-80 text-muted text-[11px] font-bold transition cursor-pointer"
                        >
                          -
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted block">Phone check, multitasking, or interrupted focus</span>
                  </div>

                  {/* 2. Content Rigor / Difficulty */}
                  <div className="p-3 rounded-xl bg-card border border-theme space-y-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Content Rigor</span>
                    <select
                      value={difficultyRating}
                      onChange={(e) => setDifficultyRating(e.target.value as any)}
                      className="w-full p-1.5 bg-theme-accent border border-theme rounded-lg text-xs font-semibold text-primary focus:outline-none cursor-pointer"
                    >
                      <option value="Introductory">Introductory (70)</option>
                      <option value="Standard">Standard (85)</option>
                      <option value="Rigorous">Rigorous (95)</option>
                      <option value="Past Paper Level">Past Paper Level (100)</option>
                    </select>
                    <span className="text-[10px] text-muted block">Difficulty tier multiplier</span>
                  </div>

                  {/* 3. Active Retention Check */}
                  <div className="p-3 rounded-xl bg-card border border-theme space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-muted uppercase tracking-wider">Active Retention</span>
                      <span className="text-xs font-mono font-bold text-primary">{activeRecallScore}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[100, 85, 70, 50].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setActiveRecallScore(val)}
                          className={`py-1 rounded text-[10px] font-bold transition cursor-pointer ${
                            activeRecallScore === val ? 'bg-teal-600 text-white' : 'bg-theme-accent text-muted hover:text-primary'
                          }`}
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                    <span className="text-[10px] text-muted block">Self-tested retrieval strength</span>
                  </div>

                  {/* 4. Tangible Output Log */}
                  <div className="p-3 rounded-xl bg-card border border-theme space-y-2">
                    <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">Tangible Output</span>
                    <input
                      type="text"
                      value={outputSummary}
                      onChange={(e) => setOutputSummary(e.target.value)}
                      placeholder="e.g. 5 numericals, 1 page notes"
                      className="w-full p-1.5 bg-theme-accent border border-theme rounded-lg text-xs text-primary placeholder-muted focus:outline-none"
                    />
                    <span className="text-[10px] text-muted block">Solved questions or summary created</span>
                  </div>
                </div>
              </div>

              {/* Topic Selector Block */}
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="text-xs font-bold text-primary uppercase tracking-widest font-mono flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  <span>Target Subject & Topic</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Subject Dropdown */}
                  <div>
                    <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Subject</label>
                    <select
                      disabled={isActive}
                      value={selectedSubjectName}
                      onChange={(e) => setSelectedSubjectName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {subjects.map((sub) => (
                        <option key={sub.id} value={sub.name}>{sub.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Chapter Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Chapter</label>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChapterSprintSubject(selectedSubjectName);
                          setSelectedSingleChapterName(selectedChapterName);
                          setChapterScope('single');
                          setActiveMode('chapter_sprint');
                        }}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                        title="Attempt or revise this full chapter"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Sprint Chapter →</span>
                      </button>
                    </div>
                    <select
                      disabled={isActive}
                      value={selectedChapterName}
                      onChange={(e) => setSelectedChapterName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {selectedSubject?.chapters.map((ch) => (
                        <option key={ch.id} value={ch.name}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Topic Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-muted uppercase tracking-widest">Topic</label>
                      {(() => {
                        const topicObj = selectedChapter?.topics.find(t => t.name === selectedTopicName);
                        if (!topicObj) return null;
                        const isMastered = topicObj.status === 'Mastered';
                        const isCompleted = topicObj.status === 'Completed';
                        const isWeak = topicObj.status === 'Weak' || topicObj.status === 'Needs Revision';
                        return (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isMastered ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            isCompleted ? 'bg-teal-50 text-teal-800 border-teal-300' :
                            isWeak ? 'bg-rose-50 text-rose-800 border-rose-300' :
                            'bg-amber-50 text-amber-800 border-amber-300'
                          }`}>
                            {topicObj.status}
                          </span>
                        );
                      })()}
                    </div>
                    <select
                      disabled={isActive}
                      value={selectedTopicName}
                      onChange={(e) => setSelectedTopicName(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {selectedChapter?.topics.map((tp) => (
                        <option key={tp.id} value={tp.name}>
                          {tp.status === 'Mastered' ? '⭐ ' : tp.status === 'Completed' ? '✓ ' : ''}{tp.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* SLO / Learning Outcome */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-bold text-muted uppercase tracking-widest">SLO Target</label>
                      {selectedSloCode && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          {selectedSloCode}
                        </span>
                      )}
                    </div>
                    <select
                      disabled={isActive}
                      value={selectedSloCode}
                      onChange={(e) => setSelectedSloCode(e.target.value)}
                      className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                    >
                      {selectedTopic?.subtopics && selectedTopic.subtopics.length > 0 ? (
                        selectedTopic.subtopics.map((sub, idx) => (
                          <option key={sub.id || idx} value={sub.sloCode || `SLO-${idx + 1}`}>
                            {sub.sloCode ? `[${sub.sloCode}] ` : ''}{sub.name}
                          </option>
                        ))
                      ) : (
                        <option value="">General Topic Mastery (All SLOs)</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Quick Syllabus Launchers (Zen Sprint & Cheat Sheet) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-theme/40 text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-muted font-mono">Linked Tools:</span>
                    {onOpenZenSprint && (
                      <button
                        type="button"
                        onClick={() => onOpenZenSprint(selectedSubjectName, selectedTopicName)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Start Zen Sprint</span>
                      </button>
                    )}
                    {onOpenCheatSheet && (
                      <button
                        type="button"
                        onClick={() => onOpenCheatSheet(selectedSubjectName, selectedTopicName)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>AI Cheat Sheet</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveMode('blurt');
                        handleGenerateBlurtPrompt();
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>AI Blurt & Notes</span>
                    </button>
                  </div>
                </div>

                {/* Time Saved on this topic display */}
                <div className="pt-2 border-t border-theme/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  {topicSavedStats.minutes > 0 ? (
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex">
                        <Timer className="w-3.5 h-3.5" />
                      </span>
                      <span>
                        Saved on <strong>{selectedTopicName}</strong>: <strong className="text-primary">{topicSavedStats.minutes} mins</strong> across <strong>{topicSavedStats.count} session{topicSavedStats.count > 1 ? 's' : ''}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-muted text-[11px]">
                      <Timer className="w-3.5 h-3.5 text-muted" />
                      <span>Timer duration automatically logs into <strong>Revision</strong> &amp; <strong>Progress</strong>.</span>
                    </div>
                  )}

                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('revision')}
                      className="text-[11px] font-bold text-primary hover:opacity-80 underline cursor-pointer self-start sm:self-auto"
                    >
                      Go to Revision Queue →
                    </button>
                  )}
                </div>
              </div>

              {/* Preset Selector */}
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[25, 45, 60, 90].map((mins) => (
                  <button
                    key={mins}
                    disabled={isActive}
                    onClick={() => handleSetPreset(mins)}
                    className={`px-3.5 sm:px-4 py-2 rounded-full text-xs font-bold font-mono transition border min-h-[40px] active:scale-95 cursor-pointer ${
                      targetMinutes === mins
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface text-muted border-theme hover:text-primary hover:border-primary/50'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}

                <div className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-full border border-theme min-h-[40px]">
                  <input
                    type="number"
                    disabled={isActive}
                    min={1}
                    max={180}
                    value={customMinutes}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setCustomMinutes(val);
                      handleSetPreset(val);
                    }}
                    className="w-12 bg-transparent text-xs text-primary font-mono font-bold focus:outline-none text-center"
                  />
                  <span className="text-[11px] text-muted font-mono pr-1">custom min</span>
                </div>
              </div>

              {/* Original & Custom Timer Color & Typography Style Selectors */}
              <div className="flex items-center justify-center gap-2 flex-wrap pt-0.5">
                {/* Vintage Calligraphic Typography Selector */}
                <div className="flex items-center gap-1.5 bg-surface border border-theme rounded-full px-3 py-1 text-[11px] font-mono text-muted shadow-2xs flex-wrap justify-center">
                  <span className="font-semibold mr-1">Typography:</span>
                  {[
                    { id: 'calligraphic', label: '🖋️ Vintage Calligraphic' },
                    { id: 'cursive', label: '📜 Calligraphic Cursive' },
                    { id: 'serif', label: '🏛️ Editorial Serif' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setTimerFontStyle(f.id as any);
                        try { localStorage.setItem('studyflow_timer_font_style', f.id); } catch {}
                      }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer flex items-center gap-1 min-h-[26px] ${
                        timerFontStyle === f.id
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted hover:text-primary hover:bg-theme-accent'
                      }`}
                    >
                      <span>{f.label}</span>
                    </button>
                  ))}
                </div>

                {/* Color Palette Selector */}
                <div className="flex items-center gap-1.5 bg-surface border border-theme rounded-full px-3 py-1 text-[11px] font-mono text-muted shadow-2xs flex-wrap justify-center">
                  <Palette className="w-3.5 h-3.5 text-muted" />
                  <span className="font-semibold mr-1">Color:</span>
                  {[
                    { id: 'original_sage', label: 'Classic Sage', hex: '#6B705C' },
                    { id: 'emerald', label: 'Emerald', hex: '#059669' },
                    { id: 'amber', label: 'Amber', hex: '#D97706' },
                    { id: 'classic', label: 'Obsidian', hex: '#374151' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTimerColorTheme(t.id as any);
                        try { localStorage.setItem('studyflow_timer_color_theme', t.id); } catch {}
                      }}
                      className={`px-2 py-1 rounded-full text-[10px] font-bold transition cursor-pointer flex items-center gap-1.5 min-h-[26px] ${
                        timerColorTheme === t.id
                          ? 'bg-primary text-white shadow-xs'
                          : 'text-muted hover:text-primary hover:bg-theme-accent'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.hex }} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vintage Calligraphic Clock Face */}
              <div className="text-center space-y-3 sm:space-y-4 py-2 sm:py-4">
                <div className={`text-6xl sm:text-8xl md:text-9xl tracking-tight ${timerThemeClasses.text} select-none transition-all flex items-baseline justify-center font-normal ${
                  timerFontStyle === 'cursive' 
                    ? 'font-vintage-cursive italic' 
                    : timerFontStyle === 'serif'
                    ? 'font-serif'
                    : 'font-calligraphic italic'
                }`}>
                  <span className="font-light">{minsFormatted}</span>
                  <span className="opacity-40 mx-1 sm:mx-1.5 text-[0.65em] font-light select-none">.</span>
                  <span className="font-light text-[0.88em] opacity-90">{secsFormatted}</span>
                </div>

                <p className={`text-xs font-mono font-bold ${timerThemeClasses.text} tracking-widest uppercase`}>
                  {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ FOCUSING IN PROGRESS') : 'READY TO STUDY'}
                </p>

                {/* Progress Bar */}
                <div className="w-full max-w-md mx-auto bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme shadow-2xs">
                  <div
                    className={`${timerThemeClasses.bar} h-full rounded-full transition-all duration-300`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>

                {/* Ambient Sound Bar */}
                <div className="inline-flex items-center justify-center gap-2 bg-theme-accent/60 border border-theme rounded-full px-3.5 py-1.5 text-xs text-primary mt-2">
                  <button
                    onClick={() => setIsAmbientSoundOn(!isAmbientSoundOn)}
                    className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition cursor-pointer"
                    title={isAmbientSoundOn ? "Mute Study Ambient Noise" : "Enable Study Ambient Noise"}
                  >
                    {isAmbientSoundOn ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                    <span className="text-[11px] font-mono">
                      {isAmbientSoundOn ? `${ambientSoundType.toUpperCase()}` : 'Ambient Sound'}
                    </span>
                  </button>

                  {isAmbientSoundOn && (
                    <>
                      <div className="h-3 w-px bg-theme"></div>
                      <select
                        value={ambientSoundType}
                        onChange={(e) => setAmbientSoundType(e.target.value as any)}
                        className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer"
                      >
                        <option value="white" className="bg-card text-primary">White Noise</option>
                        <option value="pink" className="bg-card text-primary">Pink Noise</option>
                        <option value="rain" className="bg-card text-primary">Soft Rain</option>
                      </select>
                      <input
                        type="range"
                        min={0.02}
                        max={0.4}
                        step={0.02}
                        value={ambientVolume}
                        onChange={(e) => setAmbientVolume(parseFloat(e.target.value))}
                        className="w-12 sm:w-16 accent-current cursor-pointer"
                        title={`Volume: ${Math.round(ambientVolume * 100)}%`}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 pt-2">
                {!isActive && !isPaused && (
                  <button
                    onClick={handleStartTimer}
                    className="px-7 sm:px-10 py-3.5 sm:py-4 rounded-full bg-primary hover:opacity-90 text-white font-medium text-xs sm:text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer min-h-[46px]"
                  >
                    <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
                    <span>START STUDY SESSION</span>
                  </button>
                )}

                {isActive && !isPaused && (
                  <button
                    onClick={handlePauseTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </button>
                )}

                {isActive && isPaused && (
                  <button
                    onClick={handleResumeTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Resume</span>
                  </button>
                )}

                {(isActive || secondsLeft < targetMinutes * 60) && (
                  <button
                    onClick={handleStopTimer}
                    className="px-5 sm:px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Finish & Record</span>
                  </button>
                )}

                <button
                  onClick={handleResetTimer}
                  className="p-3 rounded-full bg-surface hover:opacity-85 text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Add Time (Zen Mode) */}
              <div className="w-full flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleExtendTimer(5)}
                  className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(10)}
                  className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
                >
                  +10m
                </button>
                <button
                  type="button"
                  onClick={() => handleExtendTimer(15)}
                  className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
                >
                  +15m
                </button>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* VIEW 2: FULL CHAPTER & MULTI-CHAPTER SPRINT */}
      {activeMode === 'chapter_sprint' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 sm:space-y-8 relative overflow-hidden transition-colors"
        >
          {/* Subtle background glow when active */}
          {isActive && !isPaused && (
            <div className="absolute inset-0 bg-primary/5 pointer-events-none animate-pulse"></div>
          )}

          {/* Chapter Sprint Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Layers className="w-4 h-4 text-emerald-500" />
                </span>
                <h3 className="text-base sm:text-lg font-serif italic font-bold text-primary">
                  Full Chapter &amp; Multi-Chapter Sprint Mode
                </h3>
              </div>
              <p className="text-xs text-muted mt-1">
                Attempt tests or comprehensive revision of a complete chapter or batch multiple chapters at once without topic-by-topic friction.
              </p>
            </div>

            {/* Scope Toggle: Single vs Multi */}
            <div className="flex items-center bg-surface border border-theme rounded-xl p-1 text-xs self-start sm:self-auto">
              <button
                type="button"
                disabled={isActive}
                onClick={() => setChapterScope('single')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  chapterScope === 'single'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Single Chapter</span>
              </button>
              <button
                type="button"
                disabled={isActive}
                onClick={() => setChapterScope('multi')}
                className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                  chapterScope === 'multi'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Multiple Chapters</span>
              </button>
            </div>
          </div>

          {/* Config Block: Subject, Chapter(s), and Sprint Goal */}
          <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Subject Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Target Subject</label>
                <select
                  disabled={isActive}
                  value={selectedChapterSprintSubject}
                  onChange={(e) => {
                    const subName = e.target.value;
                    setSelectedChapterSprintSubject(subName);
                    const sub = subjects.find(s => s.name === subName);
                    if (sub && sub.chapters.length > 0) {
                      setSelectedSingleChapterName(sub.chapters[0].name);
                      setSelectedMultiChapterNames([sub.chapters[0].name]);
                    }
                  }}
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                >
                  {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>

              {/* Singular Chapter Selector */}
              {chapterScope === 'single' && (
                <div>
                  <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Target Chapter</label>
                  <select
                    disabled={isActive}
                    value={selectedSingleChapterName}
                    onChange={(e) => setSelectedSingleChapterName(e.target.value)}
                    className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                  >
                    {selectedSprintSubject?.chapters.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name} ({c.topics.length} topics)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sprint Goal Selector */}
              <div className={chapterScope === 'multi' ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] font-bold text-muted uppercase tracking-widest mb-1">Sprint Activity &amp; Test Goal</label>
                <select
                  disabled={isActive}
                  value={chapterSprintGoal}
                  onChange={(e) => setChapterSprintGoal(e.target.value as any)}
                  className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary font-semibold min-h-[42px] cursor-pointer"
                >
                  <option value="test">📝 Full Chapter Mock Test Attempt</option>
                  <option value="revision">⚡ Comprehensive Chapter Revision</option>
                  <option value="past_papers">🎯 Past Paper Practice Questions</option>
                  <option value="deep_study">🧠 Deep Focused Study Block</option>
                </select>
              </div>
            </div>

            {/* Scope Details: Multi-Chapter Checklist */}
            {chapterScope === 'multi' ? (
              <div className="space-y-2 pt-2 border-t border-theme/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Select Chapters to Include in This Sprint:</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => {
                        setSelectedMultiChapterNames(selectedSprintSubject?.chapters.map(c => c.name) || []);
                      }}
                      className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer disabled:opacity-50"
                    >
                      Select All ({selectedSprintSubject?.chapters.length})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      disabled={isActive}
                      onClick={() => setSelectedMultiChapterNames([])}
                      className="text-[11px] text-muted hover:text-primary cursor-pointer disabled:opacity-50"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {selectedSprintSubject?.chapters.map(ch => {
                    const isChecked = selectedMultiChapterNames.includes(ch.name);
                    return (
                      <label
                        key={ch.id}
                        className={`p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition select-none ${
                          isChecked
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-primary'
                            : 'bg-card border-theme text-muted hover:bg-theme-accent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={isActive}
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMultiChapterNames(prev => [...prev, ch.name]);
                            } else {
                              setSelectedMultiChapterNames(prev => prev.filter(n => n !== ch.name));
                            }
                          }}
                          className="w-4 h-4 accent-primary rounded cursor-pointer"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-bold block truncate">{ch.name}</span>
                          <span className="text-[10px] text-muted font-mono">{ch.topics.length} topics</span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {/* Multi Summary Pill */}
                <div className="p-3 bg-card border border-theme rounded-xl text-xs flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      <strong>{selectedMultiChapterNames.length} chapters</strong> selected (
                      {selectedSprintSubject?.chapters
                        .filter(c => selectedMultiChapterNames.includes(c.name))
                        .reduce((acc, c) => acc + c.topics.length, 0)} total topics)
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-muted">
                    Session will log progress across all selected chapters
                  </span>
                </div>
              </div>
            ) : (
              /* Single Chapter Topic Inventory Preview */
              <div className="space-y-2 pt-2 border-t border-theme/60">
                {(() => {
                  const chObj = selectedSprintSubject?.chapters.find(c => c.name === selectedSingleChapterName);
                  if (!chObj) return null;
                  const totalTopics = chObj.topics.length;
                  const masteredCount = chObj.topics.filter(t => t.status === 'Mastered').length;
                  const completedCount = chObj.topics.filter(t => t.status === 'Completed').length;
                  return (
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-primary">
                          Chapter Topics ({totalTopics} total):
                        </span>
                        <span className="text-[11px] font-mono text-muted">
                          {masteredCount + completedCount}/{totalTopics} mastered or done
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {chObj.topics.map(t => (
                          <span
                            key={t.id}
                            className={`text-[11px] px-2.5 py-1 rounded-lg border font-semibold ${
                              t.status === 'Mastered' ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                              t.status === 'Completed' ? 'bg-teal-50 text-teal-800 border-teal-300' :
                              t.status === 'Weak' || t.status === 'Needs Revision' ? 'bg-rose-50 text-rose-800 border-rose-300' :
                              'bg-card text-primary border-theme'
                            }`}
                          >
                            {t.status === 'Mastered' ? '⭐ ' : t.status === 'Completed' ? '✓ ' : ''}{t.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Giant Vintage Calligraphic Clock Face */}
          <div className="text-center space-y-3 sm:space-y-4 py-2 sm:py-4">
            <div className={`text-6xl sm:text-8xl md:text-9xl tracking-tight ${timerThemeClasses.text} select-none transition-all flex items-baseline justify-center font-normal ${
              timerFontStyle === 'cursive' 
                ? 'font-vintage-cursive italic' 
                : timerFontStyle === 'serif'
                ? 'font-serif'
                : 'font-calligraphic italic'
            }`}>
              <span className="font-light">{minsFormatted}</span>
              <span className="opacity-40 mx-1 sm:mx-1.5 text-[0.65em] font-light select-none">.</span>
              <span className="font-light text-[0.88em] opacity-90">{secsFormatted}</span>
            </div>

            <p className={`text-xs font-mono font-bold ${timerThemeClasses.text} tracking-widest uppercase`}>
              {isActive ? (isPaused ? '⏸ CHAPTER SPRINT PAUSED' : '⚡ CHAPTER SPRINT IN PROGRESS') : 'READY FOR CHAPTER SPRINT'}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-md mx-auto bg-theme-accent h-2.5 rounded-full overflow-hidden border border-theme shadow-2xs">
              <div
                className={`${timerThemeClasses.bar} h-full rounded-full transition-all duration-300`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Preset Durations for Chapter Sprints */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-muted font-mono mr-1">Sprint Length:</span>
            {[30, 45, 60, 90, 120, 180].map((mins) => (
              <button
                key={mins}
                type="button"
                disabled={isActive}
                onClick={() => {
                  setTargetMinutes(mins);
                  setSecondsLeft(mins * 60);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                  targetMinutes === mins
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-surface border border-theme text-muted hover:text-primary hover:bg-theme-accent'
                }`}
              >
                {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
              </button>
            ))}
          </div>

          {/* Sound Controls Pill */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <div className="inline-flex items-center justify-center gap-2 bg-theme-accent/70 border border-theme rounded-full px-4 py-1.5 text-xs text-primary shadow-2xs">
              <button
                onClick={() => setIsAmbientSoundOn(!isAmbientSoundOn)}
                className="flex items-center gap-1.5 font-semibold hover:opacity-80 transition cursor-pointer min-h-[32px]"
              >
                {isAmbientSoundOn ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted" />}
                <span className="text-[11px] font-mono">{isAmbientSoundOn ? 'Sound On' : 'Muted'}</span>
              </button>
              {isAmbientSoundOn && (
                <>
                  <div className="h-3 w-px bg-theme"></div>
                  <select
                    value={ambientSoundType}
                    onChange={(e) => setAmbientSoundType(e.target.value as any)}
                    className="bg-transparent text-[11px] font-mono font-bold text-primary focus:outline-none cursor-pointer"
                  >
                    <option value="white" className="bg-card text-primary">White Noise</option>
                    <option value="pink" className="bg-card text-primary">Pink Noise</option>
                    <option value="rain" className="bg-card text-primary">Soft Rain</option>
                  </select>
                </>
              )}
            </div>

            <button
              onClick={playChime}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-theme-accent/80 hover:bg-theme-accent text-primary border border-theme text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs min-h-[36px]"
              title="Play test chime"
            >
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono text-[11px]">Test Sound</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {!isActive && !isPaused && (
              <button
                onClick={handleStartTimer}
                className="px-8 sm:px-12 py-3.5 sm:py-4 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs sm:text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer min-h-[46px]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Chapter Sprint</span>
              </button>
            )}

            {isActive && !isPaused && (
              <button
                onClick={handlePauseTimer}
                className="px-6 py-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            )}

            {isActive && isPaused && (
              <button
                onClick={handleResumeTimer}
                className="px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
            )}

            {(isActive || secondsLeft < targetMinutes * 60) && (
              <button
                onClick={handleStopTimer}
                className="px-6 py-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 min-h-[44px]"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>Finish &amp; Record Sprint</span>
              </button>
            )}

            <button
              onClick={handleResetTimer}
              className="p-3 rounded-full bg-surface hover:opacity-85 text-muted hover:text-primary border border-theme transition cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center active:scale-95"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Add Time Pills */}
          <div className="w-full flex items-center justify-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-muted font-mono mr-1">Extend:</span>
            <button
              type="button"
              onClick={() => handleExtendTimer(5)}
              className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              +5m
            </button>
            <button
              type="button"
              onClick={() => handleExtendTimer(10)}
              className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              +10m
            </button>
            <button
              type="button"
              onClick={() => handleExtendTimer(15)}
              className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              +15m
            </button>
            <button
              type="button"
              onClick={() => handleExtendTimer(25)}
              className="px-3 py-1 rounded-full bg-surface-raised border border-theme text-xs font-bold text-primary hover:bg-emerald-500/15 hover:text-emerald-700 transition cursor-pointer active:scale-95 shadow-2xs"
            >
              +25m
            </button>
          </div>
        </motion.div>
      )}

      {/* VIEW 4: BOARD EXAM PRESSURE PACER & QUESTION SIMULATOR */}
      {activeMode === 'mcq_pacer' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 transition-colors relative overflow-hidden"
        >
          {/* Subtle pulse glow when active */}
          {mcqIsActive && !mcqIsPaused && (
            <div className="absolute inset-0 bg-rose-500/5 pointer-events-none animate-pulse" />
          )}

          {/* Mode Header with Official SBBM Crest */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/50 pb-4">
            <div className="flex items-center gap-3">
              <SBBMCrest size="sm" showLabel={false} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-serif italic font-bold text-primary">
                    Board Exam Pressure Pacer & Question Simulator
                  </h3>
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30">
                    Authentic Board Hall Tension
                  </span>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Simulate authentic exam speed across MCQs (21.5s benchmark), Short Questions (2m quick mode), and Long Questions (15m quick mode) with voice recording and printable target stamps.
                </p>
              </div>
            </div>

            {/* Quick Actions: Print Answer Sheet, Chime Toggle, Test Sound */}
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setIsAnswerSheetModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Print Official SBBM Answer Sheet with Target Stamps"
              >
                <Printer className="w-3.5 h-3.5 text-amber-600" />
                <span>Print SBBM Answer Sheet</span>
              </button>

              <button
                type="button"
                onClick={() => setMcqAudioChimeEnabled(!mcqAudioChimeEnabled)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                  mcqAudioChimeEnabled
                    ? 'bg-rose-500/10 text-rose-800 dark:text-rose-300 border-rose-500/30'
                    : 'bg-theme-surface text-muted border-theme'
                }`}
                title="Toggle audio alert chime on time expiration"
              >
                <Bell className={`w-3.5 h-3.5 ${mcqAudioChimeEnabled ? 'text-rose-500' : 'text-muted'}`} />
                <span>{mcqAudioChimeEnabled ? 'Chime Active' : 'Muted'}</span>
              </button>

              <button
                type="button"
                onClick={() => playExamChime(3)}
                className="px-2.5 py-1.5 rounded-xl bg-theme-surface hover:bg-theme-accent border border-theme text-[11px] font-mono font-semibold text-primary transition cursor-pointer"
                title="Test 3-ring alert bell"
              >
                Test Bell
              </button>
            </div>
          </div>

          {/* Exam Pressure Question Category Segment Tabs */}
          {!mcqIsActive && !mcqIsFinished && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-surface p-1.5 rounded-2xl border border-theme">
              <button
                type="button"
                onClick={() => setExamPressureType('mcq')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  examPressureType === 'mcq'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>1. MCQ Sprint ({mcqSecondsPerQuestion}s)</span>
              </button>

              <button
                type="button"
                onClick={() => setExamPressureType('short_question')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  examPressureType === 'short_question'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>2. Short Question ({sqMinutesPerQuestion}m Quick)</span>
              </button>

              <button
                type="button"
                onClick={() => setExamPressureType('long_question')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  examPressureType === 'long_question'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>3. Long Question ({lqMinutesPerQuestion}m Quick)</span>
              </button>

              <button
                type="button"
                onClick={() => setExamPressureType('mixed_board')}
                className={`py-2 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  examPressureType === 'mixed_board'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-muted hover:text-primary'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>4. Full Board Exam</span>
              </button>
            </div>
          )}

          {/* STATE 1: PACER SETUP (When not running and not finished) */}
          {!mcqIsActive && !mcqIsFinished && (
            <div className="space-y-5">
              {/* Subject & Chapter Config */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-surface p-4 rounded-2xl border border-theme">
                <div>
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Subject</label>
                  <select
                    value={mcqSelectedSubject}
                    onChange={(e) => {
                      const sub = e.target.value;
                      setMcqSelectedSubject(sub);
                      const matched = subjects.find(s => s.name === sub);
                      if (matched && matched.chapters.length > 0) {
                        setMcqSelectedChapter(matched.chapters[0].name);
                      }
                    }}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none"
                  >
                    {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">Chapter Target</label>
                  <select
                    value={mcqSelectedChapter}
                    onChange={(e) => setMcqSelectedChapter(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-card border border-theme text-xs font-bold text-primary focus:outline-none"
                  >
                    {(subjects.find(s => s.name === mcqSelectedSubject) || subjects[0])?.chapters.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 1. MCQ MODE CONTROLS */}
              {examPressureType === 'mcq' && (
                <>
                  {/* Number of MCQs Selector */}
                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-primary" />
                        <span>Total Number of MCQs to Attempt:</span>
                      </span>
                      <span className="font-mono font-bold text-primary bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {mcqTotalCount} {mcqTotalCount === 1 ? 'Question (Single Blitz)' : 'Questions'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 5, 10, 20, 25, 30, 40, 50].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMcqTotalCount(n)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                            mcqTotalCount === n
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {n === 1 ? '1 MCQ (Blitz)' : `${n} MCQs`}
                        </button>
                      ))}
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-[11px] text-muted">Custom:</span>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          value={mcqTotalCount}
                          onChange={(e) => setMcqTotalCount(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-16 p-1 text-center bg-card border border-theme rounded-lg text-xs font-mono font-bold text-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time per Question Benchmark */}
                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Time Benchmark Per MCQ:</span>
                      </span>
                      <span className="font-mono font-bold text-rose-600 dark:text-rose-400 bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {mcqSecondsPerQuestion}s ({Number((mcqSecondsPerQuestion / 60).toFixed(2))}m)
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { secs: 21.5, label: '21.5s (Lightning Pressure)' },
                        { secs: 30, label: '30s (Rapid Drill)' },
                        { secs: 45, label: '45s (Sprint)' },
                        { secs: 60, label: '60s (Standard)' },
                        { secs: 75, label: '75s (Cambridge Benchmark)' },
                        { secs: 90, label: '90s (Numerical)' }
                      ].map(p => (
                        <button
                          key={p.secs}
                          type="button"
                          onClick={() => {
                            setMcqSecondsPerQuestion(p.secs);
                            setMcqQuestionSecondsLeft(p.secs);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            mcqSecondsPerQuestion === p.secs
                              ? 'bg-rose-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[11px] text-muted">Custom Seconds:</span>
                        <input
                          type="number"
                          step="0.5"
                          min="5"
                          max="300"
                          value={mcqSecondsPerQuestion}
                          onChange={(e) => {
                            const val = Math.max(5, parseFloat(e.target.value) || 21.5);
                            setMcqSecondsPerQuestion(val);
                            setMcqQuestionSecondsLeft(val);
                          }}
                          className="w-20 p-1 text-center bg-card border border-theme rounded-lg text-xs font-mono font-bold text-primary"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 2. SHORT QUESTION (SQ) MODE CONTROLS */}
              {examPressureType === 'short_question' && (
                <>
                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-500" />
                        <span>Number of Short Questions (4 Marks Each):</span>
                      </span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {sqTotalCount} Questions
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 3, 5, 6, 8, 10].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setSqTotalCount(n)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                            sqTotalCount === n
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {n} SQ{n === 1 ? '' : 's'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        <span>Short Question Time Benchmark (Exam Pressure):</span>
                      </span>
                      <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {sqMinutesPerQuestion} Minutes / Question
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { mins: 2, label: '⚡ 2 Minutes (Quick Mode / Speed Drill)' },
                        { mins: 3, label: '⏱️ 3 Minutes (Standard Board SQ)' },
                        { mins: 4, label: '📝 4 Minutes (Explanation)' },
                        { mins: 5, label: '🔬 5 Minutes (Numerical / In-depth)' }
                      ].map(p => (
                        <button
                          key={p.mins}
                          type="button"
                          onClick={() => {
                            setSqMinutesPerQuestion(p.mins);
                            setSqSecondsLeft(p.mins * 60);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            sqMinutesPerQuestion === p.mins
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-3 bg-amber-500/10 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 mt-2 space-y-1">
                      <div className="font-bold">Short Question Scoring Breakdown (4 Marks Target):</div>
                      <div className="opacity-90">• 1 Mark: Statement / Scientific Definition • 1 Mark: Governing Formula / Equation • 2 Marks: Working Points / SI Units</div>
                    </div>
                  </div>
                </>
              )}

              {/* 3. LONG QUESTION (LQ) MODE CONTROLS */}
              {examPressureType === 'long_question' && (
                <>
                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-purple-500" />
                        <span>Number of Long Questions (10 Marks Each):</span>
                      </span>
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {lqTotalCount} Questions
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[1, 2, 3, 4].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setLqTotalCount(n)}
                          className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                            lqTotalCount === n
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {n} Long Question{n === 1 ? '' : 's'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-primary flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-500" />
                        <span>Long Question Time Benchmark (Exam Pressure):</span>
                      </span>
                      <span className="font-mono font-bold text-purple-700 dark:text-purple-300 bg-card px-2.5 py-0.5 rounded-md border border-theme">
                        {lqMinutesPerQuestion} Minutes / Question
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {[
                        { mins: 10, label: '⚡ 10 Minutes (Rapid Proof Outline)' },
                        { mins: 15, label: '⏱️ 15 Minutes (Quick Mode / Standard Board Paper)' },
                        { mins: 20, label: '📝 20 Minutes (Full Extended Derivation)' },
                        { mins: 25, label: '🔬 25 Minutes (Comprehensive Essay)' }
                      ].map(p => (
                        <button
                          key={p.mins}
                          type="button"
                          onClick={() => {
                            setLqMinutesPerQuestion(p.mins);
                            setLqSecondsLeft(p.mins * 60);
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            lqMinutesPerQuestion === p.mins
                              ? 'bg-purple-600 text-white shadow-2xs'
                              : 'bg-card border border-theme text-muted hover:text-primary'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>

                    <div className="p-3 bg-purple-500/10 rounded-xl text-[11px] text-purple-900 dark:text-purple-200 mt-2 space-y-1">
                      <div className="font-bold">Long Question 4-Phase Milestones (10 Marks Target):</div>
                      <div className="opacity-90">• 0-3m: Statement & Hypotheses • 3-9m: Mathematical Derivation • 9-12m: Labeled Diagram • 12-15m: Conclusion & Units</div>
                    </div>
                  </div>
                </>
              )}

              {/* 4. MIXED BOARD EXAM MODE CONTROLS */}
              {examPressureType === 'mixed_board' && (
                <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-xs space-y-3">
                  <div className="font-bold text-indigo-950 dark:text-indigo-200 text-sm flex items-center gap-2">
                    <Award className="w-4 h-4 text-indigo-600" />
                    <span>Complete Sindh Board Examination Hall Structure:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="p-3 bg-card rounded-xl border border-theme">
                      <span className="font-bold text-rose-600 block">Section A: MCQs</span>
                      <span className="text-muted block mt-0.5">15 Questions @ 45s each</span>
                      <span className="font-mono font-bold text-xs mt-1 block">11.25 Minutes</span>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-theme">
                      <span className="font-bold text-amber-600 block">Section B: Short Qs</span>
                      <span className="text-muted block mt-0.5">6 Questions @ 3m each</span>
                      <span className="font-mono font-bold text-xs mt-1 block">18.0 Minutes</span>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-theme">
                      <span className="font-bold text-purple-600 block">Section C: Long Qs</span>
                      <span className="text-muted block mt-0.5">2 Questions @ 15m each</span>
                      <span className="font-mono font-bold text-xs mt-1 block">30.0 Minutes</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    Total authentic exam duration: <strong>~59 Minutes</strong>. Warning chimes and milestone bells active throughout.
                  </p>
                </div>
              )}

              {/* Auto-Advance Transition Buffer (1s, 2s, 3s) */}
              <div className="space-y-2 bg-surface p-4 rounded-2xl border border-theme">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-primary block">
                      Transition Buffer Between Questions:
                    </span>
                    <span className="text-[11px] text-muted">
                      Brief pause between questions after warning bell sounds.
                    </span>
                  </div>
                  <span className="font-mono font-bold text-primary bg-card px-2.5 py-0.5 rounded-md border border-theme">
                    {mcqBufferSeconds} Seconds
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {[1, 2, 3].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setMcqBufferSeconds(sec)}
                      className={`px-4 py-1.5 rounded-xl text-xs font-mono font-bold transition cursor-pointer ${
                        mcqBufferSeconds === sec
                          ? 'bg-primary text-white shadow-2xs'
                          : 'bg-card border border-theme text-muted hover:text-primary'
                      }`}
                    >
                      {sec} Second{sec === 1 ? '' : 's'} Buffer
                    </button>
                  ))}
                </div>
              </div>

              {/* Launch Button & Time Budget Breakdown */}
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Total Exam Pressure Budget:</span>
                  </div>
                  <div className="text-sm font-bold font-mono text-primary">
                    {examPressureType === 'mcq'
                      ? `${Math.floor((mcqTotalCount * mcqSecondsPerQuestion) / 60)}m ${Math.round((mcqTotalCount * mcqSecondsPerQuestion) % 60)}s`
                      : examPressureType === 'short_question'
                      ? `${sqTotalCount * sqMinutesPerQuestion} Minutes (${sqTotalCount} Questions @ ${sqMinutesPerQuestion}m)`
                      : examPressureType === 'long_question'
                      ? `${lqTotalCount * lqMinutesPerQuestion} Minutes (${lqTotalCount} Questions @ ${lqMinutesPerQuestion}m)`
                      : '59.25 Minutes (Full Board Simulation)'}
                  </div>
                  <div className="text-[11px] text-muted">
                    {mcqSelectedSubject} • {mcqSelectedChapter}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleStartExamPressureSprint}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-rose-600 via-amber-600 to-indigo-700 hover:opacity-90 text-white font-bold text-sm tracking-wider uppercase transition shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start {examPressureType === 'mcq' ? 'MCQ' : examPressureType === 'short_question' ? 'Short Q' : examPressureType === 'long_question' ? 'Long Q' : 'Board'} Exam Pressure Sprint</span>
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: ACTIVE QUESTION COUNTDOWN & RUNTIME */}
          {mcqIsActive && !mcqIsFinished && (
            <div className="space-y-6 text-center py-2">
              {/* Question Progress Tracker Header */}
              <div className="flex items-center justify-between border-b border-theme/60 pb-3 text-xs">
                <div className="text-left">
                  <span className="font-bold text-primary text-sm flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-rose-500" />
                    <span>
                      {examPressureType === 'mcq'
                        ? `MCQ ${mcqCurrentIndex} of ${mcqTotalCount}`
                        : examPressureType === 'short_question'
                        ? `Short Question ${sqCurrentIndex} of ${sqTotalCount} (4 Marks)`
                        : examPressureType === 'long_question'
                        ? `Long Question ${lqCurrentIndex} of ${lqTotalCount} (10 Marks)`
                        : `Board Paper Question`}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted font-mono">
                    {mcqSelectedSubject} — {mcqSelectedChapter}
                  </span>
                </div>

                <div className="text-right font-mono">
                  <div className="text-xs font-bold text-primary">
                    Total Elapsed: {Math.floor(mcqTotalElapsedSeconds / 60)}m {Math.floor(mcqTotalElapsedSeconds % 60)}s
                  </div>
                  <div className="text-[11px] text-muted">
                    {examPressureType === 'mcq'
                      ? `Budget: ${Math.floor((mcqTotalCount * mcqSecondsPerQuestion) / 60)}m`
                      : examPressureType === 'short_question'
                      ? `Target: ${sqMinutesPerQuestion}m/Q`
                      : `Target: ${lqMinutesPerQuestion}m/Q`}
                  </div>
                </div>
              </div>

              {/* Transition Buffer Banner */}
              <AnimatePresence>
                {mcqIsBufferActive && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-3 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-2 animate-pulse"
                  >
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span>🔔 TIME'S UP! 3 Rings Bell. Transitioning to next question in {Math.ceil(mcqBufferSecondsLeft)}s...</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Giant Digits for Current Question Countdown */}
              <div className="py-2">
                {/* 1. MCQ Countdown Timer Display */}
                {examPressureType === 'mcq' && (
                  <div className={`text-8xl sm:text-9xl md:text-[10rem] font-light tracking-tight flex items-baseline justify-center select-none font-calligraphic italic transition-colors ${
                    mcqQuestionSecondsLeft <= 5
                      ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                      : mcqQuestionSecondsLeft <= 12
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-primary'
                  }`}>
                    {mcqSecondsPerQuestion < 60 ? (
                      <>
                        <span>{String(Math.floor(mcqQuestionSecondsLeft)).padStart(2, '0')}</span>
                        <span className="opacity-40 text-5xl sm:text-6xl md:text-7xl font-mono not-italic">.{Math.floor((mcqQuestionSecondsLeft % 1) * 10)}</span>
                        <span className="text-2xl sm:text-3xl text-muted font-sans not-italic ml-1">s</span>
                      </>
                    ) : (
                      <>
                        <span>{String(Math.floor(mcqQuestionSecondsLeft / 60)).padStart(2, '0')}</span>
                        <span className="opacity-30 mx-1">:</span>
                        <span>{String(Math.floor(mcqQuestionSecondsLeft % 60)).padStart(2, '0')}</span>
                        <span className="opacity-40 text-4xl sm:text-5xl font-mono not-italic">.{Math.floor((mcqQuestionSecondsLeft % 1) * 10)}</span>
                      </>
                    )}
                  </div>
                )}

                {/* 2. Short Question (SQ) Countdown Timer Display */}
                {examPressureType === 'short_question' && (
                  <div>
                    <div className={`text-7xl sm:text-8xl md:text-9xl font-light tracking-tight flex items-baseline justify-center select-none font-mono transition-colors ${
                      sqSecondsLeft <= 30
                        ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                        : sqSecondsLeft <= 60
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-primary'
                    }`}>
                      <span>{String(Math.floor(sqSecondsLeft / 60)).padStart(2, '0')}</span>
                      <span className="opacity-30 mx-1">:</span>
                      <span>{String(Math.floor(sqSecondsLeft % 60)).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                        🔴 TARGET STAMP: {sqMinutesPerQuestion} MINS PACED (4 MARKS)
                      </span>
                    </div>
                  </div>
                )}

                {/* 3. Long Question (LQ) Countdown Timer Display */}
                {examPressureType === 'long_question' && (
                  <div>
                    <div className={`text-7xl sm:text-8xl md:text-9xl font-light tracking-tight flex items-baseline justify-center select-none font-mono transition-colors ${
                      lqSecondsLeft <= 120
                        ? 'text-rose-600 dark:text-rose-400 animate-pulse'
                        : lqSecondsLeft <= 300
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-primary'
                    }`}>
                      <span>{String(Math.floor(lqSecondsLeft / 60)).padStart(2, '0')}</span>
                      <span className="opacity-30 mx-1">:</span>
                      <span>{String(Math.floor(lqSecondsLeft % 60)).padStart(2, '0')}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                        🔴 TARGET STAMP: {lqMinutesPerQuestion} MINS PACED (10 MARKS)
                      </span>
                    </div>
                  </div>
                )}

                {/* Question Progress Bar */}
                <div className="w-full max-w-md mx-auto bg-surface h-2 rounded-full overflow-hidden border border-theme mt-3">
                  <div
                    className="h-full rounded-full transition-all duration-100 bg-primary"
                    style={{
                      width: `${
                        examPressureType === 'mcq'
                          ? Math.min(100, ((mcqSecondsPerQuestion - mcqQuestionSecondsLeft) / mcqSecondsPerQuestion) * 100)
                          : examPressureType === 'short_question'
                          ? Math.min(100, (((sqMinutesPerQuestion * 60) - sqSecondsLeft) / (sqMinutesPerQuestion * 60)) * 100)
                          : Math.min(100, (((lqMinutesPerQuestion * 60) - lqSecondsLeft) / (lqMinutesPerQuestion * 60)) * 100)
                      }%`
                    }}
                  />
                </div>
              </div>

              {/* 1. MCQ OPTIONS BUTTONS (A, B, C, D) */}
              {examPressureType === 'mcq' && (
                <div className="space-y-3 max-w-xl mx-auto pt-2">
                  <span className="text-[11px] font-bold text-muted font-mono uppercase tracking-widest block">
                    Select Answer for Question {mcqCurrentIndex} (Records Choice &amp; Advances):
                  </span>
                  <div className="grid grid-cols-4 gap-2.5">
                    {(['A', 'B', 'C', 'D'] as const).map(option => {
                      const isSelected = mcqAnswers[mcqCurrentIndex] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectMcqAnswer(option)}
                          className={`py-3.5 rounded-2xl text-base font-bold transition flex items-center justify-center cursor-pointer shadow-xs active:scale-95 border ${
                            isSelected
                              ? 'bg-rose-600 border-rose-600 text-white'
                              : 'bg-surface hover:bg-theme-accent border-theme text-primary hover:border-primary'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. SHORT QUESTION (SQ) ANSWERING & AUDIO RECORDING PANEL */}
              {examPressureType === 'short_question' && (
                <div className="max-w-2xl mx-auto bg-surface p-4 rounded-2xl border border-theme text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-500" />
                      <span>Structured Short Question Working & Voice Answer:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExamAudioRecording(sqCurrentIndex, 'short')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                        isExamAudioRecording
                          ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                          : sqAudioRecordings[sqCurrentIndex]?.isRecorded
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-card border-theme text-primary hover:bg-theme-accent'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>
                        {isExamAudioRecording
                          ? `Recording... (${recordingSeconds}s)`
                          : sqAudioRecordings[sqCurrentIndex]?.isRecorded
                          ? `Voice Recorded ✓ (${sqAudioRecordings[sqCurrentIndex].duration}s)`
                          : 'Record Voice Answer'}
                      </span>
                    </button>
                  </div>

                  <div className="text-[11px] text-muted grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-card border border-theme">1. Core Law / Definition</div>
                    <div className="p-2 rounded-lg bg-card border border-theme">2. Governing Equation</div>
                    <div className="p-2 rounded-lg bg-card border border-theme">3. 2 Bullet Points / Units</div>
                  </div>

                  <textarea
                    value={sqAnswersText[sqCurrentIndex] || ''}
                    onChange={(e) => setSqAnswersText({ ...sqAnswersText, [sqCurrentIndex]: e.target.value })}
                    placeholder="Type your structured answer points, formula, or rough workings here (or use Voice Recording)..."
                    rows={4}
                    className="w-full p-3 rounded-xl bg-card border border-theme text-xs font-mono text-primary focus:outline-none"
                  />
                </div>
              )}

              {/* 3. LONG QUESTION (LQ) MILESTONES & WORKSPACE */}
              {examPressureType === 'long_question' && (
                <div className="max-w-2xl mx-auto bg-surface p-4 rounded-2xl border border-theme text-left space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-purple-500" />
                      <span>Long Question Milestones & Detailed Derivation:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleExamAudioRecording(lqCurrentIndex, 'long')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                        isExamAudioRecording
                          ? 'bg-rose-600 text-white border-rose-700 animate-pulse'
                          : lqAudioRecordings[lqCurrentIndex]?.isRecorded
                          ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-card border-theme text-primary hover:bg-theme-accent'
                      }`}
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>
                        {isExamAudioRecording
                          ? `Recording Derivation... (${recordingSeconds}s)`
                          : lqAudioRecordings[lqCurrentIndex]?.isRecorded
                          ? `Audio Recorded ✓ (${lqAudioRecordings[lqCurrentIndex].duration}s)`
                          : 'Record Verbal Derivation'}
                      </span>
                    </button>
                  </div>

                  {/* 4 Interactive Milestone Checkboxes */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      { key: 'intro' as const, label: 'Stage 1: Statement & Hypothesis (2M)' },
                      { key: 'derivation' as const, label: 'Stage 2: Mathematical Steps (4M)' },
                      { key: 'diagram' as const, label: 'Stage 3: Labeled Diagram Sketch (2M)' },
                      { key: 'units' as const, label: 'Stage 4: Conclusion & SI Units (2M)' }
                    ].map(st => {
                      const isChecked = Boolean(lqMilestones[lqCurrentIndex]?.[st.key]);
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleToggleLqMilestone(lqCurrentIndex, st.key)}
                          className={`p-2 rounded-xl border text-left font-semibold transition cursor-pointer flex items-center gap-2 ${
                            isChecked
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'
                              : 'bg-card border-theme text-muted hover:text-primary'
                          }`}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${isChecked ? 'text-emerald-600' : 'text-muted'}`} />
                          <span className="text-[11px]">{st.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    value={lqAnswersText[lqCurrentIndex] || ''}
                    onChange={(e) => setLqAnswersText({ ...lqAnswersText, [lqCurrentIndex]: e.target.value })}
                    placeholder="Type theorem statement, derivation steps, calculus working, and final conclusion here..."
                    rows={5}
                    className="w-full p-3 rounded-xl bg-card border border-theme text-xs font-mono text-primary focus:outline-none"
                  />
                </div>
              )}

              {/* Navigation Action Buttons */}
              <div className="flex items-center justify-center gap-2.5 pt-3 flex-wrap">
                {examPressureType === 'mcq' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleFlagMcqQuestion}
                      className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                      title="Flag this question for mistake review"
                    >
                      <Target className="w-3.5 h-3.5 text-amber-500" />
                      <span>Flag for Review 🚩</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSkipMcqQuestion}
                      className="px-3.5 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition cursor-pointer"
                      title="Skip to next question"
                    >
                      <span>Skip Question ⏩</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectMcqAnswer('DONE')}
                      className="px-4 py-2 rounded-xl bg-primary hover:opacity-90 text-white text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                    >
                      <span>Next MCQ ⏭</span>
                    </button>
                  </>
                ) : examPressureType === 'short_question' ? (
                  <button
                    type="button"
                    onClick={handleSelectShortQuestionNext}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <span>Done / Next Short Question ({sqCurrentIndex} of {sqTotalCount}) ⏭</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSelectLongQuestionNext}
                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-xs flex items-center gap-2"
                  >
                    <span>Done / Next Long Question ({lqCurrentIndex} of {lqTotalCount}) ⏭</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setMcqIsPaused(!mcqIsPaused)}
                  className="px-3.5 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-muted hover:text-primary text-xs font-semibold transition cursor-pointer"
                >
                  {mcqIsPaused ? 'Resume' : 'Pause'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMcqIsActive(false);
                    setMcqIsFinished(true);
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                >
                  Finish Early
                </button>
              </div>
            </div>
          )}

          {/* STATE 3: EXAM PRESSURE DEBRIEF & TARGET STAMPS DOSSIER */}
          {mcqIsFinished && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto shadow-xs">
                <Award className="w-7 h-7" />
              </div>

              <div>
                <h4 className="text-xl font-serif italic font-bold text-primary">
                  Board Exam Pressure Sprint Complete!
                </h4>
                <p className="text-xs text-muted mt-1">
                  Finished under authentic Sindh Board time benchmarks for {mcqSelectedSubject} — {mcqSelectedChapter}.
                </p>
              </div>

              {/* 4 Authentic Target Rubber Stamps Earned */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-2xl mx-auto text-left">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200">
                  <div className="text-[9px] font-mono font-bold">🔴 TARGET STAMP #1</div>
                  <div className="font-extrabold text-xs mt-0.5">TIME-PACED VERIFIED</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Speed Certified</div>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
                  <div className="text-[9px] font-mono font-bold">🟢 TARGET STAMP #2</div>
                  <div className="font-extrabold text-xs mt-0.5">100% ATTEMPT</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Zero Omissions</div>
                </div>

                <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-sky-900 dark:text-sky-200">
                  <div className="text-[9px] font-mono font-bold">🔵 TARGET STAMP #3</div>
                  <div className="font-extrabold text-xs mt-0.5">RUBRIC AUDITED</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Key Steps Covered</div>
                </div>

                <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-900 dark:text-purple-200">
                  <div className="text-[9px] font-mono font-bold">🟣 TARGET STAMP #4</div>
                  <div className="font-extrabold text-xs mt-0.5">SBBM GRADE A*</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Official Standard</div>
                </div>
              </div>

              {/* Statistics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto text-left text-xs">
                <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase block">Total Elapsed</span>
                  <span className="text-base font-bold font-mono text-primary">
                    {Math.floor(mcqTotalElapsedSeconds / 60)}m {Math.round(mcqTotalElapsedSeconds % 60)}s
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase block">Questions Attempted</span>
                  <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {examPressureType === 'mcq' ? mcqTotalCount : examPressureType === 'short_question' ? sqTotalCount : lqTotalCount} Attempted
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase block">Voice Recordings</span>
                  <span className="text-base font-bold font-mono text-primary">
                    {(Object.values(sqAudioRecordings) as Array<{ isRecorded: boolean }>).filter(r => r.isRecorded).length + (Object.values(lqAudioRecordings) as Array<{ isRecorded: boolean }>).filter(r => r.isRecorded).length} Voice Notes
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-1">
                  <span className="text-[10px] font-bold text-muted uppercase block">Target Pacing</span>
                  <span className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">
                    {examPressureType === 'mcq' ? `${mcqSecondsPerQuestion}s` : examPressureType === 'short_question' ? `${sqMinutesPerQuestion}m` : `${lqMinutesPerQuestion}m`} / Q
                  </span>
                </div>
              </div>

              {/* Action Buttons: Print Answer Sheet, Save to Study Log, Restart */}
              <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsAnswerSheetModalOpen(true)}
                  className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-600 to-rose-600 hover:opacity-90 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print SBBM Answer Sheet with Target Stamps</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveMcqAsMockTest}
                  className="px-6 py-3 rounded-full bg-primary hover:opacity-90 text-white font-bold text-xs transition cursor-pointer shadow-md flex items-center gap-2"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Log into Calendar Study Sessions</span>
                </button>

                <button
                  type="button"
                  onClick={handleStartExamPressureSprint}
                  className="px-5 py-3 rounded-full bg-theme-surface hover:bg-theme-accent border border-theme text-muted hover:text-primary font-semibold text-xs transition cursor-pointer"
                >
                  Restart New Sprint 🔄
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* VIEW 3: INTEGRATED AI BLURT RECALL & NOTES/DIAGRAM UPLOAD */}
      {activeMode === 'blurt' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 transition-colors"
        >
          {/* Studio Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Zap className="w-4 h-4 text-amber-400" />
                </span>
                <h3 className="text-base sm:text-lg font-serif italic font-bold text-primary">
                  AI Active Retrieval, Oral Socratic Exam &amp; Notes Upload
                </h3>
              </div>
              <p className="text-xs text-muted mt-1">
                Active recall test for <strong>{selectedTopicName}</strong> ({selectedSubjectName}). Brain-dump recall, dictate in English/Urdu, snap multi-page handwritten work, or test your conceptual depth with Socratic oral examination.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              {/* Written vs Socratic Sub-tab Switcher */}
              <div className="flex items-center bg-surface border border-theme rounded-xl p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveBlurtTab('written')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBlurtTab === 'written'
                      ? 'bg-primary text-white shadow-2xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Written / Photos</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBlurtTab('socratic');
                    if (!socraticQuestion) {
                      handleGenerateSocraticQuestion();
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    activeBlurtTab === 'socratic'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-muted hover:text-primary'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5 text-amber-300" />
                  <span>Socratic Oral Exam</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setActiveMode('timer')}
                className="px-3.5 py-2 rounded-xl bg-theme-accent border border-theme text-primary hover:opacity-85 text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[36px]"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Timer</span>
              </button>
            </div>
          </div>

          {/* Feedback alerts */}
          {blurtSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{blurtSuccessMsg}</span>
              </div>
              <button onClick={() => setBlurtSuccessMsg(null)} className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {blurtError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-800 dark:text-rose-300 text-xs flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{blurtError}</span>
              </div>
              <button onClick={() => setBlurtError(null)} className="p-1 text-current opacity-70 hover:opacity-100 cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* TAB 1: WRITTEN BLURT & MULTI-IMAGE UPLOAD */}
          {activeBlurtTab === 'written' ? (
            <>
              {/* Step 1: AI Prompt Guidance & Rupex Upload */}
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-primary font-mono flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>1. AI Topic Retrieval Guidance &amp; Rupex / Rubrics</span>
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Upload Rupex / Rubric button */}
                    <input
                      ref={rubricInputRef}
                      type="file"
                      accept="image/*,.pdf,.txt"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleUploadRubric(e.target.files[0]);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => rubricInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer min-h-[34px]"
                      title="Upload Rupex, Marking Scheme, or Past Paper Rubric for this chapter"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{rubricFile ? 'Replace Rupex' : 'Upload Rupex / Rubric'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateBlurtPrompt}
                      disabled={isGeneratingPrompt}
                      className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[34px]"
                    >
                      {isGeneratingPrompt ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Generating Prompt...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>{blurtPrompt ? 'Regenerate Retrieval Cue' : 'Generate AI Retrieval Cue'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Attached Rupex / Rubric Preview Badge */}
                {rubricFile && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 block truncate">
                          Rupex / Rubric Attached: {rubricFile.name}
                        </span>
                        <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 block font-mono">
                          {rubricFile.sizeFormatted} • Recall will be evaluated against this marking scheme
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRubricFile(null)}
                      className="p-1 rounded-lg text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                      title="Remove attached rubric"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* 1-Click Questions (No Typing Needed) */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-muted">
                    <span>1-Click Preset Questions (No typing needed):</span>
                    <span className="text-amber-600 dark:text-amber-400">Click to instantly populate</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => handleSelectPresetQuestion('definitions')}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent border border-theme text-[11px] font-bold text-primary transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>📋 Core Definitions</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPresetQuestion('formulas')}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent border border-theme text-[11px] font-bold text-primary transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>📐 Formulas &amp; Derivations</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPresetQuestion('traps')}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent border border-theme text-[11px] font-bold text-primary transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>⚠️ 3 Examiner Pitfalls</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPresetQuestion('numerical')}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-theme-accent border border-theme text-[11px] font-bold text-primary transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span>🔢 High-Yield Problem</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectPresetQuestion('questions5')}
                      className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                    >
                      <span>🎯 5 Exam Questions</span>
                    </button>
                  </div>
                </div>

                {blurtPrompt ? (
                  <div className="p-3 bg-card border border-theme rounded-xl text-xs text-primary leading-relaxed">
                    <strong className="text-amber-600 dark:text-amber-400 font-mono text-[11px] block mb-1">PROMPT / RETRIEVAL CUE:</strong>
                    {blurtPrompt}
                  </div>
                ) : (
                  <p className="text-xs text-muted">
                    Click any 1-click question above or "Generate AI Retrieval Cue" for targeted exam questions on <em>{selectedTopicName}</em>, or begin typing/dictating your recall below.
                  </p>
                )}
              </div>

              {/* Step 2: Active Recall Brain Dump with Bilingual Voice-to-Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-primary" />
                    <span>2. Active Recall (Feynman Brain-Dump)</span>
                  </label>

                  <div className="flex items-center gap-2">
                    {/* Bilingual Language Selector */}
                    <div className="flex items-center bg-surface border border-theme rounded-lg p-0.5 text-[11px]">
                      <Languages className="w-3 h-3 text-muted ml-1.5 mr-1" />
                      <button
                        type="button"
                        onClick={() => setSpeechLang('en-US')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          speechLang === 'en-US' ? 'bg-primary text-white' : 'text-muted'
                        }`}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLang('ur-PK')}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                          speechLang === 'ur-PK' ? 'bg-primary text-white' : 'text-muted'
                        }`}
                      >
                        اردو
                      </button>
                    </div>

                    {/* Voice Dictation Button */}
                    <button
                      type="button"
                      onClick={handleToggleVoiceDictation}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border min-h-[30px] ${
                        isListening
                          ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                          : 'bg-theme-accent border-theme text-primary hover:opacity-85'
                      }`}
                      title="Voice-to-Text Dictation (English / Urdu)"
                    >
                      {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-rose-500" />}
                      <span>{isListening ? `Listening (${speechLang === 'ur-PK' ? 'اردو' : 'EN'})...` : 'Dictate'}</span>
                    </button>

                    <span className="text-[11px] font-mono text-muted">
                      {blurtRecallText.trim().split(/\s+/).filter(Boolean).length} words
                    </span>
                  </div>
                </div>

                <textarea
                  rows={4}
                  value={blurtRecallText}
                  onChange={(e) => setBlurtRecallText(e.target.value)}
                  placeholder={`Write or dictate everything you remember about ${selectedTopicName}: key formulas, definitions, working steps, derivations, or common exam traps...`}
                  className="w-full p-3.5 bg-surface border border-theme rounded-2xl text-xs text-primary placeholder-muted focus:outline-none focus:border-primary resize-y leading-relaxed font-sans"
                />
              </div>

              {/* Step 3: Multi-Photo Upload for Handwritten Notes & Diagrams */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-indigo-500" />
                    <span>3. Multi-Photo Upload: Handwritten Work &amp; Diagrams ({attachedImages.length})</span>
                  </label>
                  <span className="text-[10px] font-mono text-muted">Select multiple pages or diagrams</span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleProcessImageFiles(e.target.files);
                    }
                  }}
                />

                {attachedImages.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        handleProcessImageFiles(e.dataTransfer.files);
                      }
                    }}
                    className="border-2 border-dashed border-theme hover:border-primary rounded-2xl p-6 text-center cursor-pointer transition-colors bg-surface/50 hover:bg-surface flex flex-col items-center justify-center gap-2.5 min-h-[130px]"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                      {isProcessingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-primary">
                        {isProcessingImage ? 'Optimizing photos for AI...' : 'Tap to select single or multiple photos of handwritten work'}
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        Upload multi-page notes, diagrams, or step derivations &bull; OCR auto-reads equations
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {attachedImages.map((img) => (
                        <div key={img.id} className="relative p-2 rounded-2xl bg-surface border border-theme group">
                          <img
                            src={img.dataUrl}
                            alt={img.fileName}
                            className="w-full h-24 object-cover rounded-xl border border-theme"
                          />
                          <div className="mt-1.5 min-w-0">
                            <p className="text-[11px] font-bold text-primary truncate">{img.fileName}</p>
                            <p className="text-[10px] font-mono text-muted">{(img.fileSizeBytes / 1024).toFixed(1)} KB</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(img.id)}
                            className="absolute top-3 right-3 p-1.5 rounded-full bg-rose-600 text-white shadow-xs hover:bg-rose-700 transition cursor-pointer"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                      {/* Add more button tile */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-full min-h-[110px] rounded-2xl border-2 border-dashed border-theme hover:border-primary flex flex-col items-center justify-center gap-1 text-muted hover:text-primary transition cursor-pointer bg-surface/40 hover:bg-surface"
                      >
                        <Camera className="w-5 h-5" />
                        <span className="text-xs font-bold">+ Add Page</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Evaluate Action Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleEvaluateBlurt}
                  disabled={isEvaluatingBlurt || (!blurtRecallText.trim() && attachedImages.length === 0)}
                  className="w-full py-3.5 px-5 rounded-2xl bg-primary hover:opacity-90 text-white text-xs sm:text-sm font-bold tracking-wide uppercase transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 min-h-[46px]"
                >
                  {isEvaluatingBlurt ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                      <span>Evaluating Recall &amp; {attachedImages.length} Handwritten Photo(s) with Gemini AI...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-amber-300 fill-current" />
                      <span>Evaluate Recall &amp; Verify Notes with AI ({attachedImages.length} photo{attachedImages.length === 1 ? '' : 's'})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            /* TAB 2: SOCRATIC ORAL EXAM ARENA */
            <div className="space-y-4">
              <div className="bg-surface border border-theme rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping" />
                    <span className="text-xs font-bold uppercase tracking-widest text-primary font-mono">
                      Socratic Oral Examiner
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerateSocraticQuestion}
                    disabled={isEvaluatingSocratic}
                    className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[34px]"
                  >
                    {isEvaluatingSocratic && !socraticQuestion ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>New Oral Question</span>
                  </button>
                </div>

                {socraticQuestion ? (
                  <div className="p-4 rounded-xl bg-card border border-theme space-y-1">
                    <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                      Examiner Probing Question:
                    </span>
                    <p className="text-sm font-semibold text-primary leading-relaxed">
                      "{socraticQuestion}"
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted">
                    <p>Click "New Oral Question" to begin your interactive viva / Socratic interrogation on <strong>{selectedTopicName}</strong>.</p>
                  </div>
                )}
              </div>

              {socraticQuestion && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
                      <Mic className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Your Spoken or Written Oral Defense</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-surface border border-theme rounded-lg p-0.5 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setSpeechLang('en-US')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            speechLang === 'en-US' ? 'bg-primary text-white' : 'text-muted'
                          }`}
                        >
                          EN
                        </button>
                        <button
                          type="button"
                          onClick={() => setSpeechLang('ur-PK')}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                            speechLang === 'ur-PK' ? 'bg-primary text-white' : 'text-muted'
                          }`}
                        >
                          اردو
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={handleToggleVoiceDictation}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          isListening
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                            : 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                        <span>{isListening ? `Speaking (${speechLang === 'ur-PK' ? 'اردو' : 'EN'})...` : 'Speak Your Answer'}</span>
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={4}
                    value={socraticAnswer}
                    onChange={(e) => setSocraticAnswer(e.target.value)}
                    placeholder="Speak into microphone or type your defense here. Explain the core mechanism, why it holds, and which condition must never be forgotten..."
                    className="w-full p-3.5 bg-surface border border-theme rounded-2xl text-xs text-primary placeholder-muted focus:outline-none focus:border-primary resize-y leading-relaxed font-sans"
                  />

                  <button
                    type="button"
                    onClick={handleEvaluateSocraticAnswer}
                    disabled={isEvaluatingSocratic || !socraticAnswer.trim()}
                    className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 min-h-[44px]"
                  >
                    {isEvaluatingSocratic ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                        <span>Socratic Examiner Analyzing Rigor &amp; Misconceptions...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-amber-300" />
                        <span>Submit Oral Defense to Examiner</span>
                      </>
                    )}
                  </button>

                  {/* Socratic Feedback Results */}
                  {socraticFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-2xl bg-surface border border-theme space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3 border-b border-theme/50 pb-3">
                        <div>
                          <span className="text-[10px] font-mono uppercase tracking-widest text-muted block">
                            Oral Exam Evaluation
                          </span>
                          <span className="text-sm font-bold text-primary">Conceptual Depth Result</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-mono font-bold text-primary">{socraticFeedback.score}%</span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                          <strong className="block mb-0.5">Strengths:</strong>
                          {socraticFeedback.praise}
                        </div>

                        {socraticFeedback.misconception ? (
                          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300 space-y-2">
                            <div>
                              <strong className="block mb-0.5">Misconception / Omitted Condition:</strong>
                              {socraticFeedback.misconception}
                            </div>
                            {socraticFeedback.correctUnderstanding && (
                              <div className="text-[11px] opacity-90 border-t border-rose-500/20 pt-1.5">
                                <strong>FBISE Mark Scheme Reference:</strong> {socraticFeedback.correctUnderstanding}
                              </div>
                            )}
                            <div className="pt-1">
                              <button
                                type="button"
                                disabled={socraticMistakeLogged}
                                onClick={handleLogSocraticMistake}
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                              >
                                {socraticMistakeLogged ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                                <span>{socraticMistakeLogged ? 'Recorded in Mistake Vault ✓' : 'Send Misconception to Mistake Vault 📥'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                            Excellent conceptual mastery! No misconceptions detected.
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI DIAGNOSTIC EVALUATION RESULTS (for Written Blurt) */}
          {activeBlurtTab === 'written' && blurtEvaluation && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-surface border border-theme rounded-2xl p-5 sm:p-6 space-y-5"
            >
              {/* Score & Retention Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme/50 pb-4">
                <div>
                  <div className="text-[11px] font-mono font-bold uppercase tracking-widest text-muted">
                    Recall Evaluation &bull; FBISE Mark Scheme Check
                  </div>
                  <h4 className="text-lg font-serif italic font-bold text-primary mt-0.5">
                    {blurtEvaluation.topicName}
                  </h4>
                </div>

                <div className="flex items-center gap-3">
                  {/* Score Meter */}
                  <div className="text-right">
                    <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">
                      {blurtEvaluation.recallScore}%
                    </div>
                    <div className="text-[10px] font-mono text-muted uppercase">Recall Accuracy</div>
                  </div>

                  {/* Retention Badge */}
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-bold font-mono ${
                    blurtEvaluation.recallScore >= 80 ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' :
                    blurtEvaluation.recallScore >= 60 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30' :
                    'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30'
                  }`}>
                    {blurtEvaluation.retentionLevel}
                  </div>
                </div>
              </div>

              {/* Recalled Concepts vs Gaps Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Successfully Recalled */}
                <div className="p-4 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Recalled Concepts ({blurtEvaluation.recalledConcepts.length})</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-primary">
                    {blurtEvaluation.recalledConcepts.map((c, i) => {
                      const title = typeof c === 'string' ? c : (c.concept + (c.detail ? `: ${c.detail}` : ''));
                      return (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-emerald-600 mt-0.5">•</span>
                          <span>{title}</span>
                        </li>
                      );
                    })}
                    {blurtEvaluation.recalledConcepts.length === 0 && (
                      <li className="text-xs text-muted italic">No key concepts identified in this attempt.</li>
                    )}
                  </ul>
                </div>

                {/* Knowledge Gaps & Pitfalls with 1-Click Vault Sync */}
                <div className="p-4 rounded-2xl bg-card border border-theme space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Knowledge Gaps &amp; Traps ({blurtEvaluation.knowledgeGaps.length})</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    {blurtEvaluation.knowledgeGaps.map((g, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-theme-accent border border-theme text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-primary">{g.concept}</div>
                          <button
                            type="button"
                            disabled={loggedMistakeGaps[i]}
                            onClick={() => {
                              addMistake({
                                subject: selectedSubjectName,
                                chapter: selectedChapterName,
                                topic: selectedTopicName,
                                question: `Recall & Explain: ${g.concept}`,
                                studentAnswer: blurtRecallText.slice(0, 250) || 'Missing during active recall',
                                correctAnswer: g.explanation,
                                category: 'conceptual_misconception',
                                studentThoughtProcess: `Omitted or misremembered during active recall session: ${g.concept}`,
                                tags: ['ActiveRecallGap', selectedSubjectName]
                              });
                              setLoggedMistakeGaps(prev => ({ ...prev, [i]: true }));
                              setBlurtSuccessMsg(`"${g.concept}" logged in Mistake Vault for spaced review!`);
                            }}
                            className="px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 text-[10px] font-bold transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
                          >
                            {loggedMistakeGaps[i] ? <Check className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3" />}
                            <span>{loggedMistakeGaps[i] ? 'Logged in Vault' : 'Add to Mistake Vault'}</span>
                          </button>
                        </div>
                        <div className="text-[11px] text-muted leading-relaxed">{g.explanation}</div>
                      </div>
                    ))}
                    {blurtEvaluation.knowledgeGaps.length === 0 && (
                      <div className="text-xs text-muted italic">Great work! No critical gaps found.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Deep Diagnostic Autopsy: Why were you unable to explain to the fullest & Exam Backlashes */}
              {(blurtEvaluation.whyUnableToExplain || (blurtEvaluation.backlashesAndPitfalls && blurtEvaluation.backlashesAndPitfalls.length > 0) || (blurtEvaluation.keyConceptsMissed && blurtEvaluation.keyConceptsMissed.length > 0)) && (
                <div className="p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 space-y-3.5">
                  <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Diagnostic Autopsy: Why You Couldn't Explain Fully &amp; Exam Backlashes</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold">
                      Root Cause Analysis
                    </span>
                  </div>

                  {/* Why unable to explain to the fullest */}
                  {blurtEvaluation.whyUnableToExplain && (
                    <div className="space-y-1 text-xs">
                      <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Why you struggled to explain this topic to the fullest:</span>
                      </div>
                      <p className="text-primary leading-relaxed pl-5 bg-background/50 p-2 rounded-xl border border-amber-500/10">
                        {blurtEvaluation.whyUnableToExplain}
                      </p>
                    </div>
                  )}

                  {/* Missing Essentials */}
                  {blurtEvaluation.keyConceptsMissed && blurtEvaluation.keyConceptsMissed.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>What was missing from your explanation ({blurtEvaluation.keyConceptsMissed.length}):</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {blurtEvaluation.keyConceptsMissed.map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-background text-rose-700 dark:text-rose-300 border border-rose-500/30 text-[11px] font-medium"
                          >
                            <span className="text-rose-500 font-bold">✕</span> {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exam Backlashes / Marking Deductions */}
                  {blurtEvaluation.backlashesAndPitfalls && blurtEvaluation.backlashesAndPitfalls.length > 0 && (
                    <div className="space-y-1.5 text-xs">
                      <div className="font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Board Exam Backlashes &amp; Penalty Deductions:</span>
                      </div>
                      <ul className="space-y-1 pl-5 text-[11px] text-primary">
                        {blurtEvaluation.backlashesAndPitfalls.map((penalty, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-rose-500/5 dark:bg-rose-500/10 p-2 rounded-lg border border-rose-500/15">
                            <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0">⚠️</span>
                            <span>{penalty}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Recommended Immediate Remediation & Option 4 Micro-Drill Re-attempt */}
                  <div className="mt-2 pt-2 border-t border-amber-500/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    {blurtEvaluation.recommendedRemediation ? (
                      <div className="flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl text-emerald-900 dark:text-emerald-200 flex-1">
                        <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-bold mr-1.5">Direct Action to Fix This:</span>
                          <span>{blurtEvaluation.recommendedRemediation}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-muted">
                        Test and cement your missed essentials instantly:
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsDrillModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-2xs cursor-pointer active:scale-95"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Launch 2-Min Targeted Drill</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Diagram / OCR Handwritten Notes Feedback if present */}
              {blurtEvaluation.diagramNotes && (
                <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1">
                  <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Handwritten Notes &amp; Diagram Feedback</span>
                  </div>
                  <p className="text-primary leading-relaxed">{blurtEvaluation.diagramNotes}</p>
                </div>
              )}

              {/* Actionable Next Steps: Syllabus & Revision Integration */}
              <div className="pt-2 border-t border-theme/50 flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mark as Mastered / Completed */}
                  <button
                    type="button"
                    onClick={() => handleUpdateSyllabusStatus(blurtEvaluation.recallScore >= 80 ? 'Mastered' : 'Completed')}
                    disabled={isUpdatingSyllabus}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 min-h-[38px]"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>
                      {blurtEvaluation.recallScore >= 80 ? 'Mark Mastered in Syllabus' : 'Mark Completed in Syllabus'}
                    </span>
                  </button>

                  {/* Add Gaps to Revision Queue */}
                  {blurtEvaluation.knowledgeGaps.length > 0 && onSaveRevision && (
                    <button
                      type="button"
                      onClick={handleAddGapsToRevisionQueue}
                      disabled={isAddingToRevision}
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 min-h-[38px]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Queue Gaps for Tomorrow's Revision</span>
                    </button>
                  )}
                </div>

                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab('revision')}
                    className="text-xs font-bold text-primary hover:opacity-80 underline cursor-pointer"
                  >
                    View in Revision Manager →
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* VIEW 5: OPTION 4 — RUPEX RUBRIC LOCKER & SAVED SCHEMES */}
      {activeMode === 'rupex_locker' && (
        <motion.div
          variants={timerEntranceItemVariants}
          className="bg-card border border-theme rounded-3xl p-5 sm:p-8 shadow-xs space-y-6 transition-colors"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-theme/50 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  <Award className="w-5 h-5 text-indigo-500" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-serif italic font-bold text-primary">
                      Option 4: Rupex Rubric Locker &amp; Saved Marking Schemes
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
                      Option 4
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Save chapter-wise Rupex marking schemes, past paper answer keys, and grading rubrics. Attach them to active recall blurting or run rapid 2-minute targeted remediation drills.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={rubricInputRef}
                type="file"
                accept="image/*,.pdf,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadRubric(e.target.files[0]);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => rubricInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Upload New Rupex</span>
              </button>
            </div>
          </div>

          {/* Active Attached Rubric Banner if one is selected */}
          {rubricFile && (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-emerald-900 dark:text-emerald-200">
                    Currently Attached Rupex: {rubricFile.name}
                  </div>
                  <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-mono">
                    {rubricFile.sizeFormatted} &bull; Attached to {selectedSubjectName} &gt; {selectedChapterName}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('blurt');
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs transition cursor-pointer"
                >
                  Recall with this Rubric →
                </button>
                <button
                  type="button"
                  onClick={() => setRubricFile(null)}
                  className="p-1.5 rounded-lg text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer"
                  title="Detach rubric"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Saved Rupex Schemes Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-primary uppercase tracking-wider">
                Permanent Rupex Vault ({savedRupexList.length} Schemes Stored):
              </span>
              <span className="text-muted">Stored securely on your device</span>
            </div>

            {savedRupexList.length === 0 ? (
              <div className="p-8 rounded-2xl bg-surface border border-theme text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                  <Award className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto">
                  <h4 className="text-sm font-bold text-primary">No Rupex Rubrics in Locker Yet</h4>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Upload official marking schemes, past paper question rubrics, or teacher grading sheets chapter-by-chapter. StudyFlow AI evaluates your recall directly against the board criteria.
                  </p>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => rubricInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs cursor-pointer hover:opacity-90"
                  >
                    Upload First Rupex Scheme
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {savedRupexList.map((rupex) => (
                  <div
                    key={rupex.id}
                    className="p-4 rounded-2xl bg-surface border border-theme flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <h5 className="font-bold text-primary truncate max-w-[200px]" title={rupex.name}>
                            {rupex.name}
                          </h5>
                          <div className="text-[11px] text-muted font-mono mt-0.5">
                            {rupex.subjectName} {rupex.chapterName ? `• ${rupex.chapterName}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-muted shrink-0">
                        {rupex.sizeFormatted}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-theme gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRubricFile(rupex);
                          setBlurtSuccessMsg(`✓ Rupex "${rupex.name}" attached to active recall!`);
                          setActiveMode('blurt');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Zap className="w-3 h-3" />
                        <span>Use for Recall</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubjectName(rupex.subjectName);
                          if (rupex.chapterName) setSelectedChapterName(rupex.chapterName);
                          setIsDrillModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                      >
                        <Award className="w-3 h-3" />
                        <span>2-Min Drill</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteRupexFromLocker(rupex.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer ml-auto"
                        title="Remove from locker"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ZEN FULLSCREEN FOCUS OVERLAY */}
      <AnimatePresence>
        {isFullscreenFocus && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ backgroundColor: 'var(--bg-app)' }}
            className="fixed inset-0 z-[100] flex flex-col justify-between p-6 sm:p-10 overflow-y-auto text-primary"
          >
            {/* Minimal Fullscreen Header */}
            <div className="flex items-center justify-between max-w-4xl w-full mx-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">Distraction-Free Zen Focus</span>
                <span className="text-xs text-muted">&bull; {selectedSubjectName} &gt; {selectedTopicName}</span>
              </div>
              <button
                onClick={() => setIsFullscreenFocus(false)}
                className="p-2.5 rounded-full bg-theme-accent border border-theme text-primary hover:opacity-85 transition cursor-pointer min-h-[40px] flex items-center gap-1.5 text-xs font-bold"
              >
                <Minimize2 className="w-4 h-4" />
                <span>Exit Fullscreen</span>
              </button>
            </div>

            {/* Monumental Vintage Calligraphic Center Clock */}
            <div className="max-w-3xl w-full mx-auto my-auto text-center space-y-6">
              <div className={`text-8xl sm:text-[11rem] md:text-[13rem] tracking-tight text-primary select-none flex items-baseline justify-center font-normal ${
                timerFontStyle === 'cursive' 
                  ? 'font-vintage-cursive italic' 
                  : timerFontStyle === 'serif'
                  ? 'font-serif'
                  : 'font-calligraphic italic'
              }`}>
                <span className="font-light">{minsFormatted}</span>
                <span className="opacity-40 mx-2 sm:mx-3 text-[0.65em] font-light select-none">.</span>
                <span className="font-light text-[0.88em] opacity-90">{secsFormatted}</span>
              </div>
              <p className="text-xs font-mono font-bold tracking-widest text-muted uppercase">
                {isActive ? (isPaused ? '⏸ SESSION PAUSED' : '⚡ DEEP FOCUS ACTIVE') : 'READY'}
              </p>
              <div className="flex items-center justify-center gap-3">
                {isActive && !isPaused ? (
                  <button onClick={handlePauseTimer} className="px-6 py-3 rounded-full bg-amber-600 text-white font-bold text-xs uppercase cursor-pointer">
                    Pause
                  </button>
                ) : (
                  <button onClick={isActive ? handleResumeTimer : handleStartTimer} className="px-8 py-3.5 rounded-full bg-primary text-white font-bold text-xs uppercase cursor-pointer">
                    {isActive ? 'Resume' : 'Start Focus'}
                  </button>
                )}
                <button onClick={handleStopTimer} className="px-6 py-3 rounded-full bg-rose-600 text-white font-bold text-xs uppercase cursor-pointer">
                  Finish
                </button>
              </div>
            </div>

            <div className="text-center text-xs text-muted font-mono max-w-xl w-full mx-auto">
              Press Exit Fullscreen or finish your session whenever you are ready.
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Finish Session Result Modal */}
      <AnimatePresence>
        {isFinishModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="bg-card border border-theme rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-xl relative text-primary space-y-4 max-h-[92vh] overflow-y-auto"
            >
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-serif italic font-bold text-primary">
                {activeMode === 'chapter_sprint' ? 'Chapter Sprint Finished!' : 'Study Session Finished!'}
              </h3>
              <p className="text-xs text-muted">
                {activeMode === 'chapter_sprint' ? (
                  <>
                    <span className="font-semibold">{selectedChapterSprintSubject}</span> —{' '}
                    <span className="text-primary font-bold">
                      {chapterScope === 'multi'
                        ? `${selectedMultiChapterNames.length} Chapters: ${selectedMultiChapterNames.join(', ')}`
                        : selectedSingleChapterName}
                    </span>
                  </>
                ) : (
                  <>
                    {selectedSubjectName} — <span className="text-primary font-bold">{selectedTopicName}</span>
                  </>
                )}
              </p>
            </div>

            {/* Time Spent / Duration Editor */}
            <div className="p-3.5 rounded-2xl bg-surface border border-theme space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-widest text-primary">
                  Focused Time Spent
                </label>
                <span className="text-xs font-mono font-bold text-primary">
                  {sessionLoggedMinutes} mins
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={sessionLoggedMinutes}
                  onChange={(e) => setSessionLoggedMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-24 p-2 bg-card border border-theme rounded-xl text-xs font-mono font-bold text-primary focus:outline-none focus:border-primary min-h-[40px]"
                />
                <span className="text-xs text-muted">minutes focused ("I did this in this time")</span>
              </div>
            </div>

            {/* Status Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-widest text-muted">How did this topic go?</label>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedResult('Completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Completed'
                      ? 'bg-primary/15 border-primary text-primary'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">✅</span>
                    <span>Topic Completed Fully</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">Mastered / Done</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResult('Partially completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Partially completed'
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 dark:text-amber-200'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚠️</span>
                    <span>Partially Completed</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">In Progress</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedResult('Not completed')}
                  className={`p-3 rounded-2xl border text-xs font-bold text-left transition flex items-center justify-between cursor-pointer active:scale-98 ${
                    selectedResult === 'Not completed'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-900 dark:text-rose-200'
                      : 'bg-surface border-theme text-muted hover:bg-theme-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">❌</span>
                    <span>Needs Review / More Practice</span>
                  </div>
                  <span className="text-[10px] uppercase font-mono">Needs Work</span>
                </button>
              </div>
            </div>

            {/* Need More Time? Extension Bar */}
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-xs text-primary flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Not finished with your work yet?</span>
                </span>
                <p className="text-[11px] text-muted leading-tight">
                  Add more time and keep your study session active without losing progress.
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setIsFinishModalOpen(false);
                    handleExtendTimer(5);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  +5m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFinishModalOpen(false);
                    handleExtendTimer(10);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  +10m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFinishModalOpen(false);
                    handleExtendTimer(15);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  +15m
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsFinishModalOpen(false);
                    handleExtendTimer(25);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
                >
                  +25m Keep Going
                </button>
              </div>
            </div>

            {/* 60-Second Feynman Blurt (Option 4) */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>60-Second Feynman Blurt (Option 4)</span>
                </span>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-300">Locks in recall</span>
              </div>
              <p className="text-[11px] text-muted leading-tight">
                In 1-2 sentences, what was the core takeaway or formula? Blurting it out cements neural pathways.
              </p>
              <textarea
                value={feynmanBlurt}
                onChange={(e) => setFeynmanBlurt(e.target.value)}
                placeholder="e.g., Core takeaway: when temperature increases, reaction rate doubles because..."
                rows={2}
                className="w-full p-2.5 bg-card border border-theme rounded-xl text-xs text-primary placeholder-muted focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
              />
            </div>

            {/* Optional Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-muted mb-1">Optional Session Notes</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Key formulas, concepts grasped, or difficulty notes..."
                className="w-full p-2.5 bg-surface border border-theme rounded-xl text-xs text-primary focus:outline-none focus:border-primary min-h-[40px]"
              />
            </div>

            {/* Multi-Channel Session Delivery: Email AND WhatsApp Supported */}
            <div className="p-3.5 bg-surface-raised/60 border border-theme rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-primary" />
                  <span>Session Delivery & Accountability</span>
                </span>
                <span className="text-[10px] font-mono text-muted font-bold">Dual Delivery Ready</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Email Delivery Toggle */}
                <label className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                  sendEmailOnFinish ? 'bg-primary/5 border-primary/40 text-primary' : 'bg-surface border-theme text-muted'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendEmailOnFinish}
                    onChange={(e) => setSendEmailOnFinish(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-primary focus:ring-primary border-theme cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Mail className="w-3.5 h-3.5 text-primary" />
                      <span>Email Report</span>
                    </div>
                    <span className="text-[10px] text-muted block truncate mt-0.5">
                      {userProfile?.email || user?.email || getActiveUserEmail() || 'Active Email Account'}
                    </span>
                  </div>
                </label>

                {/* WhatsApp Delivery Toggle */}
                <label className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start gap-2.5 ${
                  sendWhatsAppOnFinish ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300' : 'bg-surface border-theme text-muted'
                }`}>
                  <input
                    type="checkbox"
                    checked={sendWhatsAppOnFinish}
                    onChange={(e) => setSendWhatsAppOnFinish(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-theme cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>WhatsApp Notice</span>
                    </div>
                    <span className="text-[10px] text-muted block truncate mt-0.5">
                      {recipientPhoneInput ? recipientPhoneInput : 'Direct wa.me link'}
                    </span>
                  </div>
                </label>
              </div>

              {/* Optional WhatsApp Number Customizer */}
              {sendWhatsAppOnFinish && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] text-muted font-bold shrink-0">WhatsApp Number:</span>
                  <input
                    type="tel"
                    value={recipientPhoneInput}
                    onChange={(e) => setRecipientPhoneInput(e.target.value)}
                    placeholder="e.g. +1234567890 (or blank for picker)"
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-surface border border-theme text-primary placeholder-muted focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* 1-3-7 Spaced Revision Integration (Method 1) */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addTo137OnFinish}
                  onChange={(e) => setAddTo137OnFinish(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-theme cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-900 dark:text-amber-200">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Add this topic to 1-3-7 Revision?</span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Automatically schedules <strong>Day 1</strong> (tomorrow), <strong>Day 3</strong>, and <strong>Day 7</strong> revisions linked to <em>{selectedSubjectName} → {selectedChapterName} → {selectedTopicName}</em>{selectedSloCode ? ` (${selectedSloCode})` : ''}.
                  </p>
                </div>
              </label>
            </div>

            {/* Revision & Progress Saving Notice */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Saving {sessionLoggedMinutes}m to Revision & Progress</span>
              </div>
              <p className="text-[11px] opacity-90 leading-relaxed">
                This study duration will be automatically recorded in your <strong>Revision Queue</strong> and <strong>Progress</strong> analytics for <em>"{selectedTopicName}"</em>.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleSaveAndStartBlurt}
                disabled={isSendingEmail}
                className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs min-h-[44px]"
              >
                <Zap className="w-4 h-4 text-amber-300" />
                <span>Save & Evaluate with AI Blurt (Lock in Recall)</span>
              </button>

              {/* Primary Dual / Multi-Channel Save Button */}
              <button
                type="button"
                onClick={() => handleSaveResult()}
                disabled={isSendingEmail}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50 min-h-[44px]"
              >
                {isSendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {sendEmailOnFinish && sendWhatsAppOnFinish
                    ? '🚀 Save & Dispatch to Both (Email + WhatsApp)'
                    : sendEmailOnFinish
                    ? '📧 Save & Email Summary'
                    : sendWhatsAppOnFinish
                    ? '📲 Save & Send WhatsApp'
                    : '💾 Save to Revision & Progress'}
                </span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveResult({ sendEmail: false, sendWhatsApp: false })}
                  disabled={isSendingEmail}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition flex items-center justify-center cursor-pointer shadow-2xs min-h-[42px]"
                >
                  <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                  <span>Save Locally Only</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsFinishModalOpen(false)}
                  disabled={isSendingEmail}
                  className="px-4 py-2.5 rounded-xl text-muted hover:text-primary text-xs font-bold transition cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
              </div>
            </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Targeted 2-Minute Remediation Drill Modal (Option 4) */}
      <TargetedRemediationDrillModal
        isOpen={isDrillModalOpen}
        onClose={() => setIsDrillModalOpen(false)}
        subjectName={selectedSubjectName}
        topicName={selectedTopicName}
        sourceContext="Blurt Recall Autopsy"
        diagnosedRootCause={blurtEvaluation?.whyUnableToExplain || 'Concepts missed during active recall blurt'}
        missingConcepts={blurtEvaluation?.keyConceptsMissed || blurtEvaluation?.knowledgeGaps.map(g => g.concept) || []}
      />

      {/* Official SBBM Printable Answer Sheet Modal with Target Stamps */}
      <SbbmAnswerSheetModal
        isOpen={isAnswerSheetModalOpen}
        onClose={() => setIsAnswerSheetModalOpen(false)}
        subjects={subjects}
        userProfile={userProfile}
        defaultSubject={mcqSelectedSubject}
        defaultMcqBenchmark={mcqSecondsPerQuestion}
        defaultSqBenchmark={sqMinutesPerQuestion}
        defaultLqBenchmark={lqMinutesPerQuestion}
      />
    </motion.div>
  );
};

