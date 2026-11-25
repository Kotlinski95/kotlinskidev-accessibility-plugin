<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Kotlinskidev\A11y\Frontend\Actions;
use Kotlinskidev\A11y\Settings\Schema;
use PHPUnit\Framework\TestCase;

final class ActionsTest extends TestCase {

	private static function fixture(): array {
		$decoded = json_decode( (string) file_get_contents( dirname( __DIR__, 2 ) . '/fixtures/actions.json' ), true );

		return is_array( $decoded ) ? $decoded : array();
	}

	public static function valid_actions(): array {
		$rows = array();

		foreach ( self::fixture()['valid'] as $row ) {
			if ( ! empty( $row['tsOnly'] ) ) {
				continue;
			}
			$rows[ $row['action'] ] = array( $row['action'], $row['name'], $row['key'], $row['level'] );
		}

		return $rows;
	}

	public static function invalid_actions(): array {
		$rows = array();

		foreach ( self::fixture()['invalid'] as $action ) {
			$rows[ json_encode( $action ) ] = array( $action );
		}

		return $rows;
	}

	/**
	 * @dataProvider valid_actions
	 */
	public function test_parse_valid( string $action, string $name, ?string $key, ?int $level ): void {
		$this->assertSame(
			array(
				'name'  => $name,
				'key'   => $key,
				'level' => $level,
			),
			Actions::parse( $action )
		);
	}

	/**
	 * @dataProvider invalid_actions
	 */
	public function test_parse_invalid( string $action ): void {
		$this->assertNull( Actions::parse( $action ) );
		$this->assertFalse( Actions::is_allowed( $action, array() ) );
	}

	public function test_trigger_is_not_accepted(): void {
		$this->assertNull( Actions::parse( 'trigger' ) );
	}

	public function test_url_allowlist_constant(): void {
		$this->assertSame( array( 'open', 'feature', 'profile' ), Actions::URL );
	}

	public function test_simple_constant(): void {
		$this->assertSame( array( 'open', 'close', 'toggle', 'reset', 'statement', 'hide', 'show' ), Actions::SIMPLE );
	}

	public function test_is_allowed_simple_actions_need_no_settings(): void {
		foreach ( Actions::SIMPLE as $action ) {
			$this->assertTrue( Actions::is_allowed( $action, array() ), $action );
		}
	}

	public function test_is_allowed_enabled_feature_and_profile(): void {
		$settings = Schema::defaults();

		$this->assertTrue( Actions::is_allowed( 'feature:biggerText', $settings ) );
		$this->assertTrue( Actions::is_allowed( 'feature:biggerText:2', $settings ) );
		$this->assertTrue( Actions::is_allowed( 'profile:adhdFriendly', $settings ) );
	}

	public function test_is_allowed_rejects_disabled_feature(): void {
		$settings                                      = Schema::defaults();
		$settings['features']['biggerText']['enabled'] = false;

		$this->assertFalse( Actions::is_allowed( 'feature:biggerText', $settings ) );
		$this->assertFalse( Actions::is_allowed( 'feature:biggerText:1', $settings ) );
	}

	public function test_is_allowed_rejects_disabled_profile(): void {
		$settings                                        = Schema::defaults();
		$settings['profiles']['adhdFriendly']['enabled'] = false;

		$this->assertFalse( Actions::is_allowed( 'profile:adhdFriendly', $settings ) );
	}

	public function test_is_allowed_rejects_unknown_and_prototype_keys(): void {
		$settings = Schema::defaults();

		$this->assertFalse( Actions::is_allowed( 'feature:nope', $settings ) );
		$this->assertFalse( Actions::is_allowed( 'feature:__proto__', $settings ) );
		$this->assertFalse( Actions::is_allowed( 'feature:constructor:1', $settings ) );
		$this->assertFalse( Actions::is_allowed( 'profile:nope', $settings ) );
		$this->assertFalse( Actions::is_allowed( 'profile:__proto__', $settings ) );
	}

	public function test_is_allowed_rejects_missing_settings(): void {
		$this->assertFalse( Actions::is_allowed( 'feature:biggerText', array() ) );
		$this->assertFalse( Actions::is_allowed( 'profile:adhdFriendly', array() ) );
	}

	public function test_is_allowed_rejects_feature_key_used_as_profile(): void {
		$this->assertFalse( Actions::is_allowed( 'profile:biggerText', Schema::defaults() ) );
	}
}
