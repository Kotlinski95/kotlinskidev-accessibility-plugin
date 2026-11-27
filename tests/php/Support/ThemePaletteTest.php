<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Support;

use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Support\ThemePalette;
use Kotlinskidev\A11y\Tests\TestCase;

final class ThemePaletteTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		Functions\stubs( array( 'sanitize_text_field' => static fn ( $text ) => trim( strip_tags( (string) $text ) ) ) );
	}

	public function test_flattens_origins_with_custom_overriding_theme_and_default(): void {
		Functions\when( 'wp_get_global_settings' )->justReturn(
			array(
				'default' => array(
					array(
						'slug'  => 'vivid-red',
						'name'  => 'Vivid red',
						'color' => '#CF2E2E',
					),
					array(
						'slug'  => 'primary',
						'name'  => 'Old',
						'color' => '#000000',
					),
				),
				'theme'   => array(
					array(
						'slug'  => 'primary',
						'name'  => 'Primary',
						'color' => '#0078C2',
					),
				),
				'custom'  => array(
					array(
						'slug'  => 'primary',
						'name'  => 'Brand',
						'color' => '#112233',
					),
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'slug'  => 'primary',
					'name'  => 'Brand',
					'color' => '#112233',
					'var'   => '--wp--preset--color--primary',
				),
				array(
					'slug'  => 'vivid-red',
					'name'  => 'Vivid red',
					'color' => '#cf2e2e',
					'var'   => '--wp--preset--color--vivid-red',
				),
			),
			( new ThemePalette() )->colors()
		);
	}

	public function test_accepts_a_flat_list_and_skips_gradients_bad_slugs_and_non_hex_colors(): void {
		Functions\when( 'wp_get_global_settings' )->justReturn(
			array(
				array(
					'slug'  => 'ok',
					'name'  => '',
					'color' => '#fff',
				),
				array(
					'slug'  => 'grad',
					'name'  => 'Grad',
					'color' => 'linear-gradient(red,blue)',
				),
				array(
					'slug'  => 'Bad Slug',
					'name'  => 'Bad',
					'color' => '#000000',
				),
				array(
					'slug'  => 'x);}body{',
					'name'  => 'Bad',
					'color' => '#000000',
				),
				array(
					'slug'  => 'rgb',
					'name'  => 'Rgb',
					'color' => 'rgb(0,0,0)',
				),
				'junk',
			)
		);

		$colors = ( new ThemePalette() )->colors();

		$this->assertCount( 1, $colors );
		$this->assertSame( 'ok', $colors[0]['slug'] );
		$this->assertSame( 'ok', $colors[0]['name'] );
	}

	public function test_returns_an_empty_list_when_there_is_no_palette(): void {
		Functions\when( 'wp_get_global_settings' )->justReturn( null );

		$this->assertSame( array(), ( new ThemePalette() )->colors() );
	}
}
