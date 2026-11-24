<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\PanelDataStore;
use Kotlinskidev\A11y\Tests\TestCase;
use WP_Filesystem_Base;

require_once __DIR__ . '/WpFilesystemStub.php';

final class PanelDataStoreTest extends TestCase {

	private array $options  = array();
	private string $base    = '';
	private string $method  = 'direct';
	private int $writes     = 0;

	protected function setUp(): void {
		parent::setUp();

		$this->options = array();
		$this->method  = 'direct';
		$this->writes  = 0;
		$this->base    = sys_get_temp_dir() . '/ka11y-store-' . uniqid( '', true );

		mkdir( $this->base );

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'switch_to_locale' )->justReturn( false );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_permalink' )->justReturn( false );
		Functions\when( 'wp_json_encode' )->alias( static fn ( $value, int $flags = 0 ) => json_encode( $value, $flags ) );
		Functions\when( 'trailingslashit' )->alias( static fn ( string $path ): string => rtrim( $path, '/' ) . '/' );
		Functions\when( 'wp_upload_dir' )->alias(
			fn (): array => array(
				'basedir' => $this->base,
				'baseurl' => 'https://example.test/wp-content/uploads',
			)
		);
		Functions\when( 'wp_mkdir_p' )->alias( static fn ( string $dir ): bool => is_dir( $dir ) || mkdir( $dir, 0777, true ) );
		Functions\when( 'wp_delete_file' )->alias( static function ( string $file ): void {
			unlink( $file );
		} );
		Functions\when( 'get_filesystem_method' )->alias( fn (): string => $this->method );
		Functions\when( 'WP_Filesystem' )->justReturn( true );
		Functions\when( 'set_url_scheme' )->returnArg( 1 );
		Functions\when( 'rest_url' )->alias( static fn ( string $path ): string => 'https://example.test/wp-json/' . $path );
		Functions\when( 'add_query_arg' )->alias( static fn ( array $args, string $url ): string => $url . '?' . http_build_query( $args ) );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->options[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_option' )->alias(
			function ( string $name ): bool {
				unset( $this->options[ $name ] );

				return true;
			}
		);

