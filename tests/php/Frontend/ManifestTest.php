<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Tests\TestCase;

final class ManifestTest extends TestCase {

	protected function tearDown(): void {
		Manifest::flush();
		parent::tearDown();
	}

	public function test_reads_fixture_manifest(): void {
		Manifest::flush();

		$this->assertSame( 1, Manifest::data()['abi'] );
		$this->assertSame( '0123456789ab', Manifest::script( 'loader' )['ver'] );
		$this->assertSame( 1900, Manifest::script( 'loader' )['gzip'] );
		$this->assertSame( 'frontend.css', Manifest::style( 'page' )['file'] );
		$this->assertSame( 'bootstrap.js', Manifest::inline( 'bootstrap' )['file'] );
		$this->assertSame(
			'https://example.test/wp-content/plugins/kotlinskidev-accessibility/build/loader.js',
			Manifest::url( Manifest::script( 'loader' ) )
		);
	}

	public function test_missing_manifest_reads_as_null(): void {
		$this->assertNull( Manifest::read( sys_get_temp_dir() . '/ka11y-no-such-manifest.php' ) );
	}

	public function test_fallback_uses_plugin_version_and_zero_sizes(): void {
		$fallback = Manifest::fallback();

		foreach ( array( 'loader', 'kernel', 'panel', 'content', 'color', 'orientation' ) as $name ) {
			$this->assertSame( $name . '.js', $fallback['scripts'][ $name ]['file'] );
			$this->assertSame( '0.0.0-test', $fallback['scripts'][ $name ]['ver'] );
			$this->assertSame( 0, $fallback['scripts'][ $name ]['raw'] );
			$this->assertSame( 0, $fallback['scripts'][ $name ]['gzip'] );
		}

		$this->assertSame( 'frontend.css', $fallback['styles']['page']['file'] );
		$this->assertSame( 'launcher.css', $fallback['styles']['launcher']['file'] );
		$this->assertSame( 'bootstrap.js', $fallback['inline']['bootstrap']['file'] );
	}

	public function test_malformed_manifest_is_rejected(): void {
		$path = sys_get_temp_dir() . '/ka11y-bad-manifest-' . uniqid( '', true ) . '.php';
		file_put_contents( $path, "<?php return array( 'abi' => 1 );" );

		$this->assertNull( Manifest::read( $path ) );

		unlink( $path );
	}
}
