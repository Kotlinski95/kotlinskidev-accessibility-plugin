import type { Api } from './api';
import type { Notices } from './notices';
import type { FormState } from './state';
import type { AdminConfig, SchemaPayload } from './types';

export interface FieldContext {
  state: FormState;
  schema: SchemaPayload;
  config: AdminConfig;
}

export interface FormContext extends FieldContext {
  api: Api;
  notices: Notices;
  reload: () => void;
}