		$GLOBALS['wp_filesystem'] = new class( $this ) extends WP_Filesystem_Base {

			public function __construct( private PanelDataStoreTest $test ) {}

			public function exists( $path ) {
				return file_exists( $path );
			}

			public function move( $source, $destination, $overwrite = false ) {
				return rename( $source, $destination );
			}

			public function put_contents( $path, $contents, $mode = false ) {
				$this->test->countWrite();

				return false !== file_put_contents( $path, $contents );
			}
		};
	}

	protected function tearDown(): void {
		foreach ( glob( $this->base . '/kotlinskidev-a11y/*' ) ?: array() as $file ) {
			unlink( $file );
		}

		@rmdir( $this->base . '/kotlinskidev-a11y' );
		@rmdir( $this->base );
		unset( $GLOBALS['wp_filesystem'] );

		parent::tearDown();
	}

	public function countWrite(): void {
		++$this->writes;
	}

	public function test_builds_file_named_by_locale_and_hash(): void {
		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertMatchesRegularExpression( '/^panel-en_US-[0-9a-f]{12}\.json$/', $entry['file'] );
		$this->assertFileExists( $this->base . '/kotlinskidev-a11y/' . $entry['file'] );
		$this->assertFileExists( $this->base . '/kotlinskidev-a11y/index.php' );
		$this->assertStringContainsString( $entry['hash'], $entry['file'] );
		$this->assertStringContainsString( '"hash":"' . $entry['hash'] . '"', (string) file_get_contents( $this->base . '/kotlinskidev-a11y/' . $entry['file'] ) );
	}

	public function test_entry_exposes_inline_strings(): void {
		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertSame( array( 'open', 'loadError' ), array_keys( $entry['inline'] ) );
	}

	public function test_entry_is_cached_in_autoloaded_option(): void {
		$autoload = null;

		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value, mixed $flag = null ) use ( &$autoload ): bool {
				$this->options[ $name ] = $value;
				$autoload               = $flag;

				return true;
			}
		);

		( new PanelDataStore() )->entry( 'en_US' );

		$this->assertTrue( $autoload );
		$this->assertArrayHasKey( 'en_US', $this->options['kotlinskidev_a11y_panel_data'] );
	}

	public function test_entry_is_built_once(): void {
		$store = new PanelDataStore();

		$first  = $store->entry( 'en_US' );
		$writes = $this->writes;
		$second = $store->entry( 'en_US' );

		$this->assertSame( $first, $second );
		$this->assertSame( $writes, $this->writes );
	}

	public function test_urls_point_to_uploads_file_and_rest(): void {
		$store = new PanelDataStore();
		$urls  = $store->urls( 'en_US' );
		$entry = $store->entry( 'en_US' );

		$this->assertSame( 'https://example.test/wp-content/uploads/kotlinskidev-a11y/' . $entry['file'], $urls[0] );
		$this->assertSame( 'https://example.test/wp-json/kotlinskidev-a11y/v1/panel-data?locale=en_US&v=' . $entry['hash'], $urls[1] );
	}

	public function test_non_direct_filesystem_gives_rest_urls_for_both(): void {
		$this->method = 'ftpext';
		$urls         = ( new PanelDataStore() )->urls( 'en_US' );

		$this->assertSame( $urls[0], $urls[1] );
		$this->assertStringContainsString( 'panel-data', $urls[0] );
		$this->assertSame( 0, $this->writes );
	}

	public function test_failed_write_backs_off_for_an_hour(): void {
		$this->method = 'ftpext';
		$store        = new PanelDataStore();
		$entry        = $store->entry( 'en_US' );

		$this->assertSame( '', $entry['file'] );
		$this->assertGreaterThan( 0, $entry['failed_at'] );

		$this->method = 'direct';

		$this->assertSame( '', $store->entry( 'en_US' )['file'] );
		$this->assertSame( 0, $this->writes );
	}

	public function test_retries_after_backoff_expires(): void {
		$this->options['kotlinskidev_a11y_panel_data'] = array(
			'en_US' => array(
				'hash'      => 'aaaaaaaaaaaa',
				'file'      => '',
				'inline'    => array( 'open' => '', 'loadError' => '' ),
				'failed_at' => time() - 3601,
			),
		);

		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertNotSame( '', $entry['file'] );
		$this->assertSame( 0, $entry['failed_at'] );
	}

	public function test_invalidate_deletes_option_and_files(): void {
		$store = new PanelDataStore();
		$entry = $store->entry( 'en_US' );

		$store->invalidate();

		$this->assertArrayNotHasKey( 'kotlinskidev_a11y_panel_data', $this->options );
		$this->assertFileDoesNotExist( $this->base . '/kotlinskidev-a11y/' . $entry['file'] );
		$this->assertFileExists( $this->base . '/kotlinskidev-a11y/index.php' );
	}

	public function test_register_hooks_invalidation_and_upgrades(): void {
		$store = new PanelDataStore();

		Actions\expectAdded( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( array( $store, 'invalidate' ) );
		Actions\expectAdded( 'upgrader_process_complete' )->once()->with( array( $store, 'on_upgrade' ), 10, 2 );

		$store->register();

		$this->addToAssertionCount( 1 );
	}

	public function test_translation_upgrade_fires_translations_reason(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->once()->with( 'translations' );

		( new PanelDataStore() )->on_upgrade( null, array( 'type' => 'translation' ) );

		$this->addToAssertionCount( 1 );
	}

	public function test_plugin_upgrade_does_not_fire(): void {
		Actions\expectDone( 'kotlinskidev_a11y_cache_invalidated' )->never();

		( new PanelDataStore() )->on_upgrade( null, array( 'type' => 'plugin' ) );

		$this->addToAssertionCount( 1 );
	}

	public function test_invalid_locale_is_rest_only_and_not_rebuilt(): void {
		$updates = 0;

		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ) use ( &$updates ): bool {
				++$updates;
				$this->options[ $name ] = $value;

				return true;
			}
		);

		$store = new PanelDataStore();
		$first = $store->entry( '../bad' );
		$store->entry( '../bad' );
		$store->entry( '../bad' );

		$this->assertSame( '', $first['file'] );
		$this->assertSame( 1, $updates );
		$this->assertSame( 0, $this->writes );
	}

	public function test_write_leaves_no_temporary_files(): void {
		( new PanelDataStore() )->entry( 'en_US' );

		$this->assertSame( array(), glob( $this->base . '/kotlinskidev-a11y/*.tmp' ) );
	}

	public function test_failed_move_cleans_temporary_file(): void {
		$GLOBALS['wp_filesystem'] = new class() extends WP_Filesystem_Base {

			public function exists( $path ) {
				return true;
			}

			public function put_contents( $path, $contents, $mode = false ) {
				return false !== file_put_contents( $path, $contents );
			}

			public function move( $source, $destination, $overwrite = false ) {
				return false;
			}
		};

		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertSame( '', $entry['file'] );
		$this->assertSame( array(), glob( $this->base . '/kotlinskidev-a11y/*' ) );
	}

	public function test_malformed_cached_entry_is_rebuilt(): void {
		$this->options['kotlinskidev_a11y_panel_data'] = array( 'en_US' => array( 'file' => 'panel-en_US-aaaaaaaaaaaa.json' ) );

		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertMatchesRegularExpression( '/^[0-9a-f]{12}$/', $entry['hash'] );
		$this->assertArrayHasKey( 'inline', $entry );
	}

	public function test_cached_entry_with_unsafe_file_name_is_rebuilt(): void {
		$this->options['kotlinskidev_a11y_panel_data'] = array(
			'en_US' => array(
				'hash'      => 'aaaaaaaaaaaa',
				'file'      => '../../evil.php',
				'inline'    => array( 'open' => '', 'loadError' => '' ),
				'failed_at' => 0,
			),
		);

		$entry = ( new PanelDataStore() )->entry( 'en_US' );

		$this->assertStringStartsWith( 'panel-en_US-', $entry['file'] );
	}

	public function test_upload_dir_error_falls_back_to_rest(): void {
		Functions\when( 'wp_upload_dir' )->justReturn( array( 'error' => 'No write access', 'basedir' => '', 'baseurl' => '' ) );

		$urls = ( new PanelDataStore() )->urls( 'en_US' );

		$this->assertSame( $urls[0], $urls[1] );
		$this->assertSame( 0, $this->writes );
	}

	public function test_upload_base_url_goes_through_set_url_scheme(): void {
		Functions\when( 'set_url_scheme' )->alias( static fn ( string $url ): string => str_replace( 'http://', 'https://', $url ) );
		Functions\when( 'wp_upload_dir' )->alias(
			fn (): array => array(
				'basedir' => $this->base,
				'baseurl' => 'http://example.test/uploads',
				'error'   => false,
			)
		);

		$urls = ( new PanelDataStore() )->urls( 'en_US' );

		$this->assertStringStartsWith( 'https://example.test/uploads/kotlinskidev-a11y/', $urls[0] );
	}
}
