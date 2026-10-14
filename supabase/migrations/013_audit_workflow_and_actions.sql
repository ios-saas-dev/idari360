-- ==============================================================================
-- İDARİ360 - MIGRATION 013: DENETİM İŞ AKIŞI, DİNAMİK CEVAPLAR VE AKSİYON ENTEGRASYONU
-- ==============================================================================

-- 1. audits tablosuna başlık ve tamamlanma zamanı ekleme
ALTER TABLE public.audits
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- 2. audit_answers tablosuna termin tarihi (deadline), aksiyon ve görsel alanları ekleme
ALTER TABLE public.audit_answers
ADD COLUMN IF NOT EXISTS due_date DATE,
ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES public.actions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 3. actions tablosuna denetim sorusu ve cevabı referanslarını ekleme
ALTER TABLE public.actions
ADD COLUMN IF NOT EXISTS audit_answer_id UUID REFERENCES public.audit_answers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS audit_question_id UUID REFERENCES public.audit_questions(id) ON DELETE SET NULL;

-- 4. Servis Denetimi kategori puanlarının Excel şablonuna uygun güncellenmesi (20p x 5 kategori = 100p)
DO $$
DECLARE
    v_servis_type_id UUID;
    v_cat_temizlik UUID;
    v_cat_personel UUID;
    v_cat_isg UUID;
    v_cat_evrak UUID;
    v_cat_yolcu UUID;
BEGIN
    SELECT id INTO v_servis_type_id FROM public.audit_types WHERE module = 'servis' LIMIT 1;
    
    IF v_servis_type_id IS NOT NULL THEN
        -- Temizlik Kategorisi
        INSERT INTO public.audit_categories (audit_type_id, name, max_score, sort_order)
        VALUES (v_servis_type_id, 'Temizlik & Hijyen', 20.00, 1)
        ON CONFLICT DO NOTHING;
        
        -- Personel / Sürücü Kategorisi
        INSERT INTO public.audit_categories (audit_type_id, name, max_score, sort_order)
        VALUES (v_servis_type_id, 'Personel & Sürücü Davranışı', 20.00, 2)
        ON CONFLICT DO NOTHING;

        -- İş Güvenliği & Donanım Kategorisi
        INSERT INTO public.audit_categories (audit_type_id, name, max_score, sort_order)
        VALUES (v_servis_type_id, 'İş Güvenliği & Araç Donanımı', 20.00, 3)
        ON CONFLICT DO NOTHING;

        -- Evraklar Kategorisi
        INSERT INTO public.audit_categories (audit_type_id, name, max_score, sort_order)
        VALUES (v_servis_type_id, 'Resmi Evraklar & Belgeler', 20.00, 4)
        ON CONFLICT DO NOTHING;

        -- Müşteri / Yolcu Alanı Kategorisi
        INSERT INTO public.audit_categories (audit_type_id, name, max_score, sort_order)
        VALUES (v_servis_type_id, 'Yolcu Konfor Alanı & Klima', 20.00, 5)
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- 5. İndeksler
CREATE INDEX IF NOT EXISTS idx_audit_answers_audit_id ON public.audit_answers(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_answers_question_id ON public.audit_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_actions_audit_id ON public.actions(audit_id);
