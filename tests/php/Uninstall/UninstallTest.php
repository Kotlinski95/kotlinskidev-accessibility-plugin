<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Uninstall;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	define( 'WP_UNINSTALL_PLUGIN', 'kotlinskidev-accessibility/kotlinskidev-accessibility.php' );
}

final class UninstallTest extends TestCase {

	private array $bases      = array();
	private array $deleted    = array();
	private array $switched   = array();
	private int $restored     = 0;
	private bool $multisite   = false;
	private string $method    = 'ftpext';
	private array $kept       = array();
	private array $network    = array();
	private array $transients = array();
	private array $user_meta  = array();

	protected function setUp(): void {
		parent::setUp();

		$this->bases        = array();
		$this->deleted      = array();
		$this->switched     = array();
		$this->restored     = 0;
		$this->multisite    = false;
		$this->method       = 'ftpext';
		$this->current      = 0;
		$this->removed_caps = array();
		$this->kept         = array();
		$this->network      = array();
		$this->transients   = array();
		$this->user_meta    = array();

		Functions\when( 'get_option' )->alias(
			fn ( string $name, mixed $fallback = false ): mixed => 'kotlinskidev_a11y_settings' === $name && in_array( $this->current, $this->kept, true )
				? array( 'maintenance' => array( 'keepDataOnUninstall' => true ) )
				: $fallback
		);
		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ): bool {
				$this->network[] = $name;

				return true;
			}
		);
		Functions\when( 'delete_site_transient' )->alias(
			function ( string $name ): bool {
				$this->network[] = 'transient:' . $name;

				return true;
			}
		);
		Functions\when( 'delete_metadata' )->alias(
			function ( string $type, int $id, string $key ): bool {
				$this->user_meta[] = $type . ':' . $key;

				return true;
			}
		);
		Functions\when( 'get_main_site_id' )->justReturn( 1 );

		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				$this->deleted[] = $this->current . ':' . $name;

				return true;
			}
		);
		Functions\when( 'delete_transient' )->alias(
			function ( string $name ): bool {
				$this->transients[] = $this->current . ':' . $name;

				return true;
			}
		);
		Functions\when( 'wp_roles' )->alias(
			function (): object {
				$recorder = function ( string $name ): object {
					return new class( $name, $this ) {
						public function __construct( private string $name, private UninstallTest $test ) {}

						public function remove_cap( string $cap ): void {
							$this->test->record_cap_removal( $this->name . ':' . $cap );
						}
					};
				};

				return (object) array(
					'role_objects' => array(
						'editor'        => $recorder( 'editor' ),
						'administrator' => $recorder( 'administrator' ),
					),
				);
			}
		);
		Functions\when( 'trailingslashit' )->alias( static fn ( string $path ): string => rtrim( $path, '/' ) . '/' );
		Functions\when( 'is_multisite' )->alias( fn (): bool => $this->multisite );
		Functions\when( 'get_filesystem_method' )->alias( fn (): string => $this->method );
		Functions\when( 'WP_Filesystem' )->justReturn( false );
		Functions\when( 'wp_delete_file' )->alias(
			static function ( string $file ): void {
				unlink( $file );
			}
		);
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

	private int $current        = 0;
	private array $removed_caps = array();

	public function record_cap_removal( string $entry ): void {
		$this->removed_caps[] = $this->current . ':' . $entry;
	}

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
		$this->assertSame( array( '0:editor:kotlinskidev_a11y_customize', '0:administrator:kotlinskidev_a11y_customize' ), $this->removed_caps );

		foreach ( array( 'settings_backup', 'layers_hash', 'installed_version', 'update', 'unverified_package' ) as $name ) {
			$this->assertContains( '0:kotlinskidev_a11y_' . $name, $this->deleted );
		}

		$this->assertContains( '0:kotlinskidev_a11y_releases', $this->transients );
		$this->assertContains( 'kotlinskidev_a11y_network_settings', $this->network );
		$this->assertContains( 'kotlinskidev_a11y_update', $this->network );
		$this->assertContains( 'kotlinskidev_a11y_unverified_package', $this->network );
		$this->assertContains( 'transient:kotlinskidev_a11y_releases', $this->network );
		$this->assertSame( array( 'user:kotlinskidev_a11y_perf_notice_dismissed' ), $this->user_meta );
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
		$this->assertContains( '1:editor:kotlinskidev_a11y_customize', $this->removed_caps );
		$this->assertContains( '2:administrator:kotlinskidev_a11y_customize', $this->removed_caps );
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
		Functions\when( 'wp_upload_dir' )->justReturn(
			array(
				'error'   => 'denied',
				'basedir' => '/nonexistent',
			)
		);

		$this->run_uninstall();

		$this->assertContains( '0:kotlinskidev_a11y_settings', $this->deleted );
	}

	public function test_configured_customer_capability_is_removed_too(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->andReturn( 'kotlinskidev_a11y_editor' );

		$this->run_uninstall();

		$this->assertContains( '0:editor:kotlinskidev_a11y_editor', $this->removed_caps );
		$this->assertContains( '0:administrator:kotlinskidev_a11y_customize', $this->removed_caps );
	}

	public function test_foreign_customer_capability_is_never_removed(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_customer_capability' )->andReturn( 'manage_options' );

		$this->run_uninstall();

		$this->assertNotContains( '0:administrator:manage_options', $this->removed_caps );
	}

	public function test_keep_data_on_single_site_keeps_everything(): void {
		$base       = $this->folder( 0 );
		$this->kept = array( 0 );

		$this->run_uninstall();

		$this->assertSame( array(), $this->deleted );
		$this->assertSame( array(), $this->removed_caps );
		$this->assertSame( array(), $this->network );
		$this->assertSame( array(), $this->user_meta );
		$this->assertFileExists( $base . '/kotlinskidev-a11y/index.php' );
		unlink( $base . '/kotlinskidev-a11y/index.php' );
		unlink( $base . '/kotlinskidev-a11y/panel-en_US-0123456789ab.json' );
		rmdir( $base . '/kotlinskidev-a11y' );
		rmdir( $base );
	}

	public function test_multisite_skips_only_the_sites_that_keep_data(): void {
		$this->multisite = true;
		$this->kept      = array( 2 );
		$first           = $this->folder( 1 );
		$second          = $this->folder( 2 );

		$this->run_uninstall();

		$this->assertContains( '1:kotlinskidev_a11y_settings', $this->deleted );
		$this->assertNotContains( '2:kotlinskidev_a11y_settings', $this->deleted );
		$this->assertContains( '1:editor:kotlinskidev_a11y_customize', $this->removed_caps );
		$this->assertNotContains( '2:editor:kotlinskidev_a11y_customize', $this->removed_caps );
		$this->assertContains( 'kotlinskidev_a11y_network_settings', $this->network );
		$this->assertFileExists( $second . '/kotlinskidev-a11y/index.php' );
		$this->assertSame( array(), glob( $first . '/kotlinskidev-a11y/*' ) );
		rmdir( $first . '/kotlinskidev-a11y' );
		rmdir( $first );
		unlink( $second . '/kotlinskidev-a11y/index.php' );
		unlink( $second . '/kotlinskidev-a11y/panel-en_US-0123456789ab.json' );
		rmdir( $second . '/kotlinskidev-a11y' );
		rmdir( $second );
	}

	public function test_multisite_keeps_network_data_when_the_main_site_keeps_data(): void {
		$this->multisite = true;
		$this->kept      = array( 1 );
		$first           = $this->folder( 1 );
		$second          = $this->folder( 2 );

		$this->run_uninstall();

		$this->assertSame( array(), $this->network );
		$this->assertSame( array(), $this->user_meta );
		$this->assertContains( '2:kotlinskidev_a11y_settings', $this->deleted );
		unlink( $first . '/kotlinskidev-a11y/index.php' );
		unlink( $first . '/kotlinskidev-a11y/panel-en_US-0123456789ab.json' );
		rmdir( $first . '/kotlinskidev-a11y' );
		rmdir( $first );
		rmdir( $second . '/kotlinskidev-a11y' );
		rmdir( $second );
	}
}
