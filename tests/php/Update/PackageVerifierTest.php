<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Update;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\PackageVerifier;
use Kotlinskidev\A11y\Update\Updater;
use WP_Error;

require_once __DIR__ . '/../Rest/WpRestStubs.php';

final class PackageVerifierTest extends TestCase {

	private const BASE = 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/download/v1.0.0/';
	private const ZIP  = self::BASE . 'kotlinskidev-accessibility.zip';

	private string $file          = '';
	private array $options        = array();
	private mixed $checksum       = null;
	private array $deleted        = array();
	private array $requests       = array();
	private mixed $update_plugins = false;

	protected function setUp(): void {
		parent::setUp();

		$this->file           = (string) tempnam( sys_get_temp_dir(), 'ka11y' );
		$this->options        = array();
		$this->deleted        = array();
		$this->checksum       = null;
		$this->requests       = array();
		$this->update_plugins = false;

		file_put_contents( $this->file, 'zip-bytes' );

		PackageVerifier::forget();

		Functions\when( 'get_site_option' )->justReturn( array() );
		Functions\when( 'wp_parse_url' )->alias( static fn ( string $url ): mixed => parse_url( $url ) );
		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'is_wp_error' )->alias( static fn ( mixed $value ): bool => $value instanceof WP_Error );
		Functions\when( 'update_site_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->options[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ): bool {
				unset( $this->options[ $name ] );

				return true;
			}
		);
		Functions\when( 'wp_delete_file' )->alias(
			function ( string $path ): void {
				$this->deleted[] = $path;
			}
		);
		Functions\when( 'download_url' )->alias( fn (): string => $this->file );
		Functions\when( 'get_site_transient' )->alias( fn (): mixed => $this->update_plugins );
		Functions\when( 'wp_safe_remote_get' )->alias(
			function ( string $url, array $args = array() ): mixed {
				$this->requests[] = array( $url, $args );

				return $this->checksum;
			}
		);
		Functions\when( 'wp_remote_retrieve_response_code' )->alias( static fn ( mixed $response ): int => is_array( $response ) ? $response['code'] : 0 );
		Functions\when( 'wp_remote_retrieve_body' )->alias( static fn ( mixed $response ): string => is_array( $response ) ? $response['body'] : '' );
	}

	protected function tearDown(): void {
		PackageVerifier::forget();

		if ( is_file( $this->file ) ) {
			unlink( $this->file );
		}

		parent::tearDown();
	}

	private function verifier(): PackageVerifier {
		$lookup  = static fn (): mixed => null;
		$updater = new Updater( '/p/plugin.php', 'Missing\\Factory', new Channel( $lookup ), $lookup );

		return new PackageVerifier( $updater, 'kotlinskidev-accessibility/kotlinskidev-accessibility.php' );
	}

	private function checksum_response( string $body, int $code = 200 ): array {
		return array(
			'code' => $code,
			'body' => $body,
		);
	}

	private function update_extra(): array {
		return array( 'plugin' => 'kotlinskidev-accessibility/kotlinskidev-accessibility.php' );
	}

	public function test_registers_on_pre_download(): void {
		Functions\expect( 'add_filter' )->once()->with( 'upgrader_pre_download', \Mockery::type( 'array' ), 10, 4 );

		$this->verifier()->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_matching_checksum_returns_local_file(): void {
		$this->checksum = $this->checksum_response( hash( 'sha256', 'zip-bytes' ) . "  kotlinskidev-accessibility.zip\n" );

		$this->assertSame( $this->file, $this->verifier()->verify( false, self::ZIP, null, $this->update_extra() ) );
		$this->assertSame( array(), $this->deleted );
	}

	public function test_mismatch_returns_error_and_discards_file(): void {
		$this->checksum = $this->checksum_response( str_repeat( 'a', 64 ) );

		$result = $this->verifier()->verify( false, self::ZIP, null, $this->update_extra() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_checksum_mismatch', $result->get_error_code() );
		$this->assertSame( array( $this->file ), $this->deleted );
	}

	public function test_uppercase_checksum_is_accepted(): void {
		$this->checksum = $this->checksum_response( strtoupper( hash( 'sha256', 'zip-bytes' ) ) );

		$this->assertSame( $this->file, $this->verifier()->verify( false, self::ZIP, null, $this->update_extra() ) );
	}

	public function test_missing_checksum_blocks_a_release_that_ships_one(): void {
		$this->checksum = $this->checksum_response( 'Not Found', 404 );

		$result = $this->verifier()->verify( false, self::ZIP, null, $this->update_extra() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_checksum_missing', $result->get_error_code() );
		$this->assertArrayNotHasKey( PackageVerifier::UNVERIFIED_FLAG, $this->options );
	}

	public function test_first_checksum_version_is_required_and_older_ones_are_not(): void {
		$this->checksum = $this->checksum_response( 'Not Found', 404 );
		$beta           = 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/download/v1.0.0-beta.1/kotlinskidev-accessibility.zip';

		$this->assertInstanceOf( WP_Error::class, $this->verifier()->verify( false, $beta, null, $this->update_extra() ) );
		$this->assertFalse( $this->verifier()->verify( false, str_replace( 'v1.0.0/', 'v0.9.0/', self::ZIP ), null, $this->update_extra() ) );
	}

	public function test_older_release_without_checksum_installs_and_sets_the_flag(): void {
		$this->checksum = $this->checksum_response( 'Not Found', 404 );
		$old            = str_replace( 'v1.0.0/', 'v0.9.0/', self::ZIP );

		$this->assertFalse( $this->verifier()->verify( false, $old, null, $this->update_extra() ) );
		$this->assertSame( $old, $this->options[ PackageVerifier::UNVERIFIED_FLAG ] );
	}

	public function test_verified_package_clears_an_earlier_flag(): void {
		$this->options[ PackageVerifier::UNVERIFIED_FLAG ] = 'x';
		$this->checksum                                    = $this->checksum_response( hash( 'sha256', 'zip-bytes' ) );

		$this->assertSame( $this->file, $this->verifier()->verify( false, self::ZIP, null, $this->update_extra() ) );
		$this->assertArrayNotHasKey( PackageVerifier::UNVERIFIED_FLAG, $this->options );
	}

	public function test_checksum_fetch_is_safe_and_size_limited(): void {
		$this->checksum = $this->checksum_response( hash( 'sha256', 'zip-bytes' ) );

		$this->verifier()->verify( false, self::ZIP, null, $this->update_extra() );

		$this->assertSame( self::ZIP . '.sha256', $this->requests[0][0] );
		$this->assertSame( 1024, $this->requests[0][1]['limit_response_size'] );
	}

	public function test_missing_checksum_blocks_a_rollback(): void {
		$this->checksum = $this->checksum_response( 'Not Found', 404 );
		PackageVerifier::expect( self::ZIP, self::ZIP . '.sha256' );

		$result = $this->verifier()->verify( false, self::ZIP, null, array() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_checksum_missing', $result->get_error_code() );
	}

	public function test_malformed_checksum_is_treated_as_missing(): void {
		$this->checksum = $this->checksum_response( 'not-a-hash' );
		PackageVerifier::expect( self::ZIP, self::ZIP . '.sha256' );

		$this->assertInstanceOf( WP_Error::class, $this->verifier()->verify( false, self::ZIP, null, array() ) );
	}

	public function test_other_plugins_and_prior_replies_are_untouched(): void {
		$this->checksum = $this->checksum_response( str_repeat( 'a', 64 ) );

		$this->assertFalse( $this->verifier()->verify( false, self::ZIP, null, array( 'plugin' => 'other/other.php' ) ) );
		$this->assertSame( '/already.zip', $this->verifier()->verify( '/already.zip', self::ZIP, null, $this->update_extra() ) );
	}

	public function test_foreign_host_without_a_known_version_fails_closed(): void {
		$result = $this->verifier()->verify( false, 'https://api.example.test/assets/9', null, $this->update_extra() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array(), $this->options );
	}

	public function test_foreign_host_for_an_older_version_installs_and_sets_the_flag(): void {
		$this->update_plugins = (object) array(
			'response' => array(
				'kotlinskidev-accessibility/kotlinskidev-accessibility.php' => (object) array( 'new_version' => '0.9.0' ),
			),
		);

		$this->assertFalse( $this->verifier()->verify( false, 'https://api.example.test/assets/9', null, $this->update_extra() ) );
		$this->assertSame( 'https://api.example.test/assets/9', $this->options[ PackageVerifier::UNVERIFIED_FLAG ] );
		$this->assertSame( array(), $this->requests );
	}

	public function test_foreign_host_cannot_claim_an_old_version_in_its_path(): void {
		$result = $this->verifier()->verify( false, 'https://evil.example.test/releases/download/v0.1.0/kotlinskidev-accessibility.zip', null, $this->update_extra() );

		$this->assertInstanceOf( WP_Error::class, $result );
	}

	public function test_rollback_requires_one_https_host_for_both_urls(): void {
		PackageVerifier::expect( 'https://a.example.test/a.zip', 'https://b.example.test/a.zip.sha256' );

		$this->assertInstanceOf( WP_Error::class, $this->verifier()->verify( false, 'https://a.example.test/a.zip', null, array() ) );
		$this->assertSame( array(), $this->requests );
	}

	public function test_rollback_requires_https_urls(): void {
		PackageVerifier::expect( 'http://example.test/a.zip', 'http://example.test/a.zip.sha256' );

		$this->assertInstanceOf( WP_Error::class, $this->verifier()->verify( false, 'http://example.test/a.zip', null, array() ) );
	}

	public function test_parse_checksum(): void {
		$hash = str_repeat( 'b', 64 );

		$this->assertSame( $hash, PackageVerifier::parse_checksum( $hash . '  file.zip' ) );
		$this->assertNull( PackageVerifier::parse_checksum( substr( $hash, 1 ) ) );
		$this->assertNull( PackageVerifier::parse_checksum( 'zz' . $hash ) );
	}
}
