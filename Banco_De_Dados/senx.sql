--
-- PostgreSQL database dump
--

\restrict 7S2eqehHb4WZ2aQgapm0w1mOOgmQ2SHnut8ss0XWgPp8xhZ2upH4HFht140BHfi

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

-- Started on 2026-10-23 16:17:57

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
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
-- TOC entry 228 (class 1259 OID 16572)
-- Name: Alerta; Type: TABLE; Schema: public; Owner: senx_app
--

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


ALTER TABLE public."Alerta" OWNER TO senx_app;

--
-- TOC entry 226 (class 1259 OID 16529)
-- Name: Analise; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Analise" (
    "IdAnalise" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdLigacao" uuid NOT NULL,
    "Data_Analise" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "ResolucaoEncaminhamento" character varying(255) NOT NULL,
    "StatusProcessamento" boolean,
    "Modelo_Versao" character varying(200) NOT NULL,
    "Transcricao_Texto" text NOT NULL,
    "Resumo_Texto" text NOT NULL,
    "Cancelamento" boolean NOT NULL,
    "Oportunidade" boolean NOT NULL,
    "ScoreGeral" integer NOT NULL,
    "ProblemaNecessidade" character varying(255) NOT NULL,
    "Compromissos" character varying(255) NOT NULL
);


ALTER TABLE public."Analise" OWNER TO senx_app;

--
-- TOC entry 220 (class 1259 OID 16421)
-- Name: Assunto; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Assunto" (
    "IdAssunto" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "Categoria" character varying(255) NOT NULL
);


ALTER TABLE public."Assunto" OWNER TO senx_app;

--
-- TOC entry 221 (class 1259 OID 16433)
-- Name: Criterio; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Criterio" (
    "IdCriterio" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "RegraAvaliacao" character varying(255) NOT NULL,
    "Versao" character varying(255) NOT NULL,
    "Ativo" boolean NOT NULL
);


ALTER TABLE public."Criterio" OWNER TO senx_app;

--
-- TOC entry 224 (class 1259 OID 16478)
-- Name: DadosCliente; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."DadosCliente" (
    "IdDadosCliente" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdUsuario" uuid NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Email" character varying(255) NOT NULL,
    "Telefone" character varying(11) NOT NULL,
    "Situacao" character varying(255) NOT NULL,
    "Consentimento" boolean NOT NULL
);


ALTER TABLE public."DadosCliente" OWNER TO senx_app;

--
-- TOC entry 222 (class 1259 OID 16447)
-- Name: Equipe; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Equipe" (
    "IdEquipe" uuid DEFAULT gen_random_uuid() NOT NULL,
    "Nome" character varying(255) NOT NULL,
    "Departamento" character varying(255) CONSTRAINT "Equipe_Departameo_not_null" NOT NULL
);


ALTER TABLE public."Equipe" OWNER TO senx_app;

--
-- TOC entry 225 (class 1259 OID 16498)
-- Name: Ligacao; Type: TABLE; Schema: public; Owner: senx_app
--

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


ALTER TABLE public."Ligacao" OWNER TO senx_app;

--
-- TOC entry 227 (class 1259 OID 16555)
-- Name: LigacaoAssunto; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."LigacaoAssunto" (
    "IdLigacao" uuid NOT NULL,
    "IdAssunto" uuid NOT NULL
);


ALTER TABLE public."LigacaoAssunto" OWNER TO senx_app;

--
-- TOC entry 229 (class 1259 OID 16613)
-- Name: Registro; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Registro" (
    "IdRegistro" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdAnalise" uuid NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "Descricao" character varying(255) NOT NULL,
    "Prazo" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "Status" character varying(255) NOT NULL
);


ALTER TABLE public."Registro" OWNER TO senx_app;

