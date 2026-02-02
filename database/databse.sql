
CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 3875 (class 0 OID 0)
-- Dependencies: 54
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 395 (class 1255 OID 18490)
-- Name: add_new_video(character varying, text, jsonb, jsonb, jsonb, boolean, character varying, character varying, character varying, timestamp without time zone); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.add_new_video(p_title character varying, p_description text, p_urls jsonb, p_telegram_links jsonb, p_material_urls jsonb, p_is_kuppi boolean, p_language_code character varying, p_module_code character varying, p_student_index_number character varying DEFAULT NULL::character varying, p_published_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_module_id INTEGER;
    v_owner_id INTEGER;
BEGIN
    -- Get module id from code
    SELECT id INTO v_module_id 
    FROM modules 
    WHERE code = p_module_code;

    IF v_module_id IS NULL THEN
        RAISE EXCEPTION 'Module code % not found', p_module_code;
    END IF;

    -- Get student id from index number, if provided
    IF p_student_index_number IS NOT NULL THEN
        SELECT id INTO v_owner_id
        FROM students
        WHERE index_number = p_student_index_number;

        -- If not found, set owner_id to NULL
        IF v_owner_id IS NULL THEN
            v_owner_id := NULL;
        END IF;
    ELSE
        v_owner_id := NULL;
    END IF;

    -- Insert new video
    INSERT INTO videos(
        module_id,
        title,
        urls,
        telegram_links,
        material_urls,
        is_kuppi,
        owner_id,
        created_at,
        description,
        language_code
    ) VALUES (
        v_module_id,
        p_title,
        p_urls,
        p_telegram_links,
        p_material_urls,
        p_is_kuppi,
        v_owner_id,
        p_published_at,
        p_description,
        p_language_code
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting video: %', SQLERRM;
END;
$$;


ALTER FUNCTION public.add_new_video(p_title character varying, p_description text, p_urls jsonb, p_telegram_links jsonb, p_material_urls jsonb, p_is_kuppi boolean, p_language_code character varying, p_module_code character varying, p_student_index_number character varying, p_published_at timestamp without time zone) OWNER TO postgres;

--
-- TOC entry 378 (class 1255 OID 19399)
-- Name: approve_user_kuppis(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.approve_user_kuppis() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- When user is approved for kuppies, approve all their existing kuppis
  IF NEW.is_approved_for_kuppies = true AND OLD.is_approved_for_kuppies = false THEN
    UPDATE videos
    SET is_approved = true
    WHERE added_by_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.approve_user_kuppis() OWNER TO postgres;

--
-- TOC entry 440 (class 1255 OID 19397)
-- Name: auto_approve_kuppi(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.auto_approve_kuppi() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Check if the user adding the kuppi is approved
  IF EXISTS (
    SELECT 1 FROM users 
    WHERE id = NEW.added_by_user_id 
    AND is_approved_for_kuppies = true
  ) THEN
    NEW.is_approved := true;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.auto_approve_kuppi() OWNER TO postgres;

--
-- TOC entry 404 (class 1255 OID 18491)
-- Name: get_videos_by_dept_semester(bigint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.get_videos_by_dept_semester(dept_id bigint, sem_id bigint) RETURNS TABLE(video_id bigint, title text, module_code text, module_name text, chapter_number integer, topic text, tutor_name text, views_count integer, has_materials boolean)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    v.id as video_id,
    v.title,
    m.code as module_code,
    m.name as module_name,
    v.chapter_number,
    v.topic,
    v.tutor_name,
    v.views_count,
    EXISTS(SELECT 1 FROM video_materials vm WHERE vm.video_id = v.id) as has_materials
  FROM videos v
  JOIN modules m ON v.module_id = m.id
  WHERE m.department_id = dept_id 
    AND m.semester_id = sem_id
    AND v.is_active = true 
    AND m.is_active = true
  ORDER BY m.code, v.chapter_number, v.title;
END;
$$;


ALTER FUNCTION public.get_videos_by_dept_semester(dept_id bigint, sem_id bigint) OWNER TO postgres;

--
-- TOC entry 482 (class 1255 OID 18492)
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
    BEGIN
      INSERT INTO public.users (id, email)
      VALUES (NEW.id, NEW.email); -- Or any other initial data
      RETURN NEW;
    END;
    $$;


ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

--
-- TOC entry 379 (class 1255 OID 18493)
-- Name: increment_video_views(bigint, bigint); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.increment_video_views(video_id_param bigint, user_id_param bigint DEFAULT NULL::bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Insert view record
  INSERT INTO video_views (video_id, user_id) 
  VALUES (video_id_param, user_id_param);
  
  -- Update video views count
  UPDATE videos 
  SET views_count = views_count + 1 
  WHERE id = video_id_param;
END;
$$;


ALTER FUNCTION public.increment_video_views(video_id_param bigint, user_id_param bigint) OWNER TO postgres;

--
-- TOC entry 389 (class 1255 OID 18495)
-- Name: search_videos(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_videos(query text) RETURNS TABLE(id integer, module_id integer, title character varying, urls jsonb, telegram_links jsonb, material_urls jsonb, is_kuppi boolean, owner_id integer, created_at timestamp without time zone, description text, language_code character varying, module_name character varying, module_code character varying, owner_name character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.module_id,
    v.title,
    v.urls,
    v.telegram_links,
    v.material_urls,
    v.is_kuppi,
    v.owner_id,
    v.created_at,
    v.description,
    v.language_code,
    m.name AS module_name,
    m.code AS module_code,
    s.name AS owner_name
  FROM
    public.videos AS v
  LEFT JOIN
    public.modules AS m ON v.module_id = m.id
  LEFT JOIN
    public.students AS s ON v.owner_id = s.id
  WHERE
    (
      to_tsvector('english', v.title || ' ' || v.description) @@ to_tsquery('english', query)
      OR to_tsvector('english', m.name || ' ' || m.code) @@ to_tsquery('english', query)
      OR to_tsvector('english', s.name) @@ to_tsquery('english', query)
    );
END;
$$;


ALTER FUNCTION public.search_videos(query text) OWNER TO postgres;

--
-- TOC entry 418 (class 1255 OID 18496)
-- Name: search_videos_all(text); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.search_videos_all(query text) RETURNS TABLE(id integer, title text, description text, module_code text, module_name text, owner_name text, created_at timestamp without time zone)
    LANGUAGE sql STABLE
    AS $$
  SELECT
    v.id,
    v.title::text,
    v.description,
    m.code::text AS module_code,
    m.name::text AS module_name,
    s.name::text AS owner_name,
    v.created_at
  FROM videos v
  LEFT JOIN modules m ON m.id = v.module_id
  LEFT JOIN students s ON s.id = v.owner_id
  WHERE
    v.title ILIKE '%' || query || '%'
    OR v.description ILIKE '%' || query || '%'
    OR m.code ILIKE '%' || query || '%'
    OR m.name ILIKE '%' || query || '%'
    OR s.name ILIKE '%' || query || '%'
    OR v.created_at::text ILIKE '%' || query || '%'
  ORDER BY v.created_at DESC;
$$;


ALTER FUNCTION public.search_videos_all(query text) OWNER TO postgres;

--
-- TOC entry 480 (class 1255 OID 18497)
-- Name: sync_auth_user_to_public_users(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_auth_user_to_public_users() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (
    email,
    full_name,
    avatar_url,
    created_at
  )
  VALUES (
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Unknown'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    NOW()
  )
  ON CONFLICT (email) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_auth_user_to_public_users() OWNER TO postgres;

--
-- TOC entry 402 (class 1255 OID 18498)
-- Name: sync_auth_user_to_users(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_auth_user_to_users() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    existing_user_id BIGINT;
BEGIN
    -- Check if a user with this email already exists in public.users
    SELECT id INTO existing_user_id 
    FROM public.users 
    WHERE email = NEW.email;

    -- If user exists, update their email and full name
    IF existing_user_id IS NOT NULL THEN
        UPDATE public.users 
        SET 
            email = NEW.email,
            full_name = NEW.raw_user_meta_data->>'full_name'
        WHERE id = existing_user_id;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_auth_user_to_users() OWNER TO postgres;

--
-- TOC entry 503 (class 1255 OID 18499)
-- Name: sync_user_from_auth(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.sync_user_from_auth() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Insert a new row into public.users if it doesn't exist
  INSERT INTO public.users(id, email, created_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING; -- prevent duplicates
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.sync_user_from_auth() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 374 (class 1259 OID 19118)
-- Name: faculty_hierarchy; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.faculty_hierarchy (
    id integer NOT NULL,
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.faculty_hierarchy OWNER TO postgres;

--
-- TOC entry 3888 (class 0 OID 0)
-- Dependencies: 374
-- Name: TABLE faculty_hierarchy; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.faculty_hierarchy IS 'Stores the complete faculty hierarchy as JSONB for module selection navigation';


--
-- TOC entry 373 (class 1259 OID 19117)
-- Name: faculty_hierarchy_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.faculty_hierarchy_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.faculty_hierarchy_id_seq OWNER TO postgres;

--
-- TOC entry 3890 (class 0 OID 0)
-- Dependencies: 373
-- Name: faculty_hierarchy_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.faculty_hierarchy_id_seq OWNED BY public.faculty_hierarchy.id;


--
-- TOC entry 361 (class 1259 OID 18524)
-- Name: modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.modules (
    id integer NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL
);


ALTER TABLE public.modules OWNER TO postgres;

--
-- TOC entry 363 (class 1259 OID 18542)
-- Name: modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.modules_id_seq OWNER TO postgres;

--
-- TOC entry 3893 (class 0 OID 0)
-- Dependencies: 363
-- Name: modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.modules_id_seq OWNED BY public.modules.id;


--
-- TOC entry 362 (class 1259 OID 18529)
-- Name: videos; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.videos (
    id integer NOT NULL,
    module_id integer,
    title character varying(200) NOT NULL,
    youtube_links jsonb NOT NULL,
    telegram_links jsonb,
    material_urls jsonb,
    is_kuppi boolean DEFAULT false,
    student_id integer,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    description text,
    language_code character varying DEFAULT 'si'::character varying NOT NULL,
    published_at date,
    onedrive_cloud_video_urls jsonb,
    gdrive_cloud_video_urls jsonb,
    added_by_user_id integer,
    is_hidden boolean DEFAULT false,
    is_approved boolean DEFAULT false
);


ALTER TABLE public.videos OWNER TO postgres;

--
-- TOC entry 3895 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN videos.added_by_user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.videos.added_by_user_id IS 'References the user who added this video/kuppi.';


--
-- TOC entry 3896 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN videos.is_hidden; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.videos.is_hidden IS 'Whether the video is hidden by the user who added it. Hidden videos are not shown in search results or module pages.';


--
-- TOC entry 3897 (class 0 OID 0)
-- Dependencies: 362
-- Name: COLUMN videos.is_approved; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.videos.is_approved IS 'Whether this kuppi is approved to be shown. Auto-set to true if user is_approved_for_kuppies';


--
-- TOC entry 364 (class 1259 OID 18543)
-- Name: modules_search_mv; Type: MATERIALIZED VIEW; Schema: public; Owner: postgres
--

CREATE MATERIALIZED VIEW public.modules_search_mv AS
 SELECT m.id,
    m.code,
    m.name,
    count(v.id) AS video_count
   FROM (public.modules m
     LEFT JOIN public.videos v ON ((m.id = v.module_id)))
  GROUP BY m.id, m.code, m.name
  WITH NO DATA;


ALTER MATERIALIZED VIEW public.modules_search_mv OWNER TO postgres;

--
-- TOC entry 365 (class 1259 OID 18556)
-- Name: students; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.students (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    faculty_id integer,
    image_url character varying(255),
    linkedin_url character varying,
    index_no text NOT NULL
);


ALTER TABLE public.students OWNER TO postgres;

--
-- TOC entry 366 (class 1259 OID 18561)
-- Name: student_video_counts; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.student_video_counts AS
 SELECT s.id AS student_id,
    s.name AS student_name,
    count(v.id) AS video_count
   FROM (public.students s
     LEFT JOIN public.videos v ON ((s.id = v.student_id)))
  GROUP BY s.id, s.name
  ORDER BY s.id;


ALTER VIEW public.student_video_counts OWNER TO postgres;

--
-- TOC entry 367 (class 1259 OID 18566)
-- Name: students_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.students_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.students_id_seq OWNER TO postgres;

--
-- TOC entry 3902 (class 0 OID 0)
-- Dependencies: 367
-- Name: students_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.students_id_seq OWNED BY public.students.id;


--
-- TOC entry 372 (class 1259 OID 18918)
-- Name: user_dashboard_modules; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_dashboard_modules (
    id integer NOT NULL,
    user_id integer NOT NULL,
    module_ids jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_dashboard_modules OWNER TO postgres;

--
-- TOC entry 371 (class 1259 OID 18917)
-- Name: user_dashboard_modules_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.user_dashboard_modules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_dashboard_modules_id_seq OWNER TO postgres;

--
-- TOC entry 3905 (class 0 OID 0)
-- Dependencies: 371
-- Name: user_dashboard_modules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.user_dashboard_modules_id_seq OWNED BY public.user_dashboard_modules.id;


--
-- TOC entry 370 (class 1259 OID 18899)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    firebase_uid text NOT NULL,
    email text NOT NULL,
    display_name text,
    photo_url text,
    is_verified boolean DEFAULT false,
    auth_provider text DEFAULT 'email'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_approved_for_kuppies boolean DEFAULT false
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 3907 (class 0 OID 0)
-- Dependencies: 370
-- Name: COLUMN users.is_approved_for_kuppies; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.is_approved_for_kuppies IS 'If true, this user''s kuppies will be visible on the website. Manual approval required.';


--
-- TOC entry 369 (class 1259 OID 18898)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 3909 (class 0 OID 0)
-- Dependencies: 369
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 368 (class 1259 OID 18567)
-- Name: videos_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.videos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.videos_id_seq OWNER TO postgres;

--
-- TOC entry 3911 (class 0 OID 0)
-- Dependencies: 368
-- Name: videos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.videos_id_seq OWNED BY public.videos.id;


--
-- TOC entry 3658 (class 2604 OID 19121)
-- Name: faculty_hierarchy id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.faculty_hierarchy ALTER COLUMN id SET DEFAULT nextval('public.faculty_hierarchy_id_seq'::regclass);


--
-- TOC entry 3640 (class 2604 OID 18581)
-- Name: modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.modules ALTER COLUMN id SET DEFAULT nextval('public.modules_id_seq'::regclass);


--
-- TOC entry 3647 (class 2604 OID 18584)
-- Name: students id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.students ALTER COLUMN id SET DEFAULT nextval('public.students_id_seq'::regclass);


--
-- TOC entry 3654 (class 2604 OID 18921)
-- Name: user_dashboard_modules id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_dashboard_modules ALTER COLUMN id SET DEFAULT nextval('public.user_dashboard_modules_id_seq'::regclass);


--
-- TOC entry 3648 (class 2604 OID 18902)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 3641 (class 2604 OID 18585)
-- Name: videos id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.videos ALTER COLUMN id SET DEFAULT nextval('public.videos_id_seq'::regclass);


--
-- TOC entry 3869 (class 0 OID 19118)
-- Dependencies: 374
-- Data for Name: faculty_hierarchy; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.faculty_hierarchy (id, data, created_at, updated_at) FROM stdin;
2	{"it": {"name": "Faculty of Information Technology", "order": 4, "levels": ["Program", "Semester"], "children": {"bsc-it": {"name": "B.Sc. Information Technology", "order": 1, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}}}, "science": {"name": "Faculty of Science", "order": 6, "levels": ["Department", "Year"], "children": {"maths": {"name": "Mathematics", "order": 3, "children": {"y1": {"name": "Year 1", "order": 1, "modules": []}, "y2": {"name": "Year 2", "order": 2, "modules": []}, "y3": {"name": "Year 3", "order": 3, "modules": []}, "y4": {"name": "Year 4", "order": 4, "modules": []}}}, "physics": {"name": "Physics", "order": 1, "children": {"y1": {"name": "Year 1", "order": 1, "modules": []}, "y2": {"name": "Year 2", "order": 2, "modules": []}, "y3": {"name": "Year 3", "order": 3, "modules": []}, "y4": {"name": "Year 4", "order": 4, "modules": []}}}, "chemistry": {"name": "Chemistry", "order": 2, "children": {"y1": {"name": "Year 1", "order": 1, "modules": []}, "y2": {"name": "Year 2", "order": 2, "modules": []}, "y3": {"name": "Year 3", "order": 3, "modules": []}, "y4": {"name": "Year 4", "order": 4, "modules": []}}}}}, "business": {"name": "Faculty of Business", "order": 5, "levels": ["Department", "Semester"], "children": {"accounting": {"name": "Accounting", "order": 2, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}}}, "management": {"name": "Management Studies", "order": 1, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}}}}}, "medicine": {"name": "Faculty of Medicine", "order": 2, "levels": ["Year", "Term"], "children": {"y1": {"name": "Year 1", "order": 1, "children": {"t1": {"name": "Term 1", "order": 1, "modules": [43, 44, 45, 46, 47, 48]}, "t2": {"name": "Term 2", "order": 2, "modules": []}, "t3": {"name": "Term 3", "order": 3, "modules": []}}}, "y2": {"name": "Year 2", "order": 2, "children": {"t1": {"name": "Term 1", "order": 1, "modules": [49, 50, 51, 52]}, "t2": {"name": "Term 2", "order": 2, "modules": []}, "t3": {"name": "Term 3", "order": 3, "modules": []}}}, "y3": {"name": "Year 3", "order": 3, "children": {"t1": {"name": "Term 1", "order": 1, "modules": [53, 54, 55, 56, 57, 58, 59]}, "t2": {"name": "Term 2", "order": 2, "modules": []}, "t3": {"name": "Term 3", "order": 3, "modules": []}}}, "y4": {"name": "Year 4", "order": 4, "children": {"t1": {"name": "Term 1", "order": 1, "modules": [60, 61, 62, 63, 64, 65]}, "t2": {"name": "Term 2", "order": 2, "modules": []}, "t3": {"name": "Term 3", "order": 3, "modules": []}}}, "y5": {"name": "Year 5", "order": 5, "children": {"t1": {"name": "Term 1", "order": 1, "modules": []}, "t2": {"name": "Term 2", "order": 2, "modules": []}, "t3": {"name": "Term 3", "order": 3, "modules": []}}}}}, "engineering": {"name": "Faculty of Engineering", "order": 1, "levels": ["Department", "Semester"], "children": {"cse": {"name": "Computer Science & Engineering", "order": 1, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [28, 29, 30, 31, 32, 33]}, "s3": {"name": "Semester 3", "order": 3, "modules": [34, 35, 36, 37, 38, 39, 40, 41, 42]}, "s4": {"name": "Semester 4", "order": 4, "modules": [86, 146, 152, 201, 203, 204, 205, 206, 207, 208]}, "s5": {"name": "Semester 5", "order": 5, "modules": [86, 152, 159, 213, 214, 215, 216]}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "ent": {"name": "Electronic & Telecommunication", "order": 3, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [32, 33, 218, 219, 220, 221, 222, 223]}, "s3": {"name": "Semester 3", "order": 3, "modules": [40, 86, 152, 227, 228, 229, 230, 231, 232]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "civil": {"name": "Civil Engineering", "order": 5, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [32, 33, 109, 110, 111, 112, 113]}, "s3": {"name": "Semester 3", "order": 3, "modules": [115, 40, 86, 116, 117, 118, 119, 120, 121]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "earth": {"name": "Earth Resources Engineering", "order": 8, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [32, 33, 161, 162, 163, 164, 165]}, "s3": {"name": "Semester 3", "order": 3, "modules": [175, 176, 40, 86, 121, 177, 178, 179, 180, 181]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "textile": {"name": "Textile & Apparel Engineering", "order": 9, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "chemical": {"name": "Chemical & Process Engineering", "order": 6, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [127, 128, 129, 130, 33, 32]}, "s3": {"name": "Semester 3", "order": 3, "modules": [142, 143, 144, 145, 40, 146, 83]}, "s4": {"name": "Semester 4", "order": 4, "modules": [147, 148, 149, 150, 151, 152]}, "s5": {"name": "Semester 5", "order": 5, "modules": [153, 154, 155, 156, 157, 158, 159]}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "materials": {"name": "Materials Science & Engineering", "order": 7, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [175, 32, 83, 33, 164, 186, 187, 188]}, "s3": {"name": "Semester 3", "order": 3, "modules": [195, 40, 86, 152, 196, 197, 198, 199]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "transport": {"name": "Transport & Logistics Management", "order": 10, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "electrical": {"name": "Electrical Engineering", "order": 4, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [32, 33, 31, 82, 83, 84, 85]}, "s3": {"name": "Semester 3", "order": 3, "modules": [42, 40, 86, 87, 88, 89, 90, 91]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}, "mechanical": {"name": "Mechanical Engineering", "order": 2, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": [22, 23, 24, 25, 26, 27]}, "s2": {"name": "Semester 2", "order": 2, "modules": [32, 33, 31, 82, 83, 84, 85]}, "s3": {"name": "Semester 3", "order": 3, "modules": [42, 40, 86, 87, 88, 89, 90, 91]}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}, "s7": {"name": "Semester 7", "order": 7, "modules": []}, "s8": {"name": "Semester 8", "order": 8, "modules": []}}}}}, "architecture": {"name": "Faculty of Architecture", "order": 3, "levels": ["Course", "Semester"], "children": {"bsc-tp": {"name": "B.Sc. Town Planning", "order": 3, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}}}, "bsc-qsv": {"name": "B.Sc. Quantity Surveying", "order": 2, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}}}, "bsc-arch": {"name": "B.Sc. Architecture", "order": 1, "children": {"s1": {"name": "Semester 1", "order": 1, "modules": []}, "s2": {"name": "Semester 2", "order": 2, "modules": []}, "s3": {"name": "Semester 3", "order": 3, "modules": []}, "s4": {"name": "Semester 4", "order": 4, "modules": []}, "s5": {"name": "Semester 5", "order": 5, "modules": []}, "s6": {"name": "Semester 6", "order": 6, "modules": []}}}}}}	2025-11-30 21:11:40.126835+00	2025-11-30 21:11:40.126835+00
\.


--
-- TOC entry 3857 (class 0 OID 18524)
-- Dependencies: 361
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: postgres
--
