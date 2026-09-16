<?php
/**
 * Settings → BizzFlow.
 *
 * Three things to fill in and a button that proves they work. The test button
 * matters more than the fields: the only other way to find out a connection is
 * wrong is to notice, weeks later, that a real customer's enquiry never arrived.
 *
 * @package BizzFlow_Connector
 */

defined( 'ABSPATH' ) || exit;

/**
 * @return void
 */
function bizzflow_admin_menu() {
	add_options_page(
		__( 'BizzFlow', 'bizzflow-connector' ),
		__( 'BizzFlow', 'bizzflow-connector' ),
		'manage_options',
		'bizzflow-connector',
		'bizzflow_admin_page'
	);
}
add_action( 'admin_menu', 'bizzflow_admin_menu' );

/**
 * @return void
 */
function bizzflow_admin_register() {
	register_setting(
		'bizzflow_connector',
		BIZZFLOW_CONNECTOR_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'bizzflow_admin_sanitise',
			'default'           => array(),
		)
	);
}
add_action( 'admin_init', 'bizzflow_admin_register' );

/**
 * @param mixed $input Posted settings.
 * @return array
 */
function bizzflow_admin_sanitise( $input ) {
	$input = is_array( $input ) ? $input : array();

	$base = esc_url_raw( trim( (string) ( $input['base_url'] ?? '' ) ) );
	// HTTPS only. This carries names, phone numbers and addresses.
	if ( '' === $base || 0 !== strpos( $base, 'https://' ) ) {
		$base = 'https://bizzflowuk.com';
		add_settings_error( 'bizzflow_connector', 'base', __( 'The BizzFlow address must start with https://. The default has been kept.', 'bizzflow-connector' ) );
	}

	return array(
		'enabled'     => ! empty( $input['enabled'] ),
		'base_url'    => untrailingslashit( $base ),
		// Slugs are lowercase letters, numbers and dashes. Anything else is a typo.
		'tenant_slug' => sanitize_key( (string) ( $input['tenant_slug'] ?? '' ) ),
		'source'      => in_array( (string) ( $input['source'] ?? '' ), bizzflow_sources(), true )
			? (string) $input['source']
			: 'Website',
	);
}

/**
 * The test send, over admin-post so it is a real server-to-server request -- the
 * same path a genuine enquiry takes.
 *
 * @return void
 */
function bizzflow_admin_test() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Not allowed.', 'bizzflow-connector' ) );
	}
	check_admin_referer( 'bizzflow_test' );

	if ( ! bizzflow_ready() ) {
		$result = 'not-ready';
	} else {
		// Clearly labelled so nobody rings it back, and deliberately NOT through
		// send_once: a test pressed twice should reach BizzFlow twice.
		$ok     = bizzflow_send(
			array(
				'firstName'       => 'Connection',
				'lastName'        => 'Test',
				'email'           => get_option( 'admin_email' ),
				'serviceInterest' => 'Connection test',
				'notes'           => 'TEST from ' . home_url( '/' ) . ' at ' . wp_date( 'j M Y H:i' ) . '. Safe to delete.',
			),
			true // never queue a test: the answer is wanted now, not in an hour
		);
		$result = $ok ? 'ok' : 'failed';
	}

	wp_safe_redirect( add_query_arg( 'bizzflow_test', $result, admin_url( 'options-general.php?page=bizzflow-connector' ) ) );
	exit;
}
add_action( 'admin_post_bizzflow_test', 'bizzflow_admin_test' );

/**
 * Retry the queue now rather than waiting for WP-Cron, which on a quiet site
 * only runs when somebody happens to visit.
 *
 * @return void
 */
function bizzflow_admin_flush() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Not allowed.', 'bizzflow-connector' ) );
	}
	check_admin_referer( 'bizzflow_flush' );

	bizzflow_queue_run();

	wp_safe_redirect( add_query_arg( 'bizzflow_flushed', '1', admin_url( 'options-general.php?page=bizzflow-connector' ) ) );
	exit;
}
add_action( 'admin_post_bizzflow_flush', 'bizzflow_admin_flush' );

