<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cli;

use Kotlinskidev\A11y\Settings\Importer;
use Kotlinskidev\A11y\Settings\NetworkSettings;
use Kotlinskidev\A11y\Settings\Repository;
use Kotlinskidev\A11y\Settings\Sanitizer;
use Kotlinskidev\A11y\Settings\Schema;
use WP_CLI;
use WP_Error;

final class SettingsCommand {

	public const PATH_PATTERN = '/^[A-Za-z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*$/';

	public const MAX_VALUE_BYTES = 65536;

	public const MAX_JSON_DEPTH = 16;

	public const LAYERS = array( 'effective', 'stored', 'network', 'defaults' );

	private const LENIENT_SANITIZERS = array( 'html_map', 'css' );

	private const TRUE_TOKENS = array( 'true', '1', 'on', 'yes' );

	private const FALSE_TOKENS = array( 'false', '0', 'off', 'no' );

	private Repository $repository;
	private Importer $importer;
	private NetworkSettings $network;
	private Sanitizer $sanitizer;
	private Files $files;

	public function __construct( ?Repository $repository = null, ?Importer $importer = null, ?Sanitizer $sanitizer = null, ?Files $files = null, ?NetworkSettings $network = null ) {
		$this->repository = $repository ?? new Repository();
		$this->importer   = $importer ?? new Importer( $this->repository );
		$this->network    = $network ?? new NetworkSettings( $this->repository );
		$this->sanitizer  = $sanitizer ?? new Sanitizer();
		$this->files      = $files ?? new Files();
	}

	public static function register(): void {
		$command = new self();
		$format  = static fn ( array $options, string $fallback ): array => array(
			'type'        => 'assoc',
			'name'        => 'format',
			'optional'    => true,
			'default'     => $fallback,
			'options'     => $options,
			'description' => 'Output format.',
		);
		$flag    = static fn ( string $name, string $description ): array => array(
			'type'        => 'flag',
			'name'        => $name,
			'optional'    => true,
			'description' => $description,
		);
		$network = $flag( 'network', 'Operate on the multisite network defaults instead of this site.' );
		$dry_run = $flag( 'dry-run', 'Show the changes without saving.' );
		$yes     = $flag( 'yes', 'Skip the confirmation prompt.' );

		WP_CLI::add_command(
			'ka11y settings get',
			array( $command, 'get' ),
			array(
				'shortdesc' => 'Print one setting, a group of settings or the whole tree.',
				'synopsis'  => array(
					array(
						'type'        => 'positional',
						'name'        => 'path',
						'optional'    => true,
						'description' => 'Setting path or prefix, for example widget.size.',
					),
					$format( Output::VALUE_FORMATS, 'json' ),
					array(
						'type'        => 'assoc',
						'name'        => 'layer',
						'optional'    => true,
						'default'     => 'effective',
						'options'     => self::LAYERS,
						'description' => 'Which settings layer to read.',
					),
					$network,
				),
			)
		);
		WP_CLI::add_command(
			'ka11y settings set',
			array( $command, 'set' ),
			array(
				'shortdesc' => 'Validate and save one setting.',
				'synopsis'  => array(
					array(
						'type'        => 'positional',
						'name'        => 'path',
						'description' => 'Setting path.',
					),
					array(
						'type'        => 'positional',
						'name'        => 'value',
						'description' => 'New value.',
					),
					$flag( 'as-json', 'Read the value as JSON (required for lists and maps).' ),
					$format( Output::TABLE_FORMATS, 'table' ),
					$network,
					$dry_run,
				),
			)
		);
		WP_CLI::add_command(
			'ka11y settings import',
			array( $command, 'import' ),
			array(
				'shortdesc' => 'Import a settings file made by export.',
				'synopsis'  => array(
					array(
						'type'        => 'positional',
						'name'        => 'file',
						'description' => 'Path to the JSON file, or - to read STDIN.',
					),
					$format( Output::TABLE_FORMATS, 'table' ),
					$dry_run,
					$yes,
					$network,
				),
			)
		);
		WP_CLI::add_command(
			'ka11y settings export',
			array( $command, 'export' ),
			array(
				'shortdesc' => 'Export settings as a versioned JSON file.',
				'synopsis'  => array(
					array(
						'type'        => 'assoc',
						'name'        => 'file',
						'optional'    => true,
						'description' => 'Write to this file instead of STDOUT.',
					),
					$flag( 'force', 'Overwrite an existing file.' ),
					$network,
				),
			)
		);
		WP_CLI::add_command(
			'ka11y settings reset',
			array( $command, 'reset' ),
			array(
				'shortdesc' => 'Reset settings to their defaults.',
				'synopsis'  => array(
					array(
						'type'        => 'positional',
						'name'        => 'path',
						'optional'    => true,
						'repeating'   => true,
						'description' => 'Paths or prefixes to reset. Without any, everything resets.',
					),
					$format( Output::TABLE_FORMATS, 'table' ),
					$dry_run,
					$yes,
					$network,
				),
			)
		);
	}

