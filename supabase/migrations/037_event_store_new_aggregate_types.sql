-- Adiciona 'charge' e 'message' como aggregate_types válidos no event store
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_aggregate_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_aggregate_type_check
  CHECK (aggregate_type IN (
    'profile','condominium','invite','proposal','ticket',
    'reservation','assembly','notification','charge','message'
  ));
