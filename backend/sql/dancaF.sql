CREATE TABLE TOKEN_RECUPERACAO (
  id_token_recuperacao    int IDENTITY NOT NULL, 
  token                   varchar(255) NOT NULL UNIQUE, 
  data_expiracao          int NULL, 
  usado                   bit NULL, 
  data_criacao            date NOT NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  PRIMARY KEY (id_token_recuperacao));
CREATE TABLE ANO_LETIVO (
  id_ano_letivo int IDENTITY NOT NULL, 
  ano           varchar(20) NOT NULL UNIQUE, 
  PRIMARY KEY (id_ano_letivo));
CREATE TABLE ALUNO (
  id_aluno        int IDENTITY NOT NULL, 
  nome            varchar(255) NOT NULL, 
  data_nascimento date NULL, 
  ativo           bit NOT NULL, 
  data_criacao    date NOT NULL, 
  PRIMARY KEY (id_aluno));
CREATE TABLE MODALIDADE (
  id_modalidade int IDENTITY NOT NULL, 
  nome          varchar(255) NOT NULL UNIQUE, 
  ativo         bit NOT NULL, 
  PRIMARY KEY (id_modalidade));
CREATE TABLE DISPONIBILIDADE_PROFESSOR (
  id_disponibilidade      int IDENTITY NOT NULL, 
  dia_semana              int NOT NULL, 
  hora_inicio             time(7) NOT NULL, 
  hora_fim                time(7) NOT NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  PRIMARY KEY (id_disponibilidade));
CREATE TABLE ENCARREGADO_ALUNO (
  UTILIZADORid_utilizador int NOT NULL, 
  ALUNOid_aluno           int NOT NULL, 
  PRIMARY KEY (UTILIZADORid_utilizador, 
  ALUNOid_aluno));
CREATE TABLE SALA (
  id_sala           int IDENTITY NOT NULL, 
  nome              varchar(255) NOT NULL UNIQUE, 
  capacidade_maxima int NOT NULL, 
  PRIMARY KEY (id_sala));
CREATE TABLE SALA_MODALIDADE (
  MODALIDADEid_modalidade int NOT NULL, 
  SALAid_sala             int NOT NULL, 
  PRIMARY KEY (MODALIDADEid_modalidade, 
  SALAid_sala));
CREATE TABLE PROFESSOR_MODALIDADE (
  UTILIZADORid_utilizador int NOT NULL, 
  MODALIDADEid_modalidade int NOT NULL, 
  PRIMARY KEY (UTILIZADORid_utilizador, 
  MODALIDADEid_modalidade));
CREATE TABLE TABELA_PRECO (
  id_preco                 int IDENTITY NOT NULL, 
  formato_aula             varchar(50) NOT NULL, 
  duracao_minutos          int NOT NULL,  
  dia_semana               int NOT NULL, 
  preco                    decimal(10, 2) NOT NULL, 
  ativo                    bit NOT NULL, 
  PRIMARY KEY (id_preco));
CREATE TABLE PEDIDO_COACHING (
  id_pedido_coaching       int IDENTITY NOT NULL, 
  formato_aula             varchar(50) NOT NULL, 
  duracao_minutos          int NOT NULL, 
  numero_participantes     int NOT NULL, 
  data_pedido              date NOT NULL, 
  data_aula_pretendida     date NOT NULL, 
  hora_inicio_pretendida   time(7) NOT NULL, 
  estado                   varchar(50) NOT NULL, 
  custo_estimado           decimal(10, 2) NULL, 
  UTILIZADORid_utilizador  int NOT NULL, 
  ANO_LETIVOid_ano_letivo  int NOT NULL, 
  MODALIDADEid_modalidade  int NOT NULL, 
  UTILIZADORid_utilizador2 int NULL, 
  PRIMARY KEY (id_pedido_coaching));
CREATE TABLE VALIDACAO_COACHING (
  id_validacao            int IDENTITY NOT NULL, 
  tipo_validador          varchar(50) NOT NULL, 
  estado_validacao        varchar(50) NOT NULL, 
  data_validacao          date NOT NULL, 
  observacoes             varchar(255) NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  COACHINGid_coaching     int NOT NULL, 
  PRIMARY KEY (id_validacao));
