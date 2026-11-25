<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Functions;
use PHPUnit\Framework\Attributes\DataProvider;
use Kotlinskidev\A11y\Frontend\Assets;
use Kotlinskidev\A11y\Frontend\InlineConfig;
use Kotlinskidev\A11y\Frontend\Manifest;
use Kotlinskidev\A11y\Frontend\PanelData;
use Kotlinskidev\A11y\Frontend\Visibility;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Tests\TestCase;

final class PayloadGoldenTest extends TestCase {

	use FrontendEnvironment;

	private const GOLDEN = __DIR__ . '/../../fixtures/golden/';

	private array $printed = array();

	protected function setUp(): void {
		parent::setUp();
		Manifest::flush();
		$this->frontend_environment();
		$GLOBALS['wp_version'] = '6.8';
		$this->printed         = array();

		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Functions\when( 'pll_current_language' )->justReturn( false );
		Functions\when( 'pll_languages_list' )->justReturn( array() );
		Functions\when( 'get_available_languages' )->justReturn( array() );
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'wp_register_style' )->justReturn( true );
		Functions\when( 'wp_enqueue_style' )->justReturn( null );
		Functions\when( 'wp_add_inline_style' )->justReturn( true );
		Functions\when( 'wp_kses' )->alias( static fn ( string $html ): string => $html );
		Functions\when( 'wp_print_inline_script_tag' )->alias(
			function ( string $code ): void {
				$this->printed[] = $code;
			}
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['wp_version'] );
		Manifest::flush();
		parent::tearDown();
	}

	public static function scenarios(): array {
		return array(
			'default' => array( 'default', array() ),
			'full-v4' => array( 'full-v4', (array) json_decode( (string) file_get_contents( __DIR__ . '/../../fixtures/settings/full-v4.json' ), true ) ),
		);
	}

	private function golden( string $name ): string {
		return (string) file_get_contents( self::GOLDEN . $name );
	}

	private function apply( array $stored ): void {
		$this->store_settings( $stored );
		Visibility::reset_request_state();
		Repository::flush();
	}

	#[DataProvider( 'scenarios' )]
	public function test_inline_config_is_byte_identical( string $name, array $stored ): void {
		$this->apply( $stored );

		$this->assertSame( $this->golden( "inline-$name.txt" ), ( new InlineConfig() )->script( ( new Repository() )->get() ) );
	}

	#[DataProvider( 'scenarios' )]
	public function test_panel_data_is_byte_identical( string $name, array $stored ): void {
		$this->apply( $stored );
		$panel = new PanelData();

		$this->assertSame( $this->golden( "panel-data-$name.json" ), $panel->encode( $panel->payload( 'en_US' ) ) );
	}

	#[DataProvider( 'scenarios' )]
	public function test_bootstrap_script_is_byte_identical( string $name, array $stored ): void {
		$this->apply( $stored );

		ob_start();
		( new Assets( new Visibility() ) )->print_head();
		ob_end_clean();

		$this->assertSame( $this->golden( "bootstrap-$name.txt" ), $this->printed[0] );
	}

	#[DataProvider( 'scenarios' )]
	public function test_tokens_css_is_byte_identical( string $name, array $stored ): void {
		$this->apply( $stored );

		$this->assertSame( $this->golden( "tokens-$name.css" ), ( new Assets( new Visibility() ) )->tokens_css( ( new Repository() )->get() ) );
	}
}
