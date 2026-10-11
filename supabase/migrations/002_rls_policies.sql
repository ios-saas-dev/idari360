-- ============================================================================
-- Migration: 002_rls_policies.sql
-- Description: Comprehensive Row Level Security (RLS) policies and security triggers
--              for İdari360 Multi-Tenant SaaS Platform.
-- Security Standards:
--   1. Strict multi-tenant isolation via company_id
--   2. Strict role hierarchy enforcement (super_admin > company_admin > facility_manager > facility_officer > employee)
--   3. Zero self-promotion and no role escalation
--   4. STABLE helper functions with search_path secured
--   5. All tables have RLS enabled
-- ============================================================================

-- Ensure required extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: HELPER FUNCTIONS FOR SECURITY & ROLE EVALUATION
-- ============================================================================

-- 1.1 Role Level Numeric Mapping
-- super_admin=100, company_admin=80, facility_manager=60, facility_officer=40, employee=20
CREATE OR REPLACE FUNCTION public.role_level(r app_role)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE r
    WHEN 'super_admin' THEN 100
    WHEN 'company_admin' THEN 80
    WHEN 'facility_manager' THEN 60
    WHEN 'facility_officer' THEN 40
    WHEN 'employee' THEN 20
    ELSE 0
  END;
$$;

-- 1.2 Get Current User's Role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 1.3 Get Current User's Company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 1.4 Get Current User's Facility ID
CREATE OR REPLACE FUNCTION public.get_user_facility_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT facility_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 1.5 Check if Current User is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT role = 'super_admin' FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 1.6 Check if Current User has Role Equal or Higher than Given Role
CREATE OR REPLACE FUNCTION public.has_role_or_higher(required_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT public.role_level(role) >= public.role_level(required_role)
     FROM public.profiles
     WHERE id = auth.uid()),
    false
  );
$$;

