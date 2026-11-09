import React, { useState, useMemo } from 'react';
import { 
  X, 
  GitMerge, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Brain, 
  Layers, 
  BookOpen, 
  Check, 
  Share2, 
  RotateCcw,
  Zap,
  ShieldCheck,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { MistakeEntry, Subject } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface CrossTopicMistakeSynthesizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mistakes: MistakeEntry[];
  subjects: Subject[];
  initialTopicA?: string;
  initialTopicB?: string;
  onAddTo137Cycle?: (params: { subjectName: string; chapterName?: string; topicName: string; notes?: string }) => void;
  onOpenExternalAIBridge?: (subjectId?: string, topicName?: string, mistake?: any) => void;
  onAwardXP?: (amount: number, reason: string) => void;
  onCureMistakesForTopics?: (topicNames: string[]) => void;
}

interface SynthesizedBridge {
  conceptualBridge: string;
  commonFailureVector: string;
  examSynthesisTrap: string;
  synthesisChallenge: {
    question: string;
    options: string[];
    correctIndex: number;
    stepByStepResolution: string;
  };
}

export const CrossTopicMistakeSynthesizerModal: React.FC<CrossTopicMistakeSynthesizerModalProps> = ({
  isOpen,
  onClose,
  mistakes,
  subjects,
  initialTopicA,
  initialTopicB,
  onAddTo137Cycle,
  onOpenExternalAIBridge,
  onAwardXP,
  onCureMistakesForTopics
}) => {
  // Extract distinct topics present in vault
  const topicCounts = useMemo(() => {
    const map: Record<string, { count: number; subject: string; sampleMistakes: MistakeEntry[] }> = {};
    mistakes.forEach(m => {
      const top = (m.topicName || 'General Core Trap').trim();
      if (!map[top]) {
        map[top] = { count: 0, subject: m.subjectName, sampleMistakes: [] };
      }
      map[top].count++;
      map[top].sampleMistakes.push(m);
    });
    return map;
  }, [mistakes]);

  const topTopicsList = useMemo(() => {
    return (Object.entries(topicCounts) as [string, { count: number; subject: string; sampleMistakes: MistakeEntry[] }][])
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({ name, ...data }));
  }, [topicCounts]);

  const [topicA, setTopicA] = useState<string>(
    initialTopicA || topTopicsList[0]?.name || 'Kinematics & Vectors'
  );
  const [topicB, setTopicB] = useState<string>(
    initialTopicB || topTopicsList[1]?.name || topTopicsList[0]?.name || 'Work & Energy'
  );

  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [activeTab, setActiveTab] = useState<'mesh' | 'challenge' | 'mistakes'>('mesh');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [isEnrolledIn137, setIsEnrolledIn137] = useState(false);

  // Mistakes for each selected topic
  const mistakesTopicA = useMemo(() => {
    return mistakes.filter(m => (m.topicName || '').trim().toLowerCase() === topicA.trim().toLowerCase());
  }, [mistakes, topicA]);

  const mistakesTopicB = useMemo(() => {
    return mistakes.filter(m => (m.topicName || '').trim().toLowerCase() === topicB.trim().toLowerCase());
  }, [mistakes, topicB]);

  // Dynamic Synthesis Engine
  const bridgeData: SynthesizedBridge = useMemo(() => {
    const combined = `${topicA} ${topicB}`.toLowerCase();

    if (combined.includes('rotat') || combined.includes('torque') || combined.includes('moment')) {
      return {
        conceptualBridge: 'Linear-to-Angular Variable Isomorphism & Conservation of Angular Momentum',
        commonFailureVector: 'Translating linear formulas into rotational dynamics without accounting for Moment of Inertia $I = \\int r^2 dm$ and axis of rotation constraints.',
        examSynthesisTrap: 'Examiners combine linear momentum conservation with rotational impulse. Students calculate velocity correctly but miss rotational kinetic energy $\\frac{1}{2}I\\omega^2$.',
        synthesisChallenge: {
          question: `[Multi-Topic Synthesis: ${topicA} ⨁ ${topicB}] A uniform rod of mass $M$ and length $L$ pivoted at one end is struck horizontally by a particle of mass $m$ with velocity $v$ at distance $d$ from pivot. Which principle MUST be conserved about the pivot axis, and why does mechanical energy fail?`,
          options: [
            'A. Angular momentum about the pivot is conserved because pivot reaction force has zero torque ($r=0$). Energy is lost in collision deformation.',
            'B. Linear momentum is conserved because net external horizontal force is zero.',
            'C. Total mechanical energy is conserved because no external work is performed on the pivot.',
            'D. Neither momentum nor energy is conserved because the pivot breaks all symmetries.'
          ],
          correctIndex: 0,
          stepByStepResolution: 'About the pivot point, the unknown impulsive reaction force produces zero torque (lever arm = 0). Therefore, $\\Sigma \\tau_{pivot} = 0 \\implies L_{initial} = L_{final}$. Linear momentum is NOT conserved because the pivot exerts an external impulse on the rod.'
        }
      };
    }

    if (combined.includes('work') || combined.includes('energy') || combined.includes('kinemat') || combined.includes('force')) {
      return {
        conceptualBridge: 'Work-Kinetic Energy Theorem & Line Integral of Non-Constant Forces',
        commonFailureVector: 'Applying constant acceleration kinematics ($v^2 = u^2 + 2as$) when force varies with position $x$ or time $t$.',
        examSynthesisTrap: 'Confusing average force with instantaneous force during variable displacement paths.',
        synthesisChallenge: {
          question: `[Multi-Topic Synthesis: ${topicA} ⨁ ${topicB}] A particle travels along the x-axis under a conservative force $F(x) = -kx + \\alpha x^3$. If released from rest at $x = x_0$, what is the speed $v(x)$ at the origin ($x=0$)?`,
          options: [
            'A. $v = \\sqrt{\\frac{k x_0^2}{m} - \\frac{\\alpha x_0^4}{2m}}$ using $W_{net} = \\Delta K$',
            'B. $v = \\frac{F(x_0) t}{m}$ using standard kinematic rate',
            'C. $v = \\sqrt{2 g x_0}$ using uniform gravitational field model',
            'D. $v = 0$ because potential energy remains invariant'
          ],
          correctIndex: 0,
          stepByStepResolution: 'Work done by conservative force is $W = -\\Delta U = \\int_{x_0}^0 (-kx + \\alpha x^3) dx = \\frac{1}{2}k x_0^2 - \\frac{1}{4}\\alpha x_0^4$. By Work-Energy Theorem: $\\frac{1}{2}m v^2 = W \\implies v = \\sqrt{\\frac{k x_0^2}{m} - \\frac{\\alpha x_0^4}{2m}}$.'
        }
      };
    }

    if (combined.includes('electr') || combined.includes('magnet') || combined.includes('field') || combined.includes('charg')) {
      return {
        conceptualBridge: 'Lorentz Force Superposition & Electromagnetic Energy Density',
        commonFailureVector: 'Overlooking the velocity cross-product $\\vec{v} \\times \\vec{B}$ direction (right-hand rule sign error) when electric and magnetic forces counteract.',
        examSynthesisTrap: 'Assuming magnetic force does work on a charged particle, whereas $\\vec{F}_B \\perp \\vec{v} \\implies W_B = 0$ at all times.',
        synthesisChallenge: {
          question: `[Multi-Topic Synthesis: ${topicA} ⨁ ${topicB}] A beam of charged particles with speed $v$ enters perpendicular crossed fields with uniform electric field $E$ and magnetic field $B$. If the beam passes undeflected, and then electric field is switched off, what is the radius of the resulting circular trajectory?`,
          options: [
            'A. $R = \\frac{m E}{q B^2}$ because velocity selector requires $v = \\frac{E}{B}$ and cyclotron radius is $R = \\frac{mv}{qB}$',
            'B. $R = \\frac{m B}{q E}$ due to reciprocal field coupling',
            'C. $R = \\frac{q E}{m B^2}$ due to charge acceleration in magnetic gradient',
            'D. Undefined because particles immediately accelerate to infinity'
          ],
          correctIndex: 0,
          stepByStepResolution: '1. Undeflected balance: $qE = qvB \\implies v = E/B$.\n2. Magnetic cyclotron motion: $\\frac{m v^2}{R} = qvB \\implies R = \\frac{mv}{qB}$.\n3. Substituting $v$: $R = \\frac{m (E/B)}{q B} = \\frac{m E}{q B^2}$.'
        }
      };
    }

    // Default High-Yield Cross-Topic Synthesis
    return {
      conceptualBridge: `Fundamental Conservation Laws & State Variable Transfer between ${topicA} and ${topicB}`,
      commonFailureVector: `Isolating ${topicA} formulas from ${topicB} boundary conditions, leading to missing constraint equations during multi-step exam questions.`,
      examSynthesisTrap: `Examiners intentionally design questions that begin in ${topicA} to calculate an intermediate parameter, which must then be inserted into ${topicB} equations.`,
      synthesisChallenge: {
        question: `[Multi-Topic Synthesis: ${topicA} ⨁ ${topicB}] When transitioning between the governing equations of ${topicA} and ${topicB}, what is the indispensable parameter that connects both systems?`,
        options: [
          `A. The invariant energy/mass boundary state at the transition interface`,
          `B. A constant scalar coefficient with arbitrary dimensions`,
          `C. Only the elapsed clock time without spatial constraints`,
          `D. No parameters carry over; both topics are completely independent`
        ],
        correctIndex: 0,
        stepByStepResolution: `At the conceptual interface between ${topicA} and ${topicB}, continuity of energy, charge, or mass establishes the coupling constraint. Applying boundary values accurately prevents intermediate sign and unit traps.`
      }
    };
  }, [topicA, topicB]);

  if (!isOpen) return null;

  const handleTestSynthesisDrill = (optIndex: number) => {
    setSelectedOption(optIndex);
    setIsAnswerSubmitted(true);

    if (optIndex === bridgeData.synthesisChallenge.correctIndex) {
      if (onAwardXP) onAwardXP(60, `Cross-Topic Mastered: ${topicA} ⨁ ${topicB}`);
      if (onCureMistakesForTopics) onCureMistakesForTopics([topicA, topicB]);
      triggerStudyGoalConfetti();
    }
  };

  const handleEnrollJointCycle = () => {
    if (onAddTo137Cycle) {
      onAddTo137Cycle({
        subjectName: topicCounts[topicA]?.subject || 'Physics',
        chapterName: 'Cross-Topic Synthesis Bridges',
        topicName: `${topicA} ⨁ ${topicB}`,
        notes: `Cross-Topic Synthesized Bridge (Option 18):\n${bridgeData.conceptualBridge}\n\nCommon Failure Vector:\n${bridgeData.commonFailureVector}`
      });
      setIsEnrolledIn137(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <GitMerge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Cross-Topic Mistake Synthesizer</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-bold">
                  Option 18
                </span>
              </div>
              <p className="text-xs text-muted">
                Cross-communicate between related topics in the vault to heal compound misconceptions
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

        {/* Topic Selector Bar */}
        <div className="p-4 border-b border-theme bg-surface/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="flex-1 sm:w-56">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Topic Cluster A ({mistakesTopicA.length} errors)
              </label>
              <select
                value={topicA}
                onChange={(e) => {
                  setTopicA(e.target.value);
                  setIsAnswerSubmitted(false);
                  setSelectedOption(null);
                  setIsEnrolledIn137(false);
                }}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {topTopicsList.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count} traps)
                  </option>
                ))}
              </select>
            </div>

            <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 mt-4">
              <GitMerge className="w-4 h-4" />
            </div>

            <div className="flex-1 sm:w-56">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
                Topic Cluster B ({mistakesTopicB.length} errors)
              </label>
              <select
                value={topicB}
                onChange={(e) => {
                  setTopicB(e.target.value);
                  setIsAnswerSubmitted(false);
                  setSelectedOption(null);
                  setIsEnrolledIn137(false);
                }}
                className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-theme text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {topTopicsList.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count} traps)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-surface border border-theme w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('mesh')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'mesh' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              🕸️ Conceptual Mesh
            </button>
            <button
              onClick={() => setActiveTab('challenge')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'challenge' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              🎯 Transfer Challenge
            </button>
            <button
              onClick={() => setActiveTab('mistakes')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'mistakes' ? 'bg-primary text-primary-foreground shadow-2xs' : 'text-muted hover:text-primary'
              }`}
            >
              📋 Compare Traps ({mistakesTopicA.length + mistakesTopicB.length})
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Tab 1: Conceptual Mesh */}
          {activeTab === 'mesh' && (
            <div className="space-y-4 animate-fade-in">
              {/* Visual Mesh Card */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 via-surface/60 to-indigo-500/10 border border-purple-500/30 shadow-xs relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex-1 p-3.5 rounded-xl bg-card border border-theme shadow-2xs text-center w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-muted uppercase">Anchor Topic 1</span>
                    <h4 className="text-sm font-bold text-primary mt-0.5">{topicA}</h4>
                    <span className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                      {mistakesTopicA.length} recorded traps
                    </span>
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">
                      Cross-Communication Vector
                    </span>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-purple-500 to-indigo-500" />
                  </div>

                  <div className="flex-1 p-3.5 rounded-xl bg-card border border-theme shadow-2xs text-center w-full sm:w-auto">
                    <span className="text-[10px] font-bold text-muted uppercase">Anchor Topic 2</span>
                    <h4 className="text-sm font-bold text-primary mt-0.5">{topicB}</h4>
                    <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                      {mistakesTopicB.length} recorded traps
                    </span>
                  </div>
                </div>

                {/* Synthesis Diagnostic Callout */}
                <div className="mt-5 p-4 rounded-xl bg-surface/80 border border-theme space-y-3">
                  <div>
                    <span className="text-[11px] font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Synthesized Conceptual Bridge</span>
                    </span>
                    <p className="text-xs font-semibold text-primary mt-1">
                      {bridgeData.conceptualBridge}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-theme">
                    <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Common Failure Vector Across Both Topics</span>
                    </span>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      {bridgeData.commonFailureVector}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-theme">
                    <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Examiner Multi-Topic Trap Mechanism</span>
                    </span>
                    <p className="text-xs text-muted mt-1 leading-relaxed">
                      {bridgeData.examSynthesisTrap}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={() => setActiveTab('challenge')}
                  className="py-2.5 px-4 rounded-xl bg-primary hover:opacity-90 text-white font-bold text-xs transition shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Brain className="w-4 h-4" />
                  <span>Solve Transfer Challenge</span>
                </button>

                <button
                  onClick={handleEnrollJointCycle}
                  disabled={isEnrolledIn137}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                    isEnrolledIn137
                      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                      : 'bg-surface hover:bg-theme-accent text-primary border-theme'
                  }`}
                >
                  {isEnrolledIn137 ? <Check className="w-4 h-4 text-emerald-600" /> : <RotateCcw className="w-4 h-4" />}
                  <span>{isEnrolledIn137 ? 'Enrolled in 1-3-7 Cycle' : 'Enroll Joint in 1-3-7 Cycle'}</span>
                </button>

                {onOpenExternalAIBridge && (
                  <button
                    onClick={() => {
                      onOpenExternalAIBridge(undefined, `${topicA} & ${topicB}`, {
                        question: bridgeData.synthesisChallenge.question,
                        notes: bridgeData.commonFailureVector
                      });
                    }}
                    className="py-2.5 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    title="Export multi-topic prompt to Claude or ChatGPT Web (Option 3)"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>AI Autopsy (Option 3)</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Interactive Transfer Challenge */}
          {activeTab === 'challenge' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-4 rounded-2xl bg-surface border border-theme shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    <span>Multi-Topic Board Challenge</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface border border-theme text-muted">
                    +60 XP Reward
                  </span>
                </div>

                <p className="text-xs sm:text-sm font-semibold text-primary leading-relaxed">
                  {bridgeData.synthesisChallenge.question}
                </p>

                {/* Multiple choice options */}
                <div className="space-y-2 pt-2">
                  {bridgeData.synthesisChallenge.options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === bridgeData.synthesisChallenge.correctIndex;
                    let style = 'bg-surface/60 hover:bg-surface border-theme text-primary';
                    if (isAnswerSubmitted) {
                      if (isCorrect) style = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold';
                      else if (isSelected) style = 'bg-rose-500/15 border-rose-500/40 text-rose-800 dark:text-rose-300 line-through';
                    } else if (isSelected) {
                      style = 'bg-primary/10 border-primary text-primary font-bold';
                    }

                    return (
                      <button
                        key={idx}
                        onClick={() => !isAnswerSubmitted && handleTestSynthesisDrill(idx)}
                        disabled={isAnswerSubmitted}
                        className={`w-full p-3.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center justify-between gap-3 ${style}`}
                      >
                        <span>{opt}</span>
                        {isAnswerSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation */}
                {isAnswerSubmitted && (
                  <div className="p-4 rounded-xl bg-surface/80 border border-theme space-y-2 mt-4 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-xs font-bold text-primary">Examiner's Derivation & Resolution:</span>
                    </div>
                    <p className="text-xs text-muted leading-relaxed whitespace-pre-line">
                      {bridgeData.synthesisChallenge.stepByStepResolution}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Side-by-side mistakes */}
          {activeTab === 'mistakes' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
              {/* Topic A list */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-theme">
                  <span className="text-xs font-bold text-primary">{topicA}</span>
                  <span className="text-[10px] font-mono text-muted">{mistakesTopicA.length} mistakes</span>
                </div>
                {mistakesTopicA.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No mistakes found for {topicA}.</p>
                ) : (
                  mistakesTopicA.map(m => (
                    <div key={m.id} className="p-3 rounded-xl bg-surface/60 border border-theme text-xs space-y-1.5">
                      <p className="font-semibold text-primary line-clamp-2">{m.question}</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">❌ Your Attempt: {m.userAttempt || 'Incorrect'}</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✔️ Rule: {m.correctAnswer || 'Official Answer'}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Topic B list */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between pb-1 border-b border-theme">
                  <span className="text-xs font-bold text-primary">{topicB}</span>
                  <span className="text-[10px] font-mono text-muted">{mistakesTopicB.length} mistakes</span>
                </div>
                {mistakesTopicB.length === 0 ? (
                  <p className="text-xs text-muted py-4 text-center">No mistakes found for {topicB}.</p>
                ) : (
                  mistakesTopicB.map(m => (
                    <div key={m.id} className="p-3 rounded-xl bg-surface/60 border border-theme text-xs space-y-1.5">
                      <p className="font-semibold text-primary line-clamp-2">{m.question}</p>
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">❌ Your Attempt: {m.userAttempt || 'Incorrect'}</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✔️ Rule: {m.correctAnswer || 'Official Answer'}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface/40 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-muted">
            Option 18: Cross-Topic Interconnection Mesh Network
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition cursor-pointer"
          >
            Close Synthesizer
          </button>
        </div>
      </div>
    </div>
  );
};
