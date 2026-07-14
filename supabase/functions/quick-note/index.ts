import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { authenticateCaptureToken } from '../_shared/capture-token.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NoteRequest {
    content: string;
    api_key?: string; // Optional: for authenticating without full auth flow
}

/**
 * Parses note content to extract flag and clean content.
 * Flags are words starting with '-' (e.g., "-boodschap", "-todo")
 */
function parseNoteContent(content: string): { cleanContent: string; flag: string | null } {
    const flagMatch = content.match(/-(\w+)/);
    if (flagMatch) {
        const flag = flagMatch[1].toLowerCase();
        const cleanContent = content.replace(/-\w+/, '').trim();
        return { cleanContent, flag };
    }
    return { cleanContent: content, flag: null };
}

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

        const body: NoteRequest = await req.json();

        if (!body.content || body.content.trim() === '') {
            return new Response(JSON.stringify({ error: 'Content is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Create Supabase client with service role key (bypasses RLS)
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const userId = body.api_key ? await authenticateCaptureToken(body.api_key, supabase) : null;

        if (!userId) {
            return new Response(JSON.stringify({ error: 'Invalid or missing api_key' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Parse the note content for flags
        const { cleanContent, flag } = parseNoteContent(body.content);

        // Find matching category by flag
        let categoryId: string | null = null;
        if (flag) {
            const { data: category } = await supabase
                .from('note_categories')
                .select('id')
                .eq('user_id', userId)
                .ilike('flag', flag)
                .single();

            if (category) {
                categoryId = category.id;
            }
        }

        // Insert the note
        const { data: note, error: insertError } = await supabase
            .from('smart_notes')
            .insert({
                user_id: userId,
                content: cleanContent,
                category_id: categoryId,
                flag: flag,
                processed: false,
            })
            .select()
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return new Response(JSON.stringify({ error: 'Failed to save note' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Get category name for response
        let categoryName = 'Inbox';
        if (categoryId) {
            const { data: cat } = await supabase
                .from('note_categories')
                .select('name')
                .eq('id', categoryId)
                .single();
            if (cat) categoryName = cat.name;
        }

        return new Response(
            JSON.stringify({
                success: true,
                note_id: note.id,
                sorted_to: categoryName,
                flag_detected: flag,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
