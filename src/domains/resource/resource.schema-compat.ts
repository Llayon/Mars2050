export function isMissingResourceCapacityError(error: unknown): boolean {
  const message = typeof error === 'object' && error && 'message' in error
    ? String((error as { message?: unknown }).message)
    : String(error)

  return message.includes("'capacity' column")
    || message.includes('resources.capacity')
    || message.includes('column "capacity"')
}
