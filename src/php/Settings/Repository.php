<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

final class Repository {

	public const OPTION = 'kotlinskidev_a11y_settings';

	/**
	 * Per-request cache.
	 *
	 * @var array<string, mixed>|null
	 */
	private static ?array $cache = null;

	private Sanitizer $sanitizer;

	public function __construct( ?Sanitizer $sanitizer = null ) {
		$this->sanitizer = $sanitizer ?? new Sanitizer();
	}

	/**
	 * Drop the per-request cache.
	 */
	public static function flush(): void {
		self::$cache = null;
	}

	/**
	 * Schema-ordered migrations keyed by the version they upgrade from.
	 *
	 * @return array<int, callable(array<string, mixed>): array<string, mixed>>
	 */
	public static function migrations(): array {
		return array();
	}

	/**
	 * Stored settings deep-merged over defaults.
	 *
	 * @return array<string, mixed>
	 */
	public function get(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			$migrated    = $this->migrate( is_array( $stored ) ? $stored : array() );
			self::$cache = $this->merge( Schema::defaults(), $migrated );
		}

		return self::$cache;
	}

	/**
	 * Sanitize and persist a full option tree.
	 *
	 * @param array<string, mixed> $input Raw input.
	 * @return array<string, mixed>
	 */
	public function save( array $input ): array {
		$clean = $this->sanitizer->sanitize( $input );

		update_option( self::OPTION, $clean );
		self::flush();

		return $clean;
	}

	/**
	 * Remove stored settings.
	 *
	 * @return array<string, mixed>
	 */
	public function reset(): array {
		delete_option( self::OPTION );
		self::flush();

		return Schema::defaults();
	}

	/**
	 * Apply pending migrations.
	 *
	 * @param array<string, mixed> $stored Stored option.
	 * @return array<string, mixed>
	 */
	private function migrate( array $stored ): array {
		$version    = isset( $stored['schemaVersion'] ) && is_int( $stored['schemaVersion'] ) ? $stored['schemaVersion'] : 1;
		$migrations = self::migrations();

		while ( $version < Schema::VERSION ) {
			if ( isset( $migrations[ $version ] ) ) {
				$stored = $migrations[ $version ]( $stored );
			}
			++$version;
		}

		$stored['schemaVersion'] = max( $version, Schema::VERSION );

		return $stored;
	}

	/**
	 * Deep-merge stored over defaults; lists and open maps are replaced.
	 *
	 * @param array<string, mixed> $defaults Defaults.
	 * @param array<string, mixed> $stored   Stored.
	 * @return array<string, mixed>
	 */
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
