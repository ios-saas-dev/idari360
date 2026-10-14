import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendActionNotificationEmail } from '@/lib/email';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;

  let query = supabase
    .from('actions')
    .select(`*, responsible:profiles!actions_responsible_user_id_fkey(id, full_name, email), creator:profiles!actions_created_by_fkey(id, full_name), facility:facilities(id, name)`, { count: 'exact' })
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .range((page-1)*limit, page*limit-1);

  if (!['super_admin','company_admin'].includes(profile.role) && profile.facility_id) {
    query = query.eq('facility_id', profile.facility_id);
  }
  if (profile.role === 'employee') query = query.eq('responsible_user_id', user.id);
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (search) query = query.or(`title.ilike.%${search}%,action_number.ilike.%${search}%`);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data, count, page, totalPages: Math.ceil((count||0)/limit) });
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'Profile incomplete' }, { status: 400 });

  const body = await request.json();
  const { title, description, category, priority, responsible_user_id, due_date, audit_id, facility_id } = body;
  if (!title || !responsible_user_id) return NextResponse.json({ error: 'Başlık ve sorumlu kişi zorunlu' }, { status: 400 });

  const { data, error } = await supabase.from('actions').insert({
    company_id: profile.company_id,
    facility_id: facility_id || profile.facility_id,
    audit_id: audit_id || null,
    title, description: description || '',
    category: category || 'diger',
    priority: priority || 'orta',
    responsible_user_id,
    status: 'acik',
    due_date: due_date || null,
    created_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('action_history').insert({
    action_id: data.id,
    new_status: 'acik',
    changed_by: user.id,
    note: 'Aksiyon oluşturuldu',
  });

  // Sorumlu kişiye e-posta bildirimi gönder (Resend Email)
  if (data?.responsible_user_id) {
    const { data: respProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', data.responsible_user_id)
      .single();

    if (respProfile?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://idari360.com';
      sendActionNotificationEmail({
        to: respProfile.email,
        recipientName: respProfile.full_name,
        actionNumber: data.action_number || 'Aksiyon',
        title: data.title,
        priority: data.priority,
        dueDate: data.due_date,
        actionUrl: `${baseUrl}/dashboard/actions`,
      }).catch((e) => console.error('[sendActionNotificationEmail error]', e));
    }
  }

  return NextResponse.json({ data }, { status: 201 });
}