	public function get( array $args, array $assoc_args ): void {
		$network = Output::network( $assoc_args );
		$format  = Output::format( $assoc_args, Output::VALUE_FORMATS, 'json' );
		$layer   = $assoc_args['layer'] ?? 'effective';

		if ( ! is_string( $layer ) || ! in_array( $layer, self::LAYERS, true ) ) {
			WP_CLI::error( __( 'Invalid layer. Use one of:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', self::LAYERS ) . '.' );
		}

		$tree = $this->layer_tree( $layer, $network );
		$path = $args[0] ?? null;

		if ( null === $path ) {
			WP_CLI::print_value( $tree, array( 'format' => $format ) );

			return;
		}

		$this->validate_path( $path, false );

		if ( null !== Schema::definition( $path ) ) {
			$found = false;
			$value = Schema::read( $tree, $path, $found );

			if ( ! $found ) {
				WP_CLI::error( __( 'This setting has no value in the chosen layer:', 'kotlinskidev-accessibility' ) . ' ' . $path );
			}

			WP_CLI::print_value( $value, array( 'format' => $format ) );

			return;
		}

		$subtree = array();

		foreach ( array_keys( Schema::definitions() ) as $candidate ) {
			$found = false;
			$value = Schema::read( $tree, $candidate, $found );

			if ( $found && Schema::is_under( $candidate, $path ) ) {
				Schema::assign( $subtree, $candidate, $value );
			}
		}

		WP_CLI::print_value( $subtree, array( 'format' => $format ) );
	}

	public function set( array $args, array $assoc_args ): void {
		$network = Output::network( $assoc_args );
		$format  = Output::format( $assoc_args, Output::TABLE_FORMATS, 'table' );
		$path    = (string) ( $args[0] ?? '' );
		$raw     = (string) ( $args[1] ?? '' );

		$this->validate_path( $path, true );

		$definition = (array) Schema::definition( $path );

		if ( ! $network && array_key_exists( $path, $this->repository->locked() ) ) {
			WP_CLI::error( __( 'Locked by site configuration:', 'kotlinskidev-accessibility' ) . ' ' . $path );
		}

		$value = $this->parse_value( $raw, $definition, Output::flag( $assoc_args, 'as-json' ) );
		$clean = $this->sanitizer->sanitize_value( $value, $definition );

		if ( $clean !== $value ) {
			$this->handle_adjusted( $definition, $clean );
		}

		if ( $network ) {
			$this->set_network( $path, $clean, $format, Output::flag( $assoc_args, 'dry-run' ) );

			return;
		}

		$before = $this->repository->get();
		$input  = $before;

		Schema::assign( $input, $path, $clean );

		$sparse  = $this->repository->resolve_save( $input );
		$dry_run = Output::flag( $assoc_args, 'dry-run' );
		$after   = $dry_run ? $this->repository->effective_from( $sparse ) : $this->repository->commit( $sparse );

		$this->report( $this->repository->changes( $before, $after, $sparse ), $format, $dry_run );
	}

