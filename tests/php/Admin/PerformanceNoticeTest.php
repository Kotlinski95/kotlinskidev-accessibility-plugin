<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\PerformanceNotice;
use Kotlinskidev\A11y\Tests\TestCase;

final class PerformanceNoticeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'esc_html__'          => static fn ( $text ) => $text,
				'esc_url'             => static fn ( $url ) => $url,
				'admin_url'           => static fn ( $path = '' ) => 'https://example.test/wp-admin/' . $path,
				'wp_nonce_url'        => static fn ( $url, $action ) => $url . '&_wpnonce=abc',
				'get_current_user_id' => static fn () => 7,
			)
		);
	}

	private function stub_performance( array $performance ): void {
		Functions\when( 'get_option' )->justReturn( array( 'performance' => $performance ) );
	}

	private function legacy_performance(): array {
		return array(
			'preset'   => 'custom',
			'strategy' => 'defer',
			'pageCss'  => 'linked',
		);
	}

	private function render_output(): string {
		ob_start();
		( new PerformanceNotice() )->render();

		return (string) ob_get_clean();
	}

	public function test_registers_notice_and_dismiss_hooks(): void {
		$notice = new PerformanceNotice();

		Actions\expectAdded( 'admin_notices' )->once()->with( array( $notice, 'render' ) );
		Actions\expectAdded( 'admin_post_kotlinskidev_a11y_dismiss_perf_notice' )->once()->with( array( $notice, 'dismiss' ) );

		$notice->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_shown_for_migrated_custom_defer_linked(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'get_user_meta' )->justReturn( '' );
		$this->stub_performance( $this->legacy_performance() );

		$output = $this->render_output();

		$this->assertStringContainsString( 'switch to the Recommended performance preset to load less JavaScript on every page.', $output );
		$this->assertStringContainsString( 'options-general.php?page=kotlinskidev-accessibility#performance', $output );
		$this->assertStringContainsString( 'admin-post.php?action=kotlinskidev_a11y_dismiss_perf_notice&_wpnonce=abc', $output );
	}

	public function test_shown_for_idle_strategy(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'get_user_meta' )->justReturn( '' );
		$this->stub_performance( array_merge( $this->legacy_performance(), array( 'strategy' => 'idle' ) ) );

		$this->assertNotSame( '', $this->render_output() );
	}

	public function test_hidden_when_dismissed(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'get_user_meta' )->justReturn( '1' );
		$this->stub_performance( $this->legacy_performance() );

		$this->assertSame( '', $this->render_output() );
	}

	public function test_hidden_for_recommended_preset(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'get_user_meta' )->justReturn( '' );
		$this->stub_performance( array( 'preset' => 'recommended' ) );

		$this->assertSame( '', $this->render_output() );
	}

	public function test_hidden_for_custom_with_other_strategy_or_css(): void {
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\when( 'get_user_meta' )->justReturn( '' );

		$this->stub_performance( array_merge( $this->legacy_performance(), array( 'strategy' => 'interaction' ) ) );
		$this->assertSame( '', $this->render_output() );

		\Kotlinskidev\A11y\Settings\Repository::flush();
		$this->stub_performance( array_merge( $this->legacy_performance(), array( 'pageCss' => 'lazy' ) ) );
		$this->assertSame( '', $this->render_output() );
	}

	public function test_hidden_without_capability_using_filtered_capability(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_capability' )->once()->with( 'manage_options' )->andReturn( 'edit_pages' );
		Functions\expect( 'current_user_can' )->once()->with( 'edit_pages' )->andReturn( false );
		$this->stub_performance( $this->legacy_performance() );

		$this->assertSame( '', $this->render_output() );
	}

	public function test_dismiss_checks_nonce_and_stores_user_meta(): void {
		Functions\expect( 'check_admin_referer' )->once()->with( 'kotlinskidev_a11y_dismiss_perf_notice' );
		Functions\when( 'current_user_can' )->justReturn( true );
		Functions\expect( 'update_user_meta' )->once()->with( 7, 'kotlinskidev_a11y_perf_notice_dismissed', '1' );
		Functions\expect( 'wp_safe_redirect' )->once()->with( 'https://example.test/wp-admin/options-general.php?page=kotlinskidev-accessibility' )->andThrow( new \RuntimeException( 'redirected' ) );

		$this->expectExceptionMessage( 'redirected' );

		( new PerformanceNotice() )->dismiss();
	}

	public function test_dismiss_refuses_without_capability(): void {
		Functions\expect( 'check_admin_referer' )->once();
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\expect( 'update_user_meta' )->never();
		Functions\expect( 'wp_die' )->once()->andThrow( new \RuntimeException( 'died' ) );

		$this->expectExceptionMessage( 'died' );

		( new PerformanceNotice() )->dismiss();
	}
}
