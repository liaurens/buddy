// Supabase Edge Function: Calendar Proxy
// Fetches iCal/CalDAV feeds server-side to bypass CORS restrictions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { url } = await req.json()

    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Normalize URL (webcal:// -> https://)
    let normalizedUrl = url
    if (normalizedUrl.startsWith('webcal://')) {
      normalizedUrl = normalizedUrl.replace('webcal://', 'https://')
    }
    if (normalizedUrl.startsWith('http://')) {
      normalizedUrl = normalizedUrl.replace('http://', 'https://')
    }

    console.log('Fetching calendar from:', normalizedUrl)

    // Fetch the calendar data
    const response = await fetch(normalizedUrl, {
      headers: {
        'Accept': 'text/calendar, text/plain, */*',
        'User-Agent': 'BuddyApp/1.0 Calendar Sync',
      },
    })

    if (!response.ok) {
      console.error('Calendar fetch failed:', response.status, response.statusText)
      return new Response(
        JSON.stringify({
          error: `Failed to fetch calendar: ${response.status} ${response.statusText}`
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const icalData = await response.text()
    console.log('Received iCal data, length:', icalData.length)

    // Verify it's valid iCal data
    if (!icalData.includes('BEGIN:VCALENDAR')) {
      return new Response(
        JSON.stringify({ error: 'Invalid calendar data - not in iCal format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: icalData,
        length: icalData.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Edge function error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
