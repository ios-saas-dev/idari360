-- ==============================================================================
-- İdari360 - Multi-Tenant İdari Operasyonlar Yönetimi SaaS Platformu
-- Veritabanı Şeması ve İlk Geçiş (Migration 001_core_schema.sql)
-- Supabase (PostgreSQL 15+) Uyumlu
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. GEREKLİ EKLENTİLER (EXTENSIONS)
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. ENUM TİPLERİ (CUSTOM ENUM TYPES)
-- ------------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE app_role AS ENUM (
        'super_admin',
        'company_admin',
        'facility_manager',
        'facility_officer',
        'employee'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE region_type AS ENUM (
        'Marmara',
        'Ege',
        'İç Anadolu',
        'Akdeniz',
        'Karadeniz',
        'Güneydoğu Anadolu',
        'Doğu Anadolu'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE audit_module AS ENUM (
        'yemekhane_yerinde',
        'yemekhane_tasima',
        'servis',
        'temizlik',
        'guvenlik'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE audit_status AS ENUM (
        'draft',
        'in_progress',
        'completed',
        'approved'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE answer_type AS ENUM (
        'evet',
        'hayir',
        'na'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE photo_type AS ENUM (
        'general',
        'uygunsuzluk'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE priority_level AS ENUM (
        'dusuk',
        'orta',
        'yuksek',
        'kritik'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE action_status AS ENUM (
        'acik',
        'devam_ediyor',
        'kapali',
        'gecikti'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE request_category AS ENUM (
        'yemekhane',
        'servis',
        'temizlik',
        'varlik',
        'teknik',
        'diger'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM (
        'yeni',
        'atandi',
        'onaylandi',
        'islemde',
        'tamamlandi',
        'reddedildi'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE meal_type AS ENUM (
        'kahvalti',
        'ogle',
        'aksam'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE cafeteria_service_type AS ENUM (
        'yerinde_uretim',
        'tasima'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE asset_status AS ENUM (
        'aktif',
        'devirde',
        'iade',
        'ariza',
        'bakimda',
        'kayip',
        'hurda'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE asset_action AS ENUM (
        'zimmet',
        'devir',
        'iade',
        'ariza',
        'bakim',
        'kayip',
        'hurda'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM (
        'bildirim',
        'uyari',
        'hatirlatma',
        'sistem'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
    CREATE TYPE otp_purpose AS ENUM (
        'email_verification',
        'password_reset'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ------------------------------------------------------------------------------
-- 2. TETİKLEYİCİ FONKSİYONLARI (TRIGGER FUNCTIONS)
-- ------------------------------------------------------------------------------

-- Otomatik updated_at güncelleme fonksiyonu
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Otomatik action_number oluşturma fonksiyonu (Şirket bazlı sıra no: ACT-2026-00001)
CREATE OR REPLACE FUNCTION generate_action_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year TEXT;
    next_seq INT;
BEGIN
    IF NEW.action_number IS NULL OR NEW.action_number = '' THEN
        current_year := TO_CHAR(clock_timestamp(), 'YYYY');
        
        SELECT COALESCE(MAX(
            NULLIF(SUBSTRING(action_number FROM '[0-9]+$'), '')::INT
        ), 0) + 1
        INTO next_seq
        FROM actions
        WHERE company_id = NEW.company_id
          AND action_number LIKE 'ACT-' || current_year || '-%';

        NEW.action_number := 'ACT-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Otomatik request_number oluşturma fonksiyonu (Şirket bazlı sıra no: REQ-2026-00001)
CREATE OR REPLACE FUNCTION generate_request_number()
RETURNS TRIGGER AS $$
DECLARE
    current_year TEXT;
    next_seq INT;
BEGIN
    IF NEW.request_number IS NULL OR NEW.request_number = '' THEN
        current_year := TO_CHAR(clock_timestamp(), 'YYYY');
        
        SELECT COALESCE(MAX(
            NULLIF(SUBSTRING(request_number FROM '[0-9]+$'), '')::INT
        ), 0) + 1
        INTO next_seq
        FROM requests
        WHERE company_id = NEW.company_id
          AND request_number LIKE 'REQ-' || current_year || '-%';

        NEW.request_number := 'REQ-' || current_year || '-' || LPAD(next_seq::TEXT, 5, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. ÇEKİRDEK TABLOLAR (CORE TABLES)
-- ------------------------------------------------------------------------------

-- 3.1 Şirketler (Companies)
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    logo_url TEXT,
    email_domain VARCHAR(150),
    is_active BOOLEAN NOT NULL DEFAULT true,
    subscription_plan VARCHAR(50) NOT NULL DEFAULT 'standard',
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3.2 Tesisler / Lokasyonlar (Facilities)
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    region region_type NOT NULL DEFAULT 'Marmara',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_facility_code_company UNIQUE (company_id, code)
);

-- 3.3 Kullanıcı Profilleri (Profiles - auth.users ile birebir ilişkili)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    avatar_url TEXT,
    role app_role NOT NULL DEFAULT 'employee',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 3.4 E-posta Alan Adları Eşleşmesi (Email Domains - Otomatik şirket eşleştirme)
CREATE TABLE IF NOT EXISTS email_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    domain VARCHAR(150) NOT NULL UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 4. DENETİM MODÜLÜ (AUDIT MODULE)
-- ------------------------------------------------------------------------------

-- 4.1 Denetim Türleri / Şablonları (Audit Types)
CREATE TABLE IF NOT EXISTS audit_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    module audit_module NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 100.00,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4.2 Denetim Kategorileri (Audit Categories)
CREATE TABLE IF NOT EXISTS audit_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_type_id UUID NOT NULL REFERENCES audit_types(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    max_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4.3 Denetim Soruları (Audit Questions)
CREATE TABLE IF NOT EXISTS audit_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES audit_categories(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    max_points NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4.4 Gerçekleştirilen Denetimler (Audits)
CREATE TABLE IF NOT EXISTS audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    audit_type_id UUID NOT NULL REFERENCES audit_types(id) ON DELETE RESTRICT,
    auditor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    audit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_score NUMERIC(5,2) DEFAULT 0.00,
    max_possible_score NUMERIC(5,2) DEFAULT 100.00,
    percentage NUMERIC(5,2) DEFAULT 0.00,
    status audit_status NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 4.5 Denetim Cevapları (Audit Answers)
CREATE TABLE IF NOT EXISTS audit_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES audit_questions(id) ON DELETE RESTRICT,
    answer answer_type NOT NULL DEFAULT 'evet',
    score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_audit_question UNIQUE (audit_id, question_id)
);

-- 4.6 Denetim Fotoğrafları & Kanıtlar (Audit Photos)
CREATE TABLE IF NOT EXISTS audit_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
    answer_id UUID REFERENCES audit_answers(id) ON DELETE SET NULL,
    photo_url TEXT NOT NULL,
    photo_type photo_type NOT NULL DEFAULT 'general',
    caption TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 5. AKSİYON TAKİBİ MODÜLÜ (ACTION TRACKING)
-- ------------------------------------------------------------------------------

-- 5.1 Aksiyonlar (Actions)
CREATE TABLE IF NOT EXISTS actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    audit_id UUID REFERENCES audits(id) ON DELETE SET NULL,
    action_number VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    priority priority_level NOT NULL DEFAULT 'orta',
    responsible_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status action_status NOT NULL DEFAULT 'acik',
    due_date DATE,
    closed_at TIMESTAMPTZ,
    evidence_note TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_action_number_company UNIQUE (company_id, action_number)
);

-- 5.2 Aksiyon Fotoğrafları (Action Photos)
CREATE TABLE IF NOT EXISTS action_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    photo_url TEXT NOT NULL,
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 5.3 Aksiyon Tarihçesi (Action History)
CREATE TABLE IF NOT EXISTS action_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    old_status action_status,
    new_status action_status NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 6. TALEP VE ONAY SİSTEMİ (REQUEST & APPROVAL SYSTEM)
-- ------------------------------------------------------------------------------

-- 6.1 Talepler (Requests)
CREATE TABLE IF NOT EXISTS requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    request_number VARCHAR(50) NOT NULL,
    category request_category NOT NULL DEFAULT 'diger',
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority priority_level NOT NULL DEFAULT 'orta',
    status request_status NOT NULL DEFAULT 'yeni',
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    attachment_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_request_number_company UNIQUE (company_id, request_number)
);

-- 6.2 Talep Yorumları (Request Comments)
CREATE TABLE IF NOT EXISTS request_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 6.3 Talep Tarihçesi (Request History)
CREATE TABLE IF NOT EXISTS request_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    old_status request_status,
    new_status request_status NOT NULL,
    changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 7. SERVİS YÖNETİMİ MODÜLÜ (SERVICE MANAGEMENT)
-- ------------------------------------------------------------------------------

-- 7.1 Servis Araçları (Service Vehicles)
CREATE TABLE IF NOT EXISTS service_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    plate_number VARCHAR(30) NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    model_year INT,
    capacity INT NOT NULL DEFAULT 16,
    driver_name VARCHAR(150),
    driver_phone VARCHAR(50),
    driver_documents JSONB DEFAULT '{}'::jsonb,
    route_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_vehicle_plate_company UNIQUE (company_id, plate_number)
);

-- 7.2 Servis Güzergahları (Service Routes)
CREATE TABLE IF NOT EXISTS service_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES service_vehicles(id) ON DELETE SET NULL,
    route_name VARCHAR(255) NOT NULL,
    region VARCHAR(100),
    shift_type VARCHAR(50), -- örn: 'Gündüz', 'Gece', 'Vardiya-1'
    stops JSONB NOT NULL DEFAULT '[]'::jsonb, -- durak listesi, saatler, koordinatlar
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 8. YEMEKHANE YÖNETİMİ (CAFETERIA MANAGEMENT)
-- ------------------------------------------------------------------------------

-- 8.1 Yemek Tedarikçileri (Cafeteria Suppliers)
CREATE TABLE IF NOT EXISTS cafeteria_suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    supplier_name VARCHAR(255) NOT NULL,
    contact_info JSONB DEFAULT '{}'::jsonb,
    contract_start DATE,
    contract_end DATE,
    service_type cafeteria_service_type NOT NULL DEFAULT 'tasima',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 8.2 Yemek Menüleri (Cafeteria Menus)
CREATE TABLE IF NOT EXISTS cafeteria_menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    menu_date DATE NOT NULL,
    meal_type meal_type NOT NULL DEFAULT 'ogle',
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Çorba, Ana Yemek, Yan Yemek, Tatlı/Meyve, Kalori vb.
    planned_count INT DEFAULT 0,
    actual_count INT DEFAULT 0,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_menu_per_facility UNIQUE (company_id, facility_id, menu_date, meal_type)
);

-- ------------------------------------------------------------------------------
-- 9. TEMİZLİK YÖNETİMİ (CLEANING MANAGEMENT)
-- ------------------------------------------------------------------------------

-- 9.1 Temizlik Personeli (Cleaning Staff)
CREATE TABLE IF NOT EXISTS cleaning_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    full_name VARCHAR(150) NOT NULL,
    position VARCHAR(100),
    supplier_id UUID REFERENCES cafeteria_suppliers(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 9.2 Temizlik Ekipmanları (Cleaning Equipment)
CREATE TABLE IF NOT EXISTS cleaning_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    brand VARCHAR(100),
    model VARCHAR(100),
    quantity INT NOT NULL DEFAULT 1,
    condition VARCHAR(50) DEFAULT 'İyi',
    location VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 9.3 Temizlik Planları ve Çizelgesi (Cleaning Schedules)
CREATE TABLE IF NOT EXISTS cleaning_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    area VARCHAR(255) NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- Günlük, Haftalık, Aylık
    assigned_to UUID REFERENCES cleaning_staff(id) ON DELETE SET NULL,
    last_completed TIMESTAMPTZ,
    next_due TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 10. DEMİRBAŞ / VARLIK YÖNETİMİ (ASSET MANAGEMENT)
-- ------------------------------------------------------------------------------

-- 10.1 Varlıklar / Demirbaşlar (Assets)
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    asset_code VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    location VARCHAR(255),
    assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status asset_status NOT NULL DEFAULT 'aktif',
    qr_code TEXT,
    purchase_date DATE,
    purchase_price NUMERIC(15,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_asset_code_company UNIQUE (company_id, asset_code)
);

-- 10.2 Varlık Tarihçesi ve Zimmet Hareketleri (Asset History)
CREATE TABLE IF NOT EXISTS asset_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    action asset_action NOT NULL,
    from_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    to_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 11. TEDARİKÇİ YÖNETİMİ VE KARNESİ (SUPPLIER MANAGEMENT & PERFORMANCE)
-- ------------------------------------------------------------------------------

-- 11.1 Tedarikçiler (Suppliers)
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    contact_info JSONB DEFAULT '{}'::jsonb,
    contract_start DATE,
    contract_end DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 11.2 Tedarikçi Performans Karnesi Puanları (Supplier Scores)
CREATE TABLE IF NOT EXISTS supplier_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    service_quality NUMERIC(5,2) DEFAULT 0.00,
    timeliness NUMERIC(5,2) DEFAULT 0.00,
    complaint_management NUMERIC(5,2) DEFAULT 0.00,
    staff_suitability NUMERIC(5,2) DEFAULT 0.00,
    audit_results NUMERIC(5,2) DEFAULT 0.00,
    action_closure NUMERIC(5,2) DEFAULT 0.00,
    overall_score NUMERIC(5,2) DEFAULT 0.00,
    scored_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 12. BİLDİRİMLER VE HATIRLATICILAR (NOTIFICATIONS & REMINDERS)
-- ------------------------------------------------------------------------------

-- 12.1 Bildirimler (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type notification_type NOT NULL DEFAULT 'bildirim',
    related_type VARCHAR(100),
    related_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 12.2 Planlanmış Hatırlatıcılar (Scheduled Reminders)
CREATE TABLE IF NOT EXISTS scheduled_reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    reminder_type VARCHAR(100) NOT NULL,
    related_type VARCHAR(100),
    related_id UUID,
    remind_at TIMESTAMPTZ NOT NULL,
    remind_before_days INT[] DEFAULT ARRAY[1, 3, 7]::INT[],
    recipients UUID[] DEFAULT ARRAY[]::UUID[],
    is_sent BOOLEAN NOT NULL DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 13. DUYURULAR (ANNOUNCEMENTS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    priority priority_level NOT NULL DEFAULT 'orta',
    target_facilities UUID[] DEFAULT ARRAY[]::UUID[],
    target_roles app_role[] DEFAULT ARRAY[]::app_role[],
    published_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    published_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 14. AKTİVİTE VE DENETİM İZİ KAYITLARI (ACTIVITY LOGS)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 15. DOĞRULAMA KODLARI (OTP VERIFICATION CODES)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL,
    purpose otp_purpose NOT NULL DEFAULT 'email_verification',
    expires_at TIMESTAMPTZ NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ------------------------------------------------------------------------------
-- 16. PERFORMANS VE İNDEKSLER (INDEXES)
-- ------------------------------------------------------------------------------

-- Şirket ve Tesis İndeksleri
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);
CREATE INDEX IF NOT EXISTS idx_companies_is_active ON companies(is_active);

CREATE INDEX IF NOT EXISTS idx_facilities_company_id ON facilities(company_id);
CREATE INDEX IF NOT EXISTS idx_facilities_is_active ON facilities(is_active);
CREATE INDEX IF NOT EXISTS idx_facilities_region ON facilities(region);

CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_facility_id ON profiles(facility_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);

CREATE INDEX IF NOT EXISTS idx_email_domains_company_id ON email_domains(company_id);
CREATE INDEX IF NOT EXISTS idx_email_domains_domain ON email_domains(domain);

-- Denetim İndeksleri
CREATE INDEX IF NOT EXISTS idx_audit_types_company_id ON audit_types(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_types_module ON audit_types(module);

CREATE INDEX IF NOT EXISTS idx_audit_categories_type_id ON audit_categories(audit_type_id);
CREATE INDEX IF NOT EXISTS idx_audit_questions_category_id ON audit_questions(category_id);

CREATE INDEX IF NOT EXISTS idx_audits_company_id ON audits(company_id);
CREATE INDEX IF NOT EXISTS idx_audits_facility_id ON audits(facility_id);
CREATE INDEX IF NOT EXISTS idx_audits_type_id ON audits(audit_type_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor_id ON audits(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_status ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_date ON audits(audit_date);

CREATE INDEX IF NOT EXISTS idx_audit_answers_audit_id ON audit_answers(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_answers_question_id ON audit_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_audit_photos_audit_id ON audit_photos(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_photos_answer_id ON audit_photos(answer_id);

-- Aksiyon İndeksleri
CREATE INDEX IF NOT EXISTS idx_actions_company_id ON actions(company_id);
CREATE INDEX IF NOT EXISTS idx_actions_facility_id ON actions(facility_id);
CREATE INDEX IF NOT EXISTS idx_actions_audit_id ON actions(audit_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_priority ON actions(priority);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON actions(due_date);
CREATE INDEX IF NOT EXISTS idx_actions_responsible_user ON actions(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_action_photos_action_id ON action_photos(action_id);
CREATE INDEX IF NOT EXISTS idx_action_history_action_id ON action_history(action_id);

-- Talep İndeksleri
CREATE INDEX IF NOT EXISTS idx_requests_company_id ON requests(company_id);
CREATE INDEX IF NOT EXISTS idx_requests_facility_id ON requests(facility_id);
CREATE INDEX IF NOT EXISTS idx_requests_category ON requests(category);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_priority ON requests(priority);
CREATE INDEX IF NOT EXISTS idx_requests_assigned_to ON requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON requests(created_by);
CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at);
CREATE INDEX IF NOT EXISTS idx_request_comments_request_id ON request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_request_history_request_id ON request_history(request_id);

-- Servis İndeksleri
CREATE INDEX IF NOT EXISTS idx_service_vehicles_company_id ON service_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_service_vehicles_facility_id ON service_vehicles(facility_id);
CREATE INDEX IF NOT EXISTS idx_service_vehicles_plate ON service_vehicles(plate_number);
CREATE INDEX IF NOT EXISTS idx_service_routes_company_id ON service_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_service_routes_vehicle_id ON service_routes(vehicle_id);

-- Yemekhane İndeksleri
CREATE INDEX IF NOT EXISTS idx_cafeteria_menus_company_id ON cafeteria_menus(company_id);
CREATE INDEX IF NOT EXISTS idx_cafeteria_menus_facility_id ON cafeteria_menus(facility_id);
CREATE INDEX IF NOT EXISTS idx_cafeteria_menus_date ON cafeteria_menus(menu_date);
CREATE INDEX IF NOT EXISTS idx_cafeteria_suppliers_company_id ON cafeteria_suppliers(company_id);

-- Temizlik İndeksleri
CREATE INDEX IF NOT EXISTS idx_cleaning_staff_company_id ON cleaning_staff(company_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_staff_facility_id ON cleaning_staff(facility_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_equipment_company_id ON cleaning_equipment(company_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_equipment_facility_id ON cleaning_equipment(facility_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_schedules_company_id ON cleaning_schedules(company_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_schedules_facility_id ON cleaning_schedules(facility_id);
CREATE INDEX IF NOT EXISTS idx_cleaning_schedules_next_due ON cleaning_schedules(next_due);

-- Varlık / Demirbaş İndeksleri
CREATE INDEX IF NOT EXISTS idx_assets_company_id ON assets(company_id);
CREATE INDEX IF NOT EXISTS idx_assets_facility_id ON assets(facility_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_asset_history_asset_id ON asset_history(asset_id);

-- Tedarikçi İndeksleri
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_supplier_id ON supplier_scores(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_scores_period ON supplier_scores(period_start, period_end);

-- Bildirim & Hatırlatıcı İndeksleri
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_company_id ON scheduled_reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_facility_id ON scheduled_reminders(facility_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_remind_at ON scheduled_reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_reminders_is_sent ON scheduled_reminders(is_sent);

-- Duyuru, Log ve OTP İndeksleri
CREATE INDEX IF NOT EXISTS idx_announcements_company_id ON announcements(company_id);
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);

CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_otp_codes_email ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code);
CREATE INDEX IF NOT EXISTS idx_otp_codes_expires_at ON otp_codes(expires_at);

-- ------------------------------------------------------------------------------
-- 17. TETİKLEYİCİLERİN BAĞLANMASI (ATTACH TRIGGERS)
-- ------------------------------------------------------------------------------

-- Otomatik kod üreticileri
DROP TRIGGER IF EXISTS trg_generate_action_number ON actions;
CREATE TRIGGER trg_generate_action_number
    BEFORE INSERT ON actions
    FOR EACH ROW
    EXECUTE FUNCTION generate_action_number();

DROP TRIGGER IF EXISTS trg_generate_request_number ON requests;
CREATE TRIGGER trg_generate_request_number
    BEFORE INSERT ON requests
    FOR EACH ROW
    EXECUTE FUNCTION generate_request_number();

-- Otomatik updated_at güncelleyicileri
CREATE OR REPLACE TRIGGER trg_companies_updated_at
    BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_facilities_updated_at
    BEFORE UPDATE ON facilities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_audit_types_updated_at
    BEFORE UPDATE ON audit_types
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_audit_categories_updated_at
    BEFORE UPDATE ON audit_categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_audit_questions_updated_at
    BEFORE UPDATE ON audit_questions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_audits_updated_at
    BEFORE UPDATE ON audits
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_actions_updated_at
    BEFORE UPDATE ON actions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_service_vehicles_updated_at
    BEFORE UPDATE ON service_vehicles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_service_routes_updated_at
    BEFORE UPDATE ON service_routes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_cafeteria_suppliers_updated_at
    BEFORE UPDATE ON cafeteria_suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_cafeteria_menus_updated_at
    BEFORE UPDATE ON cafeteria_menus
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_cleaning_staff_updated_at
    BEFORE UPDATE ON cleaning_staff
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_cleaning_equipment_updated_at
    BEFORE UPDATE ON cleaning_equipment
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_cleaning_schedules_updated_at
    BEFORE UPDATE ON cleaning_schedules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_supplier_scores_updated_at
    BEFORE UPDATE ON supplier_scores
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_scheduled_reminders_updated_at
    BEFORE UPDATE ON scheduled_reminders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