CREATE TABLE COACHING (
  id_coaching                       int IDENTITY NOT NULL, 
  formato_aula                      varchar(50) NOT NULL, 
  duracao_minutos                   int NOT NULL, 
  numero_participantes              int NOT NULL, 
  data_aula                         date NOT NULL, 
  hora_inicio                       time(7) NOT NULL, 
  estado                            varchar(50) NOT NULL, 
  UTILIZADORid_utilizador           int NOT NULL, 
  ANO_LETIVOid_ano_letivo           int NOT NULL, 
  MODALIDADEid_modalidade           int NOT NULL, 
  SALAid_sala                       int NOT NULL, 
  PEDIDO_COACHINGid_pedido_coaching int NOT NULL UNIQUE, 
  valor_final                       decimal(10, 2) NOT NULL, 
  PRIMARY KEY (id_coaching));
CREATE TABLE PEDIDO_COACHING_PARTICIPANTE (
  ALUNOid_aluno                         int NOT NULL, 
  PEDIDO_COACHINGid_pedido_coaching     int NOT NULL, 
  PEDIDO_COACHINGhora_inicio_pretendida time(7) NOT NULL, 
  PRIMARY KEY (ALUNOid_aluno, 
  PEDIDO_COACHINGid_pedido_coaching, 
  PEDIDO_COACHINGhora_inicio_pretendida));
CREATE TABLE FATURACAO_MENSAL (
  id_faturacao            int IDENTITY NOT NULL, 
  ano                     int NOT NULL, 
  mes                     int NOT NULL, 
  data_geracao            date NOT NULL, 
  total                   decimal(10, 2) NOT NULL, 
  metodo_pagamento        varchar(50) NULL, 
  data_pagamento          date NULL, 
  estado_pagamento        varchar(50) NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  ANO_LETIVOid_ano_letivo int NOT NULL, 
  PRIMARY KEY (id_faturacao));
CREATE TABLE CATEGORIA_PECA (
  id_categoria_peca int IDENTITY NOT NULL, 
  nome              varchar(255) NOT NULL UNIQUE, 
  PRIMARY KEY (id_categoria_peca));
CREATE TABLE PECA (
  id_peca                         int IDENTITY NOT NULL, 
  nome                            varchar(255) NOT NULL, 
  descricao                       varchar(255) NULL, 
  tamanho                         varchar(50) NULL, 
  estado                          varchar(50) NOT NULL, 
  origem                          varchar(50) NULL, 
  localizacao                     varchar(255) NULL, 
  disponivel_para_emprestimo      bit NULL, 
  disponivel_para_venda           bit NULL, 
  data_registo                    date NOT NULL, 
  UTILIZADORid_utilizador         int NOT NULL, 
  CATEGORIA_PECAid_categoria_peca int NOT NULL, 
  PRIMARY KEY (id_peca));
CREATE TABLE FOTO_PECA (
  id_foto_peca int IDENTITY NOT NULL, 
  foto         varchar(255) NOT NULL, 
  PECAid_peca  int NOT NULL, 
  PRIMARY KEY (id_foto_peca));
CREATE TABLE EMPRESTIMO (
  id_emprestimo           int IDENTITY NOT NULL, 
  data_pedido             date NOT NULL, 
  data_inicio             date NOT NULL, 
  data_fim                date NOT NULL, 
  data_devolucao          date NULL, 
  estado                  varchar(50) NOT NULL, 
  observacoes             varchar(255) NULL, 
  valor                   decimal(10, 2) NULL, 
  metodo_pagamento        varchar(50) NULL, 
  estado_pagamento        varchar(50) NULL, 
  data_pagamento          date NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  PRIMARY KEY (id_emprestimo));
CREATE TABLE PENALIZACAO_PECA (
  id_penalizacao          int IDENTITY NOT NULL, 
  tipo                    varchar(50) NOT NULL, 
  valor                   decimal(10, 2) NOT NULL, 
  descricao               varchar(255) NULL, 
  data_registo            date NOT NULL, 
  PECAid_peca             int NOT NULL, 
  EMPRESTIMOid_emprestimo int NOT NULL, 
  PRIMARY KEY (id_penalizacao));
CREATE TABLE EMPRESTIMO_ITEM (
  estado_entrega            varchar(50) NOT NULL, 
  estado_devolucao          varchar(50) NULL, 
  observacoes               varchar(255) NULL, 
  PECAid_peca               int NOT NULL, 
  [EMPRESIMO id_emprestimo] int NOT NULL,  
  PRIMARY KEY (PECAid_peca, 
  [EMPRESIMO id_emprestimo]));
