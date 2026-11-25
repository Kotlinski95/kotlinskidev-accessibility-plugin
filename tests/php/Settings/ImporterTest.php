<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Settings;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Settings\Importer;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use Kotlinskidev\A11y\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use WP_Error;

require_once __DIR__ . '/../Rest/WpRestStubs.php';

final class ImporterTest extends TestCase {

	private array $options = array();

	protected function setUp(): void {
		parent::setUp();

		$this->options = array();

		Functions\when( '__' )->returnArg( 1 );
		Functions\when( 'get_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->options[ $name ] ?? $fallback );
		Functions\when( 'update_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->options[ $name ] = $value;

				return true;
			}
		);
	}

	private function fixture( string $name ): array {
		return (array) json_decode( (string) file_get_contents( __DIR__ . '/../../fixtures/settings/' . $name . '.json' ), true );
	}

	private function stored(): array {
		return $this->options['kotlinskidev_a11y_settings'] ?? array();
	}

	public static function released_versions(): array {
		return array(
			'0.1.1' => array( '0.1.1', 1 ),
			'0.1.2' => array( '0.1.2', 1 ),
			'0.1.3' => array( '0.1.3', 1 ),
			'0.2.0' => array( '0.2.0', 2 ),
			'0.3.0' => array( '0.3.0', 3 ),
			'0.4.0' => array( '0.4.0', 4 ),
		);
	}

	#[DataProvider( 'released_versions' )]
	public function test_legacy_export_from_each_tag_imports_with_its_values( string $version, int $schema_version ): void {
		$body = $this->fixture( $version );

		$this->assertSame( $schema_version, $body['schemaVersion'] );

		$result = ( new Importer() )->run( $body, false );

		$this->assertIsArray( $result );
		$result = $result['settings'];
		$this->assertSame( Schema::VERSION, $result['schemaVersion'] );
		$this->assertSame( 'cookie', $result['storage']['mode'] );
		$this->assertSame( 30, $result['storage']['ttlDays'] );
		$this->assertSame( 'top-left', $result['widget']['position']['mobile'] );
		$this->assertSame( 'Ctrl+Shift+U', $result['shortcut']['combo'] );
		$this->assertSame( array( 'en_US' => array( 'open' => 'Open the tools' ) ), $result['labels'] );
		$this->assertSame( Schema::VERSION, $this->stored()['schemaVersion'] );
		$this->assertSame( 'cookie', $this->stored()['storage']['mode'] );
		$this->assertArrayNotHasKey( 'key', $this->stored()['storage'] );
	}

	public function test_v1_legacy_load_strategy_is_migrated_before_sanitizing(): void {
		$result = ( new Importer() )->run( $this->fixture( '0.1.1' ), false );

		$settings = $result['settings'];

		$this->assertSame( 'custom', $settings['performance']['preset'] );
		$this->assertSame( 'idle', $settings['performance']['strategy'] );
		$this->assertArrayNotHasKey( 'loadStrategy', $settings['advanced'] );
	}

	public function test_bare_tree_with_version_one_is_migrated(): void {
		$result = ( new Importer() )->run(
			array(
				'schemaVersion' => 1,
				'advanced'      => array( 'loadStrategy' => 'defer' ),
			),
			true
		);

		$this->assertSame( 'defer', $result['settings']['performance']['strategy'] );
		$this->assertSame( 1, $result['from']['schemaVersion'] );
		$this->assertNull( $result['from']['plugin'] );
	}

	public function test_bare_tree_without_a_version_is_the_current_schema_and_not_migrated(): void {
		$this->options['kotlinskidev_a11y_settings'] = array( 'schemaVersion' => Schema::VERSION );
		$tree                                        = ( new Repository() )->get();

		$tree['performance']['preset']   = 'custom';
		$tree['performance']['strategy'] = 'defer';
		unset( $tree['schemaVersion'] );

		$result = ( new Importer() )->run( $tree, true );

		$this->assertSame( Schema::VERSION, $result['from']['schemaVersion'] );
		$this->assertSame( 'defer', $result['settings']['performance']['strategy'] );
		$this->assertSame( array( 'performance.preset', 'performance.strategy' ), array_column( $result['changes'], 'path' ) );
	}

