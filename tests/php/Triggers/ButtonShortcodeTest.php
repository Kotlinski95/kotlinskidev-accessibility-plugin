<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Triggers;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Triggers\Button;
use Kotlinskidev\A11y\Triggers\ButtonShortcode;

final class ButtonShortcodeTest extends TestCase {

	use TriggerEnvironment;

	protected function setUp(): void {
		parent::setUp();
		$this->trigger_environment();
		Functions\when( 'shortcode_atts' )->alias(
			static fn ( array $defaults, array $atts ) => array_merge( $defaults, array_intersect_key( $atts, $defaults ) )
		);
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
		parent::tearDown();
	}

	public function test_registers_shortcode(): void {
		$shortcode = new ButtonShortcode();

		Functions\expect( 'add_shortcode' )->once()->with( 'kotlinskidev_a11y_button', array( $shortcode, 'render' ) );

		$shortcode->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_maps_attributes(): void {
		$html = ( new ButtonShortcode() )->render(
			array(
				'action'  => 'profile:adhdFriendly',
				'label'   => 'Focus mode',
				'element' => 'link',
				'class'   => 'extra',
			)
		);

		$this->assertSame(
			'<a href="#ka11y/profile:adhdFriendly" class="ka11y-trigger extra" data-ka11y="profile:adhdFriendly" role="button" aria-pressed="false">Focus mode</a>',
			$html
		);
	}

	public function test_defaults_when_no_attributes(): void {
		$this->assertStringContainsString( 'data-ka11y="open"', ( new ButtonShortcode() )->render( '' ) );
	}

	public function test_show_icon_truthy_strings(): void {
		foreach ( array( '1', 'true', 'yes', 'TRUE' ) as $value ) {
			$this->assertStringContainsString( '<svg', ( new ButtonShortcode() )->render( array( 'show_icon' => $value ) ), $value );
		}
		foreach ( array( '0', 'false', 'no', '' ) as $value ) {
			$this->assertStringNotContainsString( '<svg', ( new ButtonShortcode() )->render( array( 'show_icon' => $value ) ), $value );
		}
	}

	public function test_unknown_attributes_ignored_and_invalid_action_empty(): void {
		$this->assertStringNotContainsString( 'onclick', ( new ButtonShortcode() )->render( array( 'onclick' => 'x' ) ) );
		$this->assertSame( '', ( new ButtonShortcode() )->render( array( 'action' => '"><b>' ) ) );
	}

	public function test_uses_injected_button(): void {
		$this->assertInstanceOf( Button::class, new Button() );
	}
}
