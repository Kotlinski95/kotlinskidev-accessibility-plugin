<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests;

use Kotlinskidev\A11y\Tests\Triggers\TriggerEnvironment;

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once dirname( __DIR__, 2 ) . '/src/php/functions.php';

final class FunctionsTest extends TestCase {

	use TriggerEnvironment;

	protected function setUp(): void {
		parent::setUp();
		$this->trigger_environment();
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
		parent::tearDown();
	}

	public function test_get_button_returns(): void {
		$html = kotlinskidev_a11y_get_button( array( 'action' => 'open' ) );

		$this->assertStringStartsWith( '<button', $html );
		$this->assertStringContainsString( 'data-ka11y="open"', $html );
	}

	public function test_button_echoes_same_string(): void {
		$args     = array(
			'action' => 'profile:adhdFriendly',
			'label'  => 'Focus',
		);
		$expected = kotlinskidev_a11y_get_button( $args );

		$this->expectOutputString( $expected );
		kotlinskidev_a11y_button( $args );
	}

	public function test_invalid_action_prints_nothing(): void {
		$this->expectOutputString( '' );
		kotlinskidev_a11y_button( array( 'action' => 'bad' ) );
	}

	public function test_api_version_probe_matches_constant(): void {
		$this->assertSame( KOTLINSKIDEV_A11Y_API, kotlinskidev_a11y_api_version() );
		$this->assertSame( 1, kotlinskidev_a11y_api_version() );
	}
}
