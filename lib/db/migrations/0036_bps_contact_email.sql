-- BPS contact email.
--
-- The site went live with info@ carried over from the old WordPress build.
-- Brandon wants his own address used everywhere the public site shows one, and
-- everywhere automated mail is sent from or notifies to.
UPDATE tenants
SET email = 'brandon@bpsplumbingandheating.com', updated_at = now()
WHERE slug = 'bps' AND email = 'info@bpsplumbingandheating.com';

UPDATE tenant_settings ts
SET email = 'brandon@bpsplumbingandheating.com',
    admin_notification_email = COALESCE(NULLIF(ts.admin_notification_email, 'info@bpsplumbingandheating.com'), 'brandon@bpsplumbingandheating.com'),
    updated_at = now()
FROM tenants t
WHERE t.id = ts.tenant_id AND t.slug = 'bps'
  AND (ts.email = 'info@bpsplumbingandheating.com' OR ts.email IS NULL);
