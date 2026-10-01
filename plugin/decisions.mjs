/**
 * Notas de decisión — parser compartido por la ingesta y el validador.
 *
 * Una decisión es un markdown compatible con Obsidian bajo vault/decisiones/:
 * frontmatter YAML con los campos estructurados + secciones `## ` con el
 * porqué en prosa. Las reglas YAML apuntan a ella con `decision: DEC-XXX-NNN`.
 *
 * Carpetas que empiezan con `_` o `.` (plantillas, config de Obsidian) se ignoran.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import yaml from 'js-yaml'

export const DECISION_ID_PATTERN = /^DEC-[A-Z]{2,5}-\d{3,4}$/
export const DECISION_STATUSES = new Set(['proposed', 'accepted', 'superseded'])
export const PENDING_MARKER = 'POR COMPLETAR'

// Encabezado normalizado (sin acentos, minúsculas) → llave en `sections`.
const SECTION_KEYS = {
  intencion: 'intencion',
  'si aplica': 'siAplica',
  'no significa': 'noSignifica',
  'alternativas descartadas': 'alternativasDescartadas',
}
export const REQUIRED_SECTIONS = ['intencion', 'noSignifica']

function normalizeHeading(h) {
  return h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function findDecisionFiles(dir) {
  const results = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) results.push(...findDecisionFiles(full))
    else if (entry.endsWith('.md')) results.push(full)
  }
  return results
}

export function parseDecision(file) {
  const raw = readFileSync(file, 'utf-8')
  const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const frontmatter = fm ? yaml.load(fm[1]) || {} : {}
  const content = fm ? raw.slice(fm[0].length) : raw

  const title = content.match(/^# (.+)$/m)?.[1].trim() || frontmatter.id || basename(file, '.md')

  const sections = {}
  const parts = content.split(/^## (.+)$/m)
  // split con grupo de captura: [antes, heading1, cuerpo1, heading2, cuerpo2, ...]
  for (let i = 1; i < parts.length; i += 2) {
    const key = SECTION_KEYS[normalizeHeading(parts[i])]
    if (!key) continue
    const text = parts[i + 1].trim()
    const items = text
      .split('\n')
      .filter((l) => /^\s*- /.test(l))
      .map((l) => l.replace(/^\s*- /, '').trim())
    sections[key] = { text, items }
  }

  return { file, frontmatter, title, content: content.trim(), sections }
}

export function loadDecisions(dir) {
  const byId = new Map()
  for (const file of findDecisionFiles(dir)) {
    const d = parseDecision(file)
    if (d.frontmatter.id) byId.set(d.frontmatter.id, d)
  }
  return byId
}
