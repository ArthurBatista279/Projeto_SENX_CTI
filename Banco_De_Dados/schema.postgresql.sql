BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS equipe (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(120) NOT NULL, descricao text,
 ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS usuario (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), equipe_id uuid REFERENCES equipe(id) ON DELETE SET NULL,
 nome varchar(160) NOT NULL, email varchar(254) NOT NULL UNIQUE, senha_hash text NOT NULL,
 perfil varchar(30) NOT NULL CHECK (perfil IN ('administrador','gestor','supervisor','atendente')),
 ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dados_cliente (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), identificador_externo varchar(120), nome varchar(160), telefone varchar(40),
 metadados jsonb NOT NULL DEFAULT '{}'::jsonb, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ligacao (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid REFERENCES usuario(id) ON DELETE SET NULL,
 cliente_id uuid REFERENCES dados_cliente(id) ON DELETE SET NULL, identificador_pabx varchar(160) UNIQUE,
 iniciada_em timestamptz NOT NULL, duracao_segundos integer CHECK (duracao_segundos IS NULL OR duracao_segundos >= 0),
 direcao varchar(20) CHECK (direcao IS NULL OR direcao IN ('entrada','saida')),
 status_processamento varchar(30) NOT NULL DEFAULT 'recebida' CHECK (status_processamento IN ('recebida','processando','concluida','falhou')),
 caminho_audio text, transcricao text, criado_em timestamptz NOT NULL DEFAULT now(), atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS assunto (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(120) NOT NULL UNIQUE, ativo boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS ligacao_assunto (
 ligacao_id uuid NOT NULL REFERENCES ligacao(id) ON DELETE CASCADE, assunto_id uuid NOT NULL REFERENCES assunto(id) ON DELETE RESTRICT,
 confianca numeric(5,4) CHECK (confianca IS NULL OR confianca BETWEEN 0 AND 1), PRIMARY KEY (ligacao_id, assunto_id)
);
CREATE TABLE IF NOT EXISTS analise (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ligacao_id uuid NOT NULL REFERENCES ligacao(id) ON DELETE CASCADE,
 provedor_ia varchar(80) NOT NULL, modelo_ia varchar(120), resumo text, criticidade varchar(30), sentimento varchar(40),
 dados jsonb NOT NULL DEFAULT '{}'::jsonb, criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS alerta (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), analise_id uuid NOT NULL REFERENCES analise(id) ON DELETE CASCADE,
 tipo varchar(80) NOT NULL, descricao text NOT NULL, resolvido boolean NOT NULL DEFAULT false,
 resolvido_por uuid REFERENCES usuario(id) ON DELETE SET NULL, resolvido_em timestamptz, criado_em timestamptz NOT NULL DEFAULT now(),
 CHECK ((resolvido = false AND resolvido_em IS NULL) OR resolvido = true)
);
CREATE TABLE IF NOT EXISTS registro (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid REFERENCES usuario(id) ON DELETE SET NULL,
 entidade varchar(80) NOT NULL, entidade_id uuid, acao varchar(80) NOT NULL, dados jsonb NOT NULL DEFAULT '{}'::jsonb,
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS criterio (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome varchar(140) NOT NULL, descricao text,
 peso numeric(7,4) NOT NULL DEFAULT 1 CHECK (peso >= 0), ativo boolean NOT NULL DEFAULT true, criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS resultado (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), analise_id uuid NOT NULL REFERENCES analise(id) ON DELETE CASCADE,
 criterio_id uuid NOT NULL REFERENCES criterio(id) ON DELETE RESTRICT, nota numeric(7,4) NOT NULL, justificativa text,
 criado_em timestamptz NOT NULL DEFAULT now(), UNIQUE (analise_id, criterio_id)
);
CREATE TABLE IF NOT EXISTS compromisso (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), analise_id uuid NOT NULL REFERENCES analise(id) ON DELETE CASCADE,
 descricao text NOT NULL, responsavel varchar(160), prazo timestamptz,
 estado varchar(30) NOT NULL DEFAULT 'identificado' CHECK (estado IN ('identificado','confirmado','descartado')),
 criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_ligacao_usuario_iniciada ON ligacao(usuario_id, iniciada_em DESC);
CREATE INDEX IF NOT EXISTS ix_ligacao_status ON ligacao(status_processamento);
CREATE INDEX IF NOT EXISTS ix_analise_ligacao ON analise(ligacao_id);
CREATE INDEX IF NOT EXISTS ix_alerta_aberto ON alerta(resolvido, criado_em DESC);
CREATE INDEX IF NOT EXISTS ix_registro_entidade ON registro(entidade, entidade_id, criado_em DESC);
COMMIT;
