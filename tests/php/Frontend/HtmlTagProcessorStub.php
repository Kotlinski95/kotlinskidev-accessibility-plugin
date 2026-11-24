<?php
declare(strict_types=1);

if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
	class WP_HTML_Tag_Processor {

		private string $html;
		private int $offset    = 0;
		private int $tag_start = 0;
		private int $tag_end   = 0;

		public function __construct( string $html ) {
			$this->html = $html;
		}

		public function next_tag( array|string $query ): bool {
			$name = is_array( $query ) ? (string) $query['tag_name'] : $query;

			if ( 1 !== preg_match( '/<' . preg_quote( $name, '/' ) . '\b[^>]*>/i', $this->html, $match, PREG_OFFSET_CAPTURE, $this->offset ) ) {
				return false;
			}

			$this->tag_start = (int) $match[0][1];
			$this->tag_end   = $this->tag_start + strlen( $match[0][0] );
			$this->offset    = $this->tag_end;

			return true;
		}

		public function get_attribute( string $name ): string|bool|null {
			$tag = substr( $this->html, $this->tag_start, $this->tag_end - $this->tag_start );

			if ( 1 !== preg_match( '/\s' . preg_quote( $name, '/' ) . '(?:=(?:"([^"]*)"|\'([^\']*)\'))?(?=[\s>])/', $tag, $match ) ) {
				return null;
			}

			return $match[1] ?? ( $match[2] ?? true );
		}

		public function set_attribute( string $name, string|bool $value ): bool {
			$tag      = substr( $this->html, $this->tag_start, $this->tag_end - $this->tag_start );
			$rendered = true === $value ? $name : $name . '="' . htmlspecialchars( (string) $value, ENT_QUOTES ) . '"';
			$pattern  = '/\s' . preg_quote( $name, '/' ) . '(?:=(?:"[^"]*"|\'[^\']*\'))?(?=[\s>])/';

			if ( 1 === preg_match( $pattern, $tag ) ) {
				$updated = (string) preg_replace( $pattern, ' ' . $rendered, $tag, 1 );
			} else {
				$updated = substr( $tag, 0, -1 ) . ' ' . $rendered . '>';
			}

			$this->html      = substr( $this->html, 0, $this->tag_start ) . $updated . substr( $this->html, $this->tag_end );
			$this->tag_end   = $this->tag_start + strlen( $updated );
			$this->offset    = $this->tag_end;

			return true;
		}

		public function get_updated_html(): string {
			return $this->html;
		}
	}
}
