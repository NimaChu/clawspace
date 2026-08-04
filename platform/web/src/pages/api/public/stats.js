import { getPublishedApps } from '../../../lib/app-registry.js';
import { getCreators } from '../../../lib/creator-universe.js';
import { getRecordedPlayerCount } from '../../../lib/game-scores.js';

const PLAYER_COUNT_BASELINE = 100;

export async function GET() {
  const [apps, creators, recordedPlayers] = await Promise.all([
    getPublishedApps(),
    getCreators(),
    getRecordedPlayerCount(),
  ]);

  return new Response(
    JSON.stringify({
      items: {
        publishedApps: apps.length,
        creators: creators.length,
        recordedPlayers,
        displayPlayers: PLAYER_COUNT_BASELINE + recordedPlayers,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
