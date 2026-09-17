=== BizzFlow Connector ===
Contributors: launchflowuk
Tags: leads, enquiries, crm, contact form 7, wpforms, quform
Requires at least: 6.0
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 1.3.0
License: GPLv2 or later

Sends website enquiries into BizzFlowUK as leads. The site stays exactly as it is.

== Description ==

A business with a finished WordPress website does not want it rebuilt. They
want their enquiries somewhere they can work them — contacted, quoted, won —
without retyping each one from an email.

This plugin listens to the forms the site already has and sends each enquiry
into BizzFlow as a lead. Nothing on the site changes, and the business keeps
the notification emails it gets today.

Supported out of the box:

* The Splendid core plugin (Splendid Double Glazing)
* Contact Form 7
* WPForms
* Gravity Forms
* Quform

= What it does not do =

* It does not replace the site's own email. BizzFlow is added alongside it.
* It does not post from the visitor's browser. The request goes server to
  server, so there is nothing to configure for CORS, nothing exposed in the page
  source, and it works with JavaScript switched off.
* It never makes the visitor wait. If BizzFlow is slow or unreachable the
  enquiry is queued and retried up to six times, and the visitor still sees
  their normal success message.
* It keeps no lasting copy of anybody's details. An enquiry waiting to be
  retried is held for at most 24 hours, then deleted; the activity log records
  what happened, never who it was.

== Installation ==

1. In BizzFlow, create the business (Admin → Tenants). Note its short code —
   the "slug" — for example `splendid`.
2. In WordPress: Plugins → Add New → Upload Plugin → choose
   `bizzflow-connector.zip` → Install → Activate.
3. Settings → BizzFlow.
4. Tick "On", enter the business code, Save.
5. Press "Send a test lead". A lead called "Connection Test" should appear in
   BizzFlow within a second or two. Delete it there.

That is the whole setup. Real enquiries flow from then on.

== Frequently Asked Questions ==

= The test failed =

Almost always a wrong business code. The "Recent activity" table shows what
BizzFlow replied: "Tenant not found" means the code does not match.

= An enquiry did not arrive =

Check "Recent activity". If BizzFlow was unreachable the enquiry is listed
under "Waiting to send" — press "Try them now". WordPress only runs its
scheduled jobs when somebody visits the site, so on a quiet site a retry can
wait until the next visitor.

= Will a customer ever be added twice? =

No. Where a form fires more than one event for a single submission, the
plugin recognises the same enquiry arriving twice within ten minutes and sends
it once. A test lead is the exception — pressing test twice sends two.

= Can I turn it off? =

Untick "On". Deactivating the plugin also stops its retry schedule. Either way
the website carries on exactly as before.

== Splendid specifics ==

The Splendid plugin fires `splendid_enquiry_sent` — but only when its own
notification email succeeds. An enquiry that arrives while the mail server is
down is stored as "queued" and that event never runs.

So this plugin also watches the moment Splendid finishes storing an enquiry,
which happens on both paths -- BUT ONLY IF "Store enquiries in WordPress" IS ON.

That setting ships OFF, deliberately, until the privacy notice covers stored
enquiries. With it off, an enquiry that arrives while email is broken is not
stored, is not sent to BizzFlow, and the visitor is shown a "please try again"
message. Nothing is lost silently -- but BizzFlow can only ever be as reliable
as the site's email.

Fixed in the Splendid core version from commit 4a8c6e3 in their repo: Splendid
asks the `splendid_enquiry_delivered_elsewhere` filter when its email fails, and
this plugin answers yes once BizzFlow has confirmed receipt -- never for an
enquiry that is only queued. The visitor then sees the normal success message.
Until that Splendid version is deployed, the older behaviour above applies.

If BizzFlow is unreachable, this plugin holds an enquiry for no more than 24
hours while retrying, then deletes it. The activity log never stores names or
messages.

Field mapping:

* Name            → first name + last name (split on the first space)
* Email, phone    → email, phone
* Postcode        → postcode
* Product         → service interest
* Material, how many, where it came from, and the message → notes

== Changelog ==

= 1.3.0 =
* Quform support. Fields are read by their label, or recognised from their contents when a form gives none.

= 1.2.0 =
* Contact Form 7: an enquiry still reaches BizzFlow when the site's own email fails to send.

= 1.1.0 =
* Answers Splendid's delivered-elsewhere question, so a mail outage no longer turns a visitor away once BizzFlow has the enquiry.
* Retry queue holds an enquiry for at most 24 hours.
* Empty business code is flagged instead of looking filled in.

= 1.0.0 =
* First release.
