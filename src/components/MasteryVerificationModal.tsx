/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  X, 
  ShieldCheck, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  BookOpen, 
  Target, 
  Clock, 
  HelpCircle, 
  RotateCcw, 
  Award,
  ChevronRight,
  FileText,
  Zap,
  Activity,
  Layers
} from 'lucide-react';
import { Subject, Topic, TopicProgressionState, TopicMasteryVerification } from '../types';

interface MasteryVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: Subject;
  chapterName: string;
  topic: Topic;
  onVerificationComplete: (
    subjectId: string, 
    topicId: string, 
    verification: TopicMasteryVerification,
    newStatus: 'Mastered' | 'Completed' | 'Needs Revision'
  ) => void;
  onAddToRevisionQueue?: (subjectName: string, chapterName: string, topicName: string, reason?: string) => void;
  onLaunchRemediation?: (subjectName: string, topicName: string, mistakeContext?: string) => void;
}

interface QuestionItem {
  id: string;
  section: 'recall' | 'conceptual' | 'application' | 'exam_style' | 'past_paper';
  sectionLabel: string;
  type: 'mcq' | 'equation' | 'short_answer' | 'numerical' | 'diagram_label';
  question: string;
  options?: string[];
  correctAnswer: string;
  acceptableKeywords?: string[];
  explanation: string;
  marks: number;
}

