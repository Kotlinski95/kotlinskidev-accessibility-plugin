<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cache;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Cache\VersionWatcher;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'KOTLINSKIDEV_A11Y_VERSION' ) ) {
	define( 'KOTLINSKIDEV_A11Y_VERSION', '9.9.9' );
}

final class InvalidationTest extends TestCase {

	protected function tearDown(): void {
		$this->addToAssertionCount( \Mockery::getContainer()->mockery_getExpectationCount() );
		parent::tearDown();
	}

	public function test_fires_on_save(): void {
		Functions\when( 'update_option' )->justReturn( true );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		( new Repository() )->save( array() );
	}

	public function test_fires_on_reset(): void {
		Functions\when( 'delete_option' )->justReturn( true );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		( new Repository() )->reset();
	}

	public function test_fires_once_per_request(): void {
		Functions\when( 'update_option' )->justReturn( true );
		Functions\when( 'delete_option' )->justReturn( true );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once();

		$repository = new Repository();
		$repository->save( array() );
		$repository->save( array() );
		$repository->reset();
	}

	public function test_fires_on_version_change(): void {
		Functions\when( 'get_option' )->justReturn( '0.0.1' );
		Functions\expect( 'update_option' )->once()->with( 'kotlinskidev_a11y_installed_version', KOTLINSKIDEV_A11Y_VERSION );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'update' );

		( new VersionWatcher() )->check();
	}

	public function test_does_not_fire_on_first_install(): void {
		Functions\when( 'get_option' )->justReturn( '' );
		Functions\expect( 'update_option' )->once()->with( 'kotlinskidev_a11y_installed_version', KOTLINSKIDEV_A11Y_VERSION );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();
	}

	public function test_does_not_fire_when_unchanged(): void {
		Functions\when( 'get_option' )->justReturn( KOTLINSKIDEV_A11Y_VERSION );
		Functions\expect( 'update_option' )->never();
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();
	}

	public function test_register_skips_check_on_front_end(): void {
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_doing_cron' )->justReturn( false );
		Functions\expect( 'get_option' )->never();

		( new VersionWatcher() )->register();
	}
}
