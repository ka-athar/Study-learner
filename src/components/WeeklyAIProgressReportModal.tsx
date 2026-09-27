import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Volume2, 
  VolumeX, 
  Copy, 
  Layers, 
  ArrowRight, 
  RotateCcw, 
  Brain, 
  Mic, 
  MicOff, 
  Play, 
  Pause, 
  BookmarkCheck, 
  TrendingUp, 
  ChevronRight, 
  ShieldCheck, 
  Flame, 
  Award,
  Zap,
  RefreshCw,
  FileText,
  MessageSquare
} from 'lucide-react';
import { 
  StudySession, 
  TestResult, 
  RevisionItem, 
  Subject, 
  UserProfile, 
  FlashcardDeck,
  ActiveTab
} from '../types';
import { apiGenerateWeeklyRetrospectiveSummary, apiEvaluateFeynmanExplanation } from '../lib/aiApi';
import { loadMistakes } from '../lib/mistakeVaultStorage';

export interface WeeklyAIProgressReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: StudySession[];
  testResults: TestResult[];
  revisions: RevisionItem[];
  subjects: Subject[];
  userProfile?: UserProfile | null;
  onAddTo137Cycle?: (params: {
    subjectName: string;
    chapterName: string;
    topicName: string;
    studyDate?: string;
    notes?: string;
  }) => void;
  onSaveFlashcardDeck?: (deck: FlashcardDeck | Omit<FlashcardDeck, 'id'>) => Promise<void> | void;
  onNavigateTab?: (tab: ActiveTab) => void;
}

