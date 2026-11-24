<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\AltTextPage;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/WpQueryStub.php';

final class AltTextPageTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'__'              => static fn ( $text ) => $text,
				'esc_html__'      => static fn ( $text ) => $text,
				'esc_html'        => static fn ( $text ) => $text,
				'esc_attr'        => static fn ( $text ) => $text,
				'admin_url'       => static fn ( $path = '' ) => 'https://example.test/wp-admin/' . $path,
				'rest_url'        => static fn ( $path = '' ) => 'https://example.test/wp-json/' . $path,
				'wp_create_nonce' => 'nonce123',
				'wp_json_encode'  => static fn ( $value, $flags = 0 ) => json_encode( $value, $flags ),
			)
		);
	}

	public function test_registers_hooks(): void {
		$page = new AltTextPage();

		Actions\expectAdded( 'admin_menu' )->once()->with( array( $page, 'add_menu' ) );
		Actions\expectAdded( 'admin_enqueue_scripts' )->once()->with( array( $page, 'enqueue' ) );

		$page->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_menu_is_media_submenu_with_upload_capability(): void {
		Functions\expect( 'add_submenu_page' )
			->once()
			->with( 'upload.php', 'Missing alt text', 'Missing alt text', 'upload_files', 'kotlinskidev-a11y-alt-text', \Mockery::type( 'array' ) )
			->andReturn( 'media_page_kotlinskidev-a11y-alt-text' );

		( new AltTextPage() )->add_menu();
		$this->addToAssertionCount( 1 );
	}

	public function test_query_args_filter_missing_alt_and_paginate(): void {
		$args = ( new AltTextPage() )->query_args( 3, 'logo' );

		$this->assertSame( 'attachment', $args['post_type'] );
		$this->assertSame( 'inherit', $args['post_status'] );
		$this->assertSame( 'image', $args['post_mime_type'] );
		$this->assertSame( 20, $args['posts_per_page'] );
		$this->assertSame( 3, $args['paged'] );
		$this->assertSame( 'logo', $args['s'] );
		$this->assertFalse( $args['no_found_rows'] );
		$this->assertSame( 'OR', $args['meta_query']['relation'] );
		$this->assertSame( 'NOT EXISTS', $args['meta_query'][0]['compare'] );
		$this->assertSame( '', $args['meta_query'][1]['value'] );
		$this->assertSame( '_wp_attachment_image_alt', $args['meta_query'][1]['key'] );
	}

	public function test_query_args_omit_empty_search_and_clamp_page(): void {
		$args = ( new AltTextPage() )->query_args( 0, '' );

		$this->assertArrayNotHasKey( 's', $args );
		$this->assertSame( 1, $args['paged'] );
	}

	public function test_assets_enqueue_only_on_own_screen(): void {
		Functions\when( 'add_submenu_page' )->justReturn( 'media_page_kotlinskidev-a11y-alt-text' );
		Functions\expect( 'wp_enqueue_script' )->never();

		$page = new AltTextPage();
		$page->add_menu();
		$page->enqueue( 'upload.php' );
		$this->addToAssertionCount( 1 );
	}

	public function test_enqueues_script_with_config(): void {
		Functions\when( 'add_submenu_page' )->justReturn( 'media_page_kotlinskidev-a11y-alt-text' );
		Functions\when( 'wp_enqueue_style' )->justReturn();
		Functions\when( 'wp_set_script_translations' )->justReturn();
		Functions\expect( 'wp_enqueue_script' )
			->once()
			->with( 'kotlinskidev-a11y-alt-text', KOTLINSKIDEV_A11Y_URL . 'build/alt-text.js', \Mockery::type( 'array' ), \Mockery::type( 'string' ), array( 'in_footer' => true ) );

		$inline = '';
		Functions\when( 'wp_add_inline_script' )->alias(
			static function ( string $handle, string $code ) use ( &$inline ): bool {
				$inline = $code;

				return true;
			}
		);

		$page = new AltTextPage();
		$page->add_menu();
		$page->enqueue( 'media_page_kotlinskidev-a11y-alt-text' );

		$this->assertStringStartsWith( 'window.kotlinskidevA11yAltText = ', $inline );
		$this->assertStringContainsString( 'nonce123', $inline );
	}

	public function test_render_requires_capability(): void {
		Functions\expect( 'current_user_can' )->once()->with( 'upload_files' )->andReturn( false );
		\WP_Query::$last_args = array();

		ob_start();
		( new AltTextPage() )->render();
		$output = ob_get_clean();

		$this->assertSame( '', $output );
		$this->assertSame( array(), \WP_Query::$last_args );
	}
}
