import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Clock, 
  Brain, 
  CheckCircle2, 
  Sparkles, 
  Play, 
  Pause, 
  RotateCcw, 
  Layers, 
  BookOpen, 
  Check, 
  Plus, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Subject, Topic } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface BlurtingDiffCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectName?: string;
  initialTopicName?: string;
  onAddMissedToFlashcards?: (topicName: string, missedKeywords: string[]) => void;
  onAdd137RevisionCycle?: (params: { subjectName: string; chapterName?: string; topicName: string; notes?: string }) => void;
  onAwardXP?: (amount: number, reason: string) => void;
}

export const BlurtingDiffCanvasModal: React.FC<BlurtingDiffCanvasModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectName,
  initialTopicName,
  onAddMissedToFlashcards,
  onAdd137RevisionCycle,
  onAwardXP
}) => {
  const [subjectName, setSubjectName] = useState<string>(initialSubjectName || subjects[0]?.name || 'Physics');
  const [topicName, setTopicName] = useState<string>(initialTopicName || 'Newtonian Mechanics');
  
  // Timer state: 3 minutes = 180 seconds
  const [secondsLeft, setSecondsLeft] = useState<number>(180);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [blurtText, setBlurtText] = useState<string>('');
  
  // Diff & analysis state
  const [diffSlider, setDiffSlider] = useState<number>(50); // 0 to 100% split
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missedKeywords, setMissedKeywords] = useState<string[]>([]);
  const [recallScore, setRecallScore] = useState<number>(0);
  const [isSavedTo137, setIsSavedTo137] = useState<boolean>(false);

  // Active subject object & topics
  const currentSubjectObj = subjects.find(s => s.name === subjectName) || subjects[0];
  const allSubjectTopics = currentSubjectObj ? currentSubjectObj.chapters.flatMap(ch => ch.topics) : [];

  useEffect(() => {
    if (isOpen) {
      setSecondsLeft(180);
      setIsRunning(false);
      setIsFinished(false);
      setBlurtText('');
      setDiffSlider(50);
      setIsSavedTo137(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: any;
    if (isRunning && secondsLeft > 0) {
      timer = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFinishBlurt();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning, secondsLeft]);

  if (!isOpen) return null;

  // Format mm:ss
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Generate target keywords from subtopics or syllabus context
  const getExpectedKeywords = (): string[] => {
    const foundTopic = allSubjectTopics.find(t => t.name.toLowerCase() === topicName.toLowerCase());
    if (foundTopic && foundTopic.subtopics && foundTopic.subtopics.length > 0) {
      return foundTopic.subtopics.map(s => s.name);
    }
    // High-yield syllabus fallbacks
    return [
      'Fundamental Definition',
      'Governing Equation & SI Units',
      'Boundary Conditions',
      'Assumptions & Constraints',
      'Real-world Phenomenon / Example',
      'Common Board Exam Trap'
    ];
  };

  const handleFinishBlurt = () => {
    setIsRunning(false);
    setIsFinished(true);

    const expected = getExpectedKeywords();
    const typedLower = blurtText.toLowerCase();

    const matched: string[] = [];
    const missed: string[] = [];

    expected.forEach(kw => {
      const words = kw.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const isPresent = words.some(w => typedLower.includes(w)) || typedLower.includes(kw.toLowerCase());
      if (isPresent) {
        matched.push(kw);
      } else {
        missed.push(kw);
      }
    });

    setMatchedKeywords(matched);
    setMissedKeywords(missed);

    const score = Math.round((matched.length / Math.max(1, expected.length)) * 100);
    setRecallScore(score);

    if (score >= 60 && onAwardXP) {
      onAwardXP(40, `Active Blurt Mastered: ${topicName}`);
      triggerStudyGoalConfetti();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header with Countdown Clock */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Active Recall Blurting & Diff Canvas</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold">
                  Option 15
                </span>
              </div>
              <p className="text-xs text-muted">
                {isFinished 
                  ? 'Compare your retrieved memory against master syllabus expectations' 
                  : 'Feynman Blank Slate: Type everything from memory without looking at notes'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer Badge */}
            <div className={`px-3 py-1.5 rounded-xl border font-mono font-bold text-xs flex items-center gap-1.5 ${
              secondsLeft <= 30 && secondsLeft > 0
                ? 'bg-rose-500/10 text-rose-600 border-rose-500/30 animate-pulse'
                : 'bg-surface border-theme text-primary'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{formatTime(secondsLeft)}</span>
            </div>

            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Topic & Subject Control Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-surface/40 border border-theme text-xs">
            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Subject</span>
              <select
                value={subjectName}
                onChange={(e) => {
                  setSubjectName(e.target.value);
                  const sub = subjects.find(s => s.name === e.target.value);
                  setTopicName(sub?.chapters[0]?.topics[0]?.name || 'Core Topic');
                }}
                disabled={isRunning || isFinished}
                className="w-full px-3 py-1.5 rounded-xl bg-card border border-theme text-primary font-semibold"
              >
                {subjects.map(s => (
                  <option key={s.id} value={s.name}>{s.icon || '📚'} {s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1">Focus Concept</span>
              <input
                type="text"
                value={topicName}
                onChange={(e) => setTopicName(e.target.value)}
                disabled={isRunning || isFinished}
                placeholder="e.g. Carnot Cycle or Photoelectric Effect"
                className="w-full px-3 py-1.5 rounded-xl bg-card border border-theme text-primary font-semibold"
              />
            </div>
          </div>

          {/* ACTIVE BLURTING PHASE (When not finished) */}
          {!isFinished ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted font-medium">
                  {isRunning ? '🟢 Active retrieval in progress... write fast!' : 'Ready? Start the 3-minute timer and begin typing.'}
                </span>

                <div className="flex items-center gap-2">
                  {!isRunning ? (
                    <button
                      type="button"
                      onClick={() => setIsRunning(true)}
                      className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Start 3-Min Blurt</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsRunning(false)}
                      className="px-3 py-1.5 rounded-xl bg-surface border border-theme text-muted hover:text-primary text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      <span>Pause</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleFinishBlurt}
                    disabled={!blurtText.trim()}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Finish & Diff Compare</span>
                  </button>
                </div>
              </div>

              {/* Blank Slate Textarea */}
              <div className="relative">
                <textarea
                  value={blurtText}
                  onChange={(e) => {
                    setBlurtText(e.target.value);
                    if (!isRunning && secondsLeft > 0) setIsRunning(true);
                  }}
                  rows={12}
                  placeholder="Start typing from pure memory:&#10;1. State the fundamental law or rule in your own words&#10;2. Write the core equations, variables, and SI units&#10;3. Note what conditions must hold true&#10;4. What is the common trap examiners put on this topic?"
                  className="w-full p-4 rounded-2xl bg-surface border border-theme text-primary text-xs sm:text-sm font-mono leading-relaxed focus:outline-hidden focus:border-primary/50 shadow-inner"
                />
                <div className="absolute bottom-3 right-4 text-[10px] font-mono text-muted">
                  {blurtText.trim().split(/\s+/).filter(Boolean).length} words retrieved
                </div>
              </div>
            </div>
          ) : (
            /* DIFF & REVEAL PHASE */
            <div className="space-y-4 animate-fade-in">
              
              {/* Score & Verdict Banner */}
              <div className="p-4 rounded-2xl bg-surface border border-theme flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-mono font-bold text-lg border ${
                    recallScore >= 75
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                      : recallScore >= 45
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                  }`}>
                    {recallScore}%
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-primary">
                      {recallScore >= 75 ? '🔥 High Active Retrieval Strength!' : recallScore >= 45 ? '⚡ Moderate Synaptic Recall' : '⚠️ Memory Gaps Detected'}
                    </h4>
                    <p className="text-xs text-muted">
                      Retrieved {matchedKeywords.length} of {matchedKeywords.length + missedKeywords.length} essential syllabus objectives.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (onAdd137RevisionCycle) {
                        onAdd137RevisionCycle({
                          subjectName,
                          topicName,
                          notes: `Blurt score: ${recallScore}%. Missed: ${missedKeywords.join(', ')}`
                        });
                        setIsSavedTo137(true);
                      }
                    }}
                    disabled={isSavedTo137}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isSavedTo137 ? 'Enrolled in 1-3-7' : 'Enroll in 1-3-7 Cycle'}</span>
                  </button>
                </div>
              </div>

              {/* Interactive Diff Split View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Left: Your Retrieved Memory */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                    <span>What You Retrieved From Memory</span>
                    <span className="font-mono text-emerald-600">{matchedKeywords.length} Hit</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface/70 border border-theme text-xs font-mono text-primary whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                    {blurtText || '(No text entered)'}
                  </div>
                </div>

                {/* Right: Master Syllabus Checklist */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted">
                    <span>Master Syllabus Keywords & Concepts</span>
                    <span className="font-mono text-rose-600">{missedKeywords.length} Missed</span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-surface/70 border border-theme space-y-2 max-h-64 overflow-y-auto">
                    {matchedKeywords.map((kw, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                        <span className="font-medium">✓ {kw}</span>
                        <span className="text-[10px] font-mono font-bold">Retrieved</span>
                      </div>
                    ))}

                    {missedKeywords.map((kw, idx) => (
                      <div key={idx} className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300 flex items-center justify-between">
                        <span className="font-medium">✗ {kw}</span>
                        <span className="text-[10px] font-mono font-bold">Missed</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-muted">Feynman 3-Minute Blurting Protocol</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-theme text-xs font-semibold text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
