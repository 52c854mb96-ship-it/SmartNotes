import { RefreshCw } from 'lucide-react';
import { useActivityCounts } from '../data';
import { useOnline } from '../lib/connectivity';
import { formatTimestamp } from '../lib/format';
import { syncNow, useSyncState } from '../sync';

export function SyncStatus() {
  const { online, reason } = useOnline();
  const sync = useSyncState();
  const counts = useActivityCounts();

  let main: string;
  if (!online) {
    main = reason === 'server' ? 'Ingen kontakt med serveren' : 'Offline';
  } else if (sync.running && !sync.lastSyncAt) {
    main = 'Synkroniserer …';
  } else if (sync.lastSyncAt) {
    main = `Synkronisert ${formatTimestamp(sync.lastSyncAt)}`;
  } else {
    main = 'På nett';
  }

  const details: string[] = [];
  if (counts?.outbox) details.push(`${counts.outbox} i kø`);
  if (counts?.converting) details.push(`Konverterer ${counts.converting}`);
  if (sync.prefetch) details.push(`Laster ned PDF ${sync.prefetch.done + 1}/${sync.prefetch.total}`);
  if (!online && sync.lastSyncAt) details.push(`Sist synkronisert ${formatTimestamp(sync.lastSyncAt)}`);

  return (
    <div className="sync-status" aria-live="polite">
      <span className={`status-dot ${online ? 'is-online' : 'is-offline'}`} aria-hidden />
      <div className="sync-text">
        <span className="sync-main">{main}</span>
        {details.length > 0 && <span className="sync-details">{details.join(' · ')}</span>}
        {online && sync.lastError && !sync.running && <span className="sync-error">{sync.lastError}</span>}
      </div>
      <button
        type="button"
        className="icon-btn icon-btn-sm"
        onClick={() => void syncNow()}
        disabled={!online || sync.running}
        aria-label="Synkroniser nå"
        title="Synkroniser nå"
      >
        <RefreshCw size={16} aria-hidden className={sync.running ? 'spin' : undefined} />
      </button>
    </div>
  );
}
