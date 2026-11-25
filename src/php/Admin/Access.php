<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Settings\Schema;

final class Access {

	public const FULL     = 'full';
	public const CUSTOMER = 'customer';
	public const NONE     = 'none';

	public const DEFAULT_CAPABILITY = 'kotlinskidev_a11y_customize';

	public const CAPABILITY_PREFIX = 'kotlinskidev_a11y_';

	public const CUSTOMER_PATHS = array( 'labels', 'statement', 'tokens', 'panel', 'theme.mode' );

	public function admin_capability(): string {
		return (string) apply_filters( 'kotlinskidev_a11y_capability', 'manage_options' );
	}

	public function customer_capability(): string {
		$capability = apply_filters( 'kotlinskidev_a11y_customer_capability', self::DEFAULT_CAPABILITY );

		return self::is_valid_capability( $capability ) ? $capability : self::DEFAULT_CAPABILITY;
	}

	public static function is_valid_capability( mixed $capability ): bool {
		return is_string( $capability ) && strlen( $capability ) > strlen( self::CAPABILITY_PREFIX ) && str_starts_with( $capability, self::CAPABILITY_PREFIX );
	}

	public function level( ?int $user_id = null ): string {
		if ( $this->can( $this->admin_capability(), $user_id ) ) {
			return self::FULL;
		}

		return $this->can( $this->customer_capability(), $user_id ) ? self::CUSTOMER : self::NONE;
	}

	public function menu_capability(): string {
		$admin = $this->admin_capability();

		return current_user_can( $admin ) ? $admin : $this->customer_capability();
	}

	public function editable_paths( ?int $user_id = null ): ?array {
		return self::FULL === $this->level( $user_id ) ? null : $this->customer_paths();
	}

	public function customer_paths(): array {
		$filtered = apply_filters( 'kotlinskidev_a11y_customer_paths', self::CUSTOMER_PATHS );
		$paths    = array();

		foreach ( is_array( $filtered ) ? $filtered : array() as $candidate ) {
			if ( is_string( $candidate ) && $this->within_defaults( $candidate ) ) {
				$paths[] = $candidate;
			}
		}

		return array_values( array_unique( $paths ) );
	}

	public function can_edit( string $path, ?int $user_id = null ): bool {
		$level = $this->level( $user_id );

		if ( self::FULL === $level ) {
			return true;
		}

		return self::CUSTOMER === $level && self::covers( $this->customer_paths(), $path );
	}

	public static function covers( array $prefixes, string $path ): bool {
		foreach ( $prefixes as $prefix ) {
			if ( Schema::is_under( $path, (string) $prefix ) ) {
				return true;
			}
		}

		return false;
	}

	public function subtree( array $tree, array $prefixes ): array {
		$subtree = array();

		foreach ( array_keys( Schema::definitions() ) as $path ) {
			$found = false;
			$value = Schema::read( $tree, $path, $found );

			if ( $found && self::covers( $prefixes, $path ) ) {
				Schema::assign( $subtree, $path, $value );
			}
		}

		return $subtree;
	}

	public function grant( string $role_name ): bool {
		$role = get_role( $role_name );

		if ( null === $role ) {
			return false;
		}

		$role->add_cap( $this->customer_capability() );

		return true;
	}

	public function revoke( string $role_name ): bool {
		$role = get_role( $role_name );

		if ( null === $role ) {
			return false;
		}

		$role->remove_cap( $this->customer_capability() );

		return true;
	}

	public function roles(): array {
		$capability = $this->customer_capability();
		$names      = array();

		foreach ( wp_roles()->role_objects as $name => $role ) {
			if ( $role->has_cap( $capability ) ) {
				$names[] = (string) $name;
			}
		}

		return $names;
	}

	private function can( string $capability, ?int $user_id ): bool {
		return null === $user_id ? current_user_can( $capability ) : user_can( $user_id, $capability );
	}

	private function within_defaults( string $candidate ): bool {
		foreach ( self::CUSTOMER_PATHS as $default ) {
			if ( Schema::is_under( $candidate, $default ) && Schema::is_known_prefix( $candidate ) ) {
				return true;
			}
		}

		return false;
	}
}
