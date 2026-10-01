#!/usr/bin/env node
/**
 * Recursively walks rules/** and runs `kb-ingest validate` on every YAML.
 *
 * Used by both `npm run validate` (local) and the CI workflow. Exits
 * non-zero on the first failure so CI fails fast and the dev sees the
 * offending file immediately.
 *
 * The shared SQLite file (./tmp.db) is created once and re-used so that
 * registered tables/SPs from one rule file count as "known" when the
 * next file references them — matches the production ingest behavior.
 *
 * Después valida las notas de decisión del vault, los estándares técnicos
 * y que cada `decision:` citado por una regla o estándar exista.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync, rmSync, existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import yaml from 'js-yaml'
import {
  loadDecisions,
  DECISION_ID_PATTERN,
  DECISION_STATUSES,
  REQUIRED_SECTIONS,
  PENDING_MARKER,
} from '../plugin/decisions.mjs'
import {
  loadStandards,
  STANDARD_ID_PATTERN,
  STANDARD_LEVELS,
  STANDARD_STATUSES,
  STANDARD_REQUIRED,
} from '../plugin/standards.mjs'

const RULES_DIR = 'rules'
const DB = './tmp.db'
const DECISIONS_DIR = 'vault/decisiones'
const STANDARDS_DIR = 'standards'

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.yaml') || full.endsWith('.yml')) out.push(full)
  }
  return out
}

if (existsSync(DB)) rmSync(DB)

const init = spawnSync('npx', ['kb-ingest', 'init', '--db', DB], { stdio: 'inherit' })
if (init.status !== 0) process.exit(init.status ?? 1)

const files = existsSync(RULES_DIR) ? walk(RULES_DIR) : []
if (files.length === 0) {
  process.stderr.write(`[validate-all] no YAML files found under ${RULES_DIR}/\n`)
}

process.stderr.write(`[validate-all] validating ${files.length} file(s)\n`)

let failed = 0
for (const f of files) {
  process.stderr.write(`\n── ${f} ──\n`)
  const r = spawnSync(
    'npx',
    ['kb-ingest', 'validate', '--db', DB, '--file', f, '--auto-register'],
    { stdio: 'inherit' }
  )
  if (r.status !== 0) failed++
}

process.stderr.write(`\n── ${DECISIONS_DIR} ──\n`)
const decisions = loadDecisions(DECISIONS_DIR)
const decisionErrors = []
const decisionWarnings = []

for (const d of decisions.values()) {
  const fm = d.frontmatter
  const label = `${d.file}`
  if (!DECISION_ID_PATTERN.test(fm.id)) {
    decisionErrors.push(`${label}: id "${fm.id}" no cumple formato DEC-XXX-NNN`)
  }
  if (basename(d.file, '.md') !== fm.id) {
    decisionErrors.push(`${label}: el nombre del archivo debe ser ${fm.id}.md`)
  }
  if (!DECISION_STATUSES.has(fm.status)) {
    decisionErrors.push(`${label}: status "${fm.status}" no es válido (${[...DECISION_STATUSES].join(', ')})`)
  }
  if (fm.status === 'superseded' && !decisions.has(fm.superseded_by)) {
    decisionErrors.push(`${label}: status superseded requiere superseded_by apuntando a una decisión existente`)
  }
  for (const key of REQUIRED_SECTIONS) {
    if (!d.sections[key]?.text) decisionErrors.push(`${label}: falta la sección obligatoria "${key}"`)
  }
  if (d.content.includes(PENDING_MARKER) || String(fm.validado_con).includes(PENDING_MARKER)) {
    decisionWarnings.push(`${label}: tiene partes "${PENDING_MARKER}"`)
  }
}

for (const f of files) {
  const doc = yaml.load(readFileSync(f, 'utf-8'))
  for (const rule of doc?.rules || []) {
    if (rule.decision && !decisions.has(rule.decision)) {
      decisionErrors.push(`${f}: ${rule.id} cita ${rule.decision} pero no existe en ${DECISIONS_DIR}/`)
    }
  }
}

for (const w of decisionWarnings) process.stderr.write(`⚠️  ${w}\n`)
for (const e of decisionErrors) process.stderr.write(`❌ ${e}\n`)
process.stderr.write(`[validate-all] ${decisions.size} decision(es) revisadas\n`)
if (decisionErrors.length > 0) failed++

process.stderr.write(`\n── ${STANDARDS_DIR} ──\n`)
const standardErrors = []
const seenStandardIds = new Set()
let standardFiles = []
try {
  standardFiles = loadStandards(STANDARDS_DIR)
} catch (err) {
  standardErrors.push(`YAML inválido en ${STANDARDS_DIR}/: ${err.message}`)
}
let standardCount = 0

for (const { file, technology, standards } of standardFiles) {
  if (!technology) standardErrors.push(`${file}: falta metadata.technology`)
  if (standards.length === 0) standardErrors.push(`${file}: no tiene lista "standards"`)
  for (const [i, std] of standards.entries()) {
    const label = `${file}: ${std.id || `standards[${i}]`}`
    standardCount++
    for (const field of STANDARD_REQUIRED) {
      if (!std[field]) standardErrors.push(`${label}: falta campo obligatorio "${field}"`)
    }
    if (std.id && !STANDARD_ID_PATTERN.test(std.id)) {
      standardErrors.push(`${label}: ID no cumple formato STD-XXX-NNN`)
    }
    if (std.id && seenStandardIds.has(std.id)) standardErrors.push(`${label}: ID duplicado`)
    seenStandardIds.add(std.id)
    if (std.level && !STANDARD_LEVELS.has(std.level)) {
      standardErrors.push(`${label}: level "${std.level}" no es válido (${[...STANDARD_LEVELS].join(', ')})`)
    }
    if (std.status && !STANDARD_STATUSES.has(std.status)) {
      standardErrors.push(`${label}: status "${std.status}" no es válido (${[...STANDARD_STATUSES].join(', ')})`)
    }
    if (std.decision && !decisions.has(std.decision)) {
      standardErrors.push(`${label}: cita ${std.decision} pero no existe en ${DECISIONS_DIR}/`)
    }
  }
}

for (const e of standardErrors) process.stderr.write(`❌ ${e}\n`)
process.stderr.write(`[validate-all] ${standardCount} estándar(es) revisados\n`)
if (standardErrors.length > 0) failed++

if (failed > 0) {
  process.stderr.write(`\n🚫 ${failed} file(s) failed validation\n`)
  process.exit(1)
}
process.stderr.write('\n✅ all rule files passed validation\n')
