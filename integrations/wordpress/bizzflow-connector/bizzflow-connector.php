<?php
/**
 * Plugin Name:       BizzFlow Connector
 * Plugin URI:        https://bizzflowuk.com
 * Description:       Sends website enquiries into BizzFlowUK as leads, so the business manages everything in one place. Works with the Splendid core plugin, Contact Form 7, WPForms and Gravity Forms.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            LaunchFlow UK
 * Author URI:        https://launchflow.co.uk
 * License:           GPL-2.0-or-later
 * Text Domain:       bizzflow-connector
 *
 * @package BizzFlow_Connector
 */

/**
 * WHY THIS IS A SEPARATE PLUGIN AND NOT AN EDIT TO THEIRS.
 *
 * A client with a finished WordPress site does not want it rebuilt; they want
 * their enquiries somewhere they can work them. Everything here attaches to
 * hooks the existing site already fires, so their theme and their plugins are
 * untouched and can be updated without losing this. Deactivate it and the site
 * behaves exactly as it did before.
 *
 * It is also the reusable half: this same plugin points any WordPress site at
 * BizzFlow, which is what makes it worth building properly rather than
 * hardcoding one client's form.
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   - It does not replace the site's own email. The business keeps getting the
 *     notification it already gets. BizzFlow is added alongside, never instead
 *     -- an integration that swallows a client's enquiries the day it breaks is
 *     not worth the risk.
 *   - It does not post from the browser. The request goes server to server, so
 *     there is no CORS to configure, nothing exposed in page source, and it
 *     still works for a visitor with JavaScript off.
 *   - It never blocks the visitor. If BizzFlow is slow or down, the enquiry is
 *     queued and retried; the person who filled the form still sees success,
 *     because from their side it did succeed.
 */

defined( 'ABSPATH' ) || exit;

define( 'BIZZFLOW_CONNECTOR_VERSION', '1.0.0' );
define( 'BIZZFLOW_CONNECTOR_OPTION', 'bizzflow_connector_settings' );
define( 'BIZZFLOW_CONNECTOR_QUEUE', 'bizzflow_connector_queue' );
define( 'BIZZFLOW_CONNECTOR_LOG', 'bizzflow_connector_log' );
define( 'BIZZFLOW_CONNECTOR_CRON', 'bizzflow_connector_retry' );

/** How long we wait on BizzFlow before giving up and queueing instead. */
define( 'BIZZFLOW_CONNECTOR_TIMEOUT', 8 );

/** Give up after this many attempts. Six retries over ~an hour is generous. */
define( 'BIZZFLOW_CONNECTOR_MAX_ATTEMPTS', 6 );

/* -------------------------------------------------------------------------
 * Settings
 * ---------------------------------------------------------------------- */

/**
 * The saved settings, with defaults.
 *
 * @return array
 */
function bizzflow_settings() {
	$saved = get_option( BIZZFLOW_CONNECTOR_OPTION, array() );

	return wp_parse_args(
		is_array( $saved ) ? $saved : array(),
		array(
			'enabled'     => false,
			'base_url'    => 'https://bizzflowuk.com',
			'tenant_slug' => '',
			'source'      => 'Website',
		)
	);
}

/**
 * Is the connector actually able to send?
 *
 * Enabled on its own is not enough -- without a tenant slug the API has no idea
 * whose lead this is and would reject it.
 *
 * @return bool
 */
function bizzflow_ready() {
	$s = bizzflow_settings();

	return ! empty( $s['enabled'] ) && '' !== trim( (string) $s['tenant_slug'] );
}

/**
 * The lead sources BizzFlow keeps.
 *
 * It is an enum at the far end, and anything outside it is quietly filed as
 * Website. Offering a free-text box would have let somebody type a label that
 * never appears anywhere, so the setting is limited to exactly these.
 *
 * @return string[]
 */
function bizzflow_sources() {
	return array( 'Website', 'Referral', 'Google', 'Facebook', 'Instagram', 'Other' );
}

/* -------------------------------------------------------------------------
 * Sending
 * ---------------------------------------------------------------------- */

