<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\AltTextCounter;
use Kotlinskidev\A11y\Admin\DashboardWidget;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/WpQueryStub.php';

final class DashboardWidgetTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'__'                 => static fn ( $text ) => $text,
				'esc_html__'         => static fn ( $text ) => $text,
				'esc_html'           => static fn ( $text ) => $text,
				'esc_url'            => static fn ( $url ) => $url,
				'number_format_i18n' => static fn ( $number ) => (string) $number,
				'admin_url'          => static fn ( $path = '' ) => 'https://example.test/wp-admin/' . $path,
			)
		);
	}

	public function test_registers_on_dashboard_setup(): void {
		$widget = new DashboardWidget();

		Actions\expectAdded( 'wp_dashboard_setup' )->once()->with( array( $widget, 'add_widget' ) );

		$widget->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_widget_added_for_capability_filter(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_capability' )->once()->with( 'manage_options' )->andReturn( 'edit_pages' );
		Functions\expect( 'current_user_can' )->once()->with( 'edit_pages' )->andReturn( true );
		Functions\expect( 'wp_add_dashboard_widget' )->once()->with( 'kotlinskidev_a11y_dashboard', 'Accessibility', \Mockery::type( 'array' ) );

		( new DashboardWidget() )->add_widget();
		$this->addToAssertionCount( 1 );
	}

	public function test_widget_hidden_without_capability(): void {
		Functions\when( 'current_user_can' )->justReturn( false );
		Functions\expect( 'wp_add_dashboard_widget' )->never();

		( new DashboardWidget() )->add_widget();
		$this->addToAssertionCount( 1 );
	}

	public function test_render_shows_count_features_links_and_version(): void {
		\WP_Query::$found = 4;
		Functions\when( 'get_transient' )->justReturn( false );
		Functions\when( 'set_transient' )->justReturn( true );
		Functions\when( 'get_option' )->justReturn(
			array(
				'features' => array(
					'biggerText' => array( 'enabled' => true ),
					'lineHeight' => array( 'enabled' => false ),
					'bigCursor'  => array( 'enabled' => true ),
				),
			)
		);

		ob_start();
		( new DashboardWidget( new AltTextCounter() ) )->render();
		$output = (string) ob_get_clean();

		$this->assertStringContainsString( '<strong>4</strong>', $output );
		$this->assertStringContainsString( 'upload.php?page=kotlinskidev-a11y-alt-text', $output );
		$this->assertStringContainsString( 'options-general.php?page=kotlinskidev-accessibility', $output );
		$this->assertStringContainsString( 'Plugin version: 0.0.0-test', $output );
		$this->assertStringContainsString( 'Enabled features: <strong>', $output );
	}

	public function test_counts_only_enabled_features(): void {
		Functions\when( 'get_option' )->justReturn(
			array(
				'features' => array(
					'biggerText' => array( 'enabled' => true ),
					'lineHeight' => array( 'enabled' => false ),
				),
			)
		);

		$widget = new DashboardWidget();
		$total  = $widget->enabled_features();

		$this->assertSame( count( \Kotlinskidev\A11y\Settings\Schema::feature_keys() ) - 1, $total );
	}
}
