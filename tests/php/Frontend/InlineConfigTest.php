<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\InlineConfig;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class InlineConfigTest extends TestCase {

	use FrontendEnvironment;

	protected function setUp(): void {
		parent::setUp();
		Manifest::flush();
		$this->frontend_environment();
	}

	protected function tearDown(): void {
		Manifest::flush();
		parent::tearDown();
	}

	private function config( ?array $settings = null ): array {
		return ( new InlineConfig() )->config( $settings ?? ( new Repository() )->get() );
	}

	public function test_script_falls_back_to_empty_object_when_encoding_fails(): void {
		Functions\when( 'wp_json_encode' )->justReturn( false );

		$this->assertSame(
			'window.kotlinskidevA11y=Object.assign(window.kotlinskidevA11y||{},{});',
			( new InlineConfig() )->script( ( new Repository() )->get() )
		);
	}

	public function test_exact_keys(): void {
		$this->assertSame(
			array( 'v', 'locale', 'rtl', 'storage', 'shortcut', 'load', 'hiddenMedia', 'chunks', 'data', 'strings', 'advanced', 'assets' ),
			array_keys( $this->config() )
		);
	}

	public function test_values_match_the_front_end_contract(): void {
		$config = $this->config();

		$this->assertSame( '0.0.0-test', $config['v'] );
		$this->assertSame( 'en_US', $config['locale'] );
		$this->assertFalse( $config['rtl'] );
		$this->assertSame( 'ka11y', $config['storage']['key'] );
		$this->assertSame(
			array(
				'strategy'   => 'interaction',
				'prefetch'   => 'hover',
				'pageCss'    => 'lazy',
				'deviceSkip' => true,
			),
			$config['load']
		);
		$this->assertSame( '', $config['hiddenMedia'] );
		$this->assertSame( 'https://example.test/wp-content/plugins/kotlinskidev-accessibility/build/', $config['chunks']['base'] );
		$this->assertSame(
			array( 'kernel', 'panel', 'content', 'color', 'orientation', 'page' ),
			array_keys( $config['chunks']['ver'] )
		);
		$this->assertSame( 'aaaaaaaaaaaa', $config['chunks']['ver']['kernel'] );
		$this->assertSame( 'ffffffffffff', $config['chunks']['ver']['page'] );
		$this->assertSame(
			array(
				'https://example.test/wp-content/uploads/kotlinskidev-a11y/panel-en_US-0123456789ab.json',
				'https://example.test/wp-json/kotlinskidev-a11y/v1/panel-data?locale=en_US&v=0123456789ab',
			),
			$config['data']
		);
		$this->assertSame( array( 'open', 'loadError' ), array_keys( $config['strings'] ) );
		$this->assertSame( '#wpadminbar', $config['advanced']['excludeSelectors'] );
		$this->assertSame(
			'https://example.test/wp-content/plugins/kotlinskidev-accessibility/assets/fonts/opendyslexic-regular.woff2',
			$config['assets']['dyslexicFontUrl']
		);
	}

	public function test_moved_fields_are_not_inlined(): void {
		$config = $this->config();

		foreach ( array( 'features', 'profiles', 'widget', 'theme', 'tokens', 'hideToolbar', 'statementUrl', 'customCss' ) as $moved ) {
			$this->assertArrayNotHasKey( $moved, $config );
		}
	}

	public function test_script_merges_into_the_bootstrap_prefix_instead_of_replacing_it(): void {
		$script = ( new InlineConfig() )->script( ( new Repository() )->get() );

		$this->assertStringStartsWith( 'window.kotlinskidevA11y=Object.assign(window.kotlinskidevA11y||{},{"v":', $script );
		$this->assertStringEndsWith( '});', $script );
	}

	public function test_script_escapes_tags_and_ampersands(): void {
		$this->store_settings( array( 'advanced' => array( 'excludeSelectors' => 'a[title="</script><b>&"]' ) ) );

		$script = ( new InlineConfig() )->script( ( new Repository() )->get() );

		$this->assertStringNotContainsStringIgnoringCase( '</script', $script );
		$this->assertStringNotContainsString( '<b>', $script );
		$this->assertStringContainsString( '\u003C/script\u003E', $script );
		$this->assertStringContainsString( 'panel-data?locale=en_US\u0026v=0123456789ab', $script );
	}

	/**
	 * @dataProvider combos
	 */
	public function test_parse_combo( string $combo, ?array $expected ): void {
		$this->assertSame( $expected, InlineConfig::parse_combo( $combo ) );
	}

	public static function combos(): array {
		return array(
			'alt shift a'   => array(
				'Alt+Shift+A',
				array(
					'alt'   => true,
					'shift' => true,
					'ctrl'  => false,
					'meta'  => false,
					'key'   => 'a',
					'code'  => 'KeyA',
				),
			),
			'ctrl digit'    => array(
				'Ctrl+1',
				array(
					'alt'   => false,
					'shift' => false,
					'ctrl'  => true,
					'meta'  => false,
					'key'   => '1',
					'code'  => 'Digit1',
				),
			),
			'aliases'       => array(
				'Cmd+Option+Escape',
				array(
					'alt'   => true,
					'shift' => false,
					'ctrl'  => false,
					'meta'  => true,
					'key'   => 'escape',
					'code'  => 'escape',
				),
			),
			'only modifier' => array( 'Alt+Shift', null ),
			'two keys'      => array( 'A+B', null ),
			'empty part'    => array( 'Alt++A', null ),
			'empty'         => array( '', null ),
		);
	}

	public function test_shortcut_parsed_is_null_when_disabled_or_invalid(): void {
		$this->store_settings( array( 'shortcut' => array( 'enabled' => false ) ) );
		$this->assertNull( $this->config()['shortcut']['parsed'] );
		$this->assertFalse( $this->config()['shortcut']['enabled'] );

		$this->store_settings(
			array(
				'shortcut' => array(
					'enabled' => true,
					'combo'   => 'Alt+',
				),
			)
		);
		$this->assertNull( $this->config()['shortcut']['parsed'] );
	}

	public function test_shortcut_parsed_carries_the_default_combo(): void {
		$shortcut = $this->config()['shortcut'];

		$this->assertSame( 'Alt+Shift+A', $shortcut['combo'] );
		$this->assertSame( 'KeyA', $shortcut['parsed']['code'] );
	}

	/**
	 * @dataProvider device_combinations
	 */
	public function test_hidden_media( array $devices, string $expected ): void {
		$this->store_settings( array( 'visibility' => array( 'devices' => $devices ) ) );

		$this->assertSame( $expected, $this->config()['hiddenMedia'] );
	}

	public static function device_combinations(): array {
		$desktop = '(min-width:1025px)';
		$tablet  = '(min-width:769px) and (max-width:1024px)';
		$mobile  = '(max-width:768px)';

		return array(
			'all visible'    => array(
				array(
					'desktop' => true,
					'tablet'  => true,
					'mobile'  => true,
				),
				'',
			),
			'mobile hidden'  => array( array( 'mobile' => false ), $mobile ),
			'tablet hidden'  => array( array( 'tablet' => false ), $tablet ),
			'desktop hidden' => array( array( 'desktop' => false ), $desktop ),
			'mobile tablet'  => array(
				array(
					'tablet' => false,
					'mobile' => false,
				),
				$tablet . ',' . $mobile,
			),
			'all hidden'     => array(
				array(
					'desktop' => false,
					'tablet'  => false,
					'mobile'  => false,
				),
				$desktop . ',' . $tablet . ',' . $mobile,
			),
		);
	}

	public function test_hidden_media_follows_custom_breakpoints(): void {
		$this->store_settings(
			array(
				'visibility' => array(
					'breakpoints' => array(
						'tablet' => 900,
						'mobile' => 600,
					),
					'devices'     => array( 'mobile' => false ),
				),
			)
		);

		$this->assertSame( '(max-width:600px)', $this->config()['hiddenMedia'] );
	}

	public function test_load_section_follows_the_performance_settings(): void {
		$this->store_settings(
			array(
				'performance' => array(
					'preset'     => 'custom',
					'strategy'   => 'idle',
					'prefetch'   => 'none',
					'pageCss'    => 'linked',
					'deviceSkip' => false,
				),
			)
		);

		$this->assertSame(
			array(
				'strategy'   => 'idle',
				'prefetch'   => 'none',
				'pageCss'    => 'linked',
				'deviceSkip' => false,
			),
			$this->config()['load']
		);
	}

	public function test_default_script_stays_within_the_byte_budget(): void {
		$this->assertLessThanOrEqual( 1536, strlen( ( new InlineConfig() )->script( ( new Repository() )->get() ) ) );
	}

	public function test_polish_locale_with_a_long_uploads_url_stays_within_the_byte_budget(): void {
		$this->frontend_environment( 'pl_PL', 'https://example.test/wp-content/uploads-with-a-very-long-directory-name/sites/12' );
		$this->panel_entries['pl_PL']['inline'] = array(
			'open'      => 'Otwórz ustawienia dostępności',
			'loadError' => 'Narzędzia dostępności nie załadowały się. Wybierz przycisk, aby spróbować ponownie.',
		);

		$script = ( new InlineConfig() )->script( ( new Repository() )->get() );

		$this->assertStringContainsString( '"locale":"pl_PL"', $script );
		$this->assertStringContainsString( 'Otwórz ustawienia dostępności', $script );
		$this->assertLessThanOrEqual( 1536, strlen( $script ) );
	}

	public function test_legacy_filter_inlines_the_moved_fields_and_full_strings(): void {
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Filters\expectApplied( 'kotlinskidev_a11y_legacy_config' )->once()->andReturn( true );

		$config = $this->config();

		foreach ( array( 'features', 'profiles', 'widget', 'theme', 'tokens', 'hideToolbar', 'statementUrl', 'customCss' ) as $moved ) {
			$this->assertArrayHasKey( $moved, $config );
		}

		$this->assertArrayHasKey( 'panelTitle', $config['strings'] );
		$this->assertArrayHasKey( 'biggerText', $config['features'] );
		$this->assertArrayNotHasKey( 'hash', $config );
	}

	public function test_schema_defaults_produce_the_recommended_load_section(): void {
		$this->assertSame( Schema::defaults()['performance']['strategy'], $this->config()['load']['strategy'] );
	}

	public function test_trigger_and_launcher_fields_are_omitted_at_defaults(): void {
		$config = $this->config();

		$this->assertArrayNotHasKey( 'triggers', $config );
		$this->assertArrayNotHasKey( 'launcher', $config );
	}

	public function test_trigger_fields_carry_selectors_and_url_actions(): void {
		$settings                           = ( new Repository() )->get();
		$settings['triggers']['selectors']  = array( '.a', '#b' );
		$settings['triggers']['urlActions'] = array( 'open' );

		$this->assertSame(
			array(
				's' => '.a,#b',
				'u' => array( 'open' ),
			),
			$this->config( $settings )['triggers']
		);

		$settings['triggers']['selectors'] = array();
		$this->assertSame( '', $this->config( $settings )['triggers']['s'] );
	}

	public function test_launcher_field_carries_mode_and_mount_only_for_inline(): void {
		$settings                       = ( new Repository() )->get();
		$settings['widget']['launcher'] = 'inline';
		$settings['widget']['mount']    = '#slot';

		$this->assertSame(
			array(
				'mode'  => 'inline',
				'mount' => '#slot',
			),
			$this->config( $settings )['launcher']
		);

		$settings['widget']['launcher'] = 'hidden';
		$this->assertSame(
			array(
				'mode'  => 'hidden',
				'mount' => '',
			),
			$this->config( $settings )['launcher']
		);
	}

	public function test_filters_extend_selectors_and_narrow_url_actions(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_trigger_selectors' )->once()->andReturn( array( '.a', '<bad>', 'body', '.c' ) );
		Filters\expectApplied( 'kotlinskidev_a11y_url_actions' )->once()->andReturn( array( 'open', 'reset' ) );

		$triggers = $this->config()['triggers'];

		$this->assertSame( '.a,.c', $triggers['s'] );
		$this->assertSame( array( 'open' ), $triggers['u'] );
	}

	public function test_url_actions_filter_cannot_widen_the_setting(): void {
		$settings                           = ( new Repository() )->get();
		$settings['triggers']['urlActions'] = array( 'open' );

		Filters\expectApplied( 'kotlinskidev_a11y_url_actions' )->once()->andReturn( array( 'open', 'feature', 'profile' ) );

		$this->assertSame( array( 'open' ), InlineConfig::url_actions( $settings ) );
	}

	public function test_budget_holds_with_maximum_selectors_and_non_default_url_actions(): void {
		$selectors = array();
		for ( $i = 0; $i < 10; $i++ ) {
			$selectors[] = str_pad( '.menu-item-a11y-' . $i . ' > a', 40, 'x' );
		}
		$settings                           = ( new Repository() )->get();
		$settings['triggers']['selectors']  = $selectors;
		$settings['triggers']['urlActions'] = array( 'open' );

		$this->assertLessThanOrEqual( 1536, strlen( ( new InlineConfig() )->script( $settings ) ) );
	}
}
