import React, { useState, useEffect } from 'react';
import { Smartphone, RefreshCw, Check, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { getPairedDeviceStatus, PairedDeviceStatus, disconnectPairedDevice } from '../lib/deviceTransferEngine';

interface ConnectionStatusPillProps {
  onOpenConnectModal: () => void;
  onSyncNow?: () => Promise<void> | void;
  isSyncing?: boolean;
}

export const ConnectionStatusPill: React.FC<ConnectionStatusPillProps> = ({
  onOpenConnectModal,
  onSyncNow,
  isSyncing = false
}) => {
  const [deviceStatus, setDeviceStatus] = useState<PairedDeviceStatus>(() => getPairedDeviceStatus());
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleDeviceChanged = (e: any) => {
      if (e.detail) {
        setDeviceStatus(e.detail);
      } else {
        setDeviceStatus(getPairedDeviceStatus());
      }
    };
    window.addEventListener('prepforge:device_pairing_changed', handleDeviceChanged);
    return () => window.removeEventListener('prepforge:device_pairing_changed', handleDeviceChanged);
  }, []);

  const handleDisconnect = (e: React.MouseEvent) => {
    e.stopPropagation();
    disconnectPairedDevice();
    setShowDropdown(false);
  };

  if (!deviceStatus.isConnected) {
    return (
      <button
        onClick={onOpenConnectModal}
        className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-theme-accent hover:opacity-85 text-primary border border-theme text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95 shrink-0"
        title="Connect and pair another device (iPad, laptop, browser)"
      >
        <span className="w-2 h-2 rounded-full bg-stone-400" />
        <span className="text-[11px] text-muted">NOT CONNECTED</span>
        <span className="text-[11px] text-primary underline ml-0.5">Connect</span>
      </button>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer shadow-2xs"
        title={`Connected to ${deviceStatus.deviceName} • Last sync: ${deviceStatus.lastSyncFormatted}`}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 hidden xs:inline">
          CONNECTED
        </span>
        <span className="text-[11px] font-bold text-primary truncate max-w-[90px] sm:max-w-[120px]">
          {deviceStatus.deviceName}
        </span>
        {deviceStatus.pendingChangesCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[9px] font-bold">
            {deviceStatus.pendingChangesCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {showDropdown && (
        <div 
          className="absolute right-0 mt-2 w-64 p-4 rounded-2xl bg-theme-card border border-theme shadow-xl z-50 animate-fade-in text-xs space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-theme pb-2">
            <span className="font-bold text-primary">Device Connection</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
              Active
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-muted text-[11px]">Paired Device:</div>
            <div className="font-bold text-primary text-sm">{deviceStatus.deviceName}</div>
            <div className="text-muted text-[11px] pt-1">
              Last sync: <span className="font-mono text-primary font-medium">{deviceStatus.lastSyncFormatted || 'Recently'}</span>
            </div>
            {deviceStatus.pendingChangesCount > 0 && (
              <div className="text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                Changes waiting: {deviceStatus.pendingChangesCount}
              </div>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-1.5 border-t border-theme">
            {onSyncNow && (
              <button
                onClick={async () => {
                  setShowDropdown(false);
                  await onSyncNow();
                }}
                disabled={isSyncing}
                className="w-full py-1.5 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:opacity-90 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}

            <button
              onClick={() => {
                setShowDropdown(false);
                onOpenConnectModal();
              }}
              className="w-full py-1.5 px-3 rounded-xl border border-theme bg-theme-surface hover:bg-stone-200 dark:hover:bg-stone-800 text-primary text-xs font-semibold transition cursor-pointer text-center"
            >
              Transfer Data & QR Hub
            </button>

            <button
              onClick={handleDisconnect}
              className="w-full py-1 px-3 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-medium transition cursor-pointer text-center"
            >
              Disconnect This Device
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
