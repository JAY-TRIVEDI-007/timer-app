/// <reference lib="webworker" />

import * as Comlink from 'comlink';
import { filter } from '@app/domain/filter';

Comlink.expose(filter);