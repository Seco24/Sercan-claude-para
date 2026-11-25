import { Icon } from '../../components/Icon';
import { Modal } from '../../components/Modal';
import { formatDate } from '../../domain/dates';
import { dailyCountedTotal, type LimitBreach } from '../../domain/expenses';
import { tl } from '../../domain/money';
import { href } from '../../hooks/useHashRoute';
import { useStore } from '../../state/store';

/** "Bugün ₺X / ₺Y" çubuğu. Limit ayarlı değilse hiçbir şey çizmez. */
export function DailyLimitMeter() {
  const { state, today } = useStore();
  const { dailyLimit, limitExcluded } = state.settings;
  if (!(dailyLimit > 0)) return null;
  const spent = dailyCountedTotal(state.expenses, today, limitExcluded);
  const ratio = spent / dailyLimit;
  const over = spent - dailyLimit;
  const level = over > 0.004 ? 'over' : ratio >= 0.8 ? 'near' : 'ok';
  return (
    <a className={`limit limit--${level}`} href={href('ayarlar')} aria-label="Günlük harcama limiti, ayarlara git">
      <div className="limit__row">
        <span className="limit__label">
          {level !== 'ok' && <Icon name="alert" size={16} />}
          Bugünkü harcama
        </span>
        <span className="num">
          <strong>{tl(spent)}</strong>
          <span className="muted"> / {tl(dailyLimit, { decimals: 0 })} limit</span>
        </span>
      </div>
      <span className="limit__track" aria-hidden="true">
        <span className="limit__fill" style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </span>
      <span className="limit__note">
        {level === 'over'
          ? `Günlük limiti ${tl(over)} aştınız`
          : level === 'near'
            ? `Limite ${tl(dailyLimit - spent)} kaldı`
            : `Kalan ${tl(dailyLimit - spent)}`}
      </span>
    </a>
  );
}

export function limitMessage(b: LimitBreach, today: string): { title: string; body: string } {
  const when = b.date === today ? 'Bugün' : `${formatDate(b.date)} günü`;
  return {
    title: 'Günlük harcama limiti aşıldı',
    body: `${when} ${tl(b.spent)} harcadınız. Limitiniz ${tl(b.limit, { decimals: 0 })}, ${tl(b.over)} fazla.`,
  };
}

/** Limit aşılınca harcama kaydından hemen sonra açılan uyarı penceresi. */
export function LimitAlert({ breach, onClose }: { breach: LimitBreach; onClose: () => void }) {
  const { today } = useStore();
  const msg = limitMessage(breach, today);
  return (
    <Modal
      open
      size="sm"
      title={msg.title}
      onClose={onClose}
      footer={
        <>
          <a
            className="btn btn--ghost"
            href={href('ayarlar')}
            onClick={() => {
              onClose();
            }}
          >
            Limiti değiştir
          </a>
          <span className="spacer" />
          <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
            Tamam
          </button>
        </>
      }
    >
      <div className="limit-alert">
        <span className="limit-alert__icon" aria-hidden="true">
          <Icon name="alert" size={26} />
        </span>
        <p className="limit-alert__fig num">
          {tl(breach.spent)}
          <span className="muted"> / {tl(breach.limit, { decimals: 0 })}</span>
        </p>
        <p>{msg.body}</p>
      </div>
    </Modal>
  );
}
