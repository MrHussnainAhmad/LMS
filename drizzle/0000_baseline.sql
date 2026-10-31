-- Consolidated fresh-database schema through 0088_attendance_delegation.
-- Existing databases must use scripts/migrate-production.mjs; never replay this baseline manually.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: admission_application_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_application_status AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'DOCUMENTS_REQUIRED',
    'TEST_SCHEDULED',
    'INTERVIEW_SCHEDULED',
    'DECISION_PENDING',
    'OFFERED',
    'REJECTED',
    'FEE_PENDING',
    'FEE_VERIFICATION',
    'FEE_VERIFIED',
    'REFUND_REQUIRED',
    'ENROLLED',
    'WITHDRAWN'
);


--
-- Name: admission_appointment_outcome; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_appointment_outcome AS ENUM (
    'PENDING',
    'PASSED',
    'FAILED',
    'ABSENT'
);


--
-- Name: admission_appointment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_appointment_type AS ENUM (
    'TEST',
    'INTERVIEW'
);


--
-- Name: admission_cycle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_cycle_status AS ENUM (
    'DRAFT',
    'OPEN',
    'CLOSED'
);


--
-- Name: admission_document_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_document_status AS ENUM (
    'REQUESTED',
    'SUBMITTED',
    'VERIFIED',
    'REJECTED'
);


--
-- Name: admission_fee_payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.admission_fee_payment_status AS ENUM (
    'PENDING',
    'SUBMITTED',
    'VERIFIED',
    'REJECTED'
);


--
-- Name: announcement_target; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.announcement_target AS ENUM (
    'ALL',
    'CAMPUS',
    'CLASS',
    'SECTION',
    'USER'
);


--
-- Name: attendance_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.attendance_status AS ENUM (
    'PRESENT',
    'ABSENT',
    'LATE',
    'LEAVE'
);


--
-- Name: blog_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blog_status AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


--
-- Name: gender; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.gender AS ENUM (
    'MALE',
    'FEMALE',
    'OTHER'
);


--
-- Name: institution_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.institution_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: institution_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.institution_type AS ENUM (
    'SCHOOL',
    'COLLEGE',
    'UNIVERSITY'
);


--
-- Name: leave_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.leave_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'ANNOUNCEMENT',
    'EXAM_TIMETABLE',
    'ASSIGNMENT',
    'TEST',
    'MARKS',
    'ATTENDANCE',
    'GENERAL',
    'LEAVE_REQUEST',
    'DIARY',
    'TIMETABLE',
    'FEE_VOUCHER',
    'FEE_OVERDUE',
    'PAYMENT',
    'SECURITY',
    'ASSIGNMENT_REMINDER'
);


--
-- Name: online_question_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.online_question_type AS ENUM (
    'MCQ',
    'SHORT'
);


--
-- Name: online_submission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.online_submission_status AS ENUM (
    'IN_PROGRESS',
    'SUBMITTED',
    'AUTO_GRADED',
    'PENDING_REVIEW',
    'GRADED',
    'FAILED',
    'ABANDONED'
);


--
-- Name: online_test_mode; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.online_test_mode AS ENUM (
    'MCQ',
    'MIX'
);


--
-- Name: parent_account_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.parent_account_status AS ENUM (
    'PENDING_ACTIVATION',
    'ACTIVE',
    'DISABLED'
);


--
-- Name: profile_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.profile_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: promotion_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.promotion_status AS ENUM (
    'PROMOTED',
    'RETAINED',
    'GRADUATED'
);


--
-- Name: public_event_duration; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.public_event_duration AS ENUM (
    'ONE_DAY',
    'THREE_DAYS',
    'ONE_WEEK',
    'ONE_MONTH',
    'FOREVER'
);


--
-- Name: public_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.public_event_status AS ENUM (
    'DRAFT',
    'PUBLISHED'
);


--
-- Name: streaming_provider; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.streaming_provider AS ENUM (
    'BUNNY',
    'MUX'
);


--
-- Name: student_academic_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.student_academic_status AS ENUM (
    'ACTIVE',
    'GRADUATED'
);


--
-- Name: test_creator_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.test_creator_role AS ENUM (
    'INSTITUTION',
    'STAFF'
);


--
-- Name: test_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.test_type AS ENUM (
    'DAILY',
    'WEEKLY',
    'QUIZ',
    'MONTHLY',
    'MID',
    'FINAL',
    'PROMOTION'
);


--
-- Name: ticket_history_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_history_action AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'FORWARDED',
    'PLATFORM_STATUS_CHANGED',
    'COMMENT_ADDED'
);


--
-- Name: ticket_platform_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_platform_status AS ENUM (
    'RECEIVED',
    'WORKING',
    'RESOLVED'
);


--
-- Name: ticket_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_status AS ENUM (
    'OPEN',
    'WORKING',
    'RESOLVED',
    'FORWARDED'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'SUPER_ADMIN',
    'EMPLOYEE',
    'INSTITUTION',
    'INSTITUTION_ADMIN',
    'STAFF',
    'STUDENT',
    'PARENT'
);


--
-- Name: guard_gateway_payment_attempt(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guard_gateway_payment_attempt() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('PAID','REVIEW') THEN
      RAISE EXCEPTION 'Verified payment records are immutable';
    END IF;
    IF ROW(NEW.id, NEW.institution_id, NEW.invoice_id, NEW.application_id, NEW.gateway,
      NEW.environment, NEW.merchant_id, NEW.amount, NEW.currency, NEW.credentials_encrypted,
      NEW.return_url, NEW.institution_name, NEW.payer_name, NEW.description, NEW.created_at, NEW.expires_at)
      IS DISTINCT FROM ROW(OLD.id, OLD.institution_id, OLD.invoice_id, OLD.application_id, OLD.gateway,
      OLD.environment, OLD.merchant_id, OLD.amount, OLD.currency, OLD.credentials_encrypted,
      OLD.return_url, OLD.institution_name, OLD.payer_name, OLD.description, OLD.created_at, OLD.expires_at) THEN
      RAISE EXCEPTION 'Payment terms are immutable';
    END IF;
  END IF;
  IF NEW.invoice_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fee_invoices WHERE id = NEW.invoice_id AND institution_id = NEW.institution_id
  ) THEN RAISE EXCEPTION 'Payment invoice tenant mismatch'; END IF;
  IF NEW.application_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM admission_applications WHERE id = NEW.application_id AND institution_id = NEW.institution_id
  ) THEN RAISE EXCEPTION 'Payment application tenant mismatch'; END IF;
  RETURN NEW;
END $$;


--
-- Name: protect_admission_cycle_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_admission_cycle_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM admission_applications WHERE cycle_id = OLD.id) THEN
    RAISE EXCEPTION 'This cycle has application records; archive it instead' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END $$;


--
-- Name: protect_admission_offering_history(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_admission_offering_history() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM admission_applications WHERE offering_id = OLD.id) THEN
    RAISE EXCEPTION 'This offering has application records and cannot be deleted' USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END $$;


--
-- Name: protect_archived_admission_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_archived_admission_records() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  record_data jsonb;
  target_cycle integer;
  archive_time timestamptz;
