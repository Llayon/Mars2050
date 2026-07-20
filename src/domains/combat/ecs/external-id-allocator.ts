import { CombatInvariantError } from './combat-invariant-error'

export class ExternalIdAllocator {
  private readonly reserved = new Set<string>()
  private readonly nextByNamespace = new Map<string, number>()

  reserve(externalId: string): void {
    if (externalId.length === 0) throw new CombatInvariantError('External entity id cannot be empty')
    if (this.reserved.has(externalId)) {
      throw new CombatInvariantError(`Duplicate external entity id: ${externalId}`)
    }
    this.reserved.add(externalId)
  }

  allocate(namespace: string): string {
    let counter = this.nextByNamespace.get(namespace) ?? 0
    let candidate = `${namespace}_${counter}`
    while (this.reserved.has(candidate)) {
      counter++
      candidate = `${namespace}_${counter}`
    }
    this.nextByNamespace.set(namespace, counter + 1)
    return candidate
  }

  prefer(externalId: string): string {
    return this.reserved.has(externalId) ? this.allocate(externalId) : externalId
  }

  isReserved(externalId: string): boolean {
    return this.reserved.has(externalId)
  }
}
