<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Cli;

use Kotlinskidev\A11y\Health\Checks;
use WP_CLI;

final class DoctorCommand {

	public const FAIL_LEVELS = array( 'critical', 'recommended' );

	private Checks $checks;

	public function __construct( ?Checks $checks = null ) {
		$this->checks = $checks ?? new Checks();
	}

	public static function register(): void {
		WP_CLI::add_command(
			'ka11y doctor',
			array( new self(), 'run' ),
			array(
				'shortdesc' => 'Run the plugin health checks. Exits 1 when a check fails at the --fail-on level.',
				'synopsis'  => array(
					array(
						'type'        => 'assoc',
						'name'        => 'format',
						'optional'    => true,
						'default'     => 'table',
						'options'     => Output::TABLE_FORMATS,
						'description' => 'Output format.',
					),
					array(
						'type'        => 'assoc',
						'name'        => 'fail-on',
						'optional'    => true,
						'default'     => 'critical',
						'options'     => self::FAIL_LEVELS,
						'description' => 'Lowest severity that makes the command exit 1.',
					),
				),
			)
		);
	}

	public function run( array $args, array $assoc_args ): void {
		$format  = Output::format( $assoc_args, Output::TABLE_FORMATS, 'table' );
		$fail_on = $assoc_args['fail-on'] ?? 'critical';

		if ( ! is_string( $fail_on ) || ! in_array( $fail_on, self::FAIL_LEVELS, true ) ) {
			WP_CLI::error( __( 'Invalid fail level. Use one of:', 'kotlinskidev-accessibility' ) . ' ' . implode( ', ', self::FAIL_LEVELS ) . '.' );
		}

		$results = $this->checks->all();
		$failing = array_filter(
			$results,
			static fn ( array $result ): bool => Checks::CRITICAL === $result['status'] || ( 'recommended' === $fail_on && Checks::RECOMMENDED === $result['status'] )
		);

		Output::rows( $format, array_map( fn ( array $result ): array => $this->row( $result, $format ), $results ), array( 'id', 'status', 'label', 'description', 'actions' ) );

		if ( array() !== $failing ) {
			WP_CLI::error( count( $failing ) . ' ' . __( 'check(s) failed at the', 'kotlinskidev-accessibility' ) . ' ' . $fail_on . ' ' . __( 'level.', 'kotlinskidev-accessibility' ) );
		}

		WP_CLI::success( __( 'No check failed at the', 'kotlinskidev-accessibility' ) . ' ' . $fail_on . ' ' . __( 'level.', 'kotlinskidev-accessibility' ) );
	}

	private function row( array $result, string $format ): array {
		$actions = (array) $result['actions'];

		return array(
			'id'          => $result['id'],
			'status'      => $result['status'],
			'label'       => $result['label'],
			'description' => wp_strip_all_tags( (string) $result['description'] ),
			'actions'     => 'table' === $format ? implode( '; ', array_map( static fn ( array $action ): string => $action['label'] . ' (' . $action['url'] . ')', $actions ) ) : $actions,
		);
	}
}
