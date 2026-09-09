'use client';
import {
  useId,
  useRef,
  useState,
  type ReactNode,
  type InputHTMLAttributes,
  type ComponentProps,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Loader2,
  AlertTriangle,
  Inbox,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  Empty,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  errorMessage,
  daysUntil,
  statusLabels,
  type User,
  type Status,
} from '@/lib/contracts';

export function Btn({
  children,
  secondary = false,
  danger = false,
  busy = false,
  className = '',
  ...props
}: Omit<ComponentProps<typeof Button>, 'className'> & {
  className?: string;
  secondary?: boolean;
  danger?: boolean;
  busy?: boolean;
}) {
  return (
    <Button
      {...props}
      disabled={props.disabled || busy}
      className={`fu-button ${secondary ? 'secondary' : ''} ${danger ? 'danger' : ''} ${className}`}
    >
      {busy && <Loader2 className="spin" size={16} />} {children}
    </Button>
  );
}
export function Field({
  label,
  error,
  help,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  help?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Input
        {...props}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error || help ? `${id}-help` : undefined}
        className={`fu-input ${props.className || ''}`}
      />
      {(error || help) && (
        <span
          id={`${id}-help`}
          className={error ? 'field-error' : 'field-help'}
        >
          {error || help}
        </span>
      )}
    </div>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label id={id}>{label}</label>
      <Select
        value={value}
        onValueChange={(v) => {
          if (v !== null) onChange(v as string);
        }}
        items={options}
        disabled={disabled}
      >
        <SelectTrigger className="fu-select" aria-labelledby={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="fu-select-popup">
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Card({
  children,
  soft = false,
  className = '',
}: {
  children: ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return (
    <section className={`fu-card ${soft ? 'soft' : ''} ${className}`}>
      {children}
    </section>
  );
}
export function Header({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1 tabIndex={-1}>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="header-actions">{action}</div>}
    </div>
  );
}
export function Back({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="back-link" onClick={onClick}>
      <ArrowLeft size={15} />
      {children}
    </button>
  );
}
export function Avatar({
  user,
  size = 'normal',
}: {
  user?: Pick<User, 'name' | 'id'>;
  size?: 'normal' | 'small' | 'large';
}) {
  const n = user?.name || '미지정';
  const colors = ['peach', 'rose', 'purple', 'green'];
  return (
    <span
      aria-label={n}
      title={n}
      className={`avatar ${size} ${colors[n.charCodeAt(0) % 4]}`}
    >
      {user ? n[0] : '–'}
    </span>
  );
}
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status-badge ${status}`}>
      <i className={`status-dot ${status}`} />
      {statusLabels[status]}
    </span>
  );
}
export function DueBadge({
  date,
  status,
  threshold = 3,
}: {
  date: string | null;
  status: Status;
  threshold?: number;
}) {
  const days = daysUntil(date);
  if (days === null)
    return <span className="date-label muted">기한 미지정</span>;
  return (
    <span
      className={`due-badge ${status === 'DONE' ? '' : days < 0 ? 'overdue' : days <= threshold ? 'soon' : ''}`}
      title={date!}
    >
      {status !== 'DONE' && days < 0
        ? `${Math.abs(days)}일 지연`
        : status !== 'DONE' && days <= threshold
          ? days === 0
            ? '오늘 마감'
            : `D-${days}`
          : date!.slice(5).replace('-', '.')}
    </span>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyMedia variant="icon">
        <Inbox size={22} />
      </EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      {description && <EmptyDescription>{description}</EmptyDescription>}
      {action}
    </Empty>
  );
}
export function Loading({ text = '불러오고 있어요' }: { text?: string }) {
  return (
    <output className="loading-state">
      <div>
        <Loader2 size={19} className="spin" />
        {text}
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </output>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={20} />
      <p>{errorMessage(error)}</p>
      {retry && (
        <Btn secondary onClick={retry}>
          다시 시도
        </Btn>
      )}
    </div>
  );
}
export function MemberPicker({
  pool,
  selected,
  onChange,
  locked = [],
}: {
  pool: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  locked?: string[];
}) {
  const [query, setQuery] = useState('');
  const filtered = pool.filter((m) =>
    `${m.name} ${m.email} ${m.role}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="member-picker">
      <div className="search-field">
        <Search size={16} />
        <Input
          className="fu-input"
          placeholder="이름, 이메일 또는 역할로 검색"
          aria-label="구성원 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="picker-list">
        {filtered.map((m) => (
          <label
            className={`picker-row ${selected.includes(m.id) ? 'checked' : ''}`}
            key={m.id}
          >
            <Checkbox
              checked={selected.includes(m.id)}
              disabled={locked.includes(m.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...new Set([...selected, m.id])]
                    : selected.filter((i) => i !== m.id),
                )
              }
            />
            <Avatar user={m} />
            <div>
              <b>{m.name}</b>
              <span>
                {m.email} · {m.role}
              </span>
            </div>
            {locked.includes(m.id) && <span className="pill">나</span>}
          </label>
        ))}
        {!filtered.length && <p className="muted">일치하는 구성원이 없어요.</p>}
      </div>
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  open = true,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  open?: boolean;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className={`fu-modal ${wide ? 'wide' : ''}`}>
        <DialogTitle className="modal-title">{title}</DialogTitle>
        <DialogDescription
          className={description ? 'modal-description' : 'sr-only'}
        >
          {description || title}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function ConfirmDialog({
  title,
  description,
  open,
  onClose,
  onConfirm,
  busy = false,
  confirmDisabled = false,
  children,
  confirmLabel = '삭제',
}: {
  title: string;
  description: string;
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  confirmLabel?: string;
}) {
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <AlertDialogContent className="fu-modal confirm-modal">
        <AlertDialogTitle className="modal-title">{title}</AlertDialogTitle>
        <AlertDialogDescription className="modal-description">
          {description}
        </AlertDialogDescription>
        {children}
        <div className="form-actions">
          <AlertDialogCancel disabled={busy} className="fu-button secondary">
            취소
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || confirmDisabled}
            className="fu-button danger solid"
            onClick={onConfirm}
          >
            {busy ? <Loader2 className="spin" size={15} /> : null}
            {confirmLabel}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function useAction() {
  const qc = useQueryClient();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function run<T>(
    fn: () => Promise<T>,
    message?: string,
  ): Promise<T | undefined> {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await fn();
      await qc.invalidateQueries({ queryKey: ['followup'] });
      if (message)
        toast.add({ title: message, type: 'success', timeout: 3500 });
      return result;
    } catch (e) {
      setError(e);
      toast.add({ title: errorMessage(e), type: 'error', timeout: 6000 });
      return undefined;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
export function SaveNotice({ children }: { children: ReactNode }) {
  return (
    <span className="save-notice">
      <Check size={13} />
      {children}
    </span>
  );
}
