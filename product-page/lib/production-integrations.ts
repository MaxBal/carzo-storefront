/** Legacy credentials may refer to working services even in a local production build. */
export function isVercelProduction(env: Record<string, string | undefined> = process.env): boolean {
  return env.VERCEL_ENV === 'production';
}
