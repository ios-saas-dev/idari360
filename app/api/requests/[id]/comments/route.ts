import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;
  const body = await request.json();
  const { comment } = body;
  if (!comment?.trim()) return NextResponse.json({ error: 'Yorum boş olamaz' }, { status: 400 });

  const { data, error } = await supabase.from('request_comments').insert({
    request_id: id,
    user_id: user.id,
    comment: comment.trim(),
  }).select('id, comment, created_at, user:profiles(id, full_name, avatar_url)').single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
