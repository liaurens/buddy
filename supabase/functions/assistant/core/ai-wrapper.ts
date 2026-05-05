/**
 * AI Wrapper (Component I)
 *
 * Unified AI access point for the entire assistant.
 * - Supports both Anthropic (Claude) and OpenAI providers
 * - Tracks tokens used per call
 * - Logs every AI call with purpose, model, latency
 * - Provides retry logic
 * - Feeds data to HR agent via structured logging
 *
 * Two entry points:
 *   callAI()           — single text completion (used by classifier, content gen)
 *   callAIWithTools()  — tool-use / function-calling loop turn (used by agent-loop)
 */

import type { JsonSchema } from '../types.ts'

export interface AICallOptions {
  purpose: string          // e.g. 'intent_classification', 'date_parsing', 'content_generation'
  model?: string           // override default model
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  responseFormat?: 'json' | 'text'
}

export interface AICallResult {
  content: string
  tokensIn: number
  tokensOut: number
  latencyMs: number
  model: string
  provider: string
}

interface AIConfig {
  key: string
  provider: string  // 'anthropic' | 'openai'
}

const DEFAULT_MODELS: Record<string, string> = {
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

/**
 * Unified AI call — routes to the configured provider.
 * Returns structured result with token/latency tracking.
 */
export async function callAI(
  userMessage: string,
  config: AIConfig,
  options: AICallOptions
): Promise<AICallResult> {
  const startTime = Date.now()
  const model = options.model || DEFAULT_MODELS[config.provider] || DEFAULT_MODELS.anthropic

  try {
    if (config.provider === 'anthropic') {
      return await callAnthropic(userMessage, config.key, model, options, startTime)
    } else if (config.provider === 'gemini') {
      return await callGemini(userMessage, config.key, model, options, startTime)
    } else {
      return await callOpenAI(userMessage, config.key, model, options, startTime)
    }
  } catch (err) {
    // Re-throw with enriched context for upstream error loggers
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`AI call failed [${config.provider}/${model}] (purpose: ${options.purpose}): ${message}`)
  }
}

async function callAnthropic(
  userMessage: string,
  apiKey: string,
  model: string,
  options: AICallOptions,
  startTime: number
): Promise<AICallResult> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 100,
    messages: [{ role: 'user', content: userMessage }],
  }
  if (options.systemPrompt) {
    body.system = options.systemPrompt
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const content = data.content?.[0]?.text ?? ''

  return {
    content,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'anthropic',
  }
}

async function callGemini(
  userMessage: string,
  apiKey: string,
  model: string,
  options: AICallOptions,
  startTime: number
): Promise<AICallResult> {
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 100,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.responseFormat === 'json' ? { responseMimeType: 'application/json' } : {}),
    },
  }

  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  return {
    content,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'gemini',
  }
}

async function callOpenAI(
  userMessage: string,
  apiKey: string,
  model: string,
  options: AICallOptions,
  startTime: number
): Promise<AICallResult> {
  const messages: Array<{ role: string; content: string }> = []
  if (options.systemPrompt) {
    messages.push({ role: 'system', content: options.systemPrompt })
  }
  messages.push({ role: 'user', content: userMessage })

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 100,
    messages,
  }
  if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  if (options.responseFormat === 'json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content ?? ''

  return {
    content,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'openai',
  }
}

/**
 * Collector for AI calls made during a single request.
 * Tracks all calls so they can be logged together.
 */
export class AICallCollector {
  private calls: AICallResult[] = []

  record(result: AICallResult): void {
    this.calls.push(result)
  }

  getCalls(): AICallResult[] {
    return this.calls
  }

  getTotalTokens(): { input: number; output: number } {
    return this.calls.reduce(
      (acc, c) => ({
        input: acc.input + c.tokensIn,
        output: acc.output + c.tokensOut,
      }),
      { input: 0, output: 0 }
    )
  }

  toJSON(): Array<Record<string, unknown>> {
    return this.calls.map(c => ({
      model: c.model,
      provider: c.provider,
      tokens_in: c.tokensIn,
      tokens_out: c.tokensOut,
      latency_ms: c.latencyMs,
    }))
  }
}

// ─── Tool-use / Function-calling ─────────────────────────────────────────────

export interface AIToolDef {
  name: string
  description: string
  input_schema: JsonSchema
}

export interface AIToolCall {
  id: string                              // tool_use_id (Anthropic) / tool_call.id (OpenAI) / synthesized for Gemini
  name: string
  input: Record<string, unknown>
}

export interface AIToolResultMsg {
  tool_use_id: string
  content: string                         // JSON-stringified ToolResult
  is_error?: boolean
}

export type AIMessage =
  | { role: 'user'; content: string }
  | { role: 'tool_results'; results: AIToolResultMsg[] }
  | { role: 'assistant'; content: string; toolCalls?: AIToolCall[] }

