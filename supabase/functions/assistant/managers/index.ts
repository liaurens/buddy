/**
 * All domain managers, auto-created from the tool registry.
 *
 * Adding a new domain:
 * 1. Add the domain name to the Domain type in types.ts
 * 2. Register tools for that domain in tools/registry.ts
 * 3. Add it to the DOMAINS array below
 *
 * The manager is built automatically from registered tools.
 */

import type { Domain } from '../types.ts'
import { createDomainManager, type DomainManager } from './base.manager.ts'

const DOMAINS: Domain[] = [
  'planning',
  'health',
  'mental',
  'content',
  'improvement',
  'studying',
  'projects',
  'school',
  'extra',
]

// Build all managers
const managerMap = new Map<Domain, DomainManager>()
for (const domain of DOMAINS) {
  managerMap.set(domain, createDomainManager(domain))
}

export function getManager(domain: Domain): DomainManager {
  return managerMap.get(domain)!
}

export function getAllManagers(): DomainManager[] {
  return Array.from(managerMap.values())
}
