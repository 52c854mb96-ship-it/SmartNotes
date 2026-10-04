import { CloudOff } from 'lucide-react';
import { useOnline } from '../lib/connectivity';

export function OfflineBanner() {
  const { online, reason } = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <CloudOff size={16} aria-hidden />
      <span>
        {reason === 'server'
          ? 'Får ikke kontakt med serveren – du kan lese alle notater, og nye opplastinger sendes når forbindelsen er tilbake.'
          : 'Du er offline – du kan lese alle notater, og nye opplastinger konverteres når du er på nett igjen.'}
      </span>
    </div>
  );
}
