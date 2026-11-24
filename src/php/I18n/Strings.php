<?php
declare(strict_types=1);

namespace Kotlinskidev\A11y\I18n;

use Kotlinskidev\A11y\Settings\Repository;

final class Strings {

	private Repository $repository;

	public function __construct( ?Repository $repository = null ) {
		$this->repository = $repository ?? new Repository();
	}

	public function for_locale( string $locale ): array {
		$switched = switch_to_locale( $locale );

		try {
			$strings = $this->defaults();
		} finally {
			if ( $switched ) {
				restore_previous_locale();
			}
		}

		$strings = array_merge( $strings, $this->overrides( $locale, $strings ) );

		return apply_filters( 'kotlinskidev_a11y_strings', $strings, $locale );
	}

	public function keys(): array {
		return array_keys( $this->defaults() );
	}

	private function overrides( string $locale, array $known ): array {
		$settings = $this->repository->get();
		$labels   = $settings['labels'][ $locale ] ?? array();

		if ( ! is_array( $labels ) ) {
			return array();
		}

		$overrides = array();

		foreach ( $labels as $key => $text ) {
			if ( is_string( $text ) && '' !== $text && array_key_exists( $key, $known ) ) {
				$overrides[ $key ] = $text;
			}
		}

		return $overrides;
	}

