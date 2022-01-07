import { nanoid } from 'nanoid';
import { combineLatest, Observable, of, timer } from 'rxjs';
import { map } from 'rxjs/operators';
import { Milliseconds } from './date-time';
import { WholeAppRouteParams } from './router';

export enum TaskState {
  active = 'active',
  finished = 'finished',
  dropped = 'dropped',
}

export type RouteTaskState = TaskState | 'all';

export type TaskId = string;

export type Task = {
  id: TaskId;
  name: string;
  state: TaskState;
  sessions: Session[];
};

export type Session = {
  start: Milliseconds;
  end?: Milliseconds;
};

export const isTask = (v: any) => {
  return typeof v === 'object' && v.id && v.name && v.state && Array.isArray(v.sessions) ? (v as Task) : null;
};
export const isTaskRunning = (t?: Task): boolean => !!t && !!t.sessions && t.sessions.some((s) => !s.end);
export const isValidTaskState = (state: string): boolean =>
  (new Set([TaskState.active, TaskState.finished, TaskState.dropped]) as Set<string>).has(state);
export const getTaskRunningSession = (t?: Task) => (t ? t.sessions[t.sessions.length - 1] : undefined);
const compareSessions = (a: Session, b: Session) => b.start - a.start;
export const sortTaskSessions = (task: Task): Task => ({ ...task, sessions: [...task.sessions].sort(compareSessions) });
export const compareTasks = (a: Task, b: Task): number => {
  const as = a.sessions && a.sessions[a.sessions.length - 1];
  const bs = b.sessions && b.sessions[b.sessions.length - 1];
  if (!as && bs) {
    return -1;
  }
  if (as && !bs) {
    return 1;
  }
  if (!as && !bs) {
    return 0;
  }
  if (as && bs) {
    if (!as.end && !bs.end) {
      return bs.start - as.start;
    }
    if (as.end && bs.end) {
      return bs.start - as.start;
    }
    if (!as.end && bs.end) {
      return -1;
    }
    if (as.end && !bs.end) {
      return 1;
    }
  }
  return 0;
};
export const sessionIsOver = (s?: Session): s is Session & { end: number } => !!s && typeof s.end === 'number';
export const sessionDurationPure = (s: Session): number => (s.end ? s.end - s.start : 0);
export const completeTaskDuration = (task?: Task): number =>
  task ? task.sessions.reduce((t, s) => t + sessionDurationPure(s), 0) : 0;

export const getTaskSession = (task: Task, sessionIndex: number) => task.sessions[sessionIndex];

export const taskDurationPure = (task: Task, now: number): number => {
  const completeDuration = completeTaskDuration(task);
  const lastSession = getTaskRunningSession(task);
  return lastSession
    ? sessionIsOver(lastSession)
      ? completeDuration
      : completeDuration + now - lastSession.start
    : completeDuration;
};
export const tasksDurationPure = (tasks: Task[]): number => {
  const now = Date.now();
  return tasks.reduce((a, t) => a + taskDurationPure(t, now), 0);
};

export const makeTaskId = (): TaskId => nanoid(4);

export const sessionDuration = (session?: Session): Observable<number> => {
  if (!session) {
    return of(0);
  }
  return sessionIsOver(session)
    ? of(session.end - session.start)
    : timer(0, 1000).pipe(map(() => Date.now() - session.start));
};
export const taskDuration = (task?: Task, interval = 1000): Observable<number> => {
  const completeDuration = completeTaskDuration(task);
  const lastSession = getTaskRunningSession(task);
  return lastSession
    ? sessionIsOver(lastSession)
      ? of(completeDuration)
      : timer(0, interval).pipe(map(() => completeDuration + Date.now() - lastSession.start))
    : of(completeDuration);
};
export const tasksDuration = (tasks: Task[], interval = 1000): Observable<number> =>
  combineLatest(tasks.map((t) => taskDuration(t, interval))).pipe(
    map((durations) => durations.reduce((acc, d) => acc + d, 0))
  );

type Nullable<T> = T | null;

type Filter = (filter: WholeAppRouteParams, task: Nullable<Task>) => Nullable<Task>;

const filterByTaskId: Filter = (filter, t) => {
  if (!t) return t;
  const { taskId } = filter;
  if (typeof taskId === 'string' && taskId.length) {
    return t.id === taskId ? t : null;
  } else {
    return t;
  }
};

const filterByState: Filter = (filter, t) => {
  if (!t) return t;
  const { state } = filter;
  if (state && state !== 'all') {
    return t.state === state ? t : null;
  } else {
    return t;
  }
};

const filterByName: Filter = (filter, t) => {
  if (!t) return t;
  const { search } = filter;
  if (typeof search === 'string' && search.length) {
    return t.name.toLowerCase().includes(search.toLowerCase()) ? t : null;
  } else {
    return t;
  }
};
const filterByFrom: Filter = (filter, t) => {
  if (!t) return t;
  const { from } = filter;
  if (from instanceof Date && !Number.isNaN(from.valueOf())) {
    const sessions = t.sessions.filter((s) => s.start >= from.valueOf());
    return sessions.length ? { ...t, sessions } : null;
  } else {
    return t;
  }
};
const filterByTo: Filter = (filter, t) => {
  if (!t) return t;
  const { to } = filter;
  if (to instanceof Date && !Number.isNaN(to.valueOf())) {
    const sessions = t.sessions.filter((s) => (typeof s.end === 'number' ? s.end <= to.valueOf() : true));
    return sessions.length ? { ...t, sessions } : null;
  } else {
    return t;
  }
};

const sortByDuration = (filter: WholeAppRouteParams, tasks: Task[]): Task[] => {
  const now = (filter.to ?? new Date()).valueOf();
  if (filter.durationSort) {
    return [...tasks].sort((a, b) =>
      filter.durationSort === 'shortestFirst'
        ? taskDurationPure(a, now) - taskDurationPure(b, now)
        : taskDurationPure(b, now) - taskDurationPure(a, now)
    );
  } else {
    return [...tasks].sort(compareTasks);
  }
};

const composedPredicate = (filter: WholeAppRouteParams, t: Nullable<Task>): Nullable<Task> =>
  filterByTo(filter, filterByFrom(filter, filterByName(filter, filterByState(filter, t))));

export const filterTasks = (filter: WholeAppRouteParams, values: Task[]): Task[] =>
  sortByDuration(
    filter,
    values.reduce((acc: Task[], task) => {
      const result = composedPredicate(filter, task);
      if (result) {
        acc.push(result);
      }
      return acc;
    }, [])
  );

export const filterTaskSessions = (task: Task, params: Pick<WholeAppRouteParams, 'from' | 'to'>): Task => {
  const sessions = filterByTo(params, filterByFrom(params, task))?.sessions;
  return sessions ? { ...task, sessions } : task;
};