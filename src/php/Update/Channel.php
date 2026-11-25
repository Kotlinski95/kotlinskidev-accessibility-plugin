<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Update;

use Closure;

final class Channel {

	public const OPTION   = 'kotlinskidev_a11y_update';
	public const CONSTANT = 'KOTLINSKIDEV_A11Y_UPDATE_CHANNEL';
	public const STABLE   = 'stable';
	public const BETA     = 'beta';

	private readonly Closure $constants;

	public function __construct( ?Closure $constants = null ) {
		$this->constants = $constants ?? static fn ( string $name ): mixed => defined( $name ) ? constant( $name ) : null;
	}

	public static function valid( mixed $value ): bool {
		return self::STABLE === $value || self::BETA === $value;
	}

	public function stored(): string {
		$option  = get_site_option( self::OPTION, array() );
		$channel = is_array( $option ) ? ( $option['channel'] ?? null ) : null;

		return self::valid( $channel ) ? $channel : self::STABLE;
	}

	public function locked_by_constant(): bool {
		return self::valid( ( $this->constants )( self::CONSTANT ) );
	}

	public function current(): string {
		$constant = ( $this->constants )( self::CONSTANT );
		$channel  = self::valid( $constant ) ? $constant : $this->stored();
		$filtered = apply_filters( 'kotlinskidev_a11y_update_channel', $channel );

		return self::valid( $filtered ) ? $filtered : $channel;
	}

	public function is_beta(): bool {
		return self::BETA === $this->current();
	}

	public function save( string $channel ): bool {
		if ( ! self::valid( $channel ) || $this->locked_by_constant() ) {
			return false;
		}

		if ( $channel === $this->stored() ) {
			return true;
		}

		update_site_option( self::OPTION, array( 'channel' => $channel ) );

		return true;
	}
}
