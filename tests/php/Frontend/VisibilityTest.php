<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\Settings\Repository;
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
				'is_singular'          => false,
				'get_page_template_slug' => false,
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
		Functions\when( 'get_option' )->justReturn( array(
				'schemaVersion' => 2,
				'visibility'    => array_merge( array( 'mode' => 'except_on' ), $visibility ),
			) );
	}

	private function only_on( array $lists ): void {
		Functions\when( 'get_option' )->justReturn( array(
				'schemaVersion' => 2,
				'visibility'    => array_merge( array( 'mode' => 'only_on' ), $lists ),
			) );
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
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->store( array( 'excludePostIds' => array( 7, 42 ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_keeps_other_post_id(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 43 );
		$this->store( array( 'excludePostIds' => array( 7, 42 ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_excludes_post_type(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 9 );
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

	public function test_everywhere_ignores_lists(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		Functions\when( 'get_option' )->justReturn(
			array(
				'schemaVersion' => 2,
				'visibility'    => array(
					'mode'           => 'everywhere',
					'excludePostIds' => array( 42 ),
					'includePostIds' => array( 7 ),
				),
			)
		);

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_with_empty_lists_renders_nowhere(): void {
		$this->only_on( array() );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_only_on_matches_post_id(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->only_on( array( 'includePostIds' => array( 42 ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_misses_other_post_id(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 43 );
		$this->only_on( array( 'includePostIds' => array( 42 ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_only_on_matches_post_type(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 9 );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		$this->only_on( array( 'includePostTypes' => array( 'page' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_matches_role(): void {
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array( 'editor' ) ) );
		$this->only_on( array( 'includeRoles' => array( 'editor' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_matches_url(): void {
		$this->only_on( array( 'includeUrlPatterns' => array( '/ab*' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_ignores_exclude_lists(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->only_on(
			array(
				'includePostIds' => array( 42 ),
				'excludePostIds' => array( 42 ),
			)
		);

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_except_on_ignores_include_lists(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->store( array( 'includePostIds' => array( 42 ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_guest_role_matches_logged_out_visitor(): void {
		$this->store( array( 'excludeRoles' => array( '__guest' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_guest_role_does_not_match_logged_in_visitor(): void {
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array( 'author' ) ) );
		$this->store( array( 'excludeRoles' => array( '__guest' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_only_on_guest(): void {
		$this->only_on( array( 'includeRoles' => array( '__guest' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_except_on_page_template_slug(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 5 );
		Functions\when( 'get_page_template_slug' )->justReturn( 'templates/full-width.php' );
		$this->store( array( 'excludeTemplates' => array( 'Templates/Full-Width.php' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_only_on_block_template_slug(): void {
		$GLOBALS['_wp_current_template_id'] = 'kotlinskidev//front-page';
		$this->only_on( array( 'includeTemplates' => array( 'front-page' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );

		unset( $GLOBALS['_wp_current_template_id'] );
	}

	public function test_block_template_slug_miss(): void {
		$GLOBALS['_wp_current_template_id'] = 'kotlinskidev//single';
		$this->only_on( array( 'includeTemplates' => array( 'front-page' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );

		unset( $GLOBALS['_wp_current_template_id'] );
	}

	public function test_only_on_post_type_does_not_match_archive(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 3 );
		Functions\when( 'get_post_type' )->justReturn( 'page' );
		$this->only_on( array( 'includePostTypes' => array( 'page' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_post_type_uses_queried_object_id(): void {
		Functions\when( 'is_singular' )->justReturn( true );
		Functions\when( 'get_queried_object_id' )->justReturn( 11 );
		Functions\when( 'get_post_type' )->alias( static fn ( $post = null ) => 11 === $post ? 'product' : 'post' );
		$this->only_on( array( 'includePostTypes' => array( 'product' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_post_id_does_not_collide_with_term_id_on_archive(): void {
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->only_on( array( 'includePostIds' => array( 42 ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_decision_is_memoized_across_head_and_footer(): void {
		$state = array( 'singular' => true );
		Functions\when( 'is_singular' )->alias( static function () use ( &$state ): bool {
			return $state['singular'];
		} );
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		$this->only_on( array( 'includePostIds' => array( 42 ) ) );

		$head = ( new Visibility() )->should_render();

		$state['singular'] = false;

		$this->assertTrue( $head );
		$this->assertSame( $head, ( new Visibility() )->should_render() );
	}

	public function test_reset_request_state_clears_memo(): void {
		$this->only_on( array() );

		$this->assertFalse( ( new Visibility() )->should_render() );

		Visibility::reset_request_state();
		Repository::flush();
		Functions\when( 'get_option' )->justReturn( array() );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_matches_percent_encoded_non_ascii_path(): void {
		$_SERVER['REQUEST_URI'] = '/caf%C3%A9/menu';
		$this->store( array( 'excludeUrlPatterns' => array( '/café/*' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_pathological_pattern_finishes_fast(): void {
		$_SERVER['REQUEST_URI'] = '/' . str_repeat( 'a', 1500 ) . 'x';
		$this->store( array( 'excludeUrlPatterns' => array( '/' . str_repeat( '*a', 90 ) . '*b' ) ) );

		$start  = microtime( true );
		$render = ( new Visibility() )->should_render();

		$this->assertTrue( $render );
		$this->assertLessThan( 1.0, microtime( true ) - $start );
	}

	public function test_collapses_wildcard_runs(): void {
		$_SERVER['REQUEST_URI'] = '/shop/cart';
		$this->store( array( 'excludeUrlPatterns' => array( '/shop/*****' ) ) );

		$this->assertFalse( ( new Visibility() )->should_render() );
	}

	public function test_overlong_pattern_never_matches(): void {
		$_SERVER['REQUEST_URI'] = '/' . str_repeat( 'a', 300 );
		$this->store( array( 'excludeUrlPatterns' => array( '/' . str_repeat( 'a', 300 ) ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_real_role_named_guest_is_not_the_guest_token(): void {
		Functions\when( 'wp_get_current_user' )->justReturn( (object) array( 'roles' => array( 'guest' ) ) );
		$this->store( array( 'excludeRoles' => array( '__guest' ) ) );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}

	public function test_filter_can_force_render_when_blocked(): void {
		$this->only_on( array() );
		Filters\expectApplied( 'kotlinskidev_a11y_should_render' )->once()->with( false )->andReturn( true );

		$this->assertTrue( ( new Visibility() )->should_render() );
	}
}
