<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Settings\NetworkSettings;
use Kotlinskidev\A11y\Settings\Schema;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class NetworkSettingsController {

	public const CAPABILITY = 'manage_network_options';

	private const PATH_PATTERN = '/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/';

	private NetworkSettings $network;

	public function __construct( ?NetworkSettings $network = null ) {
		$this->network = $network ?? new NetworkSettings();
	}

	public function register_routes(): void {
		if ( ! is_multisite() ) {
			return;
		}

		$dry_run = array(
			'dry_run' => array(
				'type'              => 'boolean',
				'default'           => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'validate_callback' => 'rest_is_boolean',
			),
		);
		$routes  = array(
			'/network/settings' => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'get_settings' ),
				),
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'update_settings' ),
					'args'     => $dry_run,
				),
			),
			'/network/schema'   => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'get_schema' ),
				),
			),
			'/network/export'   => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'export_settings' ),
				),
			),
			'/network/import'   => array(
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'import_settings' ),
					'args'     => $dry_run,
				),
			),
			'/network/reset'    => array(
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'reset_settings' ),
					'args'     => $dry_run,
				),
			),
		);

		foreach ( $routes as $route => $endpoints ) {
			register_rest_route(
				SettingsController::REST_NAMESPACE,
				$route,
				array_map(
					function ( array $endpoint ): array {
						$endpoint['permission_callback'] = array( $this, 'check_permission' );

						return $endpoint;
					},
					$endpoints
				)
			);
		}
	}

	public function check_permission( WP_REST_Request $request ): bool {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return false;
		}

		$nonce = $request->get_header( 'X-WP-Nonce' );

		return is_string( $nonce ) && false !== wp_verify_nonce( $nonce, 'wp_rest' );
	}

	public function get_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->network->payload() );
	}

	public function get_schema(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'version'           => Schema::VERSION,
				'definitions'       => Schema::definitions(),
				'defaults'          => Schema::defaults(),
				'features'          => Schema::feature_keys(),
				'profiles'          => Schema::profile_keys(),
				'presets'           => Schema::performance_presets(),
				'effectiveDefaults' => Schema::defaults(),
				'locked'            => array(),
				'sources'           => array(),
				'access'            => 'full',
				'editable'          => null,
				'scope'             => 'network',
			)
		);
	}

	public function update_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$oversized = $this->reject_oversized( $request );

		if ( null !== $oversized ) {
			return $oversized;
		}

		$posted = $request->get_json_params();

		if ( ! is_array( $posted ) ) {
			return $this->invalid_body();
		}

		$locked = $this->network->locked();

		if ( array_key_exists( 'locked', $posted ) ) {
			$requested = $this->network->valid_locks( $posted['locked'] );

			if ( null === $requested ) {
				return $this->invalid_paths();
			}

			$locked = $requested;
		}

		$before = $this->network->payload();
		$next   = $this->network->resolve( $this->network->apply( $posted ), $locked );

		if ( ! $this->is_dry_run( $request ) ) {
			return new WP_REST_Response( $this->network->commit( $next ) );
		}

		$after = $this->network->preview( $next );

		return new WP_REST_Response(
			array(
				'settings' => $after,
				'changes'  => $this->network->changes( $before, $after ),
				'adjusted' => $this->network->adjusted( $posted ),
				'locked'   => array(),
			)
		);
	}

	public function export_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->network->envelope() );
	}

	public function import_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$oversized = $this->reject_oversized( $request );

		if ( null !== $oversized ) {
			return $oversized;
		}

		$body = $request->get_json_params();

		if ( ! is_array( $body ) ) {
			return $this->invalid_body();
		}

		$result = $this->network->import( $body, $this->is_dry_run( $request ) );

		return $result instanceof WP_Error ? $result : new WP_REST_Response( $result );
	}

	public function reset_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$oversized = $this->reject_oversized( $request );

		if ( null !== $oversized ) {
			return $oversized;
		}

		$prefixes = $this->reset_prefixes( $request->get_json_params() );

		if ( $prefixes instanceof WP_Error ) {
			return $prefixes;
		}

		if ( ! $this->is_dry_run( $request ) ) {
			return new WP_REST_Response( $this->network->reset( $prefixes ) );
		}

		$before = $this->network->payload();
		$after  = $this->network->payload_after_reset( $prefixes );

		return new WP_REST_Response(
			array(
				'settings' => $after,
				'changes'  => $this->network->changes( $before, $after ),
			)
		);
	}

	private function reset_prefixes( mixed $body ): array|WP_Error {
		if ( null === $body || array() === $body ) {
			return array();
		}

		if ( ! is_array( $body ) || ! array_key_exists( 'paths', $body ) ) {
			return $this->invalid_paths();
		}

		$paths = $body['paths'];

		if ( ! is_array( $paths ) || array() === $paths || ! array_is_list( $paths ) ) {
			return $this->invalid_paths();
		}

		foreach ( $paths as $path ) {
			if ( ! is_string( $path ) || 1 !== preg_match( self::PATH_PATTERN, $path ) || 'schemaVersion' === $path || ! Schema::is_known_prefix( $path ) ) {
				return $this->invalid_paths();
			}
		}

		return array_values( array_unique( $paths ) );
	}

	private function is_dry_run( WP_REST_Request $request ): bool {
		return true === filter_var( $request->get_param( 'dry_run' ), FILTER_VALIDATE_BOOLEAN );
	}

	private function reject_oversized( WP_REST_Request $request ): ?WP_Error {
		if ( strlen( $request->get_body() ) <= SettingsController::MAX_BODY_BYTES ) {
			return null;
		}

		return new WP_Error(
			'kotlinskidev_a11y_too_large',
			__( 'The request body is too large.', 'kotlinskidev-accessibility' ),
			array( 'status' => 413 )
		);
	}

	private function invalid_paths(): WP_Error {
		return new WP_Error(
			'kotlinskidev_a11y_invalid_paths',
			__( 'The paths must be a list of known setting paths.', 'kotlinskidev-accessibility' ),
			array( 'status' => 400 )
		);
	}

	private function invalid_body(): WP_Error {
		return new WP_Error(
			'kotlinskidev_a11y_invalid_body',
			__( 'The request body must be a JSON object.', 'kotlinskidev-accessibility' ),
			array( 'status' => 400 )
		);
	}
}
