/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Brain, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  BookOpen, 
  RotateCcw,
  Check,
  Zap,
  Target
} from 'lucide-react';
import { RecurringWeaknessItem, TopicStatus } from '../types';
import { addMistake, recordMistakeAttempt } from '../lib/mistakeVaultStorage';

interface FixWeaknessModalProps {
  weakness: RecurringWeaknessItem | null;
  onClose: () => void;
  onCured?: (weaknessId: string) => void;
}

export const FixWeaknessModal: React.FC<FixWeaknessModalProps> = ({
  weakness,
  onClose,
  onCured
}) => {
  if (!weakness) return null;

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [studentRecallNotes, setStudentRecallNotes] = useState('');
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleResolveAndCure = () => {
    // If representative mistake exists, record successful attempt in Mistake Vault
    if (weakness.representativeMistakeId) {
      recordMistakeAttempt(weakness.representativeMistakeId, true, studentRecallNotes);
    } else {
      // Add a resolved mistake entry and record initial cure step
      const created = addMistake({
        subjectName: weakness.subjectName,
        topicName: weakness.conceptName,
        question: weakness.sampleQuestion || `Targeted verification drill: ${weakness.conceptName}`,
        userAttempt: studentRecallNotes || 'Successfully solved during targeted remediation drill',
        correctAnswer: 'Mastered under closed-book active recall conditions',
        errorCategory: weakness.cognitiveCategory || 'concept_gap',
        notes: `Remediation completed: ${weakness.recommendedIntervention}`,
        source: 'quiz'
      });
      if (created?.id) {
        recordMistakeAttempt(created.id, true, studentRecallNotes);
      }
    }

    setIsCompleted(true);
    if (onCured) onCured(weakness.id);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-2xl bg-surface border border-theme rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-theme flex items-center justify-between bg-header/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                  Targeted Remediation Sprint
                </span>
                <span className="text-xs text-muted font-medium">{weakness.subjectName}</span>
              </div>
              <h2 className="text-base sm:text-lg font-serif font-bold text-primary mt-0.5">
                Fix Weakness: {weakness.conceptName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Diagnostic Context Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-2xl bg-theme-accent/40 border border-theme text-center">
            <div>
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Mistakes Logged</span>
              <span className="text-sm font-bold text-rose-600 dark:text-rose-400">Wrong {weakness.mistakeCount} times</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">First Occurrence</span>
              <span className="text-sm font-bold text-primary">{weakness.firstOccurrenceDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Most Recent</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">{weakness.mostRecentDisplay}</span>
            </div>
            <div>
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider block">Last Recall</span>
              <span className="text-sm font-bold text-primary">{weakness.lastSuccessfulRecall || 'None yet'}</span>
            </div>
          </div>

          {/* Intervention Protocol Recommendation */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                Recommended Academic Intervention
              </h4>
              <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 mt-1 leading-relaxed">
                {weakness.recommendedIntervention}
              </p>
            </div>
          </div>

          {!isCompleted ? (
            <div className="space-y-4">
              {/* Step Navigation Pill */}
              <div className="flex items-center justify-between text-xs font-mono font-bold border-b border-theme/60 pb-2">
                <span className="text-primary flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px]">
                    {currentStep}
                  </span>
                  {currentStep === 1 ? 'Step 1: Autopsy & Root Cause' : currentStep === 2 ? 'Step 2: Active Recall Drill' : 'Step 3: Verification & Cure'}
                </span>
                <span className="text-muted">Step {currentStep} of 3</span>
              </div>

              {/* Step 1: Autopsy & Root Cause */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                    <h5 className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                      Examiner Trap & Diagnostic Insight
                    </h5>
                    <p className="text-xs sm:text-sm text-primary leading-relaxed">
                      {weakness.sampleTrapDetail || 
                        `This concept repeatedly produces errors because standard board exam papers intentionally introduce multi-step conversions or distractors. You must isolate the core rule before calculating or selecting answers.`}
                    </p>
                  </div>

                  {weakness.sampleQuestion && (
                    <div className="p-4 rounded-2xl bg-theme-accent/60 border border-theme space-y-2">
                      <h5 className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                        Representative Exam Question
                      </h5>
                      <p className="text-xs sm:text-sm font-medium text-primary">
                        {weakness.sampleQuestion}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center gap-2 hover:opacity-90 transition cursor-pointer shadow-xs"
                    >
                      <span>Proceed to Active Drill</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Active Recall Drill */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-primary block">
                      Write out the correct rule, derivation, or conversion formula from memory:
                    </label>
                    <textarea
                      value={studentRecallNotes}
                      onChange={(e) => setStudentRecallNotes(e.target.value)}
                      placeholder="e.g. Write out the exact Kelvin conversion formula, standard reaction conditions, or definition..."
                      rows={4}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-theme text-xs sm:text-sm text-primary focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-muted hover:text-primary transition cursor-pointer"
                    >
                      Back
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowModelAnswer(!showModelAnswer)}
                        className="px-3.5 py-2 rounded-xl bg-theme-accent text-primary text-xs font-semibold border border-theme transition cursor-pointer"
                      >
                        {showModelAnswer ? 'Hide Standard Solution' : 'Check Standard Solution'}
                      </button>
                      <button
                        onClick={() => setCurrentStep(3)}
                        disabled={studentRecallNotes.trim().length === 0}
                        className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5"
                      >
                        <span>Next Step</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {showModelAnswer && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Standard Academic Model Reference</span>
                      </div>
                      <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
                        {weakness.recommendedIntervention}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Verification & Cure */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-surface border border-theme space-y-2">
                    <h5 className="text-xs font-mono uppercase tracking-wider text-muted font-bold">
                      Verification Summary
                    </h5>
                    <p className="text-xs text-primary leading-relaxed">
                      You have articulated the foundational principles for <strong className="text-primary">{weakness.conceptName}</strong>. 
                      Clicking below will record this verified attempt in your Mistake Vault and adjust your topic retention status.
                    </p>
                    <div className="p-3 rounded-xl bg-theme-accent/50 text-xs text-muted italic">
                      "{studentRecallNotes}"
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="px-3 py-2 rounded-xl text-xs font-medium text-muted hover:text-primary transition cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleResolveAndCure}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition cursor-pointer flex items-center gap-2 shadow-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span>Log Successful Recall & Cure</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Completed Screen */
            <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-primary">
                  Weakness Remediated Successfully!
                </h3>
                <p className="text-xs sm:text-sm text-muted max-w-md mx-auto mt-1">
                  1 verification step added towards permanent cure in the Mistake Vault for <strong>{weakness.conceptName}</strong>.
                </p>
              </div>
              <div className="pt-2">
                <button
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
