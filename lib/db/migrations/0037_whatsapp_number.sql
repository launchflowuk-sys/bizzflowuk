-- A WhatsApp number, separate from the main phone.
--
-- The floating WhatsApp button only renders for a number that can actually
-- receive WhatsApp, and a landline cannot — AMO Services publishes 01375 506071,
-- so without this the button could never appear for them. This lets a tenant
-- give a mobile for WhatsApp while still showing the landline as their number.
ALTER TABLE tenant_settings ADD COLUMN IF NOT EXISTS whatsapp_number text;
