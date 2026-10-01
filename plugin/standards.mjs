/**
 * Estándares técnicos — loader compartido por la ingesta y el validador.
 *
 * Viven separados de las reglas de negocio: standards/<tecnologia>/*.yaml.
 * Una regla de negocio dice qué debe pasar en el dominio; un estándar dice
 * cómo se escribe el código en una tecnología (naming, manejo de errores...).
 *
 * Carpetas que empiezan con `_` o `.` (plantillas) se ignoran.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import yaml from 'js-yaml'

export const STANDARD_ID_PATTERN = /^STD-[A-Z]{2,5}-\d{3,4}$/
export const STANDARD_LEVELS = new Set(['must', 'should', 'may'])
export const STANDARD_STATUSES = new Set(['active', 'draft', 'deprecated'])
export const STANDARD_REQUIRED = ['id', 'category', 'summary', 'level', 'rationale', 'owner', 'status']

export function findStandardFiles(dir) {
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
    if (statSync(full).isDirectory()) results.push(...findStandardFiles(full))
    else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) results.push(full)
  }
  return results
}

/** Devuelve [{ file, technology, standards: [...] }]. Lanza si un YAML no parsea. */
export function loadStandards(dir) {
  return findStandardFiles(dir).map((file) => {
    const doc = yaml.load(readFileSync(file, 'utf-8')) || {}
    return {
      file,
      technology: doc.metadata?.technology || null,
      version: doc.metadata?.version || null,
      standards: Array.isArray(doc.standards) ? doc.standards : [],
    }
  })
}
