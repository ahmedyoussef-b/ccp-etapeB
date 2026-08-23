export type TaskStatus = "pending" | "running" | "completed" | "error";

export interface Task {
  id: string;
  label: string;
  status: TaskStatus;
  progress: number;
  result?: unknown;
  error?: string;
}

type Listener = (tasks: Task[]) => void;

class TaskQueue {
  private tasks: Map<string, Task> = new Map();
  private listeners: Set<Listener> = new Set();

  add(label: string, handler: (onProgress: (p: number) => void) => Promise<unknown>): Promise<unknown> {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const task: Task = { id, label, status: "pending", progress: 0 };
    this.tasks.set(id, task);
    this.notify();

    setTimeout(async () => {
      task.status = "running";
      task.progress = 5;
      this.notify();

      try {
        const result = await handler((progress) => {
          task.progress = Math.max(task.progress, Math.min(progress, 95));
          this.notify();
        });
        task.status = "completed";
        task.progress = 100;
        task.result = result;
      } catch (error) {
        task.status = "error";
        task.error = error instanceof Error ? error.message : String(error);
      }
      this.notify();
    }, 0);

    return new Promise((resolve, reject) => {
      const interval = setInterval(() => {
        const t = this.tasks.get(id);
        if (!t) {
          clearInterval(interval);
          return;
        }
        if (t.status === "completed") {
          clearInterval(interval);
          resolve(t.result);
        } else if (t.status === "error") {
          clearInterval(interval);
          reject(new Error(t.error));
        }
      }, 200);
    });
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getTasks(): Task[] {
    return Array.from(this.tasks.values()).sort((a, b) => {
      const order = { running: 0, pending: 1, completed: 2, error: 2 };
      return (order[a.status] ?? 3) - (order[b.status] ?? 3);
    });
  }

  clearCompleted(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === "completed" || task.status === "error") {
        this.tasks.delete(id);
      }
    }
    this.notify();
  }

  private notify() {
    const tasks = this.getTasks();
    this.listeners.forEach((listener) => listener(tasks));
  }
}

export const taskQueue = new TaskQueue();
