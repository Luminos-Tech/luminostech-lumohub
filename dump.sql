--
-- PostgreSQL database dump
--

\restrict tl8HRfCeJvMs16k4qZ8cagRWyMqiqnujHdABkAFtoctyW6T9DbRnvRwCyawHmMT

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

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

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_actions; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.admin_actions (
    id bigint NOT NULL,
    admin_user_id bigint NOT NULL,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id bigint,
    note text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.admin_actions OWNER TO lumohub;

--
-- Name: admin_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.admin_actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.admin_actions_id_seq OWNER TO lumohub;

--
-- Name: admin_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.admin_actions_id_seq OWNED BY public.admin_actions.id;


--
-- Name: events; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.events (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    location character varying(255),
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone NOT NULL,
    status character varying(30) NOT NULL,
    priority character varying(20) NOT NULL,
    color character varying(30),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.events OWNER TO lumohub;

--
-- Name: events_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.events_id_seq OWNER TO lumohub;

--
-- Name: events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.events_id_seq OWNED BY public.events.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.notifications (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    event_id bigint,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    channel character varying(30) NOT NULL,
    is_read boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    read_at timestamp without time zone
);


ALTER TABLE public.notifications OWNER TO lumohub;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.notifications_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO lumohub;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.reminders (
    id bigint NOT NULL,
    event_id bigint NOT NULL,
    remind_before_minutes integer NOT NULL,
    channel character varying(30) NOT NULL,
    is_sent boolean NOT NULL,
    sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.reminders OWNER TO lumohub;

--
-- Name: reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.reminders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reminders_id_seq OWNER TO lumohub;

--
-- Name: reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.reminders_id_seq OWNED BY public.reminders.id;


--
-- Name: system_logs; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.system_logs (
    id bigint NOT NULL,
    user_id bigint,
    action character varying(100) NOT NULL,
    target_type character varying(50),
    target_id bigint,
    details text,
    ip_address character varying(50),
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_logs OWNER TO lumohub;

--
-- Name: system_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.system_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.system_logs_id_seq OWNER TO lumohub;

--
-- Name: system_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.system_logs_id_seq OWNED BY public.system_logs.id;


--
-- Name: user_sessions; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.user_sessions (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    token text NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_sessions OWNER TO lumohub;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.user_sessions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_sessions_id_seq OWNER TO lumohub;

--
-- Name: user_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.user_sessions_id_seq OWNED BY public.user_sessions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: lumohub
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    full_name character varying(150) NOT NULL,
    email character varying(150) NOT NULL,
    password_hash text NOT NULL,
    phone character varying(20),
    avatar_url text,
    role character varying(30) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO lumohub;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: lumohub
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO lumohub;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: lumohub
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: admin_actions id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.admin_actions ALTER COLUMN id SET DEFAULT nextval('public.admin_actions_id_seq'::regclass);


--
-- Name: events id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.events ALTER COLUMN id SET DEFAULT nextval('public.events_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: reminders id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.reminders ALTER COLUMN id SET DEFAULT nextval('public.reminders_id_seq'::regclass);


--
-- Name: system_logs id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.system_logs ALTER COLUMN id SET DEFAULT nextval('public.system_logs_id_seq'::regclass);


--
-- Name: user_sessions id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.user_sessions ALTER COLUMN id SET DEFAULT nextval('public.user_sessions_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: admin_actions; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.admin_actions (id, admin_user_id, action, target_type, target_id, note, created_at) FROM stdin;
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.events (id, user_id, title, description, location, start_time, end_time, status, priority, color, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.notifications (id, user_id, event_id, title, content, channel, is_read, created_at, read_at) FROM stdin;
\.


--
-- Data for Name: reminders; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.reminders (id, event_id, remind_before_minutes, channel, is_sent, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: system_logs; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.system_logs (id, user_id, action, target_type, target_id, details, ip_address, created_at) FROM stdin;
1	1	register	user	1	\N	172.19.0.1	2026-03-31 23:03:06.731307
2	1	login	\N	\N	\N	172.19.0.1	2026-03-31 23:03:20.076298
3	1	login	\N	\N	\N	172.19.0.1	2026-03-31 23:05:20.856487
4	1	login	\N	\N	\N	172.19.0.1	2026-03-31 23:31:28.101215
\.


--
-- Data for Name: user_sessions; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.user_sessions (id, user_id, token, expires_at, created_at) FROM stdin;
1	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzc1NjAzMDAwLCJ0eXBlIjoicmVmcmVzaCJ9.B3o5Ad_-F7xaMTELJlkhc5uAosrOUdCGdIdfOcAz8po	2026-04-07 23:03:20.068339	2026-03-31 23:03:19.864138
2	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzc1NjAzMTIwLCJ0eXBlIjoicmVmcmVzaCJ9.GcTsOf9GAPfUAc9de0wvXw7tdJRWtg5l-3-awHPQgQ0	2026-04-07 23:05:20.849033	2026-03-31 23:05:20.639008
3	1	eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwiZXhwIjoxNzc1NjA0Njg4LCJ0eXBlIjoicmVmcmVzaCJ9.PQPNGjdcBXEaRXGOr30po1uMCxamFxOCzBQ0UaBFFdw	2026-04-07 23:31:28.092218	2026-03-31 23:31:27.886219
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: lumohub
--

COPY public.users (id, full_name, email, password_hash, phone, avatar_url, role, is_active, created_at, updated_at) FROM stdin;
1	V. Ha Tran	vanha.cv.vn@gmail.com	$2b$12$W0BGLzYIAoyw/oF5C9lj/eIRufoWEQ9eQpUvpPshd/4JHMyqIjt6W	\N	\N	user	t	2026-03-31 23:03:06.50179	2026-03-31 23:03:06.50179
\.


--
-- Name: admin_actions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.admin_actions_id_seq', 1, false);


--
-- Name: events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.events_id_seq', 1, false);


--
-- Name: notifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.notifications_id_seq', 1, false);


--
-- Name: reminders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.reminders_id_seq', 1, false);


--
-- Name: system_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.system_logs_id_seq', 4, true);


--
-- Name: user_sessions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.user_sessions_id_seq', 3, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: lumohub
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: admin_actions admin_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: system_logs system_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_pkey PRIMARY KEY (id);


--
-- Name: user_sessions user_sessions_token_key; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_token_key UNIQUE (token);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: ix_admin_actions_admin_user_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_admin_actions_admin_user_id ON public.admin_actions USING btree (admin_user_id);


--
-- Name: ix_events_user_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_events_user_id ON public.events USING btree (user_id);


--
-- Name: ix_notifications_user_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: ix_reminders_event_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_reminders_event_id ON public.reminders USING btree (event_id);


--
-- Name: ix_system_logs_user_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_system_logs_user_id ON public.system_logs USING btree (user_id);


--
-- Name: ix_user_sessions_user_id; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE INDEX ix_user_sessions_user_id ON public.user_sessions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: lumohub
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: admin_actions admin_actions_admin_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.admin_actions
    ADD CONSTRAINT admin_actions_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: events events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;


--
-- Name: system_logs system_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.system_logs
    ADD CONSTRAINT system_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_sessions user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: lumohub
--

ALTER TABLE ONLY public.user_sessions
    ADD CONSTRAINT user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict tl8HRfCeJvMs16k4qZ8cagRWyMqiqnujHdABkAFtoctyW6T9DbRnvRwCyawHmMT

