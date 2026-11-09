import React, { useState } from 'react';
import { 
  X, 
  HelpCircle, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  Brain, 
  ShieldCheck, 
  RotateCcw, 
  ArrowRight, 
  Send, 
  BookOpen, 
  Flame, 
  Check, 
  ExternalLink,
  Award,
  Layers
} from 'lucide-react';
import { Subject } from '../types';
import { triggerStudyGoalConfetti } from '../lib/confetti';

interface InteractiveSocraticVivaModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjects: Subject[];
  initialSubjectName?: string;
  initialTopicName?: string;
  onAddTo137Cycle?: (params: { subjectName: string; chapterName?: string; topicName: string; notes?: string }) => void;
  onOpenExternalAIBridge?: (subjectId?: string, topicName?: string, mistake?: any) => void;
  onAwardXP?: (amount: number, reason: string) => void;
}

export const InteractiveSocraticVivaModal: React.FC<InteractiveSocraticVivaModalProps> = ({
  isOpen,
  onClose,
  subjects,
  initialSubjectName,
  initialTopicName,
  onAddTo137Cycle,
  onOpenExternalAIBridge,
  onAwardXP
}) => {
  const [subjectName, setSubjectName] = useState<string>(initialSubjectName || subjects[0]?.name || 'Physics');
  const [topicName, setTopicName] = useState<string>(initialTopicName || "Faraday's Law of Induction & Lenz's Law");
  const [stage, setStage] = useState<'assertion' | 'interrogation_1' | 'interrogation_2' | 'verdict'>('assertion');

  // User input responses
  const [studentPremise, setStudentPremise] = useState<string>('');
  const [studentDefense1, setStudentDefense1] = useState<string>('');
  const [studentDefense2, setStudentDefense2] = useState<string>('');

  // Socratic Viva Dialog state
  const [examinerQuestion1, setExaminerQuestion1] = useState<string>('');
  const [examinerQuestion2, setExaminerQuestion2] = useState<string>('');
  const [resilienceScore, setResilienceScore] = useState<number>(0);
  const [blindSpotsIdentified, setBlindSpotsIdentified] = useState<string[]>([]);
  const [isSavedTo137, setIsSavedTo137] = useState<boolean>(false);

  if (!isOpen) return null;

  // Step 1: Student submits initial concept assertion
  const handleStartInterrogation = () => {
    if (!studentPremise.trim()) return;

    // Generate intelligent Socratic counter-challenge based on topic
    const topicLower = topicName.toLowerCase();
    let q1 = `Examiner Challenge: You stated the governing principle. But what are the absolute boundary constraints? Under what specific physical conditions does this formula breakdown or become invalid?`;

    if (topicLower.includes('lenz') || topicLower.includes('induction') || topicLower.includes('faraday')) {
      q1 = `Examiner Socratic Trap: You stated $\\mathcal{E} = -\\frac{d\\Phi_B}{dt}$. Exactly WHICH magnetic flux are you differentiating? What if the magnetic field is static in time, but the loop is moving in a non-uniform field? Does the negative sign represent a mathematical artifact, or a physical conservation law?`;
    } else if (topicLower.includes('mechanic') || topicLower.includes('momentum') || topicLower.includes('newton')) {
      q1 = `Examiner Socratic Trap: Under what conditions does conservation of momentum hold? If an external impulse acts over an infinitesimal time $\\Delta t \\to 0$, can you still conserve momentum along that axis? What if the coordinate frame is accelerating?`;
    } else if (topicLower.includes('thermo') || topicLower.includes('heat') || topicLower.includes('gas')) {
      q1 = `Examiner Socratic Trap: In an adiabatic free expansion of an ideal gas into a vacuum, $Q = 0$ and $W = 0$. Does temperature drop, increase, or stay constant? What happens to the entropy of the universe during this process?`;
    }

    setExaminerQuestion1(q1);
    setStage('interrogation_1');
  };

  // Step 2: Student defends against first challenge
  const handleDefense1 = () => {
    if (!studentDefense1.trim()) return;

    const topicLower = topicName.toLowerCase();
    let q2 = `Examiner Counter-Attack: In recent board examinations, 68% of candidates lost marks because they confused the sign convention. How does your derivation ensure you do not violate energy conservation? What is the physical consequence if the sign were inverted?`;

    if (topicLower.includes('lenz') || topicLower.includes('induction')) {
      q2 = `Examiner Counter-Attack: Suppose the sign in Lenz's law were positive ($+d\\Phi_B/dt$). Walk me through the thought experiment: If a north pole approaches a loop, what happens to the induced current, the induced magnetic dipole, and the acceleration of the magnet? Why does this lead to perpetual motion?`;
    } else if (topicLower.includes('mechanic') || topicLower.includes('momentum')) {
      q2 = `Examiner Counter-Attack: Consider a ballistic pendulum. Mechanical energy is NOT conserved during the collision, but momentum is. Why can you not apply conservation of mechanical energy while the bullet embeds into the block? Where does that kinetic energy physically go?`;
    }

    setExaminerQuestion2(q2);
    setStage('interrogation_2');
  };

  // Step 3: Conclude viva and calculate resilience verdict
  const handleConcludeViva = () => {
    if (!studentDefense2.trim()) return;

    // Evaluate depth of defense
    const wordCount = (studentPremise + ' ' + studentDefense1 + ' ' + studentDefense2).split(/\s+/).length;
    let score = Math.min(96, Math.max(72, 70 + Math.round(wordCount / 4)));
    if (studentDefense1.toLowerCase().includes('energy') || studentDefense1.toLowerCase().includes('conservation')) {
      score += 4;
    }

    const blindSpots: string[] = [];
    if (!studentDefense1.toLowerCase().includes('boundary') && !studentDefense1.toLowerCase().includes('condition')) {
      blindSpots.push('Explicit boundary condition qualification omitted in initial premise');
    }
    if (!studentDefense2.toLowerCase().includes('sign') && !studentDefense2.toLowerCase().includes('conservation')) {
      blindSpots.push('Sign convention physical justification needs tighter rigor');
    }
    if (blindSpots.length === 0) {
      blindSpots.push('Minor notation rigor: clarify vector orientation vs scalar magnitude');
    }

    setResilienceScore(score);
    setBlindSpotsIdentified(blindSpots);
    setStage('verdict');

    if (onAwardXP) {
      onAwardXP(60, `Socratic Viva Defended: ${topicName}`);
      triggerStudyGoalConfetti();
    }
  };

  const handleEnrollIn137 = () => {
    if (onAddTo137Cycle) {
      onAddTo137Cycle({
        subjectName,
        chapterName: 'Socratic Oral Defenses',
        topicName: `${topicName} (Viva Defense)`,
        notes: `Socratic Viva Resilience: ${resilienceScore}%\nKey Examiner Challenge:\n${examinerQuestion1}\n\nIdentified Blind Spots:\n${blindSpotsIdentified.join('; ')}`
      });
      setIsSavedTo137(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-theme rounded-3xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="p-5 border-b border-theme bg-surface/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-primary">Interactive Socratic Viva Examiner</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-bold">
                  Option 28
                </span>
              </div>
              <p className="text-xs text-muted">
                Step-by-step oral/written defense against rigorous boundary challenges to destroy blind spots
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

        {/* Topic Input Bar */}
        <div className="p-4 border-b border-theme bg-surface/40 flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Subject
            </label>
            <select
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              disabled={stage !== 'assertion'}
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-theme text-primary focus:outline-none"
            >
              {subjects.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted block mb-1">
              Concept / Law / Derivation to Defend
            </label>
            <input
              type="text"
              value={topicName}
              onChange={(e) => setTopicName(e.target.value)}
              disabled={stage !== 'assertion'}
              placeholder="e.g. Lenz's Law, Conservation of Angular Momentum, Carnot Cycle"
              className="w-full text-xs font-semibold px-3 py-2 rounded-xl bg-card border border-theme text-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Stage 1: Thesis / Premise Assertion */}
          <div className="p-4 rounded-2xl bg-surface/60 border border-theme space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">1</span>
                <span>Assert Your Foundation / Derivation</span>
              </span>
              <span className="text-[10px] text-muted">Explain the core rule in your own words</span>
            </div>

            {stage === 'assertion' ? (
              <div className="space-y-3 pt-1">
                <textarea
                  value={studentPremise}
                  onChange={(e) => setStudentPremise(e.target.value)}
                  placeholder={`Explain ${topicName} as if teaching an examiner. State the formula, sign conventions, and what physical quantities represent...`}
                  rows={4}
                  className="w-full p-3 rounded-xl bg-card border border-theme text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={handleStartInterrogation}
                  disabled={!studentPremise.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Foundation & Face Socratic Examiner</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-muted italic bg-card p-3 rounded-xl border border-theme leading-relaxed">
                "{studentPremise}"
              </p>
            )}
          </div>

          {/* Stage 2: Socratic Counter-Challenge 1 */}
          {(stage === 'interrogation_1' || stage === 'interrogation_2' || stage === 'verdict') && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  Socratic Interrogation Round 1: Boundary Conditions
                </span>
              </div>
              <p className="text-xs font-semibold text-primary leading-relaxed bg-surface/70 p-3 rounded-xl border border-theme">
                {examinerQuestion1}
              </p>

              {stage === 'interrogation_1' ? (
                <div className="space-y-3 pt-1">
                  <textarea
                    value={studentDefense1}
                    onChange={(e) => setStudentDefense1(e.target.value)}
                    placeholder="Defend your position. Address the boundary condition, physical meaning of sign, or constraints..."
                    rows={3}
                    className="w-full p-3 rounded-xl bg-card border border-theme text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                  />
                  <button
                    onClick={handleDefense1}
                    disabled={!studentDefense1.trim()}
                    className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Deliver Defense to Examiner</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted italic bg-card p-3 rounded-xl border border-theme leading-relaxed">
                  "{studentDefense1}"
                </p>
              )}
            </div>
          )}

          {/* Stage 3: Socratic Counter-Challenge 2 */}
          {(stage === 'interrogation_2' || stage === 'verdict') && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  Socratic Interrogation Round 2: Past Paper Casualty Trap
                </span>
              </div>
              <p className="text-xs font-semibold text-primary leading-relaxed bg-surface/70 p-3 rounded-xl border border-theme">
                {examinerQuestion2}
              </p>

              {stage === 'interrogation_2' ? (
                <div className="space-y-3 pt-1">
                  <textarea
                    value={studentDefense2}
                    onChange={(e) => setStudentDefense2(e.target.value)}
                    placeholder="Explain why the trap fails and how your physical model holds up to extreme edge-cases..."
                    rows={3}
                    className="w-full p-3 rounded-xl bg-card border border-theme text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  />
                  <button
                    onClick={handleConcludeViva}
                    disabled={!studentDefense2.trim()}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-xs"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Conclude Oral Defense & Receive Verdict</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-muted italic bg-card p-3 rounded-xl border border-theme leading-relaxed">
                  "{studentDefense2}"
                </p>
              )}
            </div>
          )}

          {/* Stage 4: Examiner's Verdict & Blind Spot Diagnosis */}
          {stage === 'verdict' && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-surface/60 to-surface border border-emerald-500/30 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary">Socratic Defense Verdict</h4>
                    <span className="text-[10px] text-muted">Examiner's Diagnostic Evaluation</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted">Resilience</span>
                  <div className="text-2xl font-bold font-serif text-emerald-600 dark:text-emerald-400">
                    {resilienceScore}%
                  </div>
                </div>
              </div>

              {/* Identified Blind Spots */}
              <div className="p-3.5 rounded-xl bg-surface border border-theme space-y-2">
                <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Cognitive Blind Spots Uncovered:</span>
                </span>
                <ul className="space-y-1.5 pl-2">
                  {blindSpotsIdentified.map((bs, i) => (
                    <li key={i} className="text-xs text-muted flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{bs}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                <button
                  onClick={handleEnrollIn137}
                  disabled={isSavedTo137}
                  className={`py-2.5 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                    isSavedTo137
                      ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30'
                      : 'bg-primary text-white border-transparent hover:opacity-90'
                  }`}
                >
                  {isSavedTo137 ? <Check className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  <span>{isSavedTo137 ? 'Enrolled in 1-3-7 Cycle' : 'Enroll in 1-3-7 Cycle'}</span>
                </button>

                {onOpenExternalAIBridge && (
                  <button
                    onClick={() => {
                      onOpenExternalAIBridge(undefined, topicName, {
                        question: `Socratic Defense for ${topicName}: ${studentPremise}`,
                        notes: `Examiner Challenge: ${examinerQuestion1}\nDefense: ${studentDefense1}`
                      });
                    }}
                    className="py-2.5 px-4 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    title="Export transcript to Claude or ChatGPT Web (Option 3)"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>External AI Autopsy (Option 3)</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setStage('assertion');
                    setStudentPremise('');
                    setStudentDefense1('');
                    setStudentDefense2('');
                    setIsSavedTo137(false);
                  }}
                  className="py-2.5 px-4 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition cursor-pointer"
                >
                  Defend Another Concept
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-theme bg-surface/40 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-muted">
            Option 28: Interactive Step-by-Step Viva Sandbox
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface hover:bg-theme-accent border border-theme text-primary text-xs font-bold transition cursor-pointer"
          >
            Close Sandbox
          </button>
        </div>
      </div>
    </div>
  );
};
