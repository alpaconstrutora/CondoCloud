-- Remove o CHECK constraint fixo de tipo_morador pois os tipos agora são dinâmicos (tabela tipos_morador)
alter table profiles drop constraint if exists profiles_tipo_morador_check;
