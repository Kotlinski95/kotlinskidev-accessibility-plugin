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
				'features'   => array( 'biggerText' => array( 'enabled' => 'yes', 'default' => 'x' ) ),
				'storage'    => array( 'ttlDays' => array( 1 ), 'key' => 5 ),
				'tokens'     => array( 'primary' => 'red', 'radius' => 'big', 'zIndex' => 1.5 ),
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
				'widget'  => array( 'size' => 'xl', 'position' => array( 'desktop' => 'center', 'mobile' => 'top-left' ) ),
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
				'widget'  => array( 'offsetX' => array( 'desktop' => '35', 'tablet' => -4 ) ),
			)
		);

		$this->assertSame( 3650, $result['storage']['ttlDays'] );
		$this->assertSame( 35, $result['widget']['offsetX']['desktop'] );
		$this->assertSame( 0, $result['widget']['offsetX']['tablet'] );
	}

	public function test_feature_level_accepts_bool_or_int(): void {
		$result = $this->sanitizer->sanitize(
			array( 'features' => array( 'biggerText' => array( 'default' => 2 ), 'textAlign' => array( 'default' => true ), 'saturation' => array( 'default' => 99 ) ) )
		);

		$this->assertSame( 2, $result['features']['biggerText']['default'] );
		$this->assertTrue( $result['features']['textAlign']['default'] );
		$this->assertSame( 10, $result['features']['saturation']['default'] );
	}

	public function test_custom_css_stripped(): void {
		$result = $this->sanitizer->sanitize( array( 'customCss' => "a{color:red}</style><script>alert(1)</script></STYLE >b{top:0}" ) );

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
				'features' => array( 'biggerText' => array( 'enabled' => false, 'extra' => 1 ), 'nonFeature' => array( 'enabled' => true ) ),
				'storage'  => array( 'mode' => 'none', 'evil' => 'x' ),
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
					'pl_PL'  => array( 'open' => '<b>Otwórz</b>', 'bad key!' => 'x' ),
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
				'visibility'  => array( 'excludePostIds' => array( 5, '5', 'x', 9 ), 'excludeRoles' => array( 'editor', '<i>editor</i>', '', 3 ) ),
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
				'tokens'   => array( 'primary' => '#ABC', 'radius' => '0.5rem' ),
				'shortcut' => array( 'combo' => 'Ctrl+Alt+K' ),
				'statement' => array( 'url' => 'https://example.com/a11y' ),
			)
		);

		$this->assertSame( '#ABC', $result['tokens']['primary'] );
		$this->assertSame( '0.5rem', $result['tokens']['radius'] );
		$this->assertSame( 'Ctrl+Alt+K', $result['shortcut']['combo'] );
		$this->assertSame( 'https://example.com/a11y', $result['statement']['url'] );
	}
}
