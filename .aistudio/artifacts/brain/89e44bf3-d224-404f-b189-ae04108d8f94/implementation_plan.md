# Official Board Exam Timed Mock Simulator & Marking Scheme Rubrics Station

Architectural and UX blueprint for delivering an **Official Board Exam Timed Mock Simulator & Marking Scheme Station**, enabling students to sit authentic timed past-paper simulations (Sections A, B, and C) and grade their scripts against official examiner step-marking rubrics.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following directions guide this implementation based on academic mastery principles and the skipped clarifying questions:

- **Confirmed Decision 1 (Core Focus)**: Build the **Board Exam Timed Mock Simulator & Marking Scheme Rubrics Station**. Provides realistic examination conditions (Section A: MCQs with pacing timers, Section B: Short Conceptual Questions with point-by-point criteria, Section C: Long Problems / Numericals with step allocations).
- **Confirmed Decision 2 (Grading & Error Extraction)**: Integrate the **Official Marking Scheme Rubric Studio**. Students grade their completed scripts against official board rubrics (formula mark, substitution mark, SI unit penalty), and any deducted marks can be automatically injected into the **Mistake Vault** with one click.
- **Confirmed Decision 3 (Printable Documentation)**: Include a **Printable A4 Official Examination Scorecard & Cover Docket** with candidate details, marks breakdown across taxonomy (Knowledge / Understanding / Application), and examiner notes.
- **Data Persistence**: Local-first with custom event dispatching (`study_mock_exams_updated`) and cloud sync parity, preserving mock exam histories and auto-updating student readiness indices.

---

## 1. Overview & Core Concept

### Board Exam Timed Mock Simulator
Students preparing for board exams often understand textbook theory but struggle with time management, question selection under pressure, and understanding how examiners allocate step-marks. The **Timed Mock Simulator** creates an authentic examination hall environment:
- **Authentic Section Structure**:
  - **Section A (Objective MCQs)**: 15–20% of marks, enforced speed pacing, automated answer key evaluation.
  - **Section B (Short Descriptive & Conceptual)**: Choice rules (e.g. "Attempt any 8 out of 11 questions"), point-by-point answer structures.
  - **Section C (Extensive Problems & Numericals)**: Multi-part problems requiring structured working: Formula, Given Data, Calculation with SI units, Final Result with significant figures.
- **Live Exam Pacer & Question Matrix**: Visual navigation grid showing status (Answered, Flagged for Review, Unattempted) with time alerts.
- **Auto-Save & Emergency Recovery**: Resilient against accidental page refreshes or tab switches.

### Step-by-Step Marking Scheme Rubrics Station
- **Detailed Step Allocation**: Breaks each question into official examiner points (e.g., `[1 Mark]` Formula statement, `[1 Mark]` Unit conversion, `[1 Mark]` Correct calculation).
- **Penalty Checklist**: Explicit checkboxes for common examiner deductions ($-0.5$ missing unit, $-1.0$ arithmetic slip, $-0.5$ missing diagram label).
- **1-Click Mistake Vault Ingestion**: Every error detected during grading can be saved directly to the student's Mistake Vault with assigned cognitive failure category and spaced revision trigger.

---

## 2. User Experience & Visual Design

### Key User Flows

#### Flow A: Launching and Sitting a Mock Exam
1. **Entry Points**: Accessible from **Dashboard ("Workstation > Exam & Syllabus")**, **Tests View**, **Calendar Day Drawer**, **Navbar Tools**, and **Command Palette (`Cmd + K`)**.
2. **Pre-Exam Docket**: Displays candidate instructions, allowed stationery, time duration (e.g. 120 mins), total marks, and paper code.
3. **Active Exam Simulation**:
   - Split view: Question paper on left/center, answer drafting area and question navigator palette on right.
   - Pacing indicator: Shows whether the student is ahead or behind target pace for that section.
   - Option to flag questions for final 10-minute check.
4. **Submission**: Automatic countdown submission or manual review submission with confidence rating.

#### Flow B: Rubric-Based Marking & Mistake Vault Sync
1. **Grading Workspace**: Side-by-side view of the student's attempted answer and the official step marking scheme.
2. **Step Allocation Checkbox**: Student toggles marks awarded per step (e.g., `+1 Formula`, `+1 Calculation`, `0 Final Answer`).
3. **Deductions & Traps**: Highlights exact examiner traps that caused point deductions.
4. **Summary & Export**: Generates grade percentage, letter grade, and option to print the clean A4 Scorecard or export to PDF.

### Visual Identity & Theme Tokens
Adheres strictly to the **Frontend Design Constitution** (Zero-Pill discipline, clean academic palette, typographic hierarchy):
- **Aesthetic Direction**: Academic Editorial / Examination Archival. Deep slate (`#1E293B`), parchment card surface (`#F9F7F2`), subtle hairline borders (`#E2E8F0`), muted olive (`#6B705C`).
- **Timing & Urgency Accents**: Crimson Amber (`#DC2626` / `#D97706`) reserved strictly for final 10-minute warning and mark deductions.
- **Typography**: Clean serif display headings (`font-serif font-bold text-slate-900`), tabular monospace for countdowns, question numbers, and step marks (`font-mono tabular-nums`).
- **Zero-Pill Discipline**: Metadata rendered as clean unboxed inline text with typographic separators (`·`, `/`). Interactive filter controls and question palette buttons rendered as clean grid squares with numerical indices.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Section-Based Timing vs Single Global Clock**:
  - *Chosen Approach*: Dual clock display showing total exam remaining time alongside section target pace recommendations (e.g. "Section A Target: 25m · Section B Target: 50m").
  - *Why*: Teaches students pacing discipline so they do not exhaust all their time on initial short questions.
