export type SettingsTree = Record<string, unknown>;

export interface FieldDefinition {
  type: string;
  default: unknown;
  sanitize: string;
  enum?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export type DefinitionMap = Record<string, FieldDefinition>;

export interface SchemaPayload {
  version: number;
  definitions: DefinitionMap;
  defaults: SettingsTree;
  features: string[];
  profiles: string[];
  presets: Record<string, Record<string, unknown>>;
  locked?: string[];
  sources?: Record<string, string>;
}

export interface SettingChange {
  path: string;
  from: unknown;
  to: unknown;
  source: string;
}

export interface PreviewResult {
  settings: SettingsTree;
  changes: SettingChange[];
  adjusted?: string[];
  locked?: string[];
}

export interface ImportResult extends PreviewResult {
  dropped: string[];
  from: { plugin: string | null; schemaVersion: number };
}

export interface LocaleOption {
  code: string;
  name: string;
}

export interface ManifestEntry {
  file: string;
  ver: string;
  raw: number;
  gzip: number;
}

export interface CostManifest {
  scripts: Record<string, ManifestEntry>;
  styles: Record<string, ManifestEntry>;
  inline: Record<string, ManifestEntry>;
}

export interface CostData {
  manifest: CostManifest;
  panelData: number;
  config: number;
}

export interface AdminConfig {
  restRoot: string;
  nonce: string;
  strings: Record<string, string>;
  locales: LocaleOption[];
  profiles: string[];
  features: string[];
  version: string;
  homeUrl: string;
  cost: CostData;
}

export interface MediaSelection {
  id: number;
  url?: string;
}

export interface MediaFrame {
  on: (event: string, callback: () => void) => MediaFrame;
  open: () => void;
  state: () => { get: (name: string) => { first: () => { toJSON: () => MediaSelection } } };
}

export interface MediaFrameOptions {
  title: string;
  button: { text: string };
  library: { type: string };
  multiple: boolean;
}

export type MediaFactory = (options: MediaFrameOptions) => MediaFrame;

declare global {
  interface Window {
    kotlinskidevA11yAdmin?: AdminConfig;
    wp?: { media?: MediaFactory };
  }
}
