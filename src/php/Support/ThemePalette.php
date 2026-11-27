<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Support;

final class ThemePalette {

	public const VAR_PREFIX = '--wp--preset--color--';

	private const ORIGINS      = array( 'custom', 'theme', 'default' );
	private const SLUG_PATTERN = '/^[a-z0-9-]+$/';
	private const HEX_PATTERN  = '/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i';

	public function colors(): array {
		if ( ! function_exists( 'wp_get_global_settings' ) ) {
			return array();
		}

		$palette = wp_get_global_settings( array( 'color', 'palette' ) );

		if ( ! is_array( $palette ) ) {
			return array();
		}

		$colors = array();

		foreach ( $this->entries( $palette ) as $entry ) {
			$color = $this->color( $entry );

			if ( null !== $color && ! isset( $colors[ $color['slug'] ] ) ) {
				$colors[ $color['slug'] ] = $color;
			}
		}

		return array_values( $colors );
	}

	private function entries( array $palette ): array {
		if ( array_is_list( $palette ) ) {
			return $palette;
		}

		$entries = array();

		foreach ( self::ORIGINS as $origin ) {
			if ( isset( $palette[ $origin ] ) && is_array( $palette[ $origin ] ) ) {
				$entries = array_merge( $entries, $palette[ $origin ] );
			}
		}

		return $entries;
	}

	private function color( mixed $entry ): ?array {
		if ( ! is_array( $entry ) || ! is_string( $entry['slug'] ?? null ) || ! is_string( $entry['color'] ?? null ) ) {
			return null;
		}

		$slug  = $entry['slug'];
		$color = trim( $entry['color'] );

		if ( 1 !== preg_match( self::SLUG_PATTERN, $slug ) || 1 !== preg_match( self::HEX_PATTERN, $color ) ) {
			return null;
		}

		$name = is_string( $entry['name'] ?? null ) ? sanitize_text_field( $entry['name'] ) : '';

		return array(
			'slug'  => $slug,
			'name'  => '' === $name ? $slug : $name,
			'color' => strtolower( $color ),
			'var'   => self::VAR_PREFIX . $slug,
		);
	}
}
