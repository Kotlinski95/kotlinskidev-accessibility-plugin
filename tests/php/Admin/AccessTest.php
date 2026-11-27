<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\Access;
use Kotlinskidev\A11y\Rest\SettingsController;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use WP_Error;
use WP_REST_Request;

require_once dirname( __DIR__ ) . '/Rest/WpRestStubs.php';

final class AccessTest extends TestCase {

	private array $stored = array();
	private array $caps   = array();

	protected function setUp(): void {
		parent::setUp();

		$this->stored = array();
		$this->caps   = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->stored[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->stored[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_option' )->justReturn( true );
		Functions\when( 'current_user_can' )->alias( fn ( string $cap ): bool => in_array( $cap, $this->caps, true ) );
		Functions\when( 'user_can' )->alias( fn ( int $user, string $cap ): bool => 7 === $user && 'kotlinskidev_a11y_customize' === $cap );
	}

	private function as_customer(): void {
		$this->caps = array( 'kotlinskidev_a11y_customize' );
	}

	private function as_admin(): void {
		$this->caps = array( 'manage_options' );
	}

	public function test_levels(): void {
		$access = new Access();

		$this->assertSame( Access::NONE, $access->level() );

		$this->as_customer();
		$this->assertSame( Access::CUSTOMER, $access->level() );

		$this->caps = array( 'manage_options', 'kotlinskidev_a11y_customize' );
		$this->assertSame( Access::FULL, $access->level() );
	}

	public function test_level_for_explicit_user(): void {
		$this->assertSame( Access::CUSTOMER, ( new Access() )->level( 7 ) );
		$this->assertSame( Access::NONE, ( new Access() )->level( 8 ) );
	}

	public function test_menu_capability_per_level(): void {
		$access = new Access();

		$this->as_admin();
		$this->assertSame( 'manage_options', $access->menu_capability() );

		$this->as_customer();
		$this->assertSame( 'kotlinskidev_a11y_customize', $access->menu_capability() );
	}

	public function test_customer_capability_is_filterable(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->once()->andReturn( 'kotlinskidev_a11y_editor' );

		$this->assertSame( 'kotlinskidev_a11y_editor', ( new Access() )->customer_capability() );
	}

	public static function foreign_capabilities(): array {
		return array(
			'core'         => array( 'edit_pages' ),
			'admin'        => array( 'manage_options' ),
			'bare prefix'  => array( 'kotlinskidev_a11y_' ),
			'empty'        => array( '' ),
			'not a string' => array( 7 ),
		);
	}

	#[DataProvider( 'foreign_capabilities' )]
	public function test_customer_capability_outside_the_plugin_prefix_falls_back( mixed $candidate ): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->once()->andReturn( $candidate );

		$this->assertSame( 'kotlinskidev_a11y_customize', ( new Access() )->customer_capability() );
	}

	public function test_default_editable_paths(): void {
		$this->as_customer();

		$this->assertSame( array( 'labels', 'statement', 'tokens', 'panel', 'theme.mode' ), ( new Access() )->editable_paths() );
	}

	public function test_full_access_has_no_path_limit(): void {
		$this->as_admin();

		$this->assertNull( ( new Access() )->editable_paths() );
		$this->assertTrue( ( new Access() )->can_edit( 'customCss' ) );
	}

	public function test_filter_can_only_narrow_paths(): void {
		$this->as_customer();
		Filters\expectApplied( 'kotlinskidev_a11y_customer_paths' )->andReturn( array( 'labels', 'tokens.primary', 'customCss', 'theme', 'theme.darkSelector', 'performance', 7, 'nonsense.path' ) );

		$access = new Access();

		$this->assertSame( array( 'labels', 'tokens.primary' ), $access->editable_paths() );
		$this->assertTrue( $access->can_edit( 'tokens.primary' ) );
		$this->assertFalse( $access->can_edit( 'tokens.radius' ) );
		$this->assertFalse( $access->can_edit( 'customCss' ) );
	}

	public function test_can_edit_matches_prefixes_only(): void {
		$this->as_customer();
		$access = new Access();

		$this->assertTrue( $access->can_edit( 'statement.content' ) );
		$this->assertTrue( $access->can_edit( 'panel.sections.skip' ) );
		$this->assertTrue( $access->can_edit( 'theme.mode' ) );
		$this->assertFalse( $access->can_edit( 'theme.darkSelector' ) );
		$this->assertFalse( $access->can_edit( 'theme.lightSelector' ) );
		$this->assertFalse( $access->can_edit( 'customCss' ) );
		$this->assertFalse( $access->can_edit( 'performance.strategy' ) );
		$this->assertFalse( $access->can_edit( 'panelx' ) );
	}

	public function test_none_level_cannot_edit(): void {
		$this->assertFalse( ( new Access() )->can_edit( 'labels' ) );
		$this->assertSame( array( 'labels', 'statement', 'tokens', 'panel', 'theme.mode' ), ( new Access() )->editable_paths() );
	}

	public function test_grant_and_revoke(): void {
		$role = new class() {
			public array $added   = array();
			public array $removed = array();

			public function add_cap( string $cap ): void {
				$this->added[] = $cap;
			}

			public function remove_cap( string $cap ): void {
				$this->removed[] = $cap;
			}
		};

		Functions\when( 'get_role' )->alias( static fn ( string $name ): ?object => 'editor' === $name ? $role : null );

		$access = new Access();

		$this->assertTrue( $access->grant( 'editor' ) );
		$this->assertFalse( $access->grant( 'ghost' ) );
		$this->assertTrue( $access->revoke( 'editor' ) );
		$this->assertFalse( $access->revoke( 'ghost' ) );
		$this->assertSame( array( 'kotlinskidev_a11y_customize' ), $role->added );
		$this->assertSame( array( 'kotlinskidev_a11y_customize' ), $role->removed );
	}

	public function test_roles_lists_roles_holding_the_capability(): void {
		$holder = new class() {
			public function has_cap( string $cap ): bool {
				return 'kotlinskidev_a11y_customize' === $cap;
			}
		};
		$other  = new class() {
			public function has_cap( string $cap ): bool {
				return false;
			}
		};

		Functions\when( 'wp_roles' )->justReturn(
			(object) array(
				'role_objects' => array(
					'editor' => $holder,
					'author' => $other,
				),
			)
		);

		$this->assertSame( array( 'editor' ), ( new Access() )->roles() );
	}

	public function test_customer_rest_permission(): void {
		$controller = new SettingsController();

		$this->assertFalse( $controller->check_customer_permission() );
		$this->assertFalse( $controller->check_permission() );

		$this->as_customer();
		$this->assertTrue( $controller->check_customer_permission() );
		$this->assertFalse( $controller->check_permission() );
	}

	public function test_customer_get_returns_only_editable_subtree(): void {
		$this->as_customer();
		$this->stored['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => Schema::VERSION,
			'performance'   => array( 'strategy' => 'eager' ),
			'customCss'     => '.x{color:red}',
			'tokens'        => array( 'primary' => '#112233' ),
		);

		$data = ( new SettingsController() )->get_settings()->get_data();

		$this->assertSame( '#112233', $data['tokens']['primary'] );
		$this->assertArrayHasKey( 'panel', $data );
		$this->assertArrayHasKey( 'labels', $data );
		$this->assertSame( array( 'mode' ), array_keys( $data['theme'] ) );
		$this->assertSame( array( 'labels', 'panel', 'statement', 'theme', 'tokens' ), $this->sorted_keys( $data ) );
	}

	public function test_customer_schema_hides_non_editable_state(): void {
		$this->as_customer();
		$this->stored['kotlinskidev_a11y_settings'] = array( 'performance' => array( 'strategy' => 'eager' ) );

		$schema = ( new SettingsController() )->get_schema()->get_data();

		$this->assertSame( 'customer', $schema['access'] );
		$this->assertSame( array( 'labels', 'statement', 'tokens', 'panel', 'theme.mode' ), $schema['editable'] );
		$this->assertSame( array( 'labels', 'panel', 'statement', 'theme', 'tokens' ), $this->sorted_keys( $schema['defaults'] ) );
		$this->assertSame( array( 'labels', 'panel', 'statement', 'theme', 'tokens' ), $this->sorted_keys( $schema['effectiveDefaults'] ) );
		$this->assertSame( array(), $schema['presets'] );
		$this->assertSame( array(), $schema['sources'] );
	}

	public function test_admin_schema_reports_full_access(): void {
		$this->as_admin();

		$schema = ( new SettingsController() )->get_schema()->get_data();

		$this->assertSame( 'full', $schema['access'] );
		$this->assertNull( $schema['editable'] );
	}

	public function test_customer_can_save_an_editable_path(): void {
		$this->as_customer();

		$data = ( new SettingsController() )->update_settings( new WP_REST_Request( array( 'tokens' => array( 'primary' => '#112233' ) ) ) )->get_data();

		$this->assertSame( '#112233', $data['tokens']['primary'] );
		$this->assertArrayNotHasKey( 'performance', $data );
		$this->assertSame( '#112233', $this->stored['kotlinskidev_a11y_settings']['tokens']['primary'] );
	}

	public function test_customer_dry_run_saves_nothing_and_leaks_nothing(): void {
		$this->as_customer();

		$data = ( new SettingsController() )->update_settings(
			new WP_REST_Request( array( 'tokens' => array( 'primary' => '#112233' ) ), array( 'dry_run' => true ) )
		)->get_data();

		$this->assertSame( array(), $this->stored );
		$this->assertSame( array( 'tokens.primary' ), array_column( $data['changes'], 'path' ) );
		$this->assertArrayNotHasKey( 'performance', $data['settings'] );
	}

	public static function forbidden_bodies(): array {
		return array(
			'performance' => array( array( 'performance' => array( 'strategy' => 'eager' ) ), 'performance.strategy' ),
			'custom css'  => array( array( 'customCss' => '.x{color:red}' ), 'customCss' ),
			'selector'    => array( array( 'theme' => array( 'darkSelector' => 'body.night' ) ), 'theme.darkSelector' ),
			'mixed'       => array(
				array(
					'tokens'  => array( 'primary' => '#112233' ),
					'storage' => array( 'key' => 'other' ),
				),
				'storage.key',
			),
			'maintenance' => array( array( 'maintenance' => array( 'keepDataOnUninstall' => true ) ), 'maintenance.keepDataOnUninstall' ),
		);
	}

	/**
	 * @dataProvider forbidden_bodies
	 */
	public function test_customer_forbidden_paths_get_403_and_nothing_saves( array $body, string $path ): void {
		$this->as_customer();

		foreach ( array( false, true ) as $dry_run ) {
			$result = ( new SettingsController() )->update_settings( new WP_REST_Request( $body, array( 'dry_run' => $dry_run ) ) );

			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'kotlinskidev_a11y_forbidden_paths', $result->code );
			$this->assertSame( 403, $result->data['status'] );
			$this->assertSame( array( $path ), $result->data['paths'] );
		}

		$this->assertSame( array(), $this->stored );
	}

