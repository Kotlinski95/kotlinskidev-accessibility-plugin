<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Rest\UpdateController;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Update\Channel;
use Kotlinskidev\A11y\Update\Rollback;
use Kotlinskidev\A11y\Update\Updater;
use WP_Error;
use WP_REST_Request;

require_once __DIR__ . '/WpRestStubs.php';

final class UpdateControllerTest extends TestCase {

	private mixed $stored = false;
	private array $reset  = array();
	private array $github = array();

	protected function setUp(): void {
		parent::setUp();

		$this->stored = false;
		$this->reset  = array();
		$this->github = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'wp_parse_url' )->alias( static fn ( string $url ): mixed => parse_url( $url ) );
		Functions\when( 'get_site_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => false === $this->stored ? $fallback : $this->stored );
		Functions\when( 'update_site_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->stored = $value;

				return true;
			}
		);
		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ): bool {
				$this->reset[] = $name;

				return true;
			}
		);
		Functions\when( 'delete_site_transient' )->alias(
			function ( string $name ): bool {
				$this->reset[] = $name;

				return true;
			}
		);
		Functions\when( 'get_site_transient' )->justReturn( false );
		Functions\when( 'set_site_transient' )->justReturn( true );
		Functions\when( 'is_multisite' )->justReturn( false );
		Functions\when( 'admin_url' )->alias( static fn ( string $path ): string => 'https://example.test/wp-admin/' . $path );
		Functions\when( 'add_query_arg' )->alias( static fn ( array $args, string $url ): string => $url . '?' . http_build_query( $args ) );
		Functions\when( 'wp_nonce_url' )->alias( static fn ( string $url, string $action ): string => $url . '&_wpnonce=nonce-for-' . $action );
		Functions\when( 'wp_remote_get' )->alias(
			fn (): array => array(
				'code' => 200,
				'body' => (string) json_encode( $this->github ),
			)
		);
		Functions\when( 'wp_remote_retrieve_response_code' )->alias( static fn ( array $response ): int => $response['code'] );
		Functions\when( 'wp_remote_retrieve_body' )->alias( static fn ( array $response ): string => $response['body'] );
	}

	private function controller( mixed $constant = null ): UpdateController {
		$lookup   = static fn ( string $name ): mixed => 'KOTLINSKIDEV_A11Y_UPDATE_CHANNEL' === $name ? $constant : null;
		$channel  = new Channel( $lookup );
		$updater  = new Updater( '/p/plugin.php', 'Missing\\Factory', $channel, $lookup );
		$rollback = new Rollback( $updater, $channel, '1.0.0' );

		return new UpdateController( $updater, $channel, $rollback );
	}

	public function test_registers_both_routes_with_the_permission_callback(): void {
		$controller = $this->controller();
		$routes     = array();

		Functions\when( 'register_rest_route' )->alias(
			function ( string $namespace, string $route, array $args ) use ( &$routes ): bool {
				$routes[ $namespace . $route ] = $args;

				return true;
			}
		);

		$controller->register_routes();

		$this->assertSame( array( 'kotlinskidev-a11y/v1/update-channel', 'kotlinskidev-a11y/v1/releases' ), array_keys( $routes ) );

		foreach ( $routes['kotlinskidev-a11y/v1/update-channel'] as $endpoint ) {
			$this->assertSame( array( $controller, 'check_permission' ), $endpoint['permission_callback'] );
		}

		$this->assertSame( array( $controller, 'check_permission' ), $routes['kotlinskidev-a11y/v1/releases']['permission_callback'] );
		$this->assertSame( array( 'stable', 'beta' ), $routes['kotlinskidev-a11y/v1/update-channel'][1]['args']['channel']['enum'] );
	}

	public function test_permission_needs_update_plugins_and_a_nonce(): void {
		$request = new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'good' ) );

		Functions\expect( 'current_user_can' )->with( 'update_plugins' )->andReturn( true );
		Functions\when( 'wp_verify_nonce' )->alias( static fn ( string $nonce, string $action ): int|false => 'good' === $nonce && 'wp_rest' === $action ? 1 : false );

		$this->assertTrue( $this->controller()->check_permission( $request ) );
		$this->assertInstanceOf( WP_Error::class, $this->controller()->check_permission( new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'bad' ) ) ) );
		$this->assertInstanceOf( WP_Error::class, $this->controller()->check_permission( new WP_REST_Request() ) );
	}

	public function test_permission_denied_without_capability(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'update_plugins' )->andReturn( false );

		$result = $this->controller()->check_permission( new WP_REST_Request( null, array( 'header:X-WP-Nonce' => 'good' ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array( 'status' => 403 ), $result->data );
	}

	public function test_get_channel_reports_state(): void {
		$data = $this->controller()->get_channel()->get_data();

		$this->assertSame( 'stable', $data['channel'] );
		$this->assertFalse( $data['locked'] );
		$this->assertSame( '0.4.0', $data['floor'] );
	}

	public function test_set_channel_saves_and_clears_update_state(): void {
		$response = $this->controller()->set_channel( new WP_REST_Request( null, array( 'channel' => 'beta' ) ) );

		$this->assertSame( array( 'channel' => 'beta' ), $this->stored );
		$this->assertSame( 'beta', $response->get_data()['channel'] );
		$this->assertContains( 'update_plugins', $this->reset );
		$this->assertContains( 'external_updates-kotlinskidev-accessibility', $this->reset );
	}

	public function test_unchanged_channel_keeps_update_state(): void {
		$this->controller()->set_channel( new WP_REST_Request( null, array( 'channel' => 'stable' ) ) );

		$this->assertSame( array(), $this->reset );
	}

	public function test_invalid_channel_is_rejected(): void {
		$result = $this->controller()->set_channel( new WP_REST_Request( null, array( 'channel' => 'nightly' ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array( 'status' => 400 ), $result->data );
		$this->assertFalse( $this->stored );
	}

	public function test_constant_locks_the_channel(): void {
		$controller = $this->controller( 'stable' );
		$result     = $controller->set_channel( new WP_REST_Request( null, array( 'channel' => 'beta' ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array( 'status' => 409 ), $result->data );
		$this->assertFalse( $this->stored );
		$this->assertTrue( $controller->get_channel()->get_data()['locked'] );
	}

	public function test_releases_return_versions_and_rollback_urls_never_package_urls(): void {
		$base         = 'https://github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/download/v0.4.0/';
		$this->github = array(
			array(
				'tag_name'   => 'v0.4.0',
				'prerelease' => false,
				'assets'     => array(
					array(
						'name'                 => 'kotlinskidev-accessibility.zip',
						'browser_download_url' => $base . 'kotlinskidev-accessibility.zip',
					),
					array(
						'name'                 => 'kotlinskidev-accessibility.zip.sha256',
						'browser_download_url' => $base . 'kotlinskidev-accessibility.zip.sha256',
					),
				),
			),
		);

		$data = $this->controller()->get_releases( new WP_REST_Request( null, array( 'refresh' => true ) ) )->get_data();

		$this->assertSame( '0.4.0', $data['releases'][0]['version'] );
		$this->assertSame( 'https://example.test/wp-admin/admin.php?page=kotlinskidev-a11y-rollback&version=0.4.0&_wpnonce=nonce-for-kotlinskidev_a11y_rollback_0.4.0', $data['releases'][0]['url'] );
		$this->assertStringNotContainsString( 'github.com/Kotlinski95/kotlinskidev-accessibility-plugin/releases/download', (string) json_encode( $data ) );
	}

	public function test_releases_fetch_failure_is_a_502(): void {
		Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 500 );

		$result = $this->controller()->get_releases( new WP_REST_Request() );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( array( 'status' => 502 ), $result->data );
	}
}
