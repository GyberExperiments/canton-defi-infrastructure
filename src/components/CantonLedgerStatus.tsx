'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LedgerStatus {
  mode: string;
  connected: boolean;
  participant: string | null;
  ledgerEnd: string | null;
  applicationId: string | null;
  sdkVersion: string | null;
  source: string;
}

/**
 * CantonLedgerStatus — compact widget showing real-time DAML ledger
 * connection status. Sits above the exchange form on the landing page.
 *
 * Displays:
 * - Connection mode (daml-ledger-api / http-json-api / offline)
 * - Green/yellow/red indicator dot
 * - Participant endpoint (truncated)
 * - SDK version when available
 */
export default function CantonLedgerStatus() {
  const [status, setStatus] = useState<LedgerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/canton/status');
        if (res.ok && mounted) {
          setStatus(await res.json());
        }
      } catch {
        if (mounted) {
          setStatus({
            mode: 'offline',
            connected: false,
            participant: null,
            ledgerEnd: null,
            applicationId: null,
            sdkVersion: null,
            source: 'fetch-error',
          });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
        <div className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
        <span className="text-xs text-white/40 font-medium">Canton Ledger...</span>
      </div>
    );
  }

  if (!status) return null;

  const isConnected = status.connected;
  const isDamlMode = status.mode === 'daml-ledger-api';
  const isHttpMode = status.mode === 'http-json-api';

  // Color scheme based on status
  const dotColor = isConnected
    ? isDamlMode
      ? 'bg-emerald-400'
      : 'bg-amber-400'
    : 'bg-red-400';

  const borderColor = isConnected
    ? isDamlMode
      ? 'border-emerald-500/30'
      : 'border-amber-500/30'
    : 'border-red-500/30';

  const bgColor = isConnected
    ? isDamlMode
      ? 'from-emerald-500/10 to-cyan-500/5'
      : 'from-amber-500/10 to-orange-500/5'
    : 'from-red-500/10 to-rose-500/5';

  const modeLabel = isDamlMode
    ? 'DAML Ledger API'
    : isHttpMode
      ? 'HTTP JSON API'
      : 'Offline';

  const truncateParticipant = (url: string | null) => {
    if (!url) return 'N/A';
    try {
      const u = new URL(url);
      const host = u.hostname;
      if (host.length > 24) return host.slice(0, 12) + '...' + host.slice(-10);
      return host + (u.port ? ':' + u.port : '');
    } catch {
      if (url.length > 30) return url.slice(0, 15) + '...' + url.slice(-12);
      return url;
    }
  };

  return (
    <div className="inline-block">
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r ${bgColor} border ${borderColor} backdrop-blur-sm cursor-pointer hover:brightness-125 transition-all duration-200`}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Status dot */}
        <div className="relative">
          <div className={`w-2 h-2 rounded-full ${dotColor}`} />
          {isConnected && (
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${dotColor} animate-ping opacity-75`} />
          )}
        </div>

        {/* Mode label */}
        <span className="text-xs font-semibold text-white/80">
          {modeLabel}
        </span>

        {/* SDK version badge (only for DAML mode) */}
        {isDamlMode && status.sdkVersion && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
            v{status.sdkVersion}
          </span>
        )}

        {/* Expand indicator */}
        <svg
          className={`w-3 h-3 text-white/40 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </motion.button>

      {/* Expanded details panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-2 overflow-hidden"
          >
            <div className={`p-3 rounded-xl bg-gradient-to-br ${bgColor} border ${borderColor} backdrop-blur-xl text-xs space-y-1.5`}>
              <Row label="Status" value={isConnected ? 'Connected' : 'Disconnected'} />
              <Row label="Mode" value={modeLabel} />
              <Row label="Participant" value={truncateParticipant(status.participant)} mono />
              {status.ledgerEnd && <Row label="Ledger End" value={status.ledgerEnd} mono />}
              {status.applicationId && <Row label="App ID" value={status.applicationId} mono />}
              <Row label="Source" value={status.source} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/40">{label}</span>
      <span className={`text-white/70 ${mono ? 'font-mono' : ''} text-right`}>{value}</span>
    </div>
  );
}
