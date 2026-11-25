<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Assets;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class AssetsTest extends TestCase {

	use FrontendEnvironment;

	private const PLUGIN_BUILD = 'https://example.test/wp-content/plugins/kotlinskidev-accessibility/build/';

	private array $registered_scripts = array();
	private array $enqueued_scripts   = array();
	private array $enqueued_styles    = array();
	private array $inline_scripts     = array();
	private array $inline_styles      = array();
	private array $printed_scripts    = array();
	private string $head_html         = '';

	protected function setUp(): void {
		parent::setUp();
		Manifest::flush();
		$this->frontend_environment();
		$GLOBALS['wp_version'] = '6.8';

		$this->registered_scripts = array();
		$this->enqueued_scripts   = array();
		$this->enqueued_styles    = array();
		$this->inline_scripts     = array();
		$this->inline_styles      = array();
		$this->printed_scripts    = array();
		$this->head_html          = '';

		Functions\when( 'wp_register_script' )->alias(
			function ( string $handle, string $src, array $deps, string $ver, array $args ): bool {
				$this->registered_scripts[ $handle ] = compact( 'src', 'deps', 'ver', 'args' );

				return true;
			}
		);
		Functions\when( 'wp_enqueue_script' )->alias(
			function ( string $handle ): void {
				$this->enqueued_scripts[] = $handle;
			}
		);
		Functions\when( 'wp_add_inline_script' )->alias(
			function ( string $handle, string $code, string $position ): bool {
				$this->inline_scripts[ $handle ] = array( $code, $position );

				return true;
			}
		);
		Functions\when( 'wp_enqueue_style' )->alias(
			function ( string $handle, string $src = '', array $deps = array(), string $ver = '' ): void {
				$this->enqueued_styles[ $handle ] = array( $src, $ver );
			}
		);
		Functions\when( 'wp_register_style' )->justReturn( true );
		Functions\when( 'wp_add_inline_style' )->alias(
			function ( string $handle, string $css ): bool {
				$this->inline_styles[ $handle ] = $css;

				return true;
			}
		);
		Functions\when( 'wp_print_inline_script_tag' )->alias(
			function ( string $code, array $attributes = array() ): void {
				$this->printed_scripts[] = array( $code, $attributes );
			}
		);
		Functions\when( 'wp_kses' )->alias( static fn ( string $html ): string => $html );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['wp_version'] );
		Manifest::flush();
		parent::tearDown();
	}

	private function performance( array $overrides ): void {
		$this->store_settings( array( 'performance' => array_merge( array( 'preset' => 'custom' ), $overrides ) ) );
	}

	private function assets( bool $render = true ): Assets {
		Functions\when( 'is_admin' )->justReturn( ! $render );

		return new Assets( new Visibility() );
	}

	private function head(): void {
		ob_start();
		$this->assets()->print_head();
		$this->head_html = (string) ob_get_clean();
	}

	public function test_registers_hooks(): void {
		$assets = $this->assets();

		Actions\expectAdded( 'wp_head' )->once()->with( array( $assets, 'print_head' ), 1 );
		Actions\expectAdded( 'wp_enqueue_scripts' )->once()->with( array( $assets, 'enqueue' ) );

		$assets->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_recommended_enqueues_only_the_loader_without_a_stylesheet(): void {
		$this->assets()->enqueue();

		$this->assertSame( array( 'kotlinskidev-a11y-loader' ), $this->enqueued_scripts );
		$this->assertSame( array( 'kotlinskidev-a11y-loader' ), array_keys( $this->registered_scripts ) );
		$this->assertSame( array(), $this->enqueued_styles );

		$loader = $this->registered_scripts['kotlinskidev-a11y-loader'];

		$this->assertSame( self::PLUGIN_BUILD . 'loader.js', $loader['src'] );
		$this->assertSame( array(), $loader['deps'] );
		$this->assertSame( '0123456789ab', $loader['ver'] );
		$this->assertSame(
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			),
			$loader['args']
		);
	}

	public function test_config_is_added_before_the_loader(): void {
		$this->assets()->enqueue();

		[ $code, $position ] = $this->inline_scripts['kotlinskidev-a11y-loader'];

		$this->assertSame( 'before', $position );
		$this->assertStringStartsWith( 'window.kotlinskidevA11y=Object.assign(window.kotlinskidevA11y||{},{', $code );
	}

	/**
	 * @dataProvider strategies
	 */
	public function test_strategy_maps_to_the_script_strategy_and_chunk_handles( string $strategy, string $expected, bool $eager ): void {
		$this->performance( array( 'strategy' => $strategy ) );

		$this->assets()->enqueue();

		$this->assertSame( $expected, $this->registered_scripts['kotlinskidev-a11y-loader']['args']['strategy'] );
		$this->assertSame( $eager ? 6 : 1, count( $this->enqueued_scripts ) );

		foreach ( array( 'kernel', 'panel', 'content', 'color', 'orientation' ) as $chunk ) {
			$handle = 'kotlinskidev-a11y-' . $chunk;

			$this->assertSame( $eager, isset( $this->registered_scripts[ $handle ] ), $handle );

			if ( $eager ) {
				$this->assertContains( $handle, $this->enqueued_scripts );
				$this->assertSame( array(), $this->registered_scripts[ $handle ]['deps'] );
				$this->assertSame( 'defer', $this->registered_scripts[ $handle ]['args']['strategy'] );
				$this->assertSame( self::PLUGIN_BUILD . $chunk . '.js', $this->registered_scripts[ $handle ]['src'] );
			}
		}
	}

	public static function strategies(): array {
		return array(
			'interaction' => array( 'interaction', 'defer', false ),
			'idle'        => array( 'idle', 'defer', false ),
			'defer'       => array( 'defer', 'defer', false ),
			'async'       => array( 'async', 'async', false ),
			'eager'       => array( 'eager', 'defer', true ),
		);
	}

	public function test_position_head_unsets_in_footer_for_the_loader_and_chunks(): void {
		$this->performance(
			array(
				'strategy' => 'eager',
				'position' => 'head',
			)
		);

		$this->assets()->enqueue();

		foreach ( $this->registered_scripts as $script ) {
			$this->assertFalse( $script['args']['in_footer'] );
		}
	}

	public function test_fetch_priority_arg_on_wordpress_6_9(): void {
		$GLOBALS['wp_version'] = '6.9';
		$this->performance(
			array(
				'strategy'      => 'eager',
				'fetchPriority' => 'low',
			)
		);

		$this->assets()->enqueue();

		foreach ( $this->registered_scripts as $script ) {
			$this->assertSame( 'low', $script['args']['fetchpriority'] );
		}
	}

	public function test_fetch_priority_arg_is_omitted_on_older_wordpress_and_for_auto(): void {
		$this->performance( array( 'fetchPriority' => 'low' ) );
		$this->assets()->enqueue();
		$this->assertArrayNotHasKey( 'fetchpriority', $this->registered_scripts['kotlinskidev-a11y-loader']['args'] );

		$GLOBALS['wp_version'] = '6.9';
		$this->performance( array( 'fetchPriority' => 'auto' ) );
		$this->registered_scripts = array();
		$this->assets()->enqueue();
		$this->assertArrayNotHasKey( 'fetchpriority', $this->registered_scripts['kotlinskidev-a11y-loader']['args'] );
	}

	public function test_linked_page_css_enqueues_the_stylesheet(): void {
		$this->performance( array( 'pageCss' => 'linked' ) );

		$this->assets()->enqueue();

		$this->assertSame(
			array( 'kotlinskidev-a11y-frontend' => array( self::PLUGIN_BUILD . 'frontend.css', 'ffffffffffff' ) ),
			$this->enqueued_styles
		);
	}

	public function test_lazy_page_css_prints_no_stylesheet_and_the_bootstrap_carries_its_url(): void {
		$this->assets()->enqueue();
		$this->head();

		$this->assertArrayNotHasKey( 'kotlinskidev-a11y-frontend', $this->enqueued_styles );
		$this->assertStringStartsWith( 'window.kotlinskidevA11y={"storage":{', $this->printed_scripts[0][0] );
		$this->assertStringContainsString( '"css":"' . self::PLUGIN_BUILD . 'frontend.css?ver=ffffffffffff"', $this->printed_scripts[0][0] );
		$this->assertStringContainsString( '"hk":"ka11y-hidden"', $this->printed_scripts[0][0] );
		$this->assertStringNotContainsString( '.ka11y-page{color:red}', $this->inline_styles['kotlinskidev-a11y-tokens'] );
	}

	public function test_non_lazy_modes_send_a_null_css_to_the_bootstrap(): void {
		foreach ( array( 'linked', 'inline' ) as $mode ) {
			$this->performance( array( 'pageCss' => $mode ) );
			$this->printed_scripts = array();
			$this->head();

			$this->assertStringContainsString( '"css":null', $this->printed_scripts[0][0], $mode );
		}
	}

	public function test_inline_page_css_is_appended_to_the_tokens_style(): void {
		$this->performance( array( 'pageCss' => 'inline' ) );

		$this->assets()->enqueue();
		$this->head();

		$this->assertArrayNotHasKey( 'kotlinskidev-a11y-frontend', $this->enqueued_styles );
		$this->assertStringEndsWith( '.ka11y-page{color:red}', $this->inline_styles['kotlinskidev-a11y-tokens'] );
	}

	public function test_bootstrap_is_printed_with_its_id_and_never_breaks_out_of_the_script(): void {
		$this->head();

		[ $code, $attributes ] = $this->printed_scripts[0];

		$this->assertSame( array( 'id' => 'kotlinskidev-a11y-bootstrap' ), $attributes );
		$this->assertStringNotContainsStringIgnoringCase( '</script', $code );
		$this->assertStringContainsString( 'window.__boot=1', $code );
	}

	public function test_bootstrap_falls_back_to_empty_object_when_encoding_fails(): void {
		Functions\when( 'wp_json_encode' )->justReturn( false );

		$this->head();

		$this->assertStringStartsWith( 'window.kotlinskidevA11y={};', $this->printed_scripts[0][0] );
	}

	public function test_bootstrap_hidden_key_follows_the_storage_key(): void {
		$this->store_settings( array( 'storage' => array( 'key' => 'my_key' ) ) );

		$this->head();

		$this->assertStringContainsString( '"hk":"my_key-hidden"', $this->printed_scripts[0][0] );
	}

	public function test_head_prints_the_noscript_rule(): void {
		$this->head();

		$this->assertSame( '<noscript><style>#ka11y-root,.ka11y-trigger{display:none!important}</style></noscript>', $this->head_html );
	}

	public function test_tokens_css_has_variables_device_rules_hidden_rule_and_custom_css(): void {
		$settings                                    = Schema::defaults();
		$settings['widget']['position']['mobile']    = 'middle-left';
		$settings['visibility']['devices']['tablet'] = false;
		$settings['customCss']                       = 'body{outline:0}';

		$css = $this->assets()->tokens_css( $settings );

		$this->assertStringContainsString( '--ka11y-primary:#0b57d0', $css );
		$this->assertStringContainsString( '--ka11y-on-primary:#ffffff', $css );
		$this->assertStringContainsString( '--ka11y-size:52px', $css );
		$this->assertStringContainsString( '@media (min-width:1025px){#ka11y-root{right:20px;left:auto;bottom:20px;top:auto;transform:none;}}', $css );
		$this->assertStringContainsString( '@media (max-width:768px){#ka11y-root{left:20px;right:auto;top:50%;bottom:auto;transform:translateY(-50%);}}', $css );
		$this->assertStringContainsString( '@media (min-width:769px) and (max-width:1024px){#ka11y-root{', $css );
		$this->assertStringContainsString( 'display:none!important;', $css );
		$this->assertStringContainsString( 'html[data-ka11y-hidden] #ka11y-root{display:none!important}', $css );
		$this->assertStringEndsWith( 'body{outline:0}', $css );
	}

	public function test_tokens_css_cannot_break_out_of_style(): void {
		$settings                         = Schema::defaults();
		$settings['tokens']['fontFamily'] = 'Arial</style><script>alert(1)</script>';
		$settings['customCss']            = 'a{}</style><script>alert(2)</script>';

		$css = $this->assets()->tokens_css( $settings );

		$this->assertStringNotContainsString( '<', $css );
	}

	public function test_print_head_outputs_nothing_when_hidden(): void {
		Functions\expect( 'wp_print_inline_script_tag' )->never();
		Functions\expect( 'wp_enqueue_style' )->never();

		ob_start();
		$this->assets( false )->print_head();

		$this->assertSame( '', ob_get_clean() );
	}

	public function test_enqueue_does_nothing_when_hidden(): void {
		$this->assets( false )->enqueue();

		$this->assertSame( array(), $this->enqueued_scripts );
		$this->assertSame( array(), $this->enqueued_styles );
	}

	public function test_legacy_asset_is_never_referenced(): void {
		$this->performance(
			array(
				'strategy' => 'eager',
				'pageCss'  => 'linked',
			)
		);

		$this->assets()->enqueue();
		$this->head();

		$urls = implode( ' ', array_column( $this->registered_scripts, 'src' ) ) . ' ' . $this->printed_scripts[0][0] . ' ' . $this->enqueued_styles['kotlinskidev-a11y-frontend'][0];

		$this->assertStringNotContainsString( 'frontend.js', $urls );
	}

	public function test_bootstrap_prefix_carries_t_only_with_custom_selectors(): void {
		$this->head();
		$this->assertStringNotContainsString( '"t":', $this->printed_scripts[0][0] );

		$this->store_settings( array( 'triggers' => array( 'selectors' => array( '.menu-a11y > a', '#x' ) ) ) );
		$this->printed_scripts = array();
		$this->head();

		$this->assertStringContainsString( '"t":":is(.menu-a11y \\u003E a,#x)"', $this->printed_scripts[0][0] );
	}

	public function test_device_rules_hide_triggers_on_hidden_devices_only(): void {
		$settings                                    = Schema::defaults();
		$settings['visibility']['devices']['tablet'] = false;

		$css = $this->assets()->tokens_css( $settings );

		$this->assertStringContainsString( 'display:none!important;}.ka11y-trigger{display:none!important}}', $css );
		$this->assertSame( 1, substr_count( $css, '.ka11y-trigger{display:none!important}' ) );
	}
}
