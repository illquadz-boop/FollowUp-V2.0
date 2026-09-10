import { proxyBackend } from '@/lib/backend-proxy';
export const dynamic = 'force-dynamic';
async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  return proxyBackend(request, (await context.params).path);
}
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
