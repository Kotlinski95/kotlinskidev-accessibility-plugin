<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class RepositoryTest extends TestCase {

	public function test_get_returns_defaults_when_nothing_stored(): void {
		Functions\expect( 'get_option' )->once()->with( 'kotlinskidev_a11y_settings', array() )->andReturn( array() );

		$this->assertSame( Schema::defaults(), ( new Repository() )->get() );
	}

	public function test_get_deep_merges_partial_stored_option(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'storage'     => array( 'mode' => 'cookie' ),
				'widget'      => array( 'position' => array( 'mobile' => 'top-left' ) ),
				'hideToolbar' => array( 'days' => array( 3 ) ),
				'labels'      => array( 'pl_PL' => array( 'open' => 'Otwórz' ) ),
			)
		);

		$result   = ( new Repository() )->get();
		$defaults = Schema::defaults();

		$this->assertSame( 'cookie', $result['storage']['mode'] );
		$this->assertSame( 365, $result['storage']['ttlDays'] );
		$this->assertSame( 'top-left', $result['widget']['position']['mobile'] );
		$this->assertSame( 'bottom-right', $result['widget']['position']['desktop'] );
		$this->assertSame( $defaults['widget']['offsetX'], $result['widget']['offsetX'] );
		$this->assertSame( array( 3 ), $result['hideToolbar']['days'] );
		$this->assertSame( array( 'pl_PL' => array( 'open' => 'Otwórz' ) ), $result['labels'] );
		$this->assertSame( $defaults['features'], $result['features'] );
	}

	public function test_get_ignores_non_array_stored_value(): void {
		Functions\when( 'get_option' )->justReturn( 'garbage' );

		$this->assertSame( Schema::defaults(), ( new Repository() )->get() );
	}

	public function test_get_is_cached_per_request(): void {
		Functions\expect( 'get_option' )->once()->andReturn( array() );

		$repository = new Repository();
		$repository->get();
		$repository->get();
		$this->assertSame( Schema::defaults(), $repository->get() );
	}

	public function test_save_sanitizes_persists_and_invalidates_cache(): void {
		$stored = array( 'storage' => array( 'mode' => 'none' ) );
		Functions\expect( 'get_option' )->twice()->andReturnUsing( static fn (): array => $stored );
		Functions\expect( 'update_option' )
			->once()
			->with(
				'kotlinskidev_a11y_settings',
				\Mockery::on(
					static fn ( array $value ): bool => 'none' === $value['storage']['mode'] && ! array_key_exists( 'bogus', $value )
				)
			)
			->andReturn( true );

		$repository = new Repository();
		$repository->get();
		$saved = $repository->save( array( 'storage' => array( 'mode' => 'none' ), 'bogus' => 1 ) );
		$repository->get();

		$this->assertSame( 'none', $saved['storage']['mode'] );
	}

	public function test_import_style_round_trip(): void {
		$exported = Schema::defaults();
		$captured = null;
		Functions\expect( 'update_option' )->once()->andReturnUsing(
			static function ( string $name, array $value ) use ( &$captured ): bool {
				$captured = $value;
				return true;
			}
		);

		( new Repository() )->save( $exported );

		$this->assertSame( $exported, $captured );
	}

	public function test_reset_deletes_option_and_returns_defaults(): void {
		Functions\expect( 'delete_option' )->once()->with( 'kotlinskidev_a11y_settings' )->andReturn( true );

		$this->assertSame( Schema::defaults(), ( new Repository() )->reset() );
	}

	public function test_migration_one_is_registered_and_schema_version_stamped(): void {
		Functions\when( 'get_option' )->justReturn( array( 'schemaVersion' => 0 ) );

		$this->assertSame( array( 1 ), array_keys( Repository::migrations() ) );
		$this->assertSame( Schema::VERSION, ( new Repository() )->get()['schemaVersion'] );
	}

	private function stored_v1( array $extra ): array {
		Functions\when( 'get_option' )->justReturn( array_merge( array( 'schemaVersion' => 1 ), $extra ) );

		return ( new Repository() )->get();
	}

	public function test_v1_idle_becomes_custom_idle_linked(): void {
		$result = $this->stored_v1( array( 'advanced' => array( 'excludeSelectors' => '#x', 'loadStrategy' => 'idle' ) ) );

		$this->assertSame(
			array(
				'preset'        => 'custom',
				'strategy'      => 'idle',
				'position'      => 'footer',
				'fetchPriority' => 'auto',
				'prefetch'      => 'hover',
				'pageCss'       => 'linked',
				'deviceSkip'    => true,
				'optOut'        => array(),
			),
			$result['performance']
		);
		$this->assertSame( array( 'excludeSelectors' => '#x' ), $result['advanced'] );
		$this->assertSame( 2, $result['schemaVersion'] );
	}

	public function test_v1_defer_becomes_custom_defer(): void {
		$result = $this->stored_v1( array( 'advanced' => array( 'loadStrategy' => 'defer' ) ) );

		$this->assertSame( 'custom', $result['performance']['preset'] );
		$this->assertSame( 'defer', $result['performance']['strategy'] );
	}

	public function test_v1_unknown_load_strategy_becomes_defer(): void {
		$this->assertSame( 'defer', $this->stored_v1( array( 'advanced' => array( 'loadStrategy' => 'weird' ) ) )['performance']['strategy'] );
	}

	public function test_v1_without_advanced_gets_defaults(): void {
		$result = $this->stored_v1( array() );

		$this->assertSame( Schema::defaults()['performance'], $result['performance'] );
		$this->assertSame( 'recommended', $result['performance']['preset'] );
	}

	public function test_v1_non_empty_exclude_list_gives_except_on(): void {
		$this->assertSame( 'except_on', $this->stored_v1( array( 'visibility' => array( 'excludeRoles' => array( 'editor' ) ) ) )['visibility']['mode'] );
		$this->assertSame( 'except_on', $this->stored_v1( array( 'visibility' => array( 'excludePostIds' => array( 3 ) ) ) )['visibility']['mode'] );
		$this->assertSame( 'except_on', $this->stored_v1( array( 'visibility' => array( 'excludePostTypes' => array( 'product' ) ) ) )['visibility']['mode'] );
		$this->assertSame( 'except_on', $this->stored_v1( array( 'visibility' => array( 'excludeUrlPatterns' => array( '/cart*' ) ) ) )['visibility']['mode'] );
	}

	public function test_v1_empty_lists_give_everywhere(): void {
		$this->assertSame( 'everywhere', $this->stored_v1( array( 'visibility' => array( 'excludeRoles' => array() ) ) )['visibility']['mode'] );
		$this->assertSame( 'everywhere', $this->stored_v1( array() )['visibility']['mode'] );
	}

	public function test_get_applies_preset_row_over_stored_fields(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 2,
				'performance'   => array( 'preset' => 'compatibility', 'strategy' => 'idle', 'deviceSkip' => true ),
			)
		);

		$result = ( new Repository() )->get();

		$this->assertSame( 'eager', $result['performance']['strategy'] );
		$this->assertFalse( $result['performance']['deviceSkip'] );
		$this->assertSame( 'linked', $result['performance']['pageCss'] );
	}

	public function test_get_keeps_custom_stored_fields(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 2,
				'performance'   => array( 'preset' => 'custom', 'strategy' => 'async' ),
			)
		);

		$this->assertSame( 'async', ( new Repository() )->get()['performance']['strategy'] );
	}
}
