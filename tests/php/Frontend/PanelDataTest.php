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
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
	}

	public function test_payload_has_every_panel_data_key(): void {
		$payload = ( new PanelData() )->payload( 'en_US' );

		$this->assertSame(
			array( 'hash', 'locale', 'features', 'profiles', 'widget', 'theme', 'tokens', 'hideToolbar', 'statementUrl', 'customCss', 'strings' ),
			array_keys( $payload )
		);
		$this->assertSame( 'en_US', $payload['locale'] );
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
		$json  = $panel->encode( array( 'hash' => 'abc', 'text' => '<b>&"\'' ) );

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
			'statement'     => array( 'pageId' => 9, 'url' => 'https://example.test/fallback' ),
		);
		Functions\when( 'get_permalink' )->justReturn( 'https://example.test/statement/' );

		$this->assertSame( 'https://example.test/statement/', ( new PanelData() )->payload( 'en_US' )['statementUrl'] );
	}
}