export const MasteryVerificationModal: React.FC<MasteryVerificationModalProps> = ({
  isOpen,
  onClose,
  subject,
  chapterName,
  topic,
  onVerificationComplete,
  onAddToRevisionQueue,
  onLaunchRemediation
}) => {
  if (!isOpen) return null;

  const subjectCategory = useMemo(() => {
    const sName = subject.name.toLowerCase();
    if (sName.includes('bio')) return 'biology';
    if (sName.includes('chem')) return 'chemistry';
    if (sName.includes('phys')) return 'physics';
    if (sName.includes('math') || sName.includes('stat') || sName.includes('calc')) return 'mathematics';
    if (sName.includes('comp') || sName.includes('cs') || sName.includes('program')) return 'computing';
    return 'general';
  }, [subject.name]);

  // Generate subject-adapted verification questions
  const questions: QuestionItem[] = useMemo(() => {
    const tName = topic.name;
    const sName = subject.name;

    if (subjectCategory === 'biology') {
      return [
        {
          id: 'q1',
          section: 'recall',
          sectionLabel: '1. Basic Recall (MCQ)',
          type: 'mcq',
          question: `Which fundamental biological principle or structure is primary to understanding "${tName}"?`,
          options: [
            `A) Direct transcriptional and cellular pathway control`,
            `B) Passive diffusion without catalytic protein involvement`,
            `C) Independent organellar isolation without ionic gradients`,
            `D) Exclusively abiotic geochemical equilibrium`
          ],
          correctAnswer: 'A',
          explanation: `In ${sName}, ${tName} fundamentally relies on regulated cellular mechanisms and pathway control.`,
          marks: 2
        },
        {
          id: 'q2',
          section: 'conceptual',
          sectionLabel: '2. Conceptual Understanding',
          type: 'short_answer',
          question: `Explain the physiological/biochemical significance of "${tName}" and how disruption affects homeostasis.`,
          correctAnswer: 'homeostasis regulation metabolic enzymes equilibrium feedback',
          acceptableKeywords: ['homeostasis', 'enzyme', 'metabolic', 'rate', 'feedback', 'pathway', 'cell', 'function', 'membrane'],
          explanation: `Full conceptual mastery requires linking mechanism to homeostatic regulation and feedback kinetics.`,
          marks: 3
        },
        {
          id: 'q3',
          section: 'application',
          sectionLabel: '3. Diagram / Structural Labeling Task',
          type: 'mcq',
          question: `In a standard histological or schematic representation of ${tName}, which label represents the rate-limiting site?`,
          options: [
            `A) The selective semi-permeable boundary / active catalytic site`,
            `B) The non-specific peripheral extracellular matrix`,
            `C) Static structural scaffolding without receptor activity`,
            `D) Aqueous solvent buffer with negligible turnover`
          ],
          correctAnswer: 'A',
          explanation: `Diagram analysis in biological systems always tests identifying functional catalytic boundaries.`,
          marks: 2
        },
        {
          id: 'q4',
          section: 'exam_style',
          sectionLabel: '4. Exam-Style Application Question',
          type: 'short_answer',
          question: `An experiment investigates how changing temperature or substrate concentration alters ${tName}. Predict and justify the outcome based on kinetic theory.`,
          correctAnswer: 'denaturation optimal temperature kinetic energy collisions rate',
          acceptableKeywords: ['kinetic', 'denature', 'temperature', 'optimum', 'collision', 'rate', 'active site', 'inhibition'],
          explanation: `Exam questions evaluate applying kinetic theory to environmental perturbations.`,
          marks: 3
        }
      ];
    }

    if (subjectCategory === 'chemistry') {
      return [
        {
          id: 'q1',
          section: 'recall',
          sectionLabel: '1. Conceptual Definition & Core Law',
          type: 'mcq',
          question: `Which fundamental thermodynamic or kinetic law governs "${tName}"?`,
          options: [
            `A) Conservation of energy & activation barrier equilibrium`,
            `B) Absolute zero spontaneity without entropy consideration`,
            `C) Indeterminate stoichiometric mass variance`,
            `D) Irreversible non-stoichiometric valence shifting`
          ],
          correctAnswer: 'A',
          explanation: `Chemical transformations in ${tName} are anchored on conservation principles and activation thermodynamics.`,
          marks: 2
        },
        {
          id: 'q2',
          section: 'conceptual',
          sectionLabel: '2. Equation / Reaction Conditions',
          type: 'short_answer',
          question: `Specify the essential reagents, catalysts, or stoichiometric condition required for transformations in ${tName}.`,
          correctAnswer: 'catalyst temperature pressure stoichiometry balanced yield equilibrium',
          acceptableKeywords: ['catalyst', 'temperature', 'pressure', 'reagent', 'molar', 'balanced', 'acid', 'base', 'oxidation', 'reduction'],
          explanation: `Precise identification of reaction conditions and molar relationships is required for chemical mastery.`,
          marks: 3
        },
        {
          id: 'q3',
          section: 'application',
          sectionLabel: '3. Numerical / Stoichiometric Calculation',
          type: 'mcq',
          question: `If the initial concentration/moles in a system undergoing ${tName} is halved, how is the instantaneous reaction rate or yield impacted (assuming standard 1st-order dependency)?`,
          options: [
            `A) The instantaneous rate is reduced by exactly half (proportional 1:1)`,
            `B) The rate quadruples exponentially`,
            `C) The rate remains completely unchanged regardless of concentration`,
            `D) The equilibrium constant changes directly`
          ],
          correctAnswer: 'A',
          explanation: `Rate laws and proportionality determine how quantitative shifts alter reaction dynamics.`,
          marks: 2
        },
        {
          id: 'q4',
          section: 'exam_style',
          sectionLabel: '4. Past-Paper Exam Application',
          type: 'short_answer',
          question: `Explain why industrial processes operating under ${tName} compromise between high equilibrium yield and rapid kinetic rate (Le Chatelier vs Rate tradeoff).`,
          correctAnswer: 'compromise temperature economic pressure rate equilibrium le chatelier cost catalyst',
          acceptableKeywords: ['compromise', 'temperature', 'rate', 'yield', 'equilibrium', 'le chatelier', 'cost', 'catalyst', 'safety'],
          explanation: `Classic examination questions evaluate the real-world tradeoff between kinetic speed and thermodynamic yield.`,
          marks: 3
        }
      ];
    }

    if (subjectCategory === 'physics') {
      return [
        {
          id: 'q1',
          section: 'recall',
          sectionLabel: '1. Conceptual MCQ & Physical Law',
          type: 'mcq',
          question: `Under standard inertial conditions, which statement accurately reflects the governing principle of "${tName}"?`,
          options: [
            `A) Conservation of energy/momentum holds across closed boundary transformations`,
            `B) Net force is always zero even during non-uniform acceleration`,
            `C) Entropy decreases spontaneously in isolated mechanical systems`,
            `D) Dimensional units need not balance across derived physical equations`
          ],
          correctAnswer: 'A',
          explanation: `Foundational physical mechanics in ${tName} depend on conservation laws and dimensional consistency.`,
          marks: 2
        },
        {
          id: 'q2',
          section: 'conceptual',
          sectionLabel: '2. Formula Selection & Variable Definition',
          type: 'short_answer',
          question: `State the primary governing formula for ${tName}, define each variable, and state their respective SI units.`,
          correctAnswer: 'formula variable units meters seconds kilograms joules newtons watts vector',
          acceptableKeywords: ['formula', 'variable', 'unit', 'meters', 'seconds', 'newton', 'joule', 'vector', 'constant', 'proportional'],
          explanation: `Physics mastery demands explicit formula knowledge and strict SI unit dimensional integrity.`,
          marks: 3
        },
        {
          id: 'q3',
          section: 'application',
          sectionLabel: '3. Numerical Problem Solving',
          type: 'mcq',
          question: `A system experiencing ${tName} doubles its primary input variable (e.g., velocity or radius) while other constraints remain constant. If the relationship is quadratic (y ∝ x²), what is the factor of increase?`,
          options: [
            `A) Factor of 4 (quadrupled)`,
            `B) Factor of 2 (doubled)`,
            `C) Factor of √2`,
            `D) Remains unchanged`
          ],
          correctAnswer: 'A',
          explanation: `Quadratic proportionality yields a 2² = 4-fold increase in physics relations (e.g. KE = ½mv², F = Gm₁m₂/r²).`,
          marks: 2
        },
        {
          id: 'q4',
          section: 'exam_style',
          sectionLabel: '4. Exam-Style Multi-Step Question',
          type: 'short_answer',
          question: `Describe how experimental uncertainties or resistance factors (e.g. air friction or internal resistance) create deviations from ideal theoretical values in ${tName}.`,
          correctAnswer: 'friction resistance uncertainty dissipation error deviation heat systematic',
          acceptableKeywords: ['friction', 'resistance', 'uncertainty', 'dissipation', 'loss', 'error', 'heat', 'systematic', 'random'],
          explanation: `Examiners test whether students understand boundary conditions and real-world dissipative losses.`,
          marks: 3
        }
      ];
    }

    // Default / Mathematics / Other
    return [
      {
        id: 'q1',
        section: 'recall',
        sectionLabel: '1. Core Definition & Theorem Recall',
        type: 'mcq',
        question: `What is the axiomatic definition or foundational premise of "${tName}"?`,
        options: [
          `A) Rigorous formal criteria governing valid states, transformations, and solutions`,
          `B) Arbitrary heuristic estimates without formal proof or algebraic balance`,
          `C) Unverified empirical guesses lacking structural validity`,
          `D) Inconsistent operations violating commutative/associative laws`
        ],
        correctAnswer: 'A',
        explanation: `Topic mastery begins with exact knowledge of formal conditions and definitions.`,
        marks: 2
      },
      {
        id: 'q2',
        section: 'conceptual',
        sectionLabel: '2. Conceptual Understanding & Derivation',
        type: 'short_answer',
        question: `Explain step-by-step how the core theorem or method in "${tName}" is derived or reasoned from first principles.`,
        correctAnswer: 'theorem proof principles derivation step logic algebraic equation',
        acceptableKeywords: ['proof', 'theorem', 'step', 'logic', 'algebraic', 'formula', 'rule', 'condition', 'solution'],
        explanation: `Being able to justify why a method works differentiates genuine mastery from rote memorization.`,
        marks: 3
      },
      {
        id: 'q3',
        section: 'application',
        sectionLabel: '3. Application & Problem Solving',
        type: 'mcq',
        question: `When applying ${tName} to a compound multi-step problem, what is the critical first constraint to check before calculating?`,
        options: [
          `A) Domain restrictions, boundary conditions, and sign conventions`,
          `B) Skipping verification of initial given parameters`,
          `C) Blindly substituting into an unrelated formula without checking applicability`,
          `D) Assuming all values are symmetric and linear`
        ],
        correctAnswer: 'A',
        explanation: `Checking domain restrictions and initial boundary conditions prevents catastrophic calculation errors.`,
        marks: 2
      },
      {
        id: 'q4',
        section: 'exam_style',
        sectionLabel: '4. Exam-Style Question',
        type: 'short_answer',
        question: `Construct the solution roadmap for a typical past-paper question on ${tName}, detailing common traps to avoid.`,
        correctAnswer: 'roadmap steps common trap pitfalls verify check units working',
        acceptableKeywords: ['step', 'trap', 'pitfall', 'check', 'working', 'method', 'formula', 'substitute', 'verify'],
        explanation: `Demonstrating clear problem-solving discipline and avoiding examiner traps is the hallmark of mastery.`,
        marks: 3
      }
    ];
  }, [topic.name, subject.name, subjectCategory]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState<'assessment' | 'result'>('assessment');
  const [evaluationResult, setEvaluationResult] = useState<{
    scorePercentage: number;
    passed: boolean;
    totalMarks: number;
    obtainedMarks: number;
    breakdown: Record<string, { marksObtained: number; maxMarks: number; feedback: string }>;
    preventedReasons: string[];
    recommendedAction: string;
  } | null>(null);

  const totalMaxMarks = useMemo(() => questions.reduce((sum, q) => sum + q.marks, 0), [questions]);

  const handleSelectMCQ = (qId: string, optionLetter: string) => {
    setAnswers(prev => ({ ...prev, [qId]: optionLetter }));
  };

  const handleTextChange = (qId: string, text: string) => {
    setAnswers(prev => ({ ...prev, [qId]: text }));
  };

  const handleEvaluate = () => {
    let obtained = 0;
    const breakdown: Record<string, { marksObtained: number; maxMarks: number; feedback: string }> = {};
    const preventedReasons: string[] = [];

    questions.forEach(q => {
      const userAns = (answers[q.id] || '').trim();

      if (q.type === 'mcq') {
        const isCorrect = userAns.toUpperCase().startsWith(q.correctAnswer);
        const marks = isCorrect ? q.marks : 0;
        obtained += marks;
        breakdown[q.id] = {
          marksObtained: marks,
          maxMarks: q.marks,
          feedback: isCorrect ? 'Correct selection.' : `Incorrect. Expected (${q.correctAnswer}): ${q.explanation}`
        };
        if (!isCorrect) {
          preventedReasons.push(`${q.sectionLabel}: Incorrect selection under pressure.`);
        }
      } else {
        // Short answer keyword density check
        const lowerAns = userAns.toLowerCase();
        const matchedKeywords = (q.acceptableKeywords || []).filter(kw => lowerAns.includes(kw.toLowerCase()));
        
        let marks = 0;
        let feedback = '';
        if (userAns.length < 15) {
          marks = 0;
          feedback = 'Answer too brief or omitted. Full working and reasoning required.';
          preventedReasons.push(`${q.sectionLabel}: Incomplete explanation and conceptual depth.`);
        } else if (matchedKeywords.length >= 3) {
          marks = q.marks;
          feedback = `Excellent. Verified core terms: ${matchedKeywords.slice(0, 3).join(', ')}.`;
        } else if (matchedKeywords.length >= 1) {
          marks = Math.max(1, q.marks - 1);
          feedback = `Partial credit. Mentioned ${matchedKeywords.join(', ')}, but lacked full rigor.`;
          preventedReasons.push(`${q.sectionLabel}: Partial formulation; lacking key examiner keywords.`);
        } else {
          marks = 1;
          feedback = 'Concept attempted but missing core academic terminology and mechanism.';
          preventedReasons.push(`${q.sectionLabel}: Weak application of subject-specific mechanism.`);
        }
        obtained += marks;
        breakdown[q.id] = {
          marksObtained: marks,
          maxMarks: q.marks,
          feedback
        };
      }
    });

    const scorePercentage = Math.round((obtained / totalMaxMarks) * 100);
    // Mastery threshold: 80% or higher
    const passed = scorePercentage >= 80;

    let recommendedAction = '';
    if (passed) {
      recommendedAction = 'Topic verified with distinction. Promoted to Mastered status and scheduled for maintenance spaced retention.';
    } else if (scorePercentage >= 65) {
      recommendedAction = 'High potential: Review formula selection and complete 3 past-paper questions before re-verifying in 48 hours.';
    } else {
      recommendedAction = 'Concept gap detected: Add to 1-3-7 Revision cadence and perform a targeted remediation drill immediately.';
    }

    const result = {
      scorePercentage,
      passed,
      totalMarks: totalMaxMarks,
      obtainedMarks: obtained,
      breakdown,
      preventedReasons,
      recommendedAction
    };

    setEvaluationResult(result);
    setCurrentStep('result');

    // Notify parent
    const verificationData: TopicMasteryVerification = {
      verifiedAt: new Date().toISOString(),
      scorePercentage,
      passed,
      totalQuestions: questions.length,
      correctQuestions: Object.values(breakdown).filter(b => b.marksObtained === b.maxMarks).length,
      preventedMasteryReasons: preventedReasons,
      recommendedAction,
      assessedSections: {
        recallPassed: (breakdown['q1']?.marksObtained || 0) >= 2,
        conceptualPassed: (breakdown['q2']?.marksObtained || 0) >= 2,
        applicationPassed: (breakdown['q3']?.marksObtained || 0) >= 2,
        examStylePassed: (breakdown['q4']?.marksObtained || 0) >= 2
      }
    };

    onVerificationComplete(
      subject.id,
      topic.id,
      verificationData,
      passed ? 'Mastered' : 'Completed'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="bg-card border border-theme rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="p-6 border-b border-theme bg-theme-accent/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-600/15 border border-teal-500/30 flex items-center justify-center text-teal-700 dark:text-teal-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-800 dark:text-teal-300">
                  Prove Mastery Workflow
                </span>
                <span className="text-xs text-muted">{subject.name}</span>
              </div>
              <h3 className="text-lg font-bold text-primary">
                Verify Mastery: {topic.name}
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-primary hover:bg-theme-accent transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Progression pipeline visualization */}
        <div className="px-6 py-3 bg-card border-b border-theme/60">
          <div className="flex items-center justify-between text-[11px] font-semibold text-muted">
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Studied
            </span>
            <ChevronRight className="w-3 h-3 text-muted/60" />
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Practiced
            </span>
            <ChevronRight className="w-3 h-3 text-muted/60" />
            <span className="flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tested
            </span>
            <ChevronRight className="w-3 h-3 text-muted/60" />
            <span className={`flex items-center gap-1 ${currentStep === 'result' ? 'text-teal-600 font-bold' : 'text-primary font-bold'}`}>
              <ShieldCheck className="w-3.5 h-3.5" /> Verified
            </span>
            <ChevronRight className="w-3 h-3 text-muted/60" />
            <span className={`flex items-center gap-1 ${evaluationResult?.passed ? 'text-amber-500 font-bold' : 'text-muted'}`}>
              <Award className="w-3.5 h-3.5" /> Mastered ⭐
            </span>
          </div>
        </div>

        {/* Content */}
        {currentStep === 'assessment' ? (
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <strong className="font-bold">Strict Academic Standard:</strong> Topics cannot be manually tagged as "Mastered". Complete this subject-adapted 4-question assessment (80% threshold required) to earn verified mastery.
              </div>
            </div>

            <div className="space-y-6">
              {questions.map((q, idx) => (
                <div key={q.id} className="p-4.5 rounded-2xl border border-theme bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider">
                      {q.sectionLabel}
                    </span>
                    <span className="text-[11px] font-semibold text-muted bg-theme-accent px-2 py-0.5 rounded-md">
                      {q.marks} Marks
                    </span>
                  </div>

                  <p className="text-sm font-medium text-primary leading-snug">
                    {q.question}
                  </p>

                  {q.type === 'mcq' && q.options && (
                    <div className="space-y-2 pt-1">
                      {q.options.map((opt, oIdx) => {
                        const optLetter = opt.charAt(0);
                        const isSelected = answers[q.id] === optLetter;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => handleSelectMCQ(q.id, optLetter)}
                            className={`w-full text-left p-3 rounded-xl border text-xs transition cursor-pointer flex items-start gap-2.5 ${
                              isSelected 
                                ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-500 text-teal-950 dark:text-teal-100 font-semibold shadow-xs' 
                                : 'bg-card border-theme/80 hover:bg-theme-accent text-primary'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
                              isSelected ? 'bg-teal-600 text-white' : 'bg-theme-accent text-muted'
                            }`}>
                              {optLetter}
                            </span>
                            <span className="flex-1 mt-0.5">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.type !== 'mcq' && (
                    <div className="pt-1 space-y-1.5">
                      <textarea
                        rows={3}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleTextChange(q.id, e.target.value)}
                        placeholder={`Write your answer, key terms, equations, or reasoning here...`}
                        className="w-full p-3 rounded-xl border border-theme bg-card text-xs text-primary placeholder-muted focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                      />
                      <span className="text-[10px] text-muted block text-right">
                        Use accurate subject terminology to secure full criteria marks.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-theme flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted hover:text-primary transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEvaluate}
                className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <span>Submit & Compute Verified Mastery</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          /* Step 2: Evaluation Verdict */
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {evaluationResult?.passed ? (
              <div className="p-5 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/40 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-500/20 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                    <Award className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                      Mastery Proved
                    </span>
                    <h4 className="text-xl font-bold text-teal-950 dark:text-teal-100">
                      Verified Mastery Awarded! (Score: {evaluationResult.scorePercentage}%)
                    </h4>
                    <p className="text-xs text-teal-800 dark:text-teal-300">
                      {topic.name} has satisfied all basic recall, conceptual, and application standards.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/40 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                      Standard Not Met
                    </span>
                    <h4 className="text-xl font-bold text-rose-950 dark:text-rose-100">
                      «Mastery not yet verified.» (Score: {evaluationResult?.scorePercentage}%)
                    </h4>
                    <p className="text-xs text-rose-800 dark:text-rose-300">
                      Minimum threshold for Mastered status is 80%. Identified gaps below must be addressed first.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* What prevented mastery (if failed) or mastery summary */}
            {evaluationResult && evaluationResult.preventedReasons.length > 0 && (
              <div className="p-4.5 rounded-2xl border border-theme bg-card space-y-3">
                <h5 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
                  <Target className="w-4 h-4 text-rose-500" />
                  What Prevented Mastery
                </h5>
                <ul className="space-y-2">
                  {evaluationResult.preventedReasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-muted">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0 mt-1.5" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Next Action */}
            <div className="p-4.5 rounded-2xl border border-teal-500/30 bg-teal-500/5 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Recommended Next Action
              </span>
              <p className="text-xs font-semibold text-primary">
                {evaluationResult?.recommendedAction}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-theme flex flex-wrap items-center justify-end gap-3">
              {onAddToRevisionQueue && (
                <button
                  type="button"
                  onClick={() => {
                    onAddToRevisionQueue(subject.name, chapterName, topic.name, evaluationResult?.preventedReasons[0]);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl border border-theme bg-card hover:bg-theme-accent text-xs font-semibold text-primary transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-600" />
                  <span>Queue in 1-3-7 Revision</span>
                </button>
              )}

              {onLaunchRemediation && (
                <button
                  type="button"
                  onClick={() => {
                    onLaunchRemediation(subject.name, topic.name, evaluationResult?.preventedReasons.join('; '));
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch Remediation Drill</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
