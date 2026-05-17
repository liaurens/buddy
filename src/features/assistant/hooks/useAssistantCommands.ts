import { useQuery } from '@tanstack/react-query'
import { fetchAssistantCommands } from '../services/assistant.service'
import { COMMANDS } from '../constants/commands'
import type { AssistantCommandMetadata } from '../types'

/**
 * Map the local fallback `COMMANDS` constant into the same shape the backend
 * `system.commands` action returns. Used when the request fails (offline,
 * unauthenticated, edge function down) so the hint dropdown never appears empty.
 */
const FALLBACK: AssistantCommandMetadata[] = COMMANDS.map(c => ({
  command: c.command,
  description: c.description,
  domain: 'unknown',
  action: c.command.slice(1),
  primary: c.primary === true,
}))

/**
 * Fetch the live slash-command registry from the backend. Cached for an hour;
 * falls back to the bundled list if the request fails. The command set rarely
 * changes within a session.
 */
export function useAssistantCommands(): {
  commands: AssistantCommandMetadata[]
  primaryCommands: AssistantCommandMetadata[]
  isLoading: boolean
  isFallback: boolean
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['assistant', 'commands'],
    queryFn: fetchAssistantCommands,
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 1,
  })

  const commands = data && data.length > 0 ? data : FALLBACK
  const primaryCommands = commands.filter(c => c.primary)

  return {
    commands,
    primaryCommands,
    isLoading,
    isFallback: !data || data.length === 0 || isError,
  }
}
