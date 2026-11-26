<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

use Kotlinskidev\A11y\Cache\Invalidation;

final class Repository {

	public const OPTION         = 'kotlinskidev_a11y_settings';
	public const NETWORK_OPTION = 'kotlinskidev_a11y_network_settings';

	private static ?array $cache  = null;
	private static ?array $stored = null;
	private static ?array $layers = null;
	private static bool $reported = false;

	private Sanitizer $sanitizer;

	public function __construct( ?Sanitizer $sanitizer = null ) {
		$this->sanitizer = $sanitizer ?? new Sanitizer();
	}

	public static function flush(): void {
		self::$cache  = null;
		self::$stored = null;
		self::$layers = null;
	}

	public static function reset_request_state(): void {
		self::$reported = false;
	}

	public static function migrations(): array {
		return array(
			1 => static function ( array $stored ): array {
				if ( isset( $stored['advanced']['loadStrategy'] ) ) {
					$legacy = $stored['advanced']['loadStrategy'];

					$stored['performance'] = array(
						'preset'        => 'custom',
						'strategy'      => in_array( $legacy, array( 'defer', 'idle' ), true ) ? $legacy : 'defer',
						'position'      => 'footer',
						'fetchPriority' => 'auto',
						'prefetch'      => 'hover',
						'pageCss'       => 'linked',
						'deviceSkip'    => true,
						'optOut'        => array(),
					);

					unset( $stored['advanced']['loadStrategy'] );
				}

				$restricted = false;

				foreach ( array( 'excludePostIds', 'excludePostTypes', 'excludeRoles', 'excludeUrlPatterns' ) as $key ) {
					$list = $stored['visibility'][ $key ] ?? null;
					if ( is_array( $list ) && array() !== $list ) {
						$restricted = true;
					}
				}

				if ( ! isset( $stored['visibility'] ) || ! is_array( $stored['visibility'] ) ) {
					$stored['visibility'] = array();
				}

				$stored['visibility']['mode'] = $restricted ? 'except_on' : 'everywhere';

				return $stored;
			},
			2 => static fn ( array $stored ): array => $stored,
			3 => static fn ( array $stored ): array => $stored,
			4 => static fn ( array $stored, self $repository ): array => $repository->strip_defaults( $stored ),
		);
	}

	private function strip_defaults( array $stored ): array {
		$defaults = $this->effective_defaults();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			$found   = false;
			$value   = Schema::read( $stored, $path, $found );
			$default = Schema::read( $defaults, $path );

			if ( 'schemaVersion' !== $path && $found && $value === $default ) {
				Schema::remove( $stored, $path );
			}
		}

