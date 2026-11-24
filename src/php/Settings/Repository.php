<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

use Kotlinskidev\A11y\Cache\Invalidation;

final class Repository {

	public const OPTION = 'kotlinskidev_a11y_settings';

	private static ?array $cache = null;

	private Sanitizer $sanitizer;

	public function __construct( ?Sanitizer $sanitizer = null ) {
		$this->sanitizer = $sanitizer ?? new Sanitizer();
	}

	public static function flush(): void {
		self::$cache = null;
	}

	public static function migrations(): array {
		return array();
	}

	public function get(): array {
		if ( null === self::$cache ) {
			$stored      = get_option( self::OPTION, array() );
			$migrated    = $this->migrate( is_array( $stored ) ? $stored : array() );
			self::$cache = $this->merge( Schema::defaults(), $migrated );
		}

		return self::$cache;
	}

	public function save( array $input ): array {
		$clean = $this->sanitizer->sanitize( $input );

		update_option( self::OPTION, $clean );
		self::flush();
		Invalidation::settings_changed();

		return $clean;
	}

	public function reset(): array {
		delete_option( self::OPTION );
		self::flush();
		Invalidation::settings_changed();

		return Schema::defaults();
	}

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
