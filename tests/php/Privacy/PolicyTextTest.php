<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Privacy;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Privacy\PolicyText;
use Kotlinskidev\A11y\Tests\TestCase;

final class PolicyTextTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs(
			array(
				'__'          => static fn ( $text ) => $text,
				'esc_html__'  => static fn ( $text ) => $text,
				'esc_html'    => static fn ( $text ) => $text,
			)
		);
	}

	public function test_registers_on_admin_init(): void {
		$policy = new PolicyText();

		$policy->register();

		$this->assertNotFalse( has_action( 'admin_init', array( $policy, 'add' ) ) );
	}

	public function test_adds_the_policy_content_under_the_plugin_name(): void {
		$captured = array();

		Functions\when( 'wp_add_privacy_policy_content' )->alias(
			static function ( string $name, string $content ) use ( &$captured ): void {
				$captured = array( $name, $content );
			}
		);

		( new PolicyText() )->add();

		$this->assertSame( 'Kotlinskidev Accessibility', $captured[0] );
		$this->assertNotSame( '', $captured[1] );
	}

	public function test_text_names_every_stored_item_and_makes_no_tracking_claim(): void {
		$html = ( new PolicyText() )->html();

		foreach ( array( 'ka11y', 'ka11y-locale', 'ka11y-hidden', 'uploads', 'GitHub', 'does not track' ) as $needle ) {
			$this->assertStringContainsString( $needle, $html );
		}
	}

	public function test_text_is_valid_list_markup(): void {
		$html = ( new PolicyText() )->html();

		$this->assertSame( substr_count( $html, '<ul>' ), substr_count( $html, '</ul>' ) );
		$this->assertSame( substr_count( $html, '<li>' ), substr_count( $html, '</li>' ) );
	}
}