	public function test_a_non_envelope_body_with_a_string_version_stays_invalid(): void {
		$result = ( new Importer() )->run( array( 'schemaVersion' => '5' ), false );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_real_import_with_a_conflicting_locked_path_is_409_and_writes_nothing(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );

		$result = ( new Importer() )->run(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'cookie' ),
			),
			false
		);

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_locked', $result->code );
		$this->assertSame( 409, $result->data['status'] );
		$this->assertSame( array( 'storage.mode' ), $result->data['paths'] );
		$this->assertSame( array(), $this->options );
	}

	public function test_real_import_reports_locked_and_dropped_when_values_match_the_lock(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );

		$result = ( new Importer() )->run(
			array(
				'schemaVersion' => Schema::VERSION,
				'bogus'         => 1,
				'storage'       => array( 'mode' => 'none' ),
			),
			false
		);

		$this->assertSame( array( 'storage.mode' ), $result['locked'] );
		$this->assertSame( array( 'bogus' ), $result['dropped'] );
		$this->assertSame( array( 'schemaVersion' => Schema::VERSION ), $this->stored() );
	}

	public function test_dropped_entries_are_capped(): void {
		$body = array( 'schemaVersion' => Schema::VERSION );

		for ( $i = 0; $i < Importer::MAX_DROPPED + 50; $i++ ) {
			$body[ 'extra' . $i ] = $i;
		}

		$result = ( new Importer() )->run( $body, true );

		$this->assertCount( Importer::MAX_DROPPED, $result['dropped'] );
	}

	public function test_exported_envelope_round_trips(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => Schema::VERSION,
			'tokens'        => array( 'radius' => '4px' ),
		);

		$importer = new Importer();
		$envelope = $importer->envelope();

		$this->assertSame( Importer::FORMAT, $envelope['format'] );
		$this->assertSame( 1, $envelope['formatVersion'] );
		$this->assertSame( KOTLINSKIDEV_A11Y_VERSION, $envelope['plugin'] );
		$this->assertSame( Schema::VERSION, $envelope['schemaVersion'] );
		$this->assertSame( 'site', $envelope['scope'] );
		$this->assertMatchesRegularExpression( '/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', $envelope['exportedAt'] );
		$this->assertSame( array( 'format', 'formatVersion', 'plugin', 'schemaVersion', 'scope', 'exportedAt', 'settings' ), array_keys( $envelope ) );
		$this->assertSame( '4px', $envelope['settings']['tokens']['radius'] );

		unset( $this->options['kotlinskidev_a11y_settings'] );
		Repository::flush();

		$result = $importer->run( $envelope, false );

		$this->assertSame( $envelope['settings'], $result['settings'] );
		$this->assertSame( array( 'schemaVersion', 'tokens' ), array_keys( $this->stored() ) );
	}

	public function test_envelope_omits_locked_paths(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.mode' => 'none' ) );

		$settings = ( new Importer() )->envelope()['settings'];

		$this->assertArrayNotHasKey( 'mode', $settings['storage'] );
		$this->assertArrayHasKey( 'ttlDays', $settings['storage'] );
	}

	public function test_newer_schema_is_rejected_with_409(): void {
		$cases = array(
			array( 'schemaVersion' => Schema::VERSION + 1 ),
			array(
				'format'        => Importer::FORMAT,
				'formatVersion' => 1,
				'schemaVersion' => Schema::VERSION + 1,
				'settings'      => array(),
			),
			array(
				'format'        => Importer::FORMAT,
				'formatVersion' => 2,
				'schemaVersion' => Schema::VERSION,
				'settings'      => array(),
			),
		);

		foreach ( $cases as $body ) {
			$result = ( new Importer() )->run( $body, false );

			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'kotlinskidev_a11y_newer_schema', $result->code );
			$this->assertSame( 409, $result->data['status'] );
			$this->assertSame( 'This file was made by a newer version of the plugin. Update the plugin first.', $result->message );
		}

		$this->assertSame( array(), $this->options );
	}

	public function test_wrong_scope_is_rejected_with_400(): void {
		$envelope = array(
			'format'        => Importer::FORMAT,
			'formatVersion' => 1,
			'schemaVersion' => Schema::VERSION,
			'scope'         => 'network',
			'settings'      => array(),
		);

		$into_site = ( new Importer() )->run( $envelope, false );
		$into_net  = ( new Importer() )->run( array_merge( $envelope, array( 'scope' => 'site' ) ), false, 'network' );

		foreach ( array( $into_site, $into_net ) as $result ) {
			$this->assertInstanceOf( WP_Error::class, $result );
			$this->assertSame( 'kotlinskidev_a11y_wrong_scope', $result->code );
			$this->assertSame( 400, $result->data['status'] );
		}
	}

	public static function invalid_bodies(): array {
		return array(
			'non integer version'             => array( array( 'schemaVersion' => '4' ) ),
			'zero version'                    => array( array( 'schemaVersion' => 0 ) ),
			'envelope without tree'           => array(
				array(
					'format'        => Importer::FORMAT,
					'formatVersion' => 1,
					'schemaVersion' => 5,
				),
			),
			'envelope wrong format'           => array(
				array(
					'format'        => 'other',
					'formatVersion' => 1,
					'schemaVersion' => 5,
					'settings'      => array(),
				),
			),
			'envelope without format version' => array(
				array(
					'format'        => Importer::FORMAT,
					'schemaVersion' => 5,
					'settings'      => array(),
				),
			),
			'envelope unknown scope'          => array(
				array(
					'format'        => Importer::FORMAT,
					'formatVersion' => 1,
					'schemaVersion' => 5,
					'scope'         => 'other',
					'settings'      => array(),
				),
			),
		);
	}

	#[DataProvider( 'invalid_bodies' )]
	public function test_anything_else_is_invalid_body( array $body ): void {
		$result = ( new Importer() )->run( $body, false );

		$this->assertInstanceOf( WP_Error::class, $result );
		$this->assertSame( 'kotlinskidev_a11y_invalid_body', $result->code );
		$this->assertSame( 400, $result->data['status'] );
	}

	public function test_dry_run_reports_dropped_adjusted_and_locked_and_saves_nothing(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'storage.ttlDays' => 90 ) );

		$result = ( new Importer() )->run(
			array(
				'schemaVersion' => Schema::VERSION,
				'bogus'         => 1,
				'storage'       => array(
					'mode'    => 'weird',
					'ttlDays' => 10,
					'nope'    => true,
				),
				'tokens'        => array( 'radius' => '4px' ),
			),
			true
		);

		$this->assertSame( array( 'bogus', 'storage.nope' ), $result['dropped'] );
		$this->assertSame( array( 'storage.mode' ), $result['adjusted'] );
		$this->assertSame( array( 'storage.ttlDays' ), $result['locked'] );
		$this->assertSame( 90, $result['settings']['storage']['ttlDays'] );
		$this->assertSame( array( 'tokens.radius' ), array_column( $result['changes'], 'path' ) );
		$this->assertSame( array(), $this->options );
	}

	public function test_dry_run_changes_show_the_version_line_data(): void {
		$envelope = array(
			'format'        => Importer::FORMAT,
			'formatVersion' => 1,
			'plugin'        => '0.3.0',
			'schemaVersion' => 3,
			'scope'         => 'site',
			'settings'      => array( 'storage' => array( 'mode' => 'none' ) ),
		);

		$result = ( new Importer() )->run( $envelope, true );

		$this->assertSame(
			array(
				'plugin'        => '0.3.0',
				'schemaVersion' => 3,
			),
			$result['from']
		);
		$this->assertSame( array( 'storage.mode' ), array_column( $result['changes'], 'path' ) );
		$this->assertSame( array( 'local', 'none', 'site' ), array( $result['changes'][0]['from'], $result['changes'][0]['to'], $result['changes'][0]['source'] ) );
	}

	public function test_import_replaces_the_sites_stored_values(): void {
		$this->options['kotlinskidev_a11y_settings'] = array(
			'schemaVersion' => Schema::VERSION,
			'tokens'        => array( 'radius' => '4px' ),
		);

		( new Importer() )->run(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'none' ),
			),
			false
		);

		$this->assertSame(
			array(
				'schemaVersion' => Schema::VERSION,
				'storage'       => array( 'mode' => 'none' ),
			),
			$this->stored()
		);
	}
}
