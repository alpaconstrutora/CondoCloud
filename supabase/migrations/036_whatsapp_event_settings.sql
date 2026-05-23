-- Adiciona coluna para armazenar eventos de WhatsApp desativados no nível do condomínio
ALTER TABLE condominiums
  ADD COLUMN IF NOT EXISTS whatsapp_disabled_events text[] DEFAULT '{}';
