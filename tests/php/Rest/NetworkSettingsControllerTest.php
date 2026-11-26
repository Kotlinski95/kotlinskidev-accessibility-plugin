<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Rest\NetworkSettingsController;
use Kotlinskidev\A11y\Rest\SettingsController;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;
use WP_Error;
use WP_REST_Request;

require_once __DIR__ . '/WpRestStubs.php';

final class NetworkSettingsControllerTest extends TestCase {

	private array $site_options = array();
	private array $options      = array();

	protected function setUp(): void {
		parent::setUp();

		$this->site_options = array();
		$this->options      = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'is_multisite' )->justReturn( true );
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'get_site_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->site_options[ $name ] ?? $fallback );
		Functions\when( 'update_site_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->site_options[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ): bool {
				unset( $this->site_options[ $name ] );

				return true;
			}
		);
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->options[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				unset( $this->options[ $name ] );

				return true;
			}
		);
	}

	private function controller(): NetworkSettingsController {
		return new NetworkSettingsController();
	}

	private function save( array $body, array $params = array() ): mixed {
		$result = $this->controller()->update_settings( new WP_REST_Request( $body, $params ) );

		Repository::flush();

		return $result;
	}

	public function test_routes_are_absent_on_single_site(): void {
		Functions\when( 'is_multisite' )->justReturn( false );
		Functions\expect( 'register_rest_route' )->never();

		$this->controller()->register_routes();

		$this->addToAssertionCount( 1 );
	}

	public function test_every_route_requires_the_permission_callback(): void {
		$registered = array();

		Functions\when( 'register_rest_route' )->alias(
			function ( string $route_namespace, string $route, array $endpoints ) use ( &$registered ): bool {
				$registered[ $route_namespace . $route ] = $endpoints;

				return true;
			}
		);

		$controller = $this->controller();
		$controller->register_routes();

		$this->assertSame(
			array(
				'kotlinskidev-a11y/v1/network/settings',
				'kotlinskidev-a11y/v1/network/schema',
				'kotlinskidev-a11y/v1/network/export',
				'kotlinskidev-a11y/v1/network/import',
				'kotlinskidev-a11y/v1/network/reset',
			),
			array_keys( $registered )
		);

		foreach ( $registered as $endpoints ) {
			foreach ( $endpoints as $endpoint ) {
				$this->assertSame( array( $controller, 'check_permission' ), $endpoint['permission_callback'] );
			}
		}
	}

	public function test_permission_needs_the_network_capability_and_a_valid_nonce(): void {
		$asked = array();

		Functions\when( 'current_user_can' )->alias(
			static function ( string $cap ) use ( &$asked ): bool {
				$asked[] = $cap;

				return true;
			}
		);
		Functions\when( 'wp_verify_nonce' )->alias( static fn ( string $nonce ): int|false => 'good' === $nonce ? 1 : false );

		$controller = $this->controller();

		$this->assertTrue( $controller->check_permission( new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'good' ) ) ) );
		$this->assertFalse( $controller->check_permission( new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'bad' ) ) ) );
		$this->assertFalse( $controller->check_permission( new WP_REST_Request( null ) ) );
		$this->assertSame( 'manage_network_options', $asked[0] );
	}

	public function test_permission_denied_without_the_network_capability(): void {
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\when( 'wp_verify_nonce' )->justReturn( 1 );

		$this->assertFalse( $this->controller()->check_permission( new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'good' ) ) ) );
	}

	public function test_get_returns_the_defaults_tree_and_an_empty_lock_list(): void {
		$data = $this->controller()->get_settings()->get_data();

		$this->assertSame( array(), $data['locked'] );

		unset( $data['locked'] );

		$this->assertSame( Schema::defaults(), $data );
	}

	public function test_post_stores_only_values_that_differ_from_defaults(): void {
		$this->save( array( 'storage' => array( 'mode' => 'none' ) ) );

		$stored = $this->site_options[ Repository::NETWORK_OPTION ];

		$this->assertSame( array( 'storage' => array( 'mode' => 'none' ) ), $stored['settings'] );
		$this->assertSame( array(), $stored['locked'] );
		$this->assertSame( Schema::VERSION, $stored['schemaVersion'] );
	}

	public function test_network_default_reaches_a_site_that_did_not_override(): void {
		$this->save( array( 'storage' => array( 'mode' => 'none' ) ) );

		$this->assertSame( 'none', ( new Repository() )->get()['storage']['mode'] );
	}

	public function test_site_override_wins_over_network_default(): void {
		$this->save( array( 'storage' => array( 'mode' => 'none' ) ) );
		$this->options[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'storage'       => array( 'mode' => 'cookie' ),
		);
		Repository::flush();

		$this->assertSame( 'cookie', ( new Repository() )->get()['storage']['mode'] );
	}

	public function test_a_network_lock_beats_the_site_value_and_blocks_a_site_write(): void {
		$this->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'locked'  => array( 'storage.mode' ),
			)
		);
		$this->options[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'storage'       => array( 'mode' => 'cookie' ),
		);
		Repository::flush();
		Functions\when( 'current_user_can' )->justReturn( true );

		$this->assertSame( 'none', ( new Repository() )->get()['storage']['mode'] );

		$result = ( new SettingsController() )->update_settings( new WP_REST_Request( array( 'storage' => array( 'mode' => 'cookie' ) ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 409, $result->data['status'] );
		$this->assertSame( array( 'storage.mode' ), $result->data['paths'] );
	}

	public function test_lock_list_is_validated_sorted_and_deduplicated(): void {
		$this->save( array( 'locked' => array( 'widget.size', 'storage.mode', 'widget.size' ) ) );

		$this->assertSame( array( 'storage.mode', 'widget.size' ), $this->site_options[ Repository::NETWORK_OPTION ]['locked'] );
	}

	public function test_invalid_lock_lists_are_rejected(): void {
		foreach ( array( 'nope', array( 'unknown.path' ), array( 'schemaVersion' ), array( 5 ), array( 'a' => 'storage.mode' ) ) as $bad ) {
			$result = $this->controller()->update_settings( new WP_REST_Request( array( 'locked' => $bad ) ) );

			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 400, $result->data['status'] );
		}

		$this->assertSame( array(), $this->site_options );
	}

	public function test_values_are_sanitized_through_the_schema(): void {
		$result = $this->save( array( 'theme' => array( 'mode' => 'nope' ) ) );

		$this->assertSame( Schema::defaults()['theme']['mode'], $result->get_data()['theme']['mode'] );
	}

	public function test_dry_run_saves_nothing_and_reports_changes(): void {
		$data = $this->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'theme'   => array( 'mode' => 'nope' ),
				'locked'  => array( 'storage.mode' ),
			),
			array( 'dry_run' => true )
		)->get_data();

		$this->assertSame( array(), $this->site_options );
		$this->assertSame( 'none', $data['settings']['storage']['mode'] );
		$this->assertSame( array( 'theme.mode' ), $data['adjusted'] );
		$this->assertSame( array( 'storage.mode', 'locked' ), array_column( $data['changes'], 'path' ) );
		$this->assertSame( 'network', $data['changes'][0]['source'] );
	}

	public function test_oversized_body_is_413(): void {
		$result = $this->controller()->update_settings( new WP_REST_Request( array(), array(), str_repeat( 'a', SettingsController::MAX_BODY_BYTES + 1 ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 413, $result->data['status'] );
	}

	public function test_non_array_body_is_400(): void {
		$result = $this->controller()->update_settings( new WP_REST_Request( 'nope' ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_schema_declares_network_scope_and_no_locks(): void {
		$data = $this->controller()->get_schema()->get_data();

		$this->assertSame( 'network', $data['scope'] );
		$this->assertSame( array(), $data['locked'] );
		$this->assertSame( Schema::definitions(), $data['definitions'] );
		$this->assertNull( $data['editable'] );
	}

	public function test_saving_a_change_fires_the_invalidation_once(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		$this->save( array( 'storage' => array( 'mode' => 'none' ) ) );
		$this->save( array( 'widget' => array( 'size' => 'lg' ) ) );
		$this->addToAssertionCount( 1 );
	}

	public function test_saving_without_a_change_does_not_fire_the_invalidation(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		$this->save( array() );
		$this->addToAssertionCount( 1 );
	}

	public function test_export_then_import_round_trips_with_locks(): void {
		$this->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'locked'  => array( 'storage.mode' ),
			)
		);

		$exported = $this->controller()->export_settings()->get_data();

		$this->assertSame( 'network', $exported['scope'] );
		$this->assertSame( array( 'storage.mode' ), $exported['locked'] );

		$this->controller()->reset_settings( new WP_REST_Request( null ) );
		Repository::flush();

		$this->assertArrayNotHasKey( Repository::NETWORK_OPTION, $this->site_options );

		$imported = $this->controller()->import_settings( new WP_REST_Request( $exported ) )->get_data();
		Repository::flush();

		$this->assertSame( 'none', $imported['settings']['storage']['mode'] );
		$this->assertSame( array( 'storage.mode' ), $imported['settings']['locked'] );
		$this->assertSame( array( 'storage.mode' ), $this->site_options[ Repository::NETWORK_OPTION ]['locked'] );
	}

	public function test_import_refuses_a_site_scope_file_and_a_newer_schema(): void {
		$envelope = $this->controller()->export_settings()->get_data();

		$wrong = $this->controller()->import_settings( new WP_REST_Request( array_merge( $envelope, array( 'scope' => 'site' ) ) ) );
		$newer = $this->controller()->import_settings( new WP_REST_Request( array_merge( $envelope, array( 'schemaVersion' => Schema::VERSION + 1 ) ) ) );

		$this->assertSame( 400, $wrong->data['status'] );
		$this->assertSame( 'kotlinskidev_a11y_wrong_scope', $wrong->code );
		$this->assertSame( 409, $newer->data['status'] );
	}

	public function test_reset_with_paths_removes_those_values_and_locks_only(): void {
		$this->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'widget'  => array( 'size' => 'lg' ),
				'locked'  => array( 'storage.mode', 'widget.size' ),
			)
		);

		$this->controller()->reset_settings( new WP_REST_Request( array( 'paths' => array( 'storage' ) ) ) );

		$stored = $this->site_options[ Repository::NETWORK_OPTION ];

		$this->assertSame( 'lg', $stored['settings']['widget']['size'] );
		$this->assertSame( array( 'widget.size' ), $stored['locked'] );
	}

	public function test_reset_validates_paths_and_dry_run_saves_nothing(): void {
		$this->save( array( 'storage' => array( 'mode' => 'none' ) ) );
		$before = $this->site_options;

		foreach ( array( array( 'paths' => array() ), array( 'paths' => array( 'nope.nope' ) ), array( 'paths' => 'storage' ), array( 'paths' => array( 'schemaVersion' ) ) ) as $body ) {
			$this->assertSame( 400, $this->controller()->reset_settings( new WP_REST_Request( $body ) )->data['status'] );
		}

		$dry = $this->controller()->reset_settings( new WP_REST_Request( null, array( 'dry_run' => true ) ) )->get_data();

		$this->assertSame( $before, $this->site_options );
		$this->assertSame( array( 'storage.mode' ), array_column( $dry['changes'], 'path' ) );
	}
}
