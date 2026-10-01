/**
 * Notas de decisión de este negocio — vault/decisiones/DEC-XXX-NNN.md.
 *
 * El parser y la validación genéricos viven en el motor
 * (`@kb/mcp-server/content`); aquí solo va lo propio de este repo: el formato
 * del ID, los estados y qué secciones son obligatorias.
 */
import { loadNotes, pickSection } from '@kb/mcp-server/content'

export const DECISION_RULES = {
  idPattern: /^DEC-[A-Z]{2,5}-\d{3,4}$/,
  statuses: ['proposed', 'accepted', 'superseded'],
  requiredSections: ['intencion', 'no significa'],
  supersededStatus: 'superseded',
  pendingMarker: 'POR COMPLETAR',
}

export function loadDecisions(dir) {
  return loadNotes(dir)
}

// Lo que viaja dentro de la regla: suficiente para no malinterpretarla sin
// tener que ir a buscar la nota completa.
export function decisionSummary(note) {
  return {
    id: note.id,
    status: note.frontmatter.status || null,
    validadoCon: note.frontmatter.validado_con || null,
    intencion: pickSection(note, 'intencion')?.text || null,
    noSignifica: pickSection(note, 'no significa')?.items || [],
  }
}