CREATE TABLE VENDA_PECA (
  id_venda                 int IDENTITY NOT NULL, 
  preco                    decimal(10, 2) NOT NULL, 
  data_colocacao           date NOT NULL, 
  data_venda               date NULL, 
  estado                   varchar(50) NOT NULL, 
  PECAid_peca              int NOT NULL UNIQUE, 
  UTILIZADORid_utilizador  int NOT NULL, 
  UTILIZADORid_utilizador2 int NOT NULL, 
  metodo_pagamento         varchar(50) NULL, 
  metodos_aceites VARCHAR(255) NULL,
  PRIMARY KEY (id_venda));
CREATE TABLE HORARIO (
  id_horario              int IDENTITY NOT NULL, 
  dia_semana              int NOT NULL, 
  hora_fim                time(7) NOT NULL, 
  hora_inicio             time(7) NOT NULL, 
  UTILIZADORid_utilizador int NOT NULL, 
  ALUNOid_aluno           int NOT NULL, 
  MODALIDADEid_modalidade int NOT NULL, 
  SALAid_sala             int NOT NULL, 
  ativo                   bit NOT NULL, 
  ANO_LETIVOid_ano_letivo int NOT NULL, 
  PRIMARY KEY (id_horario));
CREATE TABLE UTILIZADOR (
  id_utilizador int IDENTITY NOT NULL, 
  nome          varchar(255) NOT NULL, 
  email         varchar(255) NOT NULL UNIQUE, 
  password      varchar(255) NOT NULL, 
  telefone      varchar(30) NULL, 
  ativo         bit NOT NULL, 
  data_criacao  date NOT NULL, 
  PRIMARY KEY (id_utilizador));
CREATE TABLE PERFIL (
  id_perfil int IDENTITY NOT NULL, 
  nome      varchar(100) NOT NULL UNIQUE, 
  PRIMARY KEY (id_perfil));
CREATE TABLE UTILIZADOR_PERFIL (
  UTILIZADORid_utilizador int NOT NULL, 
  PERFILid_perfil         int NOT NULL, 
  PRIMARY KEY (UTILIZADORid_utilizador, 
  PERFILid_perfil));
