/**
 * Ingestion plugin — kb-content
 *
 * Carga en la KB las reglas de negocio (rules/**.yaml), las notas de decisión
 * del vault (vault/decisiones/), los estándares técnicos
 * (standards/<tecnologia>/*.yaml) y las lecciones (lessons/<area>/*.yaml). La lógica de ingesta vive en el motor
 * (`@kb/mcp-server/content`); aquí solo se decide de dónde se lee y cómo se
 * resume una decisión de este negocio.
 *
 * Uso (local):
 *   kb-ingest ingest --db ./kb.db --plugin ./plugin/ingest.mjs --opt root=./rules --opt vault=./vault --opt standards=./standards
 */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  findYamlFiles,
  loadStandards,
  ingestDecisionNotes,
  ingestRuleFiles,
  ingestStandardFiles,
  loadLessons,
  ingestLessonFiles,
} from '@kb/mcp-server/content'
import { loadDecisions, decisionSummary } from './decisions.mjs'

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..')

function dirOption(ctx, key, fallback) {
  return ctx.options?.[key] ? String(ctx.options[key]) : join(REPO_ROOT, fallback)
}

export default {
  name: 'kb-content',
  description: 'Reglas de negocio, decisiones y estándares (--opt root=, vault=, standards=)',

  async run(ctx) {
    const files = findYamlFiles(dirOption(ctx, 'root', 'rules'))
    const decisions = loadDecisions(join(dirOption(ctx, 'vault', 'vault'), 'decisiones'))
    const opts = { decisions, summarize: decisionSummary }

    // Las decisiones primero: las aristas justified_by tienen llave foránea.
    ingestDecisionNotes(ctx, decisions, { summarize: decisionSummary })
    const standards = ingestStandardFiles(ctx, loadStandards(dirOption(ctx, 'standards', 'standards')), opts)
    const rules = ingestRuleFiles(ctx, files, opts)
    // Las lecciones al final: enlazan a reglas y decisiones que ya deben existir.
    const lessons = ingestLessonFiles(ctx, loadLessons(dirOption(ctx, 'lessons', 'lessons')))

    ctx.log(
      `ingested ${rules.rules} rules, ${decisions.size} decisions, ${standards.standards} standards, ` +
        `${lessons.lessons} lessons, ${rules.edges + standards.edges + lessons.edges} edges`
    )
  },
}
