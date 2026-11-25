<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Rest;

use Kotlinskidev\A11y\Admin\Access;
use Kotlinskidev\A11y\Settings\Importer;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

final class SettingsController {

	public const REST_NAMESPACE = 'kotlinskidev-a11y/v1';

	public const MAX_BODY_BYTES = 262144;

	private const PATH_PATTERN = '/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/';

	private Repository $repository;
	private Importer $importer;
	private Access $access;

	public function __construct( ?Repository $repository = null, ?Importer $importer = null, ?Access $access = null ) {
		$this->repository = $repository ?? new Repository();
		$this->importer   = $importer ?? new Importer( $this->repository );
		$this->access     = $access ?? new Access();
	}

	public function register_routes(): void {
		$dry_run = array(
			'dry_run' => array(
				'type'              => 'boolean',
				'default'           => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'validate_callback' => 'rest_is_boolean',
			),
		);
		$routes  = array(
			'/settings' => array(
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
					'args'     => $dry_run,
				),
			),
			'/reset'    => array(
				array(
					'methods'  => 'POST',
					'callback' => array( $this, 'reset_settings' ),
					'args'     => $dry_run,
				),
			),
		);

		foreach ( $routes as $route => $endpoints ) {
			register_rest_route( self::REST_NAMESPACE, $route, $this->with_permission( $route, $endpoints ) );
		}
	}

	public function check_permission(): bool {
		return Access::FULL === $this->access->level();
	}

	public function check_customer_permission(): bool {
		return Access::NONE !== $this->access->level();
	}

	public function get_settings(): WP_REST_Response {
		$settings = $this->repository->get();
		$editable = $this->access->editable_paths();

		return new WP_REST_Response( null === $editable ? $settings : $this->access->subtree( $settings, $editable ) );
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

		$report   = $this->importer->inspect( $posted );
		$editable = $this->access->editable_paths();

		if ( null !== $editable ) {
			return $this->update_as_customer( $request, $posted, $report, $editable );
		}

		if ( array() !== $report['conflicts'] ) {
			return new WP_Error(
				'kotlinskidev_a11y_locked',
				__( 'Some of these settings are locked by site configuration.', 'kotlinskidev-accessibility' ),
				array(
					'status' => 409,
					'paths'  => $report['conflicts'],
				)
			);
		}

		$sparse = $this->repository->resolve_save( $this->deep_merge( $this->repository->get(), $posted ) );

		if ( ! $this->is_dry_run( $request ) ) {
			return new WP_REST_Response( $this->repository->commit( $sparse ) );
		}

		$after = $this->repository->effective_from( $sparse );

		return new WP_REST_Response(
			array(
				'settings' => $after,
				'changes'  => $this->repository->changes( $this->repository->get(), $after, $sparse ),
				'adjusted' => $report['adjusted'],
				'locked'   => $report['locked'],
			)
		);
	}

	public function get_schema(): WP_REST_Response {
		$editable = $this->access->editable_paths();
		$schema   = array(
			'version'           => Schema::VERSION,
			'definitions'       => Schema::definitions(),
			'defaults'          => Schema::defaults(),
			'features'          => Schema::feature_keys(),
			'profiles'          => Schema::profile_keys(),
			'presets'           => Schema::performance_presets(),
			'effectiveDefaults' => $this->repository->effective_defaults(),
			'locked'            => array_keys( $this->repository->locked() ),
			'sources'           => $this->repository->sources(),
			'access'            => Access::FULL,
			'editable'          => null,
			'scope'             => 'site',
		);

		return new WP_REST_Response( null === $editable ? $schema : $this->narrow_schema( $schema, $editable ) );
	}

	public function export_settings(): WP_REST_Response {
		return new WP_REST_Response( $this->importer->envelope() );
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

		$result = $this->importer->run( $body, $this->is_dry_run( $request ) );

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
			return new WP_REST_Response( $this->repository->reset( $prefixes ) );
		}

		$sparse = $this->repository->reset_stored( $prefixes );
		$after  = $this->repository->effective_from( $sparse );

		return new WP_REST_Response(
			array(
				'settings' => $after,
				'changes'  => $this->repository->changes( $this->repository->get(), $after, $sparse ),
			)
		);
	}

	private function update_as_customer( WP_REST_Request $request, array $posted, array $report, array $editable ): WP_REST_Response|WP_Error {
		$before  = $this->repository->get();
		$sparse  = $this->repository->resolve_save( $this->deep_merge( $before, $posted ) );
		$after   = $this->repository->effective_from( $sparse );
		$changes = $this->repository->changes( $before, $after, $sparse );
		$denied  = array_merge( $report['conflicts'], $this->outside_edits( $posted, $before, $editable ) );

		foreach ( $changes as $change ) {
			if ( ! Access::covers( $editable, $change['path'] ) ) {
				$denied[] = $change['path'];
			}
		}

		if ( array() !== $denied ) {
			return new WP_Error(
				'kotlinskidev_a11y_forbidden_paths',
				__( 'You are not allowed to change some of these settings.', 'kotlinskidev-accessibility' ),
				array(
					'status' => 403,
					'paths'  => array_values( array_unique( $denied ) ),
				)
			);
		}

		if ( ! $this->is_dry_run( $request ) ) {
			return new WP_REST_Response( $this->access->subtree( $this->repository->commit( $sparse ), $editable ) );
		}

		return new WP_REST_Response(
			array(
				'settings' => $this->access->subtree( $after, $editable ),
				'changes'  => $changes,
				'adjusted' => $this->within( $report['adjusted'], $editable ),
				'locked'   => $this->within( $report['locked'], $editable ),
			)
		);
	}

	private function outside_edits( array $posted, array $before, array $editable ): array {
		$paths = array();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			$found = false;
			$value = Schema::read( $posted, $path, $found );

			if ( $found && 'schemaVersion' !== $path && ! Access::covers( $editable, $path ) && Schema::read( $before, $path ) !== $value ) {
				$paths[] = $path;
			}
		}

		return $paths;
	}

	private function narrow_schema( array $schema, array $editable ): array {
		$schema['defaults']          = $this->access->subtree( $schema['defaults'], $editable );
		$schema['effectiveDefaults'] = $this->access->subtree( $schema['effectiveDefaults'], $editable );
		$schema['locked']            = $this->within( $schema['locked'], $editable );
		$schema['sources']           = array_filter(
			$schema['sources'],
			static fn ( string $path ): bool => Access::covers( $editable, $path ),
			ARRAY_FILTER_USE_KEY
		);
		$schema['presets']           = array();
		$schema['access']            = Access::CUSTOMER;
		$schema['editable']          = $editable;

		return $schema;
	}

	private function within( array $paths, array $editable ): array {
		return array_values(
			array_filter(
				$paths,
				static fn ( string $path ): bool => Access::covers( $editable, $path )
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
		if ( strlen( $request->get_body() ) <= self::MAX_BODY_BYTES ) {
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

	private function with_permission( string $route, array $endpoints ): array {
		return array_map(
			function ( array $endpoint ) use ( $route ): array {
				$customer_allowed                = in_array( $route, array( '/schema', '/settings' ), true );
				$endpoint['permission_callback'] = array( $this, $customer_allowed ? 'check_customer_permission' : 'check_permission' );

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
