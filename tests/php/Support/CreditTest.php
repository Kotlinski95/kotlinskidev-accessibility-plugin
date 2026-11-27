<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Support;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Support\Credit;
use Kotlinskidev\A11y\Tests\TestCase;

final class CreditTest extends TestCase {

	public function test_reads_author_and_author_uri_from_the_plugin_header(): void {
		$seen = array();
		Functions\when( 'get_file_data' )->alias(
			static function ( string $file, array $headers, string $context ) use ( &$seen ): array {
				$seen = array( $file, $headers, $context );

				return array(
					'name' => 'Jane Doe',
					'url'  => 'https://example.test/jane',
				);
			}
		);

		$this->assertSame(
			array(
				'name' => 'Jane Doe',
				'url'  => 'https://example.test/jane',
			),
			( new Credit() )->resolve()
		);
		$this->assertSame(
			array(
				KOTLINSKIDEV_A11Y_FILE,
				array(
					'name' => 'Author',
					'url'  => 'Author URI',
				),
				'plugin',
			),
			$seen
		);
	}

	public function test_returns_null_when_the_header_lacks_a_name_or_a_valid_url(): void {
		Functions\when( 'get_file_data' )->justReturn(
			array(
				'name' => '',
				'url'  => 'https://example.test',
			)
		);
		$this->assertNull( ( new Credit() )->resolve() );

		Functions\when( 'get_file_data' )->justReturn(
			array(
				'name' => 'Jane Doe',
				'url'  => 'javascript:alert(1)',
			)
		);
		$this->assertNull( ( new Credit() )->resolve() );
	}
}