--
-- TOC entry 230 (class 1259 OID 16638)
-- Name: Resultado; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Resultado" (
    "IdResultado" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdCriterio" uuid NOT NULL,
    "IdAnalise" uuid NOT NULL,
    "IdFuncionario" uuid NOT NULL,
    "Classificacao" character varying(255) NOT NULL,
    "Score" integer NOT NULL,
    "Justificativa" character varying(255) NOT NULL,
    "TrechoEvidencia" character varying(255) NOT NULL,
    "ResultadoValidado" character varying(255) NOT NULL,
    "StatusValidacao" character varying(255) NOT NULL,
    "Validado_em" timestamp without time zone DEFAULT timezone('UTC'::text, now()) NOT NULL,
    "ObservacaoValidacao" character varying(255) NOT NULL
);


ALTER TABLE public."Resultado" OWNER TO senx_app;

--
-- TOC entry 223 (class 1259 OID 16458)
-- Name: Usuario; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."Usuario" (
    "IdUsuario" uuid DEFAULT gen_random_uuid() NOT NULL,
    "IdEquipe" uuid NOT NULL,
    "Nome" character varying(200) NOT NULL,
    "Email" character varying(255) NOT NULL,
    "Imagem" character varying(255) NOT NULL,
    "Cargo" character varying(255) NOT NULL,
    "Senha" character varying(40) NOT NULL
);


ALTER TABLE public."Usuario" OWNER TO senx_app;

--
-- TOC entry 219 (class 1259 OID 16414)
-- Name: __EFMigrationsHistory; Type: TABLE; Schema: public; Owner: senx_app
--

CREATE TABLE public."__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL
);


ALTER TABLE public."__EFMigrationsHistory" OWNER TO senx_app;

--
-- TOC entry 5128 (class 0 OID 16572)
-- Dependencies: 228
-- Data for Name: Alerta; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Alerta" ("IdAlerta", "IdAnalise", "IdEquipe", "IdFuncionario", "Tipo", "Severidade", "Mensagem", "StatusTratamento", "Status_Validacao", "Validado_em", "Observacao", "Criado_em", "Resolvido_em", "Justificativa", "TrechoEvidencia") FROM stdin;
\.


--
-- TOC entry 5126 (class 0 OID 16529)
-- Dependencies: 226
-- Data for Name: Analise; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Analise" ("IdAnalise", "IdLigacao", "Data_Analise", "ResolucaoEncaminhamento", "StatusProcessamento", "Modelo_Versao", "Transcricao_Texto", "Resumo_Texto", "Cancelamento", "Oportunidade", "ScoreGeral", "ProblemaNecessidade", "Compromissos") FROM stdin;
\.


--
-- TOC entry 5120 (class 0 OID 16421)
-- Dependencies: 220
-- Data for Name: Assunto; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Assunto" ("IdAssunto", "Nome", "Descricao", "Categoria") FROM stdin;
\.


--
-- TOC entry 5121 (class 0 OID 16433)
-- Dependencies: 221
-- Data for Name: Criterio; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Criterio" ("IdCriterio", "Nome", "Descricao", "RegraAvaliacao", "Versao", "Ativo") FROM stdin;
\.


--
-- TOC entry 5124 (class 0 OID 16478)
-- Dependencies: 224
-- Data for Name: DadosCliente; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."DadosCliente" ("IdDadosCliente", "IdUsuario", "Nome", "Email", "Telefone", "Situacao", "Consentimento") FROM stdin;
\.


--
-- TOC entry 5122 (class 0 OID 16447)
-- Dependencies: 222
-- Data for Name: Equipe; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Equipe" ("IdEquipe", "Nome", "Departamento") FROM stdin;
\.


--
-- TOC entry 5125 (class 0 OID 16498)
-- Dependencies: 225
-- Data for Name: Ligacao; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Ligacao" ("IdLigacao", "IdFuncionario", "IdCliente", "Data_Inicio", "Duracao", "Numero_Origem", "Numero_Destino", "Stats", "Hash_Audio", "Caminho_Arquivo", "IdentificadorPABX", "Direcao") FROM stdin;
\.


--
-- TOC entry 5127 (class 0 OID 16555)
-- Dependencies: 227
-- Data for Name: LigacaoAssunto; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."LigacaoAssunto" ("IdLigacao", "IdAssunto") FROM stdin;
\.


