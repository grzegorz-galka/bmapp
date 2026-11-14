import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import type { Product } from '../../api/products';
import type { Project } from '../../api/projects';
import { BackLink } from '../../components/BackLink';
import { Modal } from '../../components/Modal';
import { useHere } from '../../components/origin';
import {
  describeFailure,
  describeFieldFailure,
  describeOtherFailure,
  isNotFound,
} from '../../i18n/apiErrors';
import { useFormat } from '../../i18n/format';
import { useAuth } from '../auth/AuthProvider';
import { useIsAdmin } from '../auth/useCurrentUser';
import { teamAuthority } from '../teams/teamAuthority';
import { useTeam } from '../teams/useTeams';
import {
  useChangeProduct,
  useChangeProject,
  useCreateProduct,
  useCreateProject,
  useDeleteProduct,
  useDeleteProject,
  useProducts,
  useProjects,
} from './useProjectsAndProducts';
import controls from '../../styles/controls.module.css';
import teamStyles from '../teams/teams.module.css';
import styles from './ProjectsAndProductsPage.module.css';

/** Which dialog is open, if any, and on what. */
type Dialog =
  | { kind: 'project'; project?: Project }
  | { kind: 'product'; product?: Product }
  | { kind: 'deleteProject'; project: Project }
  | { kind: 'deleteProduct'; product: Product };

/**
 * A team's projects and products, at `/teams/:teamId/projects-and-products`.
 *
 * Anyone signed in reads it; whoever may configure the board - the leader,
 * a deputy or an administrator - is offered to add, change, deactivate,
 * reactivate and delete. The server decides regardless.
 */
export function ProjectsAndProductsPage() {
  const { teamId = '' } = useParams();
  const { t } = useTranslation();
  const isAdmin = useIsAdmin();
  const { email } = useAuth();
  const team = useTeam(teamId);
  const projects = useProjects(teamId);
  const products = useProducts(teamId);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const teamPath = `/teams/${encodeURIComponent(teamId)}`;
  const back = (
    <BackLink className={teamStyles.back} fallback={{ to: teamPath, label: t('back.board') }} />
  );

  if (team.isPending || projects.isPending || products.isPending) {
    return (
      <main className={teamStyles.page}>
        {back}
        <p>{t('projectsAndProducts.list.loading')}</p>
      </main>
    );
  }

  if (team.isError || projects.isError || products.isError) {
    return (
      <main className={teamStyles.page}>
        {back}
        {isNotFound(team.error) ? (
          <h1 className={teamStyles.heading}>{t('projectsAndProducts.list.notFound')}</h1>
        ) : (
          <p role="alert">{t('projectsAndProducts.list.loadFailed')}</p>
        )}
      </main>
    );
  }

  const mayConfigure = teamAuthority(team.data, email, isAdmin).configure;
  const close = () => setDialog(null);

  return (
    <main className={teamStyles.page}>
      {back}
      <h1 className={teamStyles.heading}>
        {t('projectsAndProducts.list.title', { name: team.data.name })}
      </h1>

      <ProjectList
        teamId={teamId}
        projects={projects.data}
        mayConfigure={mayConfigure}
        openDialog={setDialog}
      />
      <ProductList
        teamId={teamId}
        products={products.data}
        mayConfigure={mayConfigure}
        openDialog={setDialog}
      />

      {dialog?.kind === 'project' && (
        <ProjectDialog teamId={teamId} project={dialog.project} onClose={close} />
      )}
      {dialog?.kind === 'product' && (
        <ProductDialog teamId={teamId} product={dialog.product} onClose={close} />
      )}
      {dialog?.kind === 'deleteProject' && (
        <DeleteProjectDialog teamId={teamId} project={dialog.project} onClose={close} />
      )}
      {dialog?.kind === 'deleteProduct' && (
        <DeleteProductDialog teamId={teamId} product={dialog.product} onClose={close} />
      )}
    </main>
  );
}