-- 1.7 Check if Current User Can Manage Target User (Strictly Higher Role & Valid Tenant/Facility Scope)
CREATE OR REPLACE FUNCTION public.can_manage_user(target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role app_role;
  v_caller_company_id uuid;
  v_caller_facility_id uuid;
  v_target_role app_role;
  v_target_company_id uuid;
  v_target_facility_id uuid;
BEGIN
  IF v_caller_id IS NULL OR target_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- User cannot manage their own role or administrative status through this check
  IF v_caller_id = target_user_id THEN
    RETURN false;
  END IF;

  SELECT role, company_id, facility_id
    INTO v_caller_role, v_caller_company_id, v_caller_facility_id
    FROM public.profiles
   WHERE id = v_caller_id;

  IF v_caller_role IS NULL THEN
    RETURN false;
  END IF;

  SELECT role, company_id, facility_id
    INTO v_target_role, v_target_company_id, v_target_facility_id
    FROM public.profiles
   WHERE id = target_user_id;

  -- If target profile does not yet exist, caller must be company_admin or super_admin
  IF v_target_role IS NULL THEN
    RETURN public.role_level(v_caller_role) >= 80;
  END IF;

  -- Must hold a STRICTLY HIGHER role level than target user
  IF public.role_level(v_caller_role) <= public.role_level(v_target_role) THEN
    RETURN false;
  END IF;

  -- super_admin has global authority over all lower roles
  IF v_caller_role = 'super_admin' THEN
    RETURN true;
  END IF;

  -- Multi-tenant isolation: non-super-admins cannot touch users in other companies
  IF v_caller_company_id IS NULL OR v_caller_company_id <> v_target_company_id THEN
    RETURN false;
  END IF;

  -- company_admin can manage strictly lower roles within own company
  IF v_caller_role = 'company_admin' THEN
    RETURN true;
  END IF;

  -- facility_manager can manage strictly lower roles within own facility
  IF v_caller_role = 'facility_manager' THEN
    RETURN (v_caller_facility_id IS NOT NULL AND v_caller_facility_id = v_target_facility_id);
  END IF;

  RETURN false;
END;
$$;


-- ============================================================================
-- SECTION 2: SECURITY TRIGGERS (ROLE CHANGE & TENANT ISOLATION)
-- ============================================================================

-- 2.1 Trigger Function: Role Change Validation & Audit Logging
CREATE OR REPLACE FUNCTION public.validate_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role app_role;
  v_caller_company_id uuid;
BEGIN
  -- When invoked from auth background triggers or internal processes where auth.uid() is null,
  -- allow if initializing (e.g. system setup), otherwise require caller validation.
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, company_id
    INTO v_caller_role, v_caller_company_id
    FROM public.profiles
   WHERE id = v_caller_id;

  -- Rule 1: A user CANNOT change their own role (no self-promotion or self-demotion)
  IF NEW.id = v_caller_id AND OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Security Violation: Users are forbidden from altering their own role.';
  END IF;

  -- If role has changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Rule 2: Caller must have a STRICTLY HIGHER role than BOTH the old role and the new role
    IF public.role_level(v_caller_role) <= public.role_level(OLD.role) THEN
      RAISE EXCEPTION 'Security Violation: Cannot alter role of user with equal or higher rank (Caller: %, Target: %).',
        v_caller_role, OLD.role;
    END IF;

    IF public.role_level(v_caller_role) <= public.role_level(NEW.role) THEN
      RAISE EXCEPTION 'Security Violation: Cannot elevate a user to a rank equal to or above your own (Caller: %, New Role: %).',
        v_caller_role, NEW.role;
    END IF;

    -- Rule 3: ONLY super_admin can set role to company_admin or super_admin
    IF (NEW.role IN ('super_admin', 'company_admin') OR OLD.role IN ('super_admin', 'company_admin')) AND v_caller_role <> 'super_admin' THEN
      RAISE EXCEPTION 'Security Violation: Only super_admin is authorized to assign or modify company_admin or super_admin roles.';
    END IF;

    -- Rule 4: Audit log all role changes
    INSERT INTO public.activity_logs (
      company_id,
      user_id,
      action,
      entity_type,
      entity_id,
      details,
      created_at
    ) VALUES (
      NEW.company_id,
      v_caller_id,
      'ROLE_CHANGE',
      'profiles',
      NEW.id,
      jsonb_build_object(
        'target_user_id', NEW.id,
        'old_role', OLD.role,
        'new_role', NEW.role,
        'modified_by', v_caller_id,
        'modified_by_role', v_caller_role
      ),
      timezone('utc'::text, now())
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_role_change ON public.profiles;
CREATE TRIGGER trg_validate_role_change
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_role_change();


-- 2.2 Trigger Function: Strict Multi-Tenant Isolation Enforcement
CREATE OR REPLACE FUNCTION public.enforce_company_isolation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_caller_role app_role;
  v_caller_company_id uuid;
BEGIN
  -- Bypass check if invoked without authenticated session (service role / internal migrations)
  IF v_caller_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, company_id
    INTO v_caller_role, v_caller_company_id
    FROM public.profiles
   WHERE id = v_caller_id;

  -- super_admin has cross-tenant rights
  IF v_caller_role = 'super_admin' THEN
    RETURN NEW;
  END IF;

  -- Prevent inserting data into another tenant
  IF TG_OP = 'INSERT' THEN
    IF NEW.company_id IS NULL THEN
      NEW.company_id := v_caller_company_id;
    ELSIF NEW.company_id <> v_caller_company_id THEN
      RAISE EXCEPTION 'Tenant Isolation Violation: Cannot create resources for external company % (Caller company: %).',
        NEW.company_id, v_caller_company_id;
    END IF;
  END IF;

  -- Prevent moving records between tenants on UPDATE
  IF TG_OP = 'UPDATE' THEN
    IF OLD.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'Tenant Isolation Violation: Moving records between companies is prohibited.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================================
-- SECTION 3: ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE IF EXISTS public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.email_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.action_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.request_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.request_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cafeteria_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cafeteria_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cleaning_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cleaning_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cleaning_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.asset_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.supplier_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.otp_codes ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- SECTION 4: ATTACH COMPANY ISOLATION TRIGGERS TO TENANT-SCOPED TABLES
-- ============================================================================

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN (
    SELECT DISTINCT table_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND column_name = 'company_id'
      AND table_name NOT IN ('companies', 'activity_logs')
  ) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_company_isolation ON public.%I;', t);
    EXECUTE format('
      CREATE TRIGGER trg_enforce_company_isolation
      BEFORE INSERT OR UPDATE OF company_id ON public.%I
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_company_isolation();
    ', t);
  END LOOP;
END $$;


-- ============================================================================
-- SECTION 5: POLICIES FOR EACH TABLE
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. COMPANIES
-- super_admin: full CRUD. Others: read own company only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "companies_super_admin_all" ON public.companies;
DROP POLICY IF EXISTS "companies_tenant_members_select" ON public.companies;

CREATE POLICY "companies_super_admin_all"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "companies_tenant_members_select"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    id = public.get_user_company_id()
  );


-- ----------------------------------------------------------------------------
-- 2. FACILITIES
-- super_admin: full. company_admin: CRUD own company.
-- facility_manager/officer/employee: read own facility.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "facilities_super_admin_all" ON public.facilities;
DROP POLICY IF EXISTS "facilities_company_admin_all" ON public.facilities;
DROP POLICY IF EXISTS "facilities_member_select" ON public.facilities;

CREATE POLICY "facilities_super_admin_all"
  ON public.facilities
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "facilities_company_admin_all"
  ON public.facilities
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "facilities_member_select"
  ON public.facilities
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR id = public.get_user_facility_id()
    )
  );