	public function import( array $args, array $assoc_args ): void {
		$network = Output::network( $assoc_args );
		$format  = Output::format( $assoc_args, Output::TABLE_FORMATS, 'table' );
		$dry_run = Output::flag( $assoc_args, 'dry-run' );
		$body    = $this->read_body( (string) ( $args[0] ?? '' ) );
		$preview = $this->unwrap( $this->run_import( $body, true, $network ) );

		$this->warn_about( 'dropped', (array) $preview['dropped'] );
		$this->warn_about( 'adjusted', (array) $preview['adjusted'] );
		$this->warn_about( 'locked', (array) $preview['locked'] );

		if ( $dry_run ) {
			$this->report( (array) $preview['changes'], $format, true );

			return;
		}

		$this->show_changes( (array) $preview['changes'], $format );

		if ( array() === $preview['changes'] ) {
			$this->unwrap( $this->run_import( $body, false, $network ) );
			WP_CLI::success( __( 'Nothing to change.', 'kotlinskidev-accessibility' ) );

			return;
		}

		WP_CLI::confirm( __( 'Import these settings?', 'kotlinskidev-accessibility' ), $assoc_args );

		$this->unwrap( $this->run_import( $body, false, $network ) );

		WP_CLI::success( __( 'Settings imported.', 'kotlinskidev-accessibility' ) );
	}

	public function export( array $args, array $assoc_args ): void {
		$envelope = Output::network( $assoc_args ) ? $this->network->envelope() : $this->importer->envelope();
		$json     = (string) wp_json_encode( $envelope, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );
		$file     = $assoc_args['file'] ?? null;

		if ( null === $file ) {
			WP_CLI::line( $json );

			return;
		}

		if ( ! is_string( $file ) ) {
			WP_CLI::error( __( 'The file option needs a path.', 'kotlinskidev-accessibility' ) );
		}

		$written = $this->files->write( $file, $json . "\n", Output::flag( $assoc_args, 'force' ) );

		if ( is_string( $written ) ) {
			WP_CLI::error( $written );
		}

		WP_CLI::success( __( 'Settings exported.', 'kotlinskidev-accessibility' ) );
	}

	public function reset( array $args, array $assoc_args ): void {
		$network  = Output::network( $assoc_args );
		$format   = Output::format( $assoc_args, Output::TABLE_FORMATS, 'table' );
		$dry_run  = Output::flag( $assoc_args, 'dry-run' );
		$prefixes = array_values( array_unique( array_map( 'strval', $args ) ) );
		$locked   = $network ? array() : $this->repository->locked();

		foreach ( $prefixes as $prefix ) {
			$this->validate_path( $prefix, false );

			if ( 'schemaVersion' === $prefix ) {
				WP_CLI::error( __( 'This path cannot be reset:', 'kotlinskidev-accessibility' ) . ' ' . $prefix );
			}

			if ( array_key_exists( $prefix, $locked ) ) {
				WP_CLI::error( __( 'Locked by site configuration:', 'kotlinskidev-accessibility' ) . ' ' . $prefix );
			}
		}

		$list = $network ? $this->network_reset_changes( $prefixes ) : $this->site_reset_changes( $prefixes );

		if ( $dry_run ) {
			$this->report( $list, $format, true );

			return;
		}

		$this->show_changes( $list, $format );

		if ( array() === $list ) {
			WP_CLI::success( __( 'Nothing to change.', 'kotlinskidev-accessibility' ) );

			return;
		}

		WP_CLI::confirm( __( 'Reset these settings?', 'kotlinskidev-accessibility' ), $assoc_args );

		if ( $network ) {
			$this->network->reset( $prefixes );
		} else {
			$this->repository->reset( $prefixes );
		}

		WP_CLI::success( __( 'Settings reset.', 'kotlinskidev-accessibility' ) );
	}

	private function layer_tree( string $layer, bool $network ): array {
		if ( $network ) {
			return match ( $layer ) {
				'stored', 'network' => $this->repository->network_tree(),
				'defaults'          => Schema::defaults(),
				default             => $this->network->tree(),
			};
		}

		return match ( $layer ) {
			'stored'   => $this->repository->stored(),
			'network'  => $this->repository->network_tree(),
			'defaults' => Schema::defaults(),
			default    => $this->repository->get(),
		};
	}

