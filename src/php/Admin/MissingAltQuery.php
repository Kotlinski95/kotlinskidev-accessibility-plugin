<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

final class MissingAltQuery {

	public const META_KEY = '_wp_attachment_image_alt';

	public const PER_PAGE = 20;

	public static function args( int $paged = 1, string $search = '', int $per_page = self::PER_PAGE ): array {
		$args = array(
			'post_type'              => 'attachment',
			'post_status'            => 'inherit',
			'post_mime_type'         => 'image',
			'posts_per_page'         => $per_page,
			'paged'                  => max( 1, $paged ),
			'orderby'                => 'date',
			'order'                  => 'DESC',
			'no_found_rows'          => false,
			'update_post_term_cache' => false,
			'meta_query'             => array(
				'relation' => 'OR',
				array(
					'key'     => self::META_KEY,
					'compare' => 'NOT EXISTS',
				),
				array(
					'key'     => self::META_KEY,
					'value'   => '',
					'compare' => '=',
				),
			),
		);

		if ( '' !== $search ) {
			$args['s'] = $search;
		}

		return $args;
	}
}
