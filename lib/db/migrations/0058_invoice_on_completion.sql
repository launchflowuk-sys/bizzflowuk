-- Invoice the customer when the job is done.
--
-- Some trades never take card payment up front: they invoice once the work is
-- finished. A quote can now be invoiced "when the job is complete" -- the
-- invoice is raised straight away as a draft and waits, flagged with
-- send_on_completion, until the job made from that quote is marked Completed.
--
-- What happens then is the business's choice, not ours:
-- auto_send_invoice_on_completion ON  -> the invoice is dated that day and sent.
-- auto_send_invoice_on_completion OFF -> it stays a draft for them to check and
--                                        send themselves.
-- On by default: the whole point of choosing "after completion" is not having
-- to remember.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS send_on_completion boolean NOT NULL DEFAULT false;

ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS auto_send_invoice_on_completion boolean NOT NULL DEFAULT true;
