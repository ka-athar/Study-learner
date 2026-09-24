import { Subject, MistakeEntry, CognitiveTopicHealth } from '../types';
import { getStoredMistakes } from './mistakeVaultStorage';

const RETENTION_SNAPSHOT_KEY = 'prepforge_cognitive_health_cache_v1';

/**
 * Calculates Ebbinghaus retention percentage using exponential decay:
 * R = e^(-t / S)
 * where t = days since review, S = stability in days.
 * S starts around 1.5 days for a new concept, and increases as consecutive passes / reviews accumulate.
 */
export function calculateEbbinghausRetention(daysSince: number, stabilityDays: number = 3): number {
  if (daysSince <= 0) return 100;
  const decay = Math.exp(-daysSince / Math.max(1, stabilityDays));
  return Math.min(100, Math.max(5, Math.round(decay * 100)));
}

/**
 * Aggregates all topics across subjects, merging data from:
 * 1. Mistake Vault (mistakes count, categories, cure progress)
 * 2. Blurt Active Recall sessions
 * 3. Mock Exam scores
 */
export function buildCognitiveHealthGraph(subjects: Subject[]): CognitiveTopicHealth[] {
  const mistakes = getStoredMistakes();
  
  // Read any stored blurt and mock review logs from localStorage
  let blurtLogs: Record<string, { lastScore: number; lastDate: string; passes: number; missingCount: number }> = {};
  try {
    const rawBlurt = localStorage.getItem('prepforge_blurt_topic_history');
    if (rawBlurt) blurtLogs = JSON.parse(rawBlurt);
  } catch (e) {
    // ignore
  }

  let mockLogs: Record<string, { lastScore: number; lastDate: string }> = {};
  try {
    const rawMock = localStorage.getItem('prepforge_mock_topic_performance');
    if (rawMock) mockLogs = JSON.parse(rawMock);
  } catch (e) {
    // ignore
  }

  const result: CognitiveTopicHealth[] = [];
  const now = Date.now();

  subjects.forEach(sub => {
    (sub.chapters || []).forEach(chap => {
      (chap.topics || []).forEach(top => {
        const topName = top.name || (top as any).title || 'Core Topic';
        const chapName = chap.name || (chap as any).title || 'General';
        const topicKey = `${sub.name}::${topName}`;
        
        // Find matching mistakes
        const topicMistakes = mistakes.filter(m => 
          m.subjectName.toLowerCase() === sub.name.toLowerCase() &&
          (m.topicName || '').toLowerCase().includes(topName.toLowerCase())
        );

        const uncuredMistakes = topicMistakes.filter(m => m.cureStatus !== 'cured');
        const bLog = blurtLogs[topicKey];
        const mLog = mockLogs[topicKey];

        // Determine last review date
        let latestDateStr = top.lastStudiedAt || (sub as any).lastReviewed || (chap as any).lastStudied || new Date(now - 86400000 * 5).toISOString();
        if (bLog?.lastDate && new Date(bLog.lastDate).getTime() > new Date(latestDateStr).getTime()) {
          latestDateStr = bLog.lastDate;
        }
        if (mLog?.lastDate && new Date(mLog.lastDate).getTime() > new Date(latestDateStr).getTime()) {
          latestDateStr = mLog.lastDate;
        }

        const daysSince = Math.max(0, Math.round((now - new Date(latestDateStr).getTime()) / 86400000));
        
        // Base stability increases with consecutive passes, decreases with uncured mistakes
        const isMastered = top.status === 'Mastered';
        const isCompleted = top.status === 'Completed';
        const passes = (bLog?.passes || 0) + (isMastered ? 2 : isCompleted ? 1 : 0);
        let stabilityDays = 2 + passes * 2;
        if (uncuredMistakes.length > 0) {
          stabilityDays = Math.max(1, stabilityDays - uncuredMistakes.length * 0.8);
        }

        const retention = calculateEbbinghausRetention(daysSince, stabilityDays);

        let riskLevel: 'safe' | 'decaying' | 'critical_decay' = 'safe';
        if (retention < 50 || uncuredMistakes.length >= 2) {
          riskLevel = 'critical_decay';
        } else if (retention < 75 || daysSince >= 4) {
          riskLevel = 'decaying';
        }

        const nextDate = new Date(now + Math.max(1, Math.round(stabilityDays * 0.7)) * 86400000).toISOString();

        result.push({
          topicKey,
          subjectName: sub.name,
          chapterName: chapName,
          topicName: topName,
          retentionPercent: retention,
          stabilityDays,
          lastReviewedDate: latestDateStr,
          daysSinceReview: daysSince,
          riskLevel,
          totalLoggedMistakes: uncuredMistakes.length,
          lastBlurtScore: bLog?.lastScore,
          lastMockScore: mLog?.lastScore,
          consecutiveRecallPasses: passes,
          nextRecommendedReviewDate: nextDate,
          missedEssentialsCount: uncuredMistakes.length + (bLog?.missingCount || 0)
        });
      });
    });
  });

  return result;
}

/**
 * Record a recall or drill outcome for Ebbinghaus retention tracking
 */
export function recordTopicRecallOutcome(
  subjectName: string,
  topicName: string,
  score: number,
  missingCount: number = 0
) {
  try {
    const topicKey = `${subjectName}::${topicName}`;
    const raw = localStorage.getItem('prepforge_blurt_topic_history') || '{}';
    const parsed = JSON.parse(raw);
    const prev = parsed[topicKey] || { passes: 0 };
    parsed[topicKey] = {
      lastScore: score,
      lastDate: new Date().toISOString(),
      passes: score >= 75 ? (prev.passes || 0) + 1 : Math.max(0, (prev.passes || 0) - 1),
      missingCount
    };
    localStorage.setItem('prepforge_blurt_topic_history', JSON.stringify(parsed));
  } catch (e) {
    console.error('Failed to save topic recall outcome:', e);
  }
}

/**
 * Record a mock exam score for a topic
 */
export function recordMockTopicScore(subjectName: string, topicName: string, score: number) {
  try {
    const topicKey = `${subjectName}::${topicName}`;
    const raw = localStorage.getItem('prepforge_mock_topic_performance') || '{}';
    const parsed = JSON.parse(raw);
    parsed[topicKey] = {
      lastScore: score,
      lastDate: new Date().toISOString()
    };
    localStorage.setItem('prepforge_mock_topic_performance', JSON.stringify(parsed));
  } catch (e) {
    console.error('Failed to save mock topic score:', e);
  }
}
