import { describe, it, expect } from 'vitest'
import { assertProductionConfig } from '../scripts/check-production-config.mjs'

describe('production development-bypass guard', () => {
  it('rejects top-level, named-environment and build-environment bypass flags', () => {
    expect(() => assertProductionConfig({ vars: { STUDY_DEV_NO_AUTH: '1' } }, {})).toThrow()
    expect(() => assertProductionConfig({ env: { production: { vars: { STUDY_DEV_NO_AUTH: '1' } } } }, {})).toThrow()
    expect(() => assertProductionConfig({}, { STUDY_DEV_NO_AUTH: '1' })).toThrow()
    expect(() => assertProductionConfig({ vars: {} }, {})).not.toThrow()
  })
})
