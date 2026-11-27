<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Frontend;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Frontend\PanelData;
use Kotlinskidev\A11y\Tests\TestCase;

final class PanelDataTest extends TestCase {

	private array $options = array();

	protected function setUp(): void {
		parent::setUp();

		$this->options = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'switch_to_locale' )->justReturn( false );
		Functions\when( 'restore_previous_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_permalink' )->justReturn( false );
		Functions\when( 'wp_json_encode' )->alias( static fn ( $value, int $flags = 0 ) => json_encode( $value, $flags ) );
		Functions\when( 'pll_current_language' )->justReturn( false );
		Functions\when( 'pll_languages_list' )->justReturn( array() );
		Functions\when( 'get_available_languages' )->justReturn( array() );
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_locale' )->justReturn( 'en_US' );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
	}

	public function test_payload_has_every_panel_data_key(): void {
		$payload = ( new PanelData() )->payload( 'en_US' );

		$this->assertSame(
			array( 'hash', 'locale', 'features', 'profiles', 'widget', 'theme', 'tokens', 'hideToolbar', 'statementUrl', 'customCss', 'strings', 'panel', 'layout', 'locales', 'icons' ),
			array_keys( $payload )
		);
		$this->assertSame( 'en_US', $payload['locale'] );
	}

	public function test_payload_carries_panel_layout_locales_and_icons(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 4,
			'panel'         => array(
				'columns'  => 2,
				'sections' => array( 'color' => false ),
			),
			'visibility'    => array( 'breakpoints' => array( 'mobile' => 600 ) ),
		);
		Functions\when( 'get_available_languages' )->justReturn( array( 'he_IL' ) );
		Functions\when( 'get_locale' )->justReturn( 'en_US' );

		$payload = ( new PanelData() )->payload( 'en_US' );

		$this->assertSame( 2, $payload['panel']['columns'] );
		$this->assertFalse( $payload['panel']['sections']['color'] );
		$this->assertTrue( $payload['panel']['sections']['skip'] );
		$this->assertTrue( $payload['panel']['languageSwitcher'] );
		$this->assertSame( '(max-width:600px)', $payload['layout']['sheetQuery'] );
		$this->assertSame( array( 'en_US', 'he_IL' ), array_column( $payload['locales'], 'locale' ) );
		$this->assertSame( array( false, true ), array_column( $payload['locales'], 'rtl' ) );
		$this->assertArrayHasKey( 'label', $payload['locales'][0] );
		$this->assertEquals( new \stdClass(), $payload['icons'] );
	}

	public function test_payload_carries_panel_appearance_defaults_matching_current_behaviour(): void {
		$panel = ( new PanelData() )->payload( 'en_US' )['panel'];

		$this->assertSame( 'choose', $panel['languageMode'] );
		$this->assertFalse( $panel['backdrop'] );
		$this->assertTrue( $panel['closeOnBackdrop'] );
		$this->assertSame( 'slide', $panel['animation'] );
		$this->assertSame( 220, $panel['animationMs'] );
		$this->assertSame( 448, $panel['width'] );
		$this->assertSame( 'auto', $panel['side'] );
		$this->assertSame( 0, $panel['offset'] );
	}

	public function test_payload_carries_credit_from_the_plugin_header(): void {
		Functions\when( 'get_file_data' )->justReturn(
			array(
				'name' => 'Jane Doe',
				'url'  => 'https://example.test/jane',
			)
		);

		$payload = ( new PanelData() )->payload( 'en_US' );

		$this->assertSame(
			array(
				'name' => 'Jane Doe',
				'url'  => 'https://example.test/jane',
			),
			$payload['panel']['credit']
		);
		$this->assertArrayHasKey( 'credit', $payload['strings'] );
	}

	public function test_credit_is_omitted_when_disabled_or_header_incomplete(): void {
		Functions\when( 'get_file_data' )->justReturn(
			array(
				'name' => 'Jane Doe',
				'url'  => 'https://example.test/jane',
			)
		);
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 4,
			'panel'         => array( 'credit' => false ),
		);

		$this->assertArrayNotHasKey( 'credit', ( new PanelData() )->payload( 'en_US' )['panel'] );

		$this->options = array();
		Functions\when( 'get_file_data' )->justReturn(
			array(
				'name' => 'Jane Doe',
				'url'  => '',
			)
		);

		$this->assertArrayNotHasKey( 'credit', ( new PanelData() )->payload( 'en_US' )['panel'] );
	}

	public function test_locales_with_identical_labels_are_deduplicated(): void {
		if ( ! class_exists( \Locale::class ) ) {
			$this->markTestSkipped( 'intl missing' );
		}

		Functions\when( 'pll_current_language' )->justReturn( 'pl_PL' );
		Functions\when( 'get_available_languages' )->justReturn( array( 'pl', 'en_GB' ) );

		$payload = ( new PanelData() )->payload( 'pl_PL' );

		$this->assertSame( array( 'pl_PL', 'en_US' ), array_column( $payload['locales'], 'locale' ) );
	}

	public function test_panel_order_defaults_to_built_in_order_and_follows_saved_order(): void {
		$default = ( new PanelData() )->payload( 'en_US' );

		$this->assertSame( \Kotlinskidev\A11y\Settings\Schema::feature_keys(), $default['panel']['order'] );

		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 5,
			'panel'         => array( 'order' => array( 'highContrast', 'bogus', 'biggerText', 'biggerText' ) ),
		);
		\Kotlinskidev\A11y\Settings\Repository::flush();

		$this->assertSame( array( 'highContrast', 'biggerText' ), ( new PanelData() )->payload( 'en_US' )['panel']['order'] );
	}

	public function test_hash_changes_when_panel_layout_or_locales_change(): void {
		$before = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->options['kotlinskidev_a11y_settings'] = array( 'panel' => array( 'columns' => 2 ) );
		\Kotlinskidev\A11y\Settings\Repository::flush();
		$columns = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->options['kotlinskidev_a11y_settings'] = array( 'visibility' => array( 'breakpoints' => array( 'mobile' => 500 ) ) );
		\Kotlinskidev\A11y\Settings\Repository::flush();
		$sheet = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->options['kotlinskidev_a11y_settings'] = array();
		\Kotlinskidev\A11y\Settings\Repository::flush();
		Functions\when( 'get_available_languages' )->justReturn( array( 'de_DE' ) );
		$locales = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->assertCount( 4, array_unique( array( $before, $columns, $sheet, $locales ) ) );
	}

	public function test_payload_has_full_strings_with_label_overrides(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 2,
			'labels'        => array( 'en_US' => array( 'open' => 'Accessibility tools' ) ),
		);

		$strings = ( new PanelData() )->payload( 'en_US' )['strings'];

		$this->assertSame( 'Accessibility tools', $strings['open'] );
		$this->assertArrayHasKey( 'loadError', $strings );
		$this->assertArrayHasKey( 'features.biggerText.label', $strings );
	}

	public function test_hash_is_twelve_hex_chars_and_stable(): void {
		$first  = ( new PanelData() )->payload( 'en_US' )['hash'];
		$second = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->assertMatchesRegularExpression( '/^[0-9a-f]{12}$/', $first );
		$this->assertSame( $first, $second );
	}

	public function test_hash_changes_with_labels(): void {
		$before = ( new PanelData() )->payload( 'en_US' )['hash'];

		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 2,
			'labels'        => array( 'en_US' => array( 'open' => 'Changed' ) ),
		);
		\Kotlinskidev\A11y\Settings\Repository::flush();

		$this->assertNotSame( $before, ( new PanelData() )->payload( 'en_US' )['hash'] );
	}

	public function test_hash_changes_with_locale(): void {
		$panel = new PanelData();

		$this->assertNotSame( $panel->payload( 'en_US' )['hash'], $panel->payload( 'pl_PL' )['hash'] );
	}

	public function test_hash_depends_on_version_and_schema(): void {
		$panel = new PanelData();
		$json  = $panel->encode( $panel->payload( 'en_US' ) );

		$this->assertSame( substr( sha1( $json . KOTLINSKIDEV_A11Y_VERSION . \Kotlinskidev\A11y\Settings\Schema::VERSION ), 0, 12 ), $panel->hash( $json ) );
		$this->assertNotSame( $panel->hash( $json ), substr( sha1( $json ), 0, 12 ) );
	}

	public function test_encode_omits_hash_and_escapes_markup(): void {
		$panel = new PanelData();
		$json  = $panel->encode(
			array(
				'hash' => 'abc',
				'text' => '<b>&"\'',
			)
		);

		$this->assertStringNotContainsString( 'hash', $json );
		$this->assertStringNotContainsString( '<', $json );
		$this->assertStringNotContainsString( '&', $json );
	}

	public function test_document_keeps_hash(): void {
		$panel = new PanelData();

		$this->assertStringContainsString( '"hash":"abc"', $panel->document( array( 'hash' => 'abc' ) ) );
	}

	public function test_statement_url_prefers_page_permalink(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => 2,
			'statement'     => array(
				'pageId' => 9,
				'url'    => 'https://example.test/fallback',
			),
		);
		Functions\when( 'get_permalink' )->justReturn( 'https://example.test/statement/' );

		$this->assertSame( 'https://example.test/statement/', ( new PanelData() )->payload( 'en_US' )['statementUrl'] );
	}
}
