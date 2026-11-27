<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Settings;

final class Sanitizer {

	private const COLOR_PATTERN       = '/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i';
	private const THEME_COLOR_PATTERN = '/^var\(--wp--preset--color--([a-z0-9-]+)(?:,\s?(#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})))?\)$/i';
	private const LENGTH_PATTERN      = '/^-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|vmin|vmax|ch)?$/';
	private const COMBO_PATTERN       = '/^(?:(?:Alt|Ctrl|Shift|Meta)\+)*[A-Za-z0-9]$/';
	public const LOCALE_PATTERN       = '/^[A-Za-z]{2,3}(?:[_-][A-Za-z0-9]{2,8})*$/';
	private const SELECTOR_PATTERN    = '/^[A-Za-z0-9 _#.:,>+~*=\[\]"\'()^$|-]+$/';
	private const SELECTOR_MAX_LENGTH = 200;
	private const SELECTOR_LIST_MAX   = 300;
	private const BROAD_START         = '/^(?:\*|html(?![A-Za-z0-9_-])|body(?![A-Za-z0-9_-])|:not\()/i';
	private const STRING_KEY_PATTERN  = '/^[A-Za-z0-9_.-]{1,80}$/';

	public function sanitize( array $input ): array {
		$output = array();

		Schema::walk(
			function ( string $path, array $definition ) use ( $input, &$output ): void {
				$found = false;
				$value = Schema::read( $input, $path, $found );
				Schema::assign( $output, $path, $found ? $this->sanitize_value( $value, $definition ) : $definition['default'] );
			}
		);

		return Schema::apply_performance_preset( $output );
	}

	public function sanitize_value( mixed $value, array $definition ): mixed {
		$fallback = $definition['default'];

		return match ( $definition['sanitize'] ) {
			'bool'      => is_bool( $value ) ? $value : $fallback,
			'int'       => $this->clamp_int( $value, $definition ) ?? $fallback,
			'level'     => $this->level( $value, $definition ),
			'enum'      => is_string( $value ) && in_array( $value, $definition['enum'], true ) ? $value : $fallback,
			'text'      => $this->text( $value, $definition ),
			'key'       => $this->key( $value, $fallback ),
			'color'     => $this->color( $value, $fallback ),
			'length'    => $this->matching( $value, self::LENGTH_PATTERN, $fallback ),
			'combo'     => $this->matching( $value, self::COMBO_PATTERN, $fallback ),
			'selector'  => $this->selector( $value, $fallback ),
			'icon'      => $this->icon( $value, $fallback ),
			'url'       => is_string( $value ) ? esc_url_raw( trim( $value ) ) : $fallback,
			'css'       => is_string( $value ) ? $this->css( $value ) : $fallback,
			'int_list'  => $this->int_list( $value, $definition ),
			'text_list' => $this->text_list( $value, $fallback ),
			'enum_list' => $this->enum_list( $value, $definition ),
			'selector_list' => $this->selector_list( $value, $definition ),
			'label_map' => $this->label_map( $value, $fallback ),
			'html_map'  => $this->html_map( $value, $fallback ),
			default     => $fallback,
		};
	}

	private function clamp_int( mixed $value, array $definition ): ?int {
		if ( is_string( $value ) && 1 === preg_match( '/^-?\d{1,18}$/', $value ) ) {
			$value = (int) $value;
		}

		if ( ! is_int( $value ) ) {
			return null;
		}

		return max( $definition['min'], min( $definition['max'], $value ) );
	}

	private function level( mixed $value, array $definition ): bool|int {
		if ( is_bool( $value ) ) {
			return $value;
		}

		return $this->clamp_int( $value, $definition ) ?? $definition['default'];
	}

	private function text( mixed $value, array $definition ): string {
		if ( ! is_string( $value ) ) {
			return $definition['default'];
		}

		$clean = sanitize_text_field( $value );

		if ( '' === $clean && ! empty( $definition['required'] ) ) {
			return $definition['default'];
		}

		return $clean;
	}

	private function key( mixed $value, string $fallback ): string {
		if ( ! is_string( $value ) ) {
			return $fallback;
		}

		$clean = sanitize_key( $value );

		return '' === $clean ? $fallback : $clean;
	}

	private function matching( mixed $value, string $pattern, string $fallback ): string {
		if ( ! is_string( $value ) ) {
			return $fallback;
		}

		$trimmed = trim( $value );

		return 1 === preg_match( $pattern, $trimmed ) ? $trimmed : $fallback;
	}

	private function color( mixed $value, string $fallback ): string {
		if ( ! is_string( $value ) ) {
			return $fallback;
		}

		$trimmed = trim( $value );

		if ( 1 === preg_match( self::COLOR_PATTERN, $trimmed ) ) {
			return $trimmed;
		}

		if ( 1 === preg_match( self::THEME_COLOR_PATTERN, $trimmed, $match ) ) {
			$hex = $match[2] ?? ( 1 === preg_match( self::COLOR_PATTERN, $fallback ) ? $fallback : '' );

			return 'var(--wp--preset--color--' . strtolower( $match[1] ) . ( '' === $hex ? '' : ', ' . strtolower( $hex ) ) . ')';
		}

		return $fallback;
	}

