import React, { useState, useEffect } from 'react';
import {
  X,
  Sunrise,
  Brain,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles
} from 'lucide-react';
import { MistakeEntry } from '../types';
import { getStoredMistakes, recordPracticeAttempt } from '../lib/mistakeVaultStorage';

interface SpacedRepetitionMorningWarmupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAwardXP?: (xp: number, reason: string) => void;
}

export const SpacedRepetitionMorningWarmupModal: React.FC<SpacedRepetitionMorningWarmupModalProps> = ({
  isOpen,
  onClose,
  onAwardXP
}) => {
  const [candidates, setCandidates] = useState<MistakeEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userResponse, setUserResponse] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionResults, setSessionResults] = useState<Array<{
    mistakeId: string;
    wasCorrect: boolean;
  }>>([]);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const allMistakes = getStoredMistakes();
      // Filter candidates: uncured mistakes prioritized by status and date
      const uncured = allMistakes.filter(m => m.cureStatus !== 'cured');
      
      // Sort priority: 'active' first (0 streak), then 'curing' (1-2 streak), then oldest updatedAt
      uncured.sort((a, b) => {
        if (a.cureStatus === 'active' && b.cureStatus !== 'active') return -1;
        if (b.cureStatus === 'active' && a.cureStatus !== 'active') return 1;
        return new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime();
      });

      // If fewer than 3 uncured, supplement with oldest cured mistakes for retention maintenance
      let selected = uncured.slice(0, 3);
      if (selected.length < 3 && allMistakes.length > selected.length) {
        const remainingNeeded = 3 - selected.length;
        const cured = allMistakes
          .filter(m => m.cureStatus === 'cured' && !selected.some(s => s.id === m.id))
          .sort((a, b) => new Date(a.updatedAt || a.createdAt).getTime() - new Date(b.updatedAt || b.createdAt).getTime());
        selected = [...selected, ...cured.slice(0, remainingNeeded)];
      }

      setCandidates(selected);
      setCurrentIndex(0);
      setUserResponse('');
      setShowAnswer(false);
      setSessionResults([]);
      setIsFinished(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentMistake = candidates[currentIndex];

  const handleMarkResponse = (wasCorrect: boolean) => {
    if (!currentMistake) return;

    recordPracticeAttempt(currentMistake.id, wasCorrect, userResponse);
    const updatedResults = [...sessionResults, { mistakeId: currentMistake.id, wasCorrect }];
    setSessionResults(updatedResults);

    if (currentIndex + 1 < candidates.length) {
      setCurrentIndex(prev => prev + 1);
      setUserResponse('');
      setShowAnswer(false);
    } else {
      setIsFinished(true);
      // Award Morning Warm-up XP
      const correctCount = updatedResults.filter(r => r.wasCorrect).length;
      if (onAwardXP) {
        const xp = correctCount * 30 + 25;
        onAwardXP(xp, 'Completed Spaced Repetition Morning Warm-up');
      }
      try {
        localStorage.setItem('prepforge_last_morning_warmup', new Date().toISOString().split('T')[0]);
      } catch (e) {
        // ignore
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-theme rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-surface">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Sunrise className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Daily Spaced Repetition Warm-up</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[10px] font-mono font-bold uppercase">
                  3-Question Ebbinghaus Loop
                </span>
              </div>
              <p className="text-xs text-muted">
                Cementing memory traces from your recent mistakes before new study starts.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1">
          {candidates.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto" />
              <h4 className="text-sm font-bold text-primary">Your Mistake Vault is 100% Cured!</h4>
              <p className="text-xs text-muted max-w-md mx-auto">
                No active error traps or memory decay alerts are due for spaced review right now. Outstanding retention!
              </p>
              <button
                onClick={onClose}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-white font-bold text-xs cursor-pointer"
              >
                Close & Return to Study
              </button>
            </div>
          ) : !isFinished ? (
            <div className="space-y-4">
              {/* Progress Pill */}
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted uppercase tracking-wider text-[11px]">
                  Question {currentIndex + 1} of {candidates.length}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-surface-raised border border-theme text-primary font-mono text-[11px] font-bold">
                  {currentMistake.subjectName} &bull; {currentMistake.topicName || 'Core Concept'}
                </span>
              </div>

              {/* Question Card */}
              <div className="p-4 rounded-2xl bg-surface-raised border border-theme space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Original Exam Question</span>
                <p className="text-primary font-semibold text-xs leading-relaxed">
                  {currentMistake.question}
                </p>
              </div>

              {/* Response Field */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-primary">
                  Your Answer from Memory:
                </label>
                <textarea
                  rows={4}
                  value={userResponse}
                  onChange={(e) => setUserResponse(e.target.value)}
                  placeholder="Recall the exact formula, law statement, and proper terminology..."
                  className="w-full p-3 rounded-2xl bg-background border border-theme text-primary text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 leading-relaxed font-sans"
                />
              </div>

              {/* Reveal Solution */}
              {!showAnswer ? (
                <button
                  type="button"
                  onClick={() => setShowAnswer(true)}
                  className="w-full py-2.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4 text-amber-500" />
                  <span>Reveal Model Answer & Autopsy Notes</span>
                </button>
              ) : (
                <div className="space-y-3 pt-2 animate-in fade-in duration-150">
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-1">
                    <span className="font-bold text-[11px] text-emerald-800 dark:text-emerald-300 block">
                      Canonical Mark Scheme Solution:
                    </span>
                    <p className="text-xs leading-relaxed">{currentMistake.correctAnswer}</p>
                  </div>

                  {currentMistake.notes && (
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 text-xs">
                      <span className="font-bold text-[11px] text-amber-800 dark:text-amber-300 block mb-0.5">
                        Previous Trap Diagnosis:
                      </span>
                      <p className="text-[11px] leading-relaxed">{currentMistake.notes}</p>
                    </div>
                  )}

                  {/* Self Grade Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => handleMarkResponse(false)}
                      className="py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <AlertCircle className="w-4 h-4" />
                      <span>Still Unsure / Slipped</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMarkResponse(true)}
                      className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Got It Right! (+1 Cure)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Finished Summary Screen */
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-3xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-primary">Morning Warm-up Completed!</h3>
              <p className="text-xs text-muted max-w-sm mx-auto">
                You tested {sessionResults.length} high-decay concepts. Correct recall steps increase long-term memory stability and update your retention graph.
              </p>

              <div className="p-4 rounded-2xl bg-surface-raised border border-theme inline-block text-left text-xs space-y-1">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-muted">Mastered Today:</span>
                  <span className="font-mono font-bold text-emerald-600">
                    {sessionResults.filter(r => r.wasCorrect).length} / {sessionResults.length}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-muted">XP Gained:</span>
                  <span className="font-mono font-bold text-amber-600">
                    +{sessionResults.filter(r => r.wasCorrect).length * 30 + 25} XP
                  </span>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-2xl bg-primary text-white font-bold text-xs transition cursor-pointer"
                >
                  Continue to Daily Mission
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface flex items-center justify-between text-xs">
          <span className="text-[11px] text-muted flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Spaced retrieval reduces future exam blanks by up to 80%.</span>
          </span>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
