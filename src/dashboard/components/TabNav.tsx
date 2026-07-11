export type ScreenId = 'ops' | 'diag';

export function TabNav({
  active,
  onChange,
}: {
  active: ScreenId;
  onChange: (id: ScreenId) => void;
}) {
  return (
    <nav className="tabnav">
      <button className={active === 'ops' ? 'active' : ''} onClick={() => onChange('ops')}>
        Ops Health
      </button>
      <button className={active === 'diag' ? 'active' : ''} onClick={() => onChange('diag')}>
        Diagnostic
      </button>
    </nav>
  );
}
