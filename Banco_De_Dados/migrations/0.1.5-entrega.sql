\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE public."Usuario" ADD COLUMN IF NOT EXISTS "Ativo" boolean NOT NULL DEFAULT true;
ALTER TABLE public."Usuario" ADD COLUMN IF NOT EXISTS "VersaoAcesso" uuid NOT NULL DEFAULT gen_random_uuid();
CREATE TABLE IF NOT EXISTS public."RevisaoHumana" (
 "IdAnalise" uuid PRIMARY KEY REFERENCES public."Analise"("IdAnalise"),
 "IdRevisor" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario"),
 "Resumo" text NOT NULL,
 "Score" integer CHECK ("Score" BETWEEN 0 AND 100),
 "Validado" boolean NOT NULL DEFAULT false,
 "Revisao" uuid NOT NULL,
 "AtualizadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public."Relatorio" (
 "IdRelatorio" uuid PRIMARY KEY,
 "IdAutor" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario"),
 "Titulo" varchar(200) NOT NULL,
 "Categoria" varchar(30) NOT NULL,
 "IdEquipe" uuid REFERENCES public."Equipe"("IdEquipe"),
 "CriadoEm" timestamptz NOT NULL DEFAULT now(),
 "Conteudo" jsonb NOT NULL
);
COMMIT;
