<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

use WP_Error;

final class Importer {

	public const FORMAT         = 'kotlinskidev-accessibility-settings';
	public const FORMAT_VERSION = 1;
	public const MAX_DROPPED    = 100;

	private Repository $repository;
	private Sanitizer $sanitizer;

	public function __construct( ?Repository $repository = null, ?Sanitizer $sanitizer = null ) {
		$this->repository = $repository ?? new Repository();
		$this->sanitizer  = $sanitizer ?? new Sanitizer();
	}

	public function envelope( string $scope = 'site' ): array {
		$settings = $this->repository->get();

		foreach ( array_keys( $this->repository->locked() ) as $path ) {
			Schema::remove( $settings, $path );
		}

		return array(
			'format'        => self::FORMAT,
			'formatVersion' => self::FORMAT_VERSION,
			'plugin'        => KOTLINSKIDEV_A11Y_VERSION,
			'schemaVersion' => Schema::VERSION,
			'scope'         => $scope,
			'exportedAt'    => gmdate( 'Y-m-d\TH:i:s\Z' ),
			'settings'      => $settings,
		);
	}

	public function run( array $body, bool $dry_run, string $scope = 'site' ): array|WP_Error {
		$parsed = $this->parse( $body, $scope );

		if ( $parsed instanceof WP_Error ) {
			return $parsed;
		}

		$migrated = $this->repository->migrate( $parsed['tree'] );
		$report   = $this->inspect( $migrated );

		if ( ! $dry_run && array() !== $report['conflicts'] ) {
			return new WP_Error(
				'kotlinskidev_a11y_locked',
				__( 'Some of these settings are locked by site configuration.', 'kotlinskidev-accessibility' ),
				array(
					'status' => 409,
					'paths'  => $report['conflicts'],
				)
			);
		}

		$sparse = $this->repository->resolve_save( $this->merge_over_defaults( $migrated ) );
		$before = $this->repository->get();
		$after  = $dry_run ? $this->repository->effective_from( $sparse ) : $this->repository->commit( $sparse );

		return array(
			'settings' => $after,
			'changes'  => $this->repository->changes( $before, $after, $sparse ),
			'dropped'  => $report['dropped'],
			'adjusted' => $report['adjusted'],
			'locked'   => $report['locked'],
			'from'     => array(
				'plugin'        => $parsed['plugin'],
				'schemaVersion' => $parsed['version'],
			),
		);
	}

	public function inspect( array $input ): array {
		$locked   = $this->repository->locked();
		$dropped  = array();
		$adjusted = array();
		$present  = array();
		$conflict = array();

		$this->collect_dropped( $input, '', $dropped );
		$dropped = array_slice( $dropped, 0, self::MAX_DROPPED );

		foreach ( Schema::definitions() as $path => $definition ) {
			$found = false;
			$value = Schema::read( $input, $path, $found );

			if ( ! $found || 'schemaVersion' === $path ) {
				continue;
			}

			if ( $this->sanitizer->sanitize_value( $value, $definition ) !== $value ) {
				$adjusted[] = $path;
			}

			if ( array_key_exists( $path, $locked ) ) {
				$present[] = $path;

				if ( $locked[ $path ] !== $value ) {
					$conflict[] = $path;
				}
			}
		}

		return array(
			'dropped'   => $dropped,
			'adjusted'  => $adjusted,
			'locked'    => $present,
			'conflicts' => $conflict,
		);
	}

	private function parse( array $body, string $scope ): array|WP_Error {
		$is_envelope = array_key_exists( 'format', $body );
		$tree        = $is_envelope ? ( $body['settings'] ?? null ) : $body;
		$version     = $is_envelope ? ( $body['schemaVersion'] ?? null ) : ( $body['schemaVersion'] ?? Schema::VERSION );
		$file_scope  = $is_envelope ? ( $body['scope'] ?? 'site' ) : 'site';

		if ( ! is_array( $tree ) || ! is_int( $version ) || $version < 1 || ! in_array( $file_scope, array( 'site', 'network' ), true ) ) {
			return $this->invalid_body();
		}

		if ( $is_envelope && ( self::FORMAT !== $body['format'] || ! is_int( $body['formatVersion'] ?? null ) ) ) {
			return $this->invalid_body();
		}

		if ( $version > Schema::VERSION || ( $is_envelope && $body['formatVersion'] > self::FORMAT_VERSION ) ) {
			return new WP_Error(
				'kotlinskidev_a11y_newer_schema',
				__( 'This file was made by a newer version of the plugin. Update the plugin first.', 'kotlinskidev-accessibility' ),
				array( 'status' => 409 )
			);
		}

		if ( $file_scope !== $scope ) {
			return new WP_Error(
				'kotlinskidev_a11y_wrong_scope',
				__( 'This file belongs to a different settings scope.', 'kotlinskidev-accessibility' ),
				array( 'status' => 400 )
			);
		}

		$tree['schemaVersion'] = $version;

		return array(
			'tree'    => $tree,
			'version' => $version,
			'plugin'  => $is_envelope && is_string( $body['plugin'] ?? null ) ? $body['plugin'] : null,
		);
	}

	private function merge_over_defaults( array $migrated ): array {
		$tree = $this->repository->effective_defaults();

		foreach ( Schema::definitions() as $path => $definition ) {
			$found = false;
			$value = Schema::read( $migrated, $path, $found );

			if ( $found && 'schemaVersion' !== $path ) {
				Schema::assign( $tree, $path, $value );
			}
		}

		return $tree;
	}

	private function collect_dropped( array $node, string $prefix, array &$dropped ): void {
		foreach ( $node as $key => $value ) {
			$path = '' === $prefix ? (string) $key : $prefix . '.' . $key;

			if ( null !== Schema::definition( $path ) ) {
				continue;
			}

			if ( is_array( $value ) && ! array_is_list( $value ) && Schema::is_known_prefix( $path ) ) {
				$this->collect_dropped( $value, $path, $dropped );
			} else {
				$dropped[] = $path;
			}
		}
	}

	private function invalid_body(): WP_Error {
		return new WP_Error(
			'kotlinskidev_a11y_invalid_body',
			__( 'The request body must be a JSON object.', 'kotlinskidev-accessibility' ),
			array( 'status' => 400 )
		);
	}
}
