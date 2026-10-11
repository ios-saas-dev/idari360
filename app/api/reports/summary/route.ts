import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id, facility_id, role').eq('id', user.id).single();
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cid = profile.company_id;
  const fid = ['super_admin','company_admin'].includes(profile.role) ? null : profile.facility_id;

  const [requests, actions, audits, assets] = await Promise.all([
    supabase.from('requests').select('id, status, category, priority, created_at').eq('company_id', cid).then(r => r.data || []),
    supabase.from('actions').select('id, status, priority, created_at, due_date').eq('company_id', cid).then(r => r.data || []),
    supabase.from('audits').select('id, status, percentage, audit_date').eq('company_id', cid).then(r => r.data || []),
    supabase.from('assets').select('id, status, category').eq('company_id', cid).then(r => r.data || []),
  ]);

  // Monthly request counts last 6 months
  const now = new Date();
  const monthlyRequests = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const month_label = d.toLocaleDateString('tr-TR', { month: 'short' });
    const count = requests.filter((r: any) => r.created_at?.startsWith(key)).length;
    return { month: month_label, count };
  });

  const summary = {
    requests: {
      total: requests.length,
      by_status: {
        yeni: requests.filter((r: any) => r.status === 'yeni').length,
        islemde: requests.filter((r: any) => r.status === 'islemde').length,
        tamamlandi: requests.filter((r: any) => r.status === 'tamamlandi').length,
        reddedildi: requests.filter((r: any) => r.status === 'reddedildi').length,
      },
      by_category: ['yemekhane','servis','temizlik','filo','varlik','teknik','diger'].map(cat => ({
        category: cat, count: requests.filter((r: any) => r.category === cat).length
      })),
      monthly: monthlyRequests,
    },
    actions: {
      total: actions.length,
      open: actions.filter((a: any) => a.status === 'acik').length,
      in_progress: actions.filter((a: any) => a.status === 'devam_ediyor').length,
      closed: actions.filter((a: any) => a.status === 'kapali').length,
      overdue: actions.filter((a: any) => ['acik','devam_ediyor'].includes(a.status) && a.due_date && new Date(a.due_date) < now).length,
    },
    audits: {
      total: audits.length,
      completed: audits.filter((a: any) => a.status === 'completed').length,
      avg_score: audits.length > 0 ? Math.round(audits.reduce((sum: number, a: any) => sum + (a.percentage || 0), 0) / audits.length) : 0,
    },
    assets: {
      total: assets.length,
      active: assets.filter((a: any) => a.status === 'aktif').length,
      in_transfer: assets.filter((a: any) => a.status === 'devirde').length,
      broken: assets.filter((a: any) => a.status === 'ariza').length,
    },
  };

  return NextResponse.json({ data: summary });
}