--
-- TOC entry 5129 (class 0 OID 16613)
-- Dependencies: 229
-- Data for Name: Registro; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Registro" ("IdRegistro", "IdAnalise", "IdFuncionario", "Descricao", "Prazo", "Status") FROM stdin;
\.


--
-- TOC entry 5130 (class 0 OID 16638)
-- Dependencies: 230
-- Data for Name: Resultado; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Resultado" ("IdResultado", "IdCriterio", "IdAnalise", "IdFuncionario", "Classificacao", "Score", "Justificativa", "TrechoEvidencia", "ResultadoValidado", "StatusValidacao", "Validado_em", "ObservacaoValidacao") FROM stdin;
\.


--
-- TOC entry 5123 (class 0 OID 16458)
-- Dependencies: 223
-- Data for Name: Usuario; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."Usuario" ("IdUsuario", "IdEquipe", "Nome", "Email", "Imagem", "Cargo", "Senha") FROM stdin;
\.


--
-- TOC entry 5119 (class 0 OID 16414)
-- Dependencies: 219
-- Data for Name: __EFMigrationsHistory; Type: TABLE DATA; Schema: public; Owner: senx_app
--

COPY public."__EFMigrationsHistory" ("MigrationId", "ProductVersion") FROM stdin;
20261023183225_CriacaoInicial	10.0.13
20261023184017_RenomearDepartamento	10.0.13
\.


--
-- TOC entry 4947 (class 2606 OID 16597)
-- Name: Alerta PK_Alerta; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "PK_Alerta" PRIMARY KEY ("IdAlerta");


--
-- TOC entry 4939 (class 2606 OID 16549)
-- Name: Analise PK_Analise; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Analise"
    ADD CONSTRAINT "PK_Analise" PRIMARY KEY ("IdAnalise");


--
-- TOC entry 4919 (class 2606 OID 16432)
-- Name: Assunto PK_Assunto; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Assunto"
    ADD CONSTRAINT "PK_Assunto" PRIMARY KEY ("IdAssunto");


--
-- TOC entry 4921 (class 2606 OID 16446)
-- Name: Criterio PK_Criterio; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Criterio"
    ADD CONSTRAINT "PK_Criterio" PRIMARY KEY ("IdCriterio");


--
-- TOC entry 4932 (class 2606 OID 16492)
-- Name: DadosCliente PK_DadosCliente; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."DadosCliente"
    ADD CONSTRAINT "PK_DadosCliente" PRIMARY KEY ("IdDadosCliente");


--
-- TOC entry 4923 (class 2606 OID 16457)
-- Name: Equipe PK_Equipe; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Equipe"
    ADD CONSTRAINT "PK_Equipe" PRIMARY KEY ("IdEquipe");


--
-- TOC entry 4936 (class 2606 OID 16518)
-- Name: Ligacao PK_Ligacao; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "PK_Ligacao" PRIMARY KEY ("IdLigacao");


--
-- TOC entry 4942 (class 2606 OID 16561)
-- Name: LigacaoAssunto PK_LigacaoAssunto; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "PK_LigacaoAssunto" PRIMARY KEY ("IdLigacao", "IdAssunto");


--
-- TOC entry 4951 (class 2606 OID 16627)
-- Name: Registro PK_Registro; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "PK_Registro" PRIMARY KEY ("IdRegistro");


--
-- TOC entry 4956 (class 2606 OID 16658)
-- Name: Resultado PK_Resultado; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "PK_Resultado" PRIMARY KEY ("IdResultado");


--
-- TOC entry 4927 (class 2606 OID 16472)
-- Name: Usuario PK_Usuario; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "PK_Usuario" PRIMARY KEY ("IdUsuario");


--
-- TOC entry 4917 (class 2606 OID 16420)
-- Name: __EFMigrationsHistory PK___EFMigrationsHistory; Type: CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."__EFMigrationsHistory"
    ADD CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId");


--
-- TOC entry 4943 (class 1259 OID 16674)
-- Name: IX_Alerta_IdAnalise; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Alerta_IdAnalise" ON public."Alerta" USING btree ("IdAnalise");


