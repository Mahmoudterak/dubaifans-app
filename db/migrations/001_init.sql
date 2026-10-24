-- MT Reels AI: المخطط الأولي
-- كل جدول يحمل created_at، والمفاتيح كلها UUID لتسهيل النقل لاحقًا.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- تفضيلات أسلوب الكتابة لكل مستخدم
CREATE TABLE user_preferences (
  user_id                   UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  dialect                   TEXT NOT NULL DEFAULT 'egyptian'
                              CHECK (dialect IN ('egyptian', 'msa_simple')),
  tone                      TEXT NOT NULL DEFAULT 'direct'
                              CHECK (tone IN ('direct', 'warm', 'calm')),
  default_duration_seconds  INTEGER NOT NULL DEFAULT 45
                              CHECK (default_duration_seconds BETWEEN 10 AND 300),
  default_cta_type          TEXT NOT NULL DEFAULT 'soft'
                              CHECK (default_cta_type IN ('none', 'soft', 'consult')),
  signature_phrases         TEXT NOT NULL DEFAULT '',
  avoid_phrases             TEXT NOT NULL DEFAULT '',
  style_samples             TEXT NOT NULL DEFAULT '',
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- تصنيفات نفسية قابلة للتوسعة من الواجهة دون تعديل الكود
CREATE TABLE topic_categories (
  slug       TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- موضوعات مرتبطة بتصنيف (مكتبة الموضوعات)
CREATE TABLE topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL REFERENCES topic_categories(slug) ON UPDATE CASCADE,
  title       TEXT NOT NULL CHECK (char_length(title) BETWEEN 2 AND 200),
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, title)
);
CREATE INDEX topics_category_idx ON topics (category);

CREATE TABLE scripts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id          UUID REFERENCES topics(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  input_text        TEXT NOT NULL,           -- الموضوع أو الموقف أو سؤال المتابع كما أدخله المستخدم
  input_kind        TEXT NOT NULL DEFAULT 'topic'
                      CHECK (input_kind IN ('topic', 'question', 'situation')),
  mode              TEXT NOT NULL,           -- ريلز انتشار / توعوي / ... (مفتاح المود)
  goal              TEXT NOT NULL CHECK (goal IN ('reach', 'awareness', 'trust', 'engagement', 'consult')),
  duration_seconds  INTEGER NOT NULL CHECK (duration_seconds BETWEEN 10 AND 300),
  dialect           TEXT NOT NULL DEFAULT 'egyptian',
  cta_type          TEXT NOT NULL DEFAULT 'soft' CHECK (cta_type IN ('none', 'soft', 'consult')),
  psych_category    TEXT NOT NULL DEFAULT '',
  angle             TEXT NOT NULL DEFAULT '',
  chosen_hook       TEXT NOT NULL DEFAULT '',
  full_text         TEXT NOT NULL DEFAULT '',  -- النص المنطوق النهائي الكامل
  content           JSONB NOT NULL DEFAULT '{}'::jsonb, -- المخرجات الكاملة للنسخة الحالية
  quality_score     INTEGER CHECK (quality_score BETWEEN 0 AND 100),
  quality_warnings  JSONB NOT NULL DEFAULT '[]'::jsonb,
  status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'approved', 'scheduled', 'published')),
  platform          TEXT CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'youtube')),
  current_version   INTEGER NOT NULL DEFAULT 1,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX scripts_user_created_idx ON scripts (user_id, created_at DESC);
CREATE INDEX scripts_user_status_idx ON scripts (user_id, status);

-- سجل الإصدارات: لا نحذف أي نسخة سابقة
CREATE TABLE script_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id       UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  version_number  INTEGER NOT NULL CHECK (version_number >= 1),
  content         JSONB NOT NULL,
  full_text       TEXT NOT NULL,
  instruction     TEXT,                      -- تعليمة التعديل التي أنتجت هذه النسخة (إن وُجدت)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (script_id, version_number)
);

CREATE TABLE script_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id   UUID NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  note        TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX script_feedback_script_idx ON script_feedback (script_id, created_at DESC);

CREATE TABLE content_calendar (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  script_id     UUID REFERENCES scripts(id) ON DELETE SET NULL,
  planned_date  DATE NOT NULL,
  platform      TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'facebook', 'youtube')),
  pillar        TEXT NOT NULL DEFAULT 'awareness'
                  CHECK (pillar IN ('awareness', 'reach', 'trust', 'engagement', 'consult')),
  note          TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'published', 'skipped')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX content_calendar_user_date_idx ON content_calendar (user_id, planned_date);
