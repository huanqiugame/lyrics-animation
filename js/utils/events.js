/**
 * 全局事件总线
 * 基于 EventTarget 的发布/订阅模式，模块间解耦通信
 *
 * 关键事件：
 *   audio:timeupdate  → { currentTime: number }
 *   audio:play        → 无 payload
 *   audio:pause       → 无 payload
 *   audio:loaded      → { duration: number }
 *   audio:seeked      → { currentTime: number }
 *   lyrics:loaded     → { project: ProjectData }
 *   lyrics:modified   → { project: ProjectData }
 *   config:changed    → { config: AnimationConfig }
 *   ui:selectLine     → { lineId: string }
 *   ui:modeChange     → { mode: 'edit' | 'preview' }
 */

class EventBus extends EventTarget {
  /** 保存原始回调 → 包装函数的映射，确保 off() 能正确移除 */
  #wrappers = new WeakMap();

  /**
   * 派发自定义事件（带详情数据）
   * @param {string} name - 事件名
   * @param {*} detail - 事件携带数据
   */
  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }

  /**
   * 监听事件
   * @param {string} name - 事件名
   * @param {Function} callback - 回调函数（接收 detail 作为参数）
   */
  on(name, callback) {
    const wrapper = (e) => callback(e.detail);
    this.#wrappers.set(callback, wrapper);
    this.addEventListener(name, wrapper);
  }

  /**
   * 移除事件监听
   * @param {string} name - 事件名
   * @param {Function} callback - 与 on() 传入的同一个函数引用
   */
  off(name, callback) {
    const wrapper = this.#wrappers.get(callback);
    if (wrapper) {
      this.removeEventListener(name, wrapper);
      this.#wrappers.delete(callback);
    }
  }
}

/** 全局事件总线单例 */
export const bus = new EventBus();
