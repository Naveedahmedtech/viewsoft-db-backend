-- Seed sample annotations with string created_by / updated_by values.
-- Assumes public.annotation already has created_by/updated_by as varchar(255).

INSERT INTO public.annotation (proj_id, doc_id, data, created_by, updated_by, is_deleted)
VALUES
  (1, 'doc-collab-1', '{"message":"Seed annotation from collab 1"}', 'collab', 'collab', false),
  (1, 'doc-collab-2', '{"message":"Seed annotation from collab 2"}', 'collab', 'collab', false);

