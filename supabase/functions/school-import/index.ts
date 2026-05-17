import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest } from '../assistant/auth.ts'
import { callAIWithDocuments, type AIToolDef } from '../assistant/core/ai-wrapper.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'extract' | 'commit'

interface RequestBody {
  action: Action
  classId: string
  documentIds?: string[]
  extraInstructions?: string
  payload?: CourseImportPayload
}

interface CourseImportCheckpoint {
  number: number | string
  title: string
  subitems?: string[]
  notes?: string
}

interface CourseImportAssignment {
  title: string
  description?: string
  deadline: string
  estimatedMinutes?: number
  checkpoints?: CourseImportCheckpoint[]
  include?: boolean
}

interface CourseImportSession {
  dayOfWeek: number
  startTime: string
  endTime: string
  location?: string
  include?: boolean
}

interface CourseImportPayload {
  summary: string
  sourceDocumentId?: string
  assignments: CourseImportAssignment[]
  sessions: CourseImportSession[]
}

interface DbClassDocument {
  id: string
  user_id: string
  class_id: string
  name: string
  storage_path: string
  mime_type: string
  size_bytes: number
  kind: string
}

interface InlineAIDocument {
  name: string
  mediaType: string
  base64: string
}

const COURSE_IMPORT_TOOL: AIToolDef = {
  name: 'submit_course_import',
  description: 'Submit structured course import findings from the provided PDFs.',
  input_schema: {
    type: 'object',
    required: ['summary', 'assignments', 'sessions'],
    properties: {
      summary: {
        type: 'string',
        description: 'A concise 2-4 sentence overview of what was found in the course documents.',
      },
      assignments: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'deadline'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            deadline: { type: 'string', format: 'date-time' },
            estimatedMinutes: { type: 'integer' },
            checkpoints: {
              type: 'array',
              items: {
                type: 'object',
                required: ['number', 'title'],
                properties: {
                  number: { type: 'integer' },
                  title: { type: 'string' },
                  subitems: { type: 'array', items: { type: 'string' } },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
      },
      sessions: {
        type: 'array',
        items: {
          type: 'object',
          required: ['dayOfWeek', 'startTime', 'endTime'],
          properties: {
            dayOfWeek: { type: 'integer', description: '0=Sunday through 6=Saturday.' },
            startTime: { type: 'string', description: 'HH:mm 24-hour local time.' },
            endTime: { type: 'string', description: 'HH:mm 24-hour local time.' },
            location: { type: 'string' },
          },
        },
      },
    },
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const body = await req.json() as RequestBody
    const userId = await authenticateRequest(req, {}, supabase)

    if (!body.classId) {
      return jsonResponse({ success: false, error: 'classId is required' }, 200)
    }

    await assertClassAccess(supabase, userId, body.classId)

    if (body.action === 'extract') {
      const payload = await handleExtract(supabase, userId, body)
      return jsonResponse({ success: true, payload }, 200)
    }

    if (body.action === 'commit') {
      const counts = await handleCommit(supabase, userId, body)
      return jsonResponse({ success: true, counts }, 200)
    }

    return jsonResponse({ success: false, error: 'Unknown action' }, 200)
  } catch (err) {
    console.error('school-import error:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }, 200)
  }
})

async function handleExtract(
  supabase: SupabaseClient,
  userId: string,
  body: RequestBody
): Promise<CourseImportPayload> {
  const documentIds = body.documentIds ?? []
  if (documentIds.length === 0) {
    throw new Error('Select at least one PDF to analyze.')
  }

  const { data: documents, error } = await supabase
    .from('class_documents')
    .select('id, user_id, class_id, name, storage_path, mime_type, size_bytes, kind')
    .eq('user_id', userId)
    .eq('class_id', body.classId)
    .in('id', documentIds)

  if (error) throw error
  if (!documents || documents.length !== documentIds.length) {
    throw new Error('One or more selected documents were not found.')
  }

  const pdfDocs = documents as DbClassDocument[]
  for (const doc of pdfDocs) {
    if (doc.mime_type !== 'application/pdf' || !doc.name.toLowerCase().endsWith('.pdf')) {
      throw new Error(`Only PDF documents are supported for import: ${doc.name}`)
    }
  }

  const aiConfig = await loadAIConfig(supabase, userId)
  if (!aiConfig?.key) {
    throw new Error('Configure an AI provider and API key in Settings before analyzing course documents.')
  }

  const aiDocuments: InlineAIDocument[] = []
  for (const doc of pdfDocs) {
    const { data, error: downloadError } = await supabase.storage
      .from('class-documents')
      .download(doc.storage_path)
    if (downloadError) throw downloadError
    const buffer = await data.arrayBuffer()
    aiDocuments.push({
      name: doc.name,
      mediaType: doc.mime_type,
      base64: arrayBufferToBase64(buffer),
    })
  }

  const prompt = buildExtractionPrompt(pdfDocs, body.extraInstructions)
  const result = await callAIWithDocuments(
    prompt,
    [COURSE_IMPORT_TOOL],
    { key: aiConfig.key, provider: aiConfig.provider },
    {
      model: aiConfig.model,
      documents: aiDocuments,
      maxTokens: 8192,
      toolChoice: 'any',
      systemPrompt: 'You extract structured school planning data from course PDFs. Use only the provided documents. If a date or time is ambiguous, omit that item instead of guessing.',
    }
  )

  let toolInput = result.toolCalls.find(call => call.name === 'submit_course_import')?.input ?? parsePayloadFromText(result.content)
  if (!toolInput && aiConfig.provider === 'gemini') {
    toolInput = await callGeminiJsonExtraction(aiConfig.key, aiConfig.model, aiDocuments, prompt)
  }
  if (!toolInput) {
    const textHint = result.content ? ` Output started with: "${result.content.slice(0, 240)}"` : ''
    throw new Error(`The AI did not return a structured course import preview. ${result.provider}/${result.model} returned ${result.stopReason} without usable tool or JSON output.${textHint}`)
  }

  const payload = normalizePayload({
    ...(toolInput as Record<string, unknown>),
    sourceDocumentId: pdfDocs[0]?.id,
  })

  const { error: updateError } = await supabase
    .from('class_documents')
    .update({ extracted_summary: payload })
    .eq('user_id', userId)
    .eq('class_id', body.classId)
    .in('id', documentIds)
  if (updateError) throw updateError

  return payload
}

async function callGeminiJsonExtraction(
  apiKey: string,
  model: string | undefined,
  documents: InlineAIDocument[],
  prompt: string
): Promise<Record<string, unknown> | null> {
  const resolvedModel = model || 'gemini-2.5-flash'
  const body = {
    contents: [{
      role: 'user',
      parts: [
        ...documents.map(doc => ({
          inline_data: {
            mime_type: doc.mediaType,
            data: doc.base64,
          },
        })),
        {
          text: `${prompt}

Return only valid JSON. Do not use markdown. Keep output compact: at most 20 assignments, at most 8 checkpoints per assignment, and at most 6 subitems per checkpoint. The JSON object must have exactly these top-level keys:
{
  "summary": "2-4 sentence overview",
  "assignments": [
    {
      "title": "string",
      "description": "string optional",
      "deadline": "ISO datetime",
      "estimatedMinutes": 60,
      "checkpoints": [
        { "number": 1, "title": "string", "subitems": ["string"], "notes": "string" }
      ]
    }
  ],
  "sessions": [
    { "dayOfWeek": 1, "startTime": "09:00", "endTime": "10:30", "location": "string optional" }
  ]
}`,
        },
      ],
    }],
    systemInstruction: {
      parts: [{
        text: 'You extract structured school planning data from course PDFs. Return only explicit data from the provided documents. If a date or time is ambiguous, omit that item instead of guessing.',
      }],
    },
    generationConfig: {
      maxOutputTokens: 8192,
      responseMimeType: 'application/json',
    },
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    throw new Error(`Gemini JSON fallback error: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts || []
  const content = parts.map((part: { text?: string }) => part.text || '').join('')
  const parsed = parsePayloadFromText(content)
  if (!parsed) {
    const feedback = data.promptFeedback ? ` promptFeedback=${JSON.stringify(data.promptFeedback)}` : ''
    const finish = candidate?.finishReason ? ` finishReason=${candidate.finishReason}` : ''
    throw new Error(`Gemini did not return usable JSON.${finish}${feedback}`)
  }
  return parsed
}

async function handleCommit(
  supabase: SupabaseClient,
  userId: string,
  body: RequestBody
): Promise<{ assignments: number; sessions: number }> {
  if (!body.payload) {
    throw new Error('payload is required')
  }

  const payload = normalizePayload(body.payload)
  let assignmentsCount = 0
  let sessionsCount = 0
  const insertedAssignmentIds: string[] = []
  const insertedSessionIds: string[] = []

  try {
    const includedAssignments = payload.assignments.filter(a => a.include !== false)
    for (const assignment of includedAssignments) {
      const deadline = new Date(assignment.deadline)
      if (Number.isNaN(deadline.getTime())) continue

      const { data: inserted, error } = await supabase
        .from('assignments')
        .insert({
          user_id: userId,
          class_id: body.classId,
          source_document_id: payload.sourceDocumentId ?? null,
          title: assignment.title,
          description: assignment.description || null,
          deadline: deadline.toISOString(),
          status: 'pending',
          estimated_minutes: assignment.estimatedMinutes ?? null,
          checkpoints: toCheckpointItems(assignment.checkpoints ?? []),
        })
        .select('id')
        .single()

      if (error) throw error
      insertedAssignmentIds.push(inserted.id)
      assignmentsCount += 1
    }

    const includedSessions = payload.sessions.filter(s => s.include !== false)
    if (includedSessions.length > 0) {
      const rows = includedSessions
        .filter(s => Number.isInteger(s.dayOfWeek) && s.dayOfWeek >= 0 && s.dayOfWeek <= 6)
        .filter(s => isTimeString(s.startTime) && isTimeString(s.endTime))
        .map(s => ({
          user_id: userId,
          class_id: body.classId,
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
          location: s.location || null,
        }))

      if (rows.length > 0) {
        const { data: sessions, error } = await supabase
          .from('class_sessions')
          .insert(rows)
          .select('id')
        if (error) throw error
        insertedSessionIds.push(...(sessions ?? []).map((session: { id: string }) => session.id))
        sessionsCount = rows.length
      }
    }

    return { assignments: assignmentsCount, sessions: sessionsCount }
  } catch (err) {
    await rollbackInsertedRows(supabase, userId, {
      assignmentIds: insertedAssignmentIds,
      sessionIds: insertedSessionIds,
    })
    throw err
  }
}

async function assertClassAccess(
  supabase: SupabaseClient,
  userId: string,
  classId: string
): Promise<void> {
  const { data, error } = await supabase
    .from('classes')
    .select('id')
    .eq('id', classId)
    .eq('user_id', userId)
    .single()
  if (error || !data) {
    throw new Error('Class not found.')
  }
}

async function loadAIConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<{ key: string; provider: string; model?: string } | undefined> {
  const { data } = await supabase
    .from('settings')
    .select('key, value')
    .eq('user_id', userId)
    .in('key', ['ai_aiProvider', 'ai_aiApiKey', 'ai_aiModel'])

  const settings = (data ?? []).reduce((acc: Record<string, string>, s: { key: string; value: string }) => {
    acc[s.key] = s.value
    return acc
  }, {})

  const key = settings.ai_aiApiKey || ''
  if (!key) return undefined

  const rawModel = settings.ai_aiModel
  return {
    key,
    provider: settings.ai_aiProvider || 'anthropic',
    model: rawModel && rawModel !== 'null' ? rawModel : undefined,
  }
}

async function rollbackInsertedRows(
  supabase: SupabaseClient,
  userId: string,
  rows: { assignmentIds: string[]; sessionIds: string[] }
): Promise<void> {
  if (rows.sessionIds.length > 0) {
    await supabase.from('class_sessions').delete().eq('user_id', userId).in('id', rows.sessionIds)
  }
  if (rows.assignmentIds.length > 0) {
    await supabase.from('assignments').delete().eq('user_id', userId).in('id', rows.assignmentIds)
  }
}

function buildExtractionPrompt(documents: DbClassDocument[], extraInstructions?: string): string {
  const docList = documents.map((doc, index) =>
    `${index + 1}. ${doc.name} (${doc.kind}, ${Math.round(doc.size_bytes / 1024)} KB)`
  ).join('\n')

  return `Extract planning data for this school class from the attached PDFs.

Documents:
${docList}

Return only data that is explicit in the documents:
- assignments with deadlines and optional estimated workload
- checkpoint/subtask breakdowns for assignments
- recurring weekly class sessions

Use ISO 8601 datetimes for deadlines. Use 24-hour HH:mm for class sessions. dayOfWeek is 0=Sunday through 6=Saturday.
Keep the preview compact: at most 20 assignments, at most 8 checkpoints per assignment, and at most 6 subitems per checkpoint. Prefer concise titles and short notes over long copied passages.
You must call the submit_course_import tool. If your provider cannot call tools, return only valid JSON matching that tool schema with no markdown fences.
${extraInstructions?.trim() ? `\nExtra context from the user:\n${extraInstructions.trim()}` : ''}`
}

function parsePayloadFromText(content: string): Record<string, unknown> | null {
  const text = content.trim()
  if (!text) return null

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = [
    fenced?.[1],
    text,
    text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1),
  ].filter((candidate): candidate is string => Boolean(candidate?.trim()))

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      // Try the next candidate.
    }
  }
  return null
}

function normalizePayload(input: Record<string, unknown> | CourseImportPayload): CourseImportPayload {
  const assignmentsRaw = Array.isArray(input.assignments) ? input.assignments : []
  const sessionsRaw = Array.isArray(input.sessions) ? input.sessions : []

  return {
    summary: typeof input.summary === 'string' ? input.summary : '',
    sourceDocumentId: typeof input.sourceDocumentId === 'string' ? input.sourceDocumentId : undefined,
    assignments: assignmentsRaw
      .map(a => normalizeAssignment(a as Record<string, unknown>))
      .filter((a): a is CourseImportAssignment => Boolean(a)),
    sessions: sessionsRaw
      .map(s => normalizeSession(s as Record<string, unknown>))
      .filter((s): s is CourseImportSession => Boolean(s)),
  }
}

function normalizeAssignment(input: Record<string, unknown>): CourseImportAssignment | null {
  if (typeof input.title !== 'string' || !input.title.trim()) return null
  if (typeof input.deadline !== 'string' || !input.deadline.trim()) return null
  const checkpoints = Array.isArray(input.checkpoints)
    ? input.checkpoints
      .map(c => normalizeCheckpoint(c as Record<string, unknown>))
      .filter((c): c is CourseImportCheckpoint => Boolean(c))
    : []

  return {
    title: input.title.trim(),
    description: typeof input.description === 'string' ? input.description.trim() : undefined,
    deadline: input.deadline,
    estimatedMinutes: typeof input.estimatedMinutes === 'number' ? input.estimatedMinutes : undefined,
    checkpoints,
    include: typeof input.include === 'boolean' ? input.include : true,
  }
}

function normalizeCheckpoint(input: Record<string, unknown>): CourseImportCheckpoint | null {
  if (typeof input.title !== 'string' || !input.title.trim()) return null
  return {
    number: typeof input.number === 'number' || typeof input.number === 'string' ? input.number : 1,
    title: input.title.trim(),
    subitems: Array.isArray(input.subitems) ? input.subitems.filter((s): s is string => typeof s === 'string') : [],
    notes: typeof input.notes === 'string' ? input.notes : '',
  }
}

function normalizeSession(input: Record<string, unknown>): CourseImportSession | null {
  if (typeof input.dayOfWeek !== 'number') return null
  if (typeof input.startTime !== 'string' || typeof input.endTime !== 'string') return null
  return {
    dayOfWeek: input.dayOfWeek,
    startTime: input.startTime,
    endTime: input.endTime,
    location: typeof input.location === 'string' ? input.location.trim() : undefined,
    include: typeof input.include === 'boolean' ? input.include : true,
  }
}

function toCheckpointItems(checkpoints: CourseImportCheckpoint[]) {
  return checkpoints.map((checkpoint, index) => ({
    id: crypto.randomUUID(),
    number: String(checkpoint.number || index + 1),
    title: checkpoint.title,
    subitems: checkpoint.subitems ?? [],
    notes: checkpoint.notes ?? '',
    done: false,
  }))
}

function isTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize)
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
