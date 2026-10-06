// Lastes inn i service workeren (importScripts i vite.config.ts). Siden kan be en ventende service worker ta over
// (se src/lib/pwa.ts). skipWaiting() kalles allerede når den installeres, men nettleseren utsetter byttet så lenge den
// gamle er opptatt, og Safari kan la den nye bli stående og vente til alle faner er lukket. Et nytt kall prøver på nytt.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