- **Decision 2: Automated MCQ Evaluation + Self-Rubric for Descriptive**:
  - *Chosen Approach*: Hybrid grading engine. Objective MCQs are auto-evaluated instantly upon completion, while Sections B & C open into the interactive step-by-step marking scheme rubrics station.
  - *Why*: Board exams require qualitative step-marking (showing working, unit checks) which cannot be reduced to simple boolean flags without obscuring real examiner behavior.
- **Decision 3: Dedicated A4 Print Stylesheet (`@media print`)**:
  - *Chosen Approach*: Clean black-and-white print layout for the official examination scorecard and marking audit trail.
  - *Why*: Allows students to review their marked papers with parents, tutors, or mentors offline.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ACADEMIC MASTERY SYSTEM                         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴─────────────────────────┐
          ▼                                                   ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│     MOCK EXAM ENGINE              │       │     MARKING RUBRIC STATION        │
│   (mockExamService.ts)            │       │   (markingRubricService.ts)       │
├───────────────────────────────────┤       ├───────────────────────────────────┤
│ • Section A/B/C question catalog  │       │ • Official step marking rubrics   │
│ • Pacing tracker & clock timers   │       │ • Examiner deduction penalty tags │
│ • State recovery (localStorage)   │       │ • Scorecard calculation math      │
│ • Answer draft serialization      │       │ • 1-click Mistake Vault ingestion │
└─────────────────┬─────────────────┘       └─────────────────┬─────────────────┘
                  │                                           │
                  ▼                                           ▼
┌───────────────────────────────────┐       ┌───────────────────────────────────┐
│       MockExamSimulatorModal      │──────>│      MarkingSchemeRubricModal     │
│       & ActiveExamStation         │       │      & PrintableScorecard         │
└─────────────────┬─────────────────┘       └─────────────────┬─────────────────┘
                  │                                           │
                  └─────────────────────┬─────────────────────┘
                                        ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED APPLICATION DATA STORES                     │
│    (MockExamRecord, MistakeEntry, TestResult, UserProfile, DB)         │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Structures & State Extensions

```typescript
export interface MockExamSectionQuestion {
  id: string;
  questionNumber: number;
  section: 'A' | 'B' | 'C';
  title: string;
  questionText: string;
  totalMarks: number;
  options?: string[]; // For Section A MCQs
  correctOptionIndex?: number;
  rubricSteps: Array<{
    id: string;
    description: string;
    marks: number;
    examinerNote?: string;
  }>;
  commonDeductions: Array<{
    id: string;
    description: string;
    penalty: number;
  }>;
}

export interface MockExamPaper {
  id: string;
  subjectName: string;
  paperCode: string;
  title: string;
  totalDurationMinutes: number;
  totalMarks: number;
  sections: {
    sectionA: { title: string; targetMinutes: number; questions: MockExamSectionQuestion[] };
    sectionB: { title: string; targetMinutes: number; requiredCount: number; questions: MockExamSectionQuestion[] };
    sectionC: { title: string; targetMinutes: number; requiredCount: number; questions: MockExamSectionQuestion[] };
  };
}

export interface MockExamAttemptRecord {
  id: string;
  paperId: string;
  subjectName: string;
  paperTitle: string;
  startedAt: string;
  completedAt: string;
  durationSecondsSpent: number;
  answers: Record<string, string>; // questionId -> student answer
  gradedSteps: Record<string, boolean>; // stepId -> awarded
  deductionsApplied: Record<string, boolean>; // deductionId -> applied
  totalMarksScored: number;
  totalPossibleMarks: number;
  percentage: number;
  letterGrade: string;
}
```

### Component & State Mutation Flow

1. **`mockExamService.ts`**:
   - Provides standardized past-paper templates for Physics, Chemistry, Biology, Mathematics, and Computer Science.
   - Manages persistence of completed attempts in `study_mock_exams_v1` and auto-notifies listeners.
2. **`MockExamSimulatorModal.tsx`**:
   - Full-screen examination workstation with ambient focus mode.
   - Pacing meter, section switcher, and question answer sheet.
3. **`MarkingSchemeRubricModal.tsx`**:
   - Post-exam step-marking station with formula checks, unit penalties, and Mistake Vault integration.
4. **Integration across Dashboard, Calendar, and Navigation**:
   - Direct button in **Dashboard Workstation ("Exam & Syllabus")**.
   - Calendar Day View integration for scheduled mock exams.
   - Quick launch in **Command Palette (`Cmd + K`)** and **Navbar Tools**.
