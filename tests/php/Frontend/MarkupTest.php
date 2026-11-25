<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Markup;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;

final class MarkupTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'is_feed'               => false,
				'is_customize_preview'  => false,
				'get_queried_object_id' => 0,
				'get_post_type'         => false,
				'home_url'              => 'https://example.test',
				'wp_unslash'            => static fn ( $value ) => $value,
				'wp_parse_url'          => static fn ( $url, $component = -1 ) => parse_url( (string) $url, $component ),
				'wp_get_current_user'   => (object) array( 'roles' => array() ),
				'__'                    => static fn ( $text ) => $text,
				'esc_attr'              => static fn ( $text ) => htmlspecialchars( (string) $text, ENT_QUOTES ),
				'esc_url'               => static fn ( $text ) => (string) $text,
				'wp_kses'               => static fn ( $html ) => $html,
			)
		);
		Functions\when( 'get_option' )->justReturn( array() );
		$_SERVER['REQUEST_URI'] = '/';
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
		Functions\when( 'switch_to_locale' )->justReturn( false );
	}

	private function markup( bool $render = true, ?string $launcher_css = null ): Markup {
		Functions\when( 'is_admin' )->justReturn( ! $render );

		return new Markup( new Visibility(), null, null, null, $launcher_css );
	}

	public function test_registers_footer_hook(): void {
		$markup = $this->markup();

		Actions\expectAdded( 'wp_footer' )->once()->with( array( $markup, 'render' ) );

		$markup->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_launcher_button_attributes(): void {
		$html = $this->markup()->html( Schema::defaults() );

		$this->assertStringContainsString( '<div id="ka11y-root"', $html );
		$this->assertStringContainsString( 'data-ka11y-position-desktop="bottom-right"', $html );
		$this->assertStringContainsString( 'data-ka11y-position-tablet="bottom-right"', $html );
		$this->assertStringContainsString( 'data-ka11y-position-mobile="bottom-right"', $html );
		$this->assertStringContainsString( 'data-ka11y-size="md"', $html );
		$this->assertStringContainsString( 'data-ka11y-icon-border="false"', $html );
		$this->assertStringContainsString( '<button type="button"', $html );
		$this->assertStringContainsString( 'aria-label="Open accessibility settings"', $html );
		$this->assertStringContainsString( 'aria-haspopup="dialog"', $html );
		$this->assertStringContainsString( 'aria-expanded="false"', $html );
		$this->assertStringContainsString( '<svg', $html );
		$this->assertStringContainsString( 'aria-hidden="true"', $html );
	}

	public function test_attachment_icon_renders_image(): void {
		Functions\expect( 'wp_get_attachment_image_url' )->once()->with( 15, 'full' )->andReturn( 'https://example.test/icon.png' );
		$settings                   = Schema::defaults();
		$settings['widget']['icon'] = '15';

		$html = $this->markup()->html( $settings );

		$this->assertStringContainsString( '<img class="ka11y-icon" src="https://example.test/icon.png"', $html );
		$this->assertStringNotContainsString( '<svg', $html );
	}

	public function test_missing_attachment_falls_back_to_svg(): void {
		Functions\when( 'wp_get_attachment_image_url' )->justReturn( false );
		$settings                   = Schema::defaults();
		$settings['widget']['icon'] = '99';

		$this->assertStringContainsString( '<svg', $this->markup()->html( $settings ) );
	}

	public function test_render_prints_nothing_when_hidden(): void {
		ob_start();
		$this->markup( false )->render();

		$this->assertSame( '', ob_get_clean() );
	}

	public function test_render_prints_root_when_visible(): void {
		ob_start();
		$this->markup()->render();

		$this->assertStringContainsString( 'id="ka11y-root"', (string) ob_get_clean() );
	}

	public function test_launcher_is_a_declarative_shadow_root_with_inline_css(): void {
		$html = $this->markup()->html( Schema::defaults() );

		$this->assertStringContainsString( '><template shadowrootmode="open"><style>', $html );
		$this->assertStringContainsString( '<style>:host{position:fixed}.ka11y-launcher{display:flex;color:red}</style><button type="button"', $html );
		$this->assertStringEndsWith( '</button></template></div>', $html );
		$this->assertSame( 1, substr_count( $html, '<template' ) );
	}

	public function test_launcher_button_lives_inside_the_template_only(): void {
		$html     = $this->markup()->html( Schema::defaults() );
		$template = (int) strpos( $html, '<template' );

		$this->assertGreaterThan( $template, (int) strpos( $html, '<button' ) );
		$this->assertLessThan( (int) strpos( $html, '</template>' ), (int) strpos( $html, '</button>' ) );
	}

	public function test_missing_launcher_css_omits_the_style_element(): void {
		$html = $this->markup( true, sys_get_temp_dir() . '/ka11y-missing-launcher.css' )->html( Schema::defaults() );

		$this->assertStringNotContainsString( '<style', $html );
		$this->assertStringContainsString( '<template shadowrootmode="open"><button', $html );
	}

	public function test_label_with_markup_characters_is_escaped(): void {
		Functions\when( 'switch_to_locale' )->justReturn( false );
		Functions\when( 'apply_filters' )->alias(
			static fn ( string $hook, mixed $value ): mixed => 'kotlinskidev_a11y_strings' === $hook ? array_merge( (array) $value, array( 'open' => 'Open "<>" menu' ) ) : $value
		);

		$html = $this->markup()->html( Schema::defaults() );

		$this->assertStringContainsString( 'aria-label="Open &quot;&lt;&gt;&quot; menu"', $html );
	}

	public function test_kses_allow_list_keeps_template_and_style(): void {
		$allowed = array();
		Functions\when( 'wp_kses' )->alias(
			static function ( string $html, array $allow ) use ( &$allowed ): string {
				$allowed = $allow;

				return $html;
			}
		);

		ob_start();
		$this->markup()->render();
		ob_end_clean();

		$this->assertSame( array( 'shadowrootmode' => true ), $allowed['template'] );
		$this->assertSame( array(), $allowed['style'] );
	}

	public function test_host_carries_language_and_direction(): void {
		$html = $this->markup()->html( Schema::defaults() );

		$this->assertStringContainsString( '<div id="ka11y-root" lang="en-US" dir="ltr"', $html );
	}
}