/**
 * @return void
 */
function bizzflow_admin_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}

	$s     = bizzflow_settings();
	$queue = get_option( BIZZFLOW_CONNECTOR_QUEUE, array() );
	$log   = get_option( BIZZFLOW_CONNECTOR_LOG, array() );
	$test  = isset( $_GET['bizzflow_test'] ) ? sanitize_key( wp_unslash( $_GET['bizzflow_test'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

	$detected = array_filter( array(
		'Splendid enquiries' => function_exists( 'splendid_enquiry_process' ),
		'Contact Form 7'     => defined( 'WPCF7_VERSION' ),
		'WPForms'            => function_exists( 'wpforms' ),
		'Gravity Forms'      => class_exists( 'GFForms' ),
	) );
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'BizzFlow', 'bizzflow-connector' ); ?></h1>
		<p style="max-width:640px">
			<?php esc_html_e( 'Every enquiry from this website is also sent into BizzFlow as a lead. Your existing notification emails carry on exactly as before.', 'bizzflow-connector' ); ?>
		</p>

		<?php settings_errors( 'bizzflow_connector' ); ?>

		<?php if ( 'ok' === $test ) : ?>
			<div class="notice notice-success"><p><strong><?php esc_html_e( 'Connected.', 'bizzflow-connector' ); ?></strong> <?php esc_html_e( 'A test lead called "Connection Test" is now in BizzFlow. Delete it there.', 'bizzflow-connector' ); ?></p></div>
		<?php elseif ( 'failed' === $test ) : ?>
			<div class="notice notice-error"><p><strong><?php esc_html_e( 'That did not reach BizzFlow.', 'bizzflow-connector' ); ?></strong> <?php esc_html_e( 'The most common cause is a wrong business code. The log below says what came back.', 'bizzflow-connector' ); ?></p></div>
		<?php elseif ( 'not-ready' === $test ) : ?>
			<div class="notice notice-warning"><p><?php esc_html_e( 'Turn the connector on and enter the business code first.', 'bizzflow-connector' ); ?></p></div>
		<?php endif; ?>

		<form method="post" action="options.php">
			<?php settings_fields( 'bizzflow_connector' ); ?>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Send enquiries to BizzFlow', 'bizzflow-connector' ); ?></th>
					<td>
						<label>
							<input type="checkbox" name="<?php echo esc_attr( BIZZFLOW_CONNECTOR_OPTION ); ?>[enabled]" value="1" <?php checked( ! empty( $s['enabled'] ) ); ?>>
							<?php esc_html_e( 'On', 'bizzflow-connector' ); ?>
						</label>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="bf-slug"><?php esc_html_e( 'Business code', 'bizzflow-connector' ); ?></label></th>
					<td>
						<input id="bf-slug" type="text" class="regular-text code" name="<?php echo esc_attr( BIZZFLOW_CONNECTOR_OPTION ); ?>[tenant_slug]" value="<?php echo esc_attr( $s['tenant_slug'] ); ?>" placeholder="splendid">
						<p class="description"><?php esc_html_e( 'The short name of the business in BizzFlow. LaunchFlow will give you this.', 'bizzflow-connector' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="bf-base"><?php esc_html_e( 'BizzFlow address', 'bizzflow-connector' ); ?></label></th>
					<td>
						<input id="bf-base" type="url" class="regular-text code" name="<?php echo esc_attr( BIZZFLOW_CONNECTOR_OPTION ); ?>[base_url]" value="<?php echo esc_attr( $s['base_url'] ); ?>">
						<p class="description"><?php esc_html_e( 'Leave this as it is unless LaunchFlow tells you otherwise.', 'bizzflow-connector' ); ?></p>
					</td>
				</tr>
				<tr>
					<th scope="row"><label for="bf-source"><?php esc_html_e( 'Lead source', 'bizzflow-connector' ); ?></label></th>
					<td>
						<select id="bf-source" name="<?php echo esc_attr( BIZZFLOW_CONNECTOR_OPTION ); ?>[source]">
							<?php foreach ( bizzflow_sources() as $option ) : ?>
								<option value="<?php echo esc_attr( $option ); ?>" <?php selected( $s['source'], $option ); ?>><?php echo esc_html( $option ); ?></option>
							<?php endforeach; ?>
						</select>
						<p class="description"><?php esc_html_e( 'Where BizzFlow files these leads. Almost always Website.', 'bizzflow-connector' ); ?></p>
					</td>
				</tr>
			</table>
			<?php submit_button( __( 'Save', 'bizzflow-connector' ) ); ?>
		</form>

		<h2><?php esc_html_e( 'Check it works', 'bizzflow-connector' ); ?></h2>
		<p><?php esc_html_e( 'Sends one clearly labelled test lead. Save your settings first.', 'bizzflow-connector' ); ?></p>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="bizzflow_test">
			<?php wp_nonce_field( 'bizzflow_test' ); ?>
			<?php submit_button( __( 'Send a test lead', 'bizzflow-connector' ), 'secondary', 'submit', false ); ?>
		</form>

		<h2><?php esc_html_e( 'Forms found on this site', 'bizzflow-connector' ); ?></h2>
		<?php if ( $detected ) : ?>
			<ul style="list-style:disc;margin-left:20px">
				<?php foreach ( array_keys( $detected ) as $label ) : ?>
					<li><?php echo esc_html( $label ); ?> &mdash; <?php esc_html_e( 'connected', 'bizzflow-connector' ); ?></li>
				<?php endforeach; ?>
			</ul>
		<?php else : ?>
			<p><?php esc_html_e( 'No supported form plugin was found. Enquiries will not be sent until one is active.', 'bizzflow-connector' ); ?></p>
		<?php endif; ?>

		<?php if ( is_array( $queue ) && $queue ) : ?>
			<h2><?php esc_html_e( 'Waiting to send', 'bizzflow-connector' ); ?></h2>
			<p>
				<?php
				/* translators: %d: number of queued enquiries. */
				echo esc_html( sprintf( _n( '%d enquiry could not reach BizzFlow and will be retried.', '%d enquiries could not reach BizzFlow and will be retried.', count( $queue ), 'bizzflow-connector' ), count( $queue ) ) );
				?>
			</p>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="bizzflow_flush">
				<?php wp_nonce_field( 'bizzflow_flush' ); ?>
				<?php submit_button( __( 'Try them now', 'bizzflow-connector' ), 'secondary', 'submit', false ); ?>
			</form>
		<?php endif; ?>

		<h2><?php esc_html_e( 'Recent activity', 'bizzflow-connector' ); ?></h2>
		<?php if ( is_array( $log ) && $log ) : ?>
			<table class="widefat striped" style="max-width:900px">
				<thead><tr>
					<th><?php esc_html_e( 'When', 'bizzflow-connector' ); ?></th>
					<th><?php esc_html_e( 'Result', 'bizzflow-connector' ); ?></th>
					<th><?php esc_html_e( 'Interest', 'bizzflow-connector' ); ?></th>
					<th><?php esc_html_e( 'Detail', 'bizzflow-connector' ); ?></th>
				</tr></thead>
				<tbody>
				<?php foreach ( array_slice( $log, 0, 20 ) as $row ) : ?>
					<tr>
						<td><?php echo esc_html( wp_date( 'j M H:i', (int) $row['at'] ) ); ?></td>
						<td><strong><?php echo esc_html( $row['status'] ); ?></strong></td>
						<td><?php echo esc_html( $row['interest'] ); ?></td>
						<td><code><?php echo esc_html( $row['detail'] ); ?></code></td>
					</tr>
				<?php endforeach; ?>
				</tbody>
			</table>
			<p class="description"><?php esc_html_e( 'Names, emails and messages are deliberately not kept here.', 'bizzflow-connector' ); ?></p>
		<?php else : ?>
			<p><?php esc_html_e( 'Nothing sent yet.', 'bizzflow-connector' ); ?></p>
		<?php endif; ?>
	</div>
	<?php
}
