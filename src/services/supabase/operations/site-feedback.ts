import { supabase, isSupabaseConfigured } from '../client';

export interface SiteFeedback {
  id?: string;
  type: 'bug' | 'feature' | 'note';
  description: string;
  html_snippet: string;
  selector: string;
  pathname: string;
  created_at?: string;
}

export async function saveFeedback(feedback: SiteFeedback): Promise<SiteFeedback | null> {
  if (!isSupabaseConfigured) {
    console.warn('Supabase not configured, cannot save feedback.');
    return null;
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .insert([{
      type: feedback.type,
      description: feedback.description,
      html_snippet: feedback.html_snippet,
      selector: feedback.selector,
      pathname: feedback.pathname
    }])
    .select()
    .single();

  if (error) {
    console.error('Error saving feedback:', error);
    throw error;
  }

  return data;
}

/**
 * Fetch every feedback report, newest first. The app is a single SPA route
 * (no router), so per-page scoping never applied — one list shows everything.
 */
export async function getAllFeedback(): Promise<SiteFeedback[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }

  return data || [];
}

export async function getFeedbackForPath(pathname: string): Promise<SiteFeedback[]> {
  if (!isSupabaseConfigured) {
    return [];
  }

  const { data, error } = await supabase
    .from('site_feedback')
    .select('*')
    .eq('pathname', pathname)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching feedback:', error);
    return [];
  }

  return data || [];
}

export async function deleteFeedback(id: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  const { error } = await supabase
    .from('site_feedback')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting feedback:', error);
    return false;
  }

  return true;
}

export async function deleteManyFeedback(ids: string[]): Promise<boolean> {
  if (!isSupabaseConfigured || ids.length === 0) {
    return false;
  }

  const { error } = await supabase
    .from('site_feedback')
    .delete()
    .in('id', ids);

  if (error) {
    console.error('Error deleting feedback batch:', error);
    return false;
  }

  return true;
}

/**
 * Delete every feedback report. Pass a pathname to clear only one page's
 * reports; omit it to wipe the whole table.
 */
export async function deleteAllFeedback(pathname?: string): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }

  let query = supabase.from('site_feedback').delete();
  if (pathname) {
    query = query.eq('pathname', pathname);
  } else {
    // PostgREST refuses an unfiltered delete; this matches every row.
    query = query.not('id', 'is', null);
  }

  const { error } = await query;

  if (error) {
    console.error('Error clearing feedback:', error);
    return false;
  }

  return true;
}
