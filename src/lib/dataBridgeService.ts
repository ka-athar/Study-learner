// Universal Master Study Data Bridge
// Transfers and links study sessions, subjects, syllabus progress, revisions, and notes
// seamlessly between external browser screens and the AI Studio builder app.

import { Subject, StudySession, StudyPlan, RevisionItem, UserProfile, UserNote } from '../types';

export interface MasterStudyDataset {
  subjects?: Subject[];
  sessions?: StudySession[];
  plans?: StudyPlan[];
  revisions?: RevisionItem[];
  mistakes?: any[];
  notes?: UserNote[];
  userProfile?: UserProfile | null;
  timestamp?: string;
  sourceScreen?: string;
}

export interface MasterBridgeStatus {
  isLinked: boolean;
  lastSyncedAt: string | null;
  syncedBy: string | null;
  sessionsCount: number;
  subjectsCount: number;
  isSyncing: boolean;
  message?: string;
}

const BRIDGE_STORAGE_KEY = 'studyflow_master_bridge_metadata';

export function getLocalBridgeMetadata(): { lastSyncedAt: string | null; syncedBy: string | null } {
  try {
    const raw = localStorage.getItem(BRIDGE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { lastSyncedAt: null, syncedBy: null };
  } catch {
    return { lastSyncedAt: null, syncedBy: null };
  }
}

/**
 * Push complete study dataset to the server master bridge
 */
export async function pushMasterDataToBridge(dataset: MasterStudyDataset): Promise<{ success: boolean; message: string; updatedAt?: string }> {
  try {
    const sourceScreen = window.top === window ? 'External Browser Screen' : 'Builder App Preview';
    const payload = {
      data: {
        ...dataset,
        timestamp: new Date().toISOString(),
        sourceScreen
      },
      sourceDeviceId: sessionStorage.getItem('studyflow_timer_client_id') || `client_${Date.now()}`,
      sourceDeviceName: sourceScreen
    };

    const res = await fetch('/api/sync/master-bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      localStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify({
        lastSyncedAt: data.updatedAt || new Date().toISOString(),
        syncedBy: sourceScreen
      }));
      window.dispatchEvent(new CustomEvent('studyplanner:data-bridge-updated', {
        detail: {
          lastSyncedAt: data.updatedAt,
          syncedBy: sourceScreen,
          success: true
        }
      }));
    }
    return data;
  } catch (err: any) {
    console.error('Failed to push master data to bridge:', err);
    return { success: false, message: err.message || 'Network sync failed' };
  }
}

/**
 * Pull latest master study dataset from the server bridge
 */
export async function pullMasterDataFromBridge(): Promise<{ success: boolean; hasData: boolean; data?: MasterStudyDataset; updatedAt?: string; message?: string }> {
  try {
    const res = await fetch('/api/sync/master-bridge');
    if (!res.ok) {
      return { success: false, hasData: false, message: 'Server error' };
    }
    const json = await res.json();
    return json;
  } catch (err: any) {
    console.error('Failed to pull master data from bridge:', err);
    return { success: false, hasData: false, message: err.message };
  }
}

// Global auto-sync debouncer
let autoSyncTimeout: any = null;

export function scheduleAutoDataBridgePush(getDataset: () => MasterStudyDataset, delayMs: number = 3000) {
  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }
  autoSyncTimeout = setTimeout(async () => {
    try {
      const data = getDataset();
      if (data && (data.sessions?.length || data.subjects?.length)) {
        await pushMasterDataToBridge(data);
      }
    } catch (e) {
      console.warn('Auto data bridge push skipped:', e);
    }
  }, delayMs);
}
