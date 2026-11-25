<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Admin\RollbackPage;
use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\Rollback;
use Kotlinskidev\A11y\Update\Updater;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class UpdateController {

	public const REST_NAMESPACE = 'kotlinskidev-a11y/v1';
	public const CAPABILITY     = 'update_plugins';

	public function __construct(
		private readonly Updater $updater,
		private readonly Channel $channel,
		private readonly Rollback $rollback
	) {}

	public function register_routes(): void {
		register_rest_route(
			self::REST_NAMESPACE,
			'/update-channel',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_channel' ),
					'permission_callback' => array( $this, 'check_permission' ),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'set_channel' ),
					'permission_callback' => array( $this, 'check_permission' ),
					'args'                => array(
						'channel' => array(
							'type'     => 'string',
							'enum'     => array( Channel::STABLE, Channel::BETA ),
							'required' => true,
						),
					),
				),
			)
		);
		register_rest_route(
			self::REST_NAMESPACE,
			'/releases',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_releases' ),
				'permission_callback' => array( $this, 'check_permission' ),
				'args'                => array(
					'refresh' => array(
						'type'              => 'boolean',
						'default'           => false,
						'sanitize_callback' => 'rest_sanitize_boolean',
						'validate_callback' => 'rest_is_boolean',
					),
				),
			)
		);
	}

	public function check_permission( WP_REST_Request $request ): bool|WP_Error {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return new WP_Error( 'kotlinskidev_a11y_forbidden', __( 'You are not allowed to manage updates.', 'kotlinskidev-accessibility' ), array( 'status' => 403 ) );
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );

		if ( ! is_string( $nonce ) || false === wp_verify_nonce( $nonce, 'wp_rest' ) ) {
			return new WP_Error( 'kotlinskidev_a11y_bad_nonce', __( 'The security token is missing or expired.', 'kotlinskidev-accessibility' ), array( 'status' => 403 ) );
		}

		return true;
	}

	public function get_channel(): WP_REST_Response {
		return new WP_REST_Response( $this->channel_state() );
	}

	public function set_channel( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$requested = $request->get_param( 'channel' );

		if ( ! Channel::valid( $requested ) ) {
			return new WP_Error( 'kotlinskidev_a11y_bad_channel', __( 'Unknown update channel.', 'kotlinskidev-accessibility' ), array( 'status' => 400 ) );
		}

		if ( $this->channel->locked_by_constant() ) {
			return new WP_Error( 'kotlinskidev_a11y_channel_locked', __( 'The update channel is set in wp-config.php.', 'kotlinskidev-accessibility' ), array( 'status' => 409 ) );
		}

		$changed = $requested !== $this->channel->stored();

		$this->channel->save( $requested );

		if ( $changed ) {
			$this->updater->reset_state();
		}

		return new WP_REST_Response( $this->channel_state() );
	}

	public function get_releases( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$candidates = $this->rollback->candidates( true === $request->get_param( 'refresh' ) );

		if ( $candidates instanceof WP_Error ) {
			$candidates->add_data( array( 'status' => 502 ) );

			return $candidates;
		}

		return new WP_REST_Response(
			array(
				'releases' => array_map(
					static fn ( array $release ): array => array(
						'version'    => $release['version'],
						'prerelease' => $release['prerelease'],
						'url'        => RollbackPage::url( $release['version'] ),
					),
					$candidates
				),
			)
		);
	}

	private function channel_state(): array {
		return array(
			'channel'        => $this->channel->current(),
			'stored'         => $this->channel->stored(),
			'locked'         => $this->channel->locked_by_constant(),
			'updaterEnabled' => $this->updater->enabled(),
			'floor'          => Rollback::FLOOR,
		);
	}
}
