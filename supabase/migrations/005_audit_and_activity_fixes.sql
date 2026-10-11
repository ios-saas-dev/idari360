-- ==============================================================================
-- İDARİ360 - MIGRATION 005: AKTİVİTE LOG VE ŞABLON KOPYALAMA DÜZELTMELERİ
-- ==============================================================================

-- 1. Platform düzeyinde ve Süper Admin logları için activity_logs.company_id NULL yapılabilir olmalı
ALTER TABLE public.activity_logs ALTER COLUMN company_id DROP NOT NULL;

-- 2. activity_logs insert politikasını NULL company_id kabul edecek şekilde güncelle
DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;
CREATE POLICY "activity_logs_insert_authenticated"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR (company_id IS NULL AND public.is_super_admin())
  );

-- 3. copy_audit_templates_for_company iç içe döngü değişken gölgeleme düzeltmesi
CREATE OR REPLACE FUNCTION public.copy_audit_templates_for_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_type_id uuid;
    v_cat_id uuid;
    rec_mod RECORD;
    rec_cat RECORD;
BEGIN
    -- Her modül için audit_type oluştur
    FOR rec_mod IN (SELECT DISTINCT module FROM audit_question_templates) LOOP
        INSERT INTO audit_types (company_id, module, name, description, max_score, is_active)
        VALUES (
            NEW.id,
            rec_mod.module,
            CASE rec_mod.module
                WHEN 'yemekhane_yerinde' THEN 'Yemekhane Yerinde Üretim Denetimi'
                WHEN 'yemekhane_tasima' THEN 'Yemekhane Taşıma Denetimi'
                WHEN 'servis' THEN 'Servis Denetimi'
                WHEN 'temizlik' THEN 'Temizlik Denetimi'
                WHEN 'guvenlik' THEN 'Güvenlik Denetimi'
            END,
            CASE rec_mod.module
                WHEN 'yemekhane_yerinde' THEN 'Yerinde üretim yapan yemekhane hijyen denetimi'
                WHEN 'yemekhane_tasima' THEN 'Taşıma yemekhane hijyen denetimi'
                WHEN 'servis' THEN 'Personel servis aracı denetimi'
                WHEN 'temizlik' THEN 'Genel temizlik denetimi'
                WHEN 'guvenlik' THEN 'Güvenlik hizmetleri denetimi'
            END,
            100,
            true
        )
        RETURNING id INTO v_type_id;

        -- Her kategori için audit_category oluştur
        FOR rec_cat IN (
            SELECT DISTINCT category_name, category_sort_order, category_max_score
            FROM audit_question_templates
            WHERE module = rec_mod.module
            ORDER BY category_sort_order
        ) LOOP
            INSERT INTO audit_categories (audit_type_id, name, max_score, sort_order)
            VALUES (v_type_id, rec_cat.category_name, rec_cat.category_max_score, rec_cat.category_sort_order)
            RETURNING id INTO v_cat_id;

            -- Soruları kopyala
            INSERT INTO audit_questions (category_id, question_text, max_points, sort_order, is_active)
            SELECT v_cat_id, question_text, max_points, sort_order, true
            FROM audit_question_templates
            WHERE module = rec_mod.module AND category_name = rec_cat.category_name
            ORDER BY sort_order;
        END LOOP;
    END LOOP;

    RETURN NEW;
END;
$$;
