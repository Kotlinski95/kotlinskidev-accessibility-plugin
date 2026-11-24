<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Repository;

final class Visibility {

	public const GUEST_ROLE = '__guest';

	private const MAX_PATTERN_LENGTH = 200;
	private const MAX_PATH_LENGTH    = 2048;

	private static ?bool $memo = null;

	private Repository $repository;

	public static function reset_request_state(): void {
		self::$memo = null;
	}

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function should_render(): bool {
		if ( null === self::$memo ) {
			$render     = ! $this->is_excluded_context() && ! $this->is_blocked_by_settings();
			self::$memo = (bool) apply_filters( 'kotlinskidev_a11y_should_render', $render );
		}

		return self::$memo;
	}

	private function is_excluded_context(): bool {
		return is_admin()
			|| is_feed()
			|| is_customize_preview()
			|| $this->is_rest_request()
			|| $this->is_editor_iframe();
	}

	private function is_rest_request(): bool {
		return defined( 'REST_REQUEST' ) && REST_REQUEST;
	}

	private function is_editor_iframe(): bool {
		return defined( 'IFRAME_REQUEST' ) && IFRAME_REQUEST;
	}

	private function is_blocked_by_settings(): bool {
		$visibility = $this->repository->get()['visibility'] ?? array();
		$mode       = (string) ( $visibility['mode'] ?? 'everywhere' );

		if ( 'only_on' === $mode ) {
			return ! $this->matches_any( $visibility, 'include' );
		}

		if ( 'except_on' === $mode ) {
			return $this->matches_any( $visibility, 'exclude' );
		}

		return false;
	}

	private function matches_any( array $visibility, string $prefix ): bool {
		return $this->matches_post_id( (array) ( $visibility[ $prefix . 'PostIds' ] ?? array() ) )
			|| $this->matches_post_type( (array) ( $visibility[ $prefix . 'PostTypes' ] ?? array() ) )
			|| $this->matches_template( (array) ( $visibility[ $prefix . 'Templates' ] ?? array() ) )
			|| $this->matches_role( (array) ( $visibility[ $prefix . 'Roles' ] ?? array() ) )
			|| $this->matches_url( (array) ( $visibility[ $prefix . 'UrlPatterns' ] ?? array() ) );
	}

	private function matches_template( array $templates ): bool {
		if ( array() === $templates ) {
			return false;
		}

		$wanted = array_map( 'strtolower', array_filter( $templates, 'is_string' ) );

		foreach ( $this->template_identifiers() as $identifier ) {
			if ( in_array( strtolower( $identifier ), $wanted, true ) ) {
				return true;
			}
		}

		return false;
	}

	private function template_identifiers(): array {
		$identifiers = array();

		if ( is_singular() ) {
			$page_template = get_page_template_slug( get_queried_object_id() );

			if ( is_string( $page_template ) && '' !== $page_template ) {
				$identifiers[] = $page_template;
			}
		}

		$current = $GLOBALS['_wp_current_template_id'] ?? null;

		if ( is_string( $current ) && '' !== $current ) {
			$parts         = explode( '//', $current, 2 );
			$identifiers[] = end( $parts );
		}

		return $identifiers;
	}

	private function matches_post_id( array $ids ): bool {
		if ( ! is_singular() ) {
			return false;
		}

		$current = (int) get_queried_object_id();

		return $current > 0 && in_array( $current, array_map( 'intval', $ids ), true );
	}

	private function matches_post_type( array $types ): bool {
		if ( ! is_singular() ) {
			return false;
		}

		$current = get_post_type( (int) get_queried_object_id() );

		return is_string( $current ) && in_array( $current, $types, true );
	}

	private function matches_role( array $roles ): bool {
		if ( array() === $roles ) {
			return false;
		}

		$user         = wp_get_current_user();
		$current_role = (array) $user->roles;

		if ( array() === $current_role ) {
			$current_role = array( self::GUEST_ROLE );
		}

		return array() !== array_intersect( $roles, $current_role );
	}

	private function matches_url( array $patterns ): bool {
		if ( array() === $patterns ) {
			return false;
		}

		$path = $this->request_path();

		foreach ( $patterns as $pattern ) {
			if ( is_string( $pattern ) && '' !== $pattern && $this->wildcard_match( $this->normalize_path( $pattern ), $path ) ) {
				return true;
			}
		}

		return false;
	}

	private function wildcard_match( string $pattern, string $path ): bool {
		if ( strlen( $pattern ) > self::MAX_PATTERN_LENGTH ) {
			return false;
		}

		$pattern = strtolower( (string) preg_replace( '/\*+/', '*', $pattern ) );
		$path    = strtolower( $path );
		$p_len   = strlen( $pattern );
		$s_len   = strlen( $path );
		$p       = 0;
		$s       = 0;
		$star    = -1;
		$resume  = 0;

		while ( $s < $s_len ) {
			if ( $p < $p_len && '*' === $pattern[ $p ] ) {
				$star   = $p++;
				$resume = $s;
			} elseif ( $p < $p_len && $pattern[ $p ] === $path[ $s ] ) {
				++$p;
				++$s;
			} elseif ( $star >= 0 ) {
				$p = $star + 1;
				$s = ++$resume;
			} else {
				return false;
			}
		}

		while ( $p < $p_len && '*' === $pattern[ $p ] ) {
			++$p;
		}

		return $p === $p_len;
	}

	private function request_path(): string {
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		$path = $this->decode_path( (string) wp_parse_url( $uri, PHP_URL_PATH ) );
		$base = $this->normalize_path( $this->decode_path( (string) wp_parse_url( home_url(), PHP_URL_PATH ) ) );

		$normalized = $this->normalize_path( $path );

		if ( '/' !== $base && str_starts_with( $normalized, $base ) ) {
			$normalized = $this->normalize_path( substr( $normalized, strlen( $base ) ) );
		}

		return $normalized;
	}

	private function decode_path( string $path ): string {
		$decoded = substr( rawurldecode( $path ), 0, self::MAX_PATH_LENGTH );
		$clean   = preg_replace( '/[\x00-\x1F\x7F]/u', '', $decoded );

		return is_string( $clean ) ? $clean : '';
	}

	private function normalize_path( string $path ): string {
		return '/' . trim( $path, '/' );
	}
}
