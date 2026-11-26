<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cli;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Closure;
use Kotlinskidev\A11y\Cli\DoctorCommand;
use Kotlinskidev\A11y\Health\Checks;
use Kotlinskidev\A11y\Settings\Repository;
use WP_CLI;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once dirname( __DIR__, 3 ) . '/src/php/requirements.php';

final class DoctorCommandTest extends CliTestCase {

	private string $dir = '';

	protected function setUp(): void {
		parent::setUp();

		$this->dir = sys_get_temp_dir() . '/ka11y-doctor-' . uniqid( '', true ) . '/';

		mkdir( $this->dir . 'vendor', 0777, true );
		mkdir( $this->dir . 'build', 0777, true );
		mkdir( $this->dir . 'uploads', 0777, true );
		file_put_contents( $this->dir . 'vendor/autoload.php', '' );

		foreach ( array( 'loader.js', 'kernel.js', 'panel.js', 'content.js', 'color.js', 'orientation.js', 'frontend.css', 'launcher.css', 'bootstrap.js', 'manifest.php' ) as $file ) {
			file_put_contents( $this->dir . 'build/' . $file, '' );
		}

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
			)
		);
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'get_site_option' )->alias( static fn ( $key, $default = false ) => $default );
		Functions\when( 'wp_upload_dir' )->alias(
			fn () => array(
				'basedir' => $this->dir . 'uploads',
				'baseurl' => 'https://example.test/uploads',
				'error'   => false,
			)
		);
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

	private function command(): DoctorCommand {
		return new DoctorCommand(
			new Checks(
				new Repository(),
				Closure::fromCallable( static fn ( string $name ): mixed => null ),
				Closure::fromCallable( static fn (): array => array() ),
				Closure::fromCallable( static fn (): int => 1700000000 ),
				$this->dir
			)
		);
	}

	public function test_registers_with_a_synopsis(): void {
		DoctorCommand::register();

		$this->assertArrayHasKey( 'ka11y doctor', WP_CLI::$commands );
		$this->assertNotEmpty( WP_CLI::$commands['ka11y doctor']['args']['synopsis'] );
	}

	public function test_prints_every_check_with_the_documented_fields(): void {
		$this->command()->run( array(), array( 'format' => 'json' ) );

		$table = WP_CLI::$tables[0];

		$this->assertSame( 'json', $table['format'] );
		$this->assertSame( array( 'id', 'status', 'label', 'description', 'actions' ), $table['fields'] );
		$this->assertCount( 7, $table['items'] );
		$this->assertIsArray( $table['items'][0]['actions'] );
		$this->assertStringContainsString( 'No check failed', WP_CLI::$successes[0] );
	}

	public function test_table_format_flattens_actions_to_text(): void {
		unlink( $this->dir . 'build/kernel.js' );

		$message = $this->failure_of( fn () => $this->command()->run( array(), array() ) );

		$this->assertStringContainsString( '1 check(s) failed at the critical level', $message );
		$this->assertIsString( WP_CLI::$tables[0]['items'][0]['actions'] );
		$this->assertSame( 'critical', WP_CLI::$tables[0]['items'][0]['status'] );
	}

	public function test_critical_exits_non_zero_by_default(): void {
		unlink( $this->dir . 'build/loader.js' );

		$this->failure_of( fn () => $this->command()->run( array(), array( 'format' => 'json' ) ) );

		$this->assertCount( 1, WP_CLI::$tables );
	}

	public function test_recommended_passes_by_default_and_fails_with_fail_on(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'bogus.path' => 1 ) );

		$this->command()->run( array(), array() );

		$statuses = array_column( WP_CLI::$tables[0]['items'], 'status' );

		$this->assertContains( Checks::RECOMMENDED, $statuses );
		$this->assertNotEmpty( WP_CLI::$successes );

		Repository::flush();
		Repository::reset_request_state();
		WP_CLI::reset();

		$message = $this->failure_of( fn () => $this->command()->run( array(), array( 'fail-on' => 'recommended' ) ) );

		$this->assertStringContainsString( 'recommended level', $message );
	}

	public function test_rejects_bad_options(): void {
		$this->assertStringContainsString( 'Invalid format', $this->failure_of( fn () => $this->command()->run( array(), array( 'format' => 'csv' ) ) ) );
		$this->assertStringContainsString( 'Invalid fail level', $this->failure_of( fn () => $this->command()->run( array(), array( 'fail-on' => 'good' ) ) ) );
	}

	public function test_output_never_contains_a_token(): void {
		$this->command()->run( array(), array( 'format' => 'json' ) );

		$this->assertStringNotContainsStringIgnoringCase( 'token', $this->captured_output() );
	}
}
