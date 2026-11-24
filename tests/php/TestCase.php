<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests;

use Brain\Monkey;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Cache\Invalidation;
use Kotlinskidev\A11y\Settings\Repository;
use PHPUnit\Framework\TestCase as PhpUnitTestCase;

abstract class TestCase extends PhpUnitTestCase {

	protected function setUp(): void {
		parent::setUp();
		Monkey\setUp();
		Repository::flush();
		Invalidation::reset_request_state();

		Functions\stubs(
			array(
				'sanitize_text_field' => static fn ( $value ): string => trim( strip_tags( (string) $value ) ),
				'sanitize_key'        => static fn ( $value ): string => strtolower( (string) preg_replace( '/[^A-Za-z0-9_\-]/', '', (string) $value ) ),
				'wp_strip_all_tags'   => static fn ( $value ): string => trim( strip_tags( (string) $value ) ),
				'wp_kses_post'        => static fn ( $value ): string => strip_tags( (string) $value, '<p><a><strong><em><ul><li>' ),
				'esc_url_raw'         => static fn ( $value ): string => 1 === preg_match( '#^https?://#', (string) $value ) ? (string) $value : '',
			)
		);
	}

	protected function tearDown(): void {
		Monkey\tearDown();
		Repository::flush();
		Invalidation::reset_request_state();
		parent::tearDown();
	}
}
