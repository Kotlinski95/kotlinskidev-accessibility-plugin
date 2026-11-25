<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Update\Channel;

final class ChannelTest extends TestCase {

	private mixed $stored = false;

	protected function setUp(): void {
		parent::setUp();

		$this->stored = false;

		Functions\when( 'get_site_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => false === $this->stored ? $fallback : $this->stored );
		Functions\when( 'update_site_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->stored = $value;

				return true;
			}
		);
	}

	private function channel( mixed $constant = null ): Channel {
		return new Channel( static fn ( string $name ): mixed => 'KOTLINSKIDEV_A11Y_UPDATE_CHANNEL' === $name ? $constant : null );
	}

	public function test_defaults_to_stable(): void {
		$this->assertSame( 'stable', $this->channel()->current() );
		$this->assertFalse( $this->channel()->is_beta() );
	}

	public function test_option_selects_beta(): void {
		$this->stored = array( 'channel' => 'beta' );

		$this->assertSame( 'beta', $this->channel()->current() );
		$this->assertTrue( $this->channel()->is_beta() );
	}

	public function test_garbage_option_falls_back_to_stable(): void {
		$this->stored = array( 'channel' => 'nightly' );

		$this->assertSame( 'stable', $this->channel()->current() );
	}

	public function test_constant_beats_option(): void {
		$this->stored = array( 'channel' => 'beta' );

		$this->assertSame( 'stable', $this->channel( 'stable' )->current() );
		$this->assertTrue( $this->channel( 'stable' )->locked_by_constant() );
	}

	public function test_invalid_constant_is_ignored(): void {
		$this->stored = array( 'channel' => 'beta' );

		$this->assertSame( 'beta', $this->channel( 'rc' )->current() );
		$this->assertFalse( $this->channel( 'rc' )->locked_by_constant() );
	}

	public function test_filter_runs_last(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_channel' )->once()->with( 'stable' )->andReturn( 'beta' );

		$this->assertSame( 'beta', $this->channel( 'stable' )->current() );
	}

	public function test_invalid_filter_value_is_ignored(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_channel' )->once()->andReturn( 'bogus' );

		$this->assertSame( 'stable', $this->channel()->current() );
	}

	public function test_save_stores_only_valid_values(): void {
		$channel = $this->channel();

		$this->assertTrue( $channel->save( 'beta' ) );
		$this->assertSame( array( 'channel' => 'beta' ), $this->stored );
		$this->assertFalse( $channel->save( 'rc' ) );
		$this->assertSame( array( 'channel' => 'beta' ), $this->stored );
	}

	public function test_save_refuses_when_constant_locks(): void {
		$this->assertFalse( $this->channel( 'stable' )->save( 'beta' ) );
		$this->assertFalse( $this->stored );
	}
}
