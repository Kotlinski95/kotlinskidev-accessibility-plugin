<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Statement;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\Statement\Shortcode;
use Kotlinskidev\A11y\Tests\TestCase;

final class ShortcodeTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		Functions\when( 'pll_default_language' )->justReturn( false );

		Functions\stubs(
			array(
				'__'               => static fn ( $text ) => $text,
				'esc_html'         => static fn ( $text ) => htmlspecialchars( (string) $text ),
				'esc_attr'         => static fn ( $text ) => htmlspecialchars( (string) $text ),
				'shortcode_atts'   => static fn ( array $defaults, array $atts ) => array_merge( $defaults, array_intersect_key( $atts, $defaults ) ),
				'switch_to_locale' => false,
			)
		);
	}

	private function resolver( string $locale ): LanguageResolver {
		Functions\when( 'determine_locale' )->justReturn( $locale );

		Functions\when( 'pll_current_language' )->justReturn( false );

		return new LanguageResolver();
	}

	private function store( array $content, string $default = 'en_US' ): void {
		Functions\when( 'get_option' )->alias(
			static fn ( string $name, $fallback = false ) => 'WPLANG' === $name ? $default : array( 'statement' => array( 'content' => $content ) )
		);
	}

	public function test_registers_shortcode(): void {
		$shortcode = new Shortcode();

		Functions\expect( 'add_shortcode' )->once()->with( 'kotlinskidev_a11y_statement', array( $shortcode, 'render' ) );

		$shortcode->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_renders_content_for_current_locale(): void {
		$this->store(
			array(
				'pl_PL' => '<p>Deklaracja</p>',
				'en_US' => '<p>Statement</p>',
			)
		);

		$html = ( new Shortcode( null, $this->resolver( 'pl_PL' ) ) )->render();

		$this->assertStringContainsString( '<p>Deklaracja</p>', $html );
		$this->assertStringContainsString( 'lang="pl-PL"', $html );
		$this->assertStringNotContainsString( 'Statement', $html );
	}

	public function test_falls_back_to_default_locale_content(): void {
		$this->store( array( 'en_US' => '<p>Statement</p>' ) );

		$html = ( new Shortcode( null, $this->resolver( 'de_DE' ) ) )->render();

		$this->assertStringContainsString( '<p>Statement</p>', $html );
	}

	public function test_locale_attribute_overrides_resolver(): void {
		$this->store(
			array(
				'pl_PL' => '<p>Deklaracja</p>',
				'en_US' => '<p>Statement</p>',
			)
		);

		$html = ( new Shortcode( null, $this->resolver( 'en_US' ) ) )->render( array( 'locale' => 'pl_PL' ) );

		$this->assertStringContainsString( 'Deklaracja', $html );
	}

	public function test_content_passes_through_kses(): void {
		$this->store( array( 'en_US' => '<p>Safe</p><script>alert(1)</script>' ) );

		$html = ( new Shortcode( null, $this->resolver( 'en_US' ) ) )->render();

		$this->assertStringNotContainsString( '<script>', $html );
		$this->assertStringContainsString( '<p>Safe</p>', $html );
	}

	public function test_blank_content_shows_empty_state_and_template(): void {
		$this->store( array( 'en_US' => '   ' ) );

		$html = ( new Shortcode( null, $this->resolver( 'en_US' ) ) )->render();

		$this->assertStringContainsString( 'The accessibility statement has not been published yet.', $html );
		$this->assertStringContainsString( '<h2>Our commitment to accessibility</h2>', $html );
		$this->assertStringContainsString( '<h2>Conformance status</h2>', $html );
		$this->assertStringContainsString( '<h2>Feedback and contact</h2>', $html );
		$this->assertStringContainsString( '<h2>Date of this statement</h2>', $html );
	}

	public function test_default_locale_uses_polylang_when_available(): void {
		Functions\when( 'pll_default_language' )->justReturn( 'pl_PL' );
		$this->store( array( 'pl_PL' => '<p>Domyślna</p>' ), 'en_US' );

		$html = ( new Shortcode( null, $this->resolver( 'de_DE' ) ) )->render();

		$this->assertStringContainsString( 'Domyślna', $html );
	}
}