BEGIN
  -- On UPDATE protect both the old owner and a proposed new owner.
  FOR record_data IN SELECT value FROM jsonb_array_elements(
    CASE TG_OP WHEN 'INSERT' THEN jsonb_build_array(to_jsonb(NEW))
      WHEN 'DELETE' THEN jsonb_build_array(to_jsonb(OLD))
      ELSE jsonb_build_array(to_jsonb(OLD), to_jsonb(NEW)) END
  ) LOOP
    IF TG_TABLE_NAME = 'admission_applications' THEN
      target_cycle := (record_data->>'cycle_id')::integer;
    ELSE
      SELECT cycle_id INTO target_cycle FROM admission_applications
        WHERE id = (record_data->>'application_id')::integer;
    END IF;
    SELECT archived_at INTO archive_time FROM admission_cycles WHERE id = target_cycle FOR SHARE;
    IF archive_time IS NOT NULL THEN
      RAISE EXCEPTION 'Restore this archived admission cycle before changing its records' USING ERRCODE = 'N3601';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_admission_campus_intake(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_admission_campus_intake() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.intake_institution_id := COALESCE(NEW.intake_institution_id, NEW.institution_id);
  NEW.campus_name := COALESCE(NEW.campus_name, (SELECT campus_name FROM institutions WHERE id = NEW.institution_id), 'Main');
  IF NEW.institution_id <> NEW.intake_institution_id AND NOT EXISTS (
    SELECT 1 FROM institutions WHERE id = NEW.institution_id AND parent_institution_id = NEW.intake_institution_id
  ) THEN RAISE EXCEPTION 'Admission campus must belong to the intake institution' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;


--
-- Name: validate_admission_cycle_campus(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_admission_cycle_campus() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE intake_id integer;
BEGIN
  SELECT institution_id INTO intake_id FROM admission_cycles WHERE id = NEW.cycle_id;
  IF intake_id IS NULL OR (NEW.institution_id <> intake_id AND NOT EXISTS (
    SELECT 1 FROM institutions WHERE id = NEW.institution_id AND parent_institution_id = intake_id
  )) THEN RAISE EXCEPTION 'Campus does not belong to this admission cycle' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: academic_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.academic_sessions (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: academic_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.academic_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: academic_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.academic_sessions_id_seq OWNED BY public.academic_sessions.id;


--
-- Name: account_deletions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_deletions (
    id integer NOT NULL,
    institution_name character varying(255) NOT NULL,
    admin_email character varying(255) NOT NULL,
    reason text,
    deleted_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: account_deletions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_deletions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_deletions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_deletions_id_seq OWNED BY public.account_deletions.id;


--
-- Name: account_lockouts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_lockouts (
    id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    failed_count integer DEFAULT 0 NOT NULL,
    window_started_at timestamp without time zone DEFAULT now() NOT NULL,
    locked_until timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: account_lockouts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.account_lockouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: account_lockouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.account_lockouts_id_seq OWNED BY public.account_lockouts.id;


--
-- Name: admission_applicant_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_applicant_accounts (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    guardian_email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    session_version integer DEFAULT 0 NOT NULL,
    failed_login_count integer DEFAULT 0 NOT NULL,
    locked_until timestamp without time zone,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT admission_applicant_accounts_failed_login_check CHECK ((failed_login_count >= 0)),
    CONSTRAINT admission_applicant_accounts_session_version_check CHECK ((session_version >= 0))
);


--
-- Name: admission_applicant_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_applicant_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_applicant_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_applicant_accounts_id_seq OWNED BY public.admission_applicant_accounts.id;


--
-- Name: admission_application_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_application_events (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    title character varying(160) NOT NULL,
    description character varying(1000),
    from_status public.admission_application_status,
    to_status public.admission_application_status,
    visible_to_applicant boolean DEFAULT true NOT NULL,
    actor_id integer NOT NULL,
    actor_role public.user_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_application_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_application_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_application_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_application_events_id_seq OWNED BY public.admission_application_events.id;


--
-- Name: admission_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_applications (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    cycle_id integer NOT NULL,
    offering_id integer NOT NULL,
    application_number character varying(32) NOT NULL,
    student_name character varying(255) NOT NULL,
    date_of_birth date NOT NULL,
    gender public.gender NOT NULL,
    guardian_name character varying(255) NOT NULL,
    guardian_email character varying(255) NOT NULL,
    guardian_phone character varying(50) NOT NULL,
    previous_institution character varying(255),
    notes text,
    status public.admission_application_status DEFAULT 'SUBMITTED'::public.admission_application_status NOT NULL,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    applicant_id integer,
    previous_class_marks character varying(100),
    medical_information text,
    intake_institution_id integer NOT NULL,
    campus_id integer,
    campus_name character varying(255) NOT NULL,
    CONSTRAINT admission_applications_notes_length_check CHECK (((notes IS NULL) OR (char_length(notes) <= 2000)))
);


--
-- Name: admission_applications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_applications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_applications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_applications_id_seq OWNED BY public.admission_applications.id;


--
-- Name: admission_appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_appointments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    type public.admission_appointment_type NOT NULL,
    scheduled_at timestamp without time zone NOT NULL,
    location character varying(300) NOT NULL,
    instructions character varying(1000),
    outcome public.admission_appointment_outcome DEFAULT 'PENDING'::public.admission_appointment_outcome NOT NULL,
    outcome_note character varying(1000),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_appointments_id_seq OWNED BY public.admission_appointments.id;


--
-- Name: admission_cycle_campuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_cycle_campuses (
    cycle_id integer NOT NULL,
    campus_id integer NOT NULL,
    institution_id integer NOT NULL,
    is_open boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_cycles (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(120) NOT NULL,
    academic_year character varying(20) NOT NULL,
    opens_on date,
    closes_on date,
    instructions text,
    requires_test boolean DEFAULT false NOT NULL,
    requires_interview boolean DEFAULT false NOT NULL,
    status public.admission_cycle_status DEFAULT 'DRAFT'::public.admission_cycle_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    required_documents jsonb DEFAULT '[]'::jsonb NOT NULL,
    test_scheduled_at timestamp with time zone,
    test_location character varying(300),
    test_instructions text,
    interview_scheduled_at timestamp with time zone,
    interview_location character varying(300),
    interview_instructions text,
    admission_fee_amount integer,
    admission_fee_due_days integer DEFAULT 7 NOT NULL,
    admission_fee_instructions text,
    payment_bank_name character varying(120),
    payment_account_number character varying(160),
    payment_qr_url character varying(500),
    payment_methods jsonb DEFAULT '[]'::jsonb NOT NULL,
    archived_at timestamp with time zone,
    CONSTRAINT admission_cycles_archive_closed CHECK (((archived_at IS NULL) OR (status = 'CLOSED'::public.admission_cycle_status))),
    CONSTRAINT admission_cycles_date_order_check CHECK (((opens_on IS NULL) OR (closes_on IS NULL) OR (opens_on <= closes_on))),
    CONSTRAINT admission_cycles_fee_amount_check CHECK (((admission_fee_amount IS NULL) OR (admission_fee_amount > 0))),
    CONSTRAINT admission_cycles_fee_due_days_check CHECK (((admission_fee_due_days >= 1) AND (admission_fee_due_days <= 90))),
    CONSTRAINT admission_cycles_instructions_length_check CHECK (((instructions IS NULL) OR (char_length(instructions) <= 3000))),
    CONSTRAINT admission_cycles_required_documents_check CHECK (((jsonb_typeof(required_documents) = 'array'::text) AND (jsonb_array_length(required_documents) <= 20)))
);


--
-- Name: admission_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_cycles_id_seq OWNED BY public.admission_cycles.id;


--
-- Name: admission_document_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_document_requests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    document_name character varying(160) NOT NULL,
    instructions character varying(500),
    status public.admission_document_status DEFAULT 'REQUESTED'::public.admission_document_status NOT NULL,
    submitted_file_key character varying(500),
    reviewer_note character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_document_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_document_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_document_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_document_requests_id_seq OWNED BY public.admission_document_requests.id;


--
-- Name: admission_enrollments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_enrollments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    student_id integer NOT NULL,
    enrolled_by integer NOT NULL,
    credentials_issued_at timestamp without time zone DEFAULT now() NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: admission_enrollments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_enrollments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_enrollments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_enrollments_id_seq OWNED BY public.admission_enrollments.id;


--
-- Name: admission_fee_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_fee_payments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    amount integer NOT NULL,
    due_date date,
    instructions text NOT NULL,
    payer_reference character varying(160),
    proof_file_key character varying(500),
    status public.admission_fee_payment_status DEFAULT 'PENDING'::public.admission_fee_payment_status NOT NULL,
    reviewer_note character varying(500),
    verified_by integer,
    verified_at timestamp without time zone,
    submitted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    bank_name character varying(120),
    account_number character varying(160),
    qr_url character varying(500),
    payment_methods jsonb DEFAULT '[]'::jsonb NOT NULL,
    payer_source_bank character varying(120),
    payment_account jsonb,
    CONSTRAINT admission_fee_payments_amount_check CHECK ((amount > 0)),
    CONSTRAINT admission_fee_payments_instructions_length_check CHECK ((char_length(instructions) <= 3000))
);


--
-- Name: admission_fee_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_fee_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_fee_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_fee_payments_id_seq OWNED BY public.admission_fee_payments.id;


--
-- Name: admission_fee_proofs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_fee_proofs (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    application_id integer NOT NULL,
    payment_id integer NOT NULL,
    payment_account jsonb,
    source_bank_name character varying(120) NOT NULL,
    transaction_id character varying(160) NOT NULL,
    proof_file_key character varying(500) NOT NULL,
    status character varying(20) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    reviewer_note character varying(500),
    verified_by integer,
    verified_at timestamp without time zone,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT admission_fee_proofs_status_check CHECK (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: admission_fee_proofs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_fee_proofs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_fee_proofs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_fee_proofs_id_seq OWNED BY public.admission_fee_proofs.id;


--
-- Name: admission_offerings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admission_offerings (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    cycle_id integer NOT NULL,
    title character varying(120) NOT NULL,
    description character varying(500),
    capacity integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT admission_offerings_capacity_check CHECK (((capacity IS NULL) OR (capacity > 0)))
);


--
-- Name: admission_offerings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.admission_offerings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admission_offerings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.admission_offerings_id_seq OWNED BY public.admission_offerings.id;


--
-- Name: announcement_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcement_reads (
    id integer NOT NULL,
    announcement_id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    read_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: announcement_reads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcement_reads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcement_reads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcement_reads_id_seq OWNED BY public.announcement_reads.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    sender_role public.user_role NOT NULL,
    sender_id integer NOT NULL,
    target_type public.announcement_target NOT NULL,
    target_campus_id integer,
    target_class_id integer,
    target_section_id integer,
    target_user_role public.user_role,
    target_user_id integer,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    automation_key character varying(255)
);


--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assignments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    class_id integer NOT NULL,
    section_id integer,
    subject_id integer,
    title character varying(255) NOT NULL,
    description text,
    due_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reference_file_url text,
    reference_file_name character varying(255)
);


--
-- Name: assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assignments_id_seq OWNED BY public.assignments.id;


--
-- Name: attendance_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_delegations (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    section_id integer NOT NULL,
    staff_id integer NOT NULL,
    date date NOT NULL,
    assigned_by_role character varying(32) NOT NULL,
    assigned_by_id integer NOT NULL,
    revoked_at timestamp without time zone,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: attendance_delegations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendance_delegations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendance_delegations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendance_delegations_id_seq OWNED BY public.attendance_delegations.id;


--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    section_id integer NOT NULL,
    student_id integer NOT NULL,
    date date NOT NULL,
    status public.attendance_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    marked_by_role character varying(32),
    marked_by_id integer,
    marked_by_name character varying(255),
    marked_at timestamp without time zone
);


--
-- Name: attendances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.attendances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.attendances_id_seq OWNED BY public.attendances.id;


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    institution_id integer,
    actor_id integer NOT NULL,
    actor_role public.user_role NOT NULL,
    action character varying(255) NOT NULL,
    target character varying(255) NOT NULL,
    ip character varying(50),
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: batch_exam_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_exam_results (
    id integer NOT NULL,
    batch_exam_subject_id integer NOT NULL,
    student_id integer NOT NULL,
    marks_obtained real NOT NULL,
    is_edited boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: batch_exam_results_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_exam_results_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_exam_results_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_exam_results_id_seq OWNED BY public.batch_exam_results.id;


--
-- Name: batch_exam_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_exam_subjects (
    id integer NOT NULL,
    batch_exam_id integer NOT NULL,
    subject_id integer NOT NULL,
    max_marks real NOT NULL,
    staff_id integer,
    is_published boolean DEFAULT false NOT NULL,
    review_deadline timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    published_at timestamp without time zone
);


--
-- Name: batch_exam_subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_exam_subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_exam_subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_exam_subjects_id_seq OWNED BY public.batch_exam_subjects.id;


--
-- Name: batch_exams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_exams (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    class_id integer NOT NULL,
    section_id integer,
    title character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    type public.test_type DEFAULT 'FINAL'::public.test_type NOT NULL,
    official_published_at timestamp without time zone
);


--
-- Name: batch_exams_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.batch_exams_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batch_exams_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.batch_exams_id_seq OWNED BY public.batch_exams.id;


--
-- Name: blogs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blogs (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    author_role public.user_role NOT NULL,
    author_id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    slug character varying(255) NOT NULL,
    meta_title character varying(255),
    meta_description text,
    excerpt text,
    status public.blog_status DEFAULT 'DRAFT'::public.blog_status NOT NULL,
    published_at timestamp without time zone
);


--
-- Name: blogs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.blogs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: blogs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.blogs_id_seq OWNED BY public.blogs.id;


--
-- Name: campuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campuses (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(255) NOT NULL,
    address text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: campuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.campuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: campuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.campuses_id_seq OWNED BY public.campuses.id;


--
-- Name: central_backup_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.central_backup_jobs (
    run_id text NOT NULL,
    kind text NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error text,
    requested_by integer,
    CONSTRAINT central_backup_jobs_kind_check CHECK ((kind = ANY (ARRAY['NIGHTLY'::text, 'MANUAL'::text]))),
    CONSTRAINT central_backup_jobs_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'RUNNING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


--
-- Name: central_backup_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.central_backup_settings (
    id integer DEFAULT 1 NOT NULL,
    database_password_encrypted text,
    updated_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by_employee integer,
    enabled boolean DEFAULT false NOT NULL,
    restore_review_required boolean DEFAULT false NOT NULL,
    drive_credentials_encrypted text,
    drive_email text,
    drive_folder_id text,
    recovery_email text,
    recovery_email_verified_at timestamp with time zone,
    pending_recovery_email text,
    email_verification_hash text,
    email_verification_expires_at timestamp with time zone,
    email_verification_attempts integer DEFAULT 0 NOT NULL,
    oauth_state_hash text,
    oauth_state_expires_at timestamp with time zone
);


--
-- Name: central_database_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.central_database_backups (
    id integer NOT NULL,
    run_id text NOT NULL,
    file_name text NOT NULL,
    file_size_bytes bigint,
    sha256 text,
    drive_file_id text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    b2_status character varying(16),
    error text,
    source_sha256 character varying(64),
    source_size_bytes bigint,
    password_encrypted text,
    recovery_email text,
    password_sent_at timestamp with time zone,
    drive_verified_at timestamp with time zone,
    drive_folder_id text,
    package_version integer DEFAULT 0 NOT NULL,
    deleted_at timestamp with time zone,
    delivery_attempts integer DEFAULT 0 NOT NULL,
    next_delivery_at timestamp with time zone,
    CONSTRAINT central_database_backups_b2_status_check CHECK (((b2_status)::text = ANY ((ARRAY['SKIPPED'::character varying, 'UPLOADED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT central_database_backups_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'UPLOADING'::text, 'COMPLETED'::text, 'FAILED'::text])))
);


--
-- Name: central_database_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.central_database_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: central_database_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.central_database_backups_id_seq OWNED BY public.central_database_backups.id;


--
-- Name: class_fee_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_fee_items (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    class_id integer NOT NULL,
    fee_head_id integer NOT NULL,
    amount integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT class_fee_items_amount_check CHECK ((amount >= 0))
);


--
-- Name: class_fee_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.class_fee_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: class_fee_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.class_fee_items_id_seq OWNED BY public.class_fee_items.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(100) NOT NULL,
    level integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    is_final_class boolean DEFAULT false NOT NULL,
    is_graduated_archive boolean DEFAULT false NOT NULL
);


--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: course_classes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_classes (
    id integer NOT NULL,
    course_id integer NOT NULL,
    class_id integer NOT NULL
);


--
-- Name: course_classes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_classes_id_seq OWNED BY public.course_classes.id;


--
-- Name: course_lecture_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_lecture_progress (
    id integer NOT NULL,
    lecture_id integer NOT NULL,
    student_id integer NOT NULL,
    read_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: course_lecture_progress_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_lecture_progress_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_lecture_progress_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_lecture_progress_id_seq OWNED BY public.course_lecture_progress.id;


--
-- Name: course_lectures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_lectures (
    id integer NOT NULL,
    course_id integer NOT NULL,
    sequence integer NOT NULL,
    title character varying(180) NOT NULL,
    description text,
    video_url character varying(1000) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_lectures_sequence_check CHECK ((sequence > 0))
);


--
-- Name: course_lectures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.course_lectures_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: course_lectures_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.course_lectures_id_seq OWNED BY public.course_lectures.id;


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    subject_id integer NOT NULL,
    title character varying(180) NOT NULL,
    lecture_count integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT courses_lecture_count_check CHECK (((lecture_count > 0) AND (lecture_count <= 500)))
);


--
-- Name: courses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.courses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: courses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.courses_id_seq OWNED BY public.courses.id;


--
-- Name: dealt_code_fingerprints; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealt_code_fingerprints (
    code_hash character varying(64) NOT NULL
);


--
-- Name: dealt_plan_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dealt_plan_codes (
    code_hash character varying(64) NOT NULL,
    plan_id character varying(20) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: diaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diaries (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    class_id integer NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    subject_id integer,
    date date NOT NULL
);


--
-- Name: diaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.diaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: diaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.diaries_id_seq OWNED BY public.diaries.id;


--
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_outbox (
    id integer NOT NULL,
    institution_id integer,
    recipient character varying(255) NOT NULL,
    subject character varying(255) NOT NULL,
    html text NOT NULL,
    dedupe_key character varying(255),
    status character varying(16) DEFAULT 'PENDING'::character varying NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone,
    sent_at timestamp with time zone,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_outbox_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT email_outbox_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PROCESSING'::character varying, 'SENT'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: email_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.email_outbox_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: email_outbox_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.email_outbox_id_seq OWNED BY public.email_outbox.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: expo_push_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expo_push_tickets (
    id integer NOT NULL,
    ticket_id character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    notification_id integer,
    status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    error text,
    checked_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: expo_push_tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.expo_push_tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: expo_push_tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.expo_push_tickets_id_seq OWNED BY public.expo_push_tickets.id;


--
-- Name: featured_institutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_institutions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    logo_key character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: featured_institutions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.featured_institutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: featured_institutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.featured_institutions_id_seq OWNED BY public.featured_institutions.id;


--
-- Name: fee_billing_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_billing_batches (
    id character varying(36) NOT NULL,
    institution_id integer NOT NULL,
    label character varying(120) NOT NULL,
    request_hash character varying(64) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: fee_heads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_heads (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(100) NOT NULL,
    kind character varying(20) DEFAULT 'RECURRING'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_heads_kind_check CHECK (((kind)::text = ANY ((ARRAY['RECURRING'::character varying, 'ONE_TIME'::character varying])::text[])))
);


--
-- Name: fee_heads_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_heads_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_heads_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_heads_id_seq OWNED BY public.fee_heads.id;


--
-- Name: fee_invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_invoice_items (
    id integer NOT NULL,
    invoice_id integer NOT NULL,
    fee_head_id integer,
    label character varying(120) NOT NULL,
    type character varying(20) NOT NULL,
    amount integer NOT NULL,
    CONSTRAINT fee_invoice_items_amount_check CHECK ((amount >= 0)),
    CONSTRAINT fee_invoice_items_type_check CHECK (((type)::text = ANY ((ARRAY['FEE'::character varying, 'DISCOUNT'::character varying, 'CHARGE'::character varying, 'LATE_FEE'::character varying])::text[])))
);


--
-- Name: fee_invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_invoice_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_invoice_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_invoice_items_id_seq OWNED BY public.fee_invoice_items.id;


--
-- Name: fee_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_invoices (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    billing_month character varying(7) NOT NULL,
    due_date date NOT NULL,
    status character varying(20) DEFAULT 'DUE'::character varying NOT NULL,
    subtotal integer NOT NULL,
    discount_amount integer DEFAULT 0 NOT NULL,
    additional_amount integer DEFAULT 0 NOT NULL,
    late_fee_amount integer DEFAULT 0 NOT NULL,
    total_amount integer NOT NULL,
    paid_amount integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    class_id_at_issue integer,
    class_name_at_issue character varying(255),
    section_id_at_issue integer,
    section_name_at_issue character varying(255),
    billing_key character varying(36) DEFAULT 'MONTHLY'::character varying NOT NULL,
    billing_kind character varying(20) DEFAULT 'MONTHLY'::character varying NOT NULL,
    billing_label character varying(120),
    CONSTRAINT fee_invoice_billing_kind_check CHECK (((((billing_kind)::text = 'MONTHLY'::text) AND ((billing_key)::text = 'MONTHLY'::text)) OR (((billing_kind)::text = 'ONE_TIME'::text) AND ((billing_key)::text ~ '^[0-9a-fA-F-]{36}$'::text)))),
    CONSTRAINT fee_invoices_additional_amount_check CHECK ((additional_amount >= 0)),
    CONSTRAINT fee_invoices_billing_month_check CHECK (((billing_month)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)),
    CONSTRAINT fee_invoices_discount_amount_check CHECK ((discount_amount >= 0)),
    CONSTRAINT fee_invoices_late_fee_amount_check CHECK ((late_fee_amount >= 0)),
    CONSTRAINT fee_invoices_paid_amount_check CHECK ((paid_amount >= 0)),
    CONSTRAINT fee_invoices_status_check CHECK (((status)::text = ANY ((ARRAY['DUE'::character varying, 'PARTIAL'::character varying, 'PAID'::character varying, 'VOID'::character varying])::text[]))),
    CONSTRAINT fee_invoices_subtotal_check CHECK ((subtotal >= 0)),
    CONSTRAINT fee_invoices_total_amount_check CHECK ((total_amount >= 0))
);


--
-- Name: fee_invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_invoices_id_seq OWNED BY public.fee_invoices.id;


--
-- Name: fee_payment_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_payment_submissions (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    invoice_id integer NOT NULL,
    student_id integer NOT NULL,
    amount integer NOT NULL,
    source_bank_name character varying(120) NOT NULL,
    transaction_id character varying(160) NOT NULL,
    proof_file_key character varying(500) NOT NULL,
    status character varying(20) DEFAULT 'SUBMITTED'::character varying NOT NULL,
    reviewer_note character varying(500),
    verified_by integer,
    verified_at timestamp without time zone,
    submitted_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    payment_account jsonb,
    submitted_by_role character varying(20),
    submitted_by_id integer,
    CONSTRAINT fee_payment_submissions_amount_check CHECK ((amount > 0)),
    CONSTRAINT fee_payment_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: fee_payment_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_payment_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_payment_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_payment_submissions_id_seq OWNED BY public.fee_payment_submissions.id;


--
-- Name: fee_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_payments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    invoice_id integer NOT NULL,
    student_id integer NOT NULL,
    receipt_number character varying(50) NOT NULL,
    amount integer NOT NULL,
    method character varying(30) NOT NULL,
    reference character varying(120),
    notes text,
    received_at timestamp without time zone DEFAULT now() NOT NULL,
    recorded_by integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_payments_amount_check CHECK ((amount > 0)),
    CONSTRAINT fee_payments_method_check CHECK (((method)::text = ANY ((ARRAY['CASH'::character varying, 'BANK'::character varying, 'EASYPAISA'::character varying, 'JAZZCASH'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: fee_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_payments_id_seq OWNED BY public.fee_payments.id;


--
-- Name: fee_voucher_cycles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_voucher_cycles (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    billing_month character varying(7) NOT NULL,
    status character varying(20) DEFAULT 'DUE'::character varying NOT NULL,
    late_fee_amount integer DEFAULT 0 NOT NULL,
    voucher_id integer,
    late_marked_at timestamp without time zone,
    submitted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fee_voucher_cycles_late_fee_check CHECK ((late_fee_amount >= 0)),
    CONSTRAINT fee_voucher_cycles_status_check CHECK (((status)::text = ANY ((ARRAY['DUE'::character varying, 'LATE'::character varying, 'SUBMITTED'::character varying])::text[])))
);


--
-- Name: TABLE fee_voucher_cycles; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fee_voucher_cycles IS 'Read-only legacy archive. New monthly obligations belong to fee_invoices.';


--
-- Name: fee_voucher_cycles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_voucher_cycles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_voucher_cycles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_voucher_cycles_id_seq OWNED BY public.fee_voucher_cycles.id;


--
-- Name: fee_vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fee_vouchers (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    title character varying(255) NOT NULL,
    image_url character varying(500) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    billing_month character varying(7),
    late_fee_amount integer DEFAULT 0 NOT NULL,
    CONSTRAINT fee_vouchers_late_fee_amount_check CHECK ((late_fee_amount >= 0))
);


--
-- Name: TABLE fee_vouchers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fee_vouchers IS 'Read-only legacy archive. New fee proofs belong to fee_payment_submissions.';


--
-- Name: fee_vouchers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fee_vouchers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fee_vouchers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fee_vouchers_id_seq OWNED BY public.fee_vouchers.id;


--
-- Name: gateway_payment_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gateway_payment_attempts (
    id character varying(20) NOT NULL,
    institution_id integer NOT NULL,
    invoice_id integer,
    application_id integer,
    gateway character varying(20) NOT NULL,
    environment character varying(20) NOT NULL,
    merchant_id character varying(160) NOT NULL,
    amount integer NOT NULL,
    currency character varying(3) DEFAULT 'PKR'::character varying NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    credentials_encrypted text NOT NULL,
    return_url text NOT NULL,
    institution_name text NOT NULL,
    payer_name text NOT NULL,
    description text NOT NULL,
    receipt_number character varying(50),
    provider_reference character varying(160),
    provider_response_code character varying(20),
    evidence_digest character varying(64),
    qr_image text,
    last_checked_at timestamp without time zone,
    verified_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    initiation_started_at timestamp without time zone,
    closed_at timestamp without time zone,
    portal_origin text,
    CONSTRAINT gateway_payment_attempts_amount_check CHECK (((amount > 0) AND (amount <= 21474836))),
    CONSTRAINT gateway_payment_attempts_check CHECK (((((invoice_id IS NOT NULL))::integer + ((application_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT gateway_payment_attempts_check1 CHECK (((((status)::text = 'PENDING'::text) AND (verified_at IS NULL) AND (receipt_number IS NULL)) OR (((status)::text = ANY ((ARRAY['PAID'::character varying, 'REVIEW'::character varying])::text[])) AND (verified_at IS NOT NULL) AND (receipt_number IS NOT NULL)))),
    CONSTRAINT gateway_payment_attempts_currency_check CHECK (((currency)::text = 'PKR'::text)),
    CONSTRAINT gateway_payment_attempts_environment_check CHECK (((environment)::text = ANY ((ARRAY['sandbox'::character varying, 'production'::character varying])::text[]))),
    CONSTRAINT gateway_payment_attempts_gateway_check CHECK (((gateway)::text = ANY ((ARRAY['easypaisa'::character varying, 'jazzcash'::character varying, 'hblpay'::character varying])::text[]))),
    CONSTRAINT gateway_payment_attempts_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'REVIEW'::character varying])::text[])))
);


--
-- Name: grading_scales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grading_scales (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    passing_percentage real NOT NULL,
    grades_json jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT grading_scales_passing_percentage_check CHECK (((passing_percentage >= (0)::double precision) AND (passing_percentage <= (100)::double precision)))
);


--
-- Name: grading_scales_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.grading_scales_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: grading_scales_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.grading_scales_id_seq OWNED BY public.grading_scales.id;


--
-- Name: institution_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_admins (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_admins_id_seq OWNED BY public.institution_admins.id;


--
-- Name: institution_agreement_acceptances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_agreement_acceptances (
    institution_id integer NOT NULL,
    agreement_version character varying(40) NOT NULL,
    accepted_at timestamp with time zone DEFAULT now() NOT NULL,
    representative_name character varying(255) NOT NULL,
    contact_email character varying(255) NOT NULL,
    snapshot jsonb NOT NULL
);


--
-- Name: institution_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_backups (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    backup_type character varying(16) NOT NULL,
    period_key character varying(40) NOT NULL,
    status character varying(16) DEFAULT 'PENDING'::character varying NOT NULL,
    object_key text,
    file_size bigint,
    sha256 character varying(64),
    record_count integer,
    table_count integer,
    requested_by integer,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    requested_by_employee integer,
    CONSTRAINT institution_backups_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'RUNNING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying])::text[]))),
    CONSTRAINT institution_backups_type_check CHECK (((backup_type)::text = ANY ((ARRAY['DAILY'::character varying, 'MONTHLY'::character varying, 'MANUAL'::character varying, 'EXPORT'::character varying])::text[])))
);


--
-- Name: institution_backups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_backups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_backups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_backups_id_seq OWNED BY public.institution_backups.id;


--
-- Name: institution_custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_custom_roles (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(100) NOT NULL,
    permissions jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_custom_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_custom_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_custom_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_custom_roles_id_seq OWNED BY public.institution_custom_roles.id;


--
-- Name: institution_google_drive_backups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_google_drive_backups (
    institution_id integer NOT NULL,
    credentials_encrypted text,
    folder_id character varying(255),
    folder_name character varying(255),
    backup_file_id character varying(255),
    backup_file_name character varying(255),
    archive_password_encrypted text,
    last_backup_at timestamp with time zone,
    last_backup_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_holidays (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    date date NOT NULL,
    name character varying(255),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_holidays_id_seq OWNED BY public.institution_holidays.id;


--
-- Name: institution_owners; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_owners (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(255) NOT NULL,
    gender public.gender NOT NULL,
    email character varying(255) NOT NULL,
    contact_number character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: institution_owners_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_owners_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_owners_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_owners_id_seq OWNED BY public.institution_owners.id;


--
-- Name: institution_payment_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_payment_gateways (
    institution_id integer NOT NULL,
    credentials_encrypted text NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    mode character varying(16) DEFAULT 'MANUAL'::character varying NOT NULL,
    CONSTRAINT institution_payment_gateways_mode_check CHECK (((mode)::text = ANY ((ARRAY['MANUAL'::character varying, 'ONLINE'::character varying])::text[])))
);


--
-- Name: institution_public_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_public_profiles (
    institution_id integer NOT NULL,
    tagline character varying(160),
    description text,
    public_email character varying(255),
    public_phone character varying(50),
    public_address character varying(300),
    accent_color character varying(7) DEFAULT '#233c32'::character varying NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    hero_image_url character varying(500),
    announcement_text character varying(240),
    announcement_link character varying(500),
    about_title character varying(120),
    mission text,
    vision text,
    principal_name character varying(120),
    principal_title character varying(120),
    principal_message text,
    principal_image_url character varying(500),
    statistics jsonb DEFAULT '[]'::jsonb NOT NULL,
    programs jsonb DEFAULT '[]'::jsonb NOT NULL,
    highlights jsonb DEFAULT '[]'::jsonb NOT NULL,
    gallery_images jsonb DEFAULT '[]'::jsonb NOT NULL,
    map_url character varying(500),
    facebook_url character varying(500),
    instagram_url character varying(500),
    youtube_url character varying(500),
    website_notices jsonb,
    theme character varying(30) DEFAULT 'default'::character varying NOT NULL,
    design jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT institution_public_profiles_accent_color_check CHECK (((accent_color)::text = ANY ((ARRAY['#233c32'::character varying, '#1d4ed8'::character varying, '#7c2d12'::character varying, '#5b21b6'::character varying, '#0f766e'::character varying])::text[]))),
    CONSTRAINT institution_public_profiles_description_length_check CHECK (((description IS NULL) OR (char_length(description) <= 2000))),
    CONSTRAINT institution_public_profiles_gallery_check CHECK (((jsonb_typeof(gallery_images) = 'array'::text) AND (jsonb_array_length(gallery_images) <= 8))),
    CONSTRAINT institution_public_profiles_highlights_check CHECK (((jsonb_typeof(highlights) = 'array'::text) AND (jsonb_array_length(highlights) <= 8))),
    CONSTRAINT institution_public_profiles_programs_check CHECK (((jsonb_typeof(programs) = 'array'::text) AND (jsonb_array_length(programs) <= 8))),
    CONSTRAINT institution_public_profiles_statistics_check CHECK (((jsonb_typeof(statistics) = 'array'::text) AND (jsonb_array_length(statistics) <= 6))),
    CONSTRAINT institution_public_profiles_theme_check CHECK (((theme)::text = ANY ((ARRAY['default'::character varying, 'heritage'::character varying, 'folio'::character varying, 'grove'::character varying, 'orbit'::character varying, 'mosaic'::character varying])::text[])))
);


--
-- Name: institution_restore_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institution_restore_requests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    status character varying(32) DEFAULT 'PREVIEW_PENDING'::character varying NOT NULL,
    payload_encrypted text,
    archive_sha256 character varying(64) NOT NULL,
    backup_generated_at timestamp without time zone NOT NULL,
    preview jsonb,
    preview_hash character varying(64),
    approved_at timestamp without time zone,
    execution_requested_by integer,
    recovery_encrypted text,
    recovery_expires_at timestamp without time zone,
    source_restore_id integer,
    error text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    execution_requested_by_employee integer,
    execution_requested_role character varying(16),
    CONSTRAINT institution_restore_requests_execution_requested_role_check CHECK (((execution_requested_role)::text = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'EMPLOYEE'::character varying])::text[]))),
    CONSTRAINT institution_restore_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PREVIEW_PENDING'::character varying, 'PREVIEW_RUNNING'::character varying, 'AWAITING_APPROVAL'::character varying, 'APPROVED'::character varying, 'EXECUTION_PENDING'::character varying, 'EXECUTION_RUNNING'::character varying, 'CACHE_PENDING'::character varying, 'COMPLETED'::character varying, 'FAILED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: institution_restore_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institution_restore_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institution_restore_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institution_restore_requests_id_seq OWNED BY public.institution_restore_requests.id;


--
-- Name: institutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutions (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type public.institution_type NOT NULL,
    username character varying(30) NOT NULL,
    logo_key character varying(255) NOT NULL,
    country character varying(100) NOT NULL,
    city character varying(100) NOT NULL,
    address text NOT NULL,
    contact_email character varying(255) NOT NULL,
    contact_phone character varying(50) NOT NULL,
    registration_number character varying(100) NOT NULL,
    proof_document_key character varying(255) NOT NULL,
    status public.institution_status DEFAULT 'PENDING'::public.institution_status NOT NULL,
    rejection_reason text,
    admin_password_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    signature_key character varying(255),
    accept_fee_vouchers boolean DEFAULT false NOT NULL,
    allow_graduated_student_access boolean DEFAULT true NOT NULL,
    pricing_plan character varying(20) NOT NULL,
    fee_voucher_open_day integer,
    fee_voucher_late_day integer,
    fee_voucher_late_fee integer DEFAULT 0 NOT NULL,
    public_slug character varying(30),
    public_site_enabled boolean DEFAULT false NOT NULL,
    admissions_enabled boolean DEFAULT false NOT NULL,
    fee_payment_methods jsonb DEFAULT '[]'::jsonb NOT NULL,
    course_streaming_provider public.streaming_provider,
    course_streaming_credentials text,
    parent_institution_id integer,
    campus_name character varying(255) DEFAULT 'Main'::character varying NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    apps_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT institutions_admissions_requires_public_site_check CHECK (((NOT admissions_enabled) OR public_site_enabled)),
    CONSTRAINT institutions_fee_voucher_day_order_check CHECK (((fee_voucher_open_day IS NULL) OR (fee_voucher_late_day IS NULL) OR (fee_voucher_late_day > fee_voucher_open_day))),
    CONSTRAINT institutions_fee_voucher_late_day_check CHECK (((fee_voucher_late_day IS NULL) OR ((fee_voucher_late_day >= 1) AND (fee_voucher_late_day <= 28)))),
    CONSTRAINT institutions_fee_voucher_late_fee_check CHECK ((fee_voucher_late_fee >= 0)),
    CONSTRAINT institutions_fee_voucher_open_day_check CHECK (((fee_voucher_open_day IS NULL) OR ((fee_voucher_open_day >= 1) AND (fee_voucher_open_day <= 28)))),
    CONSTRAINT institutions_parent_not_self CHECK (((parent_institution_id IS NULL) OR (parent_institution_id <> id))),
    CONSTRAINT institutions_public_site_requires_slug_check CHECK (((NOT public_site_enabled) OR (public_slug IS NOT NULL))),
    CONSTRAINT institutions_public_slug_format_check CHECK (public_slug IS NULL OR (char_length(public_slug) BETWEEN 2 AND 30 AND public_slug = lower(public_slug) AND public_slug ~ '^[a-z0-9][a-z0-9-]*[a-z0-9]$' AND public_slug NOT LIKE '%--%')),
    CONSTRAINT institutions_public_slug_reserved_check CHECK (((public_slug IS NULL) OR ((public_slug)::text <> ALL ((ARRAY['admin'::character varying, 'api'::character varying, 'app'::character varying, 'apply'::character varying, 'assets'::character varying, 'auth'::character varying, 'blog'::character varying, 'cdn'::character varying, 'docs'::character varying, 'employee'::character varying, 'help'::character varying, 'institution'::character varying, 'mail'::character varying, 'portal'::character varying, 'sa'::character varying, 'static'::character varying, 'status'::character varying, 'staff'::character varying, 'student'::character varying, 'superadmin'::character varying, 'support'::character varying, 'www'::character varying])::text[]))))
);


--
-- Name: institutions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.institutions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: institutions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.institutions_id_seq OWNED BY public.institutions.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    reason text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    parent_phone character varying(50),
    status public.leave_request_status DEFAULT 'PENDING'::public.leave_request_status NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: marks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.marks (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    test_id integer NOT NULL,
    student_id integer NOT NULL,
    marks_obtained real NOT NULL,
    total_marks real NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: marks_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.marks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: marks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.marks_id_seq OWNED BY public.marks.id;


--
-- Name: notification_rollout; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_rollout (
    id boolean DEFAULT true NOT NULL,
    activated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    type public.notification_type NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    reference_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    event_key character varying(128),
    student_id integer,
    data jsonb
);


--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: online_test_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.online_test_questions (
    id integer NOT NULL,
    online_test_id integer NOT NULL,
    question_type public.online_question_type NOT NULL,
    prompt text NOT NULL,
    options jsonb,
    correct_option_index integer,
    marks real NOT NULL,
    order_index integer NOT NULL
);


--
-- Name: online_test_questions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.online_test_questions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: online_test_questions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.online_test_questions_id_seq OWNED BY public.online_test_questions.id;


--
-- Name: online_test_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.online_test_submissions (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    online_test_id integer NOT NULL,
    student_id integer NOT NULL,
    status public.online_submission_status NOT NULL,
    answers jsonb NOT NULL,
    mcq_score real DEFAULT 0 NOT NULL,
    short_score real,
    total_score real DEFAULT 0 NOT NULL,
    started_at timestamp without time zone DEFAULT now() NOT NULL,
    last_heartbeat_at timestamp without time zone,
    violation_reason character varying(50),
    submitted_at timestamp without time zone,
    graded_at timestamp without time zone,
    graded_by integer
);


--
-- Name: online_test_submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.online_test_submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: online_test_submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.online_test_submissions_id_seq OWNED BY public.online_test_submissions.id;


--
-- Name: online_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.online_tests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    test_id integer NOT NULL,
    mode public.online_test_mode NOT NULL,
    duration_minutes integer NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: online_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.online_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: online_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.online_tests_id_seq OWNED BY public.online_tests.id;


--
-- Name: parent_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_accounts (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(255),
    email character varying(255) NOT NULL,
    phone character varying(50),
    password_hash text,
    status public.parent_account_status DEFAULT 'PENDING_ACTIVATION'::public.parent_account_status NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    session_version integer DEFAULT 0 NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    announcement_push_notifications_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT parent_accounts_email_normalized_check CHECK (((email)::text = lower(btrim((email)::text))))
);


--
-- Name: parent_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parent_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parent_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parent_accounts_id_seq OWNED BY public.parent_accounts.id;


--
-- Name: parent_students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.parent_students (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    parent_id integer NOT NULL,
    student_id integer NOT NULL,
    relationship character varying(50) DEFAULT 'GUARDIAN'::character varying NOT NULL,
    linked_by_id integer NOT NULL,
    linked_by_role public.user_role NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: parent_students_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.parent_students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parent_students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.parent_students_id_seq OWNED BY public.parent_students.id;


--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_resets (
    id integer NOT NULL,
    institution_id integer,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: password_resets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_resets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_resets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_resets_id_seq OWNED BY public.password_resets.id;


--
-- Name: plan_device_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_device_sessions (
    id character varying(36) NOT NULL,
    institution_id integer,
    user_role character varying(32) NOT NULL,
    user_id integer NOT NULL,
    refresh_token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_pages (
    id integer NOT NULL,
    slug character varying(255) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    last_edited_at timestamp without time zone DEFAULT now() NOT NULL,
    last_edited_by integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_pages_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_pages_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_pages_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_pages_id_seq OWNED BY public.platform_pages.id;


--
-- Name: platform_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_reviews (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    rating integer NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_reviews_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.platform_reviews_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: platform_reviews_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.platform_reviews_id_seq OWNED BY public.platform_reviews.id;


--
-- Name: pricing_notice_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_notice_reads (
    user_role character varying(32) NOT NULL,
    user_id integer NOT NULL,
    last_change_id integer DEFAULT 0 NOT NULL
);


--
-- Name: pricing_plan_changes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plan_changes (
    id integer NOT NULL,
    plan_id character varying(20) NOT NULL,
    before jsonb,
    after jsonb,
    created_by integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pricing_plan_changes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pricing_plan_changes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pricing_plan_changes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pricing_plan_changes_id_seq OWNED BY public.pricing_plan_changes.id;


--
-- Name: public_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_events (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    title character varying(160) NOT NULL,
    slug character varying(120) NOT NULL,
    summary character varying(500),
    cover_image_url character varying(500),
    event_date character varying(120),
    venue character varying(200),
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    status public.public_event_status DEFAULT 'DRAFT'::public.public_event_status NOT NULL,
    visibility_duration public.public_event_duration DEFAULT 'ONE_WEEK'::public.public_event_duration NOT NULL,
    published_at timestamp with time zone,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    design jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT public_events_blocks_check CHECK (((jsonb_typeof(blocks) = 'array'::text) AND (jsonb_array_length(blocks) <= 40))),
    CONSTRAINT public_events_slug_check CHECK (((slug)::text ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);


--
-- Name: public_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.public_events_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: public_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.public_events_id_seq OWNED BY public.public_events.id;


--
-- Name: push_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_devices (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    token character varying(255) NOT NULL,
    project_id character varying(36) NOT NULL,
    session_token_hash character varying(64) NOT NULL,
    device_name character varying(120),
    revoked_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT push_devices_role_check CHECK ((user_role = ANY (ARRAY['STUDENT'::public.user_role, 'STAFF'::public.user_role, 'PARENT'::public.user_role])))
);


--
-- Name: push_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.push_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: push_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.push_devices_id_seq OWNED BY public.push_devices.id;


--
-- Name: qr_login_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_login_challenges (
    id character varying(36) NOT NULL,
    secret_hash character varying(64) NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    institution_id integer NOT NULL,
    source_refresh_token_id integer NOT NULL,
    account_fingerprint character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    revoked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT qr_login_challenges_role_check CHECK ((user_role = ANY (ARRAY['STUDENT'::public.user_role, 'STAFF'::public.user_role]))),
    CONSTRAINT qr_login_challenges_terminal_check CHECK (((consumed_at IS NULL) OR (revoked_at IS NULL)))
);


--
-- Name: qr_login_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.qr_login_sessions (
    id character varying(36) NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    institution_id integer NOT NULL,
    device_name character varying(120) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT qr_login_sessions_role_check CHECK ((user_role = ANY (ARRAY['STUDENT'::public.user_role, 'STAFF'::public.user_role])))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id integer NOT NULL,
    user_role public.user_role NOT NULL,
    user_id integer NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    revoked_at timestamp without time zone,
    replaced_by_hash text,
    reuse_detected_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    qr_session_id character varying(36),
    client_type character varying(8) DEFAULT 'WEB'::character varying NOT NULL
);


--
-- Name: COLUMN refresh_tokens.replaced_by_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.replaced_by_hash IS 'SHA-256 hash of the one-time successor token; presence enables reuse detection.';


--
-- Name: COLUMN refresh_tokens.reuse_detected_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.refresh_tokens.reuse_detected_at IS 'First time an already-replaced refresh token was presented again.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.refresh_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.refresh_tokens_id_seq OWNED BY public.refresh_tokens.id;


--
-- Name: section_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.section_groups (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    section_id integer NOT NULL,
    name character varying(100) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: section_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.section_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: section_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.section_groups_id_seq OWNED BY public.section_groups.id;


--
-- Name: sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sections (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    class_id integer NOT NULL,
    name character varying(100) NOT NULL,
    class_teacher_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: sections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.sections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: sections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.sections_id_seq OWNED BY public.sections.id;


--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    campus_id integer,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    phone character varying(50),
    profile_picture_url character varying(255),
    password_hash text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    expo_push_token character varying(255),
    announcement_push_notifications_enabled boolean DEFAULT true NOT NULL,
    custom_role_id integer,
    course_streaming_provider public.streaming_provider,
    course_streaming_credentials text
);


--
-- Name: staff_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_assignments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer,
    section_id integer NOT NULL,
    subject_id integer,
    is_break boolean DEFAULT false NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    group_id integer
);


--
-- Name: staff_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_assignments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_assignments_id_seq OWNED BY public.staff_assignments.id;


--
-- Name: staff_attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_attendances (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    date date NOT NULL,
    status public.attendance_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: staff_attendances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_attendances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_attendances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_attendances_id_seq OWNED BY public.staff_attendances.id;


--
-- Name: staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_id_seq OWNED BY public.staff.id;


--
-- Name: staff_profile_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_profile_change_requests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    requested_fields jsonb NOT NULL,
    reason text NOT NULL,
    status public.profile_request_status DEFAULT 'PENDING'::public.profile_request_status NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_by_institution_admin integer
);


--
-- Name: staff_profile_change_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_profile_change_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_profile_change_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_profile_change_requests_id_seq OWNED BY public.staff_profile_change_requests.id;


--
-- Name: staff_teachable_subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_teachable_subjects (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    staff_id integer NOT NULL,
    subject_id integer NOT NULL
);


--
-- Name: staff_teachable_subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_teachable_subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_teachable_subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_teachable_subjects_id_seq OWNED BY public.staff_teachable_subjects.id;


--
-- Name: student_admission_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_admission_counters (
    institution_id integer NOT NULL,
    admission_year integer NOT NULL,
    next_sequence integer DEFAULT 1 NOT NULL
);


--
-- Name: student_fee_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_fee_adjustments (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    label character varying(120) NOT NULL,
    type character varying(20) NOT NULL,
    amount integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    frequency character varying(20) DEFAULT 'RECURRING'::character varying NOT NULL,
    start_month character varying(7),
    end_month character varying(7),
    consumed_invoice_id integer,
    CONSTRAINT fee_adjustment_period_check CHECK ((((frequency)::text = ANY ((ARRAY['ONCE'::character varying, 'RECURRING'::character varying])::text[])) AND ((start_month IS NULL) OR ((start_month)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)) AND ((end_month IS NULL) OR ((end_month)::text ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)) AND ((start_month IS NULL) OR (end_month IS NULL) OR ((end_month)::text >= (start_month)::text)))),
    CONSTRAINT student_fee_adjustments_amount_check CHECK ((amount > 0)),
    CONSTRAINT student_fee_adjustments_type_check CHECK (((type)::text = ANY ((ARRAY['DISCOUNT'::character varying, 'CHARGE'::character varying])::text[])))
);


--
-- Name: student_fee_adjustments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_fee_adjustments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_fee_adjustments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_fee_adjustments_id_seq OWNED BY public.student_fee_adjustments.id;


--
-- Name: student_profile_change_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_profile_change_requests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    requested_fields jsonb NOT NULL,
    reason text NOT NULL,
    status public.profile_request_status DEFAULT 'PENDING'::public.profile_request_status NOT NULL,
    reviewed_by integer,
    reviewed_at timestamp without time zone,
    admin_note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    reviewed_by_institution_admin integer
);


--
-- Name: student_profile_change_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_profile_change_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_profile_change_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_profile_change_requests_id_seq OWNED BY public.student_profile_change_requests.id;


--
-- Name: student_promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_promotions (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    student_id integer NOT NULL,
    from_class_id integer NOT NULL,
    to_class_id integer,
    status public.promotion_status NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    from_roll_number character varying(100),
    to_roll_number character varying(100)
);


--
-- Name: student_promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.student_promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: student_promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.student_promotions_id_seq OWNED BY public.student_promotions.id;


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    campus_id integer,
    name character varying(255) NOT NULL,
    father_name character varying(255),
    phone character varying(50),
    gender character varying(10) DEFAULT 'MALE'::character varying NOT NULL,
    profile_picture_url character varying(255),
    login_roll_number character varying(255) NOT NULL,
    password_hash text NOT NULL,
    class_id integer NOT NULL,
    section_id integer NOT NULL,
    year_of_joining integer NOT NULL,
    class_roll_number character varying(100) NOT NULL,
    age integer,
    is_active boolean DEFAULT true NOT NULL,
    must_change_password boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    expo_push_token character varying(255),
    emergency_contact character varying(50),
    parental_whatsapp character varying(50),
    test_push_notifications_enabled boolean DEFAULT true NOT NULL,
    announcement_push_notifications_enabled boolean DEFAULT true NOT NULL,
    admission_sequence integer,
    academic_status public.student_academic_status DEFAULT 'ACTIVE'::public.student_academic_status NOT NULL,
    guardian_email character varying(255)
);


--
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- Name: subjects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subjects (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: subjects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subjects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subjects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subjects_id_seq OWNED BY public.subjects.id;


--
-- Name: submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.submissions (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    assignment_id integer NOT NULL,
    student_id integer NOT NULL,
    file_key character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    file_url text
);


--
-- Name: submissions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.submissions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: submissions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.submissions_id_seq OWNED BY public.submissions.id;


--
-- Name: subscription_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_plans (
    id character varying(20) NOT NULL,
    kind character varying(8) NOT NULL,
    name character varying(120) NOT NULL,
    monthly_fee_paisa integer,
    setup_fee_paisa integer,
    per_student_fee_paisa integer,
    student_limit integer,
    student_count integer,
    campus_limit integer,
    platforms jsonb DEFAULT '[]'::jsonb NOT NULL,
    device_limit integer,
    platform_managed_campuses boolean DEFAULT false NOT NULL,
    audience character varying(160) DEFAULT ''::character varying NOT NULL,
    featured boolean DEFAULT false NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    redeemed_institution_id integer,
    redeemed_at timestamp with time zone,
    archived_at timestamp with time zone,
    created_by integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subscription_plans_campus_limit_check CHECK ((campus_limit > 0)),
    CONSTRAINT subscription_plans_check CHECK (((student_count IS NULL) OR (student_limit IS NULL) OR (student_count <= student_limit))),
    CONSTRAINT subscription_plans_check2 CHECK ((((kind)::text <> 'DEAL'::text) OR ((monthly_fee_paisa)::bigint = ((per_student_fee_paisa)::bigint * student_count)))),
    CONSTRAINT subscription_plans_deal_required_fields CHECK ((((kind)::text <> 'DEAL'::text) OR ((student_count IS NOT NULL) AND (student_limit IS NOT NULL) AND (per_student_fee_paisa IS NOT NULL) AND (monthly_fee_paisa IS NOT NULL)))),
    CONSTRAINT subscription_plans_device_limit_check CHECK ((device_limit > 0)),
    CONSTRAINT subscription_plans_kind_check CHECK (((kind)::text = ANY ((ARRAY['PUBLIC'::character varying, 'DEAL'::character varying])::text[]))),
    CONSTRAINT subscription_plans_monthly_fee_paisa_check CHECK ((monthly_fee_paisa >= 0)),
    CONSTRAINT subscription_plans_per_student_fee_paisa_check CHECK ((per_student_fee_paisa >= 0)),
    CONSTRAINT subscription_plans_setup_fee_paisa_check CHECK ((setup_fee_paisa >= 0)),
    CONSTRAINT subscription_plans_student_count_check CHECK ((student_count > 0)),
    CONSTRAINT subscription_plans_student_limit_check CHECK ((student_limit > 0))
);


--
-- Name: super_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.super_admins (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    password_hash text NOT NULL,
    security_question text NOT NULL,
    security_answer_hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    is_super_admin boolean DEFAULT false NOT NULL
);


--
-- Name: super_admins_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.super_admins_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: super_admins_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.super_admins_id_seq OWNED BY public.super_admins.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id integer NOT NULL,
    mobile_app_version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    software_version character varying(50) DEFAULT '1.0.0'::character varying NOT NULL,
    public_site_base_domain character varying(253) DEFAULT 'nisaab360.app'::character varying NOT NULL
);


--
-- Name: system_settings_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.system_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: system_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.system_settings_id_seq OWNED BY public.system_settings.id;


--
-- Name: tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tests (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    class_id integer NOT NULL,
    section_id integer,
    subject_id integer NOT NULL,
    staff_id integer,
    created_by_role public.test_creator_role NOT NULL,
    type public.test_type NOT NULL,
    title character varying(255) NOT NULL,
    max_marks real NOT NULL,
    date date NOT NULL,
    end_date date,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    results_published_at timestamp without time zone
);


--
-- Name: tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tests_id_seq OWNED BY public.tests.id;


--
-- Name: ticket_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_history (
    id integer NOT NULL,
    ticket_id integer NOT NULL,
    actor_role public.user_role NOT NULL,
    actor_id integer NOT NULL,
    action public.ticket_history_action NOT NULL,
    notes text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: ticket_history_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ticket_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ticket_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ticket_history_id_seq OWNED BY public.ticket_history.id;


--
-- Name: tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tickets (
    id integer NOT NULL,
    institution_id integer NOT NULL,
    creator_role public.user_role NOT NULL,
    creator_id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text NOT NULL,
    status public.ticket_status DEFAULT 'OPEN'::public.ticket_status NOT NULL,
    platform_status public.ticket_platform_status,
    is_forwarded boolean DEFAULT false NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tickets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: academic_sessions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_sessions ALTER COLUMN id SET DEFAULT nextval('public.academic_sessions_id_seq'::regclass);


--
-- Name: account_deletions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletions ALTER COLUMN id SET DEFAULT nextval('public.account_deletions_id_seq'::regclass);


--
-- Name: account_lockouts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts ALTER COLUMN id SET DEFAULT nextval('public.account_lockouts_id_seq'::regclass);


--
-- Name: admission_applicant_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applicant_accounts ALTER COLUMN id SET DEFAULT nextval('public.admission_applicant_accounts_id_seq'::regclass);


--
-- Name: admission_application_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_application_events ALTER COLUMN id SET DEFAULT nextval('public.admission_application_events_id_seq'::regclass);


--
-- Name: admission_applications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications ALTER COLUMN id SET DEFAULT nextval('public.admission_applications_id_seq'::regclass);


--
-- Name: admission_appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_appointments ALTER COLUMN id SET DEFAULT nextval('public.admission_appointments_id_seq'::regclass);


--
-- Name: admission_cycles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycles ALTER COLUMN id SET DEFAULT nextval('public.admission_cycles_id_seq'::regclass);


--
-- Name: admission_document_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_document_requests ALTER COLUMN id SET DEFAULT nextval('public.admission_document_requests_id_seq'::regclass);


--
-- Name: admission_enrollments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments ALTER COLUMN id SET DEFAULT nextval('public.admission_enrollments_id_seq'::regclass);


--
-- Name: admission_fee_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_payments ALTER COLUMN id SET DEFAULT nextval('public.admission_fee_payments_id_seq'::regclass);


--
-- Name: admission_fee_proofs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_proofs ALTER COLUMN id SET DEFAULT nextval('public.admission_fee_proofs_id_seq'::regclass);


--
-- Name: admission_offerings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings ALTER COLUMN id SET DEFAULT nextval('public.admission_offerings_id_seq'::regclass);


--
-- Name: announcement_reads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reads ALTER COLUMN id SET DEFAULT nextval('public.announcement_reads_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments ALTER COLUMN id SET DEFAULT nextval('public.assignments_id_seq'::regclass);


--
-- Name: attendance_delegations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations ALTER COLUMN id SET DEFAULT nextval('public.attendance_delegations_id_seq'::regclass);


--
-- Name: attendances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances ALTER COLUMN id SET DEFAULT nextval('public.attendances_id_seq'::regclass);


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: batch_exam_results id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_results ALTER COLUMN id SET DEFAULT nextval('public.batch_exam_results_id_seq'::regclass);


--
-- Name: batch_exam_subjects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_subjects ALTER COLUMN id SET DEFAULT nextval('public.batch_exam_subjects_id_seq'::regclass);


--
-- Name: batch_exams id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exams ALTER COLUMN id SET DEFAULT nextval('public.batch_exams_id_seq'::regclass);


--
-- Name: blogs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blogs ALTER COLUMN id SET DEFAULT nextval('public.blogs_id_seq'::regclass);


--
-- Name: campuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campuses ALTER COLUMN id SET DEFAULT nextval('public.campuses_id_seq'::regclass);


--
-- Name: central_database_backups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_database_backups ALTER COLUMN id SET DEFAULT nextval('public.central_database_backups_id_seq'::regclass);


--
-- Name: class_fee_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items ALTER COLUMN id SET DEFAULT nextval('public.class_fee_items_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: course_classes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_classes ALTER COLUMN id SET DEFAULT nextval('public.course_classes_id_seq'::regclass);


--
-- Name: course_lecture_progress id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lecture_progress ALTER COLUMN id SET DEFAULT nextval('public.course_lecture_progress_id_seq'::regclass);


--
-- Name: course_lectures id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lectures ALTER COLUMN id SET DEFAULT nextval('public.course_lectures_id_seq'::regclass);


--
-- Name: courses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses ALTER COLUMN id SET DEFAULT nextval('public.courses_id_seq'::regclass);


--
-- Name: diaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries ALTER COLUMN id SET DEFAULT nextval('public.diaries_id_seq'::regclass);


--
-- Name: email_outbox id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox ALTER COLUMN id SET DEFAULT nextval('public.email_outbox_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: expo_push_tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tickets ALTER COLUMN id SET DEFAULT nextval('public.expo_push_tickets_id_seq'::regclass);


--
-- Name: featured_institutions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_institutions ALTER COLUMN id SET DEFAULT nextval('public.featured_institutions_id_seq'::regclass);


--
-- Name: fee_heads id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_heads ALTER COLUMN id SET DEFAULT nextval('public.fee_heads_id_seq'::regclass);


--
-- Name: fee_invoice_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoice_items ALTER COLUMN id SET DEFAULT nextval('public.fee_invoice_items_id_seq'::regclass);


--
-- Name: fee_invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices ALTER COLUMN id SET DEFAULT nextval('public.fee_invoices_id_seq'::regclass);


--
-- Name: fee_payment_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payment_submissions ALTER COLUMN id SET DEFAULT nextval('public.fee_payment_submissions_id_seq'::regclass);


--
-- Name: fee_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments ALTER COLUMN id SET DEFAULT nextval('public.fee_payments_id_seq'::regclass);


--
-- Name: fee_voucher_cycles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_voucher_cycles ALTER COLUMN id SET DEFAULT nextval('public.fee_voucher_cycles_id_seq'::regclass);


--
-- Name: fee_vouchers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_vouchers ALTER COLUMN id SET DEFAULT nextval('public.fee_vouchers_id_seq'::regclass);


--
-- Name: grading_scales id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_scales ALTER COLUMN id SET DEFAULT nextval('public.grading_scales_id_seq'::regclass);


--
-- Name: institution_admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_admins ALTER COLUMN id SET DEFAULT nextval('public.institution_admins_id_seq'::regclass);


--
-- Name: institution_backups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups ALTER COLUMN id SET DEFAULT nextval('public.institution_backups_id_seq'::regclass);


--
-- Name: institution_custom_roles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_custom_roles ALTER COLUMN id SET DEFAULT nextval('public.institution_custom_roles_id_seq'::regclass);


--
-- Name: institution_holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_holidays ALTER COLUMN id SET DEFAULT nextval('public.institution_holidays_id_seq'::regclass);


--
-- Name: institution_owners id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_owners ALTER COLUMN id SET DEFAULT nextval('public.institution_owners_id_seq'::regclass);


--
-- Name: institution_restore_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests ALTER COLUMN id SET DEFAULT nextval('public.institution_restore_requests_id_seq'::regclass);


--
-- Name: institutions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions ALTER COLUMN id SET DEFAULT nextval('public.institutions_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: marks id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks ALTER COLUMN id SET DEFAULT nextval('public.marks_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: online_test_questions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_questions ALTER COLUMN id SET DEFAULT nextval('public.online_test_questions_id_seq'::regclass);


--
-- Name: online_test_submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions ALTER COLUMN id SET DEFAULT nextval('public.online_test_submissions_id_seq'::regclass);


--
-- Name: online_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_tests ALTER COLUMN id SET DEFAULT nextval('public.online_tests_id_seq'::regclass);


--
-- Name: parent_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_accounts ALTER COLUMN id SET DEFAULT nextval('public.parent_accounts_id_seq'::regclass);


--
-- Name: parent_students id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students ALTER COLUMN id SET DEFAULT nextval('public.parent_students_id_seq'::regclass);


--
-- Name: password_resets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets ALTER COLUMN id SET DEFAULT nextval('public.password_resets_id_seq'::regclass);


--
-- Name: platform_pages id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages ALTER COLUMN id SET DEFAULT nextval('public.platform_pages_id_seq'::regclass);


--
-- Name: platform_reviews id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_reviews ALTER COLUMN id SET DEFAULT nextval('public.platform_reviews_id_seq'::regclass);


--
-- Name: pricing_plan_changes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_changes ALTER COLUMN id SET DEFAULT nextval('public.pricing_plan_changes_id_seq'::regclass);


--
-- Name: public_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_events ALTER COLUMN id SET DEFAULT nextval('public.public_events_id_seq'::regclass);


--
-- Name: push_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices ALTER COLUMN id SET DEFAULT nextval('public.push_devices_id_seq'::regclass);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('public.refresh_tokens_id_seq'::regclass);


--
-- Name: section_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_groups ALTER COLUMN id SET DEFAULT nextval('public.section_groups_id_seq'::regclass);


--
-- Name: sections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections ALTER COLUMN id SET DEFAULT nextval('public.sections_id_seq'::regclass);


--
-- Name: staff id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff ALTER COLUMN id SET DEFAULT nextval('public.staff_id_seq'::regclass);


--
-- Name: staff_assignments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments ALTER COLUMN id SET DEFAULT nextval('public.staff_assignments_id_seq'::regclass);


--
-- Name: staff_attendances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_attendances ALTER COLUMN id SET DEFAULT nextval('public.staff_attendances_id_seq'::regclass);


--
-- Name: staff_profile_change_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests ALTER COLUMN id SET DEFAULT nextval('public.staff_profile_change_requests_id_seq'::regclass);


--
-- Name: staff_teachable_subjects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_teachable_subjects ALTER COLUMN id SET DEFAULT nextval('public.staff_teachable_subjects_id_seq'::regclass);


--
-- Name: student_fee_adjustments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustments ALTER COLUMN id SET DEFAULT nextval('public.student_fee_adjustments_id_seq'::regclass);


--
-- Name: student_profile_change_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests ALTER COLUMN id SET DEFAULT nextval('public.student_profile_change_requests_id_seq'::regclass);


--
-- Name: student_promotions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions ALTER COLUMN id SET DEFAULT nextval('public.student_promotions_id_seq'::regclass);


--
-- Name: students id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- Name: subjects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects ALTER COLUMN id SET DEFAULT nextval('public.subjects_id_seq'::regclass);


--
-- Name: submissions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions ALTER COLUMN id SET DEFAULT nextval('public.submissions_id_seq'::regclass);


--
-- Name: super_admins id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins ALTER COLUMN id SET DEFAULT nextval('public.super_admins_id_seq'::regclass);


--
-- Name: system_settings id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings ALTER COLUMN id SET DEFAULT nextval('public.system_settings_id_seq'::regclass);


--
-- Name: tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests ALTER COLUMN id SET DEFAULT nextval('public.tests_id_seq'::regclass);


--
-- Name: ticket_history id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history ALTER COLUMN id SET DEFAULT nextval('public.ticket_history_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: academic_sessions academic_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_sessions
    ADD CONSTRAINT academic_sessions_pkey PRIMARY KEY (id);


--
-- Name: account_deletions account_deletions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletions
    ADD CONSTRAINT account_deletions_pkey PRIMARY KEY (id);


--
-- Name: account_lockouts account_lockout_user_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts
    ADD CONSTRAINT account_lockout_user_unique UNIQUE (user_role, user_id);


--
-- Name: account_lockouts account_lockouts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_lockouts
    ADD CONSTRAINT account_lockouts_pkey PRIMARY KEY (id);


--
-- Name: admission_applicant_accounts admission_applicant_accounts_id_inst_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applicant_accounts
    ADD CONSTRAINT admission_applicant_accounts_id_inst_unique UNIQUE (id, institution_id);


--
-- Name: admission_applicant_accounts admission_applicant_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applicant_accounts
    ADD CONSTRAINT admission_applicant_accounts_pkey PRIMARY KEY (id);


--
-- Name: admission_application_events admission_application_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_application_events
    ADD CONSTRAINT admission_application_events_pkey PRIMARY KEY (id);


--
-- Name: admission_applications admission_applications_application_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_application_number_key UNIQUE (application_number);


--
-- Name: admission_applications admission_applications_id_inst_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_id_inst_unique UNIQUE (id, institution_id);


--
-- Name: admission_applications admission_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_pkey PRIMARY KEY (id);


--
-- Name: admission_appointments admission_appointments_application_type_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_appointments
    ADD CONSTRAINT admission_appointments_application_type_unique UNIQUE (application_id, type);


--
-- Name: admission_appointments admission_appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_appointments
    ADD CONSTRAINT admission_appointments_pkey PRIMARY KEY (id);


--
-- Name: admission_cycle_campuses admission_cycle_campuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycle_campuses
    ADD CONSTRAINT admission_cycle_campuses_pkey PRIMARY KEY (cycle_id, campus_id);


--
-- Name: admission_cycles admission_cycles_id_institution_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycles
    ADD CONSTRAINT admission_cycles_id_institution_unique UNIQUE (id, institution_id);


--
-- Name: admission_cycles admission_cycles_institution_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycles
    ADD CONSTRAINT admission_cycles_institution_name_unique UNIQUE (institution_id, name);


--
-- Name: admission_cycles admission_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycles
    ADD CONSTRAINT admission_cycles_pkey PRIMARY KEY (id);


--
-- Name: admission_document_requests admission_document_requests_app_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_document_requests
    ADD CONSTRAINT admission_document_requests_app_name_unique UNIQUE (application_id, document_name);


--
-- Name: admission_document_requests admission_document_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_document_requests
    ADD CONSTRAINT admission_document_requests_pkey PRIMARY KEY (id);


--
-- Name: admission_enrollments admission_enrollments_application_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_application_unique UNIQUE (application_id);


--
-- Name: admission_enrollments admission_enrollments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_pkey PRIMARY KEY (id);


--
-- Name: admission_enrollments admission_enrollments_student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_student_unique UNIQUE (student_id);


--
-- Name: admission_fee_payments admission_fee_payments_application_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_payments
    ADD CONSTRAINT admission_fee_payments_application_unique UNIQUE (application_id);


--
-- Name: admission_fee_payments admission_fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_payments
    ADD CONSTRAINT admission_fee_payments_pkey PRIMARY KEY (id);


--
-- Name: admission_fee_proofs admission_fee_proofs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_proofs
    ADD CONSTRAINT admission_fee_proofs_pkey PRIMARY KEY (id);


--
-- Name: admission_offerings admission_offerings_cycle_title_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings
    ADD CONSTRAINT admission_offerings_cycle_title_unique UNIQUE (cycle_id, title);


--
-- Name: admission_offerings admission_offerings_id_inst_cycle_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings
    ADD CONSTRAINT admission_offerings_id_inst_cycle_unique UNIQUE (id, institution_id, cycle_id);


--
-- Name: admission_offerings admission_offerings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings
    ADD CONSTRAINT admission_offerings_pkey PRIMARY KEY (id);


--
-- Name: announcement_reads announcement_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT announcement_reads_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: assignments assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_pkey PRIMARY KEY (id);


--
-- Name: attendance_delegations attendance_delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations
    ADD CONSTRAINT attendance_delegations_pkey PRIMARY KEY (id);


--
-- Name: attendance_delegations attendance_delegations_section_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations
    ADD CONSTRAINT attendance_delegations_section_date_unique UNIQUE (section_id, date);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: batch_exam_results batch_exam_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_results
    ADD CONSTRAINT batch_exam_results_pkey PRIMARY KEY (id);


--
-- Name: batch_exam_subjects batch_exam_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_subjects
    ADD CONSTRAINT batch_exam_subjects_pkey PRIMARY KEY (id);


--
-- Name: batch_exams batch_exams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exams
    ADD CONSTRAINT batch_exams_pkey PRIMARY KEY (id);


--
-- Name: blogs blogs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blogs
    ADD CONSTRAINT blogs_pkey PRIMARY KEY (id);


--
-- Name: blogs blogs_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blogs
    ADD CONSTRAINT blogs_slug_unique UNIQUE (slug);


--
-- Name: campuses campuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_pkey PRIMARY KEY (id);


--
-- Name: central_backup_jobs central_backup_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_backup_jobs
    ADD CONSTRAINT central_backup_jobs_pkey PRIMARY KEY (run_id);


--
-- Name: central_backup_settings central_backup_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_backup_settings
    ADD CONSTRAINT central_backup_settings_pkey PRIMARY KEY (id);


--
-- Name: central_database_backups central_database_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_database_backups
    ADD CONSTRAINT central_database_backups_pkey PRIMARY KEY (id);


--
-- Name: class_fee_items class_fee_items_class_head_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items
    ADD CONSTRAINT class_fee_items_class_head_unique UNIQUE (institution_id, class_id, fee_head_id);


--
-- Name: class_fee_items class_fee_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items
    ADD CONSTRAINT class_fee_items_pkey PRIMARY KEY (id);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: course_classes course_classes_course_class_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_classes
    ADD CONSTRAINT course_classes_course_class_unique UNIQUE (course_id, class_id);


--
-- Name: course_classes course_classes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_classes
    ADD CONSTRAINT course_classes_pkey PRIMARY KEY (id);


--
-- Name: course_lecture_progress course_lecture_progress_lecture_student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lecture_progress
    ADD CONSTRAINT course_lecture_progress_lecture_student_unique UNIQUE (lecture_id, student_id);


--
-- Name: course_lecture_progress course_lecture_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lecture_progress
    ADD CONSTRAINT course_lecture_progress_pkey PRIMARY KEY (id);


--
-- Name: course_lectures course_lectures_course_sequence_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lectures
    ADD CONSTRAINT course_lectures_course_sequence_unique UNIQUE (course_id, sequence);


--
-- Name: course_lectures course_lectures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lectures
    ADD CONSTRAINT course_lectures_pkey PRIMARY KEY (id);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: dealt_code_fingerprints dealt_code_fingerprints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealt_code_fingerprints
    ADD CONSTRAINT dealt_code_fingerprints_pkey PRIMARY KEY (code_hash);


--
-- Name: dealt_plan_codes dealt_plan_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealt_plan_codes
    ADD CONSTRAINT dealt_plan_codes_pkey PRIMARY KEY (code_hash);


--
-- Name: diaries diaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries
    ADD CONSTRAINT diaries_pkey PRIMARY KEY (id);


--
-- Name: email_outbox email_outbox_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_dedupe_key_key UNIQUE (dedupe_key);


--
-- Name: email_outbox email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_unique UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: expo_push_tickets expo_push_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tickets
    ADD CONSTRAINT expo_push_tickets_pkey PRIMARY KEY (id);


--
-- Name: expo_push_tickets expo_push_tickets_ticket_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tickets
    ADD CONSTRAINT expo_push_tickets_ticket_id_unique UNIQUE (ticket_id);


--
-- Name: featured_institutions featured_institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_institutions
    ADD CONSTRAINT featured_institutions_pkey PRIMARY KEY (id);


--
-- Name: fee_billing_batches fee_billing_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_billing_batches
    ADD CONSTRAINT fee_billing_batches_pkey PRIMARY KEY (id);


--
-- Name: fee_heads fee_heads_institution_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_heads
    ADD CONSTRAINT fee_heads_institution_name_unique UNIQUE (institution_id, name);


--
-- Name: fee_heads fee_heads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_heads
    ADD CONSTRAINT fee_heads_pkey PRIMARY KEY (id);


--
-- Name: fee_invoice_items fee_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoice_items
    ADD CONSTRAINT fee_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: fee_invoices fee_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT fee_invoices_pkey PRIMARY KEY (id);


--
-- Name: fee_payment_submissions fee_payment_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payment_submissions
    ADD CONSTRAINT fee_payment_submissions_pkey PRIMARY KEY (id);


--
-- Name: fee_payments fee_payments_institution_receipt_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_institution_receipt_unique UNIQUE (institution_id, receipt_number);


--
-- Name: fee_payments fee_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_pkey PRIMARY KEY (id);


--
-- Name: fee_voucher_cycles fee_voucher_cycles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_voucher_cycles
    ADD CONSTRAINT fee_voucher_cycles_pkey PRIMARY KEY (id);


--
-- Name: fee_vouchers fee_vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_vouchers
    ADD CONSTRAINT fee_vouchers_pkey PRIMARY KEY (id);


--
-- Name: gateway_payment_attempts gateway_payment_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_payment_attempts
    ADD CONSTRAINT gateway_payment_attempts_pkey PRIMARY KEY (id);


--
-- Name: gateway_payment_attempts gateway_payment_attempts_receipt_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_payment_attempts
    ADD CONSTRAINT gateway_payment_attempts_receipt_number_key UNIQUE (receipt_number);


--
-- Name: grading_scales grading_scales_institution_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_scales
    ADD CONSTRAINT grading_scales_institution_id_unique UNIQUE (institution_id);


--
-- Name: grading_scales grading_scales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_scales
    ADD CONSTRAINT grading_scales_pkey PRIMARY KEY (id);


--
-- Name: students inst_class_roll_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT inst_class_roll_unique UNIQUE (institution_id, class_id, class_roll_number);


--
-- Name: institution_admins institution_admins_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_admins
    ADD CONSTRAINT institution_admins_email_unique UNIQUE (email);


--
-- Name: institution_admins institution_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_admins
    ADD CONSTRAINT institution_admins_pkey PRIMARY KEY (id);


--
-- Name: institution_agreement_acceptances institution_agreement_acceptances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_agreement_acceptances
    ADD CONSTRAINT institution_agreement_acceptances_pkey PRIMARY KEY (institution_id);


--
-- Name: institution_backups institution_backups_period_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups
    ADD CONSTRAINT institution_backups_period_unique UNIQUE (institution_id, backup_type, period_key);


--
-- Name: institution_backups institution_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups
    ADD CONSTRAINT institution_backups_pkey PRIMARY KEY (id);


--
-- Name: institution_custom_roles institution_custom_roles_institution_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_custom_roles
    ADD CONSTRAINT institution_custom_roles_institution_name_unique UNIQUE (institution_id, name);


--
-- Name: institution_custom_roles institution_custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_custom_roles
    ADD CONSTRAINT institution_custom_roles_pkey PRIMARY KEY (id);


--
-- Name: institution_google_drive_backups institution_google_drive_backups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_google_drive_backups
    ADD CONSTRAINT institution_google_drive_backups_pkey PRIMARY KEY (institution_id);


--
-- Name: institution_holidays institution_holiday_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_holidays
    ADD CONSTRAINT institution_holiday_unique UNIQUE (institution_id, date);


--
-- Name: institution_holidays institution_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_holidays
    ADD CONSTRAINT institution_holidays_pkey PRIMARY KEY (id);


--
-- Name: institution_owners institution_owners_institution_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_owners
    ADD CONSTRAINT institution_owners_institution_id_unique UNIQUE (institution_id);


--
-- Name: institution_owners institution_owners_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_owners
    ADD CONSTRAINT institution_owners_pkey PRIMARY KEY (id);


--
-- Name: institution_payment_gateways institution_payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_payment_gateways
    ADD CONSTRAINT institution_payment_gateways_pkey PRIMARY KEY (institution_id);


--
-- Name: institution_public_profiles institution_public_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_public_profiles
    ADD CONSTRAINT institution_public_profiles_pkey PRIMARY KEY (institution_id);


--
-- Name: institution_restore_requests institution_restore_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests
    ADD CONSTRAINT institution_restore_requests_pkey PRIMARY KEY (id);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);


--
-- Name: institutions institutions_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_username_unique UNIQUE (username);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: marks marks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_pkey PRIMARY KEY (id);


--
-- Name: notification_rollout notification_rollout_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_rollout
    ADD CONSTRAINT notification_rollout_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: online_test_questions online_test_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_questions
    ADD CONSTRAINT online_test_questions_pkey PRIMARY KEY (id);


--
-- Name: online_test_submissions online_test_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT online_test_submissions_pkey PRIMARY KEY (id);


--
-- Name: online_tests online_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_tests
    ADD CONSTRAINT online_tests_pkey PRIMARY KEY (id);


--
-- Name: online_tests online_tests_test_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_tests
    ADD CONSTRAINT online_tests_test_id_unique UNIQUE (test_id);


--
-- Name: parent_accounts parent_accounts_id_institution_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_accounts
    ADD CONSTRAINT parent_accounts_id_institution_unique UNIQUE (id, institution_id);


--
-- Name: parent_accounts parent_accounts_institution_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_accounts
    ADD CONSTRAINT parent_accounts_institution_email_unique UNIQUE (institution_id, email);


--
-- Name: parent_accounts parent_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_accounts
    ADD CONSTRAINT parent_accounts_pkey PRIMARY KEY (id);


--
-- Name: parent_students parent_students_institution_student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_institution_student_unique UNIQUE (institution_id, student_id);


--
-- Name: parent_students parent_students_parent_student_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_parent_student_unique UNIQUE (parent_id, student_id);


--
-- Name: parent_students parent_students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_token_hash_unique UNIQUE (token_hash);


--
-- Name: plan_device_sessions plan_device_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_device_sessions
    ADD CONSTRAINT plan_device_sessions_pkey PRIMARY KEY (id);


--
-- Name: plan_device_sessions plan_device_sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_device_sessions
    ADD CONSTRAINT plan_device_sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: platform_pages platform_pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages
    ADD CONSTRAINT platform_pages_pkey PRIMARY KEY (id);


--
-- Name: platform_pages platform_pages_slug_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_pages
    ADD CONSTRAINT platform_pages_slug_unique UNIQUE (slug);


--
-- Name: platform_reviews platform_reviews_institution_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_reviews
    ADD CONSTRAINT platform_reviews_institution_id_unique UNIQUE (institution_id);


--
-- Name: platform_reviews platform_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_reviews
    ADD CONSTRAINT platform_reviews_pkey PRIMARY KEY (id);


--
-- Name: pricing_notice_reads pricing_notice_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_notice_reads
    ADD CONSTRAINT pricing_notice_reads_pkey PRIMARY KEY (user_role, user_id);


--
-- Name: pricing_plan_changes pricing_plan_changes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plan_changes
    ADD CONSTRAINT pricing_plan_changes_pkey PRIMARY KEY (id);


--
-- Name: public_events public_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_events
    ADD CONSTRAINT public_events_pkey PRIMARY KEY (id);


--
-- Name: push_devices push_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_pkey PRIMARY KEY (id);


--
-- Name: push_devices push_devices_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_token_key UNIQUE (token);


--
-- Name: qr_login_challenges qr_login_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_login_challenges
    ADD CONSTRAINT qr_login_challenges_pkey PRIMARY KEY (id);


--
-- Name: qr_login_sessions qr_login_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_login_sessions
    ADD CONSTRAINT qr_login_sessions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_hash_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_hash_unique UNIQUE (token_hash);


--
-- Name: section_groups section_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_groups
    ADD CONSTRAINT section_groups_pkey PRIMARY KEY (id);


--
-- Name: sections sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_pkey PRIMARY KEY (id);


--
-- Name: staff_assignments staff_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_pkey PRIMARY KEY (id);


--
-- Name: staff_attendances staff_attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_attendances
    ADD CONSTRAINT staff_attendances_pkey PRIMARY KEY (id);


--
-- Name: staff_attendances staff_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_attendances
    ADD CONSTRAINT staff_date_unique UNIQUE (staff_id, date);


--
-- Name: staff staff_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_email_unique UNIQUE (email);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: staff_profile_change_requests staff_profile_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests
    ADD CONSTRAINT staff_profile_change_requests_pkey PRIMARY KEY (id);


--
-- Name: staff_teachable_subjects staff_teachable_subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_teachable_subjects
    ADD CONSTRAINT staff_teachable_subjects_pkey PRIMARY KEY (id);


--
-- Name: staff_assignments staff_time_slot_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_time_slot_unique UNIQUE (institution_id, staff_id, day_of_week, start_time);


--
-- Name: student_admission_counters student_admission_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_admission_counters
    ADD CONSTRAINT student_admission_counters_pkey PRIMARY KEY (institution_id, admission_year);


--
-- Name: submissions student_assignment_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT student_assignment_unique UNIQUE (assignment_id, student_id);


--
-- Name: batch_exam_results student_batch_result_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_results
    ADD CONSTRAINT student_batch_result_unique UNIQUE (batch_exam_subject_id, student_id);


--
-- Name: attendances student_date_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT student_date_unique UNIQUE (student_id, date);


--
-- Name: student_fee_adjustments student_fee_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustments
    ADD CONSTRAINT student_fee_adjustments_pkey PRIMARY KEY (id);


--
-- Name: online_test_submissions student_online_test_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT student_online_test_unique UNIQUE (online_test_id, student_id);


--
-- Name: student_profile_change_requests student_profile_change_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests
    ADD CONSTRAINT student_profile_change_requests_pkey PRIMARY KEY (id);


--
-- Name: student_promotions student_promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_pkey PRIMARY KEY (id);


--
-- Name: marks student_test_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT student_test_unique UNIQUE (test_id, student_id);


--
-- Name: students students_id_institution_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_id_institution_unique UNIQUE (id, institution_id);


--
-- Name: students students_login_roll_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_login_roll_number_unique UNIQUE (login_roll_number);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: subjects subjects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_pkey PRIMARY KEY (id);


--
-- Name: submissions submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_pkey PRIMARY KEY (id);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: super_admins super_admins_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_email_unique UNIQUE (email);


--
-- Name: super_admins super_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.super_admins
    ADD CONSTRAINT super_admins_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: tests tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_pkey PRIMARY KEY (id);


--
-- Name: ticket_history ticket_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: announcement_reads user_announcement_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT user_announcement_unique UNIQUE (announcement_id, user_role, user_id);


--
-- Name: academic_sessions_institution_current_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX academic_sessions_institution_current_idx ON public.academic_sessions USING btree (institution_id, is_current);


--
-- Name: admission_applicant_accounts_inst_email_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admission_applicant_accounts_inst_email_uidx ON public.admission_applicant_accounts USING btree (institution_id, lower((guardian_email)::text));


--
-- Name: admission_application_events_app_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_application_events_app_created_idx ON public.admission_application_events USING btree (application_id, created_at);


--
-- Name: admission_applications_applicant_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_applicant_submitted_idx ON public.admission_applications USING btree (applicant_id, submitted_at);


--
-- Name: admission_applications_inst_cycle_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_cycle_submitted_idx ON public.admission_applications USING btree (institution_id, cycle_id, submitted_at DESC);


--
-- Name: admission_applications_inst_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_email_idx ON public.admission_applications USING btree (institution_id, guardian_email);


--
-- Name: admission_applications_inst_email_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_email_search_idx ON public.admission_applications USING btree (institution_id, lower((guardian_email)::text) text_pattern_ops);


--
-- Name: admission_applications_inst_guardian_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_guardian_search_idx ON public.admission_applications USING btree (institution_id, lower((guardian_name)::text) text_pattern_ops);


--
-- Name: admission_applications_inst_number_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_number_search_idx ON public.admission_applications USING btree (institution_id, lower((application_number)::text) text_pattern_ops);


--
-- Name: admission_applications_inst_phone_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_phone_search_idx ON public.admission_applications USING btree (institution_id, lower((guardian_phone)::text) text_pattern_ops);


--
-- Name: admission_applications_inst_status_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_status_submitted_idx ON public.admission_applications USING btree (institution_id, status, submitted_at);


--
-- Name: admission_applications_inst_student_search_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_inst_student_search_idx ON public.admission_applications USING btree (institution_id, lower((student_name)::text) text_pattern_ops);


--
-- Name: admission_applications_intake_applicant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_applications_intake_applicant_idx ON public.admission_applications USING btree (intake_institution_id, applicant_id, submitted_at);


--
-- Name: admission_applications_student_cycle_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admission_applications_student_cycle_uidx ON public.admission_applications USING btree (intake_institution_id, cycle_id, lower((guardian_email)::text), lower((student_name)::text));


--
-- Name: admission_appointments_inst_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_appointments_inst_schedule_idx ON public.admission_appointments USING btree (institution_id, scheduled_at);


--
-- Name: admission_cycle_campuses_inst_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_cycle_campuses_inst_idx ON public.admission_cycle_campuses USING btree (institution_id, cycle_id);


--
-- Name: admission_cycles_archive_list_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_cycles_archive_list_idx ON public.admission_cycles USING btree (institution_id, archived_at DESC, id DESC) WHERE (archived_at IS NOT NULL);


--
-- Name: admission_cycles_institution_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_cycles_institution_status_idx ON public.admission_cycles USING btree (institution_id, status);


--
-- Name: admission_cycles_one_open_per_institution_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admission_cycles_one_open_per_institution_uidx ON public.admission_cycles USING btree (institution_id) WHERE (status = 'OPEN'::public.admission_cycle_status);


--
-- Name: admission_document_requests_app_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_document_requests_app_status_idx ON public.admission_document_requests USING btree (application_id, status);


--
-- Name: admission_fee_payments_inst_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_fee_payments_inst_status_idx ON public.admission_fee_payments USING btree (institution_id, status);


--
-- Name: admission_fee_proofs_application_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_fee_proofs_application_idx ON public.admission_fee_proofs USING btree (institution_id, application_id, submitted_at);


--
-- Name: admission_manual_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX admission_manual_reference_unique ON public.admission_fee_proofs USING btree (institution_id, ((payment_account ->> 'id'::text)), lower(btrim((transaction_id)::text))) WHERE ((payment_account IS NOT NULL) AND ((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'VERIFIED'::character varying])::text[])));


--
-- Name: admission_offerings_institution_cycle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX admission_offerings_institution_cycle_idx ON public.admission_offerings USING btree (institution_id, cycle_id);


--
-- Name: announcement_reads_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcement_reads_user_idx ON public.announcement_reads USING btree (user_role, user_id, announcement_id);


--
-- Name: announcements_automation_key_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX announcements_automation_key_unique ON public.announcements USING btree (automation_key);


--
-- Name: announcements_institution_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX announcements_institution_created_idx ON public.announcements USING btree (institution_id, created_at);


--
-- Name: assignments_due_reminder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_due_reminder_idx ON public.assignments USING btree (due_at, id);


--
-- Name: assignments_institution_class_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_institution_class_due_idx ON public.assignments USING btree (institution_id, class_id, due_at);


--
-- Name: assignments_institution_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_institution_section_idx ON public.assignments USING btree (institution_id, section_id);


--
-- Name: assignments_institution_staff_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX assignments_institution_staff_created_idx ON public.assignments USING btree (institution_id, staff_id, created_at);


--
-- Name: attendance_delegations_staff_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendance_delegations_staff_date_idx ON public.attendance_delegations USING btree (institution_id, staff_id, date);


--
-- Name: attendances_institution_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_institution_date_idx ON public.attendances USING btree (institution_id, date);


--
-- Name: attendances_institution_section_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX attendances_institution_section_date_idx ON public.attendances USING btree (institution_id, section_id, date);


--
-- Name: audit_logs_timestamp_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_timestamp_idx ON public.audit_logs USING btree ("timestamp");


--
-- Name: batch_exam_results_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batch_exam_results_student_id_idx ON public.batch_exam_results USING btree (student_id);


--
-- Name: batch_exam_subjects_batch_exam_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batch_exam_subjects_batch_exam_id_idx ON public.batch_exam_subjects USING btree (batch_exam_id);


--
-- Name: batch_exam_subjects_staff_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batch_exam_subjects_staff_id_idx ON public.batch_exam_subjects USING btree (staff_id);


--
-- Name: batch_exams_institution_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX batch_exams_institution_class_idx ON public.batch_exams USING btree (institution_id, class_id);


--
-- Name: campuses_id_inst_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX campuses_id_inst_unique ON public.campuses USING btree (id, institution_id);


--
-- Name: campuses_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX campuses_institution_id_idx ON public.campuses USING btree (institution_id);


--
-- Name: central_backup_jobs_one_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX central_backup_jobs_one_active_idx ON public.central_backup_jobs USING btree (kind) WHERE (status = ANY (ARRAY['PENDING'::text, 'RUNNING'::text]));


--
-- Name: central_database_backups_run_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX central_database_backups_run_id_idx ON public.central_database_backups USING btree (run_id);


--
-- Name: central_database_backups_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX central_database_backups_status_created_idx ON public.central_database_backups USING btree (status, created_at);


--
-- Name: central_database_backups_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX central_database_backups_status_idx ON public.central_database_backups USING btree (status);


--
-- Name: class_fee_items_institution_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX class_fee_items_institution_class_idx ON public.class_fee_items USING btree (institution_id, class_id);


--
-- Name: classes_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX classes_institution_id_idx ON public.classes USING btree (institution_id);


--
-- Name: course_lecture_progress_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_lecture_progress_student_idx ON public.course_lecture_progress USING btree (student_id);


--
-- Name: courses_institution_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX courses_institution_staff_idx ON public.courses USING btree (institution_id, staff_id);


--
-- Name: dealt_plan_codes_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dealt_plan_codes_expiry_idx ON public.dealt_plan_codes USING btree (expires_at) WHERE (used_at IS NULL);


--
-- Name: dealt_plan_codes_plan_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX dealt_plan_codes_plan_idx ON public.dealt_plan_codes USING btree (plan_id);


--
-- Name: device_sessions_identity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_sessions_identity_idx ON public.plan_device_sessions USING btree (user_role, user_id);


--
-- Name: diaries_class_subject_date_not_null_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX diaries_class_subject_date_not_null_uidx ON public.diaries USING btree (class_id, subject_id, date) WHERE (subject_id IS NOT NULL);


--
-- Name: diaries_institution_class_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diaries_institution_class_date_idx ON public.diaries USING btree (institution_id, class_id, date);


--
-- Name: email_outbox_institution_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_institution_created_idx ON public.email_outbox USING btree (institution_id, created_at);


--
-- Name: email_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_pending_idx ON public.email_outbox USING btree (status, next_attempt_at, id);


--
-- Name: employees_lower_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX employees_lower_email_idx ON public.employees USING btree (lower((email)::text));


--
-- Name: expo_push_tickets_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX expo_push_tickets_status_created_at_idx ON public.expo_push_tickets USING btree (status, created_at);


--
-- Name: fee_heads_institution_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_heads_institution_active_idx ON public.fee_heads USING btree (institution_id, is_active);


--
-- Name: fee_invoice_items_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoice_items_invoice_idx ON public.fee_invoice_items USING btree (invoice_id);


--
-- Name: fee_invoices_inst_month_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_inst_month_created_idx ON public.fee_invoices USING btree (institution_id, billing_month, created_at DESC, id DESC);


--
-- Name: fee_invoices_inst_month_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_inst_month_status_created_idx ON public.fee_invoices USING btree (institution_id, billing_month, status, created_at DESC, id DESC);


--
-- Name: fee_invoices_institution_month_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_institution_month_status_idx ON public.fee_invoices USING btree (institution_id, billing_month, status);


--
-- Name: fee_invoices_institution_student_billing_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_invoices_institution_student_billing_unique ON public.fee_invoices USING btree (institution_id, student_id, billing_month, billing_key);


--
-- Name: fee_invoices_issued_class_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_issued_class_idx ON public.fee_invoices USING btree (institution_id, class_id_at_issue, billing_month, status, created_at DESC, id DESC);


--
-- Name: fee_invoices_reminder_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_reminder_idx ON public.fee_invoices USING btree (due_date, id) WHERE ((status)::text = ANY ((ARRAY['DUE'::character varying, 'PARTIAL'::character varying])::text[]));


--
-- Name: fee_invoices_student_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_invoices_student_created_idx ON public.fee_invoices USING btree (student_id, created_at);


--
-- Name: fee_payment_submissions_inst_status_submitted_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_payment_submissions_inst_status_submitted_idx ON public.fee_payment_submissions USING btree (institution_id, status, submitted_at);


--
-- Name: fee_payment_submissions_invoice_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_payment_submissions_invoice_status_idx ON public.fee_payment_submissions USING btree (invoice_id, status);


--
-- Name: fee_payment_submissions_one_pending_invoice_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_payment_submissions_one_pending_invoice_uidx ON public.fee_payment_submissions USING btree (invoice_id) WHERE ((status)::text = 'SUBMITTED'::text);


--
-- Name: fee_payments_institution_received_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_payments_institution_received_idx ON public.fee_payments USING btree (institution_id, received_at);


--
-- Name: fee_payments_invoice_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_payments_invoice_created_idx ON public.fee_payments USING btree (invoice_id, created_at);


--
-- Name: fee_voucher_cycles_institution_month_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_voucher_cycles_institution_month_status_idx ON public.fee_voucher_cycles USING btree (institution_id, billing_month, status);


--
-- Name: fee_voucher_cycles_institution_student_month_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_voucher_cycles_institution_student_month_unique ON public.fee_voucher_cycles USING btree (institution_id, student_id, billing_month);


--
-- Name: fee_voucher_cycles_voucher_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_voucher_cycles_voucher_unique ON public.fee_voucher_cycles USING btree (voucher_id);


--
-- Name: fee_vouchers_institution_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_vouchers_institution_created_idx ON public.fee_vouchers USING btree (institution_id, created_at);


--
-- Name: fee_vouchers_institution_student_month_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fee_vouchers_institution_student_month_unique ON public.fee_vouchers USING btree (institution_id, student_id, billing_month);


--
-- Name: fee_vouchers_student_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX fee_vouchers_student_created_idx ON public.fee_vouchers USING btree (student_id, created_at);


--
-- Name: gateway_attempts_application_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gateway_attempts_application_idx ON public.gateway_payment_attempts USING btree (institution_id, application_id, created_at);


--
-- Name: gateway_attempts_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gateway_attempts_invoice_idx ON public.gateway_payment_attempts USING btree (institution_id, invoice_id, created_at);


--
-- Name: gateway_attempts_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gateway_attempts_status_idx ON public.gateway_payment_attempts USING btree (institution_id, status, created_at);


--
-- Name: gateway_attempts_verified_reference_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX gateway_attempts_verified_reference_uidx ON public.gateway_payment_attempts USING btree (gateway, environment, merchant_id, provider_reference) WHERE (((environment)::text = 'production'::text) AND ((status)::text = ANY ((ARRAY['PAID'::character varying, 'REVIEW'::character varying])::text[])) AND (provider_reference IS NOT NULL));


--
-- Name: institution_backups_institution_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institution_backups_institution_created_idx ON public.institution_backups USING btree (institution_id, created_at DESC);


--
-- Name: institution_backups_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institution_backups_pending_idx ON public.institution_backups USING btree (created_at, id) WHERE ((status)::text = 'PENDING'::text);


--
-- Name: institution_google_drive_backups_file_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institution_google_drive_backups_file_idx ON public.institution_google_drive_backups USING btree (backup_file_id);


--
-- Name: institution_restore_one_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX institution_restore_one_active_idx ON public.institution_restore_requests USING btree (institution_id) WHERE ((status)::text <> ALL ((ARRAY['COMPLETED'::character varying, 'FAILED'::character varying, 'REJECTED'::character varying])::text[]));


--
-- Name: institution_restore_requests_tenant_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institution_restore_requests_tenant_idx ON public.institution_restore_requests USING btree (institution_id, created_at DESC);


--
-- Name: institutions_lower_contact_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institutions_lower_contact_email_idx ON public.institutions USING btree (lower((contact_email)::text));


--
-- Name: institutions_parent_institution_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institutions_parent_institution_idx ON public.institutions USING btree (parent_institution_id);


--
-- Name: institutions_public_slug_lower_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX institutions_public_slug_lower_unique ON public.institutions USING btree (lower((public_slug)::text)) WHERE (public_slug IS NOT NULL);


--
-- Name: institutions_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX institutions_status_created_idx ON public.institutions USING btree (status, created_at);


--
-- Name: leave_requests_inst_role_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_requests_inst_role_status_idx ON public.leave_requests USING btree (institution_id, user_role, status, created_at);


--
-- Name: leave_requests_inst_role_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leave_requests_inst_role_user_idx ON public.leave_requests USING btree (institution_id, user_role, user_id);


--
-- Name: marks_institution_student_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_institution_student_created_idx ON public.marks USING btree (institution_id, student_id, created_at);


--
-- Name: marks_institution_test_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX marks_institution_test_id_idx ON public.marks USING btree (institution_id, test_id);


--
-- Name: notifications_event_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_event_unique ON public.notifications USING btree (institution_id, user_role, user_id, event_key);


--
-- Name: notifications_institution_user_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_institution_user_created_idx ON public.notifications USING btree (institution_id, user_role, user_id, created_at);


--
-- Name: notifications_institution_user_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_institution_user_unread_idx ON public.notifications USING btree (institution_id, user_role, user_id, is_read, created_at);


--
-- Name: online_test_questions_online_test_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX online_test_questions_online_test_id_idx ON public.online_test_questions USING btree (online_test_id);


--
-- Name: online_test_submissions_institution_status_heartbeat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX online_test_submissions_institution_status_heartbeat_idx ON public.online_test_submissions USING btree (institution_id, status, last_heartbeat_at);


--
-- Name: online_test_submissions_institution_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX online_test_submissions_institution_student_idx ON public.online_test_submissions USING btree (institution_id, student_id);


--
-- Name: parent_accounts_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parent_accounts_institution_id_idx ON public.parent_accounts USING btree (institution_id);


--
-- Name: parent_students_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parent_students_parent_id_idx ON public.parent_students USING btree (parent_id);


--
-- Name: parent_students_student_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX parent_students_student_id_idx ON public.parent_students USING btree (student_id);


--
-- Name: plan_device_sessions_usage_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX plan_device_sessions_usage_idx ON public.plan_device_sessions USING btree (institution_id, expires_at) WHERE (revoked_at IS NULL);


--
-- Name: public_events_institution_slug_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX public_events_institution_slug_uidx ON public.public_events USING btree (institution_id, slug);


--
-- Name: public_events_public_lookup_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_events_public_lookup_idx ON public.public_events USING btree (institution_id, status, published_at, expires_at);


--
-- Name: push_devices_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_owner_idx ON public.push_devices USING btree (institution_id, user_role, user_id);


--
-- Name: push_devices_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_devices_session_idx ON public.push_devices USING btree (session_token_hash);


--
-- Name: qr_login_challenges_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_login_challenges_expiry_idx ON public.qr_login_challenges USING btree (expires_at);


--
-- Name: qr_login_challenges_source_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_login_challenges_source_idx ON public.qr_login_challenges USING btree (source_refresh_token_id);


--
-- Name: qr_login_sessions_owner_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX qr_login_sessions_owner_idx ON public.qr_login_sessions USING btree (user_role, user_id, institution_id, created_at);


--
-- Name: refresh_tokens_active_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_active_user_idx ON public.refresh_tokens USING btree (user_role, user_id) WHERE (revoked_at IS NULL);


--
-- Name: refresh_tokens_qr_session_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_qr_session_idx ON public.refresh_tokens USING btree (qr_session_id);


--
-- Name: refresh_tokens_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_user_idx ON public.refresh_tokens USING btree (user_role, user_id);


--
-- Name: section_groups_institution_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX section_groups_institution_section_idx ON public.section_groups USING btree (institution_id, section_id);


--
-- Name: section_time_slot_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX section_time_slot_unique ON public.staff_assignments USING btree (institution_id, section_id, COALESCE(group_id, 0), day_of_week, start_time);


--
-- Name: sections_institution_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sections_institution_class_id_idx ON public.sections USING btree (institution_id, class_id);


--
-- Name: sections_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sections_institution_id_idx ON public.sections USING btree (institution_id);


--
-- Name: staff_assignments_institution_section_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_assignments_institution_section_day_idx ON public.staff_assignments USING btree (institution_id, section_id, day_of_week);


--
-- Name: staff_assignments_institution_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_assignments_institution_section_idx ON public.staff_assignments USING btree (institution_id, section_id);


--
-- Name: staff_assignments_institution_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_assignments_institution_staff_idx ON public.staff_assignments USING btree (institution_id, staff_id);


--
-- Name: staff_attendances_inst_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_attendances_inst_date_idx ON public.staff_attendances USING btree (institution_id, date);


--
-- Name: staff_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_institution_id_idx ON public.staff USING btree (institution_id);


--
-- Name: staff_lower_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_lower_email_idx ON public.staff USING btree (lower((email)::text));


--
-- Name: staff_profile_requests_inst_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_profile_requests_inst_status_idx ON public.staff_profile_change_requests USING btree (institution_id, status);


--
-- Name: staff_profile_requests_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_profile_requests_staff_idx ON public.staff_profile_change_requests USING btree (staff_id);


--
-- Name: staff_teachable_subjects_inst_staff_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_teachable_subjects_inst_staff_idx ON public.staff_teachable_subjects USING btree (institution_id, staff_id);


--
-- Name: student_fee_adjustments_institution_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_fee_adjustments_institution_student_idx ON public.student_fee_adjustments USING btree (institution_id, student_id, is_active);


--
-- Name: student_manual_reference_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX student_manual_reference_unique ON public.fee_payment_submissions USING btree (institution_id, ((payment_account ->> 'id'::text)), lower(btrim((transaction_id)::text))) WHERE ((payment_account IS NOT NULL) AND ((status)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'VERIFIED'::character varying])::text[])));


--
-- Name: student_profile_requests_inst_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_profile_requests_inst_status_idx ON public.student_profile_change_requests USING btree (institution_id, status);


--
-- Name: student_profile_requests_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_profile_requests_student_idx ON public.student_profile_change_requests USING btree (student_id);


--
-- Name: student_promotions_institution_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX student_promotions_institution_student_idx ON public.student_promotions USING btree (institution_id, student_id);


--
-- Name: students_class_roll_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_class_roll_trgm_idx ON public.students USING gin (lower((class_roll_number)::text) public.gin_trgm_ops) WHERE ((deleted_at IS NULL) AND (class_roll_number IS NOT NULL));


--
-- Name: students_institution_guardian_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_institution_guardian_email_idx ON public.students USING btree (institution_id, guardian_email);


--
-- Name: students_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_institution_id_idx ON public.students USING btree (institution_id);


--
-- Name: students_institution_section_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_institution_section_id_idx ON public.students USING btree (institution_id, section_id);


--
-- Name: students_institution_year_admission_sequence_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX students_institution_year_admission_sequence_unique ON public.students USING btree (institution_id, year_of_joining, admission_sequence);


--
-- Name: students_login_roll_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_login_roll_trgm_idx ON public.students USING gin (lower((login_roll_number)::text) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: students_lower_login_roll_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_lower_login_roll_idx ON public.students USING btree (lower((login_roll_number)::text));


--
-- Name: students_lower_login_roll_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_lower_login_roll_number_idx ON public.students USING btree (lower((login_roll_number)::text));


--
-- Name: students_name_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX students_name_trgm_idx ON public.students USING gin (lower((name)::text) public.gin_trgm_ops) WHERE (deleted_at IS NULL);


--
-- Name: subjects_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX subjects_institution_id_idx ON public.subjects USING btree (institution_id);


--
-- Name: submissions_assignment_student_inst_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submissions_assignment_student_inst_idx ON public.submissions USING btree (assignment_id, student_id, institution_id);


--
-- Name: submissions_institution_student_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX submissions_institution_student_idx ON public.submissions USING btree (institution_id, student_id);


--
-- Name: subscription_plans_public_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX subscription_plans_public_name_unique ON public.subscription_plans USING btree (lower((name)::text)) WHERE (((kind)::text = 'PUBLIC'::text) AND (archived_at IS NULL));


--
-- Name: super_admins_lower_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX super_admins_lower_email_idx ON public.super_admins USING btree (lower((email)::text));


--
-- Name: tests_institution_class_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_class_id_idx ON public.tests USING btree (institution_id, class_id);


--
-- Name: tests_institution_class_role_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_class_role_idx ON public.tests USING btree (institution_id, class_id, created_by_role);


--
-- Name: tests_institution_class_subject_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_class_subject_date_idx ON public.tests USING btree (institution_id, class_id, subject_id, date);


--
-- Name: tests_institution_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_date_idx ON public.tests USING btree (institution_id, date);


--
-- Name: tests_institution_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_id_idx ON public.tests USING btree (institution_id);


--
-- Name: tests_institution_section_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tests_institution_section_id_idx ON public.tests USING btree (institution_id, section_id);


--
-- Name: ticket_history_ticket_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ticket_history_ticket_id_idx ON public.ticket_history USING btree (ticket_id);


--
-- Name: tickets_forwarded_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_forwarded_created_idx ON public.tickets USING btree (is_forwarded, created_at);


--
-- Name: tickets_institution_status_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tickets_institution_status_created_idx ON public.tickets USING btree (institution_id, status, created_at);


--
-- Name: admission_applications admission_campus_intake_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admission_campus_intake_guard BEFORE INSERT OR UPDATE OF institution_id, intake_institution_id, campus_id ON public.admission_applications FOR EACH ROW EXECUTE FUNCTION public.validate_admission_campus_intake();


--
-- Name: admission_cycle_campuses admission_cycle_campus_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER admission_cycle_campus_guard BEFORE INSERT OR UPDATE ON public.admission_cycle_campuses FOR EACH ROW EXECUTE FUNCTION public.validate_admission_cycle_campus();


--
-- Name: gateway_payment_attempts gateway_payment_attempt_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER gateway_payment_attempt_guard BEFORE INSERT OR UPDATE ON public.gateway_payment_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_gateway_payment_attempt();


--
-- Name: admission_cycles protect_admission_cycle_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_admission_cycle_history BEFORE DELETE ON public.admission_cycles FOR EACH ROW EXECUTE FUNCTION public.protect_admission_cycle_history();


--
-- Name: admission_offerings protect_admission_offering_history; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_admission_offering_history BEFORE DELETE ON public.admission_offerings FOR EACH ROW EXECUTE FUNCTION public.protect_admission_offering_history();


--
-- Name: admission_application_events protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_application_events FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_applications protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_applications FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_appointments protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_appointments FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_document_requests protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_document_requests FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_enrollments protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_enrollments FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_fee_payments protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_fee_payments FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: admission_fee_proofs protect_archived_admission_records; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_archived_admission_records BEFORE INSERT OR DELETE OR UPDATE ON public.admission_fee_proofs FOR EACH ROW EXECUTE FUNCTION public.protect_archived_admission_records();


--
-- Name: academic_sessions academic_sessions_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.academic_sessions
    ADD CONSTRAINT academic_sessions_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_applicant_accounts admission_applicant_accounts_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applicant_accounts
    ADD CONSTRAINT admission_applicant_accounts_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_application_events admission_application_events_application_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_application_events
    ADD CONSTRAINT admission_application_events_application_tenant_fk FOREIGN KEY (application_id, institution_id) REFERENCES public.admission_applications(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_application_events admission_application_events_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_application_events
    ADD CONSTRAINT admission_application_events_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_applications admission_applications_applicant_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_applicant_tenant_fk FOREIGN KEY (applicant_id, intake_institution_id) REFERENCES public.admission_applicant_accounts(id, institution_id) ON DELETE RESTRICT;


--
-- Name: admission_applications admission_applications_campus_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_campus_tenant_fk FOREIGN KEY (campus_id, institution_id) REFERENCES public.campuses(id, institution_id) ON DELETE RESTRICT;


--
-- Name: admission_applications admission_applications_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_applications admission_applications_intake_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_intake_fk FOREIGN KEY (intake_institution_id) REFERENCES public.institutions(id) ON DELETE RESTRICT;


--
-- Name: admission_applications admission_applications_offering_tenant_cycle_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_applications
    ADD CONSTRAINT admission_applications_offering_tenant_cycle_fk FOREIGN KEY (offering_id, intake_institution_id, cycle_id) REFERENCES public.admission_offerings(id, institution_id, cycle_id) ON DELETE RESTRICT;


--
-- Name: admission_appointments admission_appointments_application_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_appointments
    ADD CONSTRAINT admission_appointments_application_tenant_fk FOREIGN KEY (application_id, institution_id) REFERENCES public.admission_applications(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_appointments admission_appointments_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_appointments
    ADD CONSTRAINT admission_appointments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_cycle_campuses admission_cycle_campuses_campus_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycle_campuses
    ADD CONSTRAINT admission_cycle_campuses_campus_tenant_fk FOREIGN KEY (campus_id, institution_id) REFERENCES public.campuses(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_cycle_campuses admission_cycle_campuses_cycle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycle_campuses
    ADD CONSTRAINT admission_cycle_campuses_cycle_id_fkey FOREIGN KEY (cycle_id) REFERENCES public.admission_cycles(id) ON DELETE CASCADE;


--
-- Name: admission_cycle_campuses admission_cycle_campuses_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycle_campuses
    ADD CONSTRAINT admission_cycle_campuses_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_cycles admission_cycles_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_cycles
    ADD CONSTRAINT admission_cycles_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_document_requests admission_document_requests_application_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_document_requests
    ADD CONSTRAINT admission_document_requests_application_tenant_fk FOREIGN KEY (application_id, institution_id) REFERENCES public.admission_applications(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_document_requests admission_document_requests_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_document_requests
    ADD CONSTRAINT admission_document_requests_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_enrollments admission_enrollments_application_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_application_tenant_fk FOREIGN KEY (application_id, institution_id) REFERENCES public.admission_applications(id, institution_id) ON DELETE RESTRICT;


--
-- Name: admission_enrollments admission_enrollments_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_enrollments admission_enrollments_student_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_enrollments
    ADD CONSTRAINT admission_enrollments_student_tenant_fk FOREIGN KEY (student_id, institution_id) REFERENCES public.students(id, institution_id) ON DELETE RESTRICT;


--
-- Name: admission_fee_payments admission_fee_payments_application_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_payments
    ADD CONSTRAINT admission_fee_payments_application_tenant_fk FOREIGN KEY (application_id, institution_id) REFERENCES public.admission_applications(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_fee_payments admission_fee_payments_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_payments
    ADD CONSTRAINT admission_fee_payments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_fee_proofs admission_fee_proofs_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_proofs
    ADD CONSTRAINT admission_fee_proofs_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.admission_applications(id) ON DELETE CASCADE;


--
-- Name: admission_fee_proofs admission_fee_proofs_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_proofs
    ADD CONSTRAINT admission_fee_proofs_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: admission_fee_proofs admission_fee_proofs_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_fee_proofs
    ADD CONSTRAINT admission_fee_proofs_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.admission_fee_payments(id) ON DELETE CASCADE;


--
-- Name: admission_offerings admission_offerings_cycle_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings
    ADD CONSTRAINT admission_offerings_cycle_tenant_fk FOREIGN KEY (cycle_id, institution_id) REFERENCES public.admission_cycles(id, institution_id) ON DELETE CASCADE;


--
-- Name: admission_offerings admission_offerings_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admission_offerings
    ADD CONSTRAINT admission_offerings_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: announcement_reads announcement_reads_announcement_id_announcements_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcement_reads
    ADD CONSTRAINT announcement_reads_announcement_id_announcements_id_fk FOREIGN KEY (announcement_id) REFERENCES public.announcements(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_target_campus_id_campuses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_target_campus_id_campuses_id_fk FOREIGN KEY (target_campus_id) REFERENCES public.campuses(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_target_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_target_class_id_classes_id_fk FOREIGN KEY (target_class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: announcements announcements_target_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_target_section_id_sections_id_fk FOREIGN KEY (target_section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: assignments assignments_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assignments
    ADD CONSTRAINT assignments_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;


--
-- Name: attendance_delegations attendance_delegations_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations
    ADD CONSTRAINT attendance_delegations_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: attendance_delegations attendance_delegations_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations
    ADD CONSTRAINT attendance_delegations_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: attendance_delegations attendance_delegations_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_delegations
    ADD CONSTRAINT attendance_delegations_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: attendances attendances_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: batch_exam_results batch_exam_results_batch_exam_subject_id_batch_exam_subjects_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_results
    ADD CONSTRAINT batch_exam_results_batch_exam_subject_id_batch_exam_subjects_id FOREIGN KEY (batch_exam_subject_id) REFERENCES public.batch_exam_subjects(id) ON DELETE CASCADE;


--
-- Name: batch_exam_results batch_exam_results_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_results
    ADD CONSTRAINT batch_exam_results_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: batch_exam_subjects batch_exam_subjects_batch_exam_id_batch_exams_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_subjects
    ADD CONSTRAINT batch_exam_subjects_batch_exam_id_batch_exams_id_fk FOREIGN KEY (batch_exam_id) REFERENCES public.batch_exams(id) ON DELETE CASCADE;


--
-- Name: batch_exam_subjects batch_exam_subjects_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_subjects
    ADD CONSTRAINT batch_exam_subjects_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: batch_exam_subjects batch_exam_subjects_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exam_subjects
    ADD CONSTRAINT batch_exam_subjects_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: batch_exams batch_exams_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exams
    ADD CONSTRAINT batch_exams_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: batch_exams batch_exams_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exams
    ADD CONSTRAINT batch_exams_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: batch_exams batch_exams_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_exams
    ADD CONSTRAINT batch_exams_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: campuses campuses_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campuses
    ADD CONSTRAINT campuses_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: central_backup_jobs central_backup_jobs_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_backup_jobs
    ADD CONSTRAINT central_backup_jobs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;


--
-- Name: central_backup_settings central_backup_settings_updated_by_employee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_backup_settings
    ADD CONSTRAINT central_backup_settings_updated_by_employee_fkey FOREIGN KEY (updated_by_employee) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: central_backup_settings central_backup_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.central_backup_settings
    ADD CONSTRAINT central_backup_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;


--
-- Name: class_fee_items class_fee_items_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items
    ADD CONSTRAINT class_fee_items_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: class_fee_items class_fee_items_fee_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items
    ADD CONSTRAINT class_fee_items_fee_head_id_fkey FOREIGN KEY (fee_head_id) REFERENCES public.fee_heads(id) ON DELETE CASCADE;


--
-- Name: class_fee_items class_fee_items_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_fee_items
    ADD CONSTRAINT class_fee_items_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: classes classes_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: course_classes course_classes_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_classes
    ADD CONSTRAINT course_classes_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: course_classes course_classes_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_classes
    ADD CONSTRAINT course_classes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_lecture_progress course_lecture_progress_lecture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lecture_progress
    ADD CONSTRAINT course_lecture_progress_lecture_id_fkey FOREIGN KEY (lecture_id) REFERENCES public.course_lectures(id) ON DELETE CASCADE;


--
-- Name: course_lecture_progress course_lecture_progress_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lecture_progress
    ADD CONSTRAINT course_lecture_progress_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: course_lectures course_lectures_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_lectures
    ADD CONSTRAINT course_lectures_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: courses courses_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: courses courses_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: courses courses_subject_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;


--
-- Name: dealt_plan_codes dealt_plan_codes_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dealt_plan_codes
    ADD CONSTRAINT dealt_plan_codes_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.subscription_plans(id);


--
-- Name: diaries diaries_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries
    ADD CONSTRAINT diaries_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: diaries diaries_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries
    ADD CONSTRAINT diaries_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: diaries diaries_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries
    ADD CONSTRAINT diaries_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: diaries diaries_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diaries
    ADD CONSTRAINT diaries_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: email_outbox email_outbox_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;


--
-- Name: expo_push_tickets expo_push_tickets_notification_id_notifications_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expo_push_tickets
    ADD CONSTRAINT expo_push_tickets_notification_id_notifications_id_fk FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE SET NULL;


--
-- Name: fee_billing_batches fee_billing_batches_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_billing_batches
    ADD CONSTRAINT fee_billing_batches_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id);


--
-- Name: fee_heads fee_heads_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_heads
    ADD CONSTRAINT fee_heads_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_invoice_items fee_invoice_items_fee_head_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoice_items
    ADD CONSTRAINT fee_invoice_items_fee_head_id_fkey FOREIGN KEY (fee_head_id) REFERENCES public.fee_heads(id) ON DELETE SET NULL;


--
-- Name: fee_invoice_items fee_invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoice_items
    ADD CONSTRAINT fee_invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.fee_invoices(id) ON DELETE CASCADE;


--
-- Name: fee_invoices fee_invoices_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT fee_invoices_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_invoices fee_invoices_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_invoices
    ADD CONSTRAINT fee_invoices_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: fee_payment_submissions fee_payment_submissions_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payment_submissions
    ADD CONSTRAINT fee_payment_submissions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_payment_submissions fee_payment_submissions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payment_submissions
    ADD CONSTRAINT fee_payment_submissions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.fee_invoices(id) ON DELETE CASCADE;


--
-- Name: fee_payment_submissions fee_payment_submissions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payment_submissions
    ADD CONSTRAINT fee_payment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: fee_payments fee_payments_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_payments fee_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.fee_invoices(id) ON DELETE CASCADE;


--
-- Name: fee_payments fee_payments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_payments
    ADD CONSTRAINT fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: fee_voucher_cycles fee_voucher_cycles_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_voucher_cycles
    ADD CONSTRAINT fee_voucher_cycles_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_voucher_cycles fee_voucher_cycles_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_voucher_cycles
    ADD CONSTRAINT fee_voucher_cycles_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: fee_voucher_cycles fee_voucher_cycles_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_voucher_cycles
    ADD CONSTRAINT fee_voucher_cycles_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.fee_vouchers(id) ON DELETE SET NULL;


--
-- Name: fee_vouchers fee_vouchers_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_vouchers
    ADD CONSTRAINT fee_vouchers_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: fee_vouchers fee_vouchers_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fee_vouchers
    ADD CONSTRAINT fee_vouchers_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: gateway_payment_attempts gateway_payment_attempts_application_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_payment_attempts
    ADD CONSTRAINT gateway_payment_attempts_application_id_fkey FOREIGN KEY (application_id) REFERENCES public.admission_applications(id) ON DELETE RESTRICT;


--
-- Name: gateway_payment_attempts gateway_payment_attempts_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_payment_attempts
    ADD CONSTRAINT gateway_payment_attempts_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE RESTRICT;


--
-- Name: gateway_payment_attempts gateway_payment_attempts_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gateway_payment_attempts
    ADD CONSTRAINT gateway_payment_attempts_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.fee_invoices(id) ON DELETE RESTRICT;


--
-- Name: grading_scales grading_scales_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grading_scales
    ADD CONSTRAINT grading_scales_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_admins institution_admins_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_admins
    ADD CONSTRAINT institution_admins_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_agreement_acceptances institution_agreement_acceptances_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_agreement_acceptances
    ADD CONSTRAINT institution_agreement_acceptances_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_backups institution_backups_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups
    ADD CONSTRAINT institution_backups_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_backups institution_backups_requested_by_employee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups
    ADD CONSTRAINT institution_backups_requested_by_employee_fkey FOREIGN KEY (requested_by_employee) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: institution_backups institution_backups_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_backups
    ADD CONSTRAINT institution_backups_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;


--
-- Name: institution_custom_roles institution_custom_roles_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_custom_roles
    ADD CONSTRAINT institution_custom_roles_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_google_drive_backups institution_google_drive_backups_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_google_drive_backups
    ADD CONSTRAINT institution_google_drive_backups_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_holidays institution_holidays_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_holidays
    ADD CONSTRAINT institution_holidays_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_owners institution_owners_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_owners
    ADD CONSTRAINT institution_owners_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_payment_gateways institution_payment_gateways_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_payment_gateways
    ADD CONSTRAINT institution_payment_gateways_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_public_profiles institution_public_profiles_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_public_profiles
    ADD CONSTRAINT institution_public_profiles_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_restore_requests institution_restore_requests_execution_requested_by_employ_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests
    ADD CONSTRAINT institution_restore_requests_execution_requested_by_employ_fkey FOREIGN KEY (execution_requested_by_employee) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: institution_restore_requests institution_restore_requests_execution_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests
    ADD CONSTRAINT institution_restore_requests_execution_requested_by_fkey FOREIGN KEY (execution_requested_by) REFERENCES public.super_admins(id) ON DELETE SET NULL;


--
-- Name: institution_restore_requests institution_restore_requests_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests
    ADD CONSTRAINT institution_restore_requests_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: institution_restore_requests institution_restore_requests_source_restore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institution_restore_requests
    ADD CONSTRAINT institution_restore_requests_source_restore_id_fkey FOREIGN KEY (source_restore_id) REFERENCES public.institution_restore_requests(id) ON DELETE SET NULL;


--
-- Name: institutions institutions_parent_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_parent_institution_id_fkey FOREIGN KEY (parent_institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: leave_requests leave_requests_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: marks marks_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: marks marks_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: marks marks_test_id_tests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.marks
    ADD CONSTRAINT marks_test_id_tests_id_fk FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: online_test_questions online_test_questions_online_test_id_online_tests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_questions
    ADD CONSTRAINT online_test_questions_online_test_id_online_tests_id_fk FOREIGN KEY (online_test_id) REFERENCES public.online_tests(id) ON DELETE CASCADE;


--
-- Name: online_test_submissions online_test_submissions_graded_by_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT online_test_submissions_graded_by_staff_id_fk FOREIGN KEY (graded_by) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: online_test_submissions online_test_submissions_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT online_test_submissions_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: online_test_submissions online_test_submissions_online_test_id_online_tests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT online_test_submissions_online_test_id_online_tests_id_fk FOREIGN KEY (online_test_id) REFERENCES public.online_tests(id) ON DELETE CASCADE;


--
-- Name: online_test_submissions online_test_submissions_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_test_submissions
    ADD CONSTRAINT online_test_submissions_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: online_tests online_tests_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_tests
    ADD CONSTRAINT online_tests_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: online_tests online_tests_test_id_tests_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_tests
    ADD CONSTRAINT online_tests_test_id_tests_id_fk FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE CASCADE;


--
-- Name: parent_accounts parent_accounts_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_accounts
    ADD CONSTRAINT parent_accounts_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: parent_students parent_students_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: parent_students parent_students_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.parent_accounts(id) ON DELETE CASCADE;


--
-- Name: parent_students parent_students_parent_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_parent_tenant_fk FOREIGN KEY (parent_id, institution_id) REFERENCES public.parent_accounts(id, institution_id) ON DELETE CASCADE;


--
-- Name: parent_students parent_students_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: parent_students parent_students_student_tenant_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.parent_students
    ADD CONSTRAINT parent_students_student_tenant_fk FOREIGN KEY (student_id, institution_id) REFERENCES public.students(id, institution_id) ON DELETE CASCADE;


--
-- Name: password_resets password_resets_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: plan_device_sessions plan_device_sessions_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_device_sessions
    ADD CONSTRAINT plan_device_sessions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: platform_reviews platform_reviews_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_reviews
    ADD CONSTRAINT platform_reviews_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: public_events public_events_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_events
    ADD CONSTRAINT public_events_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: push_devices push_devices_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_devices
    ADD CONSTRAINT push_devices_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: qr_login_challenges qr_login_challenges_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_login_challenges
    ADD CONSTRAINT qr_login_challenges_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: qr_login_challenges qr_login_challenges_source_refresh_token_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_login_challenges
    ADD CONSTRAINT qr_login_challenges_source_refresh_token_id_fkey FOREIGN KEY (source_refresh_token_id) REFERENCES public.refresh_tokens(id) ON DELETE CASCADE;


--
-- Name: qr_login_sessions qr_login_sessions_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.qr_login_sessions
    ADD CONSTRAINT qr_login_sessions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_qr_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_qr_session_id_fkey FOREIGN KEY (qr_session_id) REFERENCES public.qr_login_sessions(id);


--
-- Name: section_groups section_groups_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_groups
    ADD CONSTRAINT section_groups_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: section_groups section_groups_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.section_groups
    ADD CONSTRAINT section_groups_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: sections sections_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: sections sections_class_teacher_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_class_teacher_id_staff_id_fk FOREIGN KEY (class_teacher_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: sections sections_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sections
    ADD CONSTRAINT sections_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_assignments staff_assignments_group_id_section_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_group_id_section_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.section_groups(id);


--
-- Name: staff_assignments staff_assignments_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_assignments staff_assignments_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: staff_assignments staff_assignments_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_assignments staff_assignments_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_assignments
    ADD CONSTRAINT staff_assignments_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: staff_attendances staff_attendances_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_attendances
    ADD CONSTRAINT staff_attendances_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_attendances staff_attendances_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_attendances
    ADD CONSTRAINT staff_attendances_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_campus_id_campuses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_campus_id_campuses_id_fk FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;


--
-- Name: staff staff_custom_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_custom_role_id_fkey FOREIGN KEY (custom_role_id) REFERENCES public.institution_custom_roles(id) ON DELETE SET NULL;


--
-- Name: staff staff_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_profile_change_requests staff_profile_change_requests_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests
    ADD CONSTRAINT staff_profile_change_requests_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_profile_change_requests staff_profile_change_requests_reviewed_by_institution_admi_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests
    ADD CONSTRAINT staff_profile_change_requests_reviewed_by_institution_admi_fkey FOREIGN KEY (reviewed_by_institution_admin) REFERENCES public.institution_admins(id) ON DELETE SET NULL;


--
-- Name: staff_profile_change_requests staff_profile_change_requests_reviewed_by_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests
    ADD CONSTRAINT staff_profile_change_requests_reviewed_by_institutions_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.institutions(id) ON DELETE SET NULL;


--
-- Name: staff_profile_change_requests staff_profile_change_requests_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_profile_change_requests
    ADD CONSTRAINT staff_profile_change_requests_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_teachable_subjects staff_teachable_subjects_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_teachable_subjects
    ADD CONSTRAINT staff_teachable_subjects_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: staff_teachable_subjects staff_teachable_subjects_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_teachable_subjects
    ADD CONSTRAINT staff_teachable_subjects_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_teachable_subjects staff_teachable_subjects_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_teachable_subjects
    ADD CONSTRAINT staff_teachable_subjects_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: student_admission_counters student_admission_counters_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_admission_counters
    ADD CONSTRAINT student_admission_counters_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: student_fee_adjustments student_fee_adjustments_consumed_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustments
    ADD CONSTRAINT student_fee_adjustments_consumed_invoice_id_fkey FOREIGN KEY (consumed_invoice_id) REFERENCES public.fee_invoices(id);


--
-- Name: student_fee_adjustments student_fee_adjustments_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustments
    ADD CONSTRAINT student_fee_adjustments_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: student_fee_adjustments student_fee_adjustments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_fee_adjustments
    ADD CONSTRAINT student_fee_adjustments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_profile_change_requests student_profile_change_reques_reviewed_by_institution_admi_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests
    ADD CONSTRAINT student_profile_change_reques_reviewed_by_institution_admi_fkey FOREIGN KEY (reviewed_by_institution_admin) REFERENCES public.institution_admins(id) ON DELETE SET NULL;


--
-- Name: student_profile_change_requests student_profile_change_requests_institution_id_institutions_id_; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests
    ADD CONSTRAINT student_profile_change_requests_institution_id_institutions_id_ FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: student_profile_change_requests student_profile_change_requests_reviewed_by_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests
    ADD CONSTRAINT student_profile_change_requests_reviewed_by_institutions_id_fk FOREIGN KEY (reviewed_by) REFERENCES public.institutions(id) ON DELETE SET NULL;


--
-- Name: student_profile_change_requests student_profile_change_requests_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_profile_change_requests
    ADD CONSTRAINT student_profile_change_requests_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_promotions student_promotions_from_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_from_class_id_fkey FOREIGN KEY (from_class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: student_promotions student_promotions_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: student_promotions student_promotions_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_promotions student_promotions_to_class_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_promotions
    ADD CONSTRAINT student_promotions_to_class_id_fkey FOREIGN KEY (to_class_id) REFERENCES public.classes(id) ON DELETE SET NULL;


--
-- Name: students students_campus_id_campuses_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_campus_id_campuses_id_fk FOREIGN KEY (campus_id) REFERENCES public.campuses(id) ON DELETE SET NULL;


--
-- Name: students students_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: students students_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: students students_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: subjects subjects_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subjects
    ADD CONSTRAINT subjects_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_assignment_id_assignments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_assignment_id_assignments_id_fk FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: submissions submissions_student_id_students_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.submissions
    ADD CONSTRAINT submissions_student_id_students_id_fk FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: subscription_plans subscription_plans_redeemed_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_plans
    ADD CONSTRAINT subscription_plans_redeemed_institution_id_fkey FOREIGN KEY (redeemed_institution_id) REFERENCES public.institutions(id) ON DELETE SET NULL;


--
-- Name: tests tests_class_id_classes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_class_id_classes_id_fk FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE;


--
-- Name: tests tests_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: tests tests_section_id_sections_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_section_id_sections_id_fk FOREIGN KEY (section_id) REFERENCES public.sections(id) ON DELETE CASCADE;


--
-- Name: tests tests_staff_id_staff_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_staff_id_staff_id_fk FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;


--
-- Name: tests tests_subject_id_subjects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tests
    ADD CONSTRAINT tests_subject_id_subjects_id_fk FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;


--
-- Name: ticket_history ticket_history_ticket_id_tickets_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_history
    ADD CONSTRAINT ticket_history_ticket_id_tickets_id_fk FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;


--
-- Name: tickets tickets_institution_id_institutions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_institution_id_institutions_id_fk FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--



RESET search_path;
-- Initial records are installed only once, with the baseline.
INSERT INTO subscription_plans(id,kind,name,monthly_fee_paisa,setup_fee_paisa,per_student_fee_paisa,student_limit,campus_limit,platform_managed_campuses,audience,featured,sort_order,platforms) VALUES
 ('BASIC','PUBLIC','Basic',350000,500000,NULL,300,1,false,'Small schools',false,1,'["Nisaab360"]'),
 ('STANDARD','PUBLIC','Standard',650000,800000,NULL,800,3,false,'Growing schools',true,2,'["Nisaab360"]'),
 ('PREMIUM','PUBLIC','Premium',1100000,1200000,NULL,1500,5,false,'Large institutions',false,3,'["Nisaab360"]'),
 ('ENTERPRISE','PUBLIC','Enterprise',NULL,NULL,1100,NULL,NULL,true,'Multi-campus institutions',false,4,'["Nisaab360"]')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.notification_rollout(id) VALUES (true);

-- Preserve the historical upgrade ledger without replaying its migrations.
CREATE TABLE public.nisaab360_supplemental_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0006_login_lookup_indexes.sql', 'bc5505121bb7bf3c22025be77173601b73cb96f88fd357a0d96f9b2822fbc316');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0015_students_institution_section_idx.sql', 'e64e08e8ac885bcd0575fc7fe742060f97e6731b7f9b40aeaed6e142d5aa001a');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0016_institution_level_features.sql', '830494aeb74de72ea0d8c38a10f9eae23cfec677047ac62865b6b0562ff0fe8f');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0017_batch_exam_promotion_type.sql', '0926bb712d20f03ef0b2ac75dd9c73873a7e069029312f3ae33da83c84d482f2');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0018_hot_query_performance_indexes.sql', '7490fa0c9e6986564dde72976b0a568d9212ade750ec88d147368f06a3e1e63b');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0018_student_admission_sequences.sql', '43772458ddbd129a5d834ad5f5ccb6caa91e0ef24275275b5db3008e56b00781');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0019_official_promotion_results.sql', 'b6b3a50541bf9c66a87db89fa8dba307f510427f2e7b194c227604181ceb1323');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0020_final_class.sql', '3f56d31dc3ad2e17dc30f6607f3ca862d8fbe4e957faaf32c1abe64646250c72');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0021_promotion_history_snapshots.sql', 'b57eae416dc3df284155d8e37056d7da952cec30bdf7614f7138fb2332fbd486');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0022_graduated_student_access.sql', '528bf0fd1bc93a710cdc4e0bcdcc4865799979d5b945db7651df05ef127c49b0');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0023_server_load_indexes.sql', '3d5e8180322e2fc7c7015dfcc199b29507500fd7170933888e2343a0d68ca625');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0024_dashboard_optimization_indexes.sql', '3e2b1647780a8a943cbba298cfb55c1cdf4e2ea41e0a794ee06f4e122618988e');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0025_institution_pricing_plan.sql', '26e21ca2349e1719a340f96626452f4d264d6a363efb05b4899c47922f87b84f');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0026_fee_voucher_monthly_cycle.sql', 'f975c91cc830d7dd00ed6924e58e36a11e4f14991f2eeba76bedaf49195dfebf');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0027_software_version.sql', 'bb8a9c8895b582fa992f88c33878a053ee6e0dcaad72bb18c5db9ccf71125d73');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0028_institution_public_slug.sql', '657f0acddadc5af1d8f229f6a8b2b2ff1fc11d13a74030f3f0e09bc36f2ad87b');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0029_institution_public_profiles.sql', '3b1f31822a3b84d01e5dff93252c7d20ed715d76b8739598c878d2f17d9d0c17');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0030_admissions_intake.sql', '378b69b09a2f6b883edda28ca829b2479455a1c1eb0b646ef3a332da668160aa');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0031_admission_applicant_accounts.sql', '96da4c3326a022d9c7e9748f2f2b307827476f355830d00e62a5629a7af7e991');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0032_admission_review_pipeline.sql', 'cd809383ad9d9e43de24413ca9afdca63477f04d8e641ca495f182c981af6765');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0033_admission_fee_enrollment.sql', '7aa585361ada3080fbb771d879a8e2d117c2428d334f5cbcbbc9e94b5c6aceaa');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0034_admission_review_queue_indexes.sql', '5cf61be6cd2e3fc2e086f2a1d7823a457b0bb79d51df2dd3815ff085f6d6c1b0');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0035_admission_cycle_workflow_presets.sql', '90dce0d4692956f4b945d7f9862c2a8b2ad4770ae8064653d5450b4a6fd78b1c');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0036_public_website_content.sql', 'ea225d7e5f1a0d454e0126f5341ec20210d3b289733d4e7ed51e548f50f8385c');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0037_fee_management.sql', '3078186d733ef91d25ce81549684eaad52baea87273c090c9012151b7288d66b');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0038_fee_register_performance.sql', '055e240dc4a2bf3823388179241854101971d8d5c8e3d76dfcdbc4335ca1ab7a');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0039_pricing_plan_required.sql', '6a26af31e7a0a9f83a35df841a3e9c7862afdf36c54bfb423026ea25bb95cbe1');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0040_public_site_base_domain.sql', '3b9ca4cf4e457f6242011bcf13c5216f295e792e2e754d60af99af00a3259dae');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0041_institution_backups.sql', '8a14f9bfcad2031d045e07a1199bccb683fd077c437dc5dca68ff82c4782a940');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0042_institution_backup_retries.sql', '3a06d8609e6cb8474e6c2349d300942d8e6173bda38ad5a442816550acd62d66');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0043_admission_payment_details.sql', '84f168e8f449911625cf56079981b7095e17c3eb824bcb24cdb6c2869674aaab');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0044_fix_fee_invoice_billing_month_check.sql', 'b4d6d7103e80e265fd170725e4e09f6dd0a05581658de80d2bbc5a59df20c976');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0045_payment_methods_and_student_fee_submissions.sql', '99ac57ff279618dc3b4d19e7562a9168a5ff6aa389bae5ca58b93cb836dbee80');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0046_admission_refund_required.sql', 'ad0d4892fce9dc15e6fe514636e5f71a69c14914fca46e1a7c859bbe0e3b68fe');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0047_courses_and_streaming.sql', '98d394d0c762ac7a08cadcd5a45abd56cbefcb0b51655bde17f0ccc8809334e8');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0048_email_outbox.sql', '830de20fdf30749c76abeaafc4572e423b6e516d3aa3497ad59f677dadc73721');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0049_retire_legacy_fee_vouchers.sql', 'ae9e846cad5272d86f0eb783efdfc1a7d02d46b693946fe668778307a29cd3ef');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0050_refresh_token_rotation.sql', '2f9f9abbf18ee78bb67071764bdd25a9abda1ce60bb2d777da3717f40dcc2d2e');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0051_parent_identity.sql', '749447b8a4dad356b71e32a87401a8185bd6de7a42fe1a1d85b069515b582207');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0052_assessment_result_publishing.sql', '20203a03ca2cadcbd91c7f5f7509796f420c0ae2ccec99c131af2c11b8b96d0f');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0053_section_groups_timetable.sql', '99dcd9b2b63d4da6e23c823b69ad28d1e15ba3efb8e8562bd65b45d02e1381c6');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0054_public_website_notices.sql', '762224d515d0f515eef85f4a50c9322e0006466b9b7ce416e170c8e57649a930');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0055_public_events.sql', 'bde20171f21fa20cf7f7c3791c350b5190d29c7a851b7c1f8c8d15f55102a731');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0056_institution_payment_gateway.sql', 'e0ede8b509714224c5dd70020815bf1b20e2297d0e3eea7da0b83fb462198273');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0057_gateway_payment_attempts.sql', '99fbfff2e117bc34a0aa419647171fc6a590e0c6ac70a062837b8e80dcf8b998');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0058_institution_google_drive_backups.sql', 'e1192a750d26d7fec52ce8b9644398cd2de5e9d3647faa086a71c07767fd9648');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0059_central_backup_settings.sql', '68c263699b1519b970ff0c0a342a38ea28e1501e7df6656bf79538d4374f41e7');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0060_central_database_backups.sql', '5964b7db748ce1c30be89993e487077eca87dc245169bad19d5aa603c3ab2085');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0061_institution_restore_requests.sql', '7022dac374a712f830cf4d115bfc6f6058dab05a5f4bc19a0215f6ff84f04bd8');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0062_employee_backup_permissions.sql', 'b3637f57e05fe93690064e9ae01cbcec9bb1c9a3a7f08281f2945a50fbfd91db');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0063_institution_admin_profile_review.sql', 'ff98c0cb3959f01faca4253c2f827aed1b37f0be8cfc3b7667102da9d2e3ab50');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0064_public_website_themes.sql', 'ada7c8a9c5792f724dbad73bfad132ee8c4427ea88fd85ab732f82228d74e505');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0065_public_website_default_theme.sql', '5d64cbec1e53c9bc836361a61177d644c207733bb0c49f9d59537bed21457cf1');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0066_campus_workspaces.sql', '90e798f8f7dbe584362c8cadb8fc04942cecf4a2ea39ccfea792551ee54c317f');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0067_admission_campus_intake.sql', 'bc9fc8e75f26bb47e02d885554d6f49638097bc2033dabdb0a8f50581a7e93af');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0068_admission_campus_availability.sql', '7ce5daf5e8152222079111a8d83bb4c2699ec385fa0348a8557fee54499dd599');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0069_campus_identity.sql', 'c4434fc687be0bc06cf5c08fc2f581c73501605be7ed4965fb00c14d08d323d1');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0070_submissions_file_url.sql', '361807f9936cf87ca7d5aac1a3552c55995f16c49973aaf13938e5c8ae7379b5');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0071_manual_payment_accounts.sql', 'c2c4b130b22ad204ad1b060dc5909889028c9e47003f08b8fdc82151d9fc9911');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0072_admission_cycle_archive.sql', '6baa3d683c3c114f248bf7389d5b12d8bd3d4c461a43fcbc180b96f8af918dee');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0073_fee_snapshots_and_archive_write_guards.sql', '07ca8d134fa3c44ae518ff4cc49d887323c7fa3c8c9a3b1f2c1662c95ad88caa');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0074_explicit_fee_billing.sql', '606d6cdef7cd02eeeed48f715ce5c811b9b0c3a7eaa3673e7b87e0e36ff19d88');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0075_public_site_builder.sql', 'd068d6c8e76c16a17d75d9e0b6a25db18371fb0dcde5df598792f48f76a4f0ee');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0076_central_backup_reconciliation.sql', 'fa9a7569db4c2e29355f423a681df316084afdb4c1970b0c9b4ac983b13f68da');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0077_online_payment_modes.sql', '3226e7e2c2a653ff2ac6aa1531905237d17bc198b1a9ef118d395fc73f1207b6');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0078_qr_account_login.sql', '7f8acd163eedc486688b8860cb7a6642476d5df05c3d1e08b9e2018c3db811b5');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0079_qr_login_sessions.sql', '17f74811a007bf01eda33290fe930feb38404f8f7396062e5435ea70b5069d13');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0080_mobile_notifications.sql', 'a9a29f1300b513591737dc1468b478a196417ee061e84dbcd9ecf2c7a773409f');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0081_institution_mobile_apps.sql', 'cbd17f5b5598bb5807d90ee9728353e15eff28b51c0c4ab3845bf5130ac0d9b7');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0082_institution_agreement_acceptance.sql', 'f7382dc6bbe213a6cd07b0d75db27278bc89e1c6ec7bb134c845b530c1067faf');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0083_admin_managed_plans.sql', '36251978043ac87d9e7782f5ba2c9081b991230182559c6fafe01738ccc407f1');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0084_deal_code_fingerprints.sql', '536814d8adac3782d1d15887e0fbb112599b6fb82d4e3d517750e810fdec9caa');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0085_remove_plan_device_limits.sql', '549a3851660511603207dcc3718e1042194473e6748365a3fff9a1ca0afac983');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0086_security_sessions.sql', '5c48e323c9da85aafe1a860678e504659404b6c7224c74d1e463fbcdb08f30c2');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0087_database_backup_recovery.sql', '5ca42e218d65d30a98b0610e238544ab92dc06aeedb9e109708f9080ce140834');
INSERT INTO public.nisaab360_supplemental_migrations(name, sha256) VALUES ('0088_attendance_delegation.sql', '5c6df9a7410aa2c9f1c973698eafccf763ea14db3d241675f3e7f1dfa6e798f7');
