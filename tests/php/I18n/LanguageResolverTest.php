<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\I18n;

use Brain\Monkey\Filters;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\I18n\LanguageResolver;
use Kotlinskidev\A11y\Tests\TestCase;

final class LanguageResolverTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		unset( $GLOBALS['TRP_LANGUAGE'], $GLOBALS['wp_locale'] );
		Functions\when( 'pll_current_language' )->justReturn( false );
		Functions\when( 'pll_languages_list' )->justReturn( array() );
		Functions\when( 'get_available_languages' )->justReturn( array() );
		Functions\when( 'get_option' )->justReturn( array() );
		Functions\when( 'determine_locale' )->justReturn( 'en_US' );
	}

	protected function tearDown(): void {
		unset( $GLOBALS['TRP_LANGUAGE'], $GLOBALS['wp_locale'] );
		parent::tearDown();
	}

	public function test_falls_back_to_determine_locale(): void {
		$this->assertSame( 'en_US', ( new LanguageResolver() )->current_locale() );
	}

	public function test_polylang_wins_over_everything(): void {
		Functions\when( 'pll_current_language' )->justReturn( 'pl_PL' );
		Filters\expectApplied( 'wpml_current_language' )->never();
		$GLOBALS['TRP_LANGUAGE'] = 'de_DE';

		$this->assertSame( 'pl_PL', ( new LanguageResolver() )->current_locale() );
	}

	public function test_wpml_maps_code_to_default_locale(): void {
		Filters\expectApplied( 'wpml_current_language' )->andReturn( 'pl' );
		Filters\expectApplied( 'wpml_active_languages' )->andReturn( array( 'pl' => array( 'default_locale' => 'pl_PL' ) ) );
		$GLOBALS['TRP_LANGUAGE'] = 'de_DE';

		$this->assertSame( 'pl_PL', ( new LanguageResolver() )->current_locale() );
	}

	public function test_wpml_code_fallback_when_locale_unmapped(): void {
		Filters\expectApplied( 'wpml_current_language' )->andReturn( 'pt-br' );
		Filters\expectApplied( 'wpml_active_languages' )->andReturn( array() );

		$this->assertSame( 'pt_br', ( new LanguageResolver() )->current_locale() );
	}

	public function test_translatepress_used_after_wpml(): void {
		$GLOBALS['TRP_LANGUAGE'] = 'de_DE';

		$this->assertSame( 'de_DE', ( new LanguageResolver() )->current_locale() );
	}

	public function test_filter_overrides_result(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_current_locale' )->once()->with( 'en_US' )->andReturn( 'fr_FR' );

		$this->assertSame( 'fr_FR', ( new LanguageResolver() )->current_locale() );
	}

	public function test_rtl_locales_detected_by_language_code(): void {
		Functions\when( 'get_locale' )->justReturn( 'en_US' );
		$resolver = new LanguageResolver();

		$this->assertTrue( $resolver->is_rtl_locale( 'ar' ) );
		$this->assertTrue( $resolver->is_rtl_locale( 'he_IL' ) );
		$this->assertTrue( $resolver->is_rtl_locale( 'ckb' ) );
		$this->assertFalse( $resolver->is_rtl_locale( 'pl_PL' ) );
	}

	public function test_rtl_uses_wp_locale_for_current_locale(): void {
		Functions\when( 'get_locale' )->justReturn( 'xx_XX' );
		$GLOBALS['wp_locale'] = (object) array( 'text_direction' => 'rtl' );

		$this->assertTrue( ( new LanguageResolver() )->is_rtl_locale( 'xx_XX' ) );
	}

	public function test_known_locales_collect_every_source(): void {
		Functions\when( 'pll_languages_list' )->justReturn( array( 'de_DE' ) );
		Functions\when( 'get_available_languages' )->justReturn( array( 'pl_PL' ) );
		Functions\when( 'get_option' )->justReturn( array( 'translation-languages' => array( 'fr_FR' ) ) );
		Filters\expectApplied( 'wpml_active_languages' )->andReturn( array( 'es' => array( 'default_locale' => 'es_ES' ) ) );

		$known = ( new LanguageResolver() )->known_locales();

		foreach ( array( 'en_US', 'de_DE', 'pl_PL', 'es_ES' ) as $locale ) {
			$this->assertContains( $locale, $known );
		}
	}

	public function test_known_locales_reject_unlisted_and_non_strings(): void {
		Functions\when( 'get_available_languages' )->justReturn( array( 'pl_PL', 5, '' ) );
		Functions\when( 'get_option' )->justReturn( array() );

		$known = ( new LanguageResolver() )->known_locales();

		$this->assertNotContains( 'xx_XX', $known );
		$this->assertNotContains( '', $known );
		$this->assertSame( $known, array_values( array_unique( $known ) ) );
	}

	public function test_locale_label_uses_native_name_with_intl(): void {
		if ( ! class_exists( \Locale::class ) ) {
			$this->markTestSkipped( 'intl missing' );
		}

		$this->assertSame( 'polski', ( new LanguageResolver() )->locale_label( 'pl_PL' ) );
	}

	public function test_locale_label_falls_back_to_the_code_for_unknown_languages(): void {
		$this->assertSame( 'zz', ( new LanguageResolver() )->locale_label( 'zz' ) );
	}

	public function test_locale_label_filter_wins(): void {
		Filters\expectApplied( 'kotlinskidev_a11y_locale_label' )->once()->with( \Mockery::type( 'string' ), 'pl_PL' )->andReturn( 'Polski' );

		$this->assertSame( 'Polski', ( new LanguageResolver() )->locale_label( 'pl_PL' ) );
	}
}
