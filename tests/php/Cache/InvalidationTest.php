<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cache;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Cache\Invalidation;
use Kotlinskidev\A11y\Cache\VersionWatcher;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'KOTLINSKIDEV_A11Y_VERSION' ) ) {
	define( 'KOTLINSKIDEV_A11Y_VERSION', '9.9.9' );
}

final class InvalidationTest extends TestCase {

	private array $options = array();

	protected function setUp(): void {
		parent::setUp();

		$this->options = array();

		Functions\when( 'wp_json_encode' )->alias( static fn ( mixed $value, int $flags = 0 ): string|false => json_encode( $value, $flags ) );
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

	protected function tearDown(): void {
		$this->addToAssertionCount( \Mockery::getContainer()->mockery_getExpectationCount() );
		parent::tearDown();
	}

	public function test_fires_on_save(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		( new Repository() )->save( array( 'storage' => array( 'mode' => 'none' ) ) );
	}

	public function test_does_not_fire_when_save_changes_nothing(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new Repository() )->save( array() );
	}

	public function test_fires_on_reset(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => Schema::VERSION,
			'storage'       => array( 'mode' => 'none' ),
		);
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		( new Repository() )->reset();
	}

	public function test_fires_once_per_request(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once();

		$repository = new Repository();
		$repository->save( array( 'storage' => array( 'mode' => 'none' ) ) );
		$repository->save( array( 'storage' => array( 'mode' => 'cookie' ) ) );
		$repository->reset();
	}

	public function test_fires_on_version_change(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = '0.0.1';
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'update' );

		( new VersionWatcher() )->check();

		$this->assertSame( KOTLINSKIDEV_A11Y_VERSION, $this->options['kotlinskidev_a11y_installed_version'] );
	}

	public function test_update_persists_the_migrated_option_without_firing_settings_invalidation(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = '0.4.0';
		$this->options['kotlinskidev_a11y_settings']          = array(
			'schemaVersion' => 4,
			'storage'       => array(
				'mode'    => 'cookie',
				'ttlDays' => 365,
			),
		);
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'update' );

		( new VersionWatcher() )->check();

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'cookie' ),
			),
			$this->options['kotlinskidev_a11y_settings']
		);
	}

	public function test_persist_migrated_leaves_a_current_tree_untouched(): void {
		$current                                     = array(
			'schemaVersion' => Schema::VERSION,
			'storage'       => array( 'mode' => 'cookie' ),
		);
		$this->options['kotlinskidev_a11y_settings'] = $current;

		( new Repository() )->persist_migrated();

		$this->assertSame( $current, $this->options['kotlinskidev_a11y_settings'] );
	}

	public function test_does_not_fire_on_first_install(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();

		$this->assertSame( KOTLINSKIDEV_A11Y_VERSION, $this->options['kotlinskidev_a11y_installed_version'] );
	}

	public function test_first_layer_hash_is_stored_without_firing(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = KOTLINSKIDEV_A11Y_VERSION;
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();

		$this->assertIsString( $this->options[ VersionWatcher::LAYERS_OPTION ] );
	}

	public function test_changed_locks_fire_settings_invalidation_once_then_settle(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = KOTLINSKIDEV_A11Y_VERSION;
		( new VersionWatcher() )->check();
		Repository::flush();
		Invalidation::reset_request_state();

		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		( new VersionWatcher() )->check();
		Repository::flush();
		( new VersionWatcher() )->check();
	}

	public function test_unchanged_layers_do_not_fire(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = KOTLINSKIDEV_A11Y_VERSION;
		( new VersionWatcher() )->check();
		Repository::flush();
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();
	}

	public function test_does_not_fire_when_unchanged(): void {
		$this->options['kotlinskidev_a11y_installed_version'] = KOTLINSKIDEV_A11Y_VERSION;
		$this->options['kotlinskidev_a11y_settings']          = array( 'schemaVersion' => 4 );
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new VersionWatcher() )->check();

		$this->assertSame( array( 'schemaVersion' => 4 ), $this->options['kotlinskidev_a11y_settings'] );
	}

	public function test_register_skips_check_on_front_end(): void {
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_doing_cron' )->justReturn( false );
		Functions\expect( 'get_option' )->never();

		( new VersionWatcher() )->register();
	}
}
