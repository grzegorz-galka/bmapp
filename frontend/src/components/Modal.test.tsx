/**
 * The shared modal dialog: opened in the top layer, closed by Escape, and
 * handing focus back to whatever had it.
 */
import { useState } from 'react';
import { describe, expect, it, beforeAll } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { stubDialog } from '../features/auth/dialogStub';
import { Modal } from './Modal';

beforeAll(stubDialog);

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      {open && (
        <Modal labelledBy="harness-heading" onClose={() => setOpen(false)}>
          <h2 id="harness-heading">Harness</h2>
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </Modal>
      )}
    </>
  );
}

describe('Modal', () => {
  it('opens as a modal dialog named by its heading', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('dialog', { name: 'Harness' })).toHaveAttribute('open');
  });

  it('closes on Escape', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to what opened it', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(opener).toHaveFocus();
  });
});
