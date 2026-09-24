import React, { useState, useEffect } from 'react';
import {
  X,
  Zap,
  Target,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { RemediationDrill, DrillQuestion } from '../types';

interface TargetedRemediationDrillModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  topicName: string;
  sourceContext: string;
  diagnosedRootCause?: string;
  missingConcepts?: string[];
  onAwardXP?: (amount: number, reason: string) => void;
}

export const TargetedRemediationDrillModal: React.FC<TargetedRemediationDrillModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  topicName,
  sourceContext,
  diagnosedRootCause = 'Missing essential equations and precision definitions',
  missingConcepts = [],
  onAwardXP
}) => {
  const [drill, setDrill] = useState<RemediationDrill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User responses keyed by question id
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<{
    evaluatedQuestions: Array<{
      id: string;
      scoreAwarded: number;
      isMastered: boolean;
      feedback: string;
    }>;
    totalScoreAchieved: number;
    drillVerdict: string;
    summaryTip: string;
  } | null>(null);

  // Timer countdown: 2 minutes (120s)
  const [secondsRemaining, setSecondsRemaining] = useState<number>(120);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Fetch or generate drill when modal opens
  useEffect(() => {
    if (isOpen) {
      handleGenerateDrill();
      setEvaluation(null);
      setUserAnswers({});
      setSecondsRemaining(120);
      setIsTimerRunning(false);
    }
  }, [isOpen, subjectName, topicName]);

  // Timer tick
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && secondsRemaining > 0 && !evaluation) {
      interval = setInterval(() => {
        setSecondsRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining, evaluation]);

  const handleGenerateDrill = async () => {
    setIsLoading(true);
    setError(null);
    setEvaluation(null);
    setUserAnswers({});
    try {
      const res = await fetch('/api/ai/generate-remediation-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          topicName,
          sourceContext,
          diagnosedRootCause,
          missingConcepts
        })
      });

      const data = await res.json();
      if (data.success && data.drill) {
        setDrill(data.drill);
        setSecondsRemaining(120);
        setIsTimerRunning(true);
      } else {
        throw new Error(data.error || 'Failed to generate targeted drill');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Could not initiate micro-drill');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (qId: string, val: string) => {
    setUserAnswers(prev => ({ ...prev, [qId]: val }));
  };

  const handleSubmitDrill = async () => {
    if (!drill) return;
    setIsSubmitting(true);
    setIsTimerRunning(false);

    try {
      const questionsWithResponses = drill.questions.map(q => ({
        id: q.id,
        targetedConcept: q.targetedConcept,
        questionText: q.questionText,
        expectedKeyTerms: q.expectedKeyTerms,
        idealAnswer: q.idealAnswer,
        marks: q.marks,
        userResponse: userAnswers[q.id] || ''
      }));

      const res = await fetch('/api/ai/evaluate-remediation-drill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectName,
          topicName,
          questionsWithResponses
        })
      });

      const data = await res.json();
      if (data.success) {
        setEvaluation({
          evaluatedQuestions: data.evaluatedQuestions || [],
          totalScoreAchieved: data.totalScoreAchieved || 0,
          drillVerdict: data.drillVerdict || 'Mastered',
          summaryTip: data.summaryTip || 'Great recovery!'
        });

        if (onAwardXP) {
          const xp = Math.round(((data.totalScoreAchieved || 4) / drill.totalMarks) * 60) + 20;
          onAwardXP(xp, `Completed 2-Minute Targeted Micro-Drill for ${topicName}`);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-surface border border-theme rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-theme flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-surface to-surface">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-primary">Targeted 2-Minute Micro-Drill</h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-200 text-[10px] font-mono font-bold uppercase">
                  Rapid Remediation
                </span>
              </div>
              <p className="text-xs text-muted">
                {subjectName} &bull; {topicName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Timer countdown pill */}
            <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 text-xs font-mono font-bold ${
              secondsRemaining < 30
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 animate-pulse'
                : 'bg-surface-raised border-theme text-primary'
            }`}>
              <Clock className="w-3.5 h-3.5 text-muted" />
              <span>{formatTime(secondsRemaining)}</span>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme flex items-center justify-center text-muted hover:text-primary transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Autopsy Context Box */}
          <div className="p-3.5 rounded-2xl bg-surface-raised border border-theme space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-muted">
              <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <Target className="w-3.5 h-3.5" />
                <span>Triggered by: {sourceContext}</span>
              </span>
              <span className="text-[10px] uppercase font-mono">Cognitive Patch</span>
            </div>
            <p className="text-primary font-medium leading-relaxed">
              <span className="font-bold text-muted mr-1">Diagnosed Gap:</span>
              {diagnosedRootCause}
            </p>

            {missingConcepts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted font-bold">Targeted Concepts:</span>
                {missingConcepts.map((c, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 font-semibold text-[10px]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              <div className="space-y-1">
                <p className="font-bold text-primary">Generating Focused 2-Minute Micro-Drill...</p>
                <p className="text-muted text-[11px]">Crafting laser-focused questions targeting your specific omissions.</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300 flex items-center justify-between gap-3">
              <span>{error}</span>
              <button
                onClick={handleGenerateDrill}
                className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Active Drill Questions */}
          {drill && !isLoading && (
            <div className="space-y-5">
              {drill.questions.map((q, idx) => {
                const evalItem = evaluation?.evaluatedQuestions.find(eq => eq.id === q.id);
                return (
                  <div
                    key={q.id}
                    className={`p-4 rounded-2xl border transition ${
                      evalItem
                        ? evalItem.isMastered
                          ? 'bg-emerald-500/5 border-emerald-500/30'
                          : 'bg-rose-500/5 border-rose-500/30'
                        : 'bg-surface-raised border-theme'
                    } space-y-3`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-primary text-xs">
                          {q.targetedConcept}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-muted">
                        [{q.marks} Marks]
                      </span>
                    </div>

                    <p className="text-primary font-semibold text-xs leading-relaxed">
                      {q.questionText}
                    </p>

                    {/* Hint / Reminder */}
                    {!evaluation && q.hint && (
                      <div className="text-[11px] text-muted italic flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Hint: {q.hint}</span>
                      </div>
                    )}

                    {/* Response Input */}
                    {!evaluation ? (
                      <textarea
                        rows={3}
                        value={userAnswers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="Write your crisp, precise answer using proper scientific/mathematical terminology..."
                        className="w-full p-2.5 rounded-xl bg-background border border-theme text-primary focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-sans leading-relaxed resize-none"
                      />
                    ) : (
                      /* Post Evaluation View */
                      <div className="space-y-2.5 pt-1 border-t border-theme/40">
                        <div className="p-2.5 rounded-xl bg-background border border-theme text-xs">
                          <span className="font-bold text-muted block mb-1">Your Answer:</span>
                          <p className="text-primary">{userAnswers[q.id] || '(No answer provided)'}</p>
                        </div>

                        {evalItem && (
                          <div className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-3 ${
                            evalItem.isMastered
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
                              : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
                          }`}>
                            <div className="space-y-1">
                              <div className="font-bold flex items-center gap-1.5">
                                {evalItem.isMastered ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                )}
                                <span>{evalItem.isMastered ? 'Concept Cemented!' : 'Needs Polish'}</span>
                              </div>
                              <p className="text-[11px] leading-relaxed">{evalItem.feedback}</p>
                            </div>
                            <div className="text-right shrink-0 font-bold font-mono">
                              +{evalItem.scoreAwarded} / {q.marks}
                            </div>
                          </div>
                        )}

                        {/* Ideal Expected Answer */}
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                          <span className="font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                            Standard Mark Scheme Reference:
                          </span>
                          <p className="text-primary text-[11px]">{q.idealAnswer}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Evaluation Summary Banner */}
              {evaluation && (
                <div className="p-4 rounded-2xl bg-surface-raised border border-emerald-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-sm text-primary">Drill Verdict: {evaluation.drillVerdict}</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      {evaluation.totalScoreAchieved} / {drill.totalMarks} Marks
                    </span>
                  </div>
                  <p className="text-xs text-muted leading-relaxed">
                    {evaluation.summaryTip}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-theme bg-surface flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-raised hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition cursor-pointer"
          >
            {evaluation ? 'Done' : 'Cancel'}
          </button>

          {!evaluation ? (
            <button
              onClick={handleSubmitDrill}
              disabled={isSubmitting || isLoading || !drill}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Evaluating Recall...</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5" />
                  <span>Submit 2-Minute Drill</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleGenerateDrill}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry with Fresh Drill</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