	private function set_network( string $path, mixed $clean, string $format, bool $dry_run ): void {
		$before = $this->network->payload();
		$tree   = $this->network->tree();

		Schema::assign( $tree, $path, $clean );

		$next  = $this->network->resolve( $tree, $this->network->locked() );
		$after = $dry_run ? $this->network->preview( $next ) : $this->network->commit( $next );

		$this->report( $this->network->changes( $before, $after ), $format, $dry_run );
	}

	private function run_import( array $body, bool $dry_run, bool $network ): array|WP_Error {
		return $network ? $this->network->import( $body, $dry_run ) : $this->importer->run( $body, $dry_run );
	}

	private function network_reset_changes( array $prefixes ): array {
		return $this->network->changes( $this->network->payload(), $this->network->payload_after_reset( $prefixes ) );
	}

	private function site_reset_changes( array $prefixes ): array {
		$before = $this->repository->get();
		$sparse = $this->repository->reset_stored( $prefixes );

		return $this->repository->changes( $before, $this->repository->effective_from( $sparse ), $sparse );
	}

	private function validate_path( string $path, bool $leaf ): void {
		if ( strlen( $path ) > 200 || 1 !== preg_match( self::PATH_PATTERN, $path ) ) {
			WP_CLI::error( __( 'Invalid setting path:', 'kotlinskidev-accessibility' ) . ' ' . $path );
		}

		$known = null !== Schema::definition( $path ) || ( ! $leaf && Schema::is_known_prefix( $path ) );

		if ( $known && $leaf && 'schemaVersion' === $path ) {
			WP_CLI::error( __( 'This path cannot be changed:', 'kotlinskidev-accessibility' ) . ' ' . $path );
		}

		if ( $known ) {
			return;
		}

		if ( $leaf && Schema::is_known_prefix( $path ) ) {
			WP_CLI::error( __( 'This path is a group, not a single setting:', 'kotlinskidev-accessibility' ) . ' ' . $path );
		}

		$closest = $this->closest_path( $path );
		$hint    = null === $closest ? '' : ' ' . __( 'Did you mean', 'kotlinskidev-accessibility' ) . ' ' . $closest . '?';

		WP_CLI::error( __( 'Unknown setting path:', 'kotlinskidev-accessibility' ) . ' ' . $path . '.' . $hint );
	}

	private function closest_path( string $path ): ?string {
		$best     = null;
		$distance = 4;

		foreach ( array_keys( Schema::definitions() ) as $candidate ) {
			$current = levenshtein( $path, (string) $candidate );

			if ( $current < $distance ) {
				$distance = $current;
				$best     = (string) $candidate;
			}
		}

		return $best;
	}

	private function parse_value( string $raw, array $definition, bool $json ): mixed {
		if ( strlen( $raw ) > self::MAX_VALUE_BYTES ) {
			WP_CLI::error( __( 'The value is too large.', 'kotlinskidev-accessibility' ) );
		}

		if ( $json ) {
			return $this->decode_json( $raw );
		}

		return match ( $definition['type'] ) {
			'boolean' => $this->parse_boolean( $raw ),
			'integer' => $this->parse_integer( $raw, $definition ),
			'string'  => $this->parse_string( $raw, $definition ),
			default   => WP_CLI::error( __( 'This setting holds a list or a map. Pass the value as JSON with --as-json.', 'kotlinskidev-accessibility' ) ),
		};
	}

	private function decode_json( string $raw ): mixed {
		$value = json_decode( $raw, true, self::MAX_JSON_DEPTH );

		if ( JSON_ERROR_NONE !== json_last_error() ) {
			WP_CLI::error( __( 'The value is not valid JSON, or it is nested too deeply.', 'kotlinskidev-accessibility' ) );
		}

		return $value;
	}

	private function parse_boolean( string $raw ): bool {
		$token = strtolower( $raw );

		if ( in_array( $token, self::TRUE_TOKENS, true ) ) {
			return true;
		}

		if ( in_array( $token, self::FALSE_TOKENS, true ) ) {
			return false;
		}

		WP_CLI::error( __( 'Use one of: true, false, 1, 0, on, off, yes, no.', 'kotlinskidev-accessibility' ) );
	}

