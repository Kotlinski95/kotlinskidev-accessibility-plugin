<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use PHPUnit\Framework\Attributes\PreserveGlobalState;
use PHPUnit\Framework\Attributes\RunInSeparateProcess;
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

	public function test_stored_legacy_selectors_keep_their_value(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'theme' => array(
					'darkSelector'  => Schema::LEGACY_DARK_SELECTOR,
					'lightSelector' => Schema::LEGACY_LIGHT_SELECTOR,
				),
			)
		);

		$result = ( new Repository() )->get();

		$this->assertSame( Schema::LEGACY_DARK_SELECTOR, $result['theme']['darkSelector'] );
		$this->assertSame( Schema::LEGACY_LIGHT_SELECTOR, $result['theme']['lightSelector'] );
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

	public function test_save_sanitizes_and_stores_only_differences(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\expect( 'update_option' )
			->once()
			->with(
				'kotlinskidev_a11y_settings',
				array(
					'schemaVersion' => Schema::VERSION,
					'storage'       => array( 'mode' => 'none' ),
				)
			)
			->andReturn( true );

		( new Repository() )->save(
			array(
				'storage' => array( 'mode' => 'none' ),
				'bogus'   => 1,
			)
		);

		$this->addToAssertionCount( 1 );
	}

	public function test_import_style_round_trip(): void {
		$captured = null;
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\expect( 'update_option' )->once()->andReturnUsing(
			static function ( string $name, array $value ) use ( &$captured ): bool {
				$captured = $value;
				return true;
			}
		);

		( new Repository() )->save( Schema::defaults() );

		$this->assertSame( array( 'schemaVersion' => Schema::VERSION ), $captured );
	}

	public function test_reset_deletes_option_and_returns_defaults(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\expect( 'delete_option' )->once()->with( 'kotlinskidev_a11y_settings' )->andReturn( true );

		$this->assertSame( Schema::defaults(), ( new Repository() )->reset() );
	}

	public function test_migration_one_is_registered_and_schema_version_stamped(): void {
		Functions\when( 'get_option' )->justReturn( array( 'schemaVersion' => 0 ) );

		$this->assertSame( array( 1, 2, 3, 4 ), array_keys( Repository::migrations() ) );
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
		$this->assertSame( Schema::VERSION, $result['schemaVersion'] );
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

		$this->assertSame( Schema::VERSION, $result['schemaVersion'] );
		$this->assertSame( 'cookie', $result['storage']['mode'] );
		$this->assertSame( 'floating', $result['widget']['launcher'] );
		$this->assertSame( array( 'open', 'feature', 'profile' ), $result['triggers']['urlActions'] );
	}

	public function test_v1_chains_to_v4(): void {
		$result = $this->stored_v1( array( 'advanced' => array( 'loadStrategy' => 'idle' ) ) );

		$this->assertSame( Schema::VERSION, $result['schemaVersion'] );
		$this->assertSame( 'idle', $result['performance']['strategy'] );
		$this->assertSame( array(), $result['triggers']['selectors'] );
	}

	public function test_v3_option_migrates_to_v4_keeping_every_value_and_adding_defaults(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 3,
				'storage'       => array( 'mode' => 'cookie' ),
				'tokens'        => array( 'primary' => '#123456' ),
				'widget'        => array( 'launcher' => 'inline' ),
			)
		);

		$result = ( new Repository() )->get();

		$this->assertSame( Schema::VERSION, $result['schemaVersion'] );
		$this->assertSame( 'cookie', $result['storage']['mode'] );
		$this->assertSame( '#123456', $result['tokens']['primary'] );
		$this->assertSame( 'inline', $result['widget']['launcher'] );
		$this->assertSame( '#16181d', $result['tokens']['headerBg'] );
		$this->assertSame( 3, $result['panel']['columns'] );
		$this->assertTrue( $result['panel']['sections']['skip'] );
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
		unset( $v2_defaults['triggers'], $v2_defaults['widget']['launcher'], $v2_defaults['widget']['mount'], $v2_defaults['panel'] );
		foreach ( Schema::PANEL_TOKENS as $token ) {
			unset( $v2_defaults['tokens'][ $token ] );
		}

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

	private array $options = array();

	private function stateful_options( array $initial = array() ): void {
		$this->options = $initial;

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

	private function multisite( array $network ): void {
		Functions\when( 'is_multisite' )->justReturn( true );
		Functions\when( 'get_site_option' )->justReturn( $network );
	}

	private function fixture( string $name ): array {
		return (array) json_decode( (string) file_get_contents( __DIR__ . '/../../fixtures/settings/' . $name . '.json' ), true );
	}

	private function legacy_read( array $defaults, array $stored ): array {
		$merge = static function ( array $base, array $over ) use ( &$merge ): array {
			$merged = $base;

			foreach ( $over as $key => $value ) {
				$default_value = $base[ $key ] ?? null;

				if ( is_array( $value ) && is_array( $default_value ) && array() !== $default_value && ! array_is_list( $default_value ) ) {
					$merged[ $key ] = $merge( $default_value, $value );
				} else {
					$merged[ $key ] = $value;
				}
			}

			return $merged;
		};

		return $merge( $defaults, $stored );
	}

	public function test_layer_order_is_defaults_network_site_then_locks(): void {
		$this->multisite(
			array(
				'settings' => array(
					'storage' => array(
						'mode'    => 'cookie',
						'ttlDays' => 90,
					),
					'widget'  => array( 'size' => 'lg' ),
				),
				'locked'   => array( 'storage.ttlDays' ),
			)
		);
		$this->stateful_options(
			array(
				'kotlinskidev_a11y_settings' => array(
					'schemaVersion' => Schema::VERSION,
					'storage'       => array(
						'mode'    => 'none',
						'ttlDays' => 10,
					),
				),
			)
		);

		$repository = new Repository();
		$result     = $repository->get();

		$this->assertSame( 'none', $result['storage']['mode'] );
		$this->assertSame( 90, $result['storage']['ttlDays'] );
		$this->assertSame( 'lg', $result['widget']['size'] );
		$this->assertSame( Schema::defaults()['storage']['key'], $result['storage']['key'] );
		$this->assertSame( 'site', $repository->source( 'storage.mode' ) );
		$this->assertSame( 'locked', $repository->source( 'storage.ttlDays' ) );
		$this->assertSame( 'network', $repository->source( 'widget.size' ) );
		$this->assertSame( 'default', $repository->source( 'storage.key' ) );
		$this->assertEquals(
			array(
				'storage.mode'    => 'site',
				'storage.ttlDays' => 'locked',
				'widget.size'     => 'network',
			),
			$repository->sources()
		);
	}

	public function test_effective_defaults_with_and_without_network(): void {
		$this->assertSame( Schema::defaults(), ( new Repository() )->effective_defaults() );

		Repository::flush();
		$this->multisite( array( 'settings' => array( 'tokens' => array( 'radius' => '4px' ) ) ) );

		$effective = ( new Repository() )->effective_defaults();

		$this->assertSame( '4px', $effective['tokens']['radius'] );
		$this->assertSame( Schema::defaults()['tokens']['primary'], $effective['tokens']['primary'] );
	}

	public function test_network_settings_are_sanitized_on_read(): void {
		$this->multisite( array( 'settings' => array( 'storage' => array( 'mode' => 'bogus' ) ) ) );

		$this->assertSame( 'local', ( new Repository() )->effective_defaults()['storage']['mode'] );
	}

	public function test_save_follows_the_network_default_and_pins_everything_else(): void {
		$this->multisite( array( 'settings' => array( 'storage' => array( 'mode' => 'cookie' ) ) ) );
		$this->stateful_options();
		$repository = new Repository();

		$repository->save( array( 'storage' => array( 'mode' => 'cookie' ) ) );
		$this->assertSame( array( 'schemaVersion' => Schema::VERSION ), $this->options['kotlinskidev_a11y_settings'] );

		$repository->save( array( 'storage' => array( 'mode' => 'local' ) ) );
		$this->assertSame( array( 'mode' => 'local' ), $this->options['kotlinskidev_a11y_settings']['storage'] );
		$this->assertSame( 'local', ( new Repository() )->get()['storage']['mode'] );
	}

	public function test_sparse_storage_keeps_only_differing_leaves(): void {
		$this->stateful_options();
		$full = Schema::defaults();

		$full['tokens']['radius']      = '4px';
		$full['hideToolbar']['days']   = array( 1, 7 );
		$full['triggers']['selectors'] = array( '.menu a' );

		( new Repository() )->save( $full );

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'tokens'        => array( 'radius' => '4px' ),
				'hideToolbar'   => array( 'days' => array( 1, 7 ) ),
				'triggers'      => array( 'selectors' => array( '.menu a' ) ),
			),
			$this->options['kotlinskidev_a11y_settings']
		);
	}

	public function test_strip_defaults_migration_keeps_effective_values(): void {
		$v4 = $this->fixture( 'full-v4' );

		$this->stateful_options( array( 'kotlinskidev_a11y_settings' => $v4 ) );

		$repository = new Repository();
		$stripped   = $repository->stored();
		$expected   = Schema::apply_performance_preset( $this->legacy_read( Schema::defaults(), $v4 ) );

		$expected['schemaVersion'] = Schema::VERSION;

		$this->assertSame( Schema::VERSION, $stripped['schemaVersion'] );
		$this->assertSame( 'cookie', $stripped['storage']['mode'] );
		$this->assertArrayNotHasKey( 'onPrimary', $stripped['tokens'] );
		$this->assertArrayNotHasKey( 'enabled', $stripped['features']['biggerText'] );
		$this->assertSame( $expected, $repository->get() );
	}

	public function test_strip_defaults_removes_default_valued_leaves_and_empty_parents(): void {
		$stored = array(
			'schemaVersion' => 4,
			'storage'       => array(
				'mode'    => 'local',
				'ttlDays' => 365,
			),
			'tokens'        => array( 'radius' => '4px' ),
			'labels'        => array(),
		);

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'tokens'        => array( 'radius' => '4px' ),
			),
			( new Repository() )->migrate( $stored )
		);
	}

	public function test_a_sparse_v5_tree_read_by_the_v040_merge_gives_the_same_values(): void {
		$this->stateful_options();
		$full                       = Schema::defaults();
		$full['storage']['mode']    = 'none';
		$full['tokens']['primary']  = '#aa3300';
		$full['panel']['columns']   = 2;
		$full['labels']             = array( 'pl_PL' => array( 'open' => 'Otwórz' ) );
		$full['visibility']['mode'] = 'only_on';

		( new Repository() )->save( $full );

		$v4_defaults = Schema::defaults();
		unset( $v4_defaults['maintenance'] );

		$read      = $this->legacy_read( $v4_defaults, $this->options['kotlinskidev_a11y_settings'] );
		$effective = ( new Repository() )->get();
		unset( $effective['maintenance'] );

		$this->assertSame( Schema::apply_performance_preset( $effective ), Schema::apply_performance_preset( $read ) );
	}

	public function test_reset_with_prefixes_removes_only_those_paths(): void {
		$this->stateful_options(
			array(
				'kotlinskidev_a11y_settings' => array(
					'schemaVersion' => Schema::VERSION,
					'storage'       => array( 'mode' => 'none' ),
					'tokens'        => array(
						'radius'  => '4px',
						'primary' => '#aa3300',
					),
					'theme'         => array( 'mode' => 'dark' ),
				),
			)
		);

		$result = ( new Repository() )->reset( array( 'tokens', 'theme.mode' ) );

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'none' ),
			),
			$this->options['kotlinskidev_a11y_settings']
		);
		$this->assertSame( 'none', $result['storage']['mode'] );
		$this->assertSame( Schema::defaults()['tokens'], $result['tokens'] );
		$this->assertSame( 'auto', $result['theme']['mode'] );
	}

	public function test_reset_without_prefixes_returns_to_the_network_defaults(): void {
		$this->multisite( array( 'settings' => array( 'tokens' => array( 'radius' => '4px' ) ) ) );
		$this->stateful_options( array( 'kotlinskidev_a11y_settings' => array( 'tokens' => array( 'radius' => '1px' ) ) ) );

		$result = ( new Repository() )->reset();

		$this->assertArrayNotHasKey( 'kotlinskidev_a11y_settings', $this->options );
		$this->assertSame( '4px', $result['tokens']['radius'] );
	}

	public function test_changes_lists_sorted_effective_differences_with_their_source(): void {
		$this->multisite( array( 'settings' => array( 'widget' => array( 'size' => 'lg' ) ) ) );
		$this->stateful_options();

		$repository = new Repository();
		$before     = $repository->get();
		$sparse     = $repository->resolve_save(
			array_replace_recursive(
				$before,
				array(
					'widget'  => array( 'size' => 'sm' ),
					'storage' => array( 'mode' => 'none' ),
					'tokens'  => array( 'radius' => '1px' ),
				)
			)
		);
		$changes    = $repository->changes( $before, $repository->effective_from( $sparse ), $sparse );

		$this->assertSame( array( 'storage.mode', 'tokens.radius', 'widget.size' ), array_column( $changes, 'path' ) );
		$this->assertSame( array( 'local', 'none', 'site' ), array( $changes[0]['from'], $changes[0]['to'], $changes[0]['source'] ) );
		$this->assertSame( array( 'lg', 'sm', 'site' ), array( $changes[2]['from'], $changes[2]['to'], $changes[2]['source'] ) );
	}

	public function test_locked_paths_are_never_stored_and_cannot_be_overridden(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );
		$this->stateful_options( array( 'kotlinskidev_a11y_settings' => array( 'storage' => array( 'mode' => 'cookie' ) ) ) );

		$repository = new Repository();

		$this->assertSame( 'none', $repository->get()['storage']['mode'] );

		$repository->save( array( 'storage' => array( 'mode' => 'cookie' ) ) );

		$this->assertSame( array( 'mode' => 'cookie' ), $this->options['kotlinskidev_a11y_settings']['storage'] );
		$this->assertSame( 'none', ( new Repository() )->get()['storage']['mode'] );
	}

	public function test_saving_never_drops_the_stored_value_of_a_locked_path(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );
		$this->stateful_options(
			array(
				'kotlinskidev_a11y_settings' => array(
					'schemaVersion' => Schema::VERSION,
					'storage'       => array( 'mode' => 'cookie' ),
				),
			)
		);

		( new Repository() )->save( array( 'tokens' => array( 'radius' => '4px' ) ) );

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'tokens'        => array( 'radius' => '4px' ),
				'storage'       => array( 'mode' => 'cookie' ),
			),
			$this->options['kotlinskidev_a11y_settings']
		);
	}

	public function test_strip_defaults_keeps_a_site_value_that_differs_from_the_network_default(): void {
		$this->multisite( array( 'settings' => array( 'storage' => array( 'mode' => 'cookie' ) ) ) );
		$this->stateful_options(
			array(
				'kotlinskidev_a11y_settings' => array(
					'schemaVersion' => 4,
					'storage'       => array(
						'mode'    => 'local',
						'ttlDays' => 365,
					),
				),
			)
		);

		$repository = new Repository();

		$this->assertSame( 'local', $repository->get()['storage']['mode'] );
		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'local' ),
			),
			$repository->stored()
		);
	}

	public function test_invalid_locks_are_reported_once_in_admin(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn(
			array(
				'storage.mode' => 'bogus',
				'nope'         => 1,
			)
		);
		$this->stateful_options();
		Functions\when( 'is_admin' )->justReturn( true );
		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'esc_html' )->returnArg( 1 );
		Functions\expect( '_doing_it_wrong' )->once();

		$repository = new Repository();
		$repository->get();
		Repository::flush();
		$repository->get();

		$this->assertSame(
			array(
				'storage.mode' => 'invalid_value',
				'nope'         => 'unknown_path',
			),
			$repository->lock_errors()
		);
	}

	#[RunInSeparateProcess]
	#[PreserveGlobalState( false )]
	public function test_a_declared_constant_wins_over_the_filter(): void {
		define( 'KOTLINSKIDEV_A11Y_LOCKED_SETTINGS', array( 'storage.mode' => 'cookie' ) );
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );
		Functions\when( 'get_option' )->justReturn( array() );

		$repository = new Repository();

		$this->assertSame( 'cookie', $repository->get()['storage']['mode'] );
		$this->assertSame( array( 'storage.mode' => 'cookie' ), $repository->locked() );
	}

	public function test_invalidation_fires_only_when_the_effective_tree_changes(): void {
		$this->stateful_options();
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'settings' );

		$repository = new Repository();
		$repository->save( array() );
		$repository->save( array( 'storage' => array( 'mode' => 'none' ) ) );
		$repository->save( array( 'storage' => array( 'mode' => 'none' ) ) );

		$this->addToAssertionCount( 1 );
	}
}
