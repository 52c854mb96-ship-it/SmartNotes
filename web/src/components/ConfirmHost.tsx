import { confirmStore } from '../lib/ui';
import { Modal } from './Modal';

/** Viser bekreftelsesdialogen som `confirmDialog()` ber om. */
export function ConfirmHost() {
  const req = confirmStore.use();
  const close = (ok: boolean) => {
    req?.resolve(ok);
    confirmStore.set(null);
  };
  return (
    <Modal
      open={!!req}
      onClose={() => close(false)}
      title={req?.title ?? ''}
      size="sm"
      footer={
        <>
          <button type="button" className="btn" onClick={() => close(false)} data-autofocus>
            {req?.cancelLabel ?? 'Avbryt'}
          </button>
          <button
            type="button"
            className={`btn ${req?.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => close(true)}
          >
            {req?.confirmLabel ?? 'OK'}
          </button>
        </>
      }
    >
      {req?.body && <p className="confirm-body">{req.body}</p>}
    </Modal>
  );
}
