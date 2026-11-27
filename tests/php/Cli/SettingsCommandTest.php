<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Cli;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Cli\SettingsCommand;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use WP_CLI;

final class SettingsCommandTest extends CliTestCase {

	private string $directory   = '';
	private array $site_options = array();

	protected function setUp(): void {
		parent::setUp();

		$this->directory = sys_get_temp_dir() . '/ka11y-cli-' . bin2hex( random_bytes( 4 ) );
		mkdir( $this->directory );
		$this->site_options = array();
		Functions\when( 'is_admin' )->justReturn( false );
		Functions\when( 'get_site_option' )->alias( fn ( string $name, mixed $fallback = false ): mixed => $this->site_options[ $name ] ?? $fallback );
		Functions\when( 'update_site_option' )->alias(
			function ( string $name, mixed $value ): bool {
				$this->site_options[ $name ] = $value;

				return true;
			}
		);
		Functions\when( 'delete_site_option' )->alias(
			function ( string $name ): bool {
				unset( $this->site_options[ $name ] );

				return true;
			}
		);
		Functions\when( 'do_action' )->justReturn( null );
	}

	protected function tearDown(): void {
		foreach ( glob( $this->directory . '/*' ) ?: array() as $file ) {
			unlink( $file );
		}

		rmdir( $this->directory );
		parent::tearDown();
	}

	private function command(): SettingsCommand {
		return new SettingsCommand();
	}

	private function stored_tree(): array {
		$tree = $this->stored[ Repository::OPTION ] ?? array();

		return is_array( $tree ) ? $tree : array();
	}

	private function write( string $name, string $content ): string {
		$path = $this->directory . '/' . $name;

		file_put_contents( $path, $content );

		return $path;
	}

	public function test_registers_every_subcommand_with_a_synopsis(): void {
		SettingsCommand::register();

		$this->assertSame(
			array( 'ka11y settings get', 'ka11y settings set', 'ka11y settings import', 'ka11y settings export', 'ka11y settings reset' ),
			array_keys( WP_CLI::$commands )
		);

		foreach ( WP_CLI::$commands as $registration ) {
			$this->assertNotEmpty( $registration['args']['synopsis'] );
			$this->assertNotEmpty( $registration['args']['shortdesc'] );
		}
	}

	public function test_get_prints_a_leaf_value(): void {
		$this->command()->get( array( 'widget.size' ), array( 'format' => 'json' ) );

		$this->assertSame(
			array(
				'value'  => 'md',
				'format' => 'json',
			),
			WP_CLI::$printed[0]
		);
	}

	public function test_get_prints_a_prefix_subtree(): void {
		$this->command()->get( array( 'widget.position' ), array() );

		$this->assertSame(
			array(
				'widget' => array(
					'position' => array(
						'desktop' => 'bottom-right',
						'tablet'  => 'bottom-right',
						'mobile'  => 'bottom-right',
					),
				),
			),
			WP_CLI::$printed[0]['value']
		);
	}

	public function test_get_without_path_prints_the_whole_tree(): void {
		$this->command()->get( array(), array() );

		$this->assertSame( Schema::VERSION, WP_CLI::$printed[0]['value']['schemaVersion'] );
	}

