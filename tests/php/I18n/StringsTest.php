<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\I18n;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class StringsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( '__' )->returnArg( 1 );
	}

	private function store_labels( array $labels ): void {
		Functions\when( 'get_option' )->justReturn( array( 'labels' => $labels ) );
	}

	public function test_covers_every_feature_and_profile(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );

		$keys = ( new Strings() )->keys();

		foreach ( Schema::feature_keys() as $feature ) {
			$this->assertContains( "features.$feature.label", $keys );
			$this->assertContains( "features.$feature.description", $keys );
		}
		foreach ( Schema::profile_keys() as $profile ) {
			$this->assertContains( "profiles.$profile", $keys );
		}
		foreach ( array( 'panelTitle', 'reset', 'close', 'hideToolbar', 'statementLink', 'shortcutHint' ) as $key ) {
			$this->assertContains( $key, $keys );
		}
	}

	public function test_switches_locale_and_restores(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\expect( 'switch_to_locale' )->once()->with( 'pl_PL' )->andReturn( true );
		Functions\expect( 'restore_previous_locale' )->once();

		( new Strings() )->for_locale( 'pl_PL' );
		$this->addToAssertionCount( 1 );
	}

	public function test_does_not_restore_when_switch_did_nothing(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\expect( 'switch_to_locale' )->once()->andReturn( false );
		Functions\expect( 'restore_previous_locale' )->never();

		( new Strings() )->for_locale( 'en_US' );
		$this->addToAssertionCount( 1 );
	}

	public function test_restores_when_collection_throws(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( '__' )->alias(
			static function (): string {
				throw new \RuntimeException( 'boom' );
			}
		);
		Functions\expect( 'restore_previous_locale' )->once();

		$this->expectException( \RuntimeException::class );
		( new Strings() )->for_locale( 'pl_PL' );
	}

	public function test_translations_come_from_gettext_inside_locale(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Functions\when( '__' )->alias( static fn ( string $text ): string => 'PL:' . $text );

		$strings = ( new Strings() )->for_locale( 'pl_PL' );

		$this->assertSame( 'PL:Reset all settings', $strings['reset'] );
	}

	public function test_overrides_merge_over_defaults(): void {
		$this->store_labels( array( 'pl_PL' => array( 'reset' => 'Zresetuj' ) ) );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );

		$strings = ( new Strings() )->for_locale( 'pl_PL' );

		$this->assertSame( 'Zresetuj', $strings['reset'] );
		$this->assertSame( 'Close', $strings['close'] );
	}

	public function test_overrides_for_other_locales_ignored(): void {
		$this->store_labels( array( 'de_DE' => array( 'reset' => 'Zurücksetzen' ) ) );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );

		$this->assertSame( 'Reset all settings', ( new Strings() )->for_locale( 'pl_PL' )['reset'] );
	}

	public function test_unknown_keys_ignored(): void {
		$this->store_labels( array( 'pl_PL' => array( 'nonsense' => 'x' ) ) );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );

		$this->assertArrayNotHasKey( 'nonsense', ( new Strings() )->for_locale( 'pl_PL' ) );
	}

	public function test_filter_applied_last(): void {
		$this->store_labels( array( 'pl_PL' => array( 'reset' => 'Zresetuj' ) ) );
		Functions\when( 'switch_to_locale' )->justReturn( true );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Filters\expectApplied( 'kotlinskidev_a11y_strings' )->once()->andReturnUsing(
			static function ( array $strings, string $locale ): array {
				$strings['reset'] = $strings['reset'] . '!' . $locale;
				return $strings;
			}
		);

		$this->assertSame( 'Zresetuj!pl_PL', ( new Strings() )->for_locale( 'pl_PL' )['reset'] );
	}
}
