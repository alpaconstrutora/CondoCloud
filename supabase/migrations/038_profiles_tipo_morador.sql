-- Tipo de morador: classifica residentes sem afetar controle de acesso (role)
alter table profiles
  add column if not exists tipo_morador text
    check (tipo_morador in ('proprietario','inquilino','dependente','outro'));
