import { CdkDrag, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import { AsyncPipe, DatePipe, NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { MatFabButton, MatIconButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { ButtonTaskActionsComponent } from '@app/button-task-actions/button-task-actions.component';
import {
  KEYS_DELETE_TASK,
  KEYS_MARK_ACTIVE,
  KEYS_MARK_FINISHED,
  KEYS_RENAME,
  KEYS_START_STOP,
  hotkey,
} from '@app/domain/hotkeys';
import { Task, TaskState, isTaskRunning, sessionDuration } from '@app/domain/task';
import { FormatDurationPipe } from '@app/pipes/format-duration.pipe';
import { MapPipe } from '@app/pipes/map.pipe';
import { TaskDurationPipe } from '@app/pipes/task-duration.pipe';
import { TaskStateIconPipe } from '@app/pipes/task-state-icon.pipe';
import { AppStore } from '@app/services/state';
import { HotkeysService } from 'angular2-hotkeys';
import { ButtonSessionActionsComponent } from './button-session-actions/button-session-actions.component';
import { VirtualScrollStickyTable } from './sticky.directive';

@Component({
  selector: 'screen-task',
  templateUrl: './screen-task.component.html',
  styleUrls: ['./screen-task.component.scss', './mat-table.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    TaskStateIconPipe,
    MatToolbarModule,
    MatIcon,
    MatTooltip,
    FormatDurationPipe,
    TaskDurationPipe,
    ButtonTaskActionsComponent,
    ButtonSessionActionsComponent,
    MapPipe,
    CdkDrag,
    CdkDragPlaceholder,
    CdkDropList,
    AsyncPipe,
    DatePipe,
    RouterLink,
    MatIconButton,
    MatFabButton,
    ScrollingModule,
    NgStyle,
    VirtualScrollStickyTable,
  ],
})
export default class ScreenTaskComponent {
  public store = inject(AppStore);
  private keys = inject<HotkeysService>(HotkeysService);
  private destroyRef = inject(DestroyRef);

  taskIsInProgress = computed(() => isTaskRunning(this.store.currentTask()));
  viewport = viewChild(CdkVirtualScrollViewport);

  sessionDuration = sessionDuration;
  hotkeys = [
    hotkey(KEYS_START_STOP, 'Start/stop task', (e) => {
      const task = this.store.currentTask();
      const inProgress = this.taskIsInProgress();
      if (!task) {
        return;
      }
      if (inProgress) {
        this.stop(task.id);
      } else {
        this.start(task.id);
      }
    }),
    hotkey(KEYS_MARK_FINISHED, `Mark as finished`, (e) => {
      const task = this.store.currentTask();
      if (task) {
        this.store.updateTaskState(task.id, TaskState.finished);
      }
    }),
    hotkey(KEYS_MARK_ACTIVE, `Mark as active`, (e) => {
      const task = this.store.currentTask();
      if (task) {
        this.store.updateTaskState(task.id, TaskState.active);
      }
    }),
    hotkey(KEYS_RENAME, 'Rename task', () => {
      const task = this.store.currentTask();
      if (task) {
        this.store.renameTask(task.id);
      }
    }),
    hotkey(KEYS_DELETE_TASK, 'Delete task', () => {
      const task = this.store.currentTask();
      if (task) {
        this.store.deleteTask(task.id);
      }
    }),
  ];
  displayedColumns = ['start', 'end', 'duration', 'action'];

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.keys.remove(this.hotkeys);
    });
    afterNextRender(() => {
      this.keys.add(this.hotkeys);
    });
    effect(() => {
      const taskId = this.store.currentTaskId();
      this.viewport()?.scrollToIndex(0);
    });
  }
  start(taskId?: string) {
    if (taskId) this.store.startTask(taskId, Date.now());
  }
  stop(taskId?: string) {
    if (taskId) this.store.stopTask(taskId, Date.now());
  }
  deleteTask(task?: Task) {
    if (task) this.store.deleteTask(task.id);
  }
}
