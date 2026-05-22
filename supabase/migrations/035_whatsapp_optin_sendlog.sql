-- ============================================================
-- 035 — WhatsApp: opt-in e log de envio
-- ============================================================

-- Campo de consentimento: somente envia WhatsApp se o morador aceitou
alter table profiles add column if not exists whatsapp_opt_in boolean default false;

-- Rastreia cada tentativa de envio: messageId da Evolution API, status e erros
create table whatsapp_send_log (
  id          uuid primary key default uuid_generate_v4(),
  profile_id  uuid references profiles(id) on delete set null,
  phone       text not null,
  message_id  text,   -- ID retornado pela Evolution API (atualizado via webhook)
  status      text default 'pending'
    check (status in ('pending','sent','delivered','read','failed')),
  error       text,
  created_at  timestamp default now(),
  updated_at  timestamp default now()
);

create index idx_whatsapp_log_message_id on whatsapp_send_log(message_id) where message_id is not null;
create index idx_whatsapp_log_profile    on whatsapp_send_log(profile_id);
create index idx_whatsapp_log_status     on whatsapp_send_log(status, created_at desc);
