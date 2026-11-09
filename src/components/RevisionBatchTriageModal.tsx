import React, { useState, useEffect } from 'react';
import { 
  X, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  ArrowRight, 
  ArrowLeft, 
  ArrowUp, 
  Award, 
  Flame, 
  BookOpen, 
  Check, 
  ShieldCheck,
  Zap,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Spaced137TopicCard, toLocalDateString } from '../lib/spacedRevisionEngine';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface RevisionBatchTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueCards: Spaced137TopicCard[];
  onMarkCardDone: (card: Spaced137TopicCard) => void;
  onRescheduleQuickCheck: (card: Spaced137TopicCard) => void;
  onResetDeepFocus: (card: Spaced137TopicCard) => void;
  onAwardXP?: (amount: number, reason: string) => void;
}

export const RevisionBatchTriageModal: React.FC<RevisionBatchTriageModalProps> = ({
  isOpen,
  onClose,
  dueCards,
  onMarkCardDone,
  onRescheduleQuickCheck,
  onResetDeepFocus,
  onAwardXP
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [triageHistory, setTriageHistory] = useState<Array<{
    card: Spaced137TopicCard;
    decision: 'rock_solid' | 'hesitation' | 'forgot';
  }>>([]);
  const [animDirection, setAnimDirection] = useState<'right' | 'left' | 'up' | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setTriageHistory([]);
      setAnimDirection(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCard = dueCards[currentIndex];
  const isFinished = currentIndex >= dueCards.length || !currentCard;

  const handleDecision = (decision: 'rock_solid' | 'hesitation' | 'forgot') => {
    if (!currentCard) return;

    if (decision === 'rock_solid') {
      setAnimDirection('right');
      onMarkCardDone(currentCard);
      if (onAwardXP) onAwardXP(30, `1-3-7 Triage: ${currentCard.topicName}`);
    } else if (decision === 'hesitation') {
      setAnimDirection('up');
      onRescheduleQuickCheck(currentCard);
      if (onAwardXP) onAwardXP(15, `1-3-7 Review Flagged: ${currentCard.topicName}`);
    } else {
      setAnimDirection('left');
      onResetDeepFocus(currentCard);
      if (onAwardXP) onAwardXP(10, `1-3-7 Reset to Focus: ${currentCard.topicName}`);
    }

    setTriageHistory(prev => [...prev, { card: currentCard, decision }]);

    setTimeout(() => {
      setAnimDirection(null);
      setCurrentIndex(prev => prev + 1);
      if (currentIndex + 1 >= dueCards.length) {
        triggerStudyGoalConfetti();
      }
    }, 250);
  };

  // Keyboard shortcut listener (ArrowRight/1 for Rock Solid, ArrowUp/2 for Hesitation, ArrowLeft/3 for Forgot)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isFinished) return;
      if (e.key === 'ArrowRight' || e.key === '1') {
        handleDecision('rock_solid');
      } else if (e.key === 'ArrowUp' || e.key === '2') {
        handleDecision('hesitation');
      } else if (e.key === 'ArrowLeft' || e.key === '3') {
        handleDecision('forgot');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFinished, currentCard]);

  const rockSolidCount = triageHistory.filter(h => h.decision === 'rock_solid').length;
  const hesitationCount = triageHistory.filter(h => h.decision === 'hesitation').length;
  const forgotCount = triageHistory.filter(h => h.decision === 'forgot').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header with Progress Bar */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <RotateCcw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">1-3-7 Revision Batch Triage</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 font-bold">
                  Option 5 Sort
                </span>
              </div>
              <p className="text-xs text-muted">
                {isFinished 
                  ? 'Batch triage complete! Daily queue updated.' 
                  : `Triage item ${currentIndex + 1} of ${dueCards.length} in seconds`}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Strip */}
        <div className="w-full bg-surface border-b border-theme h-1.5 overflow-hidden">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${dueCards.length > 0 ? (currentIndex / dueCards.length) * 100 : 100}%` }}
          />
        </div>

        {/* Card Arena */}
        <div className="p-6 flex-1 flex flex-col items-center justify-center overflow-y-auto">
          {dueCards.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h4 className="text-base font-bold text-primary">All Revisions Cleared!</h4>
              <p className="text-xs text-muted max-w-sm mx-auto">
                You have zero pending 1-3-7 revisions due today. Your synapses are locked in for long-term retention.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold transition shadow-xs"
              >
                Return to Revision Center
              </button>
            </div>
          ) : isFinished ? (
            /* Finished Summary Card */
            <div className="w-full space-y-5 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-serif italic font-bold text-primary">Morning Triage Complete!</h4>
                <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                  Processed {dueCards.length} revision topics. Your day's schedule has been recalibrated with zero decision fatigue.
                </p>
              </div>

              {/* Stats Breakdown */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">{rockSolidCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">Rock Solid</div>
                  <div className="text-[9px] text-muted mt-0.5">Advanced Cadence</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">{hesitationCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">Hesitation</div>
                  <div className="text-[9px] text-muted mt-0.5">5m Formula Drill</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400">{forgotCount}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">Forgot</div>
                  <div className="text-[9px] text-muted mt-0.5">25m Deep Focus</div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-2xl bg-primary text-primary-foreground text-xs font-bold transition shadow-sm hover:opacity-90 active:scale-95 cursor-pointer"
              >
                Apply & View Today's Schedule
              </button>
            </div>
          ) : (
            /* Active Triage Card with Swipe Animation */
            <div className={`w-full max-w-md bg-surface border border-theme rounded-3xl p-6 shadow-xl transition-all duration-200 relative ${
              animDirection === 'right' ? 'translate-x-16 opacity-0 rotate-6 bg-emerald-500/10' :
              animDirection === 'left' ? '-translate-x-16 opacity-0 -rotate-6 bg-rose-500/10' :
              animDirection === 'up' ? '-translate-y-16 opacity-0 scale-95 bg-amber-500/10' :
              'translate-x-0 opacity-100 scale-100'
            }`}>
              {/* Badge Strip */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {currentCard.subjectName}
                </span>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                    Day {currentCard.stageDay} Check
                  </span>
                  <span className="text-[10px] text-muted font-mono">
                    [{currentIndex + 1}/{dueCards.length}]
                  </span>
                </div>
              </div>

              {/* Topic Name */}
              <div className="space-y-1.5 mb-5">
                <h4 className="text-base sm:text-lg font-bold text-primary leading-snug">
                  {currentCard.topicName}
                </h4>
                <p className="text-xs text-muted flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{currentCard.chapterName || 'Core Unit'}</span>
                </p>
              </div>

              {/* Retention & Memory Context Box */}
              <div className="p-3.5 rounded-2xl bg-card border border-theme space-y-2 text-xs mb-6">
                <div className="flex items-center justify-between text-muted">
                  <span>First Studied:</span>
                  <span className="font-mono font-medium text-primary">{currentCard.initialStudyDate}</span>
                </div>
                <div className="flex items-center justify-between text-muted">
                  <span>Due Date:</span>
                  <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{currentCard.dueDate}</span>
                </div>
                {currentCard.notes && (
                  <div className="pt-2 border-t border-theme/50 text-muted italic">
                    "{currentCard.notes}"
                  </div>
                )}
              </div>

              {/* Triage Decision Buttons */}
              <div className="grid grid-cols-3 gap-2.5 pt-2">
                {/* 1. Forgot (Swipe Left) */}
                <button
                  type="button"
                  onClick={() => handleDecision('forgot')}
                  className="p-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-800 dark:text-rose-200 transition text-center flex flex-col items-center justify-between cursor-pointer active:scale-95 group"
                >
                  <ArrowLeft className="w-4 h-4 mb-1 group-hover:-translate-x-1 transition text-rose-600" />
                  <div className="text-xs font-bold">Forgot</div>
                  <div className="text-[9px] opacity-80 mt-0.5">25m Block [← / 3]</div>
                </button>

                {/* 2. Hesitation (Swipe Up) */}
                <button
                  type="button"
                  onClick={() => handleDecision('hesitation')}
                  className="p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-200 transition text-center flex flex-col items-center justify-between cursor-pointer active:scale-95 group"
                >
                  <ArrowUp className="w-4 h-4 mb-1 group-hover:-translate-y-1 transition text-amber-600" />
                  <div className="text-xs font-bold">Hesitation</div>
                  <div className="text-[9px] opacity-80 mt-0.5">5m Recap [↑ / 2]</div>
                </button>

                {/* 3. Rock Solid (Swipe Right) */}
                <button
                  type="button"
                  onClick={() => handleDecision('rock_solid')}
                  className="p-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 transition text-center flex flex-col items-center justify-between cursor-pointer active:scale-95 group"
                >
                  <ArrowRight className="w-4 h-4 mb-1 group-hover:translate-x-1 transition text-emerald-600" />
                  <div className="text-xs font-bold">Rock Solid</div>
                  <div className="text-[9px] opacity-80 mt-0.5">Advance [→ / 1]</div>
                </button>
              </div>

            </div>
          )}
        </div>

        {/* Footer with keyboard guidance */}
        {!isFinished && dueCards.length > 0 && (
          <div className="p-3.5 border-t border-theme bg-surface/80 text-center text-[11px] text-muted flex items-center justify-center gap-4 shrink-0">
            <span>Keyboard shortcuts: <kbd className="px-1.5 py-0.5 bg-card border border-theme rounded text-[10px]">1 / →</kbd> Rock Solid</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-card border border-theme rounded text-[10px]">2 / ↑</kbd> Hesitation</span>
            <span>•</span>
            <span><kbd className="px-1.5 py-0.5 bg-card border border-theme rounded text-[10px]">3 / ←</kbd> Forgot</span>
          </div>
        )}

      </div>
    </div>
  );
};
