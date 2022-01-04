import { isTruthy } from '@app/utils/assert';
import { nanoid } from 'nanoid';
import { Session, Task, TaskState } from '.';
import { assertNever } from './assert-never';
import { StoreState } from './store';

type AppTasks = StoreState['tasks'];
type StoredTasks = LegacyGames | StoredTasksV1;
type LatestStoredTasks = StoredTasksV1;

// Legacy
type LegacyGame = {
  id: string;
  state: 'active' | 'finished' | 'dropped' | 'hold' | 'wish';
  title: string;
  sessions: { start: number; stop: number }[];
};
type LegacyGames = LegacyGame[];
const fromLegacyGames = (data: LegacyGames): AppTasks => {
  const game = data[0];
  if (
    game &&
    (typeof game.id !== 'string' ||
      !['active', 'finished', 'dropped', 'hold', 'wish'].includes(game.state) ||
      typeof game.title !== 'string')
  ) {
    throw new Error('Invalid legacy format');
  } else {
    const tasks: Task[] = data.map((game) => ({
      id: game.id,
      name: game.title,
      state: (
        {
          active: TaskState.active,
          finished: TaskState.finished,
          dropped: TaskState.dropped,
          hold: TaskState.active,
          wish: TaskState.active,
        } as const
      )[game.state],
      sessions: game.sessions.map((session) => ({
        id: nanoid(3),
        start: session.start,
        end: typeof session.stop === 'number' ? session.stop : undefined,
      })),
    }));
    return {
      ids: tasks.map(({ id }) => id),
      values: Object.fromEntries(tasks.map((task) => [task.id, task] as const)),
    };
  }
};

// V1
type StoredSessionV1 = Session;
enum StoredTaskStateV1 {
  active,
  finished,
  dropped,
}
type StoredTaskV1 = {
  id: string;
  name: string;
  state: StoredTaskStateV1;
  sessions: StoredSessionV1[];
};
export type StoredTasksV1 = {
  version: 1;
  value: StoredTaskV1[];
};
const appTaskStateToStoredTaskStateV1 = (state: TaskState): StoredTaskStateV1 => {
  switch (state) {
    case TaskState.active:
      return StoredTaskStateV1.active;
    case TaskState.dropped:
      return StoredTaskStateV1.dropped;
    case TaskState.finished:
      return StoredTaskStateV1.finished;
    default:
      return assertNever(state);
  }
};
const storedTaskStateToAppTaskStateV1 = (state: StoredTaskStateV1): TaskState => {
  switch (state) {
    case StoredTaskStateV1.active:
      return TaskState.active;
    case StoredTaskStateV1.dropped:
      return TaskState.dropped;
    case StoredTaskStateV1.finished:
      return TaskState.finished;
    default:
      return assertNever(state);
  }
};
// TODO: remopve id from sessions
const appSessionToStoredSession = (session: Session): StoredSessionV1 => session;
const storedSessionToAppSession = (storedSession: StoredSessionV1): Session => storedSession;

export const toStoredTasks = (appTasks: AppTasks): LatestStoredTasks => ({
  version: 1,
  value: appTasks.ids
    .map((id) => {
      const task = appTasks.values[id];
      if (!task) return null;
      return {
        id,
        name: task.name,
        state: appTaskStateToStoredTaskStateV1(task.state),
        sessions: task.sessions.map(appSessionToStoredSession),
      };
    })
    .filter(isTruthy),
});

const fromStoredTasksV1 = (storedTasks: StoredTasksV1): AppTasks => {
  const tasks: Task[] = storedTasks.value.map((task) => ({
    id: task.id,
    name: task.name,
    state: storedTaskStateToAppTaskStateV1(task.state),
    sessions: task.sessions,
  }));
  return {
    ids: tasks.map(({ id }) => id),
    values: Object.fromEntries(tasks.map((task) => [task.id, task] as const)),
  };
};

export const fromStoredTasks = (storedTasks: StoredTasks): AppTasks => {
  if (Array.isArray(storedTasks)) {
    return fromLegacyGames(storedTasks);
  }
  switch (storedTasks.version) {
    case 1:
      return fromStoredTasksV1(storedTasks);
    default:
      return assertNever(storedTasks.version);
  }
};
