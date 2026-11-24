<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
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
	}

	public function test_import_round_trips_export(): void {
		$controller = new SettingsController();
		$controller->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'none' ) ) ) );

		$exported = $controller->export_settings()->get_data();

		$controller->reset_settings();
		Repository::flush();

		$imported = $controller->import_settings( new WP_REST_Request( $exported ) )->get_data();

		$this->assertSame( $exported, $imported );
		$this->assertSame( $exported, $controller->get_settings()->get_data() );
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

		$this->assertSame( Schema::defaults(), $controller->reset_settings()->get_data() );
		$this->assertSame( Schema::defaults(), $controller->get_settings()->get_data() );
	}
}