--
-- TOC entry 4944 (class 1259 OID 16675)
-- Name: IX_Alerta_IdEquipe; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Alerta_IdEquipe" ON public."Alerta" USING btree ("IdEquipe");


--
-- TOC entry 4945 (class 1259 OID 16676)
-- Name: IX_Alerta_IdFuncionario; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Alerta_IdFuncionario" ON public."Alerta" USING btree ("IdFuncionario");


--
-- TOC entry 4937 (class 1259 OID 16677)
-- Name: IX_Analise_IdLigacao; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Analise_IdLigacao" ON public."Analise" USING btree ("IdLigacao");


--
-- TOC entry 4928 (class 1259 OID 16678)
-- Name: IX_DadosCliente_Email; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE UNIQUE INDEX "IX_DadosCliente_Email" ON public."DadosCliente" USING btree ("Email");


--
-- TOC entry 4929 (class 1259 OID 16679)
-- Name: IX_DadosCliente_IdUsuario; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_DadosCliente_IdUsuario" ON public."DadosCliente" USING btree ("IdUsuario");


--
-- TOC entry 4930 (class 1259 OID 16680)
-- Name: IX_DadosCliente_Telefone; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE UNIQUE INDEX "IX_DadosCliente_Telefone" ON public."DadosCliente" USING btree ("Telefone");


--
-- TOC entry 4940 (class 1259 OID 16683)
-- Name: IX_LigacaoAssunto_IdAssunto; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_LigacaoAssunto_IdAssunto" ON public."LigacaoAssunto" USING btree ("IdAssunto");


--
-- TOC entry 4933 (class 1259 OID 16681)
-- Name: IX_Ligacao_IdCliente; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Ligacao_IdCliente" ON public."Ligacao" USING btree ("IdCliente");


--
-- TOC entry 4934 (class 1259 OID 16682)
-- Name: IX_Ligacao_IdFuncionario; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Ligacao_IdFuncionario" ON public."Ligacao" USING btree ("IdFuncionario");


--
-- TOC entry 4948 (class 1259 OID 16684)
-- Name: IX_Registro_IdAnalise; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Registro_IdAnalise" ON public."Registro" USING btree ("IdAnalise");


--
-- TOC entry 4949 (class 1259 OID 16685)
-- Name: IX_Registro_IdFuncionario; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Registro_IdFuncionario" ON public."Registro" USING btree ("IdFuncionario");


--
-- TOC entry 4952 (class 1259 OID 16686)
-- Name: IX_Resultado_IdAnalise; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Resultado_IdAnalise" ON public."Resultado" USING btree ("IdAnalise");


--
-- TOC entry 4953 (class 1259 OID 16687)
-- Name: IX_Resultado_IdCriterio; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Resultado_IdCriterio" ON public."Resultado" USING btree ("IdCriterio");


--
-- TOC entry 4954 (class 1259 OID 16688)
-- Name: IX_Resultado_IdFuncionario; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Resultado_IdFuncionario" ON public."Resultado" USING btree ("IdFuncionario");


--
-- TOC entry 4924 (class 1259 OID 16689)
-- Name: IX_Usuario_Email; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE UNIQUE INDEX "IX_Usuario_Email" ON public."Usuario" USING btree ("Email");


--
-- TOC entry 4925 (class 1259 OID 16690)
-- Name: IX_Usuario_IdEquipe; Type: INDEX; Schema: public; Owner: senx_app
--

CREATE INDEX "IX_Usuario_IdEquipe" ON public."Usuario" USING btree ("IdEquipe");


--
-- TOC entry 4964 (class 2606 OID 16598)
-- Name: Alerta FK_Alerta_Analise_IdAnalise; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");


--
-- TOC entry 4965 (class 2606 OID 16603)
-- Name: Alerta FK_Alerta_Equipe_IdEquipe; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Equipe_IdEquipe" FOREIGN KEY ("IdEquipe") REFERENCES public."Equipe"("IdEquipe");