	private function selector( mixed $value, string $fallback ): string {
		if ( ! is_string( $value ) ) {
			return $fallback;
		}

		$trimmed = trim( $value );

		if ( '' === $trimmed || strlen( $trimmed ) > self::SELECTOR_MAX_LENGTH || 1 !== preg_match( self::SELECTOR_PATTERN, $trimmed ) ) {
			return $fallback;
		}

		if ( ! $this->balanced( $trimmed ) ) {
			return $fallback;
		}

		foreach ( explode( ',', $trimmed ) as $item ) {
			if ( 1 === preg_match( self::BROAD_START, trim( $item ) ) ) {
				return $fallback;
			}
		}

		return $trimmed;
	}

	private function balanced( string $selector ): bool {
		$closers = array(
			'[' => ']',
			'(' => ')',
		);
		$stack   = array();
		$quote   = '';

		foreach ( str_split( $selector ) as $char ) {
			if ( '' !== $quote ) {
				$quote = $char === $quote ? '' : $quote;
			} elseif ( '"' === $char || "'" === $char ) {
				$quote = $char;
			} elseif ( isset( $closers[ $char ] ) ) {
				$stack[] = $closers[ $char ];
			} elseif ( ']' === $char || ')' === $char ) {
				if ( array_pop( $stack ) !== $char ) {
					return false;
				}
			}
		}

		return '' === $quote && array() === $stack;
	}

	private function selector_list( mixed $value, array $definition ): array {
		if ( ! is_array( $value ) ) {
			return $definition['default'];
		}

		$items = array();

		foreach ( $value as $item ) {
			$clean = $this->selector( $item, '' );

			if ( '' === $clean || in_array( $clean, $items, true ) ) {
				continue;
			}

			if ( count( $items ) >= $definition['max'] || strlen( implode( ',', array_merge( $items, array( $clean ) ) ) ) > self::SELECTOR_LIST_MAX ) {
				break;
			}

			$items[] = $clean;
		}

		return $items;
	}

	private function icon( mixed $value, string $fallback ): int|string {
		if ( is_int( $value ) && $value > 0 ) {
			return $value;
		}

		if ( is_string( $value ) && 1 === preg_match( '/^[1-9]\d{0,17}$/', $value ) ) {
			return (int) $value;
		}

		return 'universal' === $value ? 'universal' : $fallback;
	}

	private function css( string $value ): string {
		$clean = wp_strip_all_tags( $value );

		do {
			$previous = $clean;
			$clean    = preg_replace( '#</\s*style#i', '', $clean ) ?? '';
		} while ( $clean !== $previous );

		return trim( $clean );
	}

	private function int_list( mixed $value, array $definition ): array {
		if ( ! is_array( $value ) ) {
			return $definition['default'];
		}

		$items = array();

		foreach ( $value as $item ) {
			$int = $this->clamp_int( $item, $definition );
			if ( null !== $int && ! in_array( $int, $items, true ) ) {
				$items[] = $int;
			}
		}

		return $items;
	}

	private function text_list( mixed $value, array $fallback ): array {
		if ( ! is_array( $value ) ) {
			return $fallback;
		}

		$items = array();

		foreach ( $value as $item ) {
			if ( ! is_string( $item ) ) {
				continue;
			}
			$clean = sanitize_text_field( $item );
			if ( '' !== $clean && ! in_array( $clean, $items, true ) ) {
				$items[] = $clean;
			}
		}

		return $items;
	}

	private function enum_list( mixed $value, array $definition ): array {
		if ( ! is_array( $value ) ) {
			return $definition['default'];
		}

		$items = array();

		foreach ( $value as $item ) {
			if ( is_string( $item ) && in_array( $item, $definition['enum'], true ) && ! in_array( $item, $items, true ) ) {
				$items[] = $item;
			}
		}

		return $items;
	}

	private function label_map( mixed $value, array $fallback ): array {
		if ( ! is_array( $value ) ) {
			return $fallback;
		}

		$map = array();

		foreach ( $value as $locale => $strings ) {
			if ( ! $this->is_locale( $locale ) || ! is_array( $strings ) ) {
				continue;
			}

			$clean = array();
			foreach ( $strings as $string_key => $text ) {
				if ( is_string( $string_key ) && 1 === preg_match( self::STRING_KEY_PATTERN, $string_key ) && is_string( $text ) ) {
					$clean[ $string_key ] = sanitize_text_field( $text );
				}
			}

			if ( array() !== $clean ) {
				$map[ $locale ] = $clean;
			}
		}

		return $map;
	}

	private function html_map( mixed $value, array $fallback ): array {
		if ( ! is_array( $value ) ) {
			return $fallback;
		}

		$map = array();

		foreach ( $value as $locale => $html ) {
			if ( $this->is_locale( $locale ) && is_string( $html ) ) {
				$map[ $locale ] = wp_kses_post( $html );
			}
		}

		return $map;
	}

	private function is_locale( mixed $locale ): bool {
		return is_string( $locale ) && 1 === preg_match( self::LOCALE_PATTERN, $locale );
	}
}