/**
 * The endpoint. Public and rate limited at the other end; no key to leak.
 *
 * @return string
 */
function bizzflow_endpoint() {
	$s = bizzflow_settings();

	return rtrim( (string) $s['base_url'], '/' ) . '/api/quote-request';
}

/**
 * Split a single name field into the two BizzFlow stores.
 *
 * Everything after the first space is the surname, which is wrong for a few
 * names and right for nearly all of them. The alternative -- two boxes on the
 * form -- costs more enquiries than it fixes records.
 *
 * @param string $name Full name.
 * @return array{0:string,1:string}
 */
function bizzflow_split_name( $name ) {
	$name  = trim( preg_replace( '/\s+/', ' ', (string) $name ) );
	$parts = explode( ' ', $name, 2 );

	return array( $parts[0] ?? '', $parts[1] ?? '' );
}

/**
 * Send one lead, or queue it if that fails.
 *
 * @param array $lead   Payload, already mapped.
 * @param bool  $queued True when this is a retry of something already queued.
 * @return bool Whether BizzFlow accepted it.
 */
function bizzflow_send( array $lead, $queued = false ) {
	if ( ! bizzflow_ready() ) {
		return false;
	}

	$s               = bizzflow_settings();
	$lead['tenantSlug'] = $s['tenant_slug'];
	$lead['source']     = $lead['source'] ?? $s['source'];

	$response = wp_remote_post(
		bizzflow_endpoint(),
		array(
			'timeout'     => BIZZFLOW_CONNECTOR_TIMEOUT,
			'redirection' => 0,
			'headers'     => array(
				'Content-Type' => 'application/json',
				'Accept'       => 'application/json',
				// So the far end can tell a WordPress site from the dashboard.
				'User-Agent'   => 'BizzFlowConnector/' . BIZZFLOW_CONNECTOR_VERSION . '; ' . home_url( '/' ),
			),
			'body'        => wp_json_encode( $lead ),
		)
	);

	if ( is_wp_error( $response ) ) {
		bizzflow_log( 'error', $response->get_error_message(), $lead );
		if ( ! $queued ) {
			bizzflow_queue_add( $lead );
		}

		return false;
	}

	$code = (int) wp_remote_retrieve_response_code( $response );

	if ( $code >= 200 && $code < 300 ) {
		bizzflow_log( 'sent', 'Lead accepted (' . $code . ')', $lead );

		return true;
	}

	/**
	 * A 4xx is our fault and retrying will not fix it -- a wrong tenant slug
	 * retried six times is six identical failures and a misleading log. Only a
	 * 5xx or a network problem is worth trying again.
	 */
	$body = wp_remote_retrieve_body( $response );
	bizzflow_log( 'error', 'HTTP ' . $code . ' ' . substr( (string) $body, 0, 300 ), $lead );

	if ( ! $queued && $code >= 500 ) {
		bizzflow_queue_add( $lead );
	}

	return false;
}

/* -------------------------------------------------------------------------
 * Retry queue
 * ---------------------------------------------------------------------- */

/**
 * Park a lead for another go.
 *
 * Stored in an option rather than a table: this holds a handful of rows on a bad
 * day, and a plugin that creates database tables is a plugin somebody has to
 * remember to clean up.
 *
 * @param array $lead Payload.
 * @return void
 */
function bizzflow_queue_add( array $lead ) {
	$queue = get_option( BIZZFLOW_CONNECTOR_QUEUE, array() );
	$queue = is_array( $queue ) ? $queue : array();

	$queue[] = array(
		'lead'     => $lead,
		'attempts' => 0,
		'first'    => time(),
	);

	// Bounded, so a long outage cannot grow an option row without limit.
	if ( count( $queue ) > 200 ) {
		$queue = array_slice( $queue, -200 );
	}

	update_option( BIZZFLOW_CONNECTOR_QUEUE, $queue, false );

	if ( ! wp_next_scheduled( BIZZFLOW_CONNECTOR_CRON ) ) {
		wp_schedule_single_event( time() + 300, BIZZFLOW_CONNECTOR_CRON );
	}
}

