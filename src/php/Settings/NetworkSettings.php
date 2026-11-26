<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

use Kotlinskidev\A11y\Cache\Invalidation;
use WP_Error;

final class NetworkSettings {

	private Repository $repository;
	private Sanitizer $sanitizer;

	public function __construct( ?Repository $repository = null, ?Sanitizer $sanitizer = null ) {
		$this->repository = $repository ?? new Repository();
		$this->sanitizer  = $sanitizer ?? new Sanitizer();
	}

	public function tree(): array {
		return $this->repository->effective_defaults();
	}

	public function locked(): array {
		return $this->repository->network_locked();
	}

	public function payload(): array {
		return $this->with_locks( $this->tree(), $this->locked() );
	}

	public function valid_locks( mixed $paths ): ?array {
		if ( ! is_array( $paths ) || ! array_is_list( $paths ) ) {
			return null;
		}

		foreach ( $paths as $path ) {
			if ( ! is_string( $path ) || 'schemaVersion' === $path || null === Schema::definition( $path ) ) {
				return null;
			}
		}

		$unique = array_values( array_unique( $paths ) );

		sort( $unique );

		return $unique;
	}

	public function apply( array $posted ): array {
		$tree = $this->tree();

		foreach ( Schema::definitions() as $path => $definition ) {
			$found = false;
			$value = Schema::read( $posted, $path, $found );

			if ( $found && 'schemaVersion' !== $path ) {
				Schema::assign( $tree, $path, $value );
			}
		}

		return $tree;
	}

	public function adjusted( array $posted ): array {
		$paths = array();

		foreach ( Schema::definitions() as $path => $definition ) {
			$found = false;
			$value = Schema::read( $posted, $path, $found );

			if ( $found && 'schemaVersion' !== $path && $this->sanitizer->sanitize_value( $value, $definition ) !== $value ) {
				$paths[] = $path;
			}
		}

		return $paths;
	}

	public function resolve( array $tree, array $locked ): array {
		$clean    = $this->sanitizer->sanitize( $tree );
		$defaults = Schema::defaults();
		$sparse   = array();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			if ( 'schemaVersion' === $path ) {
				continue;
			}

			$value   = Schema::read( $clean, $path );
			$default = Schema::read( $defaults, $path );

			if ( $value !== $default ) {
				Schema::assign( $sparse, $path, $value );
			}
		}

