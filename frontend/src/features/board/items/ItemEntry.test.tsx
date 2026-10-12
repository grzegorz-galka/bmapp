/**
 * An entry on the board's lists and its PDCA ball. Scenario "The overdue mark
 * and the stage are not colour alone" of "The board shows the active problems
 * and tasks" in specs/problems-and-tasks/spec.md, and the ball at every stage.
 */
import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithLanguage } from '../../../test/render';
import { en } from '../../../i18n/en';
import { pl } from '../../../i18n/pl';
import { STAGES, type ProblemRead, type TaskRead } from '../../../api/items';
import { ItemEntry } from './ItemEntry';
import { PdcaBall } from './PdcaBall';
import { MEMBER, task } from '../boardFixture';

function renderEntries(items: (ProblemRead | TaskRead)[], language: 'en' | 'pl' = 'en') {
  return renderWithLanguage(
    <ul>
      {items.map((item) => (
        <ItemEntry key={item.id} item={item} meetingId={undefined} onMoveOn={() => {}} />
      ))}
    </ul>,
    language,
  );
}

describe('an entry on the lists', () => {
  it('The overdue mark and the stage are not colour alone', async () => {
    await renderEntries([
      task({
        id: 'late',
        summary: 'Late one',
        due_on: '2026-10-09',
        overdue: true,
        responsible: { employee_id: 'emp-bartek', email: MEMBER },
      }),
      task({ id: 'doing', summary: 'Doing one', due_on: '2026-10-20', stage: 'do' }),
    ]);

    const [late, doing] = screen.getAllByRole('listitem');
    expect(late).toHaveTextContent('Overdue, due 9 Oct');
    expect(late).toHaveTextContent(MEMBER);
    expect(doing).toHaveTextContent('Due 20 Oct');
    expect(doing).not.toHaveTextContent(/overdue/i);
    expect(within(doing!).getByText(en.pdca.do)).toBeInTheDocument();
    expect(
      within(doing!).getByRole('button', { name: `${en.pdca.do}: move on to ${en.pdca.check}` }),
    ).toBeInTheDocument();
  });

  it('says it in Polish too', async () => {
    await renderEntries([task({ due_on: '2026-10-09', overdue: true, stage: 'check' })], 'pl');

    const entry = screen.getByRole('listitem');
    expect(entry).toHaveTextContent('Po terminie, termin 9 paź');
    expect(entry).toHaveTextContent(pl.items.noResponsible);
    expect(
      within(entry).getByRole('button', { name: `${pl.pdca.check}: przesuń na ${pl.pdca.act}` }),
    ).toBeInTheDocument();
  });
});

describe('the PDCA ball', () => {
  it.each(STAGES)('names the stage %s in words beside the symbol', async (stage) => {
    await renderWithLanguage(<PdcaBall stage={stage} />, 'en');

    expect(screen.getByText(en.pdca[stage])).toBeInTheDocument();
    expect(document.querySelector(`svg[data-stage="${stage}"]`)).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it.each(STAGES.slice(0, -1))('names the stage %s in its accessible name', async (stage) => {
    await renderWithLanguage(<PdcaBall stage={stage} onMoveOn={() => {}} />, 'en');

    const next = STAGES[STAGES.indexOf(stage) + 1]!;
    expect(
      screen.getByRole('button', { name: `${en.pdca[stage]}: move on to ${en.pdca[next]}` }),
    ).toHaveTextContent(en.pdca[stage]);
  });

  it('offers no step on from act, the last stage', async () => {
    await renderWithLanguage(<PdcaBall stage="act" onMoveOn={() => {}} />, 'en');

    expect(screen.getByText(en.pdca.act)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
