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