--
-- TOC entry 4966 (class 2606 OID 16608)
-- Name: Alerta FK_Alerta_Usuario_IdFuncionario; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Alerta"
    ADD CONSTRAINT "FK_Alerta_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");


--
-- TOC entry 4961 (class 2606 OID 16550)
-- Name: Analise FK_Analise_Ligacao_IdLigacao; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Analise"
    ADD CONSTRAINT "FK_Analise_Ligacao_IdLigacao" FOREIGN KEY ("IdLigacao") REFERENCES public."Ligacao"("IdLigacao");


--
-- TOC entry 4958 (class 2606 OID 16493)
-- Name: DadosCliente FK_DadosCliente_Usuario_IdUsuario; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."DadosCliente"
    ADD CONSTRAINT "FK_DadosCliente_Usuario_IdUsuario" FOREIGN KEY ("IdUsuario") REFERENCES public."Usuario"("IdUsuario");


--
-- TOC entry 4962 (class 2606 OID 16562)
-- Name: LigacaoAssunto FK_LigacaoAssunto_Assunto_IdAssunto; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "FK_LigacaoAssunto_Assunto_IdAssunto" FOREIGN KEY ("IdAssunto") REFERENCES public."Assunto"("IdAssunto");


--
-- TOC entry 4963 (class 2606 OID 16567)
-- Name: LigacaoAssunto FK_LigacaoAssunto_Ligacao_IdLigacao; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."LigacaoAssunto"
    ADD CONSTRAINT "FK_LigacaoAssunto_Ligacao_IdLigacao" FOREIGN KEY ("IdLigacao") REFERENCES public."Ligacao"("IdLigacao");


--
-- TOC entry 4959 (class 2606 OID 16519)
-- Name: Ligacao FK_Ligacao_DadosCliente_IdCliente; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "FK_Ligacao_DadosCliente_IdCliente" FOREIGN KEY ("IdCliente") REFERENCES public."DadosCliente"("IdDadosCliente");


--
-- TOC entry 4960 (class 2606 OID 16524)
-- Name: Ligacao FK_Ligacao_Usuario_IdFuncionario; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Ligacao"
    ADD CONSTRAINT "FK_Ligacao_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");


--
-- TOC entry 4967 (class 2606 OID 16628)
-- Name: Registro FK_Registro_Analise_IdAnalise; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "FK_Registro_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");


--
-- TOC entry 4968 (class 2606 OID 16633)
-- Name: Registro FK_Registro_Usuario_IdFuncionario; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Registro"
    ADD CONSTRAINT "FK_Registro_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");


--
-- TOC entry 4969 (class 2606 OID 16659)
-- Name: Resultado FK_Resultado_Analise_IdAnalise; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Analise_IdAnalise" FOREIGN KEY ("IdAnalise") REFERENCES public."Analise"("IdAnalise");


--
-- TOC entry 4970 (class 2606 OID 16664)
-- Name: Resultado FK_Resultado_Criterio_IdCriterio; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Criterio_IdCriterio" FOREIGN KEY ("IdCriterio") REFERENCES public."Criterio"("IdCriterio");


--
-- TOC entry 4971 (class 2606 OID 16669)
-- Name: Resultado FK_Resultado_Usuario_IdFuncionario; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Resultado"
    ADD CONSTRAINT "FK_Resultado_Usuario_IdFuncionario" FOREIGN KEY ("IdFuncionario") REFERENCES public."Usuario"("IdUsuario");


--
-- TOC entry 4957 (class 2606 OID 16473)
-- Name: Usuario FK_Usuario_Equipe_IdEquipe; Type: FK CONSTRAINT; Schema: public; Owner: senx_app
--

ALTER TABLE ONLY public."Usuario"
    ADD CONSTRAINT "FK_Usuario_Equipe_IdEquipe" FOREIGN KEY ("IdEquipe") REFERENCES public."Equipe"("IdEquipe");


-- Completed on 2026-10-23 16:17:58

--
-- PostgreSQL database dump complete
--

\unrestrict 7S2eqehHb4WZ2aQgapm0w1mOOgmQ2SHnut8ss0XWgPp8xhZ2upH4HFht140BHfi

