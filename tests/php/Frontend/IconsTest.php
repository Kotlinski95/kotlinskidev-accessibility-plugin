<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Filters;
use Kotlinskidev\A11y\Frontend\Icons;
use Kotlinskidev\A11y\Tests\TestCase;

final class IconsTest extends TestCase {

	private string $file = '';

	protected function setUp(): void {
		parent::setUp();
		$this->file = tempnam( sys_get_temp_dir(), 'ka11y-icons-' ) ?: '';
	}

	protected function tearDown(): void {
		if ( '' !== $this->file && file_exists( $this->file ) ) {
			unlink( $this->file );
		}

		parent::tearDown();
	}

	private function write( array $icons ): void {
		file_put_contents( $this->file, json_encode( array( 'v' => 1, 'icons' => $icons ) ) );
	}

	public function test_missing_file_gives_an_empty_map(): void {
		$this->assertSame( array(), Icons::map( $this->file . '.missing' ) );
	}

	public function test_invalid_json_gives_an_empty_map(): void {
		file_put_contents( $this->file, '{not json' );

		$this->assertSame( array(), Icons::map( $this->file ) );
	}

	public function test_known_names_with_valid_path_data_are_kept(): void {
		$this->write(
			array(
				'close'       => 'M5 5l14 14M19 5 5 19',
				'biggerText'  => 'M3 19 9 5l6 14',
				'visionImpaired' => 'M2 12s4-7 10-7',
			)
		);

		$this->assertSame(
			array(
				'biggerText'     => 'M3 19 9 5l6 14',
				'visionImpaired' => 'M2 12s4-7 10-7',
				'close'          => 'M5 5l14 14M19 5 5 19',
			),
			Icons::map( $this->file )
		);
	}

	public function test_unknown_names_and_invalid_data_are_dropped(): void {
		$this->write(
			array(
				'close'    => 'M5 5l14 14',
				'unknown'  => 'M0 0h1',
				'plus'     => '<script>alert(1)</script>',
				'minus'    => 'M0 0" onload="x',
				'check'    => '',
				'chevron'  => 42,
				'access'   => 'M' . str_repeat( '1', 1500 ),
			)
		);

		$this->assertSame( array( 'close' => 'M5 5l14 14' ), Icons::map( $this->file ) );
	}

	public function test_filter_can_override_and_add_icons(): void {
		$this->write( array( 'close' => 'M5 5l14 14' ) );
		Filters\expectApplied( 'kotlinskidev_a11y_icons' )->once()->andReturnUsing(
			static fn ( array $icons ): array => array(
				'close'   => 'M1 1h2',
				'plus'    => 'M12 5v14',
				'unknown' => 'M0 0h1',
			)
		);

		$this->assertSame(
			array(
				'close' => 'M1 1h2',
				'plus'  => 'M12 5v14',
			),
			Icons::map( $this->file )
		);
	}

	public function test_filter_returning_markup_or_non_array_is_rejected(): void {
		$this->write( array( 'close' => 'M5 5l14 14' ) );
		Filters\expectApplied( 'kotlinskidev_a11y_icons' )->once()->andReturn( '<svg onload=x>' );

		$this->assertSame( array(), Icons::map( $this->file ) );
	}

	public function test_filter_value_with_markup_is_dropped(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_icons' )->once()->andReturn(
			array( 'close' => '"><script>x</script>' )
		);

		$this->assertSame( array(), Icons::map( $this->file . '.missing' ) );
	}

	public function test_names_cover_features_profiles_and_ui(): void {
		$names = Icons::names();

		$this->assertContains( 'biggerText', $names );
		$this->assertContains( 'adhdFriendly', $names );
		$this->assertContains( 'language', $names );
		$this->assertContains( 'reset', $names );
		$this->assertCount( 39, $names );
	}
}
