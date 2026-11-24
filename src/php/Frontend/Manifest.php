<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

final class Manifest {

	public const ABI = 1;

	private const SCRIPTS = array( 'loader', 'kernel', 'panel', 'content', 'color', 'orientation' );
	private const STYLES  = array(
		'page'     => 'frontend.css',
		'launcher' => 'launcher.css',
	);
	private const INLINE  = array(
		'bootstrap' => 'bootstrap.js',
	);

	private static ?array $cache = null;

	public static function flush(): void {
		self::$cache = null;
	}

	public static function data(): array {
		if ( null === self::$cache ) {
			self::$cache = self::read( KOTLINSKIDEV_A11Y_DIR . 'build/manifest.php' ) ?? self::fallback();
		}

		return self::$cache;
	}

	public static function script( string $name ): array {
		return self::entry( 'scripts', $name );
	}

	public static function style( string $name ): array {
		return self::entry( 'styles', $name );
	}

	public static function inline( string $name ): array {
		return self::entry( 'inline', $name );
	}

	public static function url( array $entry ): string {
		return KOTLINSKIDEV_A11Y_URL . 'build/' . $entry['file'];
	}

	public static function read( string $path ): ?array {
		if ( ! is_readable( $path ) ) {
			return null;
		}

		$manifest = include $path;

		if ( ! is_array( $manifest ) || ! isset( $manifest['scripts'], $manifest['styles'], $manifest['inline'] ) ) {
			return null;
		}

		return $manifest;
	}

	public static function fallback(): array {
		$scripts = array();

		foreach ( self::SCRIPTS as $name ) {
			$scripts[ $name ] = self::placeholder( $name . '.js' );
		}

		return array(
			'abi'     => self::ABI,
			'scripts' => $scripts,
			'styles'  => array_map( array( self::class, 'placeholder' ), self::STYLES ),
			'inline'  => array_map( array( self::class, 'placeholder' ), self::INLINE ),
		);
	}

	private static function entry( string $group, string $name ): array {
		$entry = self::data()[ $group ][ $name ] ?? null;

		if ( is_array( $entry ) && isset( $entry['file'], $entry['ver'] ) ) {
			return $entry;
		}

		return self::fallback()[ $group ][ $name ] ?? self::placeholder( $name );
	}

	private static function placeholder( string $file ): array {
		return array(
			'file' => $file,
			'ver'  => KOTLINSKIDEV_A11Y_VERSION,
			'raw'  => 0,
			'gzip' => 0,
		);
	}
}
