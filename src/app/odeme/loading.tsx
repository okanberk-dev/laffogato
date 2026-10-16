/**
 * While the checkout's server part renders (settings, the account, the
 * saved-card list with its own deadline): the page's frame and a skeleton,
 * never a blank screen.
 */
export default function CheckoutLoading() {
  return (
    <div className="checkout-page">
      <div className="checkout-page-wrap">
        <p className="sr-only" role="status">
          Ödeme sayfası yükleniyor…
        </p>
        <div className="checkout-skeleton" aria-hidden="true" />
      </div>
    </div>
  );
}
