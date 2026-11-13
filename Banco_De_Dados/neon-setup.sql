-- SENX CTI 1.0.0.0 — schema consolidado para banco vazio; nao e migracao incremental.
-- psql -X --single-transaction -v ON_ERROR_STOP=1 -f senx-1.0.0-limpo.sql
-- SENX_ADMIN_HASH deve conter BCrypt (custo >= 12); nunca ha senha padrao no codigo.

CREATE TABLE public."Alerta" (
    "IdAlerta" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdAnalise" uuid NOT NULL,
    "IdEquipe" uuid NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "Tipo" character varying(255) NOT NULL,
    "Severidade" character varying(255) NOT NULL,
    "Mensagem" character varying(255) NOT NULL,
    "StatusTratamento" boolean NOT NULL,
    "Status_Validacao" boolean NOT NULL,
    "Validado_em" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Observacao" character varying(255) NOT NULL,
    "Criado_em" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Resolvido_em" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Justificativa" text NOT NULL,
    "TrechoEvidencia" character varying(255) NOT NULL
);

CREATE TABLE public."Analise" (
    "IdAnalise" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdLigacao" uuid NOT NULL,
    "Data_Analise" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "ResolucaoEncaminhamento" character varying(255) NOT NULL,
    "StatusProcessamento" boolean,
    "Modelo_Versao" character varying(200) NOT NULL,
    "Transcricao_Texto" text NOT NULL,
    "Resumo_Texto" text NOT NULL,
    "Prioridade" smallint CHECK ("Prioridade" BETWEEN 0 AND 2),
    "MotivoPrioridade" character varying(255),
    "Cancelamento" boolean NOT NULL,
    "Oportunidade" boolean NOT NULL,
    "ScoreGeral" integer NOT NULL CHECK ("ScoreGeral" BETWEEN 0 AND 100),
    "ProblemaNecessidade" character varying(255) NOT NULL,
    "Compromissos" character varying(255) NOT NULL
);

CREATE TABLE public."Assunto" (
    "IdAssunto" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "Categoria" character varying(255) NOT NULL
);

CREATE TABLE public."Criterio" (
    "IdCriterio" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "RegraAvaliacao" character varying(255) NOT NULL,
    "Versao" character varying(255) NOT NULL,
    "Ativo" boolean NOT NULL
);

CREATE TABLE public."DadosCliente" (
    "IdDadosCliente" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdUsuario" uuid NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Email" character varying(255) NOT NULL,
    "Telefone" character varying(11) NOT NULL,
    "Situacao" character varying(255) NOT NULL,
    "Consentimento" boolean NOT NULL
);

CREATE TABLE public."Equipe" (
    "IdEquipe" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Departamento" character varying(255) CONSTRAINT "Equipe_Departameo_not_null" NOT NULL
);

CREATE TABLE public."Ligacao" (
    "IdLigacao" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "IdCliente" uuid NOT NULL,
    "Data_Inicio" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Duracao" time without time zone NOT NULL,
    "Numero_Origem" character varying(11) NOT NULL,
    "Numero_Destino" character varying(11) NOT NULL,
    "Stats" character varying(255) NOT NULL,
    "Hash_Audio" character varying(255) NOT NULL,
    "Caminho_Arquivo" character varying(255) NOT NULL,
    "IdentificadorPABX" character varying(255) NOT NULL,
    "Direcao" character varying(255) NOT NULL
);

CREATE TABLE public."LigacaoAssunto" (
    "IdLigacao" uuid NOT NULL,
    "IdAssunto" uuid NOT NULL
);

CREATE TABLE public."Registro" (
    "IdRegistro" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdAnalise" uuid NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "Prazo" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Status" character varying(255) NOT NULL
);

CREATE TABLE public."Resultado" (
    "IdResultado" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdCriterio" uuid NOT NULL,
    "IdAnalise" uuid NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "Classificacao" character varying(255) NOT NULL,
    "Score" integer NOT NULL CHECK ("Score" BETWEEN 0 AND 100),
    "Justificativa" character varying(255) NOT NULL,
    "TrechoEvidencia" character varying(255) NOT NULL,
    "ResultadoValidado" character varying(255) NOT NULL,
    "StatusValidacao" character varying(255) NOT NULL,
    "Validado_em" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "ObservacaoValidacao" character varying(255) NOT NULL
);