		return $stored;
	}

	public function get(): array {
		if ( null === self::$cache ) {
			self::$cache = $this->effective_from( $this->stored() );
		}

		return self::$cache;
	}

	public function stored(): array {
		if ( null === self::$stored ) {
			$raw          = get_option( self::OPTION, array() );
			self::$stored = $this->migrate( is_array( $raw ) ? $raw : array() );
		}

		return self::$stored;
	}

	public function effective_defaults(): array {
		return $this->layers()['defaults'];
	}

	public function locked(): array {
		return $this->layers()['locks']['locked'];
	}

	public function lock_errors(): array {
		return $this->layers()['locks']['errors'];
	}

	public function network_tree(): array {
		return $this->layers()['network'];
	}

	public function network_locked(): array {
		return $this->layers()['network_locked'];
	}

	public function source( string $path ): string {
		if ( array_key_exists( $path, $this->locked() ) ) {
			return 'locked';
		}

		return $this->source_in( $this->stored(), $path );
	}

	public function sources(): array {
		$sources = array();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			$source = 'schemaVersion' === $path ? 'default' : $this->source( $path );

			if ( 'default' !== $source ) {
				$sources[ $path ] = $source;
			}
		}

		return $sources;
	}

	public function effective_from( array $stored ): array {
		$tree = Locks::apply( $this->merge( $this->effective_defaults(), $stored ), $this->locked() );

		return Schema::apply_performance_preset( $tree );
	}

	public function resolve_save( array $input ): array {
		$clean    = $this->sanitizer->sanitize( $input );
		$defaults = $this->effective_defaults();
		$locked   = $this->locked();
		$stored   = $this->stored();
		$sparse   = array( 'schemaVersion' => Schema::VERSION );

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			if ( 'schemaVersion' === $path ) {
				continue;
			}

			if ( array_key_exists( $path, $locked ) ) {
				$found = false;
				$kept  = Schema::read( $stored, $path, $found );

				if ( $found ) {
					Schema::assign( $sparse, $path, $kept );
				}

				continue;
			}

			$value   = Schema::read( $clean, $path );
			$default = Schema::read( $defaults, $path );

			if ( $value !== $default ) {
				Schema::assign( $sparse, $path, $value );
			}
		}

		return $sparse;
	}

	public function reset_stored( array $prefixes ): array {
		$stored = array();

		if ( array() !== $prefixes ) {
			$stored = $this->stored();

			foreach ( array_keys( Schema::definitions() ) as $path ) {
				foreach ( $prefixes as $prefix ) {
					if ( 'schemaVersion' !== $path && Schema::is_under( $path, $prefix ) ) {
						Schema::remove( $stored, $path );
					}
				}
			}
		}

		$stored['schemaVersion'] = Schema::VERSION;

		return $stored;
	}

	public function changes( array $before, array $after, array $stored_after ): array {
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
					'source' => $this->source_in( $stored_after, $path ),
				);
			}
		}

		return $changes;
	}

	public function save( array $input ): array {
		return $this->commit( $this->resolve_save( $input ) );
	}

	public function commit( array $sparse ): array {
		$before = $this->get();

		update_option( self::OPTION, $sparse );

		return $this->settle( $before );
	}

	public function reset( array $prefixes = array() ): array {
		$before = $this->get();

		if ( array() === $prefixes ) {
			delete_option( self::OPTION );
		} else {
			update_option( self::OPTION, $this->reset_stored( $prefixes ) );
		}

		return $this->settle( $before );
	}

	public function persist_migrated(): void {
		$raw = get_option( self::OPTION, array() );

		if ( ! is_array( $raw ) || array() === $raw ) {
			return;
		}

		$migrated = $this->migrate( $raw );

		if ( $migrated !== $raw ) {
			update_option( self::OPTION, $migrated );
			self::flush();
		}
	}

	public function migrate( array $stored ): array {
		$version    = isset( $stored['schemaVersion'] ) && is_int( $stored['schemaVersion'] ) ? $stored['schemaVersion'] : 1;
		$migrations = self::migrations();

		while ( $version < Schema::VERSION ) {
			if ( isset( $migrations[ $version ] ) ) {
				$stored = $migrations[ $version ]( $stored, $this );
			}
			++$version;
		}

		$stored['schemaVersion'] = max( $version, Schema::VERSION );

		return $stored;
	}

	private function settle( array $before ): array {
		self::flush();
		$after = $this->get();

		if ( $after !== $before ) {
			Invalidation::settings_changed();
		}

		return $after;
	}

	private function source_in( array $stored, string $path ): string {
		$found = false;

		Schema::read( $stored, $path, $found );

		if ( $found ) {
			return 'site';
		}

		Schema::read( $this->network_tree(), $path, $found );

		return $found ? 'network' : 'default';
	}

	private function layers(): array {
		if ( null !== self::$layers ) {
			return self::$layers;
		}

		$network = $this->network_option();
		$merged  = $this->merge( Schema::defaults(), $network['settings'] );
		$map     = array();

		foreach ( $network['locked'] as $path ) {
			$map[ $path ] = Schema::read( $merged, $path );
		}

		$locks  = new Locks( $this->sanitizer );
		$layers = array(
			'network'        => $network['settings'],
			'network_locked' => $network['locked'],
			'defaults'       => $merged,
			'locks'          => $locks->resolve( $map, $locks->declared_constant() ),
		);

		self::$layers = $layers;
		$this->report_lock_errors( $layers['locks']['errors'] );

		return $layers;
	}

	private function network_option(): array {
		$empty = array(
			'settings' => array(),
			'locked'   => array(),
		);

		if ( ! is_multisite() ) {
			return $empty;
		}

		$raw = get_site_option( self::NETWORK_OPTION, array() );

		if ( ! is_array( $raw ) ) {
			return $empty;
		}

		$posted   = is_array( $raw['settings'] ?? null ) ? $raw['settings'] : array();
		$settings = array();

		foreach ( Schema::definitions() as $path => $definition ) {
			$found = false;
			$value = Schema::read( $posted, $path, $found );

			if ( $found && 'schemaVersion' !== $path ) {
				Schema::assign( $settings, $path, $this->sanitizer->sanitize_value( $value, $definition ) );
			}
		}

		$locked = array_values(
			array_unique(
				array_filter(
					is_array( $raw['locked'] ?? null ) ? $raw['locked'] : array(),
					static fn ( mixed $path ): bool => is_string( $path ) && null !== Schema::definition( $path )
				)
			)
		);

		return array(
			'settings' => $settings,
			'locked'   => $locked,
		);
	}

	private function report_lock_errors( array $errors ): void {
		if ( array() === $errors || self::$reported || ! is_admin() ) {
			return;
		}

		self::$reported = true;
		$path           = (string) array_key_first( $errors );

		_doing_it_wrong(
			esc_html( Locks::CONSTANT ),
			esc_html( __( 'A settings lock was ignored:', 'kotlinskidev-accessibility' ) . ' ' . $path . ' (' . $errors[ $path ] . ')' ),
			esc_html( KOTLINSKIDEV_A11Y_VERSION )
		);
	}

	private function merge( array $defaults, array $stored ): array {
		$merged = $defaults;

		foreach ( $stored as $key => $value ) {
			$default_value = $defaults[ $key ] ?? null;

			if ( is_array( $value ) && is_array( $default_value ) && array() !== $default_value && ! array_is_list( $default_value ) ) {
				$merged[ $key ] = $this->merge( $default_value, $value );
			} else {
				$merged[ $key ] = $value;
			}
		}

		return $merged;
	}
}