-- ----------------------------------------------------------------------------
-- 3. PROFILES
-- super_admin: full.
-- company_admin: CRUD within company (lower roles only).
-- facility_manager: read/manage within facility (lower roles).
-- employee / facility_officer: read own profile, update non-role fields of own profile.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_super_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_company_admin_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_company_admin_manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_facility_manager_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_facility_manager_manage" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;

-- Super admin: full access
CREATE POLICY "profiles_super_admin_all"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Company admin: view all company profiles
CREATE POLICY "profiles_company_admin_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

-- Company admin: insert/update/delete profiles of strictly lower roles in own company
CREATE POLICY "profiles_company_admin_manage"
  ON public.profiles
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
    AND (
      id = auth.uid()
      OR public.can_manage_user(id)
    )
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
    AND (
      id = auth.uid()
      OR public.role_level(role) < 80
    )
  );

-- Facility manager: view profiles within own facility
CREATE POLICY "profiles_facility_manager_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_manager')
  );

-- Facility manager: update strictly lower roles in own facility
CREATE POLICY "profiles_facility_manager_manage"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_manager')
    AND public.can_manage_user(id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.role_level(role) < 60
  );

-- Self profile read
CREATE POLICY "profiles_self_select"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
  );

-- Self profile update (limited, role escalation guarded by trigger)
CREATE POLICY "profiles_self_update"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
  )
  WITH CHECK (
    id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 4. EMAIL_DOMAINS
-- super_admin: full CRUD. company_admin: read own company domains.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "email_domains_super_admin_all" ON public.email_domains;
DROP POLICY IF EXISTS "email_domains_company_admin_select" ON public.email_domains;

CREATE POLICY "email_domains_super_admin_all"
  ON public.email_domains
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "email_domains_company_admin_select"
  ON public.email_domains
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );


-- ----------------------------------------------------------------------------
-- 5. AUDIT_TYPES, AUDIT_CATEGORIES, AUDIT_QUESTIONS
-- super_admin: full. company_admin: CRUD own company. Others: read own company.
-- ----------------------------------------------------------------------------

-- audit_types
DROP POLICY IF EXISTS "audit_types_super_admin_all" ON public.audit_types;
DROP POLICY IF EXISTS "audit_types_company_admin_all" ON public.audit_types;
DROP POLICY IF EXISTS "audit_types_member_select" ON public.audit_types;

CREATE POLICY "audit_types_super_admin_all"
  ON public.audit_types
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_types_company_admin_all"
  ON public.audit_types
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "audit_types_member_select"
  ON public.audit_types
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

-- audit_categories
DROP POLICY IF EXISTS "audit_categories_super_admin_all" ON public.audit_categories;
DROP POLICY IF EXISTS "audit_categories_company_admin_all" ON public.audit_categories;
DROP POLICY IF EXISTS "audit_categories_member_select" ON public.audit_categories;

CREATE POLICY "audit_categories_super_admin_all"
  ON public.audit_categories
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_categories_company_admin_all"
  ON public.audit_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_types at
      WHERE at.id = audit_categories.audit_type_id
        AND at.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audit_types at
      WHERE at.id = audit_categories.audit_type_id
        AND at.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "audit_categories_member_select"
  ON public.audit_categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_types at
      WHERE at.id = audit_categories.audit_type_id
        AND at.company_id = public.get_user_company_id()
    )
  );

-- audit_questions
DROP POLICY IF EXISTS "audit_questions_super_admin_all" ON public.audit_questions;
DROP POLICY IF EXISTS "audit_questions_company_admin_all" ON public.audit_questions;
DROP POLICY IF EXISTS "audit_questions_member_select" ON public.audit_questions;

