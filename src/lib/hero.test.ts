import { describe, expect, it } from 'vitest'
import { HERO_IMAGES, HERO_QUOTES, pickIndex } from './hero'

describe('hero rotation', () => {
  it('never repeats the previous pick', () => {
    for (let last = 0; last < 5; last++) {
      for (let n = 0; n < 200; n++) {
        expect(pickIndex(5, last, () => n / 200)).not.toBe(last)
      }
    }
  })
  it('stays in range', () => {
    expect(pickIndex(1, 0)).toBe(0)
    expect(pickIndex(3, null, () => 0.999)).toBe(2)
  })
  it('has plenty to rotate through', () => {
    expect(HERO_IMAGES.length).toBeGreaterThan(10)
    expect(HERO_QUOTES.length).toBeGreaterThan(10)
  })
})
