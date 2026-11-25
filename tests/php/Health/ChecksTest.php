<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Health;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Closure;
use Kotlinskidev\A11y\Health\Checks;
use Kotlinskidev\A11y\Health\SiteHealth;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Tests\TestCase;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once dirname( __DIR__, 3 ) . '/src/php/requirements.php';

final class ChecksTest extends TestCase {

	private const NOW = 1_800_000_000;

	private string $dir = '';

	private array $option = array();

	private mixed $update_state = null;

	protected function setUp(): void {
		parent::setUp();
		$this->dir          = sys_get_temp_dir() . '/ka11y-health-' . uniqid( '', true ) . '/';
		$this->option       = array();
		$this->update_state = null;
		$this->build_complete();

		Functions\stubs(
			array(
				'admin_url'       => static fn ( $path = '' ): string => 'https://example.test/wp-admin/' . $path,
				'wp_parse_url'    => static fn ( $url, $component = -1 ) => parse_url( (string) $url, $component ),
				'trailingslashit' => static fn ( $value ): string => rtrim( (string) $value, '/' ) . '/',
				'wp_is_writable'  => static fn ( $path ): bool => is_writable( (string) $path ),
				'is_main_site'    => true,
				'esc_html'        => static fn ( $text ): string => htmlspecialchars( (string) $text ),
				'esc_url'         => static fn ( $url ): string => (string) $url,
				'get_bloginfo'    => '6.8',
				'__'              => static fn ( $text ): string => (string) $text,
			)
		);
		Functions\when( 'get_option' )->alias( fn ( $key, $default = false ) => 'kotlinskidev_a11y_settings' === $key ? $this->option : $default );
		Functions\when( 'get_site_option' )->alias( fn ( $key, $default = false ) => str_starts_with( (string) $key, 'external_updates-' ) ? $this->update_state : $default );
		Functions\when( 'wp_upload_dir' )->alias(
			fn () => array(
				'basedir' => $this->dir . 'uploads',
				'baseurl' => 'https://example.test/uploads',
				'error'   => false,
			)
		);
		mkdir( $this->dir . 'uploads', 0777, true );
	}

	protected function tearDown(): void {
		$this->remove( $this->dir );
		unset( $GLOBALS['wp_filter'] );
		parent::tearDown();
	}

	private function remove( string $path ): void {
		if ( is_dir( $path ) ) {
			foreach ( array_diff( scandir( $path ) ?: array(), array( '.', '..' ) ) as $entry ) {
				$this->remove( rtrim( $path, '/' ) . '/' . $entry );
			}

			rmdir( $path );

			return;
		}

		if ( is_file( $path ) ) {
			unlink( $path );
		}
	}

	private function build_complete(): void {
		mkdir( $this->dir . 'vendor', 0777, true );
		mkdir( $this->dir . 'build', 0777, true );
		file_put_contents( $this->dir . 'vendor/autoload.php', '' );

		$files = array( 'loader.js', 'kernel.js', 'panel.js', 'content.js', 'color.js', 'orientation.js', 'frontend.css', 'launcher.css', 'bootstrap.js', 'manifest.php' );

		foreach ( $files as $file ) {
			file_put_contents( $this->dir . 'build/' . $file, '' );
		}
	}

	private function checks( array $constants = array(), array $locales = array(), ?int $now = null ): Checks {
		return new Checks(
			new Repository(),
			Closure::fromCallable( static fn ( string $name ): mixed => $constants[ $name ] ?? null ),
			Closure::fromCallable( static fn (): array => $locales ),
			Closure::fromCallable( static fn (): int => $now ?? self::NOW ),
			$this->dir
		);
	}

	private function assert_shape( array $result, string $id, string $status ): void {
		$this->assertSame( array( 'id', 'status', 'label', 'description', 'actions' ), array_keys( $result ) );
		$this->assertSame( $id, $result['id'] );
		$this->assertSame( $status, $result['status'] );
		$this->assertNotSame( '', $result['label'] );
		$this->assertNotSame( '', $result['description'] );
		$this->assertIsArray( $result['actions'] );
	}

	public function test_all_runs_the_six_ids_in_order(): void {
		$ids = array_column( $this->checks()->all(), 'id' );

		$this->assertSame(
			array(
				'kotlinskidev_a11y_build_files',
				'kotlinskidev_a11y_update_source',
				'kotlinskidev_a11y_optimizer_conflicts',
				'kotlinskidev_a11y_page_cache_language',
				'kotlinskidev_a11y_locked_settings',
				'kotlinskidev_a11y_panel_data_store',
			),
			$ids
		);
		$this->assertNull( $this->checks()->run( 'unknown' ) );
	}