CREATE POLICY "audit_questions_super_admin_all"
  ON public.audit_questions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_questions_company_admin_all"
  ON public.audit_questions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_categories ac
      JOIN public.audit_types at ON at.id = ac.audit_type_id
      WHERE ac.id = audit_questions.category_id
        AND at.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audit_categories ac
      JOIN public.audit_types at ON at.id = ac.audit_type_id
      WHERE ac.id = audit_questions.category_id
        AND at.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "audit_questions_member_select"
  ON public.audit_questions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_categories ac
      JOIN public.audit_types at ON at.id = ac.audit_type_id
      WHERE ac.id = audit_questions.category_id
        AND at.company_id = public.get_user_company_id()
    )
  );


-- ----------------------------------------------------------------------------
-- 6. AUDITS
-- super_admin: full.
-- company_admin: CRUD own company.
-- facility_manager/officer: CRUD own facility audits.
-- employee: read own facility audits.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "audits_super_admin_all" ON public.audits;
DROP POLICY IF EXISTS "audits_company_admin_all" ON public.audits;
DROP POLICY IF EXISTS "audits_facility_roles_manage" ON public.audits;
DROP POLICY IF EXISTS "audits_member_select" ON public.audits;

CREATE POLICY "audits_super_admin_all"
  ON public.audits
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audits_company_admin_all"
  ON public.audits
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "audits_facility_roles_manage"
  ON public.audits
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "audits_member_select"
  ON public.audits
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );


-- ----------------------------------------------------------------------------
-- 7. AUDIT_ANSWERS, AUDIT_PHOTOS
-- Follow audit access patterns via audit relationship
-- ----------------------------------------------------------------------------

-- audit_answers
DROP POLICY IF EXISTS "audit_answers_super_admin_all" ON public.audit_answers;
DROP POLICY IF EXISTS "audit_answers_company_admin_all" ON public.audit_answers;
DROP POLICY IF EXISTS "audit_answers_facility_roles_manage" ON public.audit_answers;
DROP POLICY IF EXISTS "audit_answers_member_select" ON public.audit_answers;

CREATE POLICY "audit_answers_super_admin_all"
  ON public.audit_answers
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_answers_company_admin_all"
  ON public.audit_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_answers.audit_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_answers.audit_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "audit_answers_facility_roles_manage"
  ON public.audit_answers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_answers.audit_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_answers.audit_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "audit_answers_member_select"
  ON public.audit_answers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_answers.audit_id
        AND a.company_id = public.get_user_company_id()
        AND (
          public.has_role_or_higher('company_admin')
          OR a.facility_id = public.get_user_facility_id()
        )
    )
  );

-- audit_photos
DROP POLICY IF EXISTS "audit_photos_super_admin_all" ON public.audit_photos;
DROP POLICY IF EXISTS "audit_photos_company_admin_all" ON public.audit_photos;
DROP POLICY IF EXISTS "audit_photos_facility_roles_manage" ON public.audit_photos;
DROP POLICY IF EXISTS "audit_photos_member_select" ON public.audit_photos;

CREATE POLICY "audit_photos_super_admin_all"
  ON public.audit_photos
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "audit_photos_company_admin_all"
  ON public.audit_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_photos.audit_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_photos.audit_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "audit_photos_facility_roles_manage"
  ON public.audit_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_photos.audit_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_photos.audit_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "audit_photos_member_select"
  ON public.audit_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.audits a
      WHERE a.id = audit_photos.audit_id
        AND a.company_id = public.get_user_company_id()
        AND (
          public.has_role_or_higher('company_admin')
          OR a.facility_id = public.get_user_facility_id()
        )
    )
  );


-- ----------------------------------------------------------------------------
-- 8. ACTIONS
-- super_admin: full. company_admin: CRUD own company.
-- facility_manager/officer: CRUD own facility.
-- employee: read assigned actions.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "actions_super_admin_all" ON public.actions;
DROP POLICY IF EXISTS "actions_company_admin_all" ON public.actions;
DROP POLICY IF EXISTS "actions_facility_roles_manage" ON public.actions;
DROP POLICY IF EXISTS "actions_employee_select" ON public.actions;

CREATE POLICY "actions_super_admin_all"
  ON public.actions
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "actions_company_admin_all"
  ON public.actions
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "actions_facility_roles_manage"
  ON public.actions
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "actions_employee_select"
  ON public.actions
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      responsible_user_id = auth.uid()
      OR created_by = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 9. ACTION_PHOTOS, ACTION_HISTORY
-- Follow action access patterns
-- ----------------------------------------------------------------------------