function StatusMarks({ active, pastEnd = false }: { active: boolean; pastEnd?: boolean }) {
  const { t } = useTranslation();
  return (
    <span className={styles.marks}>
      {/* The word is the marker; the badge styling only repeats it. */}
      <span className={active ? `${styles.mark} ${styles.active}` : styles.mark}>
        {active ? t('projectsAndProducts.common.active') : t('projectsAndProducts.common.inactive')}
      </span>
      {pastEnd && (
        <span className={`${styles.mark} ${styles.pastEnd}`}>
          {t('projectsAndProducts.common.pastEnd')}
        </span>
      )}
    </span>
  );
}

function ProjectList({
  teamId,
  projects,
  mayConfigure,
  openDialog,
}: {
  teamId: string;
  projects: Project[];
  mayConfigure: boolean;
  openDialog: (dialog: Dialog) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const here = useHere('projectsAndProducts');
  const change = useChangeProject(teamId);
  const teamPath = `/teams/${encodeURIComponent(teamId)}`;

  return (
    <section className={styles.section} aria-labelledby="projects-heading">
      <div className={styles.sectionHeader}>
        <h2 id="projects-heading" className={styles.sectionHeading}>
          {t('projectsAndProducts.common.projects')}
        </h2>
        {mayConfigure && (
          <button
            type="button"
            className={controls.button}
            onClick={() => openDialog({ kind: 'project' })}
          >
            {t('projectsAndProducts.list.addProject')}
          </button>
        )}
      </div>
      {projects.length === 0 ? (
        <p className={styles.empty}>{t('projectsAndProducts.list.noProjects')}</p>
      ) : (
        <ul className={teamStyles.list} aria-label={t('projectsAndProducts.list.projectsLabel')}>
          {projects.map((project) => {
            const label = `${project.code} · ${project.name}`;
            const failed = change.isError && change.variables.id === project.id;
            return (
              <li key={project.id} className={teamStyles.item}>
                <span className={teamStyles.itemMain}>
                  <span className={teamStyles.itemName}>
                    <Link
                      to={`${teamPath}/projects/${encodeURIComponent(project.id)}`}
                      state={here}
                    >
                      <span className={styles.code}>{project.code}</span> · {project.name}
                    </Link>
                    <StatusMarks active={project.active} pastEnd={project.past_end} />
                  </span>
                  <span className={teamStyles.itemMeta}>
                    {t('projectsAndProducts.list.managedBy', {
                      name: project.manager.display_name,
                    })}
                  </span>
                  <span className={teamStyles.itemMeta}>
                    {t('projectsAndProducts.list.dates', {
                      start: format.meetingDate(project.start_date),
                      end: format.meetingDate(project.end_date),
                    })}
                  </span>
                </span>
                {mayConfigure && (
                  <RowActions
                    label={label}
                    active={project.active}
                    busy={change.isPending}
                    onChange={() => openDialog({ kind: 'project', project })}
                    onToggle={() =>
                      change.mutate({ id: project.id, change: { active: !project.active } })
                    }
                    onDelete={() => openDialog({ kind: 'deleteProject', project })}
                  />
                )}
                {failed && (
                  <p role="alert" className={teamStyles.itemError}>
                    {describeFailure(t, change.error)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ProductList({
  teamId,
  products,
  mayConfigure,
  openDialog,
}: {
  teamId: string;
  products: Product[];
  mayConfigure: boolean;
  openDialog: (dialog: Dialog) => void;
}) {
  const { t } = useTranslation();
  const here = useHere('projectsAndProducts');
  const change = useChangeProduct(teamId);
  const teamPath = `/teams/${encodeURIComponent(teamId)}`;

  return (
    <section className={styles.section} aria-labelledby="products-heading">
      <div className={styles.sectionHeader}>
        <h2 id="products-heading" className={styles.sectionHeading}>
          {t('projectsAndProducts.common.products')}
        </h2>
        {mayConfigure && (
          <button
            type="button"
            className={controls.button}
            onClick={() => openDialog({ kind: 'product' })}
          >
            {t('projectsAndProducts.list.addProduct')}
          </button>
        )}
      </div>
      {products.length === 0 ? (
        <p className={styles.empty}>{t('projectsAndProducts.list.noProducts')}</p>
      ) : (
        <ul className={teamStyles.list} aria-label={t('projectsAndProducts.list.productsLabel')}>
          {products.map((product) => {
            const failed = change.isError && change.variables.id === product.id;
            return (
              <li key={product.id} className={teamStyles.item}>
                <span className={teamStyles.itemMain}>
                  <span className={teamStyles.itemName}>
                    <Link
                      to={`${teamPath}/products/${encodeURIComponent(product.id)}`}
                      state={here}
                    >
                      {product.name}
                    </Link>
                    <StatusMarks active={product.active} />
                  </span>
                  <span className={teamStyles.itemMeta}>
                    {t('projectsAndProducts.list.ownedBy', { name: product.owner.display_name })}
                  </span>
                </span>
                {mayConfigure && (
                  <RowActions
                    label={product.name}
                    active={product.active}
                    busy={change.isPending}
                    onChange={() => openDialog({ kind: 'product', product })}
                    onToggle={() =>
                      change.mutate({ id: product.id, change: { active: !product.active } })
                    }
                    onDelete={() => openDialog({ kind: 'deleteProduct', product })}
                  />
                )}
                {failed && (
                  <p role="alert" className={teamStyles.itemError}>
                    {describeFailure(t, change.error)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RowActions({
  label,
  active,
  busy,
  onChange,
  onToggle,
  onDelete,
}: {
  label: string;
  active: boolean;
  busy: boolean;
  onChange: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  return (
    <span className={teamStyles.actions}>
      <button
        type="button"
        className={controls.button}
        onClick={onChange}
        aria-label={t('projectsAndProducts.list.changeLabel', { name: label })}
      >
        {t('projectsAndProducts.list.change')}
      </button>
      <button
        type="button"
        className={controls.button}
        disabled={busy}
        onClick={onToggle}
        aria-label={
          active
            ? t('projectsAndProducts.list.deactivateLabel', { name: label })
            : t('projectsAndProducts.list.reactivateLabel', { name: label })
        }
      >
        {active
          ? t('projectsAndProducts.list.deactivate')
          : t('projectsAndProducts.list.reactivate')}
      </button>
      <button
        type="button"
        className={controls.button}
        onClick={onDelete}
        aria-label={t('projectsAndProducts.list.deleteLabel', { name: label })}
      >
        {t('projectsAndProducts.list.delete')}
      </button>
    </span>
  );
}

/** One labelled input of a dialog, with its hint and the API's error against it. */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={teamStyles.field}>
      <label className={teamStyles.label} htmlFor={id}>
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className={teamStyles.error}>
          {error}
        </p>
      )}
    </div>
  );
}

/** The aria wiring of an input under `Field`. */
function described(id: string, error: string | undefined, hint = false) {
  const ids = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return {
    id,
    'aria-invalid': error !== undefined,
    'aria-describedby': ids === '' ? undefined : ids,
  };
}

function DialogButtons({
  pending,
  onClose,
  other,
}: {
  pending: boolean;
  onClose: () => void;
  other?: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <span className={`${teamStyles.actions} ${teamStyles.submit}`}>
        <button type="submit" className={controls.default} disabled={pending}>
          {pending ? t('projectsAndProducts.list.saving') : t('projectsAndProducts.list.save')}
        </button>
        <button type="button" className={controls.button} onClick={onClose}>
          {t('projectsAndProducts.list.cancel')}
        </button>
      </span>
      {other && (
        <p role="alert" className={teamStyles.itemError}>
          {other}
        </p>
      )}
    </>
  );
}

const PROJECT_FIELDS = ['code', 'name', 'manager_email', 'start_date', 'end_date'] as const;

/** Add a project, or change one: every property but its team. */
function ProjectDialog({
  teamId,
  project,
  onClose,
}: {
  teamId: string;
  project?: Project;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateProject(teamId);
  const change = useChangeProject(teamId);
  const save = project ? change : create;
  const [code, setCode] = useState(project?.code ?? '');
  const [name, setName] = useState(project?.name ?? '');
  const [managerEmail, setManagerEmail] = useState(project?.manager.email ?? '');
  const [startDate, setStartDate] = useState(project?.start_date ?? '');
  const [endDate, setEndDate] = useState(project?.end_date ?? '');
  const first = useRef<HTMLInputElement>(null);
  const id = (field: string) => `project-${field}`;

  useEffect(() => first.current?.focus(), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = {
      code,
      name,
      manager_email: managerEmail,
      start_date: startDate,
      end_date: endDate,
    };
    if (project) change.mutate({ id: project.id, change: fields }, { onSuccess: onClose });
    else create.mutate(fields, { onSuccess: onClose });
  }

  const error = (field: (typeof PROJECT_FIELDS)[number]) =>
    describeFieldFailure(t, save.error, field);
  const heading = project
    ? t('projectsAndProducts.list.changeProject')
    : t('projectsAndProducts.list.addProject');

  return (
    <Modal labelledBy={id('heading')} onClose={onClose}>
      <section className={styles.dialogBody}>
        <h2 id={id('heading')} className={styles.dialogHeading}>
          {heading}
        </h2>
        <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
          <Field id={id('code')} label={t('projectsAndProducts.common.code')} error={error('code')}>
            <input
              ref={first}
              className={teamStyles.input}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              {...described(id('code'), error('code'))}
            />
          </Field>
          <Field id={id('name')} label={t('projectsAndProducts.common.name')} error={error('name')}>
            <input
              className={teamStyles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              {...described(id('name'), error('name'))}
            />
          </Field>
          <Field
            id={id('manager')}
            label={t('projectsAndProducts.list.managerEmail')}
            hint={t('projectsAndProducts.list.personHint')}
            error={error('manager_email')}
          >
            <input
              type="email"
              autoComplete="off"
              className={teamStyles.input}
              value={managerEmail}
              onChange={(event) => setManagerEmail(event.target.value)}
              {...described(id('manager'), error('manager_email'), true)}
            />
          </Field>
          <Field
            id={id('start')}
            label={t('projectsAndProducts.common.startDate')}
            error={error('start_date')}
          >
            <input
              type="date"
              className={teamStyles.input}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              {...described(id('start'), error('start_date'))}
            />
          </Field>
          <Field
            id={id('end')}
            label={t('projectsAndProducts.common.endDate')}
            error={error('end_date')}
          >
            <input
              type="date"
              className={teamStyles.input}
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              {...described(id('end'), error('end_date'))}
            />
          </Field>
          <DialogButtons
            pending={save.isPending}
            onClose={onClose}
            other={describeOtherFailure(t, save.error, PROJECT_FIELDS)}
          />
        </form>
      </section>
    </Modal>
  );
}

const PRODUCT_FIELDS = ['name', 'owner_email', 'jira_url'] as const;

/** Add a product, or change one; an emptied link is cleared. */
function ProductDialog({
  teamId,
  product,
  onClose,
}: {
  teamId: string;
  product?: Product;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateProduct(teamId);
  const change = useChangeProduct(teamId);
  const save = product ? change : create;
  const [name, setName] = useState(product?.name ?? '');
  const [ownerEmail, setOwnerEmail] = useState(product?.owner.email ?? '');
  const [jiraUrl, setJiraUrl] = useState(product?.jira_url ?? '');
  const first = useRef<HTMLInputElement>(null);
  const id = (field: string) => `product-${field}`;

  useEffect(() => first.current?.focus(), []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const link = jiraUrl.trim();
    const fields = { name, owner_email: ownerEmail, jira_url: link === '' ? null : link };
    if (product) change.mutate({ id: product.id, change: fields }, { onSuccess: onClose });
    else create.mutate(fields, { onSuccess: onClose });
  }

  const error = (field: (typeof PRODUCT_FIELDS)[number]) =>
    describeFieldFailure(t, save.error, field);
  const heading = product
    ? t('projectsAndProducts.list.changeProduct')
    : t('projectsAndProducts.list.addProduct');

  return (
    <Modal labelledBy={id('heading')} onClose={onClose}>
      <section className={styles.dialogBody}>
        <h2 id={id('heading')} className={styles.dialogHeading}>
          {heading}
        </h2>
        <form className={teamStyles.form} onSubmit={handleSubmit} noValidate>
          <Field id={id('name')} label={t('projectsAndProducts.common.name')} error={error('name')}>
            <input
              ref={first}
              className={teamStyles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
              {...described(id('name'), error('name'))}
            />
          </Field>
          <Field
            id={id('owner')}
            label={t('projectsAndProducts.list.ownerEmail')}
            hint={t('projectsAndProducts.list.personHint')}
            error={error('owner_email')}
          >
            <input
              type="email"
              autoComplete="off"
              className={teamStyles.input}
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              {...described(id('owner'), error('owner_email'), true)}
            />
          </Field>
          <Field
            id={id('jira')}
            label={t('projectsAndProducts.common.jiraBoard')}
            hint={t('projectsAndProducts.list.jiraHint')}
            error={error('jira_url')}
          >
            <input
              type="url"
              className={teamStyles.input}
              value={jiraUrl}
              onChange={(event) => setJiraUrl(event.target.value)}
              {...described(id('jira'), error('jira_url'), true)}
            />
          </Field>
          <DialogButtons
            pending={save.isPending}
            onClose={onClose}
            other={describeOtherFailure(t, save.error, PRODUCT_FIELDS)}
          />
        </form>
      </section>
    </Modal>
  );
}

/**
 * Asks before deleting, since the metrics go with it. A refusal - values
 * recorded, or a metric another board derives from - is shown in the dialog,
 * which says to make it inactive instead.
 */
function DeleteDialog({
  heading,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  heading: string;
  pending: boolean;
  error: string | undefined;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const confirm = useRef<HTMLButtonElement>(null);

  useEffect(() => confirm.current?.focus(), []);

  return (
    <Modal labelledBy="delete-heading" onClose={onClose}>
      <section className={styles.dialogBody}>
        <h2 id="delete-heading" className={styles.dialogHeading}>
          {heading}
        </h2>
        <p className={styles.hint}>{t('projectsAndProducts.list.deleteWarning')}</p>
        {error && (
          <p role="alert" className={teamStyles.error}>
            {error}
          </p>
        )}
        <span className={teamStyles.actions}>
          <button
            ref={confirm}
            type="button"
            className={controls.default}
            disabled={pending || error !== undefined}
            onClick={onConfirm}
          >
            {pending
              ? t('projectsAndProducts.list.deleting')
              : t('projectsAndProducts.list.delete')}
          </button>
          <button type="button" className={controls.button} onClick={onClose}>
            {t('projectsAndProducts.list.cancel')}
          </button>
        </span>
      </section>
    </Modal>
  );
}

function DeleteProjectDialog({
  teamId,
  project,
  onClose,
}: {
  teamId: string;
  project: Project;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteProject(teamId);
  return (
    <DeleteDialog
      heading={t('projectsAndProducts.list.deleteProjectHeading', {
        name: `${project.code} · ${project.name}`,
      })}
      pending={remove.isPending}
      error={describeFailure(t, remove.error)}
      onConfirm={() => remove.mutate(project.id, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}

function DeleteProductDialog({
  teamId,
  product,
  onClose,
}: {
  teamId: string;
  product: Product;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const remove = useDeleteProduct(teamId);
  return (
    <DeleteDialog
      heading={t('projectsAndProducts.list.deleteProductHeading', { name: product.name })}
      pending={remove.isPending}
      error={describeFailure(t, remove.error)}
      onConfirm={() => remove.mutate(product.id, { onSuccess: onClose })}
      onClose={onClose}
    />
  );
}
