import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  // Fetch action with all related data including audit context
  const { data, error } = await supabase
    .from('actions')
    .select(`
      *,
      responsible:profiles!actions_responsible_user_id_fkey(id, full_name, email, avatar_url),
      creator:profiles!actions_created_by_fkey(id, full_name, email),
      facility:facilities(id, name, city),
      action_history(id, old_status, new_status, note, created_at, changer:profiles(id, full_name)),
      action_photos(id, photo_url, created_at, uploader:profiles(id, full_name))
    `)
    .eq('id', id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });

  // If action has audit_id, fetch audit context separately
  let auditContext = null;
  if (data.audit_id) {
    const { data: audit } = await supabase
      .from('audits')
      .select(`
        id, title, audit_date, total_score, max_possible_score, percentage, status,
        audit_type:audit_types(id, name, module),
        service_vehicle:service_vehicles(id, plate_number, route_name, brand, model)
      `)
      .eq('id', data.audit_id)
      .single();
    auditContext = audit;
  }

  // If action has audit_answer_id, fetch the linked answer with question
  let auditAnswerContext = null;
  if (data.audit_answer_id) {
    const { data: answer } = await supabase
      .from('audit_answers')
      .select(`
        id, answer, note, photo_url, due_date,
        question:audit_questions(id, question_text)
      `)
      .eq('id', data.audit_answer_id)
      .single();
    auditAnswerContext = answer;
  } else if (data.audit_question_id) {
    // Fallback: fetch question text from audit_question_id
    const { data: question } = await supabase
      .from('audit_questions')
      .select('id, question_text')
      .eq('id', data.audit_question_id)
      .single();
    auditAnswerContext = { question };
  }

  return NextResponse.json({
    data: {
      ...data,
      audit: auditContext,
      audit_answer: auditAnswerContext,
    }
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  const { id } = await params;
  const body = await request.json();
  const { status, note, ...rest } = body;

  const { data: current } = await supabase.from('actions').select('status, company_id').eq('id', id).single();
  if (!current || current.company_id !== profile!.company_id) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 });

  const updates: Record<string,unknown> = { ...rest };
  if (status) { updates.status = status; if (status === 'kapali') updates.closed_at = new Date().toISOString(); }

  const { data, error } = await supabase.from('actions').update(updates).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status && status !== current.status) {
    await supabase.from('action_history').insert({ action_id: id, old_status: current.status, new_status: status, changed_by: user.id, note: note || null });
  }
  return NextResponse.json({ data });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, role').eq('id', user.id).single();
  if (!['super_admin','company_admin'].includes(profile?.role || '')) return NextResponse.json({ error: 'Yetersiz yetki' }, { status: 403 });
  const { id } = await params;
  const { error } = await supabase.from('actions').delete().eq('id', id).eq('company_id', profile!.company_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
