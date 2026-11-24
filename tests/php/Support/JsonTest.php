<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Support;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Support\Json;
use Kotlinskidev\A11y\Tests\TestCase;

final class JsonTest extends TestCase {

	public function test_encodes_values(): void {
		Functions\when( 'wp_json_encode' )->alias( static fn ( $value, int $flags = 0 ) => json_encode( $value, $flags ) );

		$this->assertSame( '{"a":1}', Json::encode( array( 'a' => 1 ) ) );
	}

	public function test_failure_falls_back_to_empty_object(): void {
		Functions\when( 'wp_json_encode' )->justReturn( false );

		$this->assertSame( '{}', Json::encode( array( 'a' => NAN ) ) );
	}
}
