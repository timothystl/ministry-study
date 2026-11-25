import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

export function assertProductionConfig(configuration, environment = process.env) {
  const flags = [environment.STUDY_DEV_NO_AUTH, configuration.vars?.STUDY_DEV_NO_AUTH,
    ...Object.values(configuration.env || {}).map(value => value.vars?.STUDY_DEV_NO_AUTH)]
  if (flags.some(value => String(value) === '1')) throw Error('Production builds cannot enable development authentication bypass')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const parsed = ts.parseConfigFileTextToJson('wrangler.jsonc', readFileSync('wrangler.jsonc', 'utf8'))
  if (parsed.error) throw Error('Invalid Worker configuration')
  assertProductionConfig(parsed.config)
}