/**
 * Work the queue. Scheduled, so a visitor never waits for it.
 *
 * @return void
 */
function bizzflow_queue_run() {
	$queue = get_option( BIZZFLOW_CONNECTOR_QUEUE, array() );
	if ( ! is_array( $queue ) || ! $queue ) {
		return;
	}

	$remaining = array();

	foreach ( $queue as $item ) {
		$item['attempts'] = (int) ( $item['attempts'] ?? 0 ) + 1;

		if ( bizzflow_send( (array) $item['lead'], true ) ) {
			continue;
		}

		if ( $item['attempts'] < BIZZFLOW_CONNECTOR_MAX_ATTEMPTS ) {
			$remaining[] = $item;
		} else {
			bizzflow_log( 'dropped', 'Gave up after ' . $item['attempts'] . ' attempts', (array) $item['lead'] );
		}
	}

	update_option( BIZZFLOW_CONNECTOR_QUEUE, $remaining, false );

	if ( $remaining && ! wp_next_scheduled( BIZZFLOW_CONNECTOR_CRON ) ) {
		wp_schedule_single_event( time() + 600, BIZZFLOW_CONNECTOR_CRON );
	}
}
add_action( BIZZFLOW_CONNECTOR_CRON, 'bizzflow_queue_run' );

/* -------------------------------------------------------------------------
 * Log
 * ---------------------------------------------------------------------- */

/**
 * A short, readable history, so "did that enquiry reach BizzFlow?" has an answer.
 *
 * Names and the message body are NOT written here. The log is for diagnosing
 * delivery, and a debugging aid should not quietly become a second copy of
 * everyone's personal details sitting in the options table.
 *
 * @param string $status sent|error|dropped|skipped.
 * @param string $detail Human-readable note.
 * @param array  $lead   Payload, for the non-identifying bits only.
 * @return void
 */
function bizzflow_log( $status, $detail, array $lead = array() ) {
	$log = get_option( BIZZFLOW_CONNECTOR_LOG, array() );
	$log = is_array( $log ) ? $log : array();

	array_unshift(
		$log,
		array(
			'at'       => time(),
			'status'   => $status,
			'detail'   => (string) $detail,
			'interest' => (string) ( $lead['serviceInterest'] ?? '' ),
			'postcode' => (string) ( $lead['postcode'] ?? '' ),
		)
	);

	update_option( BIZZFLOW_CONNECTOR_LOG, array_slice( $log, 0, 50 ), false );
}

/* -------------------------------------------------------------------------
 * Adapters — one per form system
 * ---------------------------------------------------------------------- */

/**
 * Splendid core: its enquiry service fires an action on every accepted enquiry.
 *
 * @param array $values Cleaned values from splendid_enquiry_process().
 * @return void
 */
function bizzflow_from_splendid( $values ) {
	if ( ! is_array( $values ) ) {
		return;
	}

	list( $first, $last ) = bizzflow_split_name( $values['name'] ?? '' );

	$notes = array();
	foreach ( array( 'product' => 'Interested in', 'material' => 'Material', 'quantity' => 'How many', 'source' => 'Came from' ) as $key => $label ) {
		if ( ! empty( $values[ $key ] ) ) {
			$notes[] = $label . ': ' . $values[ $key ];
		}
	}
	if ( ! empty( $values['message'] ) ) {
		$notes[] = trim( (string) $values['message'] );
	}

	bizzflow_send_once(
		array(
			'firstName'       => $first,
			'lastName'        => $last,
			'email'           => (string) ( $values['email'] ?? '' ),
			'phone'           => (string) ( $values['phone'] ?? '' ),
			'postcode'        => (string) ( $values['postcode'] ?? '' ),
			'serviceInterest' => (string) ( $values['product'] ?? '' ),
			'notes'           => implode( "\n", $notes ),
		)
	);
}
add_action( 'splendid_enquiry_sent', 'bizzflow_from_splendid', 10, 1 );