	public function test_build_files_pass(): void {
		$this->assert_shape( $this->checks()->build_files(), Checks::BUILD_FILES, Checks::GOOD );
	}

	public function test_build_files_critical_when_manifest_file_missing(): void {
		unlink( $this->dir . 'build/kernel.js' );

		$result = $this->checks()->build_files();

		$this->assert_shape( $result, Checks::BUILD_FILES, Checks::CRITICAL );
		$this->assertStringContainsString( 'build/kernel.js', $result['description'] );
		$this->assertNotSame( array(), $result['actions'] );
	}

	public function test_build_files_critical_when_required_file_missing(): void {
		unlink( $this->dir . 'build/loader.js' );

		$this->assert_shape( $this->checks()->build_files(), Checks::BUILD_FILES, Checks::CRITICAL );
	}

	public function test_update_source_passes_after_recent_check(): void {
		$this->update_state = (object) array( 'lastCheck' => self::NOW - 3600 );

		$result = $this->checks()->update_source();

		$this->assert_shape( $result, Checks::UPDATE_SOURCE, Checks::GOOD );
		$this->assertStringContainsString( 'github.com', $result['description'] );
		$this->assertStringNotContainsString( 'https://', $result['description'] );
	}

	public function test_update_source_recommended_when_check_is_stale(): void {
		$this->update_state = (object) array( 'lastCheck' => self::NOW - 200000 );

		$this->assert_shape( $this->checks()->update_source(), Checks::UPDATE_SOURCE, Checks::RECOMMENDED );
	}

	public function test_update_source_recommended_when_never_checked(): void {
		$this->assert_shape( $this->checks()->update_source(), Checks::UPDATE_SOURCE, Checks::RECOMMENDED );
	}

	public function test_update_source_recommended_for_http_source_without_leaking_query(): void {
		$this->update_state = (object) array( 'lastCheck' => self::NOW );
		Filters\expectApplied( 'kotlinskidev_a11y_update_source' )->andReturn( array( 'repository' => 'http://updates.example.test/repo?token=secret' ) );

		$result = $this->checks()->update_source();

		$this->assert_shape( $result, Checks::UPDATE_SOURCE, Checks::RECOMMENDED );
		$this->assertStringContainsString( 'updates.example.test', $result['description'] );
		$this->assertStringNotContainsString( 'secret', $result['description'] );
	}