	public function test_customer_cannot_change_locked_path(): void {
		$this->as_customer();
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'tokens.primary' => '#000000' ) );

		$result = ( new SettingsController() )->update_settings( new WP_REST_Request( array( 'tokens' => array( 'primary' => '#112233' ) ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 403, $result->data['status'] );
		$this->assertSame( array(), $this->stored );
	}

	public function test_admin_only_routes_stay_closed_to_customers(): void {
		$registered = array();

		Functions\when( 'register_rest_route' )->alias(
			function ( string $route_namespace, string $route, array $endpoints ) use ( &$registered ): bool {
				$registered[ $route ] = $endpoints;

				return true;
			}
		);

		$controller = new SettingsController();
		$controller->register_routes();
		$this->as_customer();

		foreach ( array( '/export', '/import', '/reset' ) as $route ) {
			foreach ( $registered[ $route ] as $endpoint ) {
				$this->assertFalse( (bool) call_user_func( $endpoint['permission_callback'] ), $route );
			}
		}

		foreach ( array( '/settings', '/schema' ) as $route ) {
			foreach ( $registered[ $route ] as $endpoint ) {
				$this->assertTrue( (bool) call_user_func( $endpoint['permission_callback'] ), $route );
			}
		}
	}

	private function sorted_keys( array $tree ): array {
		$keys = array_keys( $tree );
		sort( $keys );

		return $keys;
	}
}
