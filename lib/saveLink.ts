import { supabase } from './supabase';
import { extractOG } from './og';

export async function saveLink(
  url: string,
  userId: string,
  collectionId?: string | null,
): Promise<{ error: string | null }> {
  const normalized = url.startsWith('http') ? url : `https://${url}`;
  const og = await extractOG(normalized);

  const { error } = await supabase.from('links').insert({
    user_id: userId,
    url: normalized,
    title: og.title,
    description: og.description,
    image_url: og.image_url,
    collection_id: collectionId ?? null,
  });

  return { error: error?.message ?? null };
}