-- action_photos
DROP POLICY IF EXISTS "action_photos_super_admin_all" ON public.action_photos;
DROP POLICY IF EXISTS "action_photos_company_admin_all" ON public.action_photos;
DROP POLICY IF EXISTS "action_photos_facility_manage" ON public.action_photos;
DROP POLICY IF EXISTS "action_photos_assigned_select" ON public.action_photos;

CREATE POLICY "action_photos_super_admin_all"
  ON public.action_photos
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "action_photos_company_admin_all"
  ON public.action_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_photos.action_id
        AND act.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_photos.action_id
        AND act.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "action_photos_facility_manage"
  ON public.action_photos
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_photos.action_id
        AND act.company_id = public.get_user_company_id()
        AND act.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_photos.action_id
        AND act.company_id = public.get_user_company_id()
        AND act.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "action_photos_assigned_select"
  ON public.action_photos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_photos.action_id
        AND act.company_id = public.get_user_company_id()
        AND (
          act.responsible_user_id = auth.uid()
          OR act.created_by = auth.uid()
        )
    )
  );

-- action_history
DROP POLICY IF EXISTS "action_history_super_admin_all" ON public.action_history;
DROP POLICY IF EXISTS "action_history_company_admin_all" ON public.action_history;
DROP POLICY IF EXISTS "action_history_facility_manage" ON public.action_history;
DROP POLICY IF EXISTS "action_history_assigned_select" ON public.action_history;

CREATE POLICY "action_history_super_admin_all"
  ON public.action_history
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "action_history_company_admin_all"
  ON public.action_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_history.action_id
        AND act.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_history.action_id
        AND act.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "action_history_facility_manage"
  ON public.action_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_history.action_id
        AND act.company_id = public.get_user_company_id()
        AND act.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_history.action_id
        AND act.company_id = public.get_user_company_id()
        AND act.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "action_history_assigned_select"
  ON public.action_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.actions act
      WHERE act.id = action_history.action_id
        AND act.company_id = public.get_user_company_id()
        AND (
          act.responsible_user_id = auth.uid()
          OR act.created_by = auth.uid()
        )
    )
  );


-- ----------------------------------------------------------------------------
-- 10. REQUESTS
-- super_admin: full.
-- company_admin: all company requests.
-- facility_manager/officer: own facility requests.
-- employee: own requests only.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "requests_super_admin_all" ON public.requests;
DROP POLICY IF EXISTS "requests_company_admin_all" ON public.requests;
DROP POLICY IF EXISTS "requests_facility_roles_all" ON public.requests;
DROP POLICY IF EXISTS "requests_employee_select" ON public.requests;
DROP POLICY IF EXISTS "requests_employee_insert" ON public.requests;
DROP POLICY IF EXISTS "requests_employee_update" ON public.requests;

CREATE POLICY "requests_super_admin_all"
  ON public.requests
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "requests_company_admin_all"
  ON public.requests
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "requests_facility_roles_all"
  ON public.requests
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "requests_employee_select"
  ON public.requests
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "requests_employee_insert"
  ON public.requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND created_by = auth.uid()
  );

CREATE POLICY "requests_employee_update"
  ON public.requests
  FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND created_by = auth.uid()
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND created_by = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 11. REQUEST_COMMENTS, REQUEST_HISTORY
-- Follow request access pattern
-- ----------------------------------------------------------------------------

-- request_comments
DROP POLICY IF EXISTS "request_comments_super_admin_all" ON public.request_comments;
DROP POLICY IF EXISTS "request_comments_company_admin_all" ON public.request_comments;
DROP POLICY IF EXISTS "request_comments_facility_roles_manage" ON public.request_comments;
DROP POLICY IF EXISTS "request_comments_employee_access" ON public.request_comments;

CREATE POLICY "request_comments_super_admin_all"
  ON public.request_comments
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "request_comments_company_admin_all"
  ON public.request_comments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "request_comments_facility_roles_manage"
  ON public.request_comments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "request_comments_employee_access"
  ON public.request_comments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.created_by = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_comments.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.created_by = auth.uid()
    )
  );

-- request_history
DROP POLICY IF EXISTS "request_history_super_admin_all" ON public.request_history;
DROP POLICY IF EXISTS "request_history_company_admin_all" ON public.request_history;
DROP POLICY IF EXISTS "request_history_facility_roles_select" ON public.request_history;
DROP POLICY IF EXISTS "request_history_employee_select" ON public.request_history;

