<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Uninstall;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	define( 'WP_UNINSTALL_PLUGIN', 'kotlinskidev-accessibility/kotlinskidev-accessibility.php' );
}

final class UninstallTest extends TestCase {

	private array $bases    = array();
	private array $deleted  = array();
	private array $switched = array();
	private int $restored   = 0;
	private bool $multisite = false;
	private string $method  = 'ftpext';

	protected function setUp(): void {
		parent::setUp();

		$this->bases     = array();
		$this->deleted   = array();
		$this->switched  = array();
		$this->restored  = 0;
		$this->multisite = false;
		$this->method    = 'ftpext';
		$this->current   = 0;

		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				$this->deleted[] = $this->current . ':' . $name;

				return true;
			}
		);
		Functions\when( 'delete_transient' )->justReturn( true );
		Functions\when( 'trailingslashit' )->alias( static fn ( string $path ): string => rtrim( $path, '/' ) . '/' );
		Functions\when( 'is_multisite' )->alias( fn (): bool => $this->multisite );
		Functions\when( 'get_filesystem_method' )->alias( fn (): string => $this->method );
		Functions\when( 'WP_Filesystem' )->justReturn( false );
		Functions\when( 'wp_delete_file' )->alias( static function ( string $file ): void {
			unlink( $file );
		} );
		Functions\when( 'wp_upload_dir' )->alias(
			fn (): array => array(
				'basedir' => $this->bases[ $this->current ] ?? '',
				'error'   => false,
			)
		);
		Functions\when( 'get_sites' )->justReturn( array( 1, 2 ) );
		Functions\when( 'switch_to_blog' )->alias(
			function ( int $id ): bool {
				$this->switched[] = $id;
				$this->current    = $id;

				return true;
			}
		);
		Functions\when( 'restore_current_blog' )->alias(
			function (): bool {
				++$this->restored;
				$this->current = 0;

				return true;
			}
		);
	}

	private int $current = 0;

	private function folder( int $site ): string {
		$base = sys_get_temp_dir() . '/ka11y-uninstall-' . uniqid( '', true );
		mkdir( $base . '/kotlinskidev-a11y', 0777, true );
		touch( $base . '/kotlinskidev-a11y/index.php' );
		touch( $base . '/kotlinskidev-a11y/panel-en_US-0123456789ab.json' );

		$this->bases[ $site ] = $base;

		return $base;
	}

	private function run_uninstall(): void {
		include dirname( __DIR__, 3 ) . '/uninstall.php';
	}

	public function test_non_direct_filesystem_falls_back_to_deleting_files(): void {
		$base = $this->folder( 0 );

		$this->run_uninstall();

		$this->assertSame( array(), glob( $base . '/kotlinskidev-a11y/*' ) );
		$this->assertContains( '0:kotlinskidev_a11y_settings', $this->deleted );
		$this->assertContains( '0:kotlinskidev_a11y_panel_data', $this->deleted );
		rmdir( $base . '/kotlinskidev-a11y' );
		rmdir( $base );
	}

	public function test_multisite_cleans_every_site(): void {
		$this->multisite = true;
		$first           = $this->folder( 1 );
		$second          = $this->folder( 2 );

		$this->run_uninstall();

		$this->assertSame( array( 1, 2 ), $this->switched );
		$this->assertSame( 2, $this->restored );
		$this->assertContains( '1:kotlinskidev_a11y_settings', $this->deleted );
		$this->assertContains( '2:kotlinskidev_a11y_settings', $this->deleted );
		$this->assertSame( array(), glob( $first . '/kotlinskidev-a11y/*' ) );
		$this->assertSame( array(), glob( $second . '/kotlinskidev-a11y/*' ) );
		rmdir( $first . '/kotlinskidev-a11y' );
		rmdir( $second . '/kotlinskidev-a11y' );
		rmdir( $first );
		rmdir( $second );
	}

	public function test_single_site_does_not_switch_blogs(): void {
		$base = $this->folder( 0 );

		$this->run_uninstall();

		$this->assertSame( array(), $this->switched );
		rmdir( $base . '/kotlinskidev-a11y' );
		rmdir( $base );
	}

	public function test_upload_error_skips_folder_removal(): void {
		Functions\when( 'wp_upload_dir' )->justReturn( array( 'error' => 'denied', 'basedir' => '/nonexistent' ) );

		$this->run_uninstall();

		$this->assertContains( '0:kotlinskidev_a11y_settings', $this->deleted );
	}
}