	private function parse_integer( string $raw, array $definition ): bool|int {
		if ( 'level' === $definition['sanitize'] && in_array( strtolower( $raw ), array( 'true', 'false' ), true ) ) {
			return 'true' === strtolower( $raw );
		}

		if ( 1 !== preg_match( '/^-?\d{1,18}$/', $raw ) ) {
			WP_CLI::error( __( 'The value must be a whole number.', 'kotlinskidev-accessibility' ) );
		}

		$number = (int) $raw;

		if ( $number < $definition['min'] || $number > $definition['max'] ) {
			WP_CLI::error( __( 'The value must be between', 'kotlinskidev-accessibility' ) . ' ' . $definition['min'] . ' ' . __( 'and', 'kotlinskidev-accessibility' ) . ' ' . $definition['max'] . '.' );
		}

		return $number;
	}

	private function parse_string( string $raw, array $definition ): string {
		if ( isset( $definition['enum'] ) && ! in_array( $raw, $definition['enum'], true ) ) {
			WP_CLI::error( __( 'The value must be one of:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', $definition['enum'] ) . '.' );
		}

		return $raw;
	}

	private function handle_adjusted( array $definition, mixed $clean ): void {
		if ( in_array( $definition['sanitize'], self::LENIENT_SANITIZERS, true ) ) {
			WP_CLI::warning( __( 'The value was cleaned before saving.', 'kotlinskidev-accessibility' ) );

			return;
		}

		WP_CLI::error( __( 'The value is not valid for this setting. The closest valid value is:', 'kotlinskidev-accessibility' ) . ' ' . Output::text( $clean ) );
	}

	private function read_body( string $file ): array {
		$problem = $this->files->problem( $file );

		if ( null !== $problem ) {
			WP_CLI::error( $problem );
		}

		$content = $this->files->read( $file );

		if ( null === $content || strlen( $content ) > Files::MAX_BYTES ) {
			WP_CLI::error( __( 'The file could not be read or is too large.', 'kotlinskidev-accessibility' ) );
		}

		$body = json_decode( $content, true, self::MAX_JSON_DEPTH );

		if ( ! is_array( $body ) || JSON_ERROR_NONE !== json_last_error() ) {
			WP_CLI::error( __( 'The file must contain a JSON object.', 'kotlinskidev-accessibility' ) );
		}

		return $body;
	}

	private function unwrap( array|WP_Error $result ): array {
		if ( ! $result instanceof WP_Error ) {
			return $result;
		}

		$data  = $result->get_error_data();
		$paths = is_array( $data ) && is_array( $data['paths'] ?? null ) ? ' ' . implode( ', ', $data['paths'] ) : '';

		WP_CLI::error( $result->get_error_message() . $paths );
	}

	private function warn_about( string $kind, array $paths ): void {
		if ( array() === $paths ) {
			return;
		}

		$labels = array(
			'dropped'  => __( 'Unknown settings ignored:', 'kotlinskidev-accessibility' ),
			'adjusted' => __( 'Values adjusted by validation:', 'kotlinskidev-accessibility' ),
			'locked'   => __( 'Locked settings skipped:', 'kotlinskidev-accessibility' ),
		);

		WP_CLI::warning( $labels[ $kind ] . ' ' . implode( ', ', $paths ) );
	}

	private function report( array $changes, string $format, bool $dry_run ): void {
		$this->show_changes( $changes, $format );

		if ( $dry_run ) {
			WP_CLI::success( __( 'Dry run: nothing was saved.', 'kotlinskidev-accessibility' ) );

			return;
		}

		WP_CLI::success( array() === $changes ? __( 'Nothing to change.', 'kotlinskidev-accessibility' ) : __( 'Settings saved.', 'kotlinskidev-accessibility' ) );
	}

	private function show_changes( array $changes, string $format ): void {
		$rows = array_map(
			static fn ( array $change ): array => array(
				'path'   => $change['path'],
				'before' => 'table' === $format ? Output::text( $change['from'] ) : $change['from'],
				'after'  => 'table' === $format ? Output::text( $change['to'] ) : $change['to'],
			),
			$changes
		);

		Output::rows( $format, $rows, array( 'path', 'before', 'after' ) );
	}
}
