<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Kotlinskidev\A11y\Settings\Sanitizer;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class SanitizerTest extends TestCase {

	private Sanitizer $sanitizer;

	protected function setUp(): void {
		parent::setUp();
		$this->sanitizer = new Sanitizer();
	}

	public function test_defaults_round_trip(): void {
		$defaults = Schema::defaults();

		$this->assertSame( $defaults, $this->sanitizer->sanitize( $defaults ) );
	}

	public function test_empty_input_yields_defaults(): void {
		$this->assertSame( Schema::defaults(), $this->sanitizer->sanitize( array() ) );
	}

	public function test_bad_types_fall_back_to_default(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'features'   => array(
					'biggerText' => array(
						'enabled' => 'yes',
						'default' => 'x',
					),
				),
				'storage'    => array(
					'ttlDays' => array( 1 ),
					'key'     => 5,
				),
				'tokens'     => array(
					'primary' => 'red',
					'radius'  => 'big',
					'zIndex'  => 1.5,
				),
				'shortcut'   => array( 'combo' => 'Alt+Shift+' ),
				'visibility' => array( 'excludePostIds' => 'nope' ),
				'labels'     => 'str',
			)
		);

		$this->assertTrue( $result['features']['biggerText']['enabled'] );
		$this->assertFalse( $result['features']['biggerText']['default'] );
		$this->assertSame( 365, $result['storage']['ttlDays'] );
		$this->assertSame( 'ka11y', $result['storage']['key'] );
		$this->assertSame( '#0b57d0', $result['tokens']['primary'] );
		$this->assertSame( '12px', $result['tokens']['radius'] );
		$this->assertSame( 2147483000, $result['tokens']['zIndex'] );
		$this->assertSame( 'Alt+Shift+A', $result['shortcut']['combo'] );
		$this->assertSame( array(), $result['visibility']['excludePostIds'] );
		$this->assertSame( array(), $result['labels'] );
	}

	public function test_enums_rejected(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'widget'  => array(
					'size'     => 'xl',
					'position' => array(
						'desktop' => 'center',
						'mobile'  => 'top-left',
					),
				),
				'storage' => array( 'mode' => 'session' ),
				'theme'   => array( 'mode' => 'sepia' ),
			)
		);

		$this->assertSame( 'md', $result['widget']['size'] );
		$this->assertSame( 'bottom-right', $result['widget']['position']['desktop'] );
		$this->assertSame( 'top-left', $result['widget']['position']['mobile'] );
		$this->assertSame( 'local', $result['storage']['mode'] );
		$this->assertSame( 'auto', $result['theme']['mode'] );
	}

	public function test_int_clamped_and_numeric_strings_accepted(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'storage' => array( 'ttlDays' => 99999 ),
				'widget'  => array(
					'offsetX' => array(
						'desktop' => '35',
						'tablet'  => -4,
					),
				),
			)
		);

		$this->assertSame( 3650, $result['storage']['ttlDays'] );
		$this->assertSame( 35, $result['widget']['offsetX']['desktop'] );
		$this->assertSame( 0, $result['widget']['offsetX']['tablet'] );
	}

	public function test_feature_level_accepts_bool_or_int(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'features' => array(
					'biggerText' => array( 'default' => 2 ),
					'textAlign'  => array( 'default' => true ),
					'saturation' => array( 'default' => 99 ),
				),
			)
		);

		$this->assertSame( 2, $result['features']['biggerText']['default'] );
		$this->assertTrue( $result['features']['textAlign']['default'] );
		$this->assertSame( 10, $result['features']['saturation']['default'] );
	}

	public function test_custom_css_stripped(): void {
		$result = $this->sanitizer->sanitize( array( 'customCss' => 'a{color:red}</style><script>alert(1)</script></STYLE >b{top:0}' ) );

		$this->assertStringNotContainsString( '</style', strtolower( $result['customCss'] ) );
		$this->assertStringNotContainsString( '<script', $result['customCss'] );
		$this->assertStringContainsString( 'a{color:red}', $result['customCss'] );
	}

	public function test_custom_css_recombined_terminator_removed(): void {
		$result = $this->sanitizer->sanitize( array( 'customCss' => 'a{}</</style style>' ) );

		$this->assertStringNotContainsString( '</style', strtolower( $result['customCss'] ) );
	}

	public function test_unknown_keys_dropped(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'bogus'    => 1,
				'features' => array(
					'biggerText' => array(
						'enabled' => false,
						'extra'   => 1,
					),
					'nonFeature' => array( 'enabled' => true ),
				),
				'storage'  => array(
					'mode' => 'none',
					'evil' => 'x',
				),
			)
		);

		$this->assertArrayNotHasKey( 'bogus', $result );
		$this->assertArrayNotHasKey( 'nonFeature', $result['features'] );
		$this->assertArrayNotHasKey( 'extra', $result['features']['biggerText'] );
		$this->assertArrayNotHasKey( 'evil', $result['storage'] );
		$this->assertFalse( $result['features']['biggerText']['enabled'] );
		$this->assertSame( 'none', $result['storage']['mode'] );
	}

	public function test_profile_features_filtered_to_known_keys(): void {
		$result = $this->sanitizer->sanitize(
			array( 'profiles' => array( 'blindness' => array( 'features' => array( 'readPage', 'bogus', 'readPage', 5 ) ) ) )
		);

		$this->assertSame( array( 'readPage' ), $result['profiles']['blindness']['features'] );
	}

	public function test_labels_and_statement_locale_maps(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'labels'    => array(
					'pl_PL'  => array(
						'open'     => '<b>Otwórz</b>',
						'bad key!' => 'x',
					),
					'not ok' => array( 'open' => 'x' ),
					'en_US'  => 'oops',
				),
				'statement' => array(
					'content' => array(
						'pl_PL' => '<p>Ok</p><script>x</script>',
						'??'    => '<p>no</p>',
					),
				),
			)
		);

		$this->assertSame( array( 'pl_PL' => array( 'open' => 'Otwórz' ) ), $result['labels'] );
		$this->assertSame( array( 'pl_PL' => '<p>Ok</p>x' ), $result['statement']['content'] );
	}

	public function test_icon_accepts_universal_or_attachment_id(): void {
		$this->assertSame( 42, $this->sanitizer->sanitize( array( 'widget' => array( 'icon' => 42 ) ) )['widget']['icon'] );
		$this->assertSame( 42, $this->sanitizer->sanitize( array( 'widget' => array( 'icon' => '42' ) ) )['widget']['icon'] );
		$this->assertSame( 'universal', $this->sanitizer->sanitize( array( 'widget' => array( 'icon' => 'custom' ) ) )['widget']['icon'] );
		$this->assertSame( 'universal', $this->sanitizer->sanitize( array( 'widget' => array( 'icon' => -3 ) ) )['widget']['icon'] );
	}

	public function test_lists_deduped_and_sanitized(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'visibility'  => array(
					'excludePostIds' => array( 5, '5', 'x', 9 ),
					'excludeRoles'   => array( 'editor', '<i>editor</i>', '', 3 ),
				),
				'hideToolbar' => array( 'days' => array( 2, 2, 'a', 9999 ) ),
			)
		);

		$this->assertSame( array( 5, 9 ), $result['visibility']['excludePostIds'] );
		$this->assertSame( array( 'editor' ), $result['visibility']['excludeRoles'] );
		$this->assertSame( array( 2, 3650 ), $result['hideToolbar']['days'] );
	}

	public function test_required_text_falls_back_when_empty(): void {
		$result = $this->sanitizer->sanitize( array( 'tokens' => array( 'fontFamily' => '  <b></b> ' ) ) );

		$this->assertSame( 'inherit', $result['tokens']['fontFamily'] );
	}

	public function test_valid_values_preserved(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'tokens'    => array(
					'primary' => '#ABC',
					'radius'  => '0.5rem',
				),
				'shortcut'  => array( 'combo' => 'Ctrl+Alt+K' ),
				'statement' => array( 'url' => 'https://example.com/a11y' ),
			)
		);

		$this->assertSame( '#ABC', $result['tokens']['primary'] );
		$this->assertSame( '0.5rem', $result['tokens']['radius'] );
		$this->assertSame( 'Ctrl+Alt+K', $result['shortcut']['combo'] );
		$this->assertSame( 'https://example.com/a11y', $result['statement']['url'] );
	}

	public function test_invalid_performance_and_visibility_enums_fall_back(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'performance' => array(
					'preset'        => 'custom',
					'strategy'      => 'nope',
					'position'      => 'side',
					'fetchPriority' => 5,
					'prefetch'      => 'always',
					'pageCss'       => 'x',
					'deviceSkip'    => 'yes',
				),
				'visibility'  => array( 'mode' => 'sometimes' ),
			)
		);

		$this->assertSame( 'interaction', $result['performance']['strategy'] );
		$this->assertSame( 'footer', $result['performance']['position'] );
		$this->assertSame( 'low', $result['performance']['fetchPriority'] );
		$this->assertSame( 'hover', $result['performance']['prefetch'] );
		$this->assertSame( 'lazy', $result['performance']['pageCss'] );
		$this->assertTrue( $result['performance']['deviceSkip'] );
		$this->assertSame( 'everywhere', $result['visibility']['mode'] );
		$this->assertSame( 'recommended', $this->sanitizer->sanitize( array( 'performance' => array( 'preset' => 'bogus' ) ) )['performance']['preset'] );
	}

	public function test_opt_out_drops_unknown_and_duplicate_values(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'performance' => array(
					'preset' => 'custom',
					'optOut' => array( 'litespeed', 'bogus', 'litespeed', 'cloudflare', 4 ),
				),
			)
		);

		$this->assertSame( array( 'litespeed', 'cloudflare' ), $result['performance']['optOut'] );
	}

	public function test_preset_row_overrides_posted_fields(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'performance' => array(
					'preset'     => 'recommended',
					'strategy'   => 'eager',
					'deviceSkip' => false,
				),
			)
		);

		$this->assertSame( 'interaction', $result['performance']['strategy'] );
		$this->assertTrue( $result['performance']['deviceSkip'] );
	}

	public function test_custom_preset_keeps_posted_fields(): void {
		$result = $this->sanitizer->sanitize(
			array(
				'performance' => array(
					'preset'   => 'custom',
					'strategy' => 'eager',
					'pageCss'  => 'inline',
				),
			)
		);

		$this->assertSame( 'eager', $result['performance']['strategy'] );
		$this->assertSame( 'inline', $result['performance']['pageCss'] );
	}

	private function mount( mixed $value ): string {
		return $this->sanitizer->sanitize( array( 'widget' => array( 'mount' => $value ) ) )['widget']['mount'];
	}

	private function selectors( mixed $value ): array {
		return $this->sanitizer->sanitize( array( 'triggers' => array( 'selectors' => $value ) ) )['triggers']['selectors'];
	}

	public function test_selector_accepts_common_forms(): void {
		foreach ( array( '.menu-item-a11y > a', '#a11y-link', 'a[href="#a11y"]', "a[data-x='y']", 'li.a + li:not(.b) ~ a', 'a[href^="#x"], button.open', '  .trim  ' ) as $selector ) {
			$this->assertSame( trim( $selector ), $this->mount( $selector ), $selector );
		}
	}

	public function test_selector_rejects_unsafe_values(): void {
		foreach ( array( 'a<b', 'a{b}', 'a;b', '@media', 'a\\b', 'a/*b*/', 'html', 'BODY', '*', '.ok, body', 'a, *', str_repeat( 'a', 201 ), '', 5, null ) as $selector ) {
			$this->assertSame( '', $this->mount( $selector ), var_export( $selector, true ) );
		}
		$this->assertSame( str_repeat( 'a', 200 ), $this->mount( str_repeat( 'a', 200 ) ) );
	}

	public function test_selector_list_dedupes_drops_invalid_and_caps_items(): void {
		$this->assertSame( array( '.a', '#b' ), $this->selectors( array( '.a', '.a', '<x>', 'body', '#b', 7 ) ) );
		$this->assertSame( array(), $this->selectors( 'nope' ) );

		$items = array();
		for ( $i = 0; $i < 15; $i++ ) {
			$items[] = '.s' . $i;
		}
		$this->assertCount( 10, $this->selectors( $items ) );
	}

	public function test_selector_list_joined_length_is_capped(): void {
		$kept = $this->selectors( array( str_repeat( 'a', 120 ), str_repeat( 'b', 120 ), str_repeat( 'c', 120 ), '.d' ) );

		$this->assertSame( array( str_repeat( 'a', 120 ), str_repeat( 'b', 120 ) ), $kept );
		$this->assertLessThanOrEqual( 300, strlen( implode( ',', $kept ) ) );
	}

	public function test_url_actions_enum(): void {
		$result = $this->sanitizer->sanitize( array( 'triggers' => array( 'urlActions' => array( 'open', 'reset', 'hide', 'profile', 'open', 'feature:x' ) ) ) );

		$this->assertSame( array( 'open', 'profile' ), $result['triggers']['urlActions'] );
		$this->assertSame( array(), $this->sanitizer->sanitize( array( 'triggers' => array( 'urlActions' => array() ) ) )['triggers']['urlActions'] );
		$this->assertSame( array( 'open', 'feature', 'profile' ), $this->sanitizer->sanitize( array( 'triggers' => array( 'urlActions' => 'open' ) ) )['triggers']['urlActions'] );
	}

	public function test_launcher_enum(): void {
		$this->assertSame( 'hidden', $this->sanitizer->sanitize( array( 'widget' => array( 'launcher' => 'hidden' ) ) )['widget']['launcher'] );
		$this->assertSame( 'floating', $this->sanitizer->sanitize( array( 'widget' => array( 'launcher' => 'tray' ) ) )['widget']['launcher'] );
	}
}
