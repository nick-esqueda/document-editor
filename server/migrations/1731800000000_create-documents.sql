-- Up Migration

CREATE TABLE documents (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Untitled document' CHECK (char_length(title) BETWEEN 1 AND 200),
  content    jsonb NOT NULL,
  version    integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_owner_updated_idx ON documents (owner_id, updated_at DESC);

-- Down Migration

DROP TABLE documents;
