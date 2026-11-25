<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Rest;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\AltTextCounter;
use Kotlinskidev\A11y\Rest\AltTextController;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/WpRestStubs.php';
require_once dirname( __DIR__ ) . '/Admin/WpQueryStub.php';

final class AltTextControllerTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( '__' )->returnArg( 1 );
	}

	public function test_registers_post_route_with_namespace(): void {
		Functions\expect( 'register_rest_route' )
			->once()
			->with(
				'kotlinskidev-a11y/v1',
				'/alt-text/(?P<id>\d+)',
				\Mockery::on(
					static fn ( array $args ): bool => 'POST' === $args['methods'] && is_array( $args['permission_callback'] ) && 'string' === $args['args']['alt']['type']
				)
			);

		( new AltTextController() )->register_routes();
		$this->addToAssertionCount( 1 );
	}

	public function test_permission_needs_upload_files_and_edit_post(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'upload_files' )->andReturn( true );
		Functions\expect( 'current_user_can' )->once()->with( 'edit_post', 12 )->andReturn( true );

		$this->assertTrue( ( new AltTextController() )->check_permission( new \WP_REST_Request( null, array( 'id' => '12' ) ) ) );
	}

	public function test_permission_denied_without_upload_files(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'upload_files' )->andReturn( false );

		$this->assertFalse( ( new AltTextController() )->check_permission( new \WP_REST_Request( null, array( 'id' => 12 ) ) ) );
	}

	public function test_permission_denied_without_edit_post(): void {
		Functions\when( 'current_user_can' )->alias( static fn ( string $capability ): bool => 'upload_files' === $capability );

		$this->assertFalse( ( new AltTextController() )->check_permission( new \WP_REST_Request( null, array( 'id' => 12 ) ) ) );
	}

	public function test_rejects_non_attachment(): void {
		Functions\when( 'get_post_type' )->justReturn( 'post' );
		Functions\expect( 'update_post_meta' )->never();

		$result = ( new AltTextController() )->update_alt_text(
			new \WP_REST_Request(
				null,
				array(
					'id'  => 5,
					'alt' => 'x',
				)
			)
		);

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 404, $result->data['status'] );
	}

	public function test_sanitizes_saves_and_returns_remaining(): void {
		\WP_Query::$found = 2;
		Functions\when( 'get_post_type' )->justReturn( 'attachment' );
		Functions\expect( 'update_post_meta' )->once()->with( 9, '_wp_attachment_image_alt', 'A cat' );
		Functions\expect( 'delete_transient' )->once()->with( AltTextCounter::TRANSIENT );
		Functions\when( 'get_transient' )->justReturn( false );
		Functions\when( 'set_transient' )->justReturn( true );

		$response = ( new AltTextController() )->update_alt_text(
			new \WP_REST_Request(
				null,
				array(
					'id'  => '9',
					'alt' => '  <b>A cat</b> ',
				)
			)
		);

		$this->assertSame(
			array(
				'id'        => 9,
				'alt'       => 'A cat',
				'remaining' => 2,
			),
			$response->get_data()
		);
	}
}