CREATE POLICY "request_history_super_admin_all"
  ON public.request_history
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "request_history_company_admin_all"
  ON public.request_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_history.request_id
        AND r.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_history.request_id
        AND r.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "request_history_facility_roles_select"
  ON public.request_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_history.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "request_history_employee_select"
  ON public.request_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_history.request_id
        AND r.company_id = public.get_user_company_id()
        AND r.created_by = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 12. SERVICE_VEHICLES, SERVICE_ROUTES
-- super_admin: full. company_admin+: CRUD. facility roles: read own facility.
-- ----------------------------------------------------------------------------

-- service_vehicles
DROP POLICY IF EXISTS "service_vehicles_super_admin_all" ON public.service_vehicles;
DROP POLICY IF EXISTS "service_vehicles_company_admin_all" ON public.service_vehicles;
DROP POLICY IF EXISTS "service_vehicles_member_select" ON public.service_vehicles;

CREATE POLICY "service_vehicles_super_admin_all"
  ON public.service_vehicles
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "service_vehicles_company_admin_all"
  ON public.service_vehicles
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "service_vehicles_member_select"
  ON public.service_vehicles
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );

-- service_routes
DROP POLICY IF EXISTS "service_routes_super_admin_all" ON public.service_routes;
DROP POLICY IF EXISTS "service_routes_company_admin_all" ON public.service_routes;
DROP POLICY IF EXISTS "service_routes_member_select" ON public.service_routes;

CREATE POLICY "service_routes_super_admin_all"
  ON public.service_routes
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "service_routes_company_admin_all"
  ON public.service_routes
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "service_routes_member_select"
  ON public.service_routes
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );


-- ----------------------------------------------------------------------------
-- 13. CAFETERIA_MENUS, CAFETERIA_SUPPLIERS
-- super_admin: full. company_admin: CRUD own company. facility roles/employee: read own facility/company.
-- ----------------------------------------------------------------------------

-- cafeteria_menus
DROP POLICY IF EXISTS "cafeteria_menus_super_admin_all" ON public.cafeteria_menus;
DROP POLICY IF EXISTS "cafeteria_menus_company_admin_all" ON public.cafeteria_menus;
DROP POLICY IF EXISTS "cafeteria_menus_facility_roles_manage" ON public.cafeteria_menus;
DROP POLICY IF EXISTS "cafeteria_menus_member_select" ON public.cafeteria_menus;

CREATE POLICY "cafeteria_menus_super_admin_all"
  ON public.cafeteria_menus
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cafeteria_menus_company_admin_all"
  ON public.cafeteria_menus
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cafeteria_menus_facility_roles_manage"
  ON public.cafeteria_menus
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "cafeteria_menus_member_select"
  ON public.cafeteria_menus
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );

-- cafeteria_suppliers
DROP POLICY IF EXISTS "cafeteria_suppliers_super_admin_all" ON public.cafeteria_suppliers;
DROP POLICY IF EXISTS "cafeteria_suppliers_company_admin_all" ON public.cafeteria_suppliers;
DROP POLICY IF EXISTS "cafeteria_suppliers_member_select" ON public.cafeteria_suppliers;

CREATE POLICY "cafeteria_suppliers_super_admin_all"
  ON public.cafeteria_suppliers
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cafeteria_suppliers_company_admin_all"
  ON public.cafeteria_suppliers
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cafeteria_suppliers_member_select"
  ON public.cafeteria_suppliers
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );


-- ----------------------------------------------------------------------------
-- 14. CLEANING_STAFF, CLEANING_EQUIPMENT, CLEANING_SCHEDULES
-- super_admin: full. company_admin: CRUD own company.
-- facility roles: CRUD / manage own facility.
-- employee: read own facility.
-- ----------------------------------------------------------------------------

-- cleaning_staff
DROP POLICY IF EXISTS "cleaning_staff_super_admin_all" ON public.cleaning_staff;
DROP POLICY IF EXISTS "cleaning_staff_company_admin_all" ON public.cleaning_staff;
DROP POLICY IF EXISTS "cleaning_staff_facility_manage" ON public.cleaning_staff;
DROP POLICY IF EXISTS "cleaning_staff_member_select" ON public.cleaning_staff;

CREATE POLICY "cleaning_staff_super_admin_all"
  ON public.cleaning_staff
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cleaning_staff_company_admin_all"
  ON public.cleaning_staff
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cleaning_staff_facility_manage"
  ON public.cleaning_staff
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "cleaning_staff_member_select"
  ON public.cleaning_staff
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );

