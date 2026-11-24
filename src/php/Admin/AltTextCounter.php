<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use WP_Query;

final class AltTextCounter {

	public const TRANSIENT = 'kotlinskidev_a11y_missing_alt';

	private const TTL = 86400;

	public function register(): void {
		add_action( 'add_attachment', array( $this, 'on_attachment_change' ) );
		add_action( 'delete_attachment', array( $this, 'on_attachment_change' ) );
		add_action( 'added_post_meta', array( $this, 'on_meta_change' ), 10, 3 );
		add_action( 'updated_post_meta', array( $this, 'on_meta_change' ), 10, 3 );
		add_action( 'deleted_post_meta', array( $this, 'on_meta_change' ), 10, 3 );
	}

	public function missing_count(): int {
		$cached = get_transient( self::TRANSIENT );

		if ( false !== $cached ) {
			return (int) $cached;
		}

		$query = new WP_Query(
			array_merge(
				MissingAltQuery::args( 1, '', 1 ),
				array( 'fields' => 'ids' )
			)
		);
		$count = (int) $query->found_posts;

		set_transient( self::TRANSIENT, $count, self::TTL );

		return $count;
	}

	public function flush(): void {
		delete_transient( self::TRANSIENT );
	}

	public function on_attachment_change(): void {
		$this->flush();
	}

	public function on_meta_change( mixed $meta_id, mixed $object_id, mixed $meta_key = '' ): void {
		if ( MissingAltQuery::META_KEY === $meta_key ) {
			$this->flush();
		}
	}
}
