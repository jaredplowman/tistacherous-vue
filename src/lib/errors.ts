export function errorMessage(error: unknown): string {
  const code = (error as { code?: string }).code
  if (code === 'permission-denied') return "You don't have permission to do that."
  if (code === 'unavailable') return "Couldn't reach the server. Check your connection and try again."
  return error instanceof Error ? error.message : 'Something went wrong.'
}