/**
 * The same enquiry, caught on the way into their lead store.
 *
 * `splendid_enquiry_sent` only fires when the notification EMAIL succeeded. An
 * enquiry that arrives while the mail server is having a bad morning is stored
 * as "queued" and that action never runs -- so without this, the leads most
 * worth rescuing are precisely the ones BizzFlow would never hear about.
 *
 * bizzflow_send_once() stops the two paths sending the same lead twice.
 *
 * WHY THIS HOOKS A META WRITE AND NOT save_post. splendid_lead_record() calls
 * wp_insert_post() FIRST -- which fires save_post -- and only then writes the
 * enquiry's values one meta key at a time. At save_post the lead is empty, so
 * hooking it would have sent a blank enquiry: the first version of this did
 * exactly that, and only reading their code caught it.
 *
 * `_splendid_status` is written after every value, so its FIRST write is the
 * moment the lead is complete. `added_post_meta` fires for that first write
 * only; when splendid_lead_mark_sent() later flips queued to sent it is an
 * update, which fires a different action -- so a lead dealt with last week is
 * never pushed into BizzFlow a second time. The meta flag is belt and braces.
 *
 * @param int    $meta_id  Meta row id.
 * @param int    $post_id  Lead post id.
 * @param string $meta_key Key just added.
 * @return void
 */
function bizzflow_from_splendid_lead_meta( $meta_id, $post_id, $meta_key ) {
	if ( '_splendid_status' !== $meta_key ) {
		return;
	}
	if ( 'splendid_lead' !== get_post_type( $post_id ) ) {
		return;
	}
	if ( get_post_meta( $post_id, '_bizzflow_synced', true ) || ! function_exists( 'splendid_lead_values' ) ) {
		return;
	}

	$values = splendid_lead_values( get_post( $post_id ) );
	if ( is_array( $values ) && array_filter( $values ) ) {
		update_post_meta( $post_id, '_bizzflow_synced', time() );
		bizzflow_from_splendid( $values );
	}
}
add_action( 'added_post_meta', 'bizzflow_from_splendid_lead_meta', 10, 3 );

/**
 * Contact Form 7.
 *
 * Field names vary by form, so this maps the conventional ones and puts
 * everything else in the notes rather than dropping it.
 *
 * @param WPCF7_ContactForm $form Form.
 * @return void
 */
function bizzflow_from_cf7( $form ) {
	if ( ! class_exists( 'WPCF7_Submission' ) ) {
		return;
	}
	$submission = WPCF7_Submission::get_instance();
	if ( ! $submission ) {
		return;
	}

	bizzflow_send_once( bizzflow_map_generic( (array) $submission->get_posted_data() ) );
}
add_action( 'wpcf7_mail_sent', 'bizzflow_from_cf7', 10, 1 );

/**
 * WPForms.
 *
 * @param array $fields Submitted fields.
 * @return void
 */
function bizzflow_from_wpforms( $fields ) {
	$flat = array();
	foreach ( (array) $fields as $field ) {
		$name = strtolower( (string) ( $field['name'] ?? '' ) );
		if ( '' !== $name ) {
			$flat[ $name ] = $field['value'] ?? '';
		}
	}

	bizzflow_send_once( bizzflow_map_generic( $flat ) );
}
add_action( 'wpforms_process_complete', 'bizzflow_from_wpforms', 10, 1 );

/**
 * Gravity Forms.
 *
 * @param array $entry Entry.
 * @param array $form  Form.
 * @return void
 */
function bizzflow_from_gravity( $entry, $form ) {
	$flat = array();
	foreach ( (array) ( $form['fields'] ?? array() ) as $field ) {
		$label = strtolower( (string) ( $field->label ?? '' ) );
		$id    = (string) ( $field->id ?? '' );
		if ( '' !== $label && isset( $entry[ $id ] ) ) {
			$flat[ $label ] = $entry[ $id ];
		}
	}

	bizzflow_send_once( bizzflow_map_generic( $flat ) );
}
add_action( 'gform_after_submission', 'bizzflow_from_gravity', 10, 2 );

/**
 * Best-effort mapping for a form we know nothing about.
 *
 * Anything unrecognised goes into the notes. Losing a field a client asked for
 * is worse than a slightly untidy note, and the note is what a human reads.
 *
 * @param array $data Raw field name => value.
 * @return array
 */
