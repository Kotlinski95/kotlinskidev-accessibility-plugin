<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Tests\Admin;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Kotlinskidev\A11y\Admin\AltTextCounter;
use Kotlinskidev\A11y\Tests\TestCase;

require_once __DIR__ . '/WpQueryStub.php';

final class AltTextCounterTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();
		\WP_Query::$found = 7;
	}

	public function test_returns_cached_value_without_query(): void {
		\WP_Query::$last_args = array();
		Functions\expect( 'get_transient' )->once()->with( AltTextCounter::TRANSIENT )->andReturn( '3' );
		Functions\expect( 'set_transient' )->never();

		$this->assertSame( 3, ( new AltTextCounter() )->missing_count() );
		$this->assertSame( array(), \WP_Query::$last_args );
	}

	public function test_queries_and_caches_on_miss(): void {
		Functions\expect( 'get_transient' )->once()->andReturn( false );
		Functions\expect( 'set_transient' )->once()->with( AltTextCounter::TRANSIENT, 7, 86400 );

		$this->assertSame( 7, ( new AltTextCounter() )->missing_count() );
		$this->assertSame( 'ids', \WP_Query::$last_args['fields'] );
		$this->assertFalse( \WP_Query::$last_args['no_found_rows'] );
		$this->assertSame( 1, \WP_Query::$last_args['posts_per_page'] );
	}

	public function test_caches_zero(): void {
		\WP_Query::$found = 0;
		Functions\when( 'get_transient' )->justReturn( false );
		Functions\expect( 'set_transient' )->once()->with( AltTextCounter::TRANSIENT, 0, 86400 );

		$this->assertSame( 0, ( new AltTextCounter() )->missing_count() );
	}

	public function test_registers_invalidation_hooks(): void {
		$counter = new AltTextCounter();

		Actions\expectAdded( 'add_attachment' )->once()->with( array( $counter, 'on_attachment_change' ) );
		Actions\expectAdded( 'delete_attachment' )->once()->with( array( $counter, 'on_attachment_change' ) );
		Actions\expectAdded( 'added_post_meta' )->once();
		Actions\expectAdded( 'updated_post_meta' )->once();
		Actions\expectAdded( 'deleted_post_meta' )->once();

		$counter->register();
		$this->addToAssertionCount( 1 );
	}

	public function test_attachment_change_flushes(): void {
		Functions\expect( 'delete_transient' )->once()->with( AltTextCounter::TRANSIENT );

		( new AltTextCounter() )->on_attachment_change();
		$this->addToAssertionCount( 1 );
	}

	public function test_alt_meta_change_flushes(): void {
		Functions\expect( 'delete_transient' )->once()->with( AltTextCounter::TRANSIENT );

		( new AltTextCounter() )->on_meta_change( 1, 2, '_wp_attachment_image_alt' );
		$this->addToAssertionCount( 1 );
	}

	public function test_other_meta_does_not_flush(): void {
		Functions\expect( 'delete_transient' )->never();

		( new AltTextCounter() )->on_meta_change( 1, 2, '_thumbnail_id' );
		$this->addToAssertionCount( 1 );
	}
}
