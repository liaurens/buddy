/**
 * AI Wrapper (Component I)
 *
 * Unified AI access point for the entire assistant.
 * - Supports both Anthropic (Claude) and OpenAI providers
 * - Tracks tokens used per call
 * - Logs every AI call with purpose, model, latency
 * - Provides retry logic
 * - Feeds data to HR agent via structured logging
 */

export interface AICallOptions {
  purpose: string          // e.g. 'intent_classification', 'date_parsing', 'content_generation'
  model?: string           // override default model
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
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
  gemini: 'gemini-2.0-flash',
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
