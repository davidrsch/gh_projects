import { part1 } from './tableParts/part1';
import { helpers } from './tableParts/helpers';
import { valueToHtml } from './tableParts/valueToHtml';
import { renderer } from './tableParts/renderer';
import { messaging } from './tableParts/messaging';

export const tableViewFetcher = part1 + helpers + valueToHtml + renderer + messaging;