/**
 * jsdom has `<dialog>` but not `showModal()` or `close()`. Tests install these
 * so a component that opens a modal dialog renders it as open.
 */
export function stubDialog(): void {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
