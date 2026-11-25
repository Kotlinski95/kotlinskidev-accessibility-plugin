<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Filters;
use Kotlinskidev\A11y\Frontend\ScriptAttributes;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/HtmlTagProcessorStub.php';

final class ScriptAttributesTest extends TestCase {

	use FrontendEnvironment;

	private const LOADER_TAG = "<script id='kotlinskidev-a11y-loader-js-before'>window.x=1;</script>\n<script src='https://example.test/build/loader.js?ver=0123456789ab' id='kotlinskidev-a11y-loader-js' defer></script>\n";

	protected function setUp(): void {
		parent::setUp();
		$this->frontend_environment();
		$GLOBALS['wp_version'] = '6.8';
	}

	protected function tearDown(): void {
		unset( $GLOBALS['wp_version'] );
		parent::tearDown();
	}

	private function attributes(): ScriptAttributes {
		return new ScriptAttributes( new Repository() );
	}

	private function opt_out( array $values, string $priority = 'auto' ): void {
		$this->store_settings(
			array(
				'performance' => array(
					'preset'        => 'custom',
					'optOut'        => $values,
					'fetchPriority' => $priority,
				),
			)
		);
	}

	public function test_registers_both_filters(): void {
		$attributes = $this->attributes();

		Filters\expectAdded( 'script_loader_tag' )->once()->with( array( $attributes, 'filter_tag' ), 10, 2 );
		Filters\expectAdded( 'wp_inline_script_attributes' )->once()->with( array( $attributes, 'filter_inline' ) );

		$attributes->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_opt_out_map_covers_every_schema_value(): void {
		$this->assertSame(
			array( 'cloudflare', 'wp-rocket', 'litespeed', 'jetpack-boost', 'asset-cleanup' ),
			array_keys( ScriptAttributes::OPT_OUT )
		);
	}

	/**
	 * @dataProvider optimizers
	 */
	public function test_each_opt_out_adds_exact_attributes_to_our_tag( string $name, string $expected ): void {
		$this->opt_out( array( $name ) );

		$tag = $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-loader' );

		$this->assertStringContainsString( ' defer ' . $expected . '></script>', $tag );
		$this->assertStringContainsString( "<script id='kotlinskidev-a11y-loader-js-before'>window.x=1;</script>", $tag );
		$this->assertSame( 1, substr_count( $tag, $expected ) );
	}

	public static function optimizers(): array {
		return array(
			'cloudflare'    => array( 'cloudflare', 'data-cfasync="false"' ),
			'wp-rocket'     => array( 'wp-rocket', 'nowprocket' ),
			'litespeed'     => array( 'litespeed', 'data-no-optimize="1" data-no-defer="1" data-no-minify="1"' ),
			'jetpack-boost' => array( 'jetpack-boost', 'data-jetpack-boost="ignore"' ),
			'asset-cleanup' => array( 'asset-cleanup', 'data-wpacu-skip' ),
		);
	}

	public function test_attributes_land_on_the_src_script_only(): void {
		$this->opt_out( array( 'cloudflare' ) );

		$tag = $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-loader' );

		$this->assertSame( 1, substr_count( $tag, 'data-cfasync' ) );
		$this->assertMatchesRegularExpression( '/<script src=.*data-cfasync="false"/', $tag );
	}

	public function test_foreign_handles_are_untouched(): void {
		$this->opt_out( array( 'cloudflare', 'wp-rocket' ), 'high' );

		$this->assertSame( self::LOADER_TAG, $this->attributes()->filter_tag( self::LOADER_TAG, 'jquery-core' ) );
		$this->assertSame( self::LOADER_TAG, $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-admin' ) );
	}

	public function test_non_string_tag_is_returned_as_is(): void {
		$this->assertNull( $this->attributes()->filter_tag( null, 'kotlinskidev-a11y-loader' ) );
	}

	public function test_empty_opt_out_and_auto_priority_leave_the_tag_alone(): void {
		$this->opt_out( array() );

		$this->assertSame( self::LOADER_TAG, $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-loader' ) );
	}

	public function test_fetch_priority_is_set_by_the_tag_processor_before_wordpress_6_9(): void {
		$this->opt_out( array(), 'low' );

		$tag = $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-panel' );

		$this->assertStringContainsString( 'fetchpriority="low"', $tag );
		$this->assertSame( 1, substr_count( $tag, 'fetchpriority' ) );
	}

	public function test_fetch_priority_is_left_to_wordpress_from_6_9(): void {
		$GLOBALS['wp_version'] = '6.9.1';
		$this->opt_out( array(), 'low' );

		$this->assertSame( self::LOADER_TAG, $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-loader' ) );
	}

	public function test_opt_out_still_applies_from_6_9(): void {
		$GLOBALS['wp_version'] = '6.9';
		$this->opt_out( array( 'wp-rocket' ), 'low' );

		$tag = $this->attributes()->filter_tag( self::LOADER_TAG, 'kotlinskidev-a11y-loader' );

		$this->assertStringContainsString( 'nowprocket', $tag );
		$this->assertStringNotContainsString( 'fetchpriority', $tag );
	}

	public function test_inline_attributes_apply_to_our_script_ids_only(): void {
		$this->opt_out( array( 'cloudflare', 'asset-cleanup' ) );

		$this->assertSame(
			array(
				'id'              => 'kotlinskidev-a11y-bootstrap',
				'data-cfasync'    => 'false',
				'data-wpacu-skip' => true,
			),
			$this->attributes()->filter_inline( array( 'id' => 'kotlinskidev-a11y-bootstrap' ) )
		);
		$this->assertArrayHasKey( 'data-cfasync', $this->attributes()->filter_inline( array( 'id' => 'kotlinskidev-a11y-loader-js-before' ) ) );
		$this->assertSame( array( 'id' => 'jquery-js-after' ), $this->attributes()->filter_inline( array( 'id' => 'jquery-js-after' ) ) );
		$this->assertSame( array(), $this->attributes()->filter_inline( array() ) );
		$this->assertSame( 'x', $this->attributes()->filter_inline( 'x' ) );
	}

	public function test_native_fetch_priority_detection(): void {
		$GLOBALS['wp_version'] = '6.4.3';
		$this->assertFalse( ScriptAttributes::supports_native_fetch_priority() );

		$GLOBALS['wp_version'] = '6.9-beta1';
		$this->assertFalse( ScriptAttributes::supports_native_fetch_priority() );

		$GLOBALS['wp_version'] = '7.0';
		$this->assertTrue( ScriptAttributes::supports_native_fetch_priority() );
	}
}