ALTER TABLE TOKEN_RECUPERACAO ADD CONSTRAINT FKTOKEN_RECU73008 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE ENCARREGADO_ALUNO ADD CONSTRAINT FKENCARREGAD630480 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE ENCARREGADO_ALUNO ADD CONSTRAINT FKENCARREGAD488984 FOREIGN KEY (ALUNOid_aluno) REFERENCES ALUNO (id_aluno);
ALTER TABLE SALA_MODALIDADE ADD CONSTRAINT FKSALA_MODAL463582 FOREIGN KEY (SALAid_sala) REFERENCES SALA (id_sala);
ALTER TABLE SALA_MODALIDADE ADD CONSTRAINT FKSALA_MODAL965894 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE PROFESSOR_MODALIDADE ADD CONSTRAINT FKPROFESSOR_464874 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE PROFESSOR_MODALIDADE ADD CONSTRAINT FKPROFESSOR_599841 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE DISPONIBILIDADE_PROFESSOR ADD CONSTRAINT FKDISPONIBIL488617 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE TABELA_PRECO ADD CONSTRAINT FKTABELA_PRE895782 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE TABELA_PRECO ADD CONSTRAINT FKTABELA_PRE760815 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE PEDIDO_COACHING ADD CONSTRAINT FKPEDIDO_COA273515 FOREIGN KEY (ANO_LETIVOid_ano_letivo) REFERENCES ANO_LETIVO (id_ano_letivo);
ALTER TABLE PEDIDO_COACHING ADD CONSTRAINT FKPEDIDO_COA653074 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE PEDIDO_COACHING ADD CONSTRAINT FKPEDIDO_COA453483 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE PEDIDO_COACHING_PARTICIPANTE ADD CONSTRAINT FKPEDIDO_COA161249 FOREIGN KEY (PEDIDO_COACHINGid_pedido_coaching) REFERENCES PEDIDO_COACHING (id_pedido_coaching);
ALTER TABLE PEDIDO_COACHING_PARTICIPANTE ADD CONSTRAINT FKPEDIDO_COA859961 FOREIGN KEY (ALUNOid_aluno) REFERENCES ALUNO (id_aluno);
ALTER TABLE COACHING ADD CONSTRAINT FKCOACHING468345 FOREIGN KEY (PEDIDO_COACHINGid_pedido_coaching) REFERENCES PEDIDO_COACHING (id_pedido_coaching);
ALTER TABLE COACHING ADD CONSTRAINT FKCOACHING694491 FOREIGN KEY (ANO_LETIVOid_ano_letivo) REFERENCES ANO_LETIVO (id_ano_letivo);
ALTER TABLE COACHING ADD CONSTRAINT FKCOACHING314932 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE COACHING ADD CONSTRAINT FKCOACHING550100 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE COACHING ADD CONSTRAINT FKCOACHING992012 FOREIGN KEY (SALAid_sala) REFERENCES SALA (id_sala);
ALTER TABLE VALIDACAO_COACHING ADD CONSTRAINT FKVALIDACAO_352369 FOREIGN KEY (COACHINGid_coaching) REFERENCES COACHING (id_coaching);
ALTER TABLE VALIDACAO_COACHING ADD CONSTRAINT FKVALIDACAO_405058 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE FATURACAO_MENSAL ADD CONSTRAINT FKFATURACAO_786817 FOREIGN KEY (ANO_LETIVOid_ano_letivo) REFERENCES ANO_LETIVO (id_ano_letivo);
ALTER TABLE FATURACAO_MENSAL ADD CONSTRAINT FKFATURACAO_592741 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE PECA ADD CONSTRAINT FKPECA875716 FOREIGN KEY (CATEGORIA_PECAid_categoria_peca) REFERENCES CATEGORIA_PECA (id_categoria_peca);
ALTER TABLE PECA ADD CONSTRAINT FKPECA256302 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE FOTO_PECA ADD CONSTRAINT FKFOTO_PECA635567 FOREIGN KEY (PECAid_peca) REFERENCES PECA (id_peca);
ALTER TABLE EMPRESTIMO ADD CONSTRAINT FKEMPRESTIMO605687 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE EMPRESTIMO_ITEM ADD CONSTRAINT FKEMPRESTIMO968711 FOREIGN KEY ([EMPRESIMO id_emprestimo]) REFERENCES EMPRESTIMO (id_emprestimo);
ALTER TABLE EMPRESTIMO_ITEM ADD CONSTRAINT FKEMPRESTIMO223806 FOREIGN KEY (PECAid_peca) REFERENCES PECA (id_peca);
ALTER TABLE PENALIZACAO_PECA ADD CONSTRAINT FKPENALIZACA332620 FOREIGN KEY (EMPRESTIMOid_emprestimo) REFERENCES EMPRESTIMO (id_emprestimo);
ALTER TABLE PENALIZACAO_PECA ADD CONSTRAINT FKPENALIZACA705430 FOREIGN KEY (PECAid_peca) REFERENCES PECA (id_peca);
ALTER TABLE VENDA_PECA ADD CONSTRAINT FKVENDA_PECA250179 FOREIGN KEY (PECAid_peca) REFERENCES PECA (id_peca);
ALTER TABLE VENDA_PECA ADD CONSTRAINT FKVENDA_PECA248614 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE PEDIDO_COACHING ADD CONSTRAINT FKPEDIDO_COA615508 FOREIGN KEY (UTILIZADORid_utilizador2) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE VENDA_PECA ADD CONSTRAINT FKVENDA_PECA545606 FOREIGN KEY (UTILIZADORid_utilizador2) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE HORARIO ADD CONSTRAINT FKHORARIO960404 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE HORARIO ADD CONSTRAINT FKHORARIO108279 FOREIGN KEY (ALUNOid_aluno) REFERENCES ALUNO (id_aluno);
ALTER TABLE HORARIO ADD CONSTRAINT FKHORARIO146153 FOREIGN KEY (MODALIDADEid_modalidade) REFERENCES MODALIDADE (id_modalidade);
ALTER TABLE HORARIO ADD CONSTRAINT FKHORARIO283324 FOREIGN KEY (SALAid_sala) REFERENCES SALA (id_sala);
ALTER TABLE HORARIO ADD CONSTRAINT FKHORARIO580845 FOREIGN KEY (ANO_LETIVOid_ano_letivo) REFERENCES ANO_LETIVO (id_ano_letivo);
ALTER TABLE UTILIZADOR_PERFIL ADD CONSTRAINT FKUTILIZADOR2305 FOREIGN KEY (UTILIZADORid_utilizador) REFERENCES UTILIZADOR (id_utilizador);
ALTER TABLE UTILIZADOR_PERFIL ADD CONSTRAINT FKUTILIZADOR7532 FOREIGN KEY (PERFILid_perfil) REFERENCES PERFIL (id_perfil);