	public function defaults(): array {
		return array(
			'features.biggerText.label'               => __( 'Bigger text', 'kotlinskidev-accessibility' ),
			'features.biggerText.description'         => __( 'Increase the text size across the page.', 'kotlinskidev-accessibility' ),
			'features.lineHeight.label'               => __( 'Line height', 'kotlinskidev-accessibility' ),
			'features.lineHeight.description'         => __( 'Increase the space between lines of text.', 'kotlinskidev-accessibility' ),
			'features.letterSpacing.label'            => __( 'Letter spacing', 'kotlinskidev-accessibility' ),
			'features.letterSpacing.description'      => __( 'Increase the space between letters.', 'kotlinskidev-accessibility' ),
			'features.fontWeight.label'               => __( 'Font weight', 'kotlinskidev-accessibility' ),
			'features.fontWeight.description'         => __( 'Make text bolder.', 'kotlinskidev-accessibility' ),
			'features.readableFont.label'             => __( 'Readable font', 'kotlinskidev-accessibility' ),
			'features.readableFont.description'       => __( 'Switch to a plain, easy-to-read font.', 'kotlinskidev-accessibility' ),
			'features.dyslexicFont.label'             => __( 'Dyslexia-friendly font', 'kotlinskidev-accessibility' ),
			'features.dyslexicFont.description'       => __( 'Use a font designed to ease reading with dyslexia.', 'kotlinskidev-accessibility' ),
			'features.textAlign.label'                => __( 'Text alignment', 'kotlinskidev-accessibility' ),
			'features.textAlign.description'          => __( 'Cycle text alignment between left, center and right.', 'kotlinskidev-accessibility' ),
			'features.highlightLinks.label'           => __( 'Highlight links', 'kotlinskidev-accessibility' ),
			'features.highlightLinks.description'     => __( 'Underline and emphasize every link.', 'kotlinskidev-accessibility' ),
			'features.bigCursor.label'                => __( 'Big cursor', 'kotlinskidev-accessibility' ),
			'features.bigCursor.description'          => __( 'Enlarge the mouse pointer.', 'kotlinskidev-accessibility' ),
			'features.textMagnifier.label'            => __( 'Text magnifier', 'kotlinskidev-accessibility' ),
			'features.textMagnifier.description'      => __( 'Show a magnified view of the text under the pointer.', 'kotlinskidev-accessibility' ),
			'features.cognitiveReading.label'         => __( 'Cognitive reading', 'kotlinskidev-accessibility' ),
			'features.cognitiveReading.description'   => __( 'Bold the first half of each word to guide reading.', 'kotlinskidev-accessibility' ),
			'features.darkContrast.label'             => __( 'Dark contrast', 'kotlinskidev-accessibility' ),
			'features.darkContrast.description'       => __( 'Use a dark, high-legibility color scheme.', 'kotlinskidev-accessibility' ),
			'features.lightContrast.label'            => __( 'Light contrast', 'kotlinskidev-accessibility' ),
			'features.lightContrast.description'      => __( 'Use a light, high-legibility color scheme.', 'kotlinskidev-accessibility' ),
			'features.highContrast.label'             => __( 'High contrast', 'kotlinskidev-accessibility' ),
			'features.highContrast.description'       => __( 'Increase the contrast of all colors.', 'kotlinskidev-accessibility' ),
			'features.monochrome.label'               => __( 'Monochrome', 'kotlinskidev-accessibility' ),
			'features.monochrome.description'         => __( 'Remove all color from the page.', 'kotlinskidev-accessibility' ),
			'features.saturation.label'               => __( 'Saturation', 'kotlinskidev-accessibility' ),
			'features.saturation.description'         => __( 'Lower or raise the color saturation.', 'kotlinskidev-accessibility' ),
			'features.readingLine.label'              => __( 'Reading line', 'kotlinskidev-accessibility' ),
			'features.readingLine.description'        => __( 'Show a horizontal guide line that follows the pointer.', 'kotlinskidev-accessibility' ),
			'features.readingMask.label'              => __( 'Reading mask', 'kotlinskidev-accessibility' ),
			'features.readingMask.description'        => __( 'Dim everything except the line being read.', 'kotlinskidev-accessibility' ),
			'features.readPage.label'                 => __( 'Read page', 'kotlinskidev-accessibility' ),
			'features.readPage.description'           => __( 'Read the page content aloud.', 'kotlinskidev-accessibility' ),
			'features.keyboardNavigation.label'       => __( 'Keyboard navigation', 'kotlinskidev-accessibility' ),
			'features.keyboardNavigation.description' => __( 'Strengthen focus outlines and enable navigation hotkeys.', 'kotlinskidev-accessibility' ),
			'features.hideImages.label'               => __( 'Hide images', 'kotlinskidev-accessibility' ),
			'features.hideImages.description'         => __( 'Hide all images on the page.', 'kotlinskidev-accessibility' ),
			'features.muteSounds.label'               => __( 'Mute sounds', 'kotlinskidev-accessibility' ),
			'features.muteSounds.description'         => __( 'Mute all audio and video on the page.', 'kotlinskidev-accessibility' ),
			'features.highlightTitles.label'          => __( 'Highlight titles', 'kotlinskidev-accessibility' ),
			'features.highlightTitles.description'    => __( 'Outline every heading on the page.', 'kotlinskidev-accessibility' ),
			'features.highlightAll.label'             => __( 'Highlight all', 'kotlinskidev-accessibility' ),
			'features.highlightAll.description'       => __( 'Outline all interactive elements and headings.', 'kotlinskidev-accessibility' ),
			'features.stopAnimations.label'           => __( 'Stop animations', 'kotlinskidev-accessibility' ),
			'features.stopAnimations.description'     => __( 'Stop animations, moving images and autoplay video.', 'kotlinskidev-accessibility' ),
			'features.skipToContent.label'            => __( 'Skip to content', 'kotlinskidev-accessibility' ),
			'features.skipToContent.description'      => __( 'Jump straight to a main part of the page.', 'kotlinskidev-accessibility' ),
			'profiles.visionImpaired'                 => __( 'Vision impaired', 'kotlinskidev-accessibility' ),
			'profiles.seizureSafe'                    => __( 'Seizure safe', 'kotlinskidev-accessibility' ),
			'profiles.adhdFriendly'                   => __( 'ADHD friendly', 'kotlinskidev-accessibility' ),
			'profiles.blindness'                      => __( 'Blindness', 'kotlinskidev-accessibility' ),
			'profiles.epilepsySafe'                   => __( 'Epilepsy safe', 'kotlinskidev-accessibility' ),
			'panelTitle'                              => __( 'Accessibility settings', 'kotlinskidev-accessibility' ),
			'open'                                    => __( 'Open accessibility settings', 'kotlinskidev-accessibility' ),
			'loadError'                               => __( 'Accessibility tools could not load. Select the button to try again.', 'kotlinskidev-accessibility' ),
			'close'                                   => __( 'Close', 'kotlinskidev-accessibility' ),
			'reset'                                   => __( 'Reset all settings', 'kotlinskidev-accessibility' ),
			'hideToolbar'                             => __( 'Hide toolbar', 'kotlinskidev-accessibility' ),
			'hideToolbarSession'                      => __( 'Hide for this session', 'kotlinskidev-accessibility' ),
			'hideToolbarDays'                         => __( 'Hide for', 'kotlinskidev-accessibility' ),
			'hideToolbarDaysUnit'                     => __( 'days', 'kotlinskidev-accessibility' ),
			'statementLink'                           => __( 'Accessibility statement', 'kotlinskidev-accessibility' ),
			'shortcutHint'                            => __( 'Keyboard shortcut', 'kotlinskidev-accessibility' ),
			'profilesTitle'                           => __( 'Accessibility profiles', 'kotlinskidev-accessibility' ),
			'groupContent'                            => __( 'Content', 'kotlinskidev-accessibility' ),
			'groupColor'                              => __( 'Color', 'kotlinskidev-accessibility' ),
			'groupOrientation'                        => __( 'Orientation', 'kotlinskidev-accessibility' ),
			'featuresTitle'                           => __( 'Adjustments', 'kotlinskidev-accessibility' ),
			'landmarkMain'                            => __( 'Main content', 'kotlinskidev-accessibility' ),
			'landmarkNavigation'                      => __( 'Navigation', 'kotlinskidev-accessibility' ),
			'landmarkFooter'                          => __( 'Footer', 'kotlinskidev-accessibility' ),
			'skipMain'                                => __( 'Main content', 'kotlinskidev-accessibility' ),
			'skipNavigation'                          => __( 'Navigation', 'kotlinskidev-accessibility' ),
			'skipHeader'                              => __( 'Header', 'kotlinskidev-accessibility' ),
			'skipFooter'                              => __( 'Footer', 'kotlinskidev-accessibility' ),
			'skipSearch'                              => __( 'Search', 'kotlinskidev-accessibility' ),
			'skipComplementary'                       => __( 'Sidebar', 'kotlinskidev-accessibility' ),
			'levelOff'                                => __( 'Off', 'kotlinskidev-accessibility' ),
			'levelOn'                                 => __( 'On', 'kotlinskidev-accessibility' ),
			'levelLow'                                => __( 'Low', 'kotlinskidev-accessibility' ),
			'levelMedium'                             => __( 'Medium', 'kotlinskidev-accessibility' ),
			'levelHigh'                               => __( 'High', 'kotlinskidev-accessibility' ),
			'levelLeft'                               => __( 'Left', 'kotlinskidev-accessibility' ),
			'levelCenter'                             => __( 'Center', 'kotlinskidev-accessibility' ),
			'levelRight'                              => __( 'Right', 'kotlinskidev-accessibility' ),
			'statementEmpty'                          => __( 'The accessibility statement has not been published yet.', 'kotlinskidev-accessibility' ),
			'statementCommitmentHeading'              => __( 'Our commitment to accessibility', 'kotlinskidev-accessibility' ),
			'statementCommitmentBody'                 => __( 'We want this website to be usable by everyone, including people with disabilities.', 'kotlinskidev-accessibility' ),
			'statementConformanceHeading'             => __( 'Conformance status', 'kotlinskidev-accessibility' ),
			'statementConformanceBody'                => __( 'We are working towards conformance with WCAG 2.2 level AA.', 'kotlinskidev-accessibility' ),
			'statementFeedbackHeading'                => __( 'Feedback and contact', 'kotlinskidev-accessibility' ),
			'statementFeedbackBody'                   => __( 'If you run into an accessibility barrier on this website, please contact the site owner and describe the problem.', 'kotlinskidev-accessibility' ),
			'statementDateHeading'                    => __( 'Date of this statement', 'kotlinskidev-accessibility' ),
			'statementDateBody'                       => __( 'This statement is reviewed regularly; the date of the last review is added by the site owner.', 'kotlinskidev-accessibility' ),
		);
	}
}
