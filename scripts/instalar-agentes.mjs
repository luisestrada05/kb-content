#!/usr/bin/env node
/**
 * Instala los agentes de agentes/*.agent.md a nivel usuario, como enlaces
 * simbólicos: un `git pull` en kb-content los actualiza en todos tus repos.
 *
 *   npm run agentes:instalar                 # en ~/.copilot/agents
 *   npm run agentes:instalar -- --dir <ruta> # en otro directorio de agentes
 *
 * Es idempotente. No pisa un archivo que no sea un enlace a este repo: lo
 * reporta para que decidas qué hacer con él.
 */
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE = resolve(fileURLToPath(import.meta.url), '..', '..', 'agentes')
const dirArg = process.argv.indexOf('--dir')
const target = dirArg > -1 ? resolve(process.argv[dirArg + 1]) : join(homedir(), '.copilot', 'agents')

const agents = readdirSync(SOURCE).filter((f) => f.endsWith('.agent.md'))
mkdirSync(target, { recursive: true })

let conflicts = 0
for (const file of agents) {
  const source = join(SOURCE, file)
  const link = join(target, file)
  if (existsSync(link) || isBrokenLink(link)) {
    const stat = lstatSync(link)
    if (stat.isSymbolicLink() && resolve(target, readlinkSync(link)) === source) {
      console.log(`= ${file} ya instalado`)
      continue
    }
    console.log(`! ${link} ya existe y no es un enlace a este repo — no lo toco`)
    conflicts++
    continue
  }
  symlinkSync(source, link)
  console.log(`+ ${file} → ${link}`)
}

console.log(`\nAgentes en ${target}. Para actualizarlos: git pull en kb-content.`)
if (conflicts > 0) {
  console.log(`${conflicts} conflicto(s): bórralos o renómbralos y vuelve a correr el comando.`)
  process.exit(1)
}

function isBrokenLink(path) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch {
    return false
  }
}
