<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\Attributes\DataProvider;
use Kotlinskidev\A11y\Rest\SettingsController;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;
use WP_Error;
use WP_REST_Request;

require_once __DIR__ . '/WpRestStubs.php';

final class SettingsControllerTest extends TestCase {

	private array $stored = array();

	protected function setUp(): void {
		parent::setUp();

		$this->stored = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->stored[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->stored[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				unset( $this->stored[ $name ] );

				return true;
			}
		);
	}

	public function test_permission_uses_default_capability(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'manage_options' )->andReturn( true );

		$this->assertTrue( ( new SettingsController() )->check_permission() );
	}

	public function test_permission_denied_without_capability(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( ( new SettingsController() )->check_permission() );
	}

	public function test_permission_capability_is_filterable(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_capability' )->once()->with( 'manage_options' )->andReturn( 'edit_theme_options' );
		Functions\expect( 'current_user_can' )->once()->with( 'edit_theme_options' )->andReturn( true );

		$this->assertTrue( ( new SettingsController() )->check_permission() );
	}

	public function test_register_routes_attaches_permission_callback_to_every_endpoint(): void {
		$registered = array();

		Functions\when( 'register_rest_route' )->alias(
			function ( string $route_namespace, string $route, array $endpoints ) use ( &$registered ): bool {
				$registered[ $route_namespace . $route ] = $endpoints;

				return true;
			}
		);

		$controller = new SettingsController();
		$controller->register_routes();

		$this->assertSame(
			array(
				'kotlinskidev-a11y/v1/settings',
				'kotlinskidev-a11y/v1/schema',
				'kotlinskidev-a11y/v1/export',
				'kotlinskidev-a11y/v1/import',
				'kotlinskidev-a11y/v1/reset',
			),
			array_keys( $registered )
		);

		foreach ( $registered as $endpoints ) {
			foreach ( $endpoints as $endpoint ) {
				$this->assertSame( array( $controller, 'check_permission' ), $endpoint['permission_callback'] );
			}
		}
	}

	public function test_partial_post_merges_and_keeps_other_keys(): void {
		$controller = new SettingsController();

		$response = $controller->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );
		$data     = $response->get_data();

		$this->assertSame( 'none', $data['storage']['mode'] );
		$this->assertSame( Schema::defaults()['features'], $data['features'] );
		$this->assertSame( Schema::defaults()['widget'], $data['widget'] );
	}

	public function test_second_partial_post_keeps_first_change(): void {
		$controller = new SettingsController();

		$controller->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );
		$data = $controller->update_settings( new WP_REST_Request( array( 'widget' => array( 'position' => array( 'mobile' => 'top-left' ) ) ) ) )->get_data();

		$this->assertSame( 'none', $data['storage']['mode'] );
		$this->assertSame( 'top-left', $data['widget']['position']['mobile'] );
		$this->assertSame( Schema::defaults()['widget']['position']['desktop'], $data['widget']['position']['desktop'] );
	}

	public function test_update_rejects_non_array_body(): void {
		$result = ( new SettingsController() )->update_settings( new WP_REST_Request( 'nope' ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_get_settings_returns_defaults_when_nothing_stored(): void {
		$this->assertSame( Schema::defaults(), ( new SettingsController() )->get_settings()->get_data() );
	}

	public function test_schema_exposes_definitions_and_defaults(): void {
		$data = ( new SettingsController() )->get_schema()->get_data();

		$this->assertSame( Schema::definitions(), $data['definitions'] );
		$this->assertSame( Schema::defaults(), $data['defaults'] );
		$this->assertSame( Schema::VERSION, $data['version'] );
		$this->assertSame( Schema::performance_presets(), $data['presets'] );
		$this->assertArrayHasKey( 'performance.strategy', $data['definitions'] );
	}

	public function test_import_round_trips_export(): void {
		$controller = new SettingsController();
		$controller->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );

		$exported = $controller->export_settings()->get_data();

		$controller->reset_settings( new WP_REST_Request( null ) );
		Repository::flush();

		$imported = $controller->import_settings( new WP_REST_Request( $exported ) )->get_data()['settings'];

		$this->assertSame( $exported['settings'], $imported );
		$this->assertSame( $imported, $controller->get_settings()->get_data() );
	}

	public function test_real_import_with_a_conflicting_lock_is_409_with_paths(): void {
		$this->locked( array( 'storage.mode' => 'none' ) );

		$result = ( new SettingsController() )->import_settings(
			new WP_REST_Request(
				array(
					'schemaVersion' => Schema::VERSION,
					'storage'       => array( 'mode' => 'cookie' ),
				)
			)
		);

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 409, $result->data['status'] );
		$this->assertSame( array( 'storage.mode' ), $result->data['paths'] );
		$this->assertSame( array(), $this->stored );
	}

	public function test_posting_the_settings_output_to_import_does_not_run_legacy_migrations(): void {
		$controller = new SettingsController();
		$controller->update_settings( new WP_REST_Request( array( 'performance' => array( 'strategy' => 'defer' ) ) ) );

		$tree = $controller->get_settings()->get_data();
		$data = $controller->import_settings( new WP_REST_Request( $tree, array( 'dry_run' => true ) ) )->get_data();

		$this->assertSame( array(), $data['changes'] );
		$this->assertSame( Schema::VERSION, $data['from']['schemaVersion'] );
	}

	public function test_import_rejects_bad_body(): void {
		$result = ( new SettingsController() )->import_settings( new WP_REST_Request( null ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_invalid_body', $result->code );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_reset_returns_defaults(): void {
		$controller = new SettingsController();
		$controller->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );

		$this->assertSame( Schema::defaults(), $controller->reset_settings( new WP_REST_Request( null ) )->get_data() );
		$this->assertSame( Schema::defaults(), $controller->get_settings()->get_data() );
	}

	private function locked( array $locks ): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( $locks );
	}

	public function test_dry_run_saves_nothing_and_reports_changes(): void {
		$response = ( new SettingsController() )->update_settings(
			new WP_REST_Request(
				array(
					'storage' => array( 'mode' => 'none' ),
					'theme'   => array( 'mode' => 'nope' ),
				),
				array( 'dry_run' => true )
			)
		);
		$data     = $response->get_data();

		$this->assertSame( array(), $this->stored );
		$this->assertSame( array( 'settings', 'changes', 'adjusted', 'locked' ), array_keys( $data ) );
		$this->assertSame( 'none', $data['settings']['storage']['mode'] );
		$this->assertSame( array( 'storage.mode' ), array_column( $data['changes'], 'path' ) );
		$this->assertSame( array( 'theme.mode' ), $data['adjusted'] );
		$this->assertSame( array(), $data['locked'] );
	}

	public function test_post_stores_only_the_differences(): void {
		( new SettingsController() )->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'none' ),
			),
			$this->stored['kotlinskidev_a11y_settings']
		);
	}

	public function test_post_to_a_locked_path_with_another_value_is_a_409_with_paths(): void {
		$this->locked( array( 'storage.mode' => 'none' ) );

		$result = ( new SettingsController() )->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'cookie' ) ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_locked', $result->code );
		$this->assertSame( 409, $result->data['status'] );
		$this->assertSame( array( 'storage.mode' ), $result->data['paths'] );
		$this->assertSame( array(), $this->stored );
	}

	public function test_post_of_a_full_snapshot_with_the_lock_value_is_accepted_and_ignored(): void {
		$this->locked( array( 'storage.mode' => 'none' ) );
		$controller = new SettingsController();
		$snapshot   = $controller->get_settings()->get_data();

		$snapshot['tokens']['radius'] = '4px';

		$data = $controller->update_settings( new WP_REST_Request( $snapshot, array( 'dry_run' => true ) ) )->get_data();

		$this->assertSame( array( 'storage.mode' ), $data['locked'] );
		$this->assertSame( array( 'tokens.radius' ), array_column( $data['changes'], 'path' ) );

		$controller->update_settings( new WP_REST_Request( $snapshot ) );

		$this->assertArrayNotHasKey( 'mode', $this->stored['kotlinskidev_a11y_settings']['storage'] ?? array() );
		$this->assertSame( '4px', $this->stored['kotlinskidev_a11y_settings']['tokens']['radius'] );
	}

	public function test_oversized_bodies_are_413(): void {
		$controller = new SettingsController();
		$body       = str_repeat( 'x', SettingsController::MAX_BODY_BYTES + 1 );

		$results = array(
			$controller->update_settings( new WP_REST_Request( array(), array(), $body ) ),
			$controller->import_settings( new WP_REST_Request( array(), array(), $body ) ),
			$controller->reset_settings( new WP_REST_Request( array(), array(), $body ) ),
		);

		foreach ( $results as $result ) {
			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'kotlinskidev_a11y_too_large', $result->code );
			$this->assertSame( 413, $result->data['status'] );
		}

		$at_limit = $controller->update_settings( new WP_REST_Request( array(), array(), str_repeat( 'x', SettingsController::MAX_BODY_BYTES ) ) );

		$this->assertNotInstanceOf( WP_Error::class, $at_limit );
	}

	public static function bad_reset_paths(): array {
		return array(
			'not a list'       => array( array( 'paths' => array( 'a' => 'tokens' ) ) ),
			'paths not array'  => array( array( 'paths' => 'tokens' ) ),
			'non string entry' => array( array( 'paths' => array( 5 ) ) ),
			'bad characters'   => array( array( 'paths' => array( 'tokens/../x' ) ) ),
			'leading digit'    => array( array( 'paths' => array( '1tokens' ) ) ),
			'trailing dot'     => array( array( 'paths' => array( 'tokens.' ) ) ),
			'unknown'          => array( array( 'paths' => array( 'nope' ) ) ),
			'unknown deep'     => array( array( 'paths' => array( 'tokens.nope' ) ) ),
			'schema version'   => array( array( 'paths' => array( 'schemaVersion' ) ) ),
			'scalar body'      => array( 'tokens' ),
			'empty paths'      => array( array( 'paths' => array() ) ),
			'object no paths'  => array( array( 'tokens' => 'x' ) ),
		);
	}

	#[DataProvider( 'bad_reset_paths' )]
	public function test_reset_rejects_invalid_paths_with_400( mixed $body ): void {
		$result = ( new SettingsController() )->reset_settings( new WP_REST_Request( $body ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_invalid_paths', $result->code );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_reset_paths_resets_only_those_prefixes(): void {
		$controller = new SettingsController();
		$controller->update_settings(
			new WP_REST_Request(
				array(
					'storage' => array( 'mode' => 'none' ),
					'tokens'  => array( 'radius' => '4px' ),
				)
			)
		);

		$data = $controller->reset_settings( new WP_REST_Request( array( 'paths' => array( 'tokens' ) ) ) )->get_data();

		$this->assertSame( 'none', $data['storage']['mode'] );
		$this->assertSame( Schema::defaults()['tokens'], $data['tokens'] );
	}

	public function test_reset_dry_run_changes_nothing(): void {
		$controller = new SettingsController();
		$controller->update_settings( new WP_REST_Request( array( 'tokens' => array( 'radius' => '4px' ) ) ) );
		$before = $this->stored;

		$data = $controller->reset_settings( new WP_REST_Request( array( 'paths' => array( 'tokens.radius' ) ), array( 'dry_run' => true ) ) )->get_data();

		$this->assertSame( $before, $this->stored );
		$this->assertSame( array( 'settings', 'changes' ), array_keys( $data ) );
		$this->assertSame( '12px', $data['settings']['tokens']['radius'] );
		$this->assertSame( array( 'tokens.radius' ), array_column( $data['changes'], 'path' ) );
		$this->assertSame( array( '4px', '12px', 'default' ), array( $data['changes'][0]['from'], $data['changes'][0]['to'], $data['changes'][0]['source'] ) );
	}

	public function test_export_is_the_envelope_without_locked_paths(): void {
		$this->locked( array( 'storage.mode' => 'none' ) );

		$data = ( new SettingsController() )->export_settings()->get_data();

		$this->assertSame( 'kotlinskidev-accessibility-settings', $data['format'] );
		$this->assertSame( 1, $data['formatVersion'] );
		$this->assertArrayNotHasKey( 'mode', $data['settings']['storage'] );
	}

	public function test_import_dry_run_returns_the_report_and_saves_nothing(): void {
		$result = ( new SettingsController() )->import_settings(
			new WP_REST_Request(
				array(
					'schemaVersion' => 3,
					'storage'       => array( 'mode' => 'none' ),
					'bogus'         => 1,
				),
				array( 'dry_run' => true )
			)
		);
		$data   = $result->get_data();

		$this->assertSame( array( 'settings', 'changes', 'dropped', 'adjusted', 'locked', 'from' ), array_keys( $data ) );
		$this->assertSame( array( 'bogus' ), $data['dropped'] );
		$this->assertSame( array(), $this->stored );
	}

	public function test_import_newer_schema_is_409_and_wrong_scope_is_400(): void {
		$controller = new SettingsController();

		$newer = $controller->import_settings( new WP_REST_Request( array( 'schemaVersion' => 99 ) ) );
		$scope = $controller->import_settings(
			new WP_REST_Request(
				array(
					'format'        => 'kotlinskidev-accessibility-settings',
					'formatVersion' => 1,
					'schemaVersion' => Schema::VERSION,
					'scope'         => 'network',
					'settings'      => array(),
				)
			)
		);

		$this->assertSame( 'kotlinskidev_a11y_newer_schema', $newer->code );
		$this->assertSame( 409, $newer->data['status'] );
		$this->assertSame( 'kotlinskidev_a11y_wrong_scope', $scope->code );
		$this->assertSame( 400, $scope->data['status'] );
	}

	public function test_schema_adds_layer_keys_without_changing_existing_ones(): void {
		$this->locked( array( 'storage.mode' => 'none' ) );
		$this->stored['kotlinskidev_a11y_settings'] = array( 'tokens' => array( 'radius' => '4px' ) );

		$data = ( new SettingsController() )->get_schema()->get_data();

		$this->assertSame( array( 'version', 'definitions', 'defaults', 'features', 'profiles', 'presets', 'effectiveDefaults', 'locked', 'sources', 'access', 'editable', 'scope' ), array_keys( $data ) );
		$this->assertSame( Schema::defaults(), $data['effectiveDefaults'] );
		$this->assertSame( array( 'storage.mode' ), $data['locked'] );
		$this->assertEquals(
			array(
				'storage.mode'  => 'locked',
				'tokens.radius' => 'site',
			),
			$data['sources']
		);
		$this->assertSame( 'full', $data['access'] );
		$this->assertNull( $data['editable'] );
		$this->assertSame( 'site', $data['scope'] );
	}

	public function test_routes_declare_a_boolean_dry_run_arg_on_every_post(): void {
		$registered = array();

		Functions\when( 'register_rest_route' )->alias(
			function ( string $route_namespace, string $route, array $endpoints ) use ( &$registered ): bool {
				$registered[ $route ] = $endpoints;

				return true;
			}
		);

		( new SettingsController() )->register_routes();

		foreach ( array( '/settings', '/import', '/reset' ) as $route ) {
			$post = array_values( array_filter( $registered[ $route ], static fn ( array $endpoint ): bool => 'POST' === $endpoint['methods'] ) )[0];

			$this->assertSame( 'boolean', $post['args']['dry_run']['type'] );
			$this->assertSame( 'rest_sanitize_boolean', $post['args']['dry_run']['sanitize_callback'] );
			$this->assertSame( 'rest_is_boolean', $post['args']['dry_run']['validate_callback'] );
		}
	}
}
