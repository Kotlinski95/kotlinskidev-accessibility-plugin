<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Frontend;

use Kotlinskidev\A11y\Settings\Repository;

final class Visibility {

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function should_render(): bool {
		$render = ! $this->is_excluded_context() && ! $this->is_excluded_by_settings();

		return (bool) apply_filters( 'kotlinskidev_a11y_should_render', $render );
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

	private function is_excluded_by_settings(): bool {
		$visibility = $this->repository->get()['visibility'] ?? array();

		return $this->matches_post_id( (array) ( $visibility['excludePostIds'] ?? array() ) )
			|| $this->matches_post_type( (array) ( $visibility['excludePostTypes'] ?? array() ) )
			|| $this->matches_role( (array) ( $visibility['excludeRoles'] ?? array() ) )
			|| $this->matches_url( (array) ( $visibility['excludeUrlPatterns'] ?? array() ) );
	}

	private function matches_post_id( array $ids ): bool {
		$current = (int) get_queried_object_id();

		return $current > 0 && in_array( $current, array_map( 'intval', $ids ), true );
	}

	private function matches_post_type( array $types ): bool {
		$current = get_post_type();

		return is_string( $current ) && in_array( $current, $types, true );
	}

	private function matches_role( array $roles ): bool {
		if ( array() === $roles ) {
			return false;
		}

		$user = wp_get_current_user();

		return array() !== array_intersect( $roles, (array) $user->roles );
	}

	private function matches_url( array $patterns ): bool {
		if ( array() === $patterns ) {
			return false;
		}

		$path = $this->request_path();

		foreach ( $patterns as $pattern ) {
			if ( is_string( $pattern ) && '' !== $pattern && 1 === preg_match( $this->to_regex( $pattern ), $path ) ) {
				return true;
			}
		}

		return false;
	}

	private function to_regex( string $pattern ): string {
		$quoted = str_replace( '\*', '.*', preg_quote( $this->normalize_path( $pattern ), '#' ) );

		return '#^' . $quoted . '$#i';
	}

	private function request_path(): string {
		$uri  = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
		$base = $this->normalize_path( (string) wp_parse_url( home_url(), PHP_URL_PATH ) );

		$normalized = $this->normalize_path( $path );

		if ( '/' !== $base && str_starts_with( $normalized, $base ) ) {
			$normalized = $this->normalize_path( substr( $normalized, strlen( $base ) ) );
		}

		return $normalized;
	}

	private function normalize_path( string $path ): string {
		return '/' . trim( $path, '/' );
	}
}