export const WeeklyAIProgressReportModal: React.FC<WeeklyAIProgressReportModalProps> = ({
  isOpen,
  onClose,
  sessions = [],
  testResults = [],
  revisions = [],
  subjects = [],
  userProfile,
  onAddTo137Cycle,
  onSaveFlashcardDeck,
  onNavigateTab
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'weak_topics' | 'universal_prompts' | 'feynman_check'>('overview');
  const [isGenerating, setIsGenerating] = useState(false);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Time range selection (defaults to past 7 days)
  const [dateRangeMode, setDateRangeMode] = useState<'past_7_days' | 'this_calendar_week' | 'past_14_days'>('past_7_days');

  // Option A Audio TTS player state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [speechSynthesisAvailable, setSpeechSynthesisAvailable] = useState(false);

  // Option D Feynman Verbal Check state
  const [selectedFeynmanTopic, setSelectedFeynmanTopic] = useState<{ subject: string; topic: string; chapter?: string } | null>(null);
  const [isRecordingSpeech, setIsRecordingSpeech] = useState(false);
  const [spokenTranscript, setSpokenTranscript] = useState('');
  const [isEvaluatingSpeech, setIsEvaluatingSpeech] = useState(false);
  const [feynmanEvaluation, setFeynmanEvaluation] = useState<any | null>(null);

  // Remediation loop state (Option B tracking)
  const [enrolledTopicKeys, setEnrolledTopicKeys] = useState<Set<string>>(new Set());
  const [createdDeckTopicKeys, setCreatedDeckTopicKeys] = useState<Set<string>>(new Set());
  const [activeDrillTopicKey, setActiveDrillTopicKey] = useState<string | null>(null);
  const [userDrillAnswer, setUserDrillAnswer] = useState('');
  const [drillFeedback, setDrillFeedback] = useState<string | null>(null);

  // Check speech synthesis support
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSynthesisAvailable(true);
    }
  }, []);

  // Filter study data by date range
  const filteredData = useMemo(() => {
    const now = new Date();
    const daysToSubtract = dateRangeMode === 'past_14_days' ? 14 : 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(now.getDate() - daysToSubtract);
    cutoffDate.setHours(0, 0, 0, 0);

    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    const nowStr = now.toISOString().split('T')[0];

    const weekSessions = sessions.filter(s => (s.date && s.date >= cutoffStr) || (s.timestamp && s.timestamp >= cutoffDate.getTime()));
    const weekTests = testResults.filter(t => t.date && t.date >= cutoffStr);
    const weekRevisions = revisions; // all revisions with stage statuses
    const mistakes = loadMistakes();

    return {
      startDate: cutoffStr,
      endDate: nowStr,
      sessions: weekSessions,
      testResults: weekTests,
      revisions: weekRevisions,
      mistakes
    };
  }, [sessions, testResults, revisions, dateRangeMode]);

  // Handle generating summary with Gemini
  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setActionFeedback(null);
    try {
      const res = await apiGenerateWeeklyRetrospectiveSummary({
        weekLabel: dateRangeMode === 'past_14_days' ? 'Past 14 Days' : 'Past 7 Days',
        startDate: filteredData.startDate,
        endDate: filteredData.endDate,
        sessions: filteredData.sessions.slice(0, 40),
        testResults: filteredData.testResults.slice(0, 20),
        revisions: filteredData.revisions.slice(0, 40),
        subjects,
        mistakes: filteredData.mistakes.slice(0, 30),
        userProfile: userProfile || undefined
      });

      if (res && res.summary) {
        setSummaryData(res.summary);
        if (res.summary.weakTopics && res.summary.weakTopics.length > 0) {
          setSelectedFeynmanTopic({
            subject: res.summary.weakTopics[0].subjectName,
            topic: res.summary.weakTopics[0].topicName,
            chapterName: res.summary.weakTopics[0].chapterName
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setActionFeedback('Failed to generate AI weekly summary: ' + (err.message || 'Please retry.'));
    } finally {
      setIsGenerating(false);
    }
  };

  // Auto-generate on first open if not generated yet
  useEffect(() => {
    if (isOpen && !summaryData && !isGenerating) {
      handleGenerateSummary();
    }
  }, [isOpen]);

  // Option A: TTS Voice Player for Audio Summary
  const handleToggleVoicePlayback = () => {
    if (!speechSynthesisAvailable || !summaryData?.audioVoiceSummary) return;

    if (isPlayingAudio) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(summaryData.audioVoiceSummary);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
      setIsPlayingAudio(true);
    }
  };

  // Cleanup speech on modal close
  useEffect(() => {
    if (!isOpen && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlayingAudio(false);
    }
  }, [isOpen]);

  // Option A: Copy prompt text to clipboard
  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  // Option B: Stage 1 - Create Recall Flashcard
  const handleStage1CreateFlashcard = async (item: any) => {
    const key = `${item.subjectName}:::${item.topicName}`;
    if (!onSaveFlashcardDeck) {
      setActionFeedback(`Flashcards engine ready for "${item.topicName}".`);
      return;
    }

    try {
      const newDeck: Omit<FlashcardDeck, 'id'> = {
        userId: userProfile?.id || 'local-user',
        title: `${item.topicName} — Remediation Drill`,
        subjectName: item.subjectName,
        chapterName: item.chapterName || '',
        cards: [
          {
            id: `card-${Date.now()}-1`,
            question: item.remediation?.flashcardFront || `Explain the core principle of ${item.topicName}.`,
            answer: item.remediation?.flashcardBack || item.keyConceptToReview || 'Review core formulas and definitions.',
            masteryLevel: 'learning'
          }
        ],
        createdAt: new Date().toISOString()
      };

      await onSaveFlashcardDeck(newDeck);
      setCreatedDeckTopicKeys(prev => new Set(prev).add(key));
      setActionFeedback(`✨ Flashcard created for "${item.topicName}"!`);
      setTimeout(() => setActionFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      setActionFeedback('Failed to create flashcard: ' + err.message);
    }
  };

  // Option B: Stage 2 - Enroll in 1-3-7 Spaced Cycle
  const handleStage2Enroll137 = (item: any) => {
    const key = `${item.subjectName}:::${item.topicName}`;
    if (onAddTo137Cycle) {
      onAddTo137Cycle({
        subjectName: item.subjectName,
        chapterName: item.chapterName || '',
        topicName: item.topicName,
        studyDate: new Date().toISOString().split('T')[0],
        notes: `Remediation from Weekly Review: ${item.diagnosticReason || ''}`
      });
      setEnrolledTopicKeys(prev => new Set(prev).add(key));
      setActionFeedback(`🚀 Enrolled "${item.topicName}" into 1-3-7 Spaced Revision!`);
      setTimeout(() => setActionFeedback(null), 3500);
    }
  };

  // Option D: Web Speech Recognition for Verbal Feynman Check
  const speechRecognitionRef = useRef<any>(null);

  const handleToggleSpeechRecording = () => {
    if (isRecordingSpeech) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setIsRecordingSpeech(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please type your explanation below instead!');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript + ' ';
        }
        setSpokenTranscript(transcript.trim());
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition error:', e);
        setIsRecordingSpeech(false);
      };

      recognition.onend = () => {
        setIsRecordingSpeech(false);
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsRecordingSpeech(true);
    } catch (e) {
      console.error(e);
      setIsRecordingSpeech(false);
    }
  };

  // Option D: Submit spoken explanation for AI evaluation
  const handleEvaluateFeynman = async () => {
    if (!selectedFeynmanTopic || !spokenTranscript.trim()) return;

    setIsEvaluatingSpeech(true);
    setFeynmanEvaluation(null);
    try {
      const res = await apiEvaluateFeynmanExplanation({
        subjectName: selectedFeynmanTopic.subject,
        topicName: selectedFeynmanTopic.topic,
        chapterName: selectedFeynmanTopic.chapter,
        spokenTranscript: spokenTranscript.trim()
      });

      if (res && res.evaluation) {
        setFeynmanEvaluation(res.evaluation);
      }
    } catch (err: any) {
      console.error(err);
      setActionFeedback('Failed to evaluate verbal explanation: ' + err.message);
    } finally {
      setIsEvaluatingSpeech(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-surface border border-theme rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-theme flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-raised/40">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span>AI Weekly Retrospective & Remediation Hub</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-primary flex items-center gap-2">
              <span>Weekly Academic Diagnostic Summary</span>
            </h2>
            <p className="text-xs text-muted max-w-2xl leading-relaxed">
              Synthesizes your week's logged study sessions, test scores, mistakes, and 1-3-7 retention records into actionable masteries, AI prompts, and remedial loops.
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-95 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-sm"
              title="Regenerate diagnostic summary with Gemini"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>{isGenerating ? 'Analyzing...' : 'Regenerate'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-surface-raised border border-theme transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="mx-6 mt-3 p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-5 sm:px-6 pt-2 border-b border-theme flex items-center gap-2 bg-surface overflow-x-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Overview & Masteries</span>
          </button>

          <button
            onClick={() => setActiveTab('weak_topics')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'weak_topics'
                ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Weak Topics & Remediation (Option B)</span>
            {summaryData?.weakTopics && summaryData.weakTopics.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-mono">
                {summaryData.weakTopics.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('universal_prompts')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'universal_prompts'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>AI Prompts & Podcast (Option A)</span>
          </button>

          <button
            onClick={() => setActiveTab('feynman_check')}
            className={`px-3 py-2 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'feynman_check'
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-muted hover:text-primary'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Explain Aloud / Feynman (Option D)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {isGenerating && !summaryData && (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto border border-indigo-500/20">
                <RefreshCw className="w-7 h-7 animate-spin" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="font-extrabold text-base text-primary">Gemini is analyzing your weekly study logs...</h3>
                <p className="text-xs text-muted">
                  Cross-referencing focus hours, test accuracy, mistake records, and 1-3-7 retention pipelines.
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & MASTERED TOPICS */}
          {activeTab === 'overview' && summaryData && (
            <div className="space-y-6 animate-in fade-in">
              {/* Executive Headline Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-900/15 via-surface-raised to-surface border border-emerald-500/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      WEEKLY TRAJECTORY
                    </span>
                    <h3 className="text-lg font-extrabold text-primary">
                      {summaryData.overview?.headline || 'Weekly Study Progress & Mastery Report'}
                    </h3>
                  </div>

                  {/* Audio Voice Summary Player */}
                  {summaryData.audioVoiceSummary && speechSynthesisAvailable && (
                    <button
                      onClick={handleToggleVoicePlayback}
                      className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl font-bold text-xs transition cursor-pointer shrink-0 shadow-sm ${
                        isPlayingAudio 
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {isPlayingAudio ? (
                        <>
                          <VolumeX className="w-4 h-4" />
                          <span>Stop Audio Debrief</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          <span>Play Audio Debrief (60s)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                  {summaryData.overview?.executiveSummary}
                </p>

                {/* Metric Quick Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-theme/40 text-center">
                  <div className="p-2.5 rounded-xl bg-surface border border-theme">
                    <span className="text-[10px] font-bold uppercase text-muted block">Study Time</span>
                    <span className="text-base font-extrabold font-mono text-primary">
                      {Math.round((summaryData.overview?.totalStudyMinutes || 0) / 60)}h {(summaryData.overview?.totalStudyMinutes || 0) % 60}m
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-theme">
                    <span className="text-[10px] font-bold uppercase text-emerald-500 block">Mastered Topics</span>
                    <span className="text-base font-extrabold font-mono text-emerald-500">
                      {summaryData.masteredTopics?.length || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-theme">
                    <span className="text-[10px] font-bold uppercase text-rose-500 block">Need Review</span>
                    <span className="text-base font-extrabold font-mono text-rose-500">
                      {summaryData.weakTopics?.length || 0}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-surface border border-theme">
                    <span className="text-[10px] font-bold uppercase text-indigo-400 block">Logged Sessions</span>
                    <span className="text-base font-extrabold font-mono text-indigo-400">
                      {filteredData.sessions.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Mastered Topics Showcase */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-primary flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Conquered & Mastered Topics This Week</span>
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    High retention & test accuracy
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(summaryData.masteredTopics || []).map((topic: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl bg-surface-raised border border-theme flex flex-col justify-between space-y-2 shadow-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted truncate">
                            {topic.subjectName}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                            {topic.masteryBadge || 'Mastered'}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-primary">
                          {topic.topicName}
                        </h4>
                        <p className="text-[11px] text-muted leading-relaxed">
                          {topic.masteryReason}
                        </p>
                      </div>
                    </div>
                  ))}

                  {(!summaryData.masteredTopics || summaryData.masteredTopics.length === 0) && (
                    <div className="col-span-2 p-6 text-center rounded-2xl bg-surface border border-theme text-xs text-muted">
                      No mastered topics recorded this week. Complete more focus sessions or 1-3-7 milestones!
                    </div>
                  )}
                </div>
              </div>

              {/* Next Week Action Gameplan */}
              {summaryData.nextWeekGameplan && summaryData.nextWeekGameplan.length > 0 && (
                <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2.5">
                  <h4 className="text-xs font-bold text-primary flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="w-4 h-4 text-indigo-500" />
                    <span>Next Week Recommended Action Steps</span>
                  </h4>
                  <ul className="space-y-1.5">
                    {summaryData.nextWeekGameplan.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-muted flex items-start gap-2">
                        <span className="w-4 h-4 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: WEAK TOPICS & 3-STAGE REMEDIATION LOOP (Option B) */}
          {activeTab === 'weak_topics' && summaryData && (
            <div className="space-y-5 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4" />
                  <span>The 3-Stage Mistake Remediation Loop</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Turn weak areas into permanent knowledge through 3 coordinated steps:
                  <strong> Stage 1 (Immediate Flashcard)</strong> → <strong>Stage 2 (+24h 1-3-7 Spaced Repetition)</strong> → <strong>Stage 3 (Diagnostic Test Drill)</strong>.
                </p>
              </div>

              <div className="space-y-4">
                {(summaryData.weakTopics || []).map((topic: any, idx: number) => {
                  const key = `${topic.subjectName}:::${topic.topicName}`;
                  const isDeckCreated = createdDeckTopicKeys.has(key);
                  const is137Enrolled = enrolledTopicKeys.has(key);
                  const isDrillActive = activeDrillTopicKey === key;

                  return (
                    <div
                      key={idx}
                      className="p-5 rounded-3xl bg-surface-raised border border-theme space-y-4 shadow-sm"
                    >
                      {/* Topic Title & Issue Meta */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 border-b border-theme/40 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            {topic.subjectName} {topic.chapterName ? `• ${topic.chapterName}` : ''}
                          </span>
                          <h4 className="font-extrabold text-base text-primary">
                            {topic.topicName}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                            topic.severity === 'critical'
                              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          }`}>
                            {topic.severity?.toUpperCase() || 'MODERATE'} RISK
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-theme text-muted">
                            {topic.issueType?.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic Breakdown */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-surface border border-theme space-y-1">
                          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase block">
                            Diagnostic What Went Wrong:
                          </span>
                          <p className="text-primary leading-relaxed">
                            {topic.diagnosticReason}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-surface border border-theme space-y-1">
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase block">
                            Key Rule / Law to Review:
                          </span>
                          <p className="text-primary leading-relaxed font-medium">
                            {topic.keyConceptToReview}
                          </p>
                        </div>
                      </div>

                      {/* 3-Stage Remediation Actions */}
                      <div className="pt-2 flex flex-wrap items-center gap-2">
                        {/* Stage 1: Flashcard */}
                        <button
                          onClick={() => handleStage1CreateFlashcard(topic)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                            isDeckCreated
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-surface hover:bg-theme-accent border border-theme text-primary shadow-xs'
                          }`}
                        >
                          <Brain className="w-3.5 h-3.5 text-indigo-500" />
                          <span>{isDeckCreated ? '✓ Stage 1 Card Created' : 'Stage 1: Generate Recall Card'}</span>
                        </button>

                        {/* Stage 2: 1-3-7 Spaced Cycle */}
                        <button
                          onClick={() => handleStage2Enroll137(topic)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                            is137Enrolled
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                              : 'bg-surface hover:bg-theme-accent border border-theme text-primary shadow-xs'
                          }`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-violet-500" />
                          <span>{is137Enrolled ? '✓ Stage 2 Enrolled (1-3-7)' : 'Stage 2: Enroll in 1-3-7'}</span>
                        </button>

                        {/* Stage 3: Immediate Diagnostic Drill */}
                        <button
                          onClick={() => {
                            if (isDrillActive) {
                              setActiveDrillTopicKey(null);
                            } else {
                              setActiveDrillTopicKey(key);
                              setUserDrillAnswer('');
                              setDrillFeedback(null);
                            }
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer ${
                            isDrillActive
                              ? 'bg-primary text-white'
                              : 'bg-surface hover:bg-theme-accent border border-theme text-primary shadow-xs'
                          }`}
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-500" />
                          <span>{isDrillActive ? 'Close Drill' : 'Stage 3: Test Yourself Now'}</span>
                        </button>

                        {/* Launch Feynman Option D check for this topic */}
                        <button
                          onClick={() => {
                            setSelectedFeynmanTopic({
                              subject: topic.subjectName,
                              topic: topic.topicName,
                              chapter: topic.chapterName
                            });
                            setActiveTab('feynman_check');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold transition cursor-pointer"
                        >
                          <Mic className="w-3.5 h-3.5 text-purple-500" />
                          <span>Explain Aloud (Feynman)</span>
                        </button>
                      </div>

                      {/* Stage 3 Interactive Drill Panel */}
                      {isDrillActive && (
                        <div className="p-4 rounded-2xl bg-surface border border-theme space-y-3 animate-in fade-in">
                          <div className="space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 block">
                              Diagnostic Retrieval Question:
                            </span>
                            <p className="text-sm font-bold text-primary">
                              {topic.remediation?.diagnosticQuestion || `Explain how ${topic.topicName} applies to exam questions.`}
                            </p>
                          </div>

                          <textarea
                            rows={3}
                            value={userDrillAnswer}
                            onChange={(e) => setUserDrillAnswer(e.target.value)}
                            placeholder="Type your answer or working steps here..."
                            className="w-full p-3 rounded-xl border border-theme bg-surface-raised text-primary text-xs focus:ring-1 focus:ring-primary"
                          />

                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => {
                                setDrillFeedback(topic.remediation?.modelAnswer || 'Compare with textbook model answer.');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-95 transition cursor-pointer shadow-xs"
                            >
                              Check Answer Key
                            </button>
                          </div>

                          {drillFeedback && (
                            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-primary space-y-1 animate-in fade-in">
                              <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                                Model Expected Answer:
                              </span>
                              <p className="leading-relaxed whitespace-pre-line">{drillFeedback}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {(!summaryData.weakTopics || summaryData.weakTopics.length === 0) && (
                  <div className="p-10 text-center rounded-3xl bg-surface border border-theme text-xs text-muted">
                    No critical weak topics flagged this week! All tested topics achieved satisfactory accuracy.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: UNIVERSAL PROMPTS & AUDIO PODCAST SCRIPT (Option A) */}
          {activeTab === 'universal_prompts' && summaryData && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                  <MessageSquare className="w-4 h-4" />
                  <span>Universal AI-Ready Prompts & NotebookLM Podcast</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  Copy any of these structured prompts directly into <strong>ChatGPT, Claude, Gemini, or DeepSeek</strong>. 
                  They are pre-loaded with your exact weak topics, failure patterns, and syllabus context.
                </p>
              </div>

              {/* Prompt 1: Comprehensive Diagnostic Tutor Prompt */}
              <div className="p-5 rounded-3xl bg-surface-raised border border-theme space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-primary flex items-center gap-2">
                      <span>🤖 Master Diagnostic Prompt (For ChatGPT / Claude / DeepSeek)</span>
                    </h4>
                    <p className="text-xs text-muted">
                      Instructs the AI to analyze your weak topics, explain traps, and create a 5-question test.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyText(summaryData.universalPrompts?.chatGptDeepSeekPrompt || '', 'chatGpt')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedKey === 'chatGpt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'chatGpt' ? 'Copied!' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-theme text-xs font-mono text-muted leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                  {summaryData.universalPrompts?.chatGptDeepSeekPrompt || 'Generating prompt...'}
                </div>
              </div>

              {/* Prompt 2: Strict Socratic Examiner Drill */}
              <div className="p-5 rounded-3xl bg-surface-raised border border-theme space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-primary flex items-center gap-2">
                      <span>⚖️ Strict Socratic Examiner Prompt</span>
                    </h4>
                    <p className="text-xs text-muted">
                      Turns any AI into a strict board examiner who tests you 1 question at a time.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyText(summaryData.universalPrompts?.examinerSocraticPrompt || '', 'socratic')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedKey === 'socratic' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'socratic' ? 'Copied!' : 'Copy Prompt'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-theme text-xs font-mono text-muted leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                  {summaryData.universalPrompts?.examinerSocraticPrompt || 'Generating prompt...'}
                </div>
              </div>

              {/* Prompt 3: NotebookLM 2-Speaker Podcast Dialogue Script */}
              <div className="p-5 rounded-3xl bg-surface-raised border border-theme space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-extrabold text-sm text-primary flex items-center gap-2">
                      <span>🎙️ NotebookLM / Podcast Audio Script</span>
                    </h4>
                    <p className="text-xs text-muted">
                      Paste into Google NotebookLM or listen to two AI hosts debrief your study week with vivid analogies.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopyText(summaryData.universalPrompts?.notebookLmAudioScript || '', 'notebooklm')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition active:scale-95 cursor-pointer shadow-xs shrink-0"
                  >
                    {copiedKey === 'notebooklm' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'notebooklm' ? 'Copied!' : 'Copy Script'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-2xl bg-surface border border-theme text-xs font-mono text-muted leading-relaxed max-h-48 overflow-y-auto whitespace-pre-line">
                  {summaryData.universalPrompts?.notebookLmAudioScript || 'Generating script...'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: EXPLAIN ALOUD / FEYNMAN AUDIO CHECK (Option D) */}
          {activeTab === 'feynman_check' && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 rounded-2xl bg-purple-500/5 border border-purple-500/20 space-y-2">
                <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                  <Mic className="w-4 h-4" />
                  <span>Socratic Feynman Verbal Check — Explain Aloud</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  The fastest test of true conceptual mastery: <strong>explain the concept in your own words aloud</strong> for 30–90 seconds. 
                  Gemini analyzes your verbal transcript against board marking criteria, checking for omitted formulas and subtle misconceptions.
                </p>
              </div>

              {/* Topic Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-primary block">
                  Select Topic to Explain:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {(summaryData?.weakTopics || []).map((t: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => {
                        setSelectedFeynmanTopic({ subject: t.subjectName, topic: t.topicName, chapter: t.chapterName });
                        setSpokenTranscript('');
                        setFeynmanEvaluation(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        selectedFeynmanTopic?.topic === t.topicName
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-surface-raised border border-theme text-muted hover:text-primary'
                      }`}
                    >
                      {t.topicName}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Recording and Transcript Area */}
              {selectedFeynmanTopic && (
                <div className="p-5 rounded-3xl bg-surface-raised border border-theme space-y-4 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-theme/40 pb-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                        {selectedFeynmanTopic.subject}
                      </span>
                      <h4 className="font-extrabold text-base text-primary">
                        Explain "{selectedFeynmanTopic.topic}" Aloud
                      </h4>
                    </div>

                    <button
                      onClick={handleToggleSpeechRecording}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-bold text-xs transition active:scale-95 cursor-pointer shadow-sm ${
                        isRecordingSpeech
                          ? 'bg-rose-600 text-white animate-pulse'
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {isRecordingSpeech ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      <span>{isRecordingSpeech ? 'Listening... Click to Stop' : '🎤 Click & Speak Aloud'}</span>
                    </button>
                  </div>

                  {/* Transcript textarea (editable in case mic missed a word) */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-muted flex items-center justify-between">
                      <span>Your Spoken Explanation:</span>
                      <span className="text-[10px]">{spokenTranscript.split(/\s+/).filter(Boolean).length} words</span>
                    </label>
                    <textarea
                      rows={5}
                      value={spokenTranscript}
                      onChange={(e) => setSpokenTranscript(e.target.value)}
                      placeholder="Click the microphone button and start speaking, or type your verbal explanation here..."
                      className="w-full p-4 rounded-2xl border border-theme bg-surface text-primary text-xs sm:text-sm font-sans leading-relaxed focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={handleEvaluateFeynman}
                      disabled={isEvaluatingSpeech || !spokenTranscript.trim()}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-primary text-white text-xs font-bold hover:opacity-95 shadow-md transition active:scale-95 disabled:opacity-40 cursor-pointer"
                    >
                      {isEvaluatingSpeech ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Evaluating Mastery...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Evaluate Verbal Mastery</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Evaluation Report */}
                  {feynmanEvaluation && (
                    <div className="p-5 rounded-2xl bg-surface border border-theme space-y-4 animate-in fade-in">
                      <div className="flex items-center justify-between border-b border-theme/40 pb-3">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                            Feynman Assessment
                          </span>
                          <h4 className="text-base font-extrabold text-primary">
                            Mastery Score: <span className="text-emerald-500 font-mono">{feynmanEvaluation.score}/100</span> (Grade {feynmanEvaluation.grade})
                          </h4>
                        </div>
                        <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                          {feynmanEvaluation.overallVerdict}
                        </span>
                      </div>

                      {/* Correct vs Missing Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Concepts Explained Accurately:</span>
                          </span>
                          <ul className="space-y-1 list-disc list-inside text-muted">
                            {(feynmanEvaluation.coveredAccurately || []).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1.5">
                          <span className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4" />
                            <span>Omitted Keywords, Laws & Formulas:</span>
                          </span>
                          <ul className="space-y-1 list-disc list-inside text-muted">
                            {(feynmanEvaluation.missingKeywordsAndFormulas || []).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Misconceptions Warning */}
                      {feynmanEvaluation.misconceptionsIdentified && feynmanEvaluation.misconceptionsIdentified.length > 0 && (
                        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                          <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                            <Flame className="w-4 h-4 text-amber-500" />
                            <span>Subtle Misconceptions Detected:</span>
                          </span>
                          {feynmanEvaluation.misconceptionsIdentified.map((m: any, i: number) => (
                            <div key={i} className="pl-4 border-l-2 border-amber-500 space-y-0.5">
                              <span className="text-muted block">You claimed: "{m.studentClaim}"</span>
                              <span className="text-primary font-medium block">Correction: {m.correction}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feynman Memory Model Analogy */}
                      {feynmanEvaluation.feynmanAnalogyModel && (
                        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs space-y-1">
                          <span className="font-bold text-purple-700 dark:text-purple-300 block">
                            💡 Feynman Everyday Memory Model:
                          </span>
                          <p className="text-primary italic leading-relaxed">
                            "{feynmanEvaluation.feynmanAnalogyModel}"
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-theme bg-surface-raised/40 flex items-center justify-between gap-3 text-xs">
          <span className="text-muted text-[11px] font-mono">
            Integrates study timer logs, tests, mistake vault, & 1-3-7 revisions.
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-surface border border-theme text-primary font-bold hover:bg-theme-accent transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