CREATE TABLE public."Usuario" (
    "IdUsuario" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdEquipe" uuid NOT NULL,
    "Nome" character varying(200) NOT NULL,
    "Email" character varying(255) NOT NULL,
    "Imagem" character varying(255) NOT NULL,
    "Cargo" character varying(255) NOT NULL,
    "Senha" text NOT NULL,
    "Perfil" varchar(20) NOT NULL DEFAULT 'Colaborador' CHECK ("Perfil" IN ('Administrador','Colaborador')),
    "Ativo" boolean NOT NULL DEFAULT true,
    "VersaoAcesso" uuid NOT NULL DEFAULT gen_random_uuid()
);

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "PK_Alerta" PRIMARY KEY ("IdAlerta");

ALTER TABLE ONLY public."Analise"
    ADD CONSTRAINT "PK_Analise" PRIMARY KEY ("IdAnalise");

ALTER TABLE ONLY public."Assunto"
    ADD CONSTRAINT "PK_Assunto" PRIMARY KEY ("IdAssunto");

ALTER TABLE ONLY public."Criterio"
    ADD CONSTRAINT "PK_Criterio" PRIMARY KEY ("IdCriterio");

ALTER TABLE ONLY public."DadosCliente"
    ADD CONSTRAINT "PK_DadosCliente" PRIMARY KEY ("IdDadosCliente");

ALTER TABLE ONLY public."Equipe"
    ADD CONSTRAINT "PK_Equipe" PRIMARY KEY ("IdEquipe");

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "PK_Ligacao" PRIMARY KEY ("IdLigacao");

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "PK_LigacaoAssunto" PRIMARY KEY ("IdLigacao", "IdAssunto");

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "PK_Registro" PRIMARY KEY ("IdRegistro");

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "PK_Resultado" PRIMARY KEY ("IdResultado");

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "PK_Usuario" PRIMARY KEY ("IdUsuario");

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Equipe_IdEquipe" FOREIGN KEY ("IdEquipe") REFERENCES public."Equipe"("IdEquipe");

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");

ALTER TABLE ONLY public."Analise"
    ADD CONSTRAINT "FK_Analise_Ligacao_IdLigacao" FOREIGN KEY ("IdLigacao") REFERENCES public."Ligacao"("IdLigacao");

ALTER TABLE ONLY public."DadosCliente"
    ADD CONSTRAINT "FK_DadosCliente_Usuario_IdUsuario" FOREIGN KEY ("IdUsuario") REFERENCES public."Usuario"("IdUsuario");

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "FK_LigacaoAssunto_Assunto_IdAssunto" FOREIGN KEY ("IdAssunto") REFERENCES public."Assunto"("IdAssunto");

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "FK_LigacaoAssunto_Ligacao_IdLigacao" FOREIGN KEY ("IdLigacao") REFERENCES public."Ligacao"("IdLigacao");

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "FK_Ligacao_DadosCliente_IdCliente" FOREIGN KEY ("IdCliente") REFERENCES public."DadosCliente"("IdDadosCliente");

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "FK_Ligacao_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "FK_Registro_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "FK_Registro_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Criterio_IdCriterio" FOREIGN KEY ("IdCriterio") REFERENCES public."Criterio"("IdCriterio");

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "FK_Usuario_Equipe_IdEquipe" FOREIGN KEY ("IdEquipe") REFERENCES public."Equipe"("IdEquipe");

