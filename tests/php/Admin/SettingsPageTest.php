<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Actions;
use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\SettingsPage;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Tests\Frontend\FrontendEnvironment;
use Kotlinskidev\A11y\Tests\TestCase;

final class SettingsPageTest extends TestCase {

	use FrontendEnvironment;

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'__'               => static fn ( $text ) => $text,
				'esc_html__'       => static fn ( $text ) => $text,
				'esc_url'          => static fn ( $url ) => $url,
				'esc_attr'         => static fn ( $text ) => $text,
				'esc_html'         => static fn ( $text ) => $text,
				'admin_url'        => static fn ( $path = '' ) => 'https://example.test/wp-admin/' . $path,
				'plugin_basename'  => static fn ( $file ) => 'kotlinskidev-accessibility/kotlinskidev-accessibility.php',
				'rest_url'         => static fn ( $path = '' ) => 'https://example.test/wp-json/' . $path,
				'wp_create_nonce'  => 'nonce123',
				'wp_json_encode'   => static fn ( $value, $flags = 0 ) => json_encode( $value, $flags ),
				'get_locale'       => 'en_US',
				'switch_to_locale' => false,
				'current_user_can' => true,
			)
		);
		Functions\when( 'wp_get_global_settings' )->justReturn( array() );
		$this->frontend_environment();
		Manifest::flush();
		Functions\when( 'wp_enqueue_media' )->justReturn();
	}

	public function test_registers_hooks(): void {
		$page = new SettingsPage();

		Actions\expectAdded( 'admin_menu' )->once()->with( array( $page, 'add_menu' ) );
		Actions\expectAdded( 'admin_enqueue_scripts' )->once()->with( array( $page, 'enqueue' ) );
		Filters\expectAdded( 'plugin_action_links_kotlinskidev-accessibility/kotlinskidev-accessibility.php' )->once()->with( array( $page, 'action_links' ) );

		$page->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_menu_uses_capability_filter(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_capability' )->once()->with( 'manage_options' )->andReturn( 'edit_pages' );
		Functions\expect( 'add_options_page' )
			->once()
			->with( 'Accessibility', 'Accessibility', 'edit_pages', 'kotlinskidev-accessibility', \Mockery::type( 'array' ) )
			->andReturn( 'settings_page_kotlinskidev-accessibility' );

		( new SettingsPage() )->add_menu();
		$this->addToAssertionCount( 1 );
	}

	public function test_assets_enqueue_only_on_own_screen(): void {
		Functions\when( 'add_options_page' )->justReturn( 'settings_page_kotlinskidev-accessibility' );
		Functions\expect( 'wp_enqueue_script' )->never();
		Functions\expect( 'wp_enqueue_style' )->never();

		$page = new SettingsPage();
		$page->add_menu();
		$page->enqueue( 'edit.php' );
		$this->addToAssertionCount( 1 );
	}

	public function test_enqueues_assets_with_translations_and_config(): void {
		Functions\when( 'add_options_page' )->justReturn( 'settings_page_kotlinskidev-accessibility' );
		Functions\expect( 'wp_enqueue_style' )
			->once()
			->with( 'kotlinskidev-a11y-admin', KOTLINSKIDEV_A11Y_URL . 'build/admin.css', array(), 'adm123' );
		Functions\expect( 'wp_enqueue_script' )
			->once()
			->with( 'kotlinskidev-a11y-admin', KOTLINSKIDEV_A11Y_URL . 'build/admin.js', array( 'wp-i18n', 'wp-api-fetch' ), 'adm123', array( 'in_footer' => true ) );
		Functions\expect( 'wp_set_script_translations' )
			->once()
			->with( 'kotlinskidev-a11y-admin', 'kotlinskidev-accessibility', KOTLINSKIDEV_A11Y_DIR . 'languages' );

		$inline = '';
		Functions\when( 'wp_add_inline_script' )->alias(
			static function ( string $handle, string $code, string $position ) use ( &$inline ): bool {
				$inline = $handle . '|' . $position . '|' . $code;

				return true;
			}
		);

		$page = new SettingsPage();
		$page->add_menu();
		$page->enqueue( 'settings_page_kotlinskidev-accessibility' );

		$this->assertStringStartsWith( 'kotlinskidev-a11y-admin|before|window.kotlinskidevA11yAdmin = ', $inline );
	}

	public function test_config_carries_cost_data(): void {
		$cost = ( new SettingsPage() )->config()['cost'];

		$this->assertSame( array( 'manifest', 'panelData', 'config' ), array_keys( $cost ) );
		$this->assertArrayHasKey( 'scripts', $cost['manifest'] );
		$this->assertGreaterThan( 0, $cost['panelData'] );
		$this->assertGreaterThan( 0, $cost['config'] );
	}

	public function test_config_shape(): void {
		$config = ( new SettingsPage() )->config();

		$this->assertSame( 'https://example.test/wp-json/kotlinskidev-a11y/v1/', $config['restRoot'] );
		$this->assertSame( 'nonce123', $config['nonce'] );
		$this->assertSame( '0.0.0-test', $config['version'] );
		$this->assertSame( 'https://example.test', $config['homeUrl'] );
		$this->assertArrayHasKey( 'panelTitle', $config['strings'] );
		$this->assertContains( 'biggerText', $config['features'] );
		$this->assertContains( 'visionImpaired', $config['profiles'] );
		$this->assertSame(
			array(
				array(
					'code' => 'en_US',
					'name' => 'en_US',
				),
			),
			$config['locales']
		);
	}

	public function test_config_carries_the_theme_palette(): void {
		$this->assertSame( array(), ( new SettingsPage() )->config()['themePalette'] );

		Functions\when( 'wp_get_global_settings' )->justReturn(
			array(
				array(
					'slug'  => 'primary',
					'name'  => 'Primary',
					'color' => '#0078c2',
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'slug'  => 'primary',
					'name'  => 'Primary',
					'color' => '#0078c2',
					'var'   => '--wp--preset--color--primary',
				),
			),
			( new SettingsPage() )->config()['themePalette']
		);
	}

	public function test_config_strings_are_untranslated_override_defaults(): void {
		$this->store_settings( array( 'labels' => array( 'en_US' => array( 'panelTitle' => 'Overridden' ) ) ) );

		$config = ( new SettingsPage() )->config();

		$this->assertSame( 'Accessibility settings', $config['strings']['panelTitle'] );
	}

	public function test_locales_come_from_wpml_when_present(): void {
		Filters\expectApplied( 'wpml_active_languages' )->andReturn(
			array(
				'pl' => array(
					'default_locale' => 'pl_PL',
					'native_name'    => 'Polski',
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'code' => 'pl_PL',
					'name' => 'Polski',
				),
			),
			( new SettingsPage() )->locales()
		);
	}

	public function test_action_link_is_prepended(): void {
		$links = ( new SettingsPage() )->action_links( array( 'deactivate' => '<a>x</a>' ) );

		$this->assertSame( array( 'settings', 'deactivate' ), array_keys( $links ) );
		$this->assertStringContainsString( 'options-general.php?page=kotlinskidev-accessibility', $links['settings'] );
	}
}
