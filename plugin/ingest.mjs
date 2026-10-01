/**
 * Ingestion plugin — kb-content
 *
 * Lee todos los YAML de reglas de negocio en un directorio (recursivo)
 * y los carga como entidades + aristas + terms en la KB. También carga las
 * notas de decisión del vault y embebe su porqué en cada regla que las cita.
 *
 * Adaptado del template publicado en
 *   github.com/luisestrada05/mcp-kb-server :: examples/yaml-rules/ingest.mjs
 *
 * Taxonomía:
 *   Entity types: rule | exception | gap | sla | decision
 *   Relations:    overrides | uses_table | uses_sp | justified_by
 *
 * Uso (local):
 *   kb-ingest ingest --db ./kb.db --plugin ./plugin/ingest.mjs --opt root=./rules --opt vault=./vault
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { loadDecisions } from './decisions.mjs'

// ── Config ──────────────────────────────────────────────────────────────────
const DEFAULT_RULES_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'rules')
const DEFAULT_VAULT_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'vault')

// ── Helpers ─────────────────────────────────────────────────────────────────
function findYamlFiles(dir) {
  const results = []
  let entries
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }
  for (const entry of entries) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...findYamlFiles(full))
    } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      results.push(full)
    }
  }
  return results
}

function buildBody(rule, decision) {
  const parts = [rule.summary || '']
  if (decision?.sections.intencion) parts.push(`Por qué: ${decision.sections.intencion.text}`)
  for (const item of decision?.sections.noSignifica?.items || []) {
    parts.push(`No significa: ${item}`)
  }
  if (rule.risk_note) parts.push(`Riesgo: ${rule.risk_note}`)
  if (rule.formal_rule?.action) parts.push(`Acción: ${rule.formal_rule.action}`)
  if (rule.formal_rule?.conditions) {
    for (const c of rule.formal_rule.conditions) {
      parts.push(`${c.field} ${c.op} ${JSON.stringify(c.value)}`)
    }
  }
  if (rule.source_ref) parts.push(`Fuente: ${rule.source_ref}`)
  if (decision) parts.push(`Decisión: ${decision.frontmatter.id} (${decision.frontmatter.status})`)
  return parts.join('\n')
}

// Lo que viaja dentro de la regla: suficiente para no malinterpretarla sin
// tener que ir a buscar la nota completa.
function decisionSummary(d) {
  return {
    id: d.frontmatter.id,
    status: d.frontmatter.status || null,
    validadoCon: d.frontmatter.validado_con || null,
    intencion: d.sections.intencion?.text || null,
    noSignifica: d.sections.noSignifica?.items || [],
  }
}

function ingestDecisions(ctx, decisions) {
  for (const d of decisions.values()) {
    const fm = d.frontmatter
    const entityId = `decision:${fm.id}`
    ctx.entities.upsert({
      id: entityId,
      type: 'decision',
      name: d.title.startsWith(`${fm.id}`) ? d.title : `[${fm.id}] ${d.title}`,
      body: d.content,
      metadata: {
        domain: fm.domain || null,
        status: fm.status || null,
        owner: fm.owner || null,
        validadoCon: fm.validado_con || null,
        fecha: fm.fecha ? String(fm.fecha) : null,
        origen: fm.origen || [],
        supersededBy: fm.superseded_by || null,
        sections: Object.fromEntries(
          Object.entries(d.sections).map(([k, v]) => [k, v.items.length ? v.items : v.text])
        ),
      },
      sourcePath: d.file,
    })
    ctx.search.clearTerms(entityId)
    ctx.search.addTerms(entityId, [fm.id.toLowerCase(), fm.domain, 'decision'].filter(Boolean))
  }
}

function extractTerms(rule, domain) {
  const terms = new Set()
  terms.add(domain)
  if (rule.subdomain) terms.add(rule.subdomain)
  if (rule.id) terms.add(rule.id.toLowerCase())

  const eventos = rule.applicability?.evento || []
  for (const e of eventos) terms.add(e)

  const tables = rule.related_objects?.tables || []
  const sps = rule.related_objects?.sps || []
  for (const t of tables) terms.add(t.toLowerCase())
  for (const sp of sps) terms.add(sp.toLowerCase())

  const keywords = (rule.summary || '')
    .toLowerCase()
    .split(/[\s—,;:()]+/)
    .filter((w) => w.length > 4)
  for (const kw of keywords) terms.add(kw)

  return [...terms].filter(Boolean)
}

export default {
  name: 'kb-content',
  description: 'Ingesta de reglas de negocio desde archivos YAML (requiere --opt root=<dir>)',

  async run(ctx) {
    const rootDir = ctx.options?.root ? String(ctx.options.root) : DEFAULT_RULES_DIR
    if (!ctx.options?.root) {
      process.stderr.write('[kb-content] WARN: no --opt root=<dir> provided, using default\n')
    }
    const vaultDir = ctx.options?.vault ? String(ctx.options.vault) : DEFAULT_VAULT_DIR
    const files = findYamlFiles(rootDir)
    const decisions = loadDecisions(join(vaultDir, 'decisiones'))
    ingestDecisions(ctx, decisions)

    let totalRules = 0
    let totalEdges = 0

    for (const file of files) {
      const raw = readFileSync(file, 'utf-8')
      let doc
      try {
        doc = yaml.load(raw)
      } catch (err) {
        process.stderr.write(`[kb-content] WARN: failed to parse ${file}: ${err.message}\n`)
        continue
      }

      if (!doc || !doc.rules || !Array.isArray(doc.rules)) {
        process.stderr.write(`[kb-content] SKIP: no rules array in ${file}\n`)
        continue
      }

      const domain =
        doc.metadata?.domain ||
        basename(file, '.yaml').replace('seed-', '').replace('-rules', '')
      const domainVersion = doc.metadata?.version || null
      const domainCreatedAt = doc.metadata?.created_at || null

      for (const rule of doc.rules) {
        if (!rule.id) continue

        const entityId = `${rule.type || 'rule'}:${rule.id}`
        const decision = rule.decision ? decisions.get(rule.decision) : null
        if (rule.decision && !decision) {
          process.stderr.write(`[kb-content] WARN: ${rule.id} cita ${rule.decision} pero no existe en el vault\n`)
        }
        const body = buildBody(rule, decision)

        ctx.entities.upsert({
          id: entityId,
          type: rule.type || 'rule',
          name: `[${rule.id}] ${rule.summary || 'Sin resumen'}`,
          body,
          metadata: {
            domain,
            domainVersion,
            domainCreatedAt,
            subdomain: rule.subdomain || null,
            status: rule.status || 'active',
            owner: rule.owner || null,
            riskNote: rule.risk_note || null,
            eventos: rule.applicability?.evento || [],
            actors: rule.applicability?.actor || [],
            relatedTables: rule.related_objects?.tables || [],
            relatedSps: rule.related_objects?.sps || [],
            sourceRef: rule.source_ref || null,
            formalRule: rule.formal_rule || null,
            decision: decision ? decisionSummary(decision) : null,
          },
          sourcePath: file,
        })
        totalRules++

        ctx.search.clearTerms(entityId)
        const terms = extractTerms(rule, domain)
        ctx.search.addTerms(entityId, terms)

        if (rule.type === 'exception' && rule.formal_rule?.overrides) {
          const targetId = `rule:${rule.formal_rule.overrides}`
          ctx.edges.upsert({ src: entityId, dst: targetId, relation: 'overrides' })
          totalEdges++
        }

        if (decision) {
          ctx.edges.upsert({ src: entityId, dst: `decision:${rule.decision}`, relation: 'justified_by' })
          totalEdges++
        }

        for (const table of rule.related_objects?.tables || []) {
          const tableId = `table:${table}`
          ctx.entities.upsert({
            id: tableId,
            type: 'table',
            name: table,
            body: `Tabla Sybase: ${table}`,
            metadata: { domain },
          })
          ctx.edges.upsert({ src: entityId, dst: tableId, relation: 'uses_table' })
          totalEdges++
        }

        for (const sp of rule.related_objects?.sps || []) {
          const spId = `sp:${sp}`
          ctx.entities.upsert({
            id: spId,
            type: 'stored_procedure',
            name: sp,
            body: `Stored Procedure Sybase: ${sp}`,
            metadata: { domain },
          })
          ctx.edges.upsert({ src: entityId, dst: spId, relation: 'uses_sp' })
          totalEdges++
        }
      }
    }

    process.stderr.write(
      `[kb-content] ingested ${totalRules} rules, ${decisions.size} decisions, ${totalEdges} edges from ${files.length} files\n`
    )
  },
}
