<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Triggers;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Tests\TestCase;
use Kotlinskidev\A11y\Triggers\Block;

final class BlockTest extends TestCase {

	use TriggerEnvironment;

	protected function setUp(): void {
		parent::setUp();
		$this->trigger_environment();
	}

	protected function tearDown(): void {
		unset( $_SERVER['REQUEST_URI'] );
		parent::tearDown();
	}

	public function test_registers_on_init(): void {
		$block = new Block();

		$block->register();

		$this->assertNotFalse( has_action( 'init', array( $block, 'register_block' ) ) );
	}

	public function test_registers_from_metadata_with_render_callback(): void {
		$block = new Block();

		Functions\expect( 'register_block_type_from_metadata' )->once()->with(
			KOTLINSKIDEV_A11Y_DIR . 'build/blocks/trigger',
			array( 'render_callback' => array( $block, 'render' ) )
		);

		$block->register_block();
		$this->addToAssertionCount( 1 );
	}

	public function test_block_json_declares_dynamic_block(): void {
		$json = json_decode( (string) file_get_contents( dirname( __DIR__, 3 ) . '/src/blocks/trigger/block.json' ), true );

		$this->assertSame( 'kotlinskidev-a11y/trigger', $json['name'] );
		$this->assertSame( 3, $json['apiVersion'] );
		$this->assertSame( 'open', $json['attributes']['action']['default'] );
		$this->assertSame( array( 'button', 'link' ), $json['attributes']['element']['enum'] );
		$this->assertArrayNotHasKey( 'save', $json );
	}

	public function test_render_merges_wrapper_attributes(): void {
		Functions\when( 'get_block_wrapper_attributes' )->justReturn( 'class="wp-block-kotlinskidev-a11y-trigger has-text-color" style="color:#fff;padding:4px"' );

		$html = ( new Block() )->render(
			array(
				'action'   => 'toggle',
				'label'    => 'Menu',
				'element'  => 'link',
				'showIcon' => false,
			)
		);

		$this->assertStringContainsString( 'class="ka11y-trigger wp-block-kotlinskidev-a11y-trigger has-text-color"', $html );
		$this->assertStringContainsString( 'style="color:#fff;padding:4px"', $html );
		$this->assertStringContainsString( 'data-ka11y="toggle"', $html );
		$this->assertStringContainsString( '>Menu</a>', $html );
	}

	public function test_unknown_attributes_ignored_and_invalid_action_empty(): void {
		Functions\when( 'get_block_wrapper_attributes' )->justReturn( 'class="wp-block-kotlinskidev-a11y-trigger"' );

		$this->assertStringNotContainsString( 'evil', ( new Block() )->render( array( 'evil' => '"><b>' ) ) );
		$this->assertSame( '', ( new Block() )->render( array( 'action' => '"><b>' ) ) );
	}
}
