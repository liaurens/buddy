/**
 * Settings Operations (simple key-value store)
 */

import { supabase } from '../client';

export async function getSetting(userId: string, key: string): Promise<string | undefined> {
    const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('user_id', userId)
        .eq('key', key)
        .single();

    return data?.value;
}

export async function setSetting(userId: string, key: string, value: string): Promise<void> {
    const { error } = await supabase
        .from('settings')
        .upsert({ user_id: userId, key, value }, { onConflict: 'user_id,key' });

    if (error) {
        console.error('Error setting value:', error);
    }
}
