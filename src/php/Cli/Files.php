<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cli;

use WP_Filesystem_Direct;

final class Files {

	public const MAX_BYTES = 262144;

	private ?WP_Filesystem_Direct $filesystem = null;

	public function read( string $path ): ?string {
		if ( '-' === $path ) {
			$content = stream_get_contents( STDIN, self::MAX_BYTES + 1 );

			return is_string( $content ) ? $content : null;
		}

		$resolved = $this->resolve_existing( $path );

		if ( null === $resolved ) {
			return null;
		}

		$content = $this->filesystem()->get_contents( $resolved );

		return is_string( $content ) ? $content : null;
	}

	public function write( string $path, string $content, bool $overwrite ): string|true {
		if ( ! $this->is_local( $path ) ) {
			return __( 'Only local file paths are allowed.', 'kotlinskidev-accessibility' );
		}

		$directory = realpath( dirname( $path ) );

		if ( false === $directory || ! is_dir( $directory ) ) {
			return __( 'The target directory does not exist.', 'kotlinskidev-accessibility' );
		}

		$target = $directory . DIRECTORY_SEPARATOR . basename( $path );

		if ( ! $overwrite && file_exists( $target ) ) {
			return __( 'The file already exists. Use --force to overwrite it.', 'kotlinskidev-accessibility' );
		}

		return $this->filesystem()->put_contents( $target, $content, 0600 ) ? true : __( 'The file could not be written.', 'kotlinskidev-accessibility' );
	}

	public function problem( string $path ): ?string {
		if ( '-' === $path ) {
			return null;
		}

		if ( ! $this->is_local( $path ) ) {
			return __( 'Only local file paths are allowed.', 'kotlinskidev-accessibility' );
		}

		$resolved = $this->resolve_existing( $path );

		if ( null === $resolved ) {
			return __( 'The file does not exist or is not a readable regular file.', 'kotlinskidev-accessibility' );
		}

		return filesize( $resolved ) > self::MAX_BYTES ? __( 'The file is too large.', 'kotlinskidev-accessibility' ) : null;
	}

	private function is_local( string $path ): bool {
		return '' !== $path && ! str_contains( $path, '://' ) && ! str_contains( $path, "\0" );
	}

	private function resolve_existing( string $path ): ?string {
		if ( ! $this->is_local( $path ) ) {
			return null;
		}

		$resolved = realpath( $path );

		return false !== $resolved && is_file( $resolved ) && is_readable( $resolved ) ? $resolved : null;
	}

	private function filesystem(): WP_Filesystem_Direct {
		if ( null === $this->filesystem ) {
			if ( ! class_exists( 'WP_Filesystem_Direct' ) ) {
				require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-base.php';
				require_once ABSPATH . 'wp-admin/includes/class-wp-filesystem-direct.php';
			}

			$this->filesystem = new WP_Filesystem_Direct( null );
		}

		return $this->filesystem;
	}
}