		return array(
			'settings' => $sparse,
			'locked'   => $locked,
		);
	}

	public function preview( array $network ): array {
		return $this->with_locks( $this->tree_from( $network['settings'] ), $network['locked'] );
	}

	public function changes( array $before, array $after ): array {
		$paths   = array_keys( Schema::definitions() );
		$changes = array();

		sort( $paths );

		foreach ( $paths as $path ) {
			$from = Schema::read( $before, $path );
			$to   = Schema::read( $after, $path );

			if ( 'schemaVersion' !== $path && $from !== $to ) {
				$changes[] = array(
					'path'   => $path,
					'from'   => $from,
					'to'     => $to,
					'source' => 'network',
				);
			}
		}

		if ( ( $before['locked'] ?? array() ) !== ( $after['locked'] ?? array() ) ) {
			$changes[] = array(
				'path'   => 'locked',
				'from'   => $before['locked'] ?? array(),
				'to'     => $after['locked'] ?? array(),
				'source' => 'network',
			);
		}

		return $changes;
	}

	public function commit( array $network ): array {
		$before = $this->payload();

		update_site_option(
			Repository::NETWORK_OPTION,
			array(
				'schemaVersion' => Schema::VERSION,
				'settings'      => $network['settings'],
				'locked'        => $network['locked'],
			)
		);

		return $this->settle( $before );
	}

	public function payload_after_reset( array $prefixes ): array {
		return $this->preview( $this->reset_network( $prefixes ) );
	}

	public function reset( array $prefixes ): array {
		if ( array() === $prefixes ) {
			$before = $this->payload();

			delete_site_option( Repository::NETWORK_OPTION );

			return $this->settle( $before );
		}

		return $this->commit( $this->reset_network( $prefixes ) );
	}

	private function reset_network( array $prefixes ): array {
		$settings = array() === $prefixes ? array() : $this->repository->network_tree();
		$locked   = array() === $prefixes ? array() : $this->locked();

		foreach ( $prefixes as $prefix ) {
			foreach ( array_keys( Schema::definitions() ) as $path ) {
				if ( Schema::is_under( $path, $prefix ) ) {
					Schema::remove( $settings, $path );
				}
			}

			$locked = array_values(
				array_filter(
					$locked,
					static fn ( string $path ): bool => ! Schema::is_under( $path, $prefix )
				)
			);
		}

		return array(
			'settings' => $settings,
			'locked'   => $locked,
		);
	}

	public function envelope(): array {
		return array(
			'format'        => Importer::FORMAT,
			'formatVersion' => Importer::FORMAT_VERSION,
			'plugin'        => KOTLINSKIDEV_A11Y_VERSION,
			'schemaVersion' => Schema::VERSION,
			'scope'         => 'network',
			'exportedAt'    => gmdate( 'Y-m-d\TH:i:s\Z' ),
			'settings'      => $this->tree(),
			'locked'        => $this->locked(),
		);
	}

	public function import( array $body, bool $dry_run ): array|WP_Error {
		$parsed = $this->parse( $body );

		if ( $parsed instanceof WP_Error ) {
			return $parsed;
		}

		$before = $this->payload();
		$next   = $this->resolve( $this->apply( $parsed['tree'] ), $parsed['locked'] );
		$after  = $dry_run ? $this->preview( $next ) : $this->commit( $next );

		return array(
			'settings' => $after,
			'changes'  => $this->changes( $before, $after ),
			'dropped'  => array(),
			'adjusted' => $this->adjusted( $parsed['tree'] ),
			'locked'   => array(),
			'from'     => array(
				'plugin'        => $parsed['plugin'],
				'schemaVersion' => $parsed['version'],
			),
		);
	}

	private function parse( array $body ): array|WP_Error {
		$is_envelope = array_key_exists( 'format', $body );
		$tree        = $is_envelope ? ( $body['settings'] ?? null ) : $body;
		$version     = $is_envelope ? ( $body['schemaVersion'] ?? null ) : ( $body['schemaVersion'] ?? Schema::VERSION );
		$scope       = $is_envelope ? ( $body['scope'] ?? 'site' ) : 'network';
		$raw_locked  = $is_envelope ? ( $body['locked'] ?? array() ) : ( $body['locked'] ?? $this->locked() );
		$locked      = $this->valid_locks( $raw_locked );

		if ( ! is_array( $tree ) || ! is_int( $version ) || $version < 1 || null === $locked ) {
			return $this->invalid_body();
		}

		if ( $is_envelope && ( Importer::FORMAT !== $body['format'] || ! is_int( $body['formatVersion'] ?? null ) ) ) {
			return $this->invalid_body();
		}

		if ( $version > Schema::VERSION || ( $is_envelope && $body['formatVersion'] > Importer::FORMAT_VERSION ) ) {
			return new WP_Error(
				'kotlinskidev_a11y_newer_schema',
				__( 'This file was made by a newer version of the plugin. Update the plugin first.', 'kotlinskidev-accessibility' ),
				array( 'status' => 409 )
			);
		}

		if ( 'network' !== $scope ) {
			return new WP_Error(
				'kotlinskidev_a11y_wrong_scope',
				__( 'This file belongs to a different settings scope.', 'kotlinskidev-accessibility' ),
				array( 'status' => 400 )
			);
		}

		return array(
			'tree'    => $tree,
			'version' => $version,
			'locked'  => $locked,
			'plugin'  => $is_envelope && is_string( $body['plugin'] ?? null ) ? $body['plugin'] : null,
		);
	}

	private function tree_from( array $sparse ): array {
		$tree = Schema::defaults();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			$found = false;
			$value = Schema::read( $sparse, $path, $found );

			if ( $found && 'schemaVersion' !== $path ) {
				Schema::assign( $tree, $path, $value );
			}
		}

		return $tree;
	}

	private function with_locks( array $tree, array $locked ): array {
		$tree['locked'] = $locked;

		return $tree;
	}

	private function settle( array $before ): array {
		Repository::flush();
		$after = $this->payload();

		if ( $after !== $before ) {
			Invalidation::settings_changed();
		}

		return $after;
	}

	private function invalid_body(): WP_Error {
		return new WP_Error(
			'kotlinskidev_a11y_invalid_body',
			__( 'The request body must be a JSON object.', 'kotlinskidev-accessibility' ),
			array( 'status' => 400 )
		);
	}
}