export interface AIToolCallResult {
  content: string
  toolCalls: AIToolCall[]
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'other'
  tokensIn: number
  tokensOut: number
  latencyMs: number
  model: string
  provider: string
}

export interface CallAIWithToolsOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
  cacheSystemPrompt?: boolean             // Anthropic prompt caching for the long system block
  toolChoice?: 'auto' | 'any'             // 'any' forces the model to call one of the tools
}

/**
 * Provider-agnostic tool-use turn. Returns either text (`stopReason: 'end_turn'`)
 * or tool calls for the loop to execute (`stopReason: 'tool_use'`).
 */
export async function callAIWithTools(
  messages: AIMessage[],
  tools: AIToolDef[],
  config: AIConfig,
  options: CallAIWithToolsOptions = {}
): Promise<AIToolCallResult> {
  const startTime = Date.now()
  const model = options.model || DEFAULT_MODELS[config.provider] || DEFAULT_MODELS.anthropic
  try {
    if (config.provider === 'anthropic') {
      return await callAnthropicTools(messages, tools, config.key, model, options, startTime)
    } else if (config.provider === 'gemini') {
      return await callGeminiTools(messages, tools, config.key, model, options, startTime)
    } else {
      return await callOpenAITools(messages, tools, config.key, model, options, startTime)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    throw new Error(`AI tool-use call failed [${config.provider}/${model}]: ${message}`)
  }
}

// ─── Anthropic tool-use ──────────────────────────────────────────────────────

interface AnthropicContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

async function callAnthropicTools(
  messages: AIMessage[],
  tools: AIToolDef[],
  apiKey: string,
  model: string,
  options: CallAIWithToolsOptions,
  startTime: number
): Promise<AIToolCallResult> {
  const apiMessages: Array<Record<string, unknown>> = []
  for (const m of messages) {
    if (m.role === 'user') {
      apiMessages.push({ role: 'user', content: m.content })
    } else if (m.role === 'tool_results') {
      apiMessages.push({
        role: 'user',
        content: m.results.map(r => ({
          type: 'tool_result',
          tool_use_id: r.tool_use_id,
          content: r.content,
          ...(r.is_error ? { is_error: true } : {}),
        })),
      })
    } else {
      // assistant
      const blocks: Array<Record<string, unknown>> = []
      if (m.content) blocks.push({ type: 'text', text: m.content })
      for (const tc of m.toolCalls || []) {
        blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input })
      }
      apiMessages.push({ role: 'assistant', content: blocks })
    }
  }

  const systemBlocks: Array<Record<string, unknown>> = []
  if (options.systemPrompt) {
    systemBlocks.push({
      type: 'text',
      text: options.systemPrompt,
      ...(options.cacheSystemPrompt ? { cache_control: { type: 'ephemeral' } } : {}),
    })
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 1024,
    messages: apiMessages,
    tools: tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    })),
  }
  if (systemBlocks.length > 0) body.system = systemBlocks
  if (options.toolChoice === 'any') body.tool_choice = { type: 'any' }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const blocks: AnthropicContentBlock[] = data.content || []
  let content = ''
  const toolCalls: AIToolCall[] = []
  for (const b of blocks) {
    if (b.type === 'text' && b.text) content += b.text
    if (b.type === 'tool_use' && b.id && b.name) {
      toolCalls.push({ id: b.id, name: b.name, input: (b.input as Record<string, unknown>) || {} })
    }
  }

  const stopReason = data.stop_reason === 'tool_use'
    ? 'tool_use'
    : data.stop_reason === 'end_turn'
      ? 'end_turn'
      : data.stop_reason === 'max_tokens'
        ? 'max_tokens'
        : 'other'

  return {
    content,
    toolCalls,
    stopReason,
    tokensIn: data.usage?.input_tokens ?? 0,
    tokensOut: data.usage?.output_tokens ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'anthropic',
  }
}

// ─── OpenAI tool-use ─────────────────────────────────────────────────────────

async function callOpenAITools(
  messages: AIMessage[],
  tools: AIToolDef[],
  apiKey: string,
  model: string,
  options: CallAIWithToolsOptions,
  startTime: number
): Promise<AIToolCallResult> {
  const apiMessages: Array<Record<string, unknown>> = []
  if (options.systemPrompt) apiMessages.push({ role: 'system', content: options.systemPrompt })
  for (const m of messages) {
    if (m.role === 'user') {
      apiMessages.push({ role: 'user', content: m.content })
    } else if (m.role === 'tool_results') {
      for (const r of m.results) {
        apiMessages.push({ role: 'tool', tool_call_id: r.tool_use_id, content: r.content })
      }
    } else {
      // assistant
      const msg: Record<string, unknown> = { role: 'assistant', content: m.content || null }
      if (m.toolCalls && m.toolCalls.length > 0) {
        msg.tool_calls = m.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.input) },
        }))
      }
      apiMessages.push(msg)
    }
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: options.maxTokens ?? 1024,
    messages: apiMessages,
    tools: tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    })),
  }
  if (options.toolChoice === 'any') body.tool_choice = 'required'

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const choice = data.choices?.[0]
  const msg = choice?.message ?? {}
  const content: string = msg.content ?? ''
  const toolCalls: AIToolCall[] = []
  for (const tc of msg.tool_calls || []) {
    let parsed: Record<string, unknown> = {}
    try { parsed = JSON.parse(tc.function?.arguments || '{}') } catch { /* leave empty */ }
    toolCalls.push({ id: tc.id, name: tc.function?.name, input: parsed })
  }

  const finish = choice?.finish_reason
  const stopReason = finish === 'tool_calls'
    ? 'tool_use'
    : finish === 'stop'
      ? 'end_turn'
      : finish === 'length'
        ? 'max_tokens'
        : 'other'

  return {
    content,
    toolCalls,
    stopReason,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'openai',
  }
}

