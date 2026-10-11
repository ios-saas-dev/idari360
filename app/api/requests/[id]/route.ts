import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;

  const { data, error } = await supabase
    .from('requests')
    .select(`
      *,
      creator:profiles!requests_created_by_fkey(id, full_name, email, avatar_url),
      assignee:profiles!requests_assigned_to_fkey(id, full_name, email, avatar_url),
      approver:profiles!requests_approved_by_fkey(id, full_name, email, avatar_url),
      facility:facilities(id, name, city),
      request_comments(id, comment, created_at, user:profiles(id, full_name, avatar_url)),
      request_history(id, old_status, new_status, note, created_at, changer:profiles(id, full_name))
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

  const body = await request.json();
  const { status, assigned_to, approved_by, note, title, description, priority } = body;

  // Get current request
  const { data: currentReq } = await supabase.from('requests').select('status, created_by, company_id').eq('id', id).single();
  if (!currentReq) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });
  if (currentReq.company_id !== profile.company_id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

  // Role-based permission for status changes
  const isMgr = ['super_admin', 'company_admin', 'facility_manager', 'facility_officer'].includes(profile.role);
  const isCreator = currentReq.created_by === user.id;

  const updates: Record<string, unknown> = {};
  if (title && isMgr) updates.title = title;
  if (description && isMgr) updates.description = description;
  if (priority && isMgr) updates.priority = priority;
  if (assigned_to !== undefined && isMgr) updates.assigned_to = assigned_to;
  if (approved_by !== undefined && isMgr) updates.approved_by = approved_by;
  if (status) {
    // employee can only cancel their own new requests
    if (profile.role === 'employee' && !(isCreator && currentReq.status === 'yeni' && status === 'reddedildi')) {
      return NextResponse.json({ error: 'Durum değiştirme yetkiniz yok' }, { status: 403 });
    }
    updates.status = status;
  }

  const { data: updated, error } = await supabase.from('requests').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log status change
  if (status && status !== currentReq.status) {
    await supabase.from('request_history').insert({
      request_id: id,
      old_status: currentReq.status,
      new_status: status,
      changed_by: user.id,
      note: note || null,
    });
  }

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const { id } = await params;
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();

  const { data: req } = await supabase.from('requests').select('created_by, status').eq('id', id).single();
  if (!req) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 });

  const isAdmin = ['super_admin', 'company_admin'].includes(profile?.role || '');
  const isCreatorAndNew = req.created_by === user.id && req.status === 'yeni';
  if (!isAdmin && !isCreatorAndNew) return NextResponse.json({ error: 'Silme yetkiniz yok' }, { status: 403 });

  const { error } = await supabase.from('requests').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
