<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\PackageVerifier;
use Kotlinskidev\A11y\Update\Rollback;
use Kotlinskidev\A11y\Update\Updater;
use WP_Error;

require_once __DIR__ . '/../Rest/WpRestStubs.php';

final class RollbackTest extends TestCase {

	private const BASE = 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/download/';

	private array $transients = array();
	private array $options    = array();
	private array $requests   = array();
	private array $releases   = array();

	protected function setUp(): void {
		parent::setUp();

		$this->transients = array();
		$this->options    = array();
		$this->requests   = array();
		$this->releases   = $this->github_payload();

		PackageVerifier::forget();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'wp_parse_url' )->alias( static fn ( string $url ): mixed => parse_url( $url ) );
		Functions\when( 'get_site_option' )->justReturn( array() );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value, mixed $autoload = null ): bool {
				$this->options[ $name ]               = $value;
				$this->options[ $name . ':autoload' ] = $autoload;

				return true;
			}
		);
		Functions\when( 'get_site_transient' )->alias( fn ( string $name ): mixed => $this->transients[ $name ] ?? false );
		Functions\when( 'set_site_transient' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->transients[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'wp_remote_get' )->alias(
			function ( string $url, array $args = array() ): array {
				$this->requests[] = array( $url, $args );

				return array(
					'code' => 200,
					'body' => (string) json_encode( $this->releases ),
				);
			}
		);
		Functions\when( 'wp_remote_retrieve_response_code' )->alias( static fn ( array $response ): int => $response['code'] );
		Functions\when( 'wp_remote_retrieve_body' )->alias( static fn ( array $response ): string => $response['body'] );
	}

	protected function tearDown(): void {
		PackageVerifier::forget();
		parent::tearDown();
	}

	private function asset( string $tag, string $name ): array {
		return array(
			'name'                 => $name,
			'browser_download_url' => self::BASE . $tag . '/' . $name,
		);
	}

	private function release( string $version, bool $prerelease = false, bool $checksum = true, bool $draft = false ): array {
		$tag    = 'v' . $version;
		$assets = array( $this->asset( $tag, 'kotlinskidev-accessibility.zip' ) );

		if ( $checksum ) {
			$assets[] = $this->asset( $tag, 'kotlinskidev-accessibility.zip.sha256' );
		}

		return array(
			'tag_name'   => $tag,
			'prerelease' => $prerelease,
			'draft'      => $draft,
			'assets'     => $assets,
		);
	}

	private function github_payload(): array {
		return array(
			$this->release( '1.0.0-beta.1', true ),
			$this->release( '0.9.0' ),
			$this->release( '0.8.0' ),
			$this->release( '0.7.0' ),
			$this->release( '0.6.0' ),
			$this->release( '0.5.0', false, true, true ),
			$this->release( '0.4.0' ),
			$this->release( '0.1.1' ),
		);
	}

	private function rollback( string $installed = '1.0.0', string $channel = 'stable', ?\Closure $upgrade = null ): Rollback {
		$lookup  = static fn ( string $name ): mixed => 'KOTLINSKIDEV_A11Y_UPDATE_CHANNEL' === $name ? $channel : null;
		$updater = new Updater( '/p/plugin.php', 'Missing\\Factory', new Channel( $lookup ), $lookup );

		return new Rollback( $updater, new Channel( $lookup ), $installed, $upgrade );
	}

	private function versions( array|WP_Error $candidates ): array {
		$this->assertIsArray( $candidates );

		return array_column( $candidates, 'version' );
	}

	public function test_offers_newest_three_older_stable_releases_above_the_floor(): void {
		$this->assertSame( array( '0.9.0', '0.8.0', '0.7.0' ), $this->versions( $this->rollback()->candidates() ) );
	}

	public function test_floor_is_enforced(): void {
		$this->releases = array( $this->release( '0.3.9' ), $this->release( '0.4.0' ), $this->release( '0.1.1' ) );

		$this->assertSame( array( '0.4.0' ), $this->versions( $this->rollback()->candidates() ) );
	}

	public function test_prereleases_only_on_beta_channel(): void {
		$this->releases = array( $this->release( '1.0.0-beta.1', true ), $this->release( '0.4.0' ) );

		$this->assertSame( array( '0.4.0' ), $this->versions( $this->rollback( '1.0.0-rc.1' )->candidates() ) );

		$this->transients = array();

		$this->assertSame( array( '1.0.0-beta.1', '0.4.0' ), $this->versions( $this->rollback( '1.0.0-rc.1', 'beta' )->candidates() ) );
	}

	public function test_installed_and_newer_versions_are_excluded(): void {
		$this->assertSame( array( '0.7.0', '0.6.0', '0.4.0' ), $this->versions( $this->rollback( '0.8.0' )->candidates() ) );
	}

	public function test_releases_without_checksum_asset_or_drafts_are_not_offered(): void {
		$this->releases = array( $this->release( '0.4.0', false, false ), $this->release( '0.6.0' ), $this->release( '0.5.0', false, true, true ) );

		$this->assertSame( array( '0.6.0' ), $this->versions( $this->rollback()->candidates() ) );
	}

	public function test_assets_from_other_hosts_are_ignored(): void {
		$release                                      = $this->release( '0.4.0' );
		$release['assets'][0]['browser_download_url'] = 'https://evil.example.test/kotlinskidev-accessibility.zip';
		$this->releases                               = array( $release );

		$this->assertSame( array(), $this->versions( $this->rollback()->candidates() ) );
	}

	public function test_invalid_tags_are_ignored(): void {
		$this->releases = array( $this->release( '0.4.0' ), array_merge( $this->release( '0.6.0' ), array( 'tag_name' => 'v0.6.0-alpha.1' ) ) );

		$this->assertSame( array( '0.4.0' ), $this->versions( $this->rollback()->candidates() ) );
	}

	public function test_request_goes_to_github_api_with_timeout_and_is_cached(): void {
		$rollback = $this->rollback();

		$rollback->candidates();
		$rollback->candidates();

		$this->assertCount( 1, $this->requests );
		$this->assertSame( 'https://api.github.com/repos/Kotlinski95/kotlinskidev-accessibility-plugin/releases?per_page=30', $this->requests[0][0] );
		$this->assertSame( 10, $this->requests[0][1]['timeout'] );
		$this->assertArrayNotHasKey( 'Authorization', $this->requests[0][1]['headers'] );

		$rollback->candidates( true );

		$this->assertCount( 2, $this->requests );
	}

	public function test_token_goes_in_authorization_header(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_token' )->andReturn( 'secret' );

		$this->rollback()->candidates();

		$this->assertSame( 'Bearer secret', $this->requests[0][1]['headers']['Authorization'] );
		$this->assertSame( 0, $this->requests[0][1]['redirection'] );
		$this->assertFalse( Rollback::valid_version( "0.9.0\n" ) );
	}

	public function test_fetch_failure_returns_error(): void {
		Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 500 );

		$result = $this->rollback()->candidates();

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array(), $this->transients );
	}

	public function test_other_sources_supply_releases_through_filter(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_update_source' )->andReturn( array( 'repository' => 'https://updates.example.test/x/' ) );
		Filters\expectApplied( 'kotlinskidev_a11y_rollback_releases' )->once()->andReturn(
			array(
				array(
					'version'    => '0.4.0',
					'package'    => 'https://updates.example.test/0.4.0.zip',
					'sha256_url' => 'https://updates.example.test/0.4.0.zip.sha256',
				),
				array(
					'version'    => '0.6.0',
					'package'    => 'http://updates.example.test/0.6.0.zip',
					'sha256_url' => 'https://updates.example.test/0.6.0.zip.sha256',
				),
				array(
					'version'    => '0.5.0',
					'package'    => 'https://updates.example.test/0.5.0.zip',
					'sha256_url' => 'https://evil.example.test/0.5.0.zip.sha256',
				),
				array(
					'version'    => '0.2.0; rm',
					'package'    => 'https://updates.example.test/0.2.0.zip',
					'sha256_url' => 'https://updates.example.test/0.2.0.zip.sha256',
				),
				'junk',
			)
		);

		$this->assertSame( array( '0.4.0' ), $this->versions( $this->rollback()->candidates() ) );
		$this->assertSame( array(), $this->requests );
	}

	public function test_unlisted_or_malformed_versions_have_no_candidate(): void {
		$rollback = $this->rollback();

		$this->assertNotNull( $rollback->candidate( '0.9.0' ) );
		$this->assertNull( $rollback->candidate( '0.6.0' ) );
		$this->assertNull( $rollback->candidate( '0.3.0/../../x' ) );
		$this->assertNull( $rollback->candidate( '1.0.0-beta.1' ) );
	}

	public function test_run_backs_up_settings_and_installs_the_server_side_package(): void {
		$this->options['kotlinskidev_a11y_settings'] = array( 'storage' => array( 'ttlDays' => 7 ) );
		$installed                                   = array();
		$rollback                                    = $this->rollback(
			'1.0.0',
			'stable',
			function ( string $package ) use ( &$installed ): bool {
				$installed[] = $package;

				return true;
			}
		);

		$this->assertTrue( $rollback->run( '0.9.0' ) );
		$this->assertSame( array( self::BASE . 'v0.9.0/kotlinskidev-accessibility.zip' ), $installed );
		$this->assertSame( array( 'storage' => array( 'ttlDays' => 7 ) ), $this->options['kotlinskidev_a11y_settings_backup'] );
		$this->assertFalse( $this->options['kotlinskidev_a11y_settings_backup:autoload'] );
	}

	public function test_run_registers_the_checksum_url_only_while_installing(): void {
		$during   = array();
		$property = new \ReflectionProperty( PackageVerifier::class, 'expected' );
		$rollback = $this->rollback(
			'1.0.0',
			'stable',
			function () use ( &$during, $property ): bool {
				$during = $property->getValue();

				return true;
			}
		);

		$rollback->run( '0.9.0' );

		$this->assertSame( array( self::BASE . 'v0.9.0/kotlinskidev-accessibility.zip' => self::BASE . 'v0.9.0/kotlinskidev-accessibility.zip.sha256' ), $during );
		$this->assertSame( array(), $property->getValue() );
	}

	public function test_run_refuses_unknown_versions_without_backup_or_install(): void {
		$called   = false;
		$rollback = $this->rollback(
			'1.0.0',
			'stable',
			function () use ( &$called ): bool {
				$called = true;

				return true;
			}
		);

		$result = $rollback->run( '0.6.0' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertFalse( $called );
		$this->assertArrayNotHasKey( 'kotlinskidev_a11y_settings_backup', $this->options );
	}

	public function test_run_returns_installer_errors(): void {
		$rollback = $this->rollback( '1.0.0', 'stable', static fn (): WP_Error => new WP_Error( 'kotlinskidev_a11y_checksum_mismatch', 'bad' ) );

		$result = $rollback->run( '0.9.0' );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_checksum_mismatch', $result->get_error_code() );
	}
}