function bizzflow_map_generic( array $data ) {
	$find = function ( array $keys ) use ( $data ) {
		foreach ( $data as $key => $value ) {
			$key = strtolower( (string) $key );
			foreach ( $keys as $needle ) {
				if ( false !== strpos( $key, $needle ) ) {
					return is_array( $value ) ? implode( ', ', $value ) : (string) $value;
				}
			}
		}

		return '';
	};

	$name = $find( array( 'your-name', 'full-name', 'fullname', 'name' ) );
	list( $first, $last ) = bizzflow_split_name( $name );

	$first = $first ?: $find( array( 'first' ) );
	$last  = $last ?: $find( array( 'last', 'surname' ) );

	$known = array( 'name', 'first', 'last', 'surname', 'email', 'phone', 'tel', 'mobile', 'postcode', 'postal', 'zip' );
	$notes = array();
	foreach ( $data as $key => $value ) {
		$lower = strtolower( (string) $key );
		$skip  = false;
		foreach ( $known as $k ) {
			if ( false !== strpos( $lower, $k ) ) {
				$skip = true;
				break;
			}
		}
		if ( $skip || '' === $value || is_null( $value ) ) {
			continue;
		}
		$notes[] = $key . ': ' . ( is_array( $value ) ? implode( ', ', $value ) : (string) $value );
	}

	return array(
		'firstName'       => $first,
		'lastName'        => $last,
		'email'           => $find( array( 'email' ) ),
		'phone'           => $find( array( 'phone', 'tel', 'mobile' ) ),
		'postcode'        => $find( array( 'postcode', 'postal', 'zip' ) ),
		'serviceInterest' => $find( array( 'interest', 'service', 'product', 'subject' ) ),
		'notes'           => implode( "\n", $notes ),
	);
}

/**
 * Send, unless this exact enquiry has just been sent.
 *
 * Two hooks can fire for one submission -- on Splendid, the action and the
 * lead-post save both run for a single enquiry. The visitor pressed the button
 * once; BizzFlow must not gain two identical leads for a salesperson to ring
 * twice.
 *
 * @param array $lead Mapped payload.
 * @return void
 */
function bizzflow_send_once( array $lead ) {
	if ( ! bizzflow_ready() ) {
		return;
	}

	/*
	 * Identity from the fields that are the same on every path -- NOT the notes.
	 *
	 * On Splendid both hooks fire for one enquiry, and they read the values
	 * from two different places: the in-memory array, and the stored meta.
	 * Those can differ by a field (quantity is stored; the other may not carry
	 * it), which changes the notes string. With notes in the key, one enquiry
	 * produced two different keys and went through twice.
	 */
	$identity = strtolower( implode( '|', array(
		preg_replace( '/\s+/', '', (string) ( $lead['email'] ?? '' ) ),
		preg_replace( '/\D+/', '', (string) ( $lead['phone'] ?? '' ) ),
		preg_replace( '/\s+/', '', (string) ( $lead['postcode'] ?? '' ) ),
		trim( (string) ( $lead['serviceInterest'] ?? '' ) ),
	) ) );
	if ( '' === trim( $identity, '|' ) ) {
		return;
	}

	$key = 'bizzflow_sent_' . md5( $identity );
	if ( get_transient( $key ) ) {
		return;
	}
	set_transient( $key, 1, 10 * MINUTE_IN_SECONDS );

	bizzflow_send( $lead );
}

/* -------------------------------------------------------------------------
 * Admin
 * ---------------------------------------------------------------------- */

require_once __DIR__ . '/admin.php';

/**
 * Tidy up after ourselves.
 *
 * @return void
 */
function bizzflow_deactivate() {
	$timestamp = wp_next_scheduled( BIZZFLOW_CONNECTOR_CRON );
	if ( $timestamp ) {
		wp_unschedule_event( $timestamp, BIZZFLOW_CONNECTOR_CRON );
	}
}
register_deactivation_hook( __FILE__, 'bizzflow_deactivate' );
