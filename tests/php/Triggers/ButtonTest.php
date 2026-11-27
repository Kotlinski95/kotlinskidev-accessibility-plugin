<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Triggers;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\Markup;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Triggers\Button;

final class ButtonTest extends TestCase {

	use TriggerEnvironment;

	protected function setUp(): void {
		parent::setUp();
		$this->trigger_environment();
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
		parent::tearDown();
	}

	public function test_open_button_markup_and_aria(): void {
		$this->assertSame(
			'<button type="button" class="ka11y-trigger" data-ka11y="open" aria-controls="ka11y-root" aria-expanded="false" aria-haspopup="dialog">Accessibility</button>',
			( new Button() )->render( array( 'action' => 'open' ) )
		);
	}

	public function test_toggle_has_dialog_aria(): void {
		$html = ( new Button() )->render( array( 'action' => 'toggle' ) );

		$this->assertStringContainsString( 'aria-haspopup="dialog"', $html );
		$this->assertStringContainsString( 'aria-expanded="false"', $html );
	}

	public function test_close_only_controls(): void {
		$html = ( new Button() )->render( array( 'action' => 'close' ) );

		$this->assertStringContainsString( 'aria-controls="ka11y-root"', $html );
		$this->assertStringNotContainsString( 'aria-expanded', $html );
		$this->assertStringContainsString( 'Close accessibility settings', $html );
	}

	public function test_simple_actions_have_no_aria(): void {
		foreach ( array( 'reset', 'hide', 'show' ) as $action ) {
			$html = ( new Button() )->render( array( 'action' => $action ) );

			$this->assertStringContainsString( 'data-ka11y="' . $action . '"', $html );
			$this->assertStringNotContainsString( 'aria-', $html );
		}
	}

	public function test_feature_and_profile_use_pressed_and_panel_labels(): void {
		$feature = ( new Button() )->render( array( 'action' => 'feature:biggerText:2' ) );
		$profile = ( new Button() )->render( array( 'action' => 'profile:adhdFriendly' ) );

		$this->assertStringContainsString( 'aria-pressed="false"', $feature );
		$this->assertStringContainsString( 'data-ka11y="feature:biggerText:2"', $feature );
		$this->assertStringContainsString( '>Bigger text</button>', $feature );
		$this->assertStringContainsString( 'aria-pressed="false"', $profile );
		$this->assertStringContainsString( '>ADHD friendly</button>', $profile );
	}

	public function test_link_element(): void {
		$this->assertSame(
			'<a href="#ka11y/profile:adhdFriendly" class="ka11y-trigger" data-ka11y="profile:adhdFriendly" role="button" aria-pressed="false">Focus</a>',
			( new Button() )->render(
				array(
					'action'  => 'profile:adhdFriendly',
					'element' => 'link',
					'label'   => 'Focus',
				)
			)
		);
	}

	public function test_unknown_element_falls_back_to_button(): void {
		$this->assertStringStartsWith( '<button', ( new Button() )->render( array( 'element' => 'div onclick=x' ) ) );
	}

	public function test_invalid_actions_render_nothing(): void {
		foreach ( array( '', 'nope', 'open:extra', 'feature:unknown', 'feature:biggerText:abc', '"><script>alert(1)</script>', 'profile:x:1' ) as $action ) {
			$this->assertSame( '', ( new Button() )->render( array( 'action' => $action ) ), $action );
		}
	}

	public function test_disabled_feature_renders_nothing(): void {
		$this->trigger_environment( array( 'features' => array( 'biggerText' => array( 'enabled' => false ) ) ) );

		$this->assertSame( '', ( new Button() )->render( array( 'action' => 'feature:biggerText' ) ) );
	}

	public function test_label_is_escaped_and_plain_text(): void {
		$html = ( new Button() )->render( array( 'label' => '<script>alert(1)</script>Go "now" & \'then\'' ) );

		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringContainsString( 'Go &quot;now&quot; &amp; &#039;then&#039;', $html );
	}