	public function test_get_reads_the_stored_layer(): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'widget'        => array( 'size' => 'lg' ),
		);

		$this->command()->get( array( 'widget.size' ), array( 'layer' => 'stored' ) );

		$this->assertSame( 'lg', WP_CLI::$printed[0]['value'] );
		$this->assertStringContainsString( 'no value', $this->failure_of( fn () => $this->command()->get( array( 'widget.launcher' ), array( 'layer' => 'stored' ) ) ) );
	}

	public function test_get_rejects_a_bad_layer_and_a_bad_format(): void {
		$this->assertStringContainsString( 'Invalid layer', $this->failure_of( fn () => $this->command()->get( array(), array( 'layer' => 'nope' ) ) ) );
		$this->assertStringContainsString( 'Invalid format', $this->failure_of( fn () => $this->command()->get( array(), array( 'format' => 'xml' ) ) ) );
	}

	public function test_network_flag_is_refused_on_single_site(): void {
		$this->assertStringContainsString( 'multisite', $this->failure_of( fn () => $this->command()->get( array(), array( 'network' => true ) ) ) );
		$this->assertStringContainsString( 'multisite', $this->failure_of( fn () => $this->command()->set( array( 'widget.size', 'lg' ), array( 'network' => true ) ) ) );
		$this->assertStringContainsString( 'multisite', $this->failure_of( fn () => $this->command()->import( array( 'x.json' ), array( 'network' => true ) ) ) );
		$this->assertStringContainsString( 'multisite', $this->failure_of( fn () => $this->command()->export( array(), array( 'network' => true ) ) ) );
		$this->assertStringContainsString(
			'multisite',
			$this->failure_of(
				fn () => $this->command()->reset(
					array(),
					array(
						'network' => true,
						'yes'     => true,
					)
				)
			)
		);
		$this->assertSame( array(), $this->site_options );
	}

	private function multisite(): void {
		Functions\when( 'is_multisite' )->justReturn( true );
	}

	public function test_network_set_writes_the_network_option_and_leaves_the_site_option(): void {
		$this->multisite();

		$this->command()->set(
			array( 'storage.mode', 'none' ),
			array(
				'network' => true,
				'format'  => 'json',
			)
		);

		$this->assertSame( array( 'storage' => array( 'mode' => 'none' ) ), $this->site_options[ Repository::NETWORK_OPTION ]['settings'] );
		$this->assertSame( array(), $this->stored );
		$this->assertSame( 'storage.mode', WP_CLI::$tables[0]['items'][0]['path'] );
	}

	public function test_network_set_dry_run_saves_nothing(): void {
		$this->multisite();

		$this->command()->set(
			array( 'storage.mode', 'none' ),
			array(
				'network' => true,
				'dry-run' => true,
			)
		);

		$this->assertSame( array(), $this->site_options );
		$this->assertSame( array(), $this->stored );
	}

	public function test_network_set_validates_the_value(): void {
		$this->multisite();

		$this->assertStringContainsString( 'one of', $this->failure_of( fn () => $this->command()->set( array( 'storage.mode', 'nope' ), array( 'network' => true ) ) ) );
		$this->assertSame( array(), $this->site_options );
	}

	public function test_network_get_reads_each_layer(): void {
		$this->multisite();
		$this->site_options[ Repository::NETWORK_OPTION ] = array( 'settings' => array( 'widget' => array( 'size' => 'lg' ) ) );

		$this->command()->get( array( 'widget.size' ), array( 'network' => true ) );
		$this->command()->get(
			array( 'widget.size' ),
			array(
				'network' => true,
				'layer'   => 'defaults',
			)
		);
		$this->command()->get(
			array( 'widget.size' ),
			array(
				'network' => true,
				'layer'   => 'stored',
			)
		);

		$this->assertSame( array( 'lg', 'md', 'lg' ), array_column( WP_CLI::$printed, 'value' ) );
		$this->assertStringContainsString(
			'no value',
			$this->failure_of(
				fn () => $this->command()->get(
					array( 'widget.launcher' ),
					array(
						'network' => true,
						'layer'   => 'stored',
					)
				)
			)
		);
	}

	public function test_network_export_has_network_scope_and_import_requires_it(): void {
		$this->multisite();
		$this->site_options[ Repository::NETWORK_OPTION ] = array(
			'settings' => array( 'widget' => array( 'size' => 'lg' ) ),
			'locked'   => array( 'widget.size' ),
		);
		$file = $this->directory . '/network.json';

		$this->command()->export(
			array(),
			array(
				'network' => true,
				'file'    => $file,
			)
		);

		$envelope = (array) json_decode( (string) file_get_contents( $file ), true );

		$this->assertSame( 'network', $envelope['scope'] );
		$this->assertSame( array( 'widget.size' ), $envelope['locked'] );

		$site = $this->write( 'site.json', (string) json_encode( array_merge( $envelope, array( 'scope' => 'site' ) ) ) );

		$this->assertStringContainsString(
			'different settings scope',
			$this->failure_of(
				fn () => $this->command()->import(
					array( $site ),
					array(
						'network' => true,
						'yes'     => true,
					)
				)
			)
		);

		unset( $this->site_options[ Repository::NETWORK_OPTION ] );
		Repository::flush();
		$this->command()->import(
			array( $file ),
			array(
				'network' => true,
				'yes'     => true,
			)
		);

		$this->assertSame( 'lg', $this->site_options[ Repository::NETWORK_OPTION ]['settings']['widget']['size'] );
		$this->assertSame( array( 'widget.size' ), $this->site_options[ Repository::NETWORK_OPTION ]['locked'] );
	}

	public function test_network_reset_clears_the_network_option(): void {
		$this->multisite();
		$this->site_options[ Repository::NETWORK_OPTION ] = array( 'settings' => array( 'widget' => array( 'size' => 'lg' ) ) );

		$this->command()->reset(
			array(),
			array(
				'network' => true,
				'yes'     => true,
			)
		);

		$this->assertArrayNotHasKey( Repository::NETWORK_OPTION, $this->site_options );
	}

	public static function bad_paths(): array {
		return array(
			'pattern'   => array( 'widget..size', 'Invalid setting path' ),
			'leading'   => array( '1widget', 'Invalid setting path' ),
			'injection' => array( 'widget.size; drop', 'Invalid setting path' ),
			'too long'  => array( str_repeat( 'a', 201 ), 'Invalid setting path' ),
			'unknown'   => array( 'nothing.here.at.all', 'Unknown setting path' ),
		);
	}

	#[DataProvider( 'bad_paths' )]
	public function test_get_and_set_reject_bad_paths( string $path, string $message ): void {
		$this->assertStringContainsString( $message, $this->failure_of( fn () => $this->command()->get( array( $path ), array() ) ) );
		$this->assertStringContainsString( $message, $this->failure_of( fn () => $this->command()->set( array( $path, 'x' ), array() ) ) );
		$this->assertSame( array(), $this->stored );
	}

	public function test_unknown_path_suggests_the_closest_match(): void {
		$this->assertStringContainsString( 'Did you mean widget.size?', $this->failure_of( fn () => $this->command()->set( array( 'widget.sze', 'lg' ), array() ) ) );
	}

	public function test_set_refuses_a_group_and_schema_version(): void {
		$this->assertStringContainsString( 'group', $this->failure_of( fn () => $this->command()->set( array( 'widget', 'lg' ), array() ) ) );
		$this->assertStringContainsString( 'cannot be changed', $this->failure_of( fn () => $this->command()->set( array( 'schemaVersion', '3' ), array() ) ) );
	}

	public function test_set_saves_and_reports_the_change(): void {
		$this->command()->set( array( 'widget.size', 'lg' ), array( 'format' => 'json' ) );

		$this->assertSame( 'lg', $this->stored_tree()['widget']['size'] );
		$this->assertSame( 'json', WP_CLI::$tables[0]['format'] );
		$this->assertSame(
			array(
				array(
					'path'   => 'widget.size',
					'before' => 'md',
					'after'  => 'lg',
				),
			),
			WP_CLI::$tables[0]['items']
		);
		$this->assertSame( array( 'Settings saved.' ), WP_CLI::$successes );
	}

	public function test_set_table_format_prints_text_values(): void {
		$this->command()->set( array( 'features.biggerText.enabled', 'off' ), array() );

		$this->assertSame(
			array(
				'path'   => 'features.biggerText.enabled',
				'before' => 'true',
				'after'  => 'false',
			),
			WP_CLI::$tables[0]['items'][0]
		);
	}

	public function test_set_dry_run_saves_nothing(): void {
		$this->command()->set( array( 'widget.size', 'lg' ), array( 'dry-run' => true ) );

		$this->assertSame( array(), $this->stored );
		$this->assertSame( array( 'Dry run: nothing was saved.' ), WP_CLI::$successes );
		$this->assertSame( 'widget.size', WP_CLI::$tables[0]['items'][0]['path'] );
	}

	public static function boolean_tokens(): array {
		return array(
			'true'  => array( 'true', true ),
			'one'   => array( '1', true ),
			'on'    => array( 'on', true ),
			'yes'   => array( 'YES', true ),
			'false' => array( 'false', false ),
			'zero'  => array( '0', false ),
			'off'   => array( 'off', false ),
			'no'    => array( 'no', false ),
		);
	}

	#[DataProvider( 'boolean_tokens' )]
	public function test_set_parses_boolean_tokens( string $token, bool $expected ): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'features'      => array( 'biggerText' => array( 'enabled' => ! $expected ) ),
		);

		$this->command()->set( array( 'features.biggerText.enabled', $token ), array() );

		$this->assertSame( $expected, $this->command_value( 'features.biggerText.enabled' ) );
	}

	private function command_value( string $path ): mixed {
		Repository::flush();
		$found = false;

		return Schema::read( ( new Repository() )->get(), $path, $found );
	}

	public function test_set_rejects_a_bad_boolean(): void {
		$this->assertStringContainsString( 'true, false', $this->failure_of( fn () => $this->command()->set( array( 'features.biggerText.enabled', 'maybe' ), array() ) ) );
	}

	public function test_set_integer_range_is_an_error_never_a_clamp(): void {
		$this->assertStringContainsString( 'between 0 and 500', $this->failure_of( fn () => $this->command()->set( array( 'widget.offsetX.desktop', '501' ), array() ) ) );
		$this->assertStringContainsString( 'whole number', $this->failure_of( fn () => $this->command()->set( array( 'widget.offsetX.desktop', '1.5' ), array() ) ) );
		$this->assertSame( array(), $this->stored );

		$this->command()->set( array( 'widget.offsetX.desktop', '40' ), array() );

		$this->assertSame( 40, $this->stored_tree()['widget']['offsetX']['desktop'] );
	}

	public function test_set_enum_must_be_listed(): void {
		$this->assertStringContainsString( 'one of: sm, md, lg', $this->failure_of( fn () => $this->command()->set( array( 'widget.size', 'xl' ), array() ) ) );
	}

	public function test_set_list_needs_json(): void {
		$this->assertStringContainsString( '--as-json', $this->failure_of( fn () => $this->command()->set( array( 'profiles.visionImpaired.features', 'a,b' ), array() ) ) );
	}

	public function test_set_json_value_is_validated_and_saved(): void {
		$this->command()->set( array( 'profiles.visionImpaired.features', '["biggerText"]' ), array( 'as-json' => true ) );

		$this->assertSame( array( 'biggerText' ), $this->stored_tree()['profiles']['visionImpaired']['features'] );
	}

	public function test_set_json_rejects_garbage_and_depth_and_size(): void {
		$this->assertStringContainsString( 'not valid JSON', $this->failure_of( fn () => $this->command()->set( array( 'profiles.visionImpaired.features', '[oops' ), array( 'as-json' => true ) ) ) );
		$this->assertStringContainsString( 'not valid JSON', $this->failure_of( fn () => $this->command()->set( array( 'profiles.visionImpaired.features', str_repeat( '[', 20 ) . str_repeat( ']', 20 ) ), array( 'as-json' => true ) ) ) );
		$this->assertStringContainsString( 'too large', $this->failure_of( fn () => $this->command()->set( array( 'profiles.visionImpaired.features', str_repeat( 'a', 65537 ) ), array( 'as-json' => true ) ) ) );
	}

	public function test_set_exits_with_the_sanitized_value_when_sanitizing_changes_it(): void {
		$message = $this->failure_of( fn () => $this->command()->set( array( 'profiles.visionImpaired.features', '["biggerText","bogus"]' ), array( 'as-json' => true ) ) );

		$this->assertStringContainsString( 'closest valid value is: ["biggerText"]', $message );
		$this->assertSame( array(), $this->stored );
	}

	public function test_set_warns_and_saves_for_css_values(): void {
		$path = array_key_first( array_filter( Schema::definitions(), static fn ( array $definition ): bool => 'css' === $definition['sanitize'] ) );

		$this->assertIsString( $path );

		$this->command()->set( array( $path, 'color: red; </style><b>x' ), array() );

		$this->assertNotEmpty( WP_CLI::$warnings );
		$this->assertNotSame( array(), $this->stored );
	}

	public function test_set_refuses_a_locked_path(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'widget.size' => 'sm' ) );

		$message = $this->failure_of( fn () => $this->command()->set( array( 'widget.size', 'lg' ), array() ) );

		$this->assertSame( 'Locked by site configuration: widget.size', $message );
		$this->assertSame( array(), $this->stored );
	}

	public function test_reset_refuses_a_locked_path(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'widget.size' => 'sm' ) );

		$this->assertStringContainsString( 'Locked by site configuration', $this->failure_of( fn () => $this->command()->reset( array( 'widget.size' ), array( 'yes' => true ) ) ) );
	}

	public function test_export_prints_the_versioned_envelope_without_locked_values(): void {
		$this->command()->export( array(), array() );

		$envelope = json_decode( WP_CLI::$lines[0], true );

		$this->assertSame( 'kotlinskidev-accessibility-settings', $envelope['format'] );
		$this->assertSame( 1, $envelope['formatVersion'] );
		$this->assertSame( Schema::VERSION, $envelope['schemaVersion'] );
		$this->assertSame( 'md', $envelope['settings']['widget']['size'] );
	}

	public function test_export_to_file_refuses_overwrite_without_force(): void {
		$path = $this->directory . '/out.json';

		$this->command()->export( array(), array( 'file' => $path ) );

		$this->assertSame( 'kotlinskidev-accessibility-settings', json_decode( (string) file_get_contents( $path ), true )['format'] );
		$this->assertStringContainsString( '--force', $this->failure_of( fn () => $this->command()->export( array(), array( 'file' => $path ) ) ) );

		$this->command()->export(
			array(),
			array(
				'file'  => $path,
				'force' => true,
			)
		);

		$this->assertCount( 2, WP_CLI::$successes );
	}

	public function test_export_refuses_wrappers_and_missing_directories(): void {
		$this->assertStringContainsString( 'local file paths', $this->failure_of( fn () => $this->command()->export( array(), array( 'file' => 'php://stdout' ) ) ) );
		$this->assertStringContainsString( 'directory does not exist', $this->failure_of( fn () => $this->command()->export( array(), array( 'file' => $this->directory . '/missing/out.json' ) ) ) );
	}

	public function test_export_to_file_never_contains_a_token(): void {
		$this->command()->export( array(), array( 'file' => $this->directory . '/out.json' ) );

		$this->assertStringNotContainsStringIgnoringCase( 'updateToken', (string) file_get_contents( $this->directory . '/out.json' ) );
	}

	public function test_import_applies_an_exported_envelope(): void {
		$envelope                               = ( new \Kotlinskidev\A11y\Settings\Importer() )->envelope();
		$envelope['settings']['widget']['size'] = 'lg';
		$file                                   = $this->write( 'in.json', (string) json_encode( $envelope ) );

		$this->command()->import( array( $file ), array( 'yes' => true ) );

		$this->assertSame( 'lg', $this->stored_tree()['widget']['size'] );
		$this->assertSame( 'Settings imported.', end( WP_CLI::$successes ) );
	}

	public function test_import_dry_run_saves_nothing_and_does_not_ask(): void {
		$file = $this->write( 'in.json', (string) json_encode( array( 'widget' => array( 'size' => 'lg' ) ) ) );

		$this->command()->import( array( $file ), array( 'dry-run' => true ) );

		$this->assertSame( array(), $this->stored );
		$this->assertSame( array(), WP_CLI::$confirmations );
		$this->assertSame( 'widget.size', WP_CLI::$tables[0]['items'][0]['path'] );
	}

	public function test_import_asks_for_confirmation_and_stops_when_declined(): void {
		$file            = $this->write( 'in.json', (string) json_encode( array( 'widget' => array( 'size' => 'lg' ) ) ) );
		WP_CLI::$decline = true;

		$this->failure_of( fn () => $this->command()->import( array( $file ), array() ) );

		$this->assertCount( 1, WP_CLI::$confirmations );
		$this->assertSame( array(), $this->stored );
	}

	public function test_import_warns_about_unknown_settings(): void {
		$file = $this->write(
			'in.json',
			(string) json_encode(
				array(
					'widget' => array( 'size' => 'lg' ),
					'bogus'  => 1,
				)
			)
		);

		$this->command()->import( array( $file ), array( 'dry-run' => true ) );

		$this->assertStringContainsString( 'bogus', WP_CLI::$warnings[0] );
	}

	public function test_import_rejects_a_newer_schema(): void {
		$file = $this->write( 'in.json', (string) json_encode( array( 'schemaVersion' => Schema::VERSION + 1 ) ) );

		$this->assertStringContainsString( 'newer version', $this->failure_of( fn () => $this->command()->import( array( $file ), array( 'yes' => true ) ) ) );
	}

	public function test_import_rejects_locked_conflicts(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locked_settings' )->andReturn( array( 'widget.size' => 'sm' ) );
		$file = $this->write( 'in.json', (string) json_encode( array( 'widget' => array( 'size' => 'lg' ) ) ) );

		$message = $this->failure_of( fn () => $this->command()->import( array( $file ), array( 'yes' => true ) ) );

		$this->assertStringContainsString( 'locked', $message );
		$this->assertStringContainsString( 'widget.size', $message );
		$this->assertSame( array(), $this->stored );
	}

	public function test_import_validates_the_file(): void {
		$this->assertStringContainsString( 'local file paths', $this->failure_of( fn () => $this->command()->import( array( 'https://example.test/x.json' ), array() ) ) );
		$this->assertStringContainsString( 'does not exist', $this->failure_of( fn () => $this->command()->import( array( $this->directory . '/missing.json' ), array() ) ) );
		$this->assertStringContainsString( 'does not exist', $this->failure_of( fn () => $this->command()->import( array( $this->directory ), array() ) ) );
		$this->assertStringContainsString( 'too large', $this->failure_of( fn () => $this->command()->import( array( $this->write( 'big.json', str_repeat( ' ', 262145 ) ) ), array() ) ) );
		$this->assertStringContainsString( 'JSON object', $this->failure_of( fn () => $this->command()->import( array( $this->write( 'bad.json', 'nope' ) ), array() ) ) );
	}

	public function test_reset_all_restores_defaults_after_confirmation(): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'widget'        => array( 'size' => 'lg' ),
		);

		$this->command()->reset( array(), array( 'yes' => true ) );

		$this->assertArrayNotHasKey( Repository::OPTION, $this->stored );
		$this->assertSame( 'widget.size', WP_CLI::$tables[0]['items'][0]['path'] );
		$this->assertSame( 'Settings reset.', end( WP_CLI::$successes ) );
	}

	public function test_reset_prefix_only_touches_that_prefix(): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'widget'        => array(
				'size'     => 'lg',
				'launcher' => 'inline',
			),
		);

		$this->command()->reset( array( 'widget.size' ), array( 'yes' => true ) );

		$this->assertSame( array( 'launcher' => 'inline' ), $this->stored_tree()['widget'] );
	}

	public function test_reset_dry_run_and_validation(): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'widget'        => array( 'size' => 'lg' ),
		);
		$before                             = $this->stored;

		$this->command()->reset( array( 'widget' ), array( 'dry-run' => true ) );

		$this->assertSame( $before, $this->stored );
		$this->assertSame( array(), WP_CLI::$confirmations );
		$this->assertStringContainsString( 'Unknown setting path', $this->failure_of( fn () => $this->command()->reset( array( 'nothing' ), array( 'yes' => true ) ) ) );
		$this->assertStringContainsString( 'cannot be reset', $this->failure_of( fn () => $this->command()->reset( array( 'schemaVersion' ), array( 'yes' => true ) ) ) );
	}

	public function test_reset_declined_saves_nothing(): void {
		$this->stored[ Repository::OPTION ] = array(
			'schemaVersion' => Schema::VERSION,
			'widget'        => array( 'size' => 'lg' ),
		);
		$before                             = $this->stored;
		WP_CLI::$decline                    = true;

		$this->failure_of( fn () => $this->command()->reset( array(), array() ) );

		$this->assertSame( $before, $this->stored );
	}

	public function test_nothing_printed_contains_the_update_token(): void {
		$this->command()->get( array(), array() );
		$this->command()->export( array(), array() );

		$this->assertStringNotContainsStringIgnoringCase( 'updatetoken', $this->captured_output() );
	}
}