-- cleaning_equipment
DROP POLICY IF EXISTS "cleaning_equipment_super_admin_all" ON public.cleaning_equipment;
DROP POLICY IF EXISTS "cleaning_equipment_company_admin_all" ON public.cleaning_equipment;
DROP POLICY IF EXISTS "cleaning_equipment_facility_manage" ON public.cleaning_equipment;
DROP POLICY IF EXISTS "cleaning_equipment_member_select" ON public.cleaning_equipment;

CREATE POLICY "cleaning_equipment_super_admin_all"
  ON public.cleaning_equipment
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cleaning_equipment_company_admin_all"
  ON public.cleaning_equipment
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cleaning_equipment_facility_manage"
  ON public.cleaning_equipment
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "cleaning_equipment_member_select"
  ON public.cleaning_equipment
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );

-- cleaning_schedules
DROP POLICY IF EXISTS "cleaning_schedules_super_admin_all" ON public.cleaning_schedules;
DROP POLICY IF EXISTS "cleaning_schedules_company_admin_all" ON public.cleaning_schedules;
DROP POLICY IF EXISTS "cleaning_schedules_facility_manage" ON public.cleaning_schedules;
DROP POLICY IF EXISTS "cleaning_schedules_member_select" ON public.cleaning_schedules;

CREATE POLICY "cleaning_schedules_super_admin_all"
  ON public.cleaning_schedules
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "cleaning_schedules_company_admin_all"
  ON public.cleaning_schedules
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "cleaning_schedules_facility_manage"
  ON public.cleaning_schedules
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "cleaning_schedules_member_select"
  ON public.cleaning_schedules
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role_or_higher('company_admin')
      OR facility_id = public.get_user_facility_id()
    )
  );


-- ----------------------------------------------------------------------------
-- 15. ASSETS, ASSET_HISTORY
-- super_admin: full. company_admin: all company.
-- facility roles: own facility.
-- employee: own assigned assets.
-- ----------------------------------------------------------------------------

-- assets
DROP POLICY IF EXISTS "assets_super_admin_all" ON public.assets;
DROP POLICY IF EXISTS "assets_company_admin_all" ON public.assets;
DROP POLICY IF EXISTS "assets_facility_manage" ON public.assets;
DROP POLICY IF EXISTS "assets_employee_select" ON public.assets;

CREATE POLICY "assets_super_admin_all"
  ON public.assets
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "assets_company_admin_all"
  ON public.assets
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "assets_facility_manage"
  ON public.assets
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND facility_id = public.get_user_facility_id()
    AND public.has_role_or_higher('facility_officer')
  );

CREATE POLICY "assets_employee_select"
  ON public.assets
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND assigned_to = auth.uid()
  );

-- asset_history
DROP POLICY IF EXISTS "asset_history_super_admin_all" ON public.asset_history;
DROP POLICY IF EXISTS "asset_history_company_admin_all" ON public.asset_history;
DROP POLICY IF EXISTS "asset_history_facility_manage" ON public.asset_history;
DROP POLICY IF EXISTS "asset_history_employee_select" ON public.asset_history;

CREATE POLICY "asset_history_super_admin_all"
  ON public.asset_history
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "asset_history_company_admin_all"
  ON public.asset_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_history.asset_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_history.asset_id
        AND a.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "asset_history_facility_manage"
  ON public.asset_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_history.asset_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_history.asset_id
        AND a.company_id = public.get_user_company_id()
        AND a.facility_id = public.get_user_facility_id()
        AND public.has_role_or_higher('facility_officer')
    )
  );

CREATE POLICY "asset_history_employee_select"
  ON public.asset_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assets a
      WHERE a.id = asset_history.asset_id
        AND a.company_id = public.get_user_company_id()
        AND a.assigned_to = auth.uid()
    )
  );


-- ----------------------------------------------------------------------------
-- 16. SUPPLIERS, SUPPLIER_SCORES
-- super_admin: full. company_admin+: CRUD. Others: read own company.
-- ----------------------------------------------------------------------------

-- suppliers
DROP POLICY IF EXISTS "suppliers_super_admin_all" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_company_admin_all" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_member_select" ON public.suppliers;

CREATE POLICY "suppliers_super_admin_all"
  ON public.suppliers
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "suppliers_company_admin_all"
  ON public.suppliers
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "suppliers_member_select"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
  );

-- supplier_scores
DROP POLICY IF EXISTS "supplier_scores_super_admin_all" ON public.supplier_scores;
DROP POLICY IF EXISTS "supplier_scores_company_admin_all" ON public.supplier_scores;
DROP POLICY IF EXISTS "supplier_scores_member_select" ON public.supplier_scores;

