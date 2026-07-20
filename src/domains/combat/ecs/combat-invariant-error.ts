export class CombatInvariantError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CombatInvariantError'
  }
}
