<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Admin;

use Kotlinskidev\A11y\Rest\SettingsController;
use WP_Post;
use WP_Query;

final class AltTextPage {

	public const SLUG          = 'kotlinskidev-a11y-alt-text';
	public const SCRIPT_HANDLE = 'kotlinskidev-a11y-alt-text';
	public const STYLE_HANDLE  = 'kotlinskidev-a11y-admin';
	public const CAPABILITY    = 'upload_files';
	public const MOUNT_ID      = 'kotlinskidev-a11y-alt-text';
	private const JSON_FLAGS   = JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS;

	private AltTextCounter $counter;

	private string|false $hook_suffix = false;

	public function __construct( ?AltTextCounter $counter = null ) {
		$this->counter = $counter ?? new AltTextCounter();
	}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	public function add_menu(): void {
		$this->hook_suffix = add_submenu_page(
			'upload.php',
			__( 'Missing alt text', 'kotlinskidev-accessibility' ),
			__( 'Missing alt text', 'kotlinskidev-accessibility' ),
			self::CAPABILITY,
			self::SLUG,
			array( $this, 'render' )
		);
	}

	public function page_url(): string {
		return admin_url( 'upload.php?page=' . self::SLUG );
	}

	public function query_args( int $paged, string $search ): array {
		return MissingAltQuery::args( $paged, $search );
	}

	public function enqueue( string $hook ): void {
		if ( false === $this->hook_suffix || $hook !== $this->hook_suffix ) {
			return;
		}

		$asset = $this->asset( 'alt-text' );

		wp_enqueue_style( self::STYLE_HANDLE, KOTLINSKIDEV_A11Y_URL . 'build/admin.css', array(), $asset['version'] );
		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			KOTLINSKIDEV_A11Y_URL . 'build/alt-text.js',
			$asset['dependencies'],
			$asset['version'],
			array( 'in_footer' => true )
		);
		wp_set_script_translations( self::SCRIPT_HANDLE, 'kotlinskidev-accessibility', KOTLINSKIDEV_A11Y_DIR . 'languages' );
		wp_add_inline_script(
			self::SCRIPT_HANDLE,
			'window.kotlinskidevA11yAltText = ' . wp_json_encode( $this->config(), self::JSON_FLAGS ) . ';',
			'before'
		);
	}

	public function config(): array {
		return array(
			'restRoot' => esc_url_raw( rest_url( SettingsController::REST_NAMESPACE . '/' ) ),
			'nonce'    => wp_create_nonce( 'wp_rest' ),
		);
	}

	public function render(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}

		$input  = filter_input_array(
			INPUT_GET,
			array(
				's'     => FILTER_UNSAFE_RAW,
				'paged' => FILTER_VALIDATE_INT,
			)
		);
		$search = sanitize_text_field( (string) ( $input['s'] ?? '' ) );
		$paged  = max( 1, (int) ( $input['paged'] ?? 1 ) );
		$query  = new WP_Query( $this->query_args( $paged, $search ) );

		printf(
			'<div class="wrap ka11y-admin ka11y-alt-text" id="%1$s"><h1 class="wp-heading-inline">%2$s</h1>',
			esc_attr( self::MOUNT_ID ),
			esc_html__( 'Missing alt text', 'kotlinskidev-accessibility' )
		);
		$this->render_summary( (int) $query->found_posts );
		$this->render_search( $search );

		if ( array() === $query->posts ) {
			printf( '<p class="ka11y-alt-empty">%s</p>', esc_html__( 'Every image has alt text.', 'kotlinskidev-accessibility' ) );
		} else {
			$this->render_rows( $query->posts );
			$this->render_pagination( $paged, (int) $query->max_num_pages, $search );
		}

		echo '</div>';
	}

	private function render_summary( int $found ): void {
		printf(
			'<p class="ka11y-alt-summary"><span class="ka11y-alt-remaining" data-ka11y-remaining>%1$s</span> %2$s</p>',
			esc_html( number_format_i18n( $found ) ),
			esc_html__( 'images without alt text', 'kotlinskidev-accessibility' )
		);
	}

	private function render_search( string $search ): void {
		printf(
			'<form method="get" class="ka11y-alt-search"><input type="hidden" name="page" value="%1$s"><label for="ka11y-alt-search">%2$s</label> <input type="search" id="ka11y-alt-search" name="s" value="%3$s"> <button type="submit" class="button">%4$s</button></form>',
			esc_attr( self::SLUG ),
			esc_html__( 'Search by title', 'kotlinskidev-accessibility' ),
			esc_attr( $search ),
			esc_html__( 'Search', 'kotlinskidev-accessibility' )
		);
	}

	private function render_rows( array $posts ): void {
		echo '<ul class="ka11y-alt-list">';

		foreach ( $posts as $post ) {
			$this->render_row( $post instanceof WP_Post ? $post->ID : (int) $post, $post instanceof WP_Post ? $post->post_title : '' );
		}

		echo '</ul>';
	}

	private function render_row( int $id, string $title ): void {
		$file     = wp_basename( (string) get_attached_file( $id ) );
		$field_id = 'ka11y-alt-' . $id;

		printf(
			'<li class="ka11y-alt-row" data-attachment-id="%1$d" data-file="%2$s"><div class="ka11y-alt-row__thumb">%3$s</div><div class="ka11y-alt-row__meta"><strong>%4$s</strong><span class="ka11y-alt-row__file">%2$s</span></div><div class="ka11y-alt-row__edit"><label for="%5$s">%6$s</label><input type="text" id="%5$s" class="ka11y-alt-row__input regular-text" value=""> <button type="button" class="button button-primary ka11y-alt-row__save">%7$s</button></div></li>',
			(int) $id,
			esc_attr( $file ),
			wp_get_attachment_image( $id, array( 60, 60 ), true, array( 'alt' => '' ) ),
			esc_html( $title ),
			esc_attr( $field_id ),
			esc_html__( 'Alt text', 'kotlinskidev-accessibility' ),
			esc_html__( 'Save', 'kotlinskidev-accessibility' )
		);
	}

	private function render_pagination( int $paged, int $total, string $search ): void {
		if ( $total < 2 ) {
			return;
		}

		$links = paginate_links(
			array(
				'base'      => add_query_arg( 'paged', '%#%', $this->page_url() ),
				'format'    => '',
				'current'   => $paged,
				'total'     => $total,
				'add_args'  => '' !== $search ? array( 's' => $search ) : array(),
				'prev_text' => __( 'Previous', 'kotlinskidev-accessibility' ),
				'next_text' => __( 'Next', 'kotlinskidev-accessibility' ),
			)
		);

		if ( is_string( $links ) ) {
			printf( '<nav class="ka11y-alt-pagination" aria-label="%1$s">%2$s</nav>', esc_attr__( 'Pagination', 'kotlinskidev-accessibility' ), wp_kses_post( $links ) );
		}
	}

	private function asset( string $name ): array {
		$path = KOTLINSKIDEV_A11Y_DIR . 'build/' . $name . '.asset.php';

		if ( is_readable( $path ) ) {
			$asset = include $path;

			if ( is_array( $asset ) ) {
				return array(
					'dependencies' => (array) ( $asset['dependencies'] ?? array() ),
					'version'      => (string) ( $asset['version'] ?? KOTLINSKIDEV_A11Y_VERSION ),
				);
			}
		}

		return array(
			'dependencies' => array( 'wp-i18n', 'wp-api-fetch' ),
			'version'      => KOTLINSKIDEV_A11Y_VERSION,
		);
	}
}
