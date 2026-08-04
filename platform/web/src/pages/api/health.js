import { objectStorage } from '../../lib/object-storage.js';

export async function GET() {
  return Response.json(
    {
      ok: true,
      timestamp: new Date().toISOString(),
      runtime: {
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        objectStorageConfigured: objectStorage.isRemote(),
        githubOAuthConfigured: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
        dashscopeConfigured: Boolean(process.env.DASHSCOPE_API_KEY),
      },
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}
