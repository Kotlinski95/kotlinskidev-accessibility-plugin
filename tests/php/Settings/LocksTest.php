<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Filters;
use Kotlinskidev\A11y\Settings\Locks;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class LocksTest extends TestCase {

	public function test_network_locks_pass_through_without_filter_or_constant(): void {
		$result = ( new Locks() )->resolve( array( 'storage.mode' => 'cookie' ) );

		$this->assertSame( array( 'storage.mode' => 'cookie' ), $result['locked'] );
		$this->assertSame( array(), $result['errors'] );
	}

	public function test_constant_beats_filter_beats_network(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->once()->with(
			array(
				'storage.mode'    => 'cookie',
				'storage.ttlDays' => 90,
			)
		)->andReturn(
			array(
				'storage.mode'    => 'none',
				'storage.ttlDays' => 90,
				'storage.key'     => 'zz',
			)
		);

		$result = ( new Locks() )->resolve(
			array(
				'storage.mode'    => 'cookie',
				'storage.ttlDays' => 90,
			),
			array( 'storage.mode' => 'local' )
		);

		$this->assertSame(
			array(
				'storage.mode'    => 'local',
				'storage.ttlDays' => 90,
				'storage.key'     => 'zz',
			),
			$result['locked']
		);
	}

	public function test_a_filter_returning_garbage_keeps_the_network_map(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( 'garbage' );

		$this->assertSame( array( 'storage.mode' => 'cookie' ), ( new Locks() )->resolve( array( 'storage.mode' => 'cookie' ) )['locked'] );
	}

	public function test_invalid_entries_are_dropped_with_a_reason(): void {
		$result = ( new Locks() )->resolve(
			array(
				'nope.path'     => 1,
				'schemaVersion' => 5,
				'storage.mode'  => 'bogus',
				'storage.key'   => 'ok',
				'0'             => 'x',
			)
		);

		$this->assertSame( array( 'storage.key' => 'ok' ), $result['locked'] );
		$this->assertSame(
			array(
				'nope.path'     => 'unknown_path',
				'schemaVersion' => 'not_lockable',
				'storage.mode'  => 'invalid_value',
				'0'             => 'unknown_path',
			),
			$result['errors']
		);
	}

	public function test_values_must_survive_the_sanitizer_unchanged(): void {
		$result = ( new Locks() )->resolve(
			array(
				'tokens.primary'   => ' #AABBCC ',
				'storage.ttlDays'  => '30',
				'hideToolbar.days' => array( 1, 1 ),
			)
		);

		$this->assertSame( array(), $result['locked'] );
		$this->assertCount( 3, $result['errors'] );
	}

	public function test_list_and_object_values_can_be_locked(): void {
		$result = ( new Locks() )->resolve(
			array(
				'hideToolbar.days'    => array( 2, 4 ),
				'triggers.urlActions' => array( 'open' ),
			)
		);

		$this->assertSame( array( 'hideToolbar.days', 'triggers.urlActions' ), array_keys( $result['locked'] ) );
	}

	public function test_apply_assigns_locked_values_into_a_tree(): void {
		$tree = Locks::apply( Schema::defaults(), array( 'storage.mode' => 'none' ) );

		$this->assertSame( 'none', $tree['storage']['mode'] );
		$this->assertSame( 365, $tree['storage']['ttlDays'] );
	}

	public function test_declared_constant_is_absent_in_tests(): void {
		$this->assertNull( ( new Locks() )->declared_constant() );
	}
}
