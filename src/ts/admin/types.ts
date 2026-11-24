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
}

export interface LocaleOption {
  code: string;
  name: string;
}

export interface AdminConfig {
  restRoot: string;
  nonce: string;
  strings: Record<string, string>;
  locales: LocaleOption[];
  profiles: string[];
  features: string[];
  version: string;
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
