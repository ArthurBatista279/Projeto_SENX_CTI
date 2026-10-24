-- Executar com psql, após backup. A migração não cria contas nem altera senhas existentes.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."Usuario" ALTER COLUMN "Senha" TYPE text;
ALTER TABLE public."Usuario" ADD COLUMN IF NOT EXISTS "Perfil" varchar(20) NOT NULL DEFAULT 'Colaborador';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='Usuario_Perfil_check' AND conrelid='public."Usuario"'::regclass) THEN
    ALTER TABLE public."Usuario" ADD CONSTRAINT "Usuario_Perfil_check" CHECK ("Perfil" IN ('Administrador','Colaborador'));
  END IF;
END $$;
-- Se houver duplicidade, toda a migração é revertida e nenhum cadastro é removido.
CREATE UNIQUE INDEX IF NOT EXISTS "Usuario_Email_normalizado_uq" ON public."Usuario" (lower(btrim("Email")));
COMMIT;