	public function test_update_source_skipped_when_updater_disabled_by_constant(): void {
		$result = $this->checks( array( 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER' => true ) )->update_source();

		$this->assert_shape( $result, Checks::UPDATE_SOURCE, Checks::GOOD );
		$this->assertFalse( $this->checks( array( 'KOTLINSKIDEV_A11Y_DISABLE_UPDATER' => true ) )->updater_enabled() );
	}

	public function test_update_source_skipped_when_updater_disabled_by_filter(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_enable_updater' )->andReturn( false );

		$this->assert_shape( $this->checks()->update_source(), Checks::UPDATE_SOURCE, Checks::GOOD );
	}

	public function test_update_source_skipped_on_subsite(): void {
		Functions\when( 'is_multisite' )->justReturn( true );
		Functions\when( 'is_main_site' )->justReturn( false );

		$this->assert_shape( $this->checks()->update_source(), Checks::UPDATE_SOURCE, Checks::GOOD );
	}

	public function test_optimizers_pass_when_none_detected(): void {
		$this->assert_shape( $this->checks()->optimizer_conflicts(), Checks::OPTIMIZER_CONFLICTS, Checks::GOOD );
	}

	public function test_optimizer_without_opt_out_is_recommended(): void {
		$result = $this->checks(
			array(
				'WP_ROCKET_VERSION'     => '3.0',
				'CLOUDFLARE_PLUGIN_DIR' => '/x',
			)
		)->optimizer_conflicts();

		$this->assert_shape( $result, Checks::OPTIMIZER_CONFLICTS, Checks::RECOMMENDED );
		$this->assertStringContainsString( 'WP Rocket', $result['description'] );
		$this->assertStringContainsString( 'Cloudflare', $result['description'] );
	}

	public function test_optimizer_passes_with_matching_opt_out(): void {
		$this->option = array(
			'performance' => array(
				'preset' => 'custom',
				'optOut' => array( 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup', 'cloudflare' ),
			),
		);
		$constants    = array(
			'WP_ROCKET_VERSION'     => '3',
			'LSCWP_V'               => '6',
			'JETPACK_BOOST_VERSION' => '3',
			'WPACU_PLUGIN_VERSION'  => '1',
			'CLOUDFLARE_PLUGIN_DIR' => '/c',
		);

		$this->assert_shape( $this->checks( $constants )->optimizer_conflicts(), Checks::OPTIMIZER_CONFLICTS, Checks::GOOD );
	}

	public function test_optimizer_partial_opt_out_still_flags_the_rest(): void {
		$this->option = array(
			'performance' => array(
				'preset' => 'custom',
				'optOut' => array( 'wp-rocket' ),
			),
		);

		$result = $this->checks(
			array(
				'WP_ROCKET_VERSION' => '3',
				'LSCWP_V'           => '6',
			)
		)->optimizer_conflicts();

		$this->assert_shape( $result, Checks::OPTIMIZER_CONFLICTS, Checks::RECOMMENDED );
		$this->assertStringContainsString( 'LiteSpeed Cache', $result['description'] );
		$this->assertStringNotContainsString( 'WP Rocket', $result['description'] );
	}

	public function test_optimizer_passes_under_compatibility_preset(): void {
		$this->option = array( 'performance' => array( 'preset' => 'compatibility' ) );

		$this->assert_shape( $this->checks( array( 'WP_ROCKET_VERSION' => '3' ) )->optimizer_conflicts(), Checks::OPTIMIZER_CONFLICTS, Checks::GOOD );
	}

	public function test_autoptimize_gets_an_advisory(): void {
		$result = $this->checks( array( 'AUTOPTIMIZE_PLUGIN_VERSION' => '3' ) )->optimizer_conflicts();

		$this->assert_shape( $result, Checks::OPTIMIZER_CONFLICTS, Checks::RECOMMENDED );
		$this->assertStringContainsString( 'Autoptimize', $result['label'] );
	}

	private function locales( int $count ): array {
		return array_map(
			static fn ( int $index ): array => array(
				'code' => 'xx_' . $index,
				'name' => 'L' . $index,
			),
			range( 1, $count )
		);
	}

	private function hook_listener( callable|array|string $callback ): void {
		$GLOBALS['wp_filter'] = array(
			'kotlinskidev_a11y_cache_invalidated' => (object) array( 'callbacks' => array( 10 => array( array( 'function' => $callback ) ) ) ),
		);
	}

	public function test_single_language_passes_with_page_cache(): void {
		$this->assert_shape( $this->checks( array( 'WP_CACHE' => true ), $this->locales( 1 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::GOOD );
	}

	public function test_multilingual_without_page_cache_passes(): void {
		$this->assert_shape( $this->checks( array(), $this->locales( 2 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::GOOD );
	}

	public function test_multilingual_with_page_cache_and_no_listener_is_recommended(): void {
		$this->assert_shape( $this->checks( array( 'WP_CACHE' => true ), $this->locales( 2 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::RECOMMENDED );
	}

	public function test_own_invalidation_hook_does_not_count_as_listener(): void {
		$this->hook_listener( array( new \Kotlinskidev\A11y\Frontend\PanelDataStore(), 'invalidate' ) );

		$this->assert_shape( $this->checks( array( 'WP_CACHE' => true ), $this->locales( 2 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::RECOMMENDED );
	}

	public function test_external_invalidation_hook_passes(): void {
		$this->hook_listener( 'purge_my_cache' );

		$this->assert_shape( $this->checks( array( 'WP_CACHE' => true ), $this->locales( 3 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::GOOD );
	}

	public function test_advanced_cache_file_counts_as_page_cache(): void {
		file_put_contents( $this->dir . 'advanced-cache.php', '' );

		$this->assert_shape( $this->checks( array( 'WP_CONTENT_DIR' => rtrim( $this->dir, '/' ) ), $this->locales( 2 ) )->page_cache_language(), Checks::PAGE_CACHE_LANGUAGE, Checks::RECOMMENDED );
	}

	public function test_locks_pass_when_valid(): void {
		$this->assert_shape( $this->checks()->locked_settings(), Checks::LOCKED_SETTINGS, Checks::GOOD );
	}

	public function test_invalid_locks_are_listed(): void {
		Functions\when( 'is_admin' )->justReturn( false );
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn(
			array(
				'storage.mode' => 'bogus',
				'nope'         => 1,
			)
		);

		$result = $this->checks()->locked_settings();

		$this->assert_shape( $result, Checks::LOCKED_SETTINGS, Checks::RECOMMENDED );
		$this->assertStringContainsString( 'storage.mode (invalid_value)', $result['description'] );
		$this->assertStringContainsString( 'nope (unknown_path)', $result['description'] );
	}

	public function test_panel_data_store_passes_when_uploads_writable(): void {
		$this->assert_shape( $this->checks()->panel_data_store(), Checks::PANEL_DATA_STORE, Checks::GOOD );
	}

	public function test_panel_data_store_passes_with_writable_existing_folder(): void {
		mkdir( $this->dir . 'uploads/kotlinskidev-a11y', 0777, true );

		$this->assert_shape( $this->checks()->panel_data_store(), Checks::PANEL_DATA_STORE, Checks::GOOD );
	}

	public function test_panel_data_store_recommended_when_folder_read_only(): void {
		mkdir( $this->dir . 'uploads/kotlinskidev-a11y', 0555, true );

		try {
			$this->assert_shape( $this->checks()->panel_data_store(), Checks::PANEL_DATA_STORE, Checks::RECOMMENDED );
		} finally {
			chmod( $this->dir . 'uploads/kotlinskidev-a11y', 0777 );
		}
	}

	public function test_panel_data_store_recommended_when_uploads_unusable(): void {
		Functions\when( 'wp_upload_dir' )->justReturn( array( 'error' => 'no uploads' ) );

		$this->assert_shape( $this->checks()->panel_data_store(), Checks::PANEL_DATA_STORE, Checks::RECOMMENDED );
	}

	public function test_site_health_registers_direct_tests_only(): void {
		$health = new SiteHealth( $this->checks() );

		$tests = $health->add_tests(
			array(
				'direct' => array(
					'core' => array(
						'label' => 'Core',
						'test'  => 'x',
					),
				),
			)
		);

		$this->assertArrayNotHasKey( 'async', $tests );
		$this->assertCount( 7, $tests['direct'] );

		foreach ( ( new Checks() )->ids() as $id ) {
			$this->assertIsCallable( $tests['direct'][ $id ]['test'] );
		}
	}

	public function test_site_health_adapts_result_to_core_format(): void {
		$health = new SiteHealth( $this->checks() );
		$tests  = $health->add_tests( array() );

		$result = $tests['direct'][ Checks::BUILD_FILES ]['test']();

		$this->assertSame( 'good', $result['status'] );
		$this->assertSame( Checks::BUILD_FILES, $result['test'] );
		$this->assertSame( 'green', $result['badge']['color'] );
		$this->assertStringStartsWith( '<p>', $result['description'] );
	}

	public function test_site_health_renders_critical_actions_as_links(): void {
		unlink( $this->dir . 'build/kernel.js' );
		$tests = ( new SiteHealth( $this->checks() ) )->add_tests( array() );

		$result = $tests['direct'][ Checks::BUILD_FILES ]['test']();

		$this->assertSame( 'critical', $result['status'] );
		$this->assertSame( 'red', $result['badge']['color'] );
		$this->assertStringContainsString( '<a href="https://example.test/wp-admin/plugins.php">', $result['actions'] );
	}

	public function test_debug_section_hides_token_value_and_marks_host_private(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_token' )->andReturn( 'ghp_supersecret' );

		$info = ( new SiteHealth( $this->checks() ) )->add_debug_information( array( 'wp-core' => array() ) );

		$this->assertArrayHasKey( 'kotlinskidev-accessibility', $info );
		$fields = $info['kotlinskidev-accessibility']['fields'];

		$this->assertSame( 'yes', $fields['tokenSet']['value'] );
		$this->assertTrue( $fields['sourceHost']['private'] );
		$this->assertSame( 'github.com', $fields['sourceHost']['value'] );
		$this->assertStringNotContainsString( 'ghp_supersecret', (string) json_encode( $info ) );

		foreach ( $fields as $key => $field ) {
			if ( 'sourceHost' !== $key ) {
				$this->assertFalse( $field['private'], $key );
			}
		}
	}
}
