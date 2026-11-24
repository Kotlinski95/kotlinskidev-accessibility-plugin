<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class SettingsController {

	public const REST_NAMESPACE = 'kotlinskidev-a11y/v1';

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function register_routes(): void {
		$routes = array(
			'/settings' => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'get_settings' ),
				),
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'update_settings' ),
				),
			),
			'/schema'   => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'get_schema' ),
				),
			),
			'/export'   => array(
				array(
					'methods'  => 'GET',
					'callback' => array( $this, 'export_settings' ),
				),
			),
			'/import'   => array(
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'import_settings' ),
				),
			),
			'/reset'    => array(
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'reset_settings' ),
				),
			),
		);

		foreach ( $routes as $route => $endpoints ) {
			register_rest_route( self::REST_NAMESPACE, $route, $this->with_permission( $endpoints ) );
		}
	}

	public function check_permission(): bool {
		return current_user_can( apply_filters( 'kotlinskidev_a11y_capability', 'manage_options' ) );
	}

	public function get_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->repository->get() );
	}

	public function update_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$posted = $request->get_json_params();

		if ( ! is_array( $posted ) ) {
			return $this->invalid_body();
		}

		$merged = $this->deep_merge( $this->repository->get(), $posted );

		return new WP_REST_Response( $this->repository->save( $merged ) );
	}

	public function get_schema(): WP_REST_Response {
		return new WP_REST_Response(
			array(
				'version'     => Schema::VERSION,
				'definitions' => Schema::definitions(),
				'defaults'    => Schema::defaults(),
				'features'    => Schema::feature_keys(),
				'profiles'    => Schema::profile_keys(),
			)
		);
	}

	public function export_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->repository->get() );
	}

	public function import_settings( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$body = $request->get_json_params();

		if ( ! is_array( $body ) ) {
			return $this->invalid_body();
		}

		return new WP_REST_Response( $this->repository->save( $body ) );
	}

	public function reset_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->repository->reset() );
	}

	private function with_permission( array $endpoints ): array {
		return array_map(
			function ( array $endpoint ): array {
				$endpoint['permission_callback'] = array( $this, 'check_permission' );

				return $endpoint;
			},
			$endpoints
		);
	}

	private function invalid_body(): WP_Error {
		return new WP_Error(
			'kotlinskidev_a11y_invalid_body',
			__( 'The request body must be a JSON object.', 'kotlinskidev-accessibility' ),
			array( 'status' => 400 )
		);
	}

	private function deep_merge( array $base, array $override ): array {
		foreach ( $override as $key => $value ) {
			$current = $base[ $key ] ?? null;

			if ( is_array( $value ) && is_array( $current ) && ! array_is_list( $value ) && ! array_is_list( $current ) ) {
				$base[ $key ] = $this->deep_merge( $current, $value );
			} else {
				$base[ $key ] = $value;
			}
		}

		return $base;
	}
}