// ─── Gemini tool-use ─────────────────────────────────────────────────────────

/**
 * Recursively strip JSON Schema keywords that Gemini's OpenAPI subset rejects.
 * Gemini accepts: type, properties, required, enum, items, description, format
 * (limited: 'date-time', 'date', 'enum', 'int32', 'int64').
 */
export function stripSchemaForGemini(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (schema.type) out.type = schema.type.toUpperCase()
  if (schema.description) out.description = schema.description
  if (schema.enum) out.enum = schema.enum.map(String)        // Gemini wants string enums
  // Gemini accepts only a narrow format set; pass through 'date-time'/'date' only.
  if (schema.format === 'date-time' || schema.format === 'date') out.format = schema.format
  if (schema.items) out.items = stripSchemaForGemini(schema.items)
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, stripSchemaForGemini(v)])
    )
  }
  if (schema.required) out.required = schema.required
  return out
}

async function callGeminiTools(
  messages: AIMessage[],
  tools: AIToolDef[],
  apiKey: string,
  model: string,
  options: CallAIWithToolsOptions,
  startTime: number
): Promise<AIToolCallResult> {
  const contents: Array<Record<string, unknown>> = []
  for (const m of messages) {
    if (m.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: m.content }] })
    } else if (m.role === 'tool_results') {
      contents.push({
        role: 'user',
        parts: m.results.map(r => ({
          functionResponse: {
            name: extractFunctionName(r.tool_use_id),
            response: { content: r.content },
          },
        })),
      })
    } else {
      const parts: Array<Record<string, unknown>> = []
      if (m.content) parts.push({ text: m.content })
      for (const tc of m.toolCalls || []) {
        parts.push({ functionCall: { name: tc.name, args: tc.input } })
      }
      contents.push({ role: 'model', parts })
    }
  }

  const body: Record<string, unknown> = {
    contents,
    tools: [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: stripSchemaForGemini(t.input_schema),
      })),
    }],
    generationConfig: {
      maxOutputTokens: options.maxTokens ?? 1024,
    },
  }
  if (options.systemPrompt) {
    body.systemInstruction = { parts: [{ text: options.systemPrompt }] }
  }
  if (options.toolChoice === 'any') {
    body.toolConfig = { functionCallingConfig: { mode: 'ANY' } }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts || []
  let content = ''
  const toolCalls: AIToolCall[] = []
  let callIdx = 0
  for (const p of parts) {
    if (p.text) content += p.text
    if (p.functionCall) {
      toolCalls.push({
        // Gemini doesn't return ids — synthesize a stable one tied to the function name + index.
        id: `gemini_${p.functionCall.name}_${callIdx++}`,
        name: p.functionCall.name,
        input: (p.functionCall.args as Record<string, unknown>) || {},
      })
    }
  }

  const finish = candidate?.finishReason
  const stopReason = toolCalls.length > 0
    ? 'tool_use'
    : finish === 'STOP'
      ? 'end_turn'
      : finish === 'MAX_TOKENS'
        ? 'max_tokens'
        : 'other'

  return {
    content,
    toolCalls,
    stopReason,
    tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
    tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
    latencyMs: Date.now() - startTime,
    model,
    provider: 'gemini',
  }
}

function extractFunctionName(toolUseId: string): string {
  // Synthesized as `gemini_<name>_<idx>` in callGeminiTools above.
  if (toolUseId.startsWith('gemini_')) {
    const rest = toolUseId.slice('gemini_'.length)
    const lastUnderscore = rest.lastIndexOf('_')
    return lastUnderscore > 0 ? rest.slice(0, lastUnderscore) : rest
  }
  return toolUseId
}

/**
 * Convert an AIToolCallResult into an AICallResult-compatible record so it can be
 * fed into the existing AICallCollector for unified token/latency logging.
 */
export function toolCallToAIResult(r: AIToolCallResult): AICallResult {
  return {
    content: r.content,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    latencyMs: r.latencyMs,
    model: r.model,
    provider: r.provider,
  }
}