CREATE INDEX "IX_Alerta_IdAnalise" ON public."Alerta" USING btree ("IdAnalise");
CREATE INDEX "IX_Alerta_IdEquipe" ON public."Alerta" USING btree ("IdEquipe");
CREATE INDEX "IX_Alerta_IdFuncionario" ON public."Alerta" USING btree ("IdFuncionario");
CREATE INDEX "IX_Analise_IdLigacao" ON public."Analise" USING btree ("IdLigacao");
CREATE UNIQUE INDEX "IX_DadosCliente_Email" ON public."DadosCliente" USING btree ("Email");
CREATE INDEX "IX_DadosCliente_IdUsuario" ON public."DadosCliente" USING btree ("IdUsuario");
CREATE UNIQUE INDEX "IX_DadosCliente_Telefone" ON public."DadosCliente" USING btree ("Telefone");
CREATE INDEX "IX_LigacaoAssunto_IdAssunto" ON public."LigacaoAssunto" USING btree ("IdAssunto");
CREATE INDEX "IX_Ligacao_IdCliente" ON public."Ligacao" USING btree ("IdCliente");
CREATE INDEX "IX_Ligacao_IdFuncionario" ON public."Ligacao" USING btree ("IdFuncionario");
CREATE INDEX "IX_Registro_IdAnalise" ON public."Registro" USING btree ("IdAnalise");
CREATE INDEX "IX_Registro_IdFuncionario" ON public."Registro" USING btree ("IdFuncionario");
CREATE INDEX "IX_Resultado_IdAnalise" ON public."Resultado" USING btree ("IdAnalise");
CREATE INDEX "IX_Resultado_IdCriterio" ON public."Resultado" USING btree ("IdCriterio");
CREATE INDEX "IX_Resultado_IdFuncionario" ON public."Resultado" USING btree ("IdFuncionario");
CREATE UNIQUE INDEX "IX_Usuario_Email" ON public."Usuario" USING btree ("Email");
CREATE INDEX "IX_Usuario_IdEquipe" ON public."Usuario" USING btree ("IdEquipe");

CREATE UNIQUE INDEX "Usuario_Email_normalizado_uq" ON public."Usuario" (lower(btrim("Email")));
CREATE TABLE public."RevisaoHumana" (
 "IdAnalise" uuid PRIMARY KEY REFERENCES public."Analise"("IdAnalise"),
 "IdRevisor" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario"),
 "Resumo" text NOT NULL,
 "Score" integer CHECK ("Score" BETWEEN 0 AND 100),
 "Validado" boolean NOT NULL DEFAULT false,
 "Revisao" uuid NOT NULL,
 "AtualizadoEm" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public."Relatorio" (
 "IdRelatorio" uuid PRIMARY KEY,
 "IdAutor" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario"),
 "Titulo" varchar(200) NOT NULL,
 "Categoria" varchar(30) NOT NULL,
 "IdEquipe" uuid REFERENCES public."Equipe"("IdEquipe"),
 "CriadoEm" timestamptz NOT NULL DEFAULT now(),
 "Conteudo" jsonb NOT NULL
);
CREATE TABLE public."ClienteUsuario" (
 "IdDadosCliente" uuid NOT NULL REFERENCES public."DadosCliente"("IdDadosCliente") ON DELETE CASCADE,
 "IdUsuario" uuid NOT NULL REFERENCES public."Usuario"("IdUsuario") ON DELETE CASCADE,
 PRIMARY KEY ("IdDadosCliente", "IdUsuario")
);

-- Seed minimo educativo: nenhuma ligacao, transcricao ou pontuacao fabricada.
INSERT INTO public."Equipe" ("IdEquipe","Nome","Departamento")
VALUES ('10000000-0000-4000-8000-000000000001','Equipe de Suporte CTI','Suporte CTI');
INSERT INTO public."Criterio" ("Nome","Descricao","RegraAvaliacao","Versao","Ativo") VALUES
 ('Clareza na Comunicação','Comunicação compreensível e objetiva.','Avaliar clareza das explicações com evidências da transcrição.','1.0.0.0',true),
 ('Resolução do Problema','Identificação da necessidade e encaminhamento.','Avaliar se o problema recebeu solução ou encaminhamento explícito.','1.0.0.0',true),
 ('Cortesia e Empatia','Atendimento respeitoso ao cliente.','Avaliar cortesia e reconhecimento da necessidade sem inferir emoções pelo tom.','1.0.0.0',true);
INSERT INTO public."__EFMigrationsHistory" VALUES
 ('20261023183225_CriacaoInicial','10.0.13'),
 ('20261023184017_RenomearDepartamento','10.0.13');

