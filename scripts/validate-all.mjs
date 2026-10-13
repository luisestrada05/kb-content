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
 * Después valida las notas de decisión del vault, los estándares por capa,
 * las lecciones, el catálogo de componentes, los precedentes y que cada
 * `decision:` citado exista.
 */
import { spawnSync } from 'node:child_process'
import { readdirSync, statSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  validateNotes,
  findDanglingDecisionRefs,
  loadStandards,
  validateStandards,
  loadLessons,
  validateLessons,
  loadCatalog,
  validateCatalog,
  loadPrecedents,
  validatePrecedents,
} from '@kb/mcp-server/content'
import { loadDecisions, DECISION_RULES } from '../plugin/decisions.mjs'
import { LAYERS } from '../plugin/layers.mjs'

const RULES_DIR = 'rules'
const DB = './tmp.db'
const DECISIONS_DIR = 'vault/decisiones'
const STANDARDS_DIR = 'standards'
const LESSONS_DIR = 'lessons'
const CATALOG_DIR = 'catalogo'
const PRECEDENTS_DIR = 'precedentes'

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

function report(title, { errors, warnings }, count) {
  process.stderr.write(`\n── ${title} ──\n`)
  for (const w of warnings) process.stderr.write(`⚠️  ${w}\n`)
  for (const e of errors) process.stderr.write(`❌ ${e}\n`)
  process.stderr.write(`[validate-all] ${count} revisado(s)\n`)
  if (errors.length > 0) failed++
}

const decisions = loadDecisions(DECISIONS_DIR)
const decisionCheck = validateNotes(decisions, DECISION_RULES)
decisionCheck.errors.push(...findDanglingDecisionRefs(files, new Set(decisions.keys())))
report(DECISIONS_DIR, decisionCheck, decisions.size)

let standardFiles = []
let standardCheck
try {
  standardFiles = loadStandards(STANDARDS_DIR)
  standardCheck = validateStandards(standardFiles, {
    knownDecisions: new Set(decisions.keys()),
    layers: LAYERS,
  })
} catch (err) {
  standardCheck = { errors: [`YAML inválido en ${STANDARDS_DIR}/: ${err.message}`], warnings: [] }
}
const standardCount = standardFiles.reduce((n, f) => n + f.standards.length, 0)
report(STANDARDS_DIR, standardCheck, standardCount)

let lessonFiles = []
let lessonCheck
try {
  lessonFiles = loadLessons(LESSONS_DIR)
  lessonCheck = validateLessons(lessonFiles, { knownDecisions: new Set(decisions.keys()) })
} catch (err) {
  lessonCheck = { errors: [`YAML inválido en ${LESSONS_DIR}/: ${err.message}`], warnings: [] }
}
report(LESSONS_DIR, lessonCheck, lessonFiles.reduce((n, f) => n + f.lessons.length, 0))

let catalogFiles = []
let catalogCheck
try {
  catalogFiles = loadCatalog(CATALOG_DIR)
  catalogCheck = validateCatalog(catalogFiles, { layers: LAYERS })
} catch (err) {
  catalogCheck = { errors: [`YAML inválido en ${CATALOG_DIR}/: ${err.message}`], warnings: [] }
}
report(CATALOG_DIR, catalogCheck, catalogFiles.reduce((n, f) => n + f.components.length, 0))

let precedentFiles = []
let precedentCheck
try {
  precedentFiles = loadPrecedents(PRECEDENTS_DIR)
  precedentCheck = validatePrecedents(precedentFiles, {
    knownDecisions: new Set(decisions.keys()),
    layers: LAYERS,
  })
} catch (err) {
  precedentCheck = { errors: [`YAML inválido en ${PRECEDENTS_DIR}/: ${err.message}`], warnings: [] }
}
report(PRECEDENTS_DIR, precedentCheck, precedentFiles.reduce((n, f) => n + f.precedents.length, 0))

if (failed > 0) {
  process.stderr.write(`\n🚫 ${failed} file(s) failed validation\n`)
  process.exit(1)
}
process.stderr.write('\n✅ all rule files passed validation\n')
