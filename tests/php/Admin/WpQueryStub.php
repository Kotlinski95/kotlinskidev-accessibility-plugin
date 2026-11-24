<?php
declare(strict_types=1);

if ( ! class_exists( 'WP_Query' ) ) {
	class WP_Query {

		public static array $last_args = array();

		public static int $found = 0;

		public static array $rows = array();

		public static int $pages = 1;

		public int $found_posts = 0;

		public int $max_num_pages = 1;

		public array $posts = array();

		public function __construct( array $args = array() ) {
			self::$last_args     = $args;
			$this->found_posts   = self::$found;
			$this->max_num_pages = self::$pages;
			$this->posts         = self::$rows;
		}
	}
}
