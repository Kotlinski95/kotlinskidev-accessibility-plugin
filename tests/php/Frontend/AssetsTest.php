<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Assets;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\I18n\Strings;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class AssetsTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'is_feed'              => false,
				'is_customize_preview' => false,
				'get_queried_object_id' => 0,
				'get_post_type'        => false,
				'home_url'             => 'https://example.test',
				'wp_unslash'           => static fn ( $value ) => $value,
				'wp_parse_url'         => static fn ( $url, $component = -1 ) => parse_url( (string) $url, $component ),
				'wp_get_current_user'  => (object) array( 'roles' => array() ),
				'wp_json_encode' => static fn ( $value, $flags = 0 ) => json_encode( $value, $flags ),
				'__'             => static fn ( $text ) => $text,
				'get_permalink'  => static fn ( $id ) => 'https://example.test/?p=' . $id,
			)
		);
		Functions\when( 'get_option' )->justReturn( array() );
		$_SERVER['REQUEST_URI'] = '/';
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
		Functions\when( 'switch_to_locale' )->justReturn( false );
		Functions\when( 'get_locale' )->justReturn( 'en_US' );
	}

	private function assets( bool $render = true ): Assets {
		Functions\when( 'is_admin' )->justReturn( ! $render );

		return new Assets( new Visibility() );
	}

	public function test_registers_hooks(): void {
		$assets = $this->assets();

		Actions\expectAdded( 'wp_head' )->once()->with( array( $assets, 'print_head' ), 1 );
		Actions\expectAdded( 'wp_enqueue_scripts' )->once()->with( array( $assets, 'enqueue' ) );

		$assets->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_config_matches_front_end_contract(): void {
		$config = $this->assets()->config( Schema::defaults() );

		$this->assertSame(
			array( 'v', 'features', 'profiles', 'widget', 'theme', 'tokens', 'storage', 'shortcut', 'hideToolbar', 'statementUrl', 'strings', 'locale', 'rtl', 'customCss' ),
			array_keys( $config )
		);
		$this->assertSame( '0.0.0-test', $config['v'] );
		$this->assertSame( 'en_US', $config['locale'] );
		$this->assertFalse( $config['rtl'] );
		$this->assertSame( '', $config['statementUrl'] );
		$this->assertArrayHasKey( 'panelTitle', $config['strings'] );
		$this->assertArrayHasKey( 'biggerText', $config['features'] );
		$this->assertSame( 'ka11y', $config['storage']['key'] );
	}

	public function test_statement_url_prefers_page_id(): void {
		$settings                         = Schema::defaults();
		$settings['statement']['pageId']  = 9;
		$settings['statement']['url']     = 'https://example.test/manual';

		$this->assertSame( 'https://example.test/?p=9', $this->assets()->config( $settings )['statementUrl'] );
	}

	public function test_statement_url_falls_back_to_url(): void {
		$settings                     = Schema::defaults();
		$settings['statement']['url'] = 'https://example.test/manual';

		$this->assertSame( 'https://example.test/manual', $this->assets()->config( $settings )['statementUrl'] );
	}

	public function test_config_script_escapes_tags(): void {
		$settings              = Schema::defaults();
		$settings['customCss'] = 'a::after{content:"</script><b>&"}';

		$script = $this->assets()->config_script( $settings );

		$this->assertStringStartsWith( 'window.kotlinskidevA11y = {', $script );
		$this->assertStringNotContainsStringIgnoringCase( '</script', $script );
		$this->assertStringNotContainsString( '<b>', $script );
		$this->assertStringContainsString( '\u003C\/script\u003E', $script );
	}

	public function test_tokens_css_has_variables_and_device_rules(): void {
		$settings                                  = Schema::defaults();
		$settings['widget']['position']['mobile']  = 'middle-left';
		$settings['visibility']['devices']['tablet'] = false;

		$css = $this->assets()->tokens_css( $settings );

		$this->assertStringContainsString( '--ka11y-primary:#0b57d0', $css );
		$this->assertStringContainsString( '--ka11y-on-primary:#ffffff', $css );
		$this->assertStringContainsString( '--ka11y-size:52px', $css );
		$this->assertStringContainsString( '@media (min-width:1025px){#ka11y-root{right:20px;left:auto;bottom:20px;top:auto;transform:none;}}', $css );
		$this->assertStringContainsString( '@media (max-width:768px){#ka11y-root{left:20px;right:auto;top:50%;bottom:auto;transform:translateY(-50%);}}', $css );
		$this->assertStringContainsString( '@media (min-width:769px) and (max-width:1024px){#ka11y-root{', $css );
		$this->assertStringContainsString( 'display:none!important;', $css );
	}

	public function test_tokens_css_cannot_break_out_of_style(): void {
		$settings                       = Schema::defaults();
		$settings['tokens']['fontFamily'] = 'Arial</style><script>alert(1)</script>';

		$css = $this->assets()->tokens_css( $settings );

		$this->assertStringNotContainsString( '<', $css );
	}

	public function test_print_head_outputs_nothing_when_hidden(): void {
		Functions\expect( 'wp_print_inline_script_tag' )->never();
		Functions\expect( 'wp_enqueue_style' )->never();

		$this->assets( false )->print_head();
		$this->addToAssertionCount( 1 );
	}

	public function test_print_head_emits_safe_bootstrap(): void {
		$printed = '';
		Functions\when( 'wp_print_inline_script_tag' )->alias(
			static function ( string $code ) use ( &$printed ): void {
				$printed = $code;
			}
		);
		Functions\when( 'wp_register_style' )->justReturn( true );
		Functions\when( 'wp_enqueue_style' )->justReturn( null );
		Functions\expect( 'wp_add_inline_style' )->once();

		$this->assets()->print_head();

		$this->assertStringStartsWith( 'window.kotlinskidevA11y={storage:{', $printed );
		$this->assertStringNotContainsStringIgnoringCase( '</script', $printed );
		$this->assertStringContainsString( 'window.__boot=1', $printed );
	}

	public function test_enqueue_adds_config_before_script(): void {
		Functions\expect( 'wp_enqueue_style' )->once();
		Functions\expect( 'wp_register_script' )->once()->with(
			'kotlinskidev-a11y-frontend',
			'https://example.test/wp-content/plugins/kotlinskidev-accessibility/build/frontend.js',
			array(),
			'abc123',
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		Functions\expect( 'wp_enqueue_script' )->once()->with( 'kotlinskidev-a11y-frontend' );
		Functions\expect( 'wp_add_inline_script' )->once()->with(
			'kotlinskidev-a11y-frontend',
			\Mockery::on( static fn ( string $code ): bool => str_starts_with( $code, 'window.kotlinskidevA11y = ' ) ),
			'before'
		);

		$this->assets()->enqueue();
		$this->addToAssertionCount( 1 );
	}

	public function test_enqueue_does_nothing_when_hidden(): void {
		Functions\expect( 'wp_enqueue_script' )->never();
		Functions\expect( 'wp_enqueue_style' )->never();

		$this->assets( false )->enqueue();
		$this->addToAssertionCount( 1 );
	}
}
