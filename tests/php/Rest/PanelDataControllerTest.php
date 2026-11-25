<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Rest\PanelDataController;
use Kotlinskidev\A11y\Tests\TestCase;
use WP_Error;
use WP_REST_Request;

require_once __DIR__ . '/WpRestStubs.php';

final class PanelDataControllerTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
		Functions\when( 'pll_current_language' )->justReturn( false );
		Functions\when( 'pll_languages_list' )->justReturn( array() );
		Functions\when( 'get_available_languages' )->justReturn( array( 'pl_PL' ) );
		Functions\when( 'switch_to_locale' )->justReturn( false );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_permalink' )->justReturn( false );
		Functions\when( 'get_option' )->alias( static fn ( string $name, mixed $fallback = false ): mixed => $fallback );
		Functions\when( 'wp_json_encode' )->alias( static fn ( $value, int $flags = 0 ) => json_encode( $value, $flags ) );
	}

	public function test_registers_public_route(): void {
		Functions\expect( 'register_rest_route' )
			->once()
			->with(
				'kotlinskidev-a11y/v1',
				'/panel-data',
				\Mockery::on(
					static fn ( array $args ): bool => '__return_true' === $args['permission_callback']
						&& 'GET' === $args['methods']
						&& true === $args['args']['locale']['required']
				)
			);

		( new PanelDataController() )->register_routes();

		$this->addToAssertionCount( 1 );
	}

	public function test_locale_validation(): void {
		$controller = new PanelDataController();

		$this->assertTrue( $controller->is_locale( 'pl_PL' ) );
		$this->assertTrue( $controller->is_locale( 'en' ) );
		$this->assertFalse( $controller->is_locale( '../etc' ) );
		$this->assertFalse( $controller->is_locale( 'x' ) );
		$this->assertFalse( $controller->is_locale( array( 'en_US' ) ) );
	}

	public function test_version_validation(): void {
		$controller = new PanelDataController();

		$this->assertTrue( $controller->is_version( '0123456789ab' ) );
		$this->assertFalse( $controller->is_version( '0123456789AB' ) );
		$this->assertFalse( $controller->is_version( '0123' ) );
	}

	public function test_payload_keys_and_matching_version_is_immutable(): void {
		$controller = new PanelDataController();
		$probe      = $controller->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'en_US' ) ) );
		$hash       = $probe->get_data()['hash'];

		$response = $controller->get_panel_data(
			new WP_REST_Request(
				null,
				array(
					'locale' => 'en_US',
					'v'      => $hash,
				)
			)
		);

		$this->assertSame(
			array( 'hash', 'locale', 'features', 'profiles', 'widget', 'theme', 'tokens', 'hideToolbar', 'statementUrl', 'customCss', 'strings' ),
			array_keys( $response->get_data() )
		);
		$this->assertSame( 'public, max-age=31536000, immutable', $response->get_headers()['Cache-Control'] );
		$this->assertSame( 'nosniff', $response->get_headers()['X-Content-Type-Options'] );
	}

	public function test_other_version_gets_short_cache(): void {
		$response = ( new PanelDataController() )->get_panel_data(
			new WP_REST_Request(
				null,
				array(
					'locale' => 'en_US',
					'v'      => 'ffffffffffff',
				)
			)
		);

		$this->assertSame( 'public, max-age=600', $response->get_headers()['Cache-Control'] );
	}

	public function test_missing_version_gets_short_cache(): void {
		$response = ( new PanelDataController() )->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'en_US' ) ) );

		$this->assertSame( 'public, max-age=600', $response->get_headers()['Cache-Control'] );
	}

	public function test_never_writes_to_the_filesystem(): void {
		Functions\expect( 'wp_mkdir_p' )->never();
		Functions\expect( 'update_option' )->never();
		Functions\expect( 'wp_upload_dir' )->never();

		( new PanelDataController() )->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'pl_PL' ) ) );

		$this->addToAssertionCount( 1 );
	}

	public function test_unknown_locale_gets_404(): void {
		$result = ( new PanelDataController() )->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'xx_XX' ) ) );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 404, $result->data['status'] );
	}

	public function test_installed_locale_is_served(): void {
		$result = ( new PanelDataController() )->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'pl_PL' ) ) );

		$this->assertNotInstanceOf( WP_Error::class, $result );
	}

	public function test_polylang_language_is_served(): void {
		Functions\when( 'pll_languages_list' )->justReturn( array( 'de_DE' ) );

		$result = ( new PanelDataController() )->get_panel_data( new WP_REST_Request( null, array( 'locale' => 'de_DE' ) ) );

		$this->assertNotInstanceOf( WP_Error::class, $result );
	}
}
