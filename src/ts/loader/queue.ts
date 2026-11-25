import { ACTION_PATTERN } from '../shared/actions';
import type { KA11yCommand, KA11yQueue } from '../shared/types';

export type CommandHandler = (command: KA11yCommand) => void;

export const actionName = (command: KA11yCommand): string => command.action.split(':')[0] as string;

export const installQueue = (handlers: Record<string, CommandHandler>): KA11yQueue => {
  let lastSource: string | undefined;
  let lastAt = 0;

  const isDoubleToggle = (command: KA11yCommand): boolean => {
    const at = Date.now();
    const repeated = command.source === lastSource && at - lastAt < 50;
    lastSource = command.source;
    lastAt = at;
    return repeated;
  };

  const dispatch = (command: KA11yCommand): void => {
    if (!command || typeof command.action !== 'string' || !ACTION_PATTERN.test(command.action)) return;
    const name = actionName(command);
    const handler = Object.hasOwn(handlers, name) && handlers[name];
    if (handler && !(name === 'toggle' && isDoubleToggle(command))) handler(command);
  };

  const queue: KA11yQueue = {
    push(...commands: KA11yCommand[]): number {
      commands.forEach(dispatch);
      return commands.length;
    },
  };

  const pending = window.kotlinskidevA11yQueue;
  window.kotlinskidevA11yQueue = queue;
  if (Array.isArray(pending)) queue.push(...pending);
  return queue;
};
