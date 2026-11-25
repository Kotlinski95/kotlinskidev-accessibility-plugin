<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Sanitizer;
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
		$saved = $repository->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'bogus'   => 1,
			)
		);
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

		$this->assertSame( array( 1, 2 ), array_keys( Repository::migrations() ) );
		$this->assertSame( Schema::VERSION, ( new Repository() )->get()['schemaVersion'] );
	}

	private function stored_v1( array $extra ): array {
		Functions\when( 'get_option' )->justReturn( array_merge( array( 'schemaVersion' => 1 ), $extra ) );

		return ( new Repository() )->get();
	}

	public function test_v1_idle_becomes_custom_idle_linked(): void {
		$result = $this->stored_v1(
			array(
				'advanced' => array(
					'excludeSelectors' => '#x',
					'loadStrategy'     => 'idle',
				),
			)
		);

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
		$this->assertSame( 3, $result['schemaVersion'] );
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
				'performance'   => array(
					'preset'     => 'compatibility',
					'strategy'   => 'idle',
					'deviceSkip' => true,
				),
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
				'performance'   => array(
					'preset'   => 'custom',
					'strategy' => 'async',
				),
			)
		);

		$this->assertSame( 'async', ( new Repository() )->get()['performance']['strategy'] );
	}

	public function test_migration_two_is_identity(): void {
		$stored = array(
			'schemaVersion' => 2,
			'storage'       => array( 'mode' => 'cookie' ),
		);

		$this->assertSame( $stored, Repository::migrations()[2]( $stored ) );
	}

	public function test_v2_option_gets_v3_defaults_and_stamp(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 2,
				'storage'       => array( 'mode' => 'cookie' ),
			)
		);

		$result = ( new Repository() )->get();

		$this->assertSame( 3, $result['schemaVersion'] );
		$this->assertSame( 'cookie', $result['storage']['mode'] );
		$this->assertSame( 'floating', $result['widget']['launcher'] );
		$this->assertSame( array( 'open', 'feature', 'profile' ), $result['triggers']['urlActions'] );
	}

	public function test_v1_chains_to_v3(): void {
		$result = $this->stored_v1( array( 'advanced' => array( 'loadStrategy' => 'idle' ) ) );

		$this->assertSame( 3, $result['schemaVersion'] );
		$this->assertSame( 'idle', $result['performance']['strategy'] );
		$this->assertSame( array(), $result['triggers']['selectors'] );
	}

	public function test_empty_url_actions_survive_the_merge(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 3,
				'triggers'      => array( 'urlActions' => array() ),
			)
		);

		$this->assertSame( array(), ( new Repository() )->get()['triggers']['urlActions'] );
	}

	public function test_v3_option_is_read_by_the_v020_merge_rules_without_losing_v02_keys(): void {
		$v3 = ( new Sanitizer() )->sanitize(
			array(
				'storage'  => array( 'mode' => 'cookie' ),
				'widget'   => array(
					'launcher' => 'inline',
					'mount'    => '#slot',
				),
				'triggers' => array(
					'selectors'  => array( '.x' ),
					'urlActions' => array( 'open' ),
				),
			)
		);

		$v2_defaults = Schema::defaults();
		unset( $v2_defaults['triggers'], $v2_defaults['widget']['launcher'], $v2_defaults['widget']['mount'] );

		$merge = static function ( array $defaults, array $stored ) use ( &$merge ): array {
			$merged = $defaults;

			foreach ( $stored as $key => $value ) {
				$default_value = $defaults[ $key ] ?? null;

				if ( is_array( $value ) && is_array( $default_value ) && array() !== $default_value && ! array_is_list( $default_value ) ) {
					$merged[ $key ] = $merge( $default_value, $value );
				} else {
					$merged[ $key ] = $value;
				}
			}

			return $merged;
		};

		$read = $merge( $v2_defaults, $v3 );

		$this->assertSame( 'cookie', $read['storage']['mode'] );
		$this->assertSame( $v2_defaults['features'], $read['features'] );
		$this->assertSame( $v2_defaults['performance'], $read['performance'] );
		$this->assertGreaterThanOrEqual( 2, $read['schemaVersion'] );
	}
}
