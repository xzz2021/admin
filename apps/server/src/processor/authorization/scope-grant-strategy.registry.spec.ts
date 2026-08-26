import { ScopeGrantStrategyRegistry } from './scope-grant-strategy.registry'

describe('ScopeGrantStrategyRegistry', () => {
  const registry = ScopeGrantStrategyRegistry.createDefault()

  it('normalizes SELF and sorted unique DEPARTMENT grants through registered strategies', () => {
    expect(
      registry.normalize([
        { type: 'DEPARTMENT', ids: ['dept-b', 'dept-a', 'dept-a'] },
        { type: 'SELF' },
        { type: 'DEPARTMENT', ids: ['dept-c', 'dept-b'] },
        { type: 'SELF' },
      ]),
    ).toEqual([{ type: 'SELF' }, { type: 'DEPARTMENT', ids: ['dept-a', 'dept-b', 'dept-c'] }])
  })

  it('freezes grants through the owning strategy', () => {
    const frozen = registry.freeze({ type: 'DEPARTMENT', ids: ['dept-a'] })

    expect(Object.isFrozen(frozen)).toBe(true)
    expect(frozen.type).toBe('DEPARTMENT')
    if (frozen.type === 'DEPARTMENT') expect(Object.isFrozen(frozen.ids)).toBe(true)
  })

  it.each([
    [{ type: 'SELF' }, true],
    [{ type: 'SELF', ids: [] }, false],
    [{ type: 'DEPARTMENT', ids: ['dept-a', 'dept-b'] }, true],
    [{ type: 'DEPARTMENT', ids: [] }, false],
    [{ type: 'DEPARTMENT', ids: ['dept-b', 'dept-a'] }, false],
    [{ type: 'DEPARTMENT', ids: ['dept-a', 'dept-a'] }, false],
    [{ type: 'DEPARTMENT', ids: [''] }, false],
    [{ type: 'UNKNOWN' }, false],
  ])('validates serialized grant %p as %p', (value, expected) => {
    expect(registry.validate(value)).toBe(expected)
  })
})
