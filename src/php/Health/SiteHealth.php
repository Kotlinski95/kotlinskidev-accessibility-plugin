<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\Health;

use Kotlinskidev\A11y\Settings\Repository;

final class SiteHealth {

	public const SECTION = 'kotlinskidev-accessibility';

	private const BADGE_COLORS = array(
		Checks::GOOD        => 'green',
		Checks::RECOMMENDED => 'orange',
		Checks::CRITICAL    => 'red',
	);

	public function __construct(
		private readonly Checks $checks = new Checks(),
		private readonly Repository $repository = new Repository()
	) {}

	public function register(): void {
		add_filter( 'site_status_tests', array( $this, 'add_tests' ) );
		add_filter( 'debug_information', array( $this, 'add_debug_information' ) );
	}

	public function add_tests( mixed $tests ): array {
		$tests = is_array( $tests ) ? $tests : array();

		foreach ( $this->checks->ids() as $id ) {
			$tests['direct'][ $id ] = array(
				'label' => $this->title( $id ),
				'test'  => fn (): array => $this->adapt( (array) $this->checks->run( $id ) ),
			);
		}

		return $tests;
	}

	public function adapt( array $result ): array {
		$status = (string) ( $result['status'] ?? Checks::GOOD );

		return array(
			'label'       => (string) ( $result['label'] ?? '' ),
			'status'      => $status,
			'badge'       => array(
				'label' => __( 'Accessibility', 'kotlinskidev-accessibility' ),
				'color' => self::BADGE_COLORS[ $status ] ?? 'blue',
			),
			'description' => '<p>' . esc_html( (string) ( $result['description'] ?? '' ) ) . '</p>',
			'actions'     => $this->actions_html( (array) ( $result['actions'] ?? array() ) ),
			'test'        => (string) ( $result['id'] ?? '' ),
		);
	}

	public function add_debug_information( mixed $info ): array {
		$info = is_array( $info ) ? $info : array();

		$info[ self::SECTION ] = array(
			'label'  => __( 'Kotlinskidev Accessibility', 'kotlinskidev-accessibility' ),
			'fields' => $this->fields(),
		);

		return $info;
	}

	public function fields(): array {
		$settings = $this->repository->get();
		$source   = $this->checks->update_source_data();
		$locked   = array_keys( $this->repository->locked() );
		$token    = apply_filters( 'kotlinskidev_a11y_update_token', '' );

		return array(
			'version'         => $this->field( __( 'Plugin version', 'kotlinskidev-accessibility' ), KOTLINSKIDEV_A11Y_VERSION ),
			'php'             => $this->field( __( 'PHP version', 'kotlinskidev-accessibility' ), PHP_VERSION ),
			'wordpress'       => $this->field( __( 'WordPress version', 'kotlinskidev-accessibility' ), (string) get_bloginfo( 'version' ) ),
			'schemaVersion'   => $this->field( __( 'Settings schema version', 'kotlinskidev-accessibility' ), (string) ( $settings['schemaVersion'] ?? '' ) ),
			'updater'         => $this->field( __( 'Updater enabled', 'kotlinskidev-accessibility' ), $this->yes_no( $this->checks->updater_enabled() ) ),
			'sourceHost'      => $this->field( __( 'Update source host', 'kotlinskidev-accessibility' ), $source['host'], true ),
			'tokenSet'        => $this->field( __( 'Update token set', 'kotlinskidev-accessibility' ), $this->yes_no( is_string( $token ) && '' !== $token ) ),
			'networkLayer'    => $this->field( __( 'Network defaults active', 'kotlinskidev-accessibility' ), $this->yes_no( array() !== $this->repository->network_tree() ) ),
			'lockedPaths'     => $this->field( __( 'Locked settings', 'kotlinskidev-accessibility' ), array() === $locked ? __( 'none', 'kotlinskidev-accessibility' ) : implode( ', ', $locked ) ),
			'strategy'        => $this->field( __( 'Loading strategy', 'kotlinskidev-accessibility' ), (string) ( $settings['performance']['strategy'] ?? '' ) ),
			'pageCss'         => $this->field( __( 'Page CSS', 'kotlinskidev-accessibility' ), (string) ( $settings['performance']['pageCss'] ?? '' ) ),
			'storageMode'     => $this->field( __( 'Storage mode', 'kotlinskidev-accessibility' ), (string) ( $settings['storage']['mode'] ?? '' ) ),
			'keepOnUninstall' => $this->field( __( 'Keep data on uninstall', 'kotlinskidev-accessibility' ), $this->yes_no( true === ( $settings['maintenance']['keepDataOnUninstall'] ?? false ) ) ),
		);
	}

	private function title( string $id ): string {
		return match ( $id ) {
			Checks::BUILD_FILES         => __( 'Accessibility widget build files', 'kotlinskidev-accessibility' ),
			Checks::UPDATE_SOURCE       => __( 'Accessibility widget update source', 'kotlinskidev-accessibility' ),
			Checks::OPTIMIZER_CONFLICTS => __( 'Accessibility widget and performance plugins', 'kotlinskidev-accessibility' ),
			Checks::PAGE_CACHE_LANGUAGE => __( 'Accessibility widget and page cache languages', 'kotlinskidev-accessibility' ),
			Checks::LOCKED_SETTINGS     => __( 'Accessibility widget settings locks', 'kotlinskidev-accessibility' ),
			Checks::PANEL_DATA_STORE    => __( 'Accessibility widget panel data folder', 'kotlinskidev-accessibility' ),
			default                     => $id,
		};
	}

	private function actions_html( array $actions ): string {
		$links = array();

		foreach ( $actions as $action ) {
			if ( is_array( $action ) && '' !== (string) ( $action['url'] ?? '' ) ) {
				$links[] = '<a href="' . esc_url( (string) $action['url'] ) . '">' . esc_html( (string) ( $action['label'] ?? '' ) ) . '</a>';
			}
		}

		return array() === $links ? '' : '<p>' . implode( ' | ', $links ) . '</p>';
	}

	private function field( string $label, string $value, bool $hidden = false ): array {
		return array(
			'label'   => $label,
			'value'   => $value,
			'private' => $hidden,
		);
	}

	private function yes_no( bool $value ): string {
		return $value ? __( 'yes', 'kotlinskidev-accessibility' ) : __( 'no', 'kotlinskidev-accessibility' );
	}
}
