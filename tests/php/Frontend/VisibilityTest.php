<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\Tests\TestCase;

final class VisibilityTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'is_admin'             => false,
				'is_feed'              => false,
				'is_customize_preview' => false,
				'get_queried_object_id' => 0,
				'get_post_type'        => false,
				'home_url'             => 'https://example.test',
				'wp_unslash'           => static fn ( $value ) => $value,
				'wp_parse_url'         => static fn ( $url, $component = -1 ) => parse_url( (string) $url, $component ),
			)
		);
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array() ) );
		$_SERVER['REQUEST_URI'] = '/about/';
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
		parent::tearDown();
	}

	private function store( array $visibility ): void {
		Functions\when( 'get_option' )->justReturn( array( 'visibility' => $visibility ) );
	}

	public function test_renders_by_default(): void {
		Functions\when( 'get_option' )->justReturn( array() );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_skips_admin(): void {
		Functions\when( 'is_admin' )->justReturn( true );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_skips_feed(): void {
		Functions\when( 'is_feed' )->justReturn( true );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_skips_customizer_preview(): void {
		Functions\when( 'is_customize_preview' )->justReturn( true );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_excludes_post_id(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->store( array( 'excludePostIds' => array( 7, 42 ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_keeps_other_post_id(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 43 );
		$this->store( array( 'excludePostIds' => array( 7, 42 ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_excludes_post_type(): void {
		Functions\when( 'get_post_type' )->justReturn( 'product' );
		$this->store( array( 'excludePostTypes' => array( 'product' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_excludes_role(): void {
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array( 'subscriber' ) ) );
		$this->store( array( 'excludeRoles' => array( 'subscriber', 'editor' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_keeps_unlisted_role(): void {
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array( 'author' ) ) );
		$this->store( array( 'excludeRoles' => array( 'subscriber' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_excludes_wildcard_url(): void {
		$_SERVER['REQUEST_URI'] = '/shop/cart/?x=1';
		$this->store( array( 'excludeUrlPatterns' => array( '/shop/*' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_excludes_exact_url_ignoring_slashes(): void {
		$this->store( array( 'excludeUrlPatterns' => array( 'about' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_keeps_non_matching_url(): void {
		$this->store( array( 'excludeUrlPatterns' => array( '/shop/*', '/abo' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_strips_subdirectory_base(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.test/blog' );
		$_SERVER['REQUEST_URI'] = '/blog/private/page';
		$this->store( array( 'excludeUrlPatterns' => array( '/private/*' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_filter_can_override(): void {
		Functions\when( 'get_option' )->justReturn( array() );
		Filters\expectApplied( 'kotlinskidev_a11y_should_render' )->once()->with( true )->andReturn( false );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}
}