	public function test_label_is_capped_at_100_characters(): void {
		$html = ( new Button() )->render( array( 'label' => str_repeat( 'a', 101 ) ) );

		$this->assertStringContainsString( '>' . str_repeat( 'a', 100 ) . '</button>', $html );
	}

	public function test_class_tokens_are_sanitized_deduped_and_capped(): void {
		$tokens = array();
		for ( $i = 1; $i <= 12; $i++ ) {
			$tokens[] = 'c' . $i;
		}
		$html = ( new Button() )->render( array( 'class' => '  my-class "onclick=x  my-class ' . implode( ' ', $tokens ) ) );

		$this->assertStringContainsString( 'class="ka11y-trigger my-class onclickx c1 c2 c3 c4 c5 c6 c7 c8"', $html );
		$this->assertStringNotContainsString( '"onclick', $html );
	}

	public function test_show_icon_prints_launcher_svg_before_label(): void {
		$html = ( new Button() )->render( array( 'show_icon' => true ) );

		$this->assertStringContainsString( '>' . Markup::ICON . 'Accessibility</button>', $html );
		$this->assertStringContainsString( 'aria-hidden="true"', $html );
	}

	public function test_style_argument_is_escaped(): void {
		$html = ( new Button() )->render( array( 'style' => 'color:red;" onclick="x' ) );

		$this->assertStringContainsString( 'style="color:red;&quot; onclick=&quot;x"', $html );
	}

	public function test_not_rendered_when_panel_not_rendered(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_should_render' )->once()->andReturn( false );

		$this->assertSame( '', ( new Button() )->render() );
	}

	public function test_statement_with_url_is_plain_link(): void {
		$this->trigger_environment( array( 'statement' => array( 'url' => 'https://example.test/a11y/' ) ) );

		$this->assertSame(
			'<a href="https://example.test/a11y/" class="ka11y-trigger">Accessibility statement</a>',
			( new Button() )->render( array( 'action' => 'statement' ) )
		);
	}

	public function test_statement_without_url_renders_nothing(): void {
		$this->assertSame( '', ( new Button() )->render( array( 'action' => 'statement' ) ) );
		$this->assertSame(
			'',
			( new Button() )->render(
				array(
					'action'  => 'statement',
					'element' => 'link',
				)
			)
		);
	}

	public function test_empty_label_falls_back_to_default_string(): void {
		$html = ( new Button() )->render(
			array(
				'action'    => 'close',
				'label'     => '   ',
				'show_icon' => true,
			)
		);

		$this->assertStringContainsString( 'Close accessibility settings</button>', $html );
	}

	public function test_missing_strings_fall_back_to_the_action_key(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_strings' )->andReturn( array() );

		foreach ( array( 'open', 'reset', 'feature:biggerText:2', 'profile:adhdFriendly' ) as $action ) {
			$html = ( new Button() )->render(
				array(
					'action'    => $action,
					'show_icon' => true,
				)
			);

			$this->assertStringContainsString( $action . '</button>', $html, $action );
		}
	}

	public function test_filter_output_is_refiltered(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_button_html' )->once()->andReturnUsing(
			static fn ( string $html ): string => $html . '<script>alert(1)</script><iframe></iframe>'
		);
		$html = ( new Button() )->render();

		$this->assertStringNotContainsString( '<script', $html );
		$this->assertStringNotContainsString( '<iframe', $html );
	}

	public function test_kses_allowlist_is_fixed(): void {
		$captured = array();
		Functions\when( 'wp_kses' )->alias(
			static function ( string $html, array $allowed ) use ( &$captured ): string {
				$captured = $allowed;

				return $html;
			}
		);

		( new Button() )->render();

		$this->assertSame( array( 'button', 'a', 'svg', 'circle', 'path' ), array_keys( $captured ) );
		$this->assertArrayHasKey( 'data-ka11y', $captured['button'] );
		$this->assertArrayHasKey( 'role', $captured['a'] );
		$this->assertArrayNotHasKey( 'onclick', $captured['button'] );
	}
}
