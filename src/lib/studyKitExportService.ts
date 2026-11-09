/**
 * Study Kit & PDF Cheat Sheet Export Service
 * Formats high-yield printable study kits, cram sheets, formula references, and wall planners.
 */

import { Subject, FlashcardDeck, StudyPlan, UserProfile, RevisionItem } from '../types';

export type StudyKitFormat = 'cram_sheet' | 'wall_planner' | 'monthly_wall_calendar' | 'formula_sheet' | 'flashcard_cutouts' | 'sbbm_answer_sheet';

export interface StudyKitExportOptions {
  format: StudyKitFormat;
  selectedSubjectNames: string[];
  includeFormulas: boolean;
  includeMnemonics: boolean;
  includeFlashcards: boolean;
  includeExams: boolean;
  columns: 1 | 2 | 3;
  fontSize: 'compact' | 'standard' | 'large';
  title?: string;
  notes?: string;
}

/**
 * Builds printable HTML document styled specifically for A4/Letter printer output & PDF export.
 */
export function generatePrintableStudyKitHtml(
  options: StudyKitExportOptions,
  data: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    plans: StudyPlan[];
    userProfile: UserProfile | null;
    revisions: RevisionItem[];
  }
): string {
  const {
    format,
    selectedSubjectNames,
    includeFormulas,
    includeMnemonics,
    includeFlashcards,
    includeExams,
    columns = 2,
    fontSize = 'standard',
    title,
    notes
  } = options;

  const { subjects, flashcardDecks, plans, userProfile } = data;
  const filteredSubjects = selectedSubjectNames.length > 0
    ? subjects.filter(s => selectedSubjectNames.includes(s.name))
    : subjects;

  const filteredDecks = selectedSubjectNames.length > 0
    ? flashcardDecks.filter(d => selectedSubjectNames.includes(d.subjectName))
    : flashcardDecks;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const studentName = userProfile?.displayName || 'Student';
  const academicYear = userProfile?.academicYear || '2026-2027';

  let bodyContent = '';

  if (format === 'cram_sheet') {
    bodyContent = `
      <div class="header-band">
        <div class="badge">ACADEMIC CRAM SHEET & REVISION CHEAT SHEET</div>
        <h1>${title || 'High-Yield Exam Cram Sheet'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Academic Year:</strong> ${academicYear}</span>
          <span><strong>Generated:</strong> ${todayFormatted}</span>
          <span><strong>Subjects:</strong> ${filteredSubjects.map(s => s.name).join(', ') || 'All'}</span>
        </div>
      </div>

      ${notes ? `<div class="focus-callout"><strong>Focus Directive:</strong> ${notes}</div>` : ''}

      ${includeExams && userProfile?.examDates && userProfile.examDates.length > 0 ? `
        <div class="section">
          <h2 class="section-title">🎯 Upcoming Target Exams & Milestones</h2>
          <div class="exam-grid">
            ${userProfile.examDates.map(ex => `
              <div class="exam-card">
                <strong>${ex.examName}</strong> (${ex.subjectName})
                <div class="exam-date">Date: ${ex.date}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <div class="masonry-grid cols-${columns}">
        ${filteredSubjects.map(sub => `
          <div class="subject-card">
            <div class="subject-header">
              <h3>${sub.name}</h3>
              <span class="sub-badge">${sub.chapters.length} Chapters</span>
            </div>
            
            ${sub.chapters.map(ch => `
              <div class="chapter-block">
                <div class="chapter-name">📖 ${ch.name}</div>
                <ul class="topic-list">
                  ${ch.topics.map(t => `
                    <li class="topic-item">
                      <span class="checkbox-box"></span>
                      <span class="topic-title"><strong>${t.name}</strong></span>
                      ${t.status ? `<span class="confidence-tag">${t.status}</span>` : ''}
                    </li>
                  `).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        `).join('')}

        ${includeFlashcards && filteredDecks.length > 0 ? `
          <div class="subject-card flashcard-summary">
            <div class="subject-header">
              <h3>⚡ Quick Flashcard Recall Matrix</h3>
              <span class="sub-badge">${filteredDecks.reduce((acc, d) => acc + d.cards.length, 0)} Total Cards</span>
            </div>
            <div class="flashcard-rows">
              ${filteredDecks.flatMap(d => d.cards.map(c => ({ ...c, deckTitle: d.title, subject: d.subjectName }))).slice(0, 16).map(c => `
                <div class="qa-item">
                  <div class="q-text"><strong>Q:</strong> ${c.front}</div>
                  <div class="a-text"><strong>A:</strong> ${c.back}</div>
                  ${includeMnemonics && c.mnemonic ? `<div class="m-text">💡 <em>${c.mnemonic}</em></div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  } else if (format === 'wall_planner') {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const activePlan = plans[0];

    bodyContent = `
      <div class="header-band">
        <div class="badge">STUDYOS WEEKLY WALL PLANNER</div>
        <h1>${title || 'Weekly Master Study & Focus Schedule'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Target:</strong> ${userProfile?.targetHoursPerDay || 3} hrs/day</span>
          <span><strong>Week of:</strong> ${todayFormatted}</span>
        </div>
      </div>

      ${notes ? `<div class="focus-callout"><strong>Weekly Target:</strong> ${notes}</div>` : ''}

      <div class="wall-grid">
        ${days.map((day, idx) => `
          <div class="day-column">
            <div class="day-header">
              <h4>${day}</h4>
              <span class="day-sub">Day ${idx + 1}</span>
            </div>
            <div class="day-body">
              <div class="slot-block">
                <div class="slot-label">🌅 Morning Core Block</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
              </div>
              <div class="slot-block">
                <div class="slot-label">☀️ Afternoon Problem Sprints</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> ____________________</div>
              </div>
              <div class="slot-block">
                <div class="slot-label">🌙 Evening Flashcard Review</div>
                <div class="checkbox-row"><span class="checkbox-box"></span> Active Recall & Spaced Rep</div>
              </div>
              <div class="day-footer">
                <span>Target: 3.0h</span>
                <span>Actual: ___h</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="wall-footer">
        <div class="checklist-box-group">
          <strong>Weekly Habit Checklist:</strong>
          <span class="checkbox-row"><span class="checkbox-box"></span> 7:30 AM Briefing Reviewed</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Daily Test Diagnostics Checked</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Google Drive Vault Synced</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Mock Exam Completed</span>
        </div>
        <div class="signature-box">
          <div>Parent / Advisor / Self Verification: _________________________</div>
        </div>
      </div>
    `;
  } else if (format === 'monthly_wall_calendar') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });

    // Days in current month
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sun
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    // Adjusted index for Monday start: Mon=0, Tue=1 ... Sun=6
    const startOffset = (firstDayIndex + 6) % 7;

    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const calendarCells: Array<{ dayNum?: number; dateStr?: string; plan?: StudyPlan; exams?: any[] }> = [];

    // Empty offset cells
    for (let i = 0; i < startOffset; i++) {
      calendarCells.push({});
    }

    // Actual day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const matchedPlan = plans.find(p => p.date === dateStr);
      const matchedExams = (userProfile?.examDates || []).filter(e => e.date === dateStr);
      calendarCells.push({
        dayNum: d,
        dateStr,
        plan: matchedPlan,
        exams: matchedExams
      });
    }

    bodyContent = `
      <div class="header-band">
        <div class="badge">STUDYOS PRINTABLE MONTHLY WALL CALENDAR</div>
        <h1>${title || `Academic Wall Calendar — ${monthName}`}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Target Study Hours:</strong> ${userProfile?.targetHoursPerDay || 3} hrs/day</span>
          <span><strong>Monthly Target:</strong> ${(userProfile?.targetHoursPerDay || 3) * daysInMonth} hours total</span>
          <span><strong>Generated:</strong> ${todayFormatted}</span>
        </div>
      </div>

      ${notes ? `<div class="focus-callout"><strong>Monthly Academic Objective:</strong> ${notes}</div>` : ''}

      <div class="monthly-cal-wrapper">
        <div class="monthly-weekdays-row">
          ${weekdays.map(w => `<div class="weekday-cell">${w}</div>`).join('')}
        </div>
        <div class="monthly-grid">
          ${calendarCells.map(cell => {
            if (!cell.dayNum) {
              return `<div class="cal-day-cell empty-cell"></div>`;
            }
            const topics = cell.plan?.topics || [];
            const hasExams = cell.exams && cell.exams.length > 0;
            return `
              <div class="cal-day-cell ${hasExams ? 'exam-day' : ''}">
                <div class="cal-day-top">
                  <span class="cal-day-number">${cell.dayNum}</span>
                  <span class="cal-target-tag">${userProfile?.targetHoursPerDay || 3}h Goal</span>
                </div>

                ${hasExams ? `
                  <div class="cal-exam-badge">
                    🎯 ${cell.exams!.map(e => e.examName).join(', ')}
                  </div>
                ` : ''}

                <div class="cal-checkbox-list">
                  <div class="cal-checkbox-row"><span class="checkbox-box"></span> Met ${(userProfile?.targetHoursPerDay || 3)}h Target</div>
                  <div class="cal-checkbox-row"><span class="checkbox-box"></span> Active Recall</div>
                  <div class="cal-checkbox-row"><span class="checkbox-box"></span> MCQ Sprint</div>
                  <div class="cal-checkbox-row"><span class="checkbox-box"></span> Done ✓</div>
                </div>

                ${topics.length > 0 ? `
                  <div class="cal-topic-pill">
                    📖 ${topics.slice(0, 2).map(t => t.topicName).join(', ')}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="wall-footer">
        <div class="checklist-box-group">
          <strong>Monthly Accountability & Audit:</strong>
          <span class="checkbox-row"><span class="checkbox-box"></span> Minimum 25 days with all 4 boxes checked</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> All chapter mock tests completed before exam week</span>
          <span class="checkbox-row"><span class="checkbox-box"></span> Mistake Vault cleared and reviewed weekly</span>
        </div>
        <div class="signature-box">
          <div>Monthly Study Commitment: ___________________________ Date: ____________</div>
        </div>
      </div>
    `;
  } else if (format === 'formula_sheet') {
    bodyContent = `
      <div class="header-band">
        <div class="badge">QUICK-REFERENCE CHEAT SHEET</div>
        <h1>${title || 'Key Formulas, Definitions & Mnemonics'}</h1>
        <div class="meta-row">
          <span><strong>Student:</strong> ${studentName}</span>
          <span><strong>Date:</strong> ${todayFormatted}</span>
        </div>
      </div>

      <div class="masonry-grid cols-${columns}">
        ${filteredSubjects.map(s => `
          <div class="subject-card">
            <div class="subject-header">
              <h3>${s.name} Reference Sheet</h3>
            </div>
            <div class="formula-list">
              ${s.chapters.map(c => `
                <div class="formula-group">
                  <div class="formula-group-title">${c.name}</div>
                  <div class="formula-row">
                    <strong>Core Law / Principle:</strong> Fundamental definitions for ${c.topics.map(t => t.name).slice(0, 3).join(', ')}
                  </div>
                  <div class="formula-row">
                    <strong>Key Equations:</strong> ΔE = mc² • F = ma • PV = nRT • V = IR
                  </div>
                  <div class="formula-row">
                    <strong>Common Trap:</strong> Check unit conversions (SI units: kg, m, s, A, K, mol).
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (format === 'sbbm_answer_sheet') {
    const mainSubject = filteredSubjects[0]?.name || 'General Science & Mathematics';
    bodyContent = `
      <div class="sbbm-sheet-wrapper">
        <!-- OFFICIAL SBBM BOARD HEADER -->
        <div class="sbbm-header">
          <div class="sbbm-crest-col">
            <svg viewBox="0 0 120 120" width="70" height="70" class="sbbm-crest-svg">
              <circle cx="60" cy="60" r="56" fill="#FFFFFF" stroke="#000000" stroke-width="2.5" />
              <circle cx="60" cy="60" r="50" fill="#F8FAFC" stroke="#000000" stroke-width="1.5" stroke-dasharray="3,2" />
              <circle cx="60" cy="60" r="38" fill="#FFFFFF" stroke="#000000" stroke-width="2" />
              <!-- Laurel Wreath -->
              <ellipse cx="32" cy="52" rx="3.5" ry="1.8" transform="rotate(-30 32 52)" fill="#000000" />
              <ellipse cx="30" cy="60" rx="3.5" ry="1.8" fill="#000000" />
              <ellipse cx="32" cy="68" rx="3.5" ry="1.8" transform="rotate(30 32 68)" fill="#000000" />
              <ellipse cx="88" cy="52" rx="3.5" ry="1.8" transform="rotate(30 88 52)" fill="#000000" />
              <ellipse cx="90" cy="60" rx="3.5" ry="1.8" fill="#000000" />
              <ellipse cx="88" cy="68" rx="3.5" ry="1.8" transform="rotate(-30 88 68)" fill="#000000" />
              <!-- Book & Torch -->
              <path d="M 45 62 Q 52 57 60 60 Q 68 57 75 62 L 74 69 Q 68 64 60 67 Q 52 64 46 69 Z" fill="#E2E8F0" stroke="#000000" stroke-width="1.2" />
              <line x1="60" y1="60" x2="60" y2="67" stroke="#000000" stroke-width="1.5" />
              <path d="M 58 55 L 62 55 L 61 48 L 59 48 Z" fill="#000000" />
              <path d="M 60 47 Q 56 42 60 37 Q 64 42 60 47 Z" fill="#000000" />
              <!-- SBBM Text Banner -->
              <rect x="34" y="75" width="52" height="15" rx="3" fill="#FFFFFF" stroke="#000000" stroke-width="1.5" />
              <text x="60" y="86" text-anchor="middle" font-size="10" font-weight="900" font-family="serif" letter-spacing="1.5" fill="#000000">SBBM</text>
            </svg>
          </div>

          <div class="sbbm-title-col">
            <div class="sbbm-sup-title">SINDH BOARD OF SECONDARY & HIGHER SECONDARY EDUCATION</div>
            <h1 class="sbbm-main-title">OFFICIAL CANDIDATE EXAMINATION ANSWER SHEET</h1>
            <div class="sbbm-sub-title">STANDARD BOARD EXAM DOSSIER • TARGET TIME-PACED AUDIT SYSTEM</div>
          </div>

          <div class="sbbm-serial-col">
            <div class="serial-box">
              <span class="serial-lbl">FORM SERIAL NO.</span>
              <span class="serial-num">SBBM-2026-${Math.floor(100000 + Math.random() * 900000)}</span>
            </div>
            <div class="security-seal-tag">🛡️ OFFICIAL WATERMARK SEAL</div>
          </div>
        </div>

        <!-- 4 AUTHENTIC TARGET STAMPS BANNER -->
        <div class="target-stamps-bar">
          <div class="rubber-stamp stamp-red">
            <div class="stamp-inner">
              <div class="stamp-top">🎯 TARGET PRESSURE</div>
              <div class="stamp-mid">TIME-PACED VERIFIED</div>
              <div class="stamp-bot">21.5s/45s MCQ • 2m SQ • 15m LQ</div>
            </div>
          </div>

          <div class="rubber-stamp stamp-green">
            <div class="stamp-inner">
              <div class="stamp-top">⚡ 100% ATTEMPT</div>
              <div class="stamp-mid">ZERO OMISSIONS</div>
              <div class="stamp-bot">ALL SECTIONS REQUIRED</div>
            </div>
          </div>

          <div class="rubber-stamp stamp-blue">
            <div class="stamp-inner">
              <div class="stamp-top">📑 EXAMINER AUDIT</div>
              <div class="stamp-mid">STEP-BY-STEP RUBRIC</div>
              <div class="stamp-bot">FORMULA + WORKING + UNITS</div>
            </div>
          </div>

          <div class="rubber-stamp stamp-purple">
            <div class="stamp-inner">
              <div class="stamp-top">👑 SBBM TARGET</div>
              <div class="stamp-mid">GRADE A* BENCHMARK</div>
              <div class="stamp-bot">OFFICIAL CERTIFIED</div>
            </div>
          </div>
        </div>

        <!-- CANDIDATE PARTICULARS GRID -->
        <div class="candidate-header-grid">
          <div class="cand-cell">
            <span class="cand-lbl">CANDIDATE NAME:</span>
            <span class="cand-val">${studentName}</span>
          </div>
          <div class="cand-cell">
            <span class="cand-lbl">SUBJECT & PAPER:</span>
            <span class="cand-val">${mainSubject} (Theory / Board Paper)</span>
          </div>
          <div class="cand-cell">
            <span class="cand-lbl">EXAMINATION DATE:</span>
            <span class="cand-val">${todayFormatted}</span>
          </div>
          <div class="cand-cell">
            <span class="cand-lbl">CENTER / SEAT NO.:</span>
            <span class="cand-val">SBBM-KHI-402 / SEAT #B-19</span>
          </div>
          <div class="cand-cell cand-roll-cell">
            <span class="cand-lbl">CANDIDATE ROLL NUMBER:</span>
            <div class="roll-box-strip">
              <span class="r-box">7</span>
              <span class="r-box">4</span>
              <span class="r-box">8</span>
              <span class="r-box">2</span>
              <span class="r-box">9</span>
              <span class="r-box">1</span>
            </div>
          </div>
          <div class="cand-cell">
            <span class="cand-lbl">MAX MARKS & TIME:</span>
            <span class="cand-val">100 Marks | 3 Hours Total Time</span>
          </div>
        </div>

        <!-- SECTION A: MCQ BUBBLE MATRIX (OMR) WITH TARGET TIME STAMPS -->
        <div class="sheet-section">
          <div class="section-banner">
            <span class="sec-title">SECTION A: MULTIPLE CHOICE QUESTIONS (MCQ OMR MATRIX)</span>
            <span class="sec-meta">TARGET BENCHMARK: 21.5s / 45s PER QUESTION • 1 MARK EACH</span>
          </div>
          <div class="mcq-omr-matrix">
            ${Array.from({ length: 30 }).map((_, idx) => {
              const qNum = idx + 1;
              return `
                <div class="mcq-row">
                  <span class="mcq-num">Q${qNum < 10 ? '0' + qNum : qNum}</span>
                  <span class="omr-bubble">A</span>
                  <span class="omr-bubble">B</span>
                  <span class="omr-bubble">C</span>
                  <span class="omr-bubble">D</span>
                  <span class="mcq-time-target">⏱️ [21.5s]</span>
                  <span class="mcq-actual-box">Act: ___s</span>
                  <span class="mcq-chk">□</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- SECTION B: SHORT QUESTIONS (SQ) WITH STRUCTURED ANSWER WORKSPACE -->
        <div class="sheet-section page-break-before">
          <div class="section-banner">
            <span class="sec-title">SECTION B: SHORT QUESTIONS (SQ STRUCTURED WORKING DOSSIER)</span>
            <span class="sec-meta">TARGET BENCHMARK: 2-3 MINUTES PER QUESTION • 4 MARKS EACH</span>
          </div>

          <div class="sq-grid">
            ${[
              { q: 'Q.1', topic: 'Define Core Concept / Scientific Law', req: 'Definition (1M) • Governing Formula (1M) • 2 Key Points/Units (2M)' },
              { q: 'Q.2', topic: 'Mechanism / Working Principle', req: 'Statement of Principle (1M) • Labeled Diagram Sketch (2M) • Significance (1M)' },
              { q: 'Q.3', topic: 'Comparative Differentiation (Table format)', req: 'Criteria 1 (1M) • Criteria 2 (1M) • Example 1 (1M) • Example 2 (1M)' },
              { q: 'Q.4', topic: 'Numerical / Formula Application', req: 'Data Given (1M) • Formula (1M) • Calculation (1M) • Final SI Unit (1M)' },
              { q: 'Q.5', topic: 'Cause & Effect / Reasoning Question', req: 'Direct Reason (2M) • Supporting Chemical/Physical Law (2M)' },
              { q: 'Q.6', topic: 'Short Synthesis / Diagram Labeling', req: 'Key Label 1 (1M) • Label 2 (1M) • Functional Explanation (2M)' }
            ].map(sq => `
              <div class="sq-card">
                <div class="sq-head">
                  <div class="sq-title-strip">
                    <strong>${sq.q}: ${sq.topic}</strong>
                    <span class="sq-stamp">⏱️ TARGET: 2 MINS | 4 MARKS</span>
                  </div>
                  <div class="sq-subtext">Rubric Criteria: ${sq.req}</div>
                </div>
                <div class="sq-ruled-lines">
                  <div class="sq-line"><span class="sq-prompt">1. Statement/Def:</span></div>
                  <div class="sq-line"><span class="sq-prompt">2. Formula:</span></div>
                  <div class="sq-line"></div>
                  <div class="sq-line"></div>
                  <div class="sq-line"></div>
                </div>
                <div class="sq-examiner-strip">
                  <span>Rubric Checklist: [ ] Def  [ ] Formula  [ ] Working  [ ] Units</span>
                  <span class="sq-marks-box">Marks: [ &nbsp; / 4 ]</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- SECTION C: LONG QUESTIONS (LQ) EXTENDED WORKSPACE -->
        <div class="sheet-section page-break-before">
          <div class="section-banner">
            <span class="sec-title">SECTION C: LONG QUESTIONS (LQ EXTENDED DERIVATION & ESSAY)</span>
            <span class="sec-meta">TARGET BENCHMARK: 15 MINUTES PER QUESTION • 10 MARKS EACH</span>
          </div>

          ${[
            { q: 'Q.7', title: 'Comprehensive Theoretical Derivation & Mathematical Proof', marks: '10' },
            { q: 'Q.8', title: 'Experimental Verification, Industrial Process & Schematic Flowchart', marks: '10' }
          ].map(lq => `
            <div class="lq-card">
              <div class="lq-head">
                <div class="lq-title-strip">
                  <strong>${lq.q}: ${lq.title}</strong>
                  <span class="lq-stamp">⏱️ TARGET: 15 MINS | ${lq.marks} MARKS</span>
                </div>
                <div class="lq-milestones">
                  <span>[ ] Milestone 1: Statement & Assumptions (2M)</span>
                  <span>[ ] Milestone 2: Mathematical Derivation (4M)</span>
                  <span>[ ] Milestone 3: Labeled Diagram (2M)</span>
                  <span>[ ] Milestone 4: Conclusion & SI Units (2M)</span>
                </div>
              </div>

              <div class="lq-workspace">
                <div class="lq-margin">
                  <span>Rough Working / Units</span>
                </div>
                <div class="lq-lines">
                  ${Array.from({ length: 12 }).map(() => `<div class="lq-line"></div>`).join('')}
                </div>
              </div>

              <div class="lq-examiner-strip">
                <span>Examiner Rubric Audit: Step 1 [ /2 ] • Step 2 [ /4 ] • Diagram [ /2 ] • Units [ /2 ]</span>
                <span class="lq-marks-box">Total Marks: [ &nbsp;&nbsp;&nbsp; / ${lq.marks} ]</span>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- EXAMINER AUDIT & VERIFICATION SEAL FOOTER -->
        <div class="sbbm-footer-audit">
          <div class="audit-col">
            <div class="audit-title">CANDIDATE UNDERTAKING</div>
            <div class="audit-desc">I confirm all sections were attempted under authentic exam pressure and time benchmarks.</div>
            <div class="sig-line">Candidate Signature: _______________________</div>
          </div>
          <div class="audit-col">
            <div class="audit-title">INVIGILATOR & EXAMINER AUDIT</div>
            <div class="audit-desc">Identity verified, OMR bubbles inspected, and rubric marking criteria applied.</div>
            <div class="sig-line">Chief Invigilator: _______________________</div>
          </div>
          <div class="audit-col seal-col">
            <div class="embossed-seal">
              <div class="seal-inner">
                <span>SBBM</span>
                <span class="seal-sub">OFFICIAL BOARD</span>
                <span class="seal-sub">EXAM SEAL</span>
              </div>
            </div>
            <div class="final-score-box">
              <span class="fs-lbl">TOTAL SCORE</span>
              <span class="fs-val">[ &nbsp;&nbsp;&nbsp;&nbsp; / 100 ]</span>
            </div>
          </div>
        </div>
      </div>
    `;
  } else {
    // Flashcard Cutouts
    bodyContent = `
      <div class="header-band">
        <div class="badge">PRINTABLE POCKET FLASHCARDS</div>
        <h1>${title || 'Pocket Revision Flashcard Cutouts'}</h1>
        <div class="meta-row">
          <span>Cut along dashed lines to make portable flashcards</span>
        </div>
      </div>

      <div class="cutout-grid">
        ${filteredDecks.flatMap(d => d.cards.map(c => ({ ...c, subject: d.subjectName }))).map((c, i) => `
          <div class="cutout-card">
            <div class="card-side front">
              <span class="card-tag">CARD #${i + 1} • ${c.subject}</span>
              <div class="card-main">${c.front}</div>
            </div>
            <div class="card-side back">
              <span class="card-tag">ANSWER / RECALL</span>
              <div class="card-main">${c.back}</div>
              ${c.mnemonic ? `<div class="card-mnemonic">💡 ${c.mnemonic}</div>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || 'StudyOS Printable Study Kit'}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 12mm 12mm 12mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1F2937;
      background-color: #FFFFFF;
      margin: 0;
      padding: 16px;
      font-size: ${fontSize === 'compact' ? '11px' : fontSize === 'large' ? '14px' : '12px'};
      line-height: 1.45;
    }
    .header-band {
      border-bottom: 2px solid #374151;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      background-color: #4B5563;
      color: #FFFFFF;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
    }
    h1 {
      margin: 2px 0 6px 0;
      font-size: 20px;
      font-weight: 800;
      color: #111827;
      letter-spacing: -0.5px;
    }
    h2, h3, h4 {
      margin: 0;
      color: #1F2937;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      font-size: 11px;
      color: #4B5563;
    }
    .focus-callout {
      background-color: #F3F4F6;
      border-left: 4px solid #4B5563;
      padding: 8px 12px;
      border-radius: 4px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .masonry-grid {
      display: grid;
      gap: 12px;
    }
    .masonry-grid.cols-1 { grid-template-columns: 1fr; }
    .masonry-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .masonry-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }

    .subject-card {
      border: 1px solid #D1D5DB;
      border-radius: 8px;
      padding: 10px 12px;
      background: #FFFFFF;
      break-inside: avoid;
    }
    .subject-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #E5E7EB;
      padding-bottom: 6px;
      margin-bottom: 8px;
    }
    .subject-header h3 {
      font-size: 14px;
      font-weight: 700;
    }
    .sub-badge {
      font-size: 9px;
      background: #E5E7EB;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 600;
    }
    .chapter-block {
      margin-bottom: 8px;
    }
    .chapter-name {
      font-weight: 700;
      font-size: 11px;
      color: #374151;
      margin-bottom: 4px;
    }
    .topic-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .topic-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 0;
      font-size: 11px;
    }
    .checkbox-box {
      display: inline-block;
      width: 10px;
      height: 10px;
      border: 1.5px solid #6B7280;
      border-radius: 2px;
      flex-shrink: 0;
    }
    .confidence-tag {
      margin-left: auto;
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: #F3F4F6;
      color: #4B5563;
    }
    .exam-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 8px;
      margin-bottom: 12px;
    }
    .exam-card {
      border: 1px solid #E5E7EB;
      border-radius: 6px;
      padding: 8px;
      background: #F9FAFB;
      font-size: 11px;
    }
    .exam-date {
      color: #B91C1C;
      font-weight: 700;
      margin-top: 2px;
    }
    .qa-item {
      border-bottom: 1px dashed #E5E7EB;
      padding: 4px 0;
      font-size: 11px;
    }
    .q-text { color: #111827; }
    .a-text { color: #047857; margin-top: 2px; }
    .m-text { color: #B45309; font-size: 10px; margin-top: 2px; }

    /* Wall planner */
    .wall-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 6px;
      margin-bottom: 14px;
    }
    .day-column {
      border: 1px solid #D1D5DB;
      border-radius: 6px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      height: 380px;
    }
    .day-header {
      background: #F3F4F6;
      border-bottom: 1px solid #D1D5DB;
      padding: 6px 4px;
      text-align: center;
    }
    .day-header h4 { font-size: 11px; }
    .day-sub { font-size: 9px; color: #6B7280; }
    .day-body {
      padding: 6px;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      font-size: 10px;
    }
    .slot-block { margin-bottom: 8px; }
    .slot-label { font-weight: 700; color: #4B5563; font-size: 9px; margin-bottom: 2px; }
    .checkbox-row { display: flex; align-items: center; gap: 4px; margin: 3px 0; }
    .day-footer {
      border-top: 1px solid #E5E7EB;
      padding-top: 4px;
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      font-weight: bold;
    }
    .wall-footer {
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #D1D5DB;
      padding-top: 8px;
      font-size: 10px;
    }
    .checklist-box-group { display: flex; flex-direction: column; gap: 4px; }
    .signature-box { align-self: flex-end; }

    /* Monthly Wall Calendar Grid & Boxes */
    .monthly-cal-wrapper {
      margin-bottom: 14px;
    }
    .monthly-weekdays-row {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
      margin-bottom: 4px;
      text-align: center;
      font-weight: 800;
      font-size: 11px;
      text-transform: uppercase;
      color: #374151;
      letter-spacing: 0.05em;
    }
    .weekday-cell {
      background: #F3F4F6;
      border: 1px solid #D1D5DB;
      border-radius: 4px;
      padding: 4px 0;
    }
    .monthly-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }
    .cal-day-cell {
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 6px 5px;
      min-height: 105px;
      background: #FFFFFF;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .cal-day-cell.empty-cell {
      background: #F8FAFC;
      border: 1px dashed #E2E8F0;
    }
    .cal-day-cell.exam-day {
      border: 1.5px solid #DC2626;
      background: #FEF2F2;
    }
    .cal-day-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .cal-day-number {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
    }
    .cal-target-tag {
      font-size: 8px;
      font-weight: 700;
      color: #2563EB;
      background: #EFF6FF;
      padding: 1px 3px;
      border-radius: 3px;
    }
    .cal-exam-badge {
      font-size: 8px;
      font-weight: 800;
      color: #991B1B;
      background: #FEE2E2;
      border: 1px solid #FCA5A5;
      border-radius: 3px;
      padding: 2px 3px;
      margin-bottom: 3px;
    }
    .cal-checkbox-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      font-size: 8.5px;
      color: #334155;
      margin: 2px 0;
    }
    .cal-checkbox-row {
      display: flex;
      align-items: center;
      gap: 4px;
      font-weight: 500;
    }
    .cal-checkbox-row .checkbox-box {
      width: 11px;
      height: 11px;
      border: 1.5px solid #1E293B;
      border-radius: 2.5px;
      background: #FFFFFF;
      display: inline-block;
      flex-shrink: 0;
    }
    .cal-topic-pill {
      font-size: 7.5px;
      font-weight: 700;
      color: #047857;
      background: #ECFDF5;
      padding: 2px 3px;
      border-radius: 3px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-top: 2px;
    }

    /* SBBM Answer Sheet & Target Rubber Stamps Styles */
    .sbbm-sheet-wrapper {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Times New Roman", serif;
      color: #0F172A;
      background: #FFFFFF;
      padding: 4px;
    }
    .sbbm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2.5px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 10px;
      gap: 12px;
    }
    .sbbm-crest-col {
      width: 75px;
      flex-shrink: 0;
      display: flex;
      justify-content: center;
    }
    .sbbm-title-col {
      flex: 1;
      text-align: center;
    }
    .sbbm-sup-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #1E293B;
      text-transform: uppercase;
      font-family: serif;
    }
    .sbbm-main-title {
      font-size: 17px;
      font-weight: 900;
      color: #0F172A;
      margin: 2px 0;
      letter-spacing: -0.2px;
      font-family: serif;
    }
    .sbbm-sub-title {
      font-size: 9px;
      font-family: monospace;
      font-weight: 700;
      color: #475569;
      letter-spacing: 0.8px;
    }
    .sbbm-serial-col {
      width: 130px;
      flex-shrink: 0;
      text-align: right;
    }
    .serial-box {
      border: 1.5px solid #0F172A;
      padding: 3px 6px;
      border-radius: 4px;
      background: #F8FAFC;
    }
    .serial-lbl {
      display: block;
      font-size: 7.5px;
      font-family: monospace;
      font-weight: 800;
      color: #475569;
    }
    .serial-num {
      display: block;
      font-size: 9px;
      font-family: monospace;
      font-weight: 900;
      color: #0F172A;
    }
    .security-seal-tag {
      font-size: 7.5px;
      color: #059669;
      font-weight: 800;
      margin-top: 3px;
    }

    /* 4 Target Rubber Stamps Bar */
    .target-stamps-bar {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 12px;
      padding: 4px 0;
    }
    .rubber-stamp {
      flex: 1;
      padding: 4px;
      border-radius: 6px;
      text-align: center;
      box-shadow: 0 0 0 1px inset;
      transition: transform 0.2s;
    }
    .stamp-inner {
      border: 1.5px dashed;
      padding: 4px 2px;
      border-radius: 4px;
    }
    .stamp-top {
      font-size: 8px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .stamp-mid {
      font-size: 10px;
      font-weight: 900;
      letter-spacing: 0.8px;
      margin: 1px 0;
    }
    .stamp-bot {
      font-size: 7px;
      font-family: monospace;
      font-weight: 700;
      opacity: 0.85;
    }
    .stamp-red {
      color: #DC2626;
      border: 2px solid #DC2626;
      background: #FEF2F2;
      transform: rotate(-2deg);
    }
    .stamp-green {
      color: #059669;
      border: 2px solid #059669;
      background: #ECFDF5;
      transform: rotate(1.5deg);
    }
    .stamp-blue {
      color: #2563EB;
      border: 2px solid #2563EB;
      background: #EFF6FF;
      transform: rotate(-1.5deg);
    }
    .stamp-purple {
      color: #7C3AED;
      border: 2px solid #7C3AED;
      background: #F5F3FF;
      transform: rotate(2deg);
    }

    /* Candidate Header Grid */
    .candidate-header-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      border: 1.5px solid #0F172A;
      margin-bottom: 12px;
      background: #FFFFFF;
    }
    .cand-cell {
      padding: 4px 8px;
      border-right: 1px solid #CBD5E1;
      border-bottom: 1px solid #CBD5E1;
      font-size: 10px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .cand-cell:nth-child(3n) { border-right: none; }
    .cand-lbl { font-size: 8px; font-weight: 800; color: #475569; font-family: monospace; }
    .cand-val { font-size: 11px; font-weight: 800; color: #0F172A; margin-top: 1px; }
    .cand-roll-cell {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }
    .roll-box-strip {
      display: flex;
      gap: 3px;
    }
    .r-box {
      width: 18px;
      height: 20px;
      border: 1.5px solid #0F172A;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 900;
      font-family: monospace;
      background: #F8FAFC;
    }

    /* Section Headers */
    .sheet-section {
      margin-bottom: 14px;
    }
    .section-banner {
      background: #0F172A;
      color: #FFFFFF;
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 800;
      margin-bottom: 8px;
    }
    .sec-title { font-size: 10.5px; letter-spacing: 0.5px; }
    .sec-meta { font-size: 8px; font-family: monospace; opacity: 0.9; }

    /* MCQ OMR Matrix */
    .mcq-omr-matrix {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 4px 10px;
      border: 1px solid #CBD5E1;
      padding: 8px;
      background: #FFFFFF;
    }
    .mcq-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2.5px 0;
      border-bottom: 0.5px dashed #E2E8F0;
      font-size: 9px;
    }
    .mcq-num {
      width: 22px;
      font-weight: 800;
      font-family: monospace;
      color: #0F172A;
    }
    .omr-bubble {
      width: 14px;
      height: 14px;
      border: 1.2px solid #0F172A;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 8px;
      font-weight: 800;
      color: #0F172A;
      background: #FFFFFF;
    }
    .mcq-time-target {
      font-size: 7.5px;
      font-family: monospace;
      color: #DC2626;
      font-weight: 700;
      margin-left: 2px;
    }
    .mcq-actual-box {
      font-size: 7.5px;
      font-family: monospace;
      color: #64748B;
      border: 0.8px solid #CBD5E1;
      padding: 1px 3px;
      border-radius: 2px;
    }
    .mcq-chk {
      font-size: 9px;
      color: #94A3B8;
      margin-left: auto;
    }

    /* Short Questions Grid */
    .sq-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .sq-card {
      border: 1.2px solid #334155;
      border-radius: 4px;
      padding: 6px;
      background: #FFFFFF;
      break-inside: avoid;
    }
    .sq-head { margin-bottom: 4px; }
    .sq-title-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
    }
    .sq-stamp {
      font-size: 7.5px;
      font-family: monospace;
      font-weight: 800;
      color: #B45309;
      background: #FEF3C7;
      padding: 1px 4px;
      border-radius: 3px;
      border: 0.8px solid #F59E0B;
    }
    .sq-subtext {
      font-size: 8px;
      color: #64748B;
      font-family: monospace;
      margin-top: 1px;
    }
    .sq-ruled-lines {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin: 6px 0;
    }
    .sq-line {
      height: 14px;
      border-bottom: 1px solid #CBD5E1;
      display: flex;
      align-items: flex-end;
      font-size: 8px;
      color: #94A3B8;
    }
    .sq-prompt {
      font-size: 7.5px;
      font-weight: 700;
      color: #64748B;
    }
    .sq-examiner-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed #CBD5E1;
      padding-top: 4px;
      font-size: 7.5px;
      font-family: monospace;
      color: #475569;
    }
    .sq-marks-box {
      font-weight: 800;
      color: #0F172A;
      border: 1px solid #0F172A;
      padding: 1px 4px;
      border-radius: 2px;
      background: #F8FAFC;
    }

    /* Long Questions */
    .lq-card {
      border: 1.5px solid #1E293B;
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 10px;
      background: #FFFFFF;
      break-inside: avoid;
    }
    .lq-title-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
    }
    .lq-stamp {
      font-size: 8px;
      font-family: monospace;
      font-weight: 800;
      color: #7C3AED;
      background: #F5F3FF;
      padding: 2px 6px;
      border-radius: 3px;
      border: 1px solid #8B5CF6;
    }
    .lq-milestones {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 8px;
      font-family: monospace;
      color: #475569;
      background: #F8FAFC;
      padding: 3px 6px;
      border-radius: 3px;
      margin: 4px 0 6px 0;
      border: 0.8px solid #E2E8F0;
    }
    .lq-workspace {
      display: flex;
      gap: 8px;
      margin: 8px 0;
    }
    .lq-margin {
      width: 70px;
      border-right: 1.5px solid #DC2626;
      font-size: 7.5px;
      color: #94A3B8;
      font-family: monospace;
      text-align: center;
      padding-right: 4px;
    }
    .lq-lines {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .lq-line {
      height: 16px;
      border-bottom: 1px solid #CBD5E1;
    }
    .lq-examiner-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px dashed #0F172A;
      padding-top: 5px;
      font-size: 8px;
      font-family: monospace;
      color: #334155;
    }
    .lq-marks-box {
      font-weight: 900;
      color: #0F172A;
      border: 1.5px solid #0F172A;
      padding: 2px 6px;
      border-radius: 3px;
      background: #F8FAFC;
      font-size: 9px;
    }

    /* Footer Audit */
    .sbbm-footer-audit {
      display: flex;
      border: 1.5px solid #0F172A;
      padding: 8px;
      gap: 12px;
      background: #F8FAFC;
      margin-top: 10px;
      break-inside: avoid;
    }
    .audit-col {
      flex: 1;
      font-size: 8px;
    }
    .audit-title {
      font-weight: 800;
      color: #0F172A;
      font-size: 8.5px;
      margin-bottom: 2px;
      letter-spacing: 0.3px;
    }
    .audit-desc {
      color: #64748B;
      line-height: 1.2;
      margin-bottom: 10px;
    }
    .sig-line {
      border-top: 1px solid #0F172A;
      padding-top: 3px;
      font-weight: 700;
      color: #1E293B;
    }
    .seal-col {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 170px;
      flex-shrink: 0;
    }
    .embossed-seal {
      width: 50px;
      height: 50px;
      border: 2px solid #0F172A;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .seal-inner {
      border: 1px dashed #0F172A;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-size: 7px;
      font-weight: 900;
      line-height: 1;
    }
    .seal-sub { font-size: 4.5px; font-weight: 700; }
    .final-score-box {
      border: 2px solid #0F172A;
      padding: 4px 6px;
      border-radius: 4px;
      background: #FFFFFF;
      text-align: center;
    }
    .fs-lbl { display: block; font-size: 7px; font-weight: 800; color: #475569; }
    .fs-val { display: block; font-size: 11px; font-weight: 900; color: #0F172A; }

    @media print {
      .page-break-before {
        page-break-before: always !important;
      }
    }

    /* Cutouts */
    .cutout-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .cutout-card {
      border: 1.5px dashed #9CA3AF;
      border-radius: 8px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      break-inside: avoid;
    }
    .card-side { padding: 6px; border-radius: 4px; background: #F9FAFB; }
    .card-tag { font-size: 8px; font-weight: 800; color: #6B7280; }
    .card-main { font-size: 12px; font-weight: 700; margin: 4px 0; }
    .card-mnemonic { font-size: 10px; color: #B45309; }

    /* No-print controls when viewed in browser */
    @media screen {
      body {
        max-width: 900px;
        margin: 20px auto;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        border-radius: 12px;
      }
      .screen-controls {
        position: sticky;
        top: 0;
        background: #111827;
        color: white;
        padding: 10px 16px;
        border-radius: 8px;
        margin-bottom: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        z-index: 100;
      }
      .print-btn {
        background: #10B981;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: bold;
        cursor: pointer;
      }
    }
    @media print {
      .screen-controls { display: none !important; }
      body { padding: 0; margin: 0; }
    }
  </style>
</head>
<body>
  <div class="screen-controls">
    <div><strong>StudyOS Printable Study Kit Preview</strong> (Press button or Ctrl+P / ⌘+P to Print / Save as PDF)</div>
    <button class="print-btn" onclick="window.print()">🖨️ Print / Save to PDF</button>
  </div>
  ${bodyContent}
</body>
</html>
  `.trim();
}

/**
 * Opens printable document directly in a new window and triggers print dialog.
 */
export function openStudyKitPrintWindow(
  options: StudyKitExportOptions,
  data: {
    subjects: Subject[];
    flashcardDecks: FlashcardDeck[];
    plans: StudyPlan[];
    userProfile: UserProfile | null;
    revisions: RevisionItem[];
  }
) {
  const html = generatePrintableStudyKitHtml(options, data);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * 1-Click direct launcher for Official SBBM Examination Answer Sheet with Target Stamps.
 */
export function openSbbmAnswerSheetPrintWindow(
  subjectName: string,
  userProfile: UserProfile | null,
  subjects: Subject[] = []
) {
  openStudyKitPrintWindow(
    {
      format: 'sbbm_answer_sheet',
      selectedSubjectNames: [subjectName],
      includeFormulas: true,
      includeMnemonics: true,
      includeFlashcards: false,
      includeExams: true,
      columns: 2,
      fontSize: 'standard',
      title: 'Sindh Board Official Exam Answer Sheet',
      notes: 'Authentic physical answer sheet with target rubber stamps and structured question dossiers.'
    },
    {
      subjects,
      flashcardDecks: [],
      plans: [],
      userProfile,
      revisions: []
    }
  );
}
