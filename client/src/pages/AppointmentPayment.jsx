import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const loadRazorpay = () => new Promise((resolve) => {
  if (window.Razorpay) return resolve(true);
  const script = document.createElement('script');
  script.src = 'https://checkout.razorpay.com/v1/checkout.js';
  script.onload = () => resolve(true);
  script.onerror = () => resolve(false);
  document.body.appendChild(script);
});

const AppointmentPayment = () => {
  const { aid } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [paymentComplete, setPaymentComplete] = useState(false);

  useEffect(() => {
    let active = true;
    axios.post(`/api/payments/order/${aid}`)
      .then(({ data }) => {
        if (!active) return;
        if (!data?.ok) throw new Error(data?.error || 'Unable to start checkout.');
        setCheckout(data);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.response?.data?.error || requestError.message || 'Unable to start checkout.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [aid]);

  const handleSimulation = async (result) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const endpoint = result === 'paid' ? 'simulate' : 'fail';
      const { data } = await axios.post(`/api/payments/${endpoint}/${aid}`, {
        payment_mode: 'simulation'
      });
      if (!data?.ok) throw new Error(data?.error || 'Unable to update the simulated payment.');
      if (result === 'paid') {
        setPaymentComplete(true);
        setMessage(data.message || 'Demo payment recorded. No money was charged.');
        setTimeout(() => navigate('/dashboard#appointments'), 1200);
      } else {
        setMessage(data.message);
        setCheckout(null);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Unable to update the simulated payment.');
    } finally {
      setBusy(false);
    }
  };

  const openRazorpay = async () => {
    if (!checkout || checkout.payment_mode !== 'razorpay') return;
    setBusy(true);
    setError('');
    try {
      const loaded = await loadRazorpay();
      if (!loaded) throw new Error('Razorpay Checkout could not be loaded. Check your connection and try again.');
      const paymentWindow = new window.Razorpay({
        key: checkout.key_id,
        amount: checkout.amount,
        currency: checkout.currency,
        name: 'UltraCare',
        description: 'Healthcare appointment',
        order_id: checkout.order_id,
        prefill: { name: user?.full_name || '', email: user?.email || '' },
        notes: { appointment_id: aid },
        theme: { color: '#0f766e' },
        handler: async (gatewayResponse) => {
          try {
            const response = await axios.post(`/api/payments/verify/${aid}`, gatewayResponse);
            if (!response.data?.ok) throw new Error(response.data?.error || 'Payment verification is pending.');
            setPaymentComplete(true);
            setMessage('Payment confirmed.');
            setTimeout(() => navigate('/dashboard#appointments'), 1200);
          } catch (verificationError) {
            setError(verificationError.response?.data?.error || verificationError.message || 'Payment confirmation is pending. Check payment history before retrying.');
          } finally {
            setBusy(false);
          }
        },
        modal: { ondismiss: () => setBusy(false) }
      });
      paymentWindow.on('payment.failed', async (event) => {
        try {
          const response = await axios.post(`/api/payments/fail/${aid}`, {
            payment_mode: 'razorpay',
            razorpay_payment_id: event.error?.metadata?.payment_id || ''
          });
          setMessage(response.data?.message || 'Payment failed. Your doctor has been notified and can reschedule.');
          setCheckout(null);
        } catch (failureError) {
          setError(failureError.response?.data?.error || failureError.message || 'Payment failed, but the doctor could not be notified.');
        } finally {
          setBusy(false);
        }
      });
      paymentWindow.open();
    } catch (paymentError) {
      setError(paymentError.message || 'Unable to open Razorpay Checkout.');
      setBusy(false);
    }
  };

  const renderPaymentButton = (label, loadingLabel, onClick) => (
    <button
      type="button"
      className={`payment-action-button${paymentComplete ? ' is-complete' : ''}`}
      disabled={busy || paymentComplete}
      onClick={onClick}
      aria-busy={busy}
      aria-live="polite"
    >
      <span className="payment-action-text">
        {paymentComplete ? 'Payment Complete' : busy ? loadingLabel : label}
      </span>
      <span className="payment-action-icons" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="payment-action-icon payment-card-icon">
          <path d="M20 8H4V6H20M20 18H4V12H20M20 4H4C2.89 4 2 4.89 2 6V18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4Z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 24 24" className="payment-action-icon payment-method-icon">
          <path d="M2 17H22V21H2V17M6.25 7H9V6H6V3H18V6H15V7H17.75L19 17H5L6.25 7M9 10H15V8H9V10M9 13H15V11H9V13Z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 24 24" className="payment-action-icon payment-currency-icon">
          <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 24 24" className="payment-action-icon payment-wallet-icon">
          <path d="M21 18V19A2 2 0 0 1 19 21H5C3.89 21 3 20.1 3 19V5A2 2 0 0 1 5 3H19A2 2 0 0 1 21 5V6H12C10.89 6 10 6.9 10 8V16A2 2 0 0 0 12 18M12 16H22V8H12M16 13.5A1.5 1.5 0 0 1 14.5 12A1.5 1.5 0 0 1 16 10.5A1.5 1.5 0 0 1 17.5 12A1.5 1.5 0 0 1 16 13.5Z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 24 24" className="payment-action-icon payment-check-icon">
          <path d="M9 16.17 4.83 12 3.41 13.41 9 19 21 7 19.59 5.59 9 16.17Z" fill="currentColor" />
        </svg>
      </span>
    </button>
  );

  return (
    <div className="container" style={{ maxWidth: '720px', padding: '48px 20px' }}>
      <div className="glass" style={{ padding: '30px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: '8px' }}>Appointment payment</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Your appointment is booked. Complete payment now to finalize it.
        </p>

        {loading && <p role="status">Preparing secure checkout…</p>}
        {!loading && checkout && (
          <>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, margin: '22px 0' }}>
              Amount: ₹{(checkout.amount / 100).toFixed(2)}
            </p>
            {checkout.payment_mode === 'simulation' ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '18px', textAlign: 'left' }}>
                <strong>Demo payment simulation</strong>
                <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No money will be charged. Choose a result to test the payment flow.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {renderPaymentButton('Pay Now', 'Processing…', () => handleSimulation('paid'))}
                  <button className="btn btn-outline" disabled={busy} onClick={() => handleSimulation('failed')}>
                    Simulate payment failure
                  </button>
                </div>
              </div>
            ) : (
              renderPaymentButton('Pay Now', 'Opening checkout…', openRazorpay)
            )}
          </>
        )}

        {error && <div className="alert alert-danger" role="alert" style={{ marginTop: '18px' }}>{error}</div>}
        {message && <div className="alert alert-info" role="status" style={{ marginTop: '18px' }}>{message}</div>}
        <div style={{ marginTop: '22px' }}>
          <Link to="/dashboard#appointments">Return to dashboard</Link>
        </div>
      </div>
    </div>
  );
};

export default AppointmentPayment;
