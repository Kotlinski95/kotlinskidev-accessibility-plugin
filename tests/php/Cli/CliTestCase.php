<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cli;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use WP_CLI;
use WpCliFailure;

require_once __DIR__ . '/WpCliStub.php';
require_once dirname( __DIR__ ) . '/Rest/WpRestStubs.php';

abstract class CliTestCase extends TestCase {

	protected array $stored = array();

	protected function setUp(): void {
		parent::setUp();

		$this->stored = array();
		WP_CLI::reset();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'wp_json_encode' )->alias( static fn ( mixed $value, int $flags = 0 ): string|false => json_encode( $value, $flags ) );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->stored[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->stored[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				unset( $this->stored[ $name ] );

				return true;
			}
		);
	}

	protected function failure_of( callable $run ): string {
		try {
			$run();
		} catch ( WpCliFailure $failure ) {
			$this->assertSame( 1, $failure->getCode() );

			return $failure->getMessage();
		}

		$this->fail( 'Expected the command to exit with an error.' );
	}

	protected function captured_output(): string {
		return (string) json_encode(
			array(
				WP_CLI::$successes,
				WP_CLI::$warnings,
				WP_CLI::$lines,
				WP_CLI::$printed,
				WP_CLI::$tables,
			)
		);
	}
}
