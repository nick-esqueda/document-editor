-- Up Migration

CREATE TABLE document_access (
  document_id uuid NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  granted_by  uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, user_id)
);

CREATE INDEX document_access_user_idx ON document_access (user_id);

-- Down Migration

DROP TABLE document_access;
