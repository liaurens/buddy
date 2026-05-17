import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invokeAssistantAction } from '../services/assistant.service'

export type RoutePreviewSource = 'slash' | 'flag' | 'rule' | 'dynamic_rule' | 'none'

export interface RoutePreview {
  matched: boolean
  domain?: string
  action?: string
  label?: string
  source: RoutePreviewSource
}

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

async function fetchRoutePreview(input: string): Promise<RoutePreview> {
  const response = await invokeAssistantAction('extra', 'system.route_preview', { content: input })
  const data = response.data ?? {}
  return {
    matched: data.matched === true,
    domain: typeof data.domain === 'string' ? data.domain : undefined,
    action: typeof data.action === 'string' ? data.action : undefined,
    label: typeof data.label === 'string' ? data.label : undefined,
    source: (typeof data.source === 'string' ? data.source : 'none') as RoutePreviewSource,
  }
}

/**
 * Returns the deterministic routing decision for `input` (slash / flag / rule /
 * dynamic rule) without executing it. Debounced so we don't fire per keystroke.
 * Returns `null` while idle, debouncing, or when no match exists — call sites
 * should render the ghost chip only when this returns a matched preview.
 */
export function useRoutePreview(input: string): RoutePreview | null {
  const trimmed = input.trim()
  const debounced = useDebouncedValue(trimmed, 250)

  const { data } = useQuery({
    queryKey: ['assistant', 'route_preview', debounced],
    queryFn: () => fetchRoutePreview(debounced),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  })

  if (!data?.matched) return null
  // If the user has typed past what we previewed, suppress until the next
  // debounce settles to avoid the chip showing a stale match.
  if (debounced !== trimmed) return null
  return data
}