CREATE POLICY "supplier_scores_super_admin_all"
  ON public.supplier_scores
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "supplier_scores_company_admin_all"
  ON public.supplier_scores
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_scores.supplier_id
        AND s.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_scores.supplier_id
        AND s.company_id = public.get_user_company_id()
        AND public.has_role_or_higher('company_admin')
    )
  );

CREATE POLICY "supplier_scores_member_select"
  ON public.supplier_scores
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.suppliers s
      WHERE s.id = supplier_scores.supplier_id
        AND s.company_id = public.get_user_company_id()
    )
  );


-- ----------------------------------------------------------------------------
-- 17. NOTIFICATIONS
-- Users see and update only their own notifications.
-- Super admin and service_role can manage all.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "notifications_super_admin_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_update" ON public.notifications;

CREATE POLICY "notifications_super_admin_all"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "notifications_user_select"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

CREATE POLICY "notifications_user_update"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
  )
  WITH CHECK (
    user_id = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 18. SCHEDULED_REMINDERS
-- super_admin: full. company_admin+: manage company. Others: read own.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "scheduled_reminders_super_admin_all" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_company_admin_all" ON public.scheduled_reminders;
DROP POLICY IF EXISTS "scheduled_reminders_user_select" ON public.scheduled_reminders;

CREATE POLICY "scheduled_reminders_super_admin_all"
  ON public.scheduled_reminders
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "scheduled_reminders_company_admin_all"
  ON public.scheduled_reminders
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "scheduled_reminders_user_select"
  ON public.scheduled_reminders
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      recipients IS NULL
      OR recipients = '{}'::uuid[]
      OR auth.uid() = ANY(recipients)
      OR public.has_role_or_higher('company_admin')
    )
  );


-- ----------------------------------------------------------------------------
-- 19. ANNOUNCEMENTS
-- super_admin: full. company_admin+: create/manage own company.
-- Others: read if targeted to their company / facility.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_super_admin_all" ON public.announcements;
DROP POLICY IF EXISTS "announcements_company_admin_manage" ON public.announcements;
DROP POLICY IF EXISTS "announcements_member_select" ON public.announcements;

CREATE POLICY "announcements_super_admin_all"
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "announcements_company_admin_manage"
  ON public.announcements
  FOR ALL
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "announcements_member_select"
  ON public.announcements
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      target_facilities IS NULL
      OR target_facilities = '{}'::uuid[]
      OR public.get_user_facility_id() = ANY(target_facilities)
      OR public.has_role_or_higher('company_admin')
    )
  );


-- ----------------------------------------------------------------------------
-- 20. ACTIVITY_LOGS
-- super_admin: read all. company_admin: read own company.
-- Others: no direct select access. Authenticated users can insert logs.
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "activity_logs_super_admin_all" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_company_admin_select" ON public.activity_logs;
DROP POLICY IF EXISTS "activity_logs_insert_authenticated" ON public.activity_logs;

CREATE POLICY "activity_logs_super_admin_all"
  ON public.activity_logs
  FOR ALL
  TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "activity_logs_company_admin_select"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role_or_higher('company_admin')
  );

CREATE POLICY "activity_logs_insert_authenticated"
  ON public.activity_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.is_super_admin()
  );


-- ----------------------------------------------------------------------------
-- 21. OTP_CODES
-- Service role only! No direct access for public or authenticated roles.
-- ----------------------------------------------------------------------------
-- By enabling RLS on otp_codes and creating NO permissive policies for authenticated/anon,
-- all client-side queries are denied by default. Only service_role bypasses RLS.
-- We add an explicit deny policy for clarity.
DROP POLICY IF EXISTS "otp_codes_service_role_only" ON public.otp_codes;

CREATE POLICY "otp_codes_service_role_only"
  ON public.otp_codes
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);


-- ============================================================================
-- SECTION 6: HIGH-PERFORMANCE RLS INDEXES
-- ============================================================================

-- Ensure fast index lookups for security filters on high-frequency tables
CREATE INDEX IF NOT EXISTS idx_profiles_role_company ON public.profiles(role, company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_facility ON public.profiles(company_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_facilities_company ON public.facilities(company_id);
CREATE INDEX IF NOT EXISTS idx_audits_company_facility ON public.audits(company_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_actions_company_facility ON public.actions(company_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_actions_responsible_user_id ON public.actions(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_requests_company_facility ON public.requests(company_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON public.requests(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_company_facility ON public.assets(company_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company ON public.activity_logs(company_id);
