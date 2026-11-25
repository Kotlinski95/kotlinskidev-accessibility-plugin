<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Rest\TriggerOptionsController;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/WpRestStubs.php';

final class TriggerOptionsControllerTest extends TestCase {

	private array $stored = array();

	protected function setUp(): void {
		parent::setUp();

		$this->stored = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->stored[ $name ] ?? $fallback );
	}

	public function test_registers_a_get_route_for_editors(): void {
		$controller = new TriggerOptionsController();

		Functions\expect( 'register_rest_route' )
			->once()
			->with(
				'kotlinskidev-a11y/v1',
				'/trigger-options',
				\Mockery::on(
					static fn ( array $args ): bool => 'GET' === $args['methods']
						&& array( $controller, 'check_permission' ) === $args['permission_callback']
						&& array( $controller, 'get_options' ) === $args['callback']
				)
			);

		$controller->register_routes();
		$this->addToAssertionCount( 1 );
	}

	public function test_permission_is_edit_posts(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'edit_posts' )->andReturn( true );

		$this->assertTrue( ( new TriggerOptionsController() )->check_permission() );
	}

	public function test_permission_denied_for_readers(): void {
		Functions\when( 'current_user_can' )->justReturn( false );

		$this->assertFalse( ( new TriggerOptionsController() )->check_permission() );
	}

	public function test_lists_every_key_by_default(): void {
		$data = ( new TriggerOptionsController() )->get_options()->get_data();

		$this->assertSame( Schema::feature_keys(), $data['features'] );
		$this->assertSame( Schema::profile_keys(), $data['profiles'] );
		$this->assertSame( array( 'features', 'profiles' ), array_keys( $data ) );
	}

	public function test_omits_disabled_features_and_profiles(): void {
		$feature = Schema::feature_keys()[0];
		$profile = Schema::profile_keys()[0];

		$this->stored['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => Schema::VERSION,
			'features'      => array( $feature => array( 'enabled' => false ) ),
			'profiles'      => array( $profile => array( 'enabled' => false ) ),
		);

		$data = ( new TriggerOptionsController() )->get_options()->get_data();

		$this->assertNotContains( $feature, $data['features'] );
		$this->assertNotContains( $profile, $data['profiles'] );
		$this->assertCount( count( Schema::feature_keys() ) - 1, $data['features'] );
		$this->assertCount( count( Schema::profile_keys() ) - 1, $data['profiles'] );
	}
}
